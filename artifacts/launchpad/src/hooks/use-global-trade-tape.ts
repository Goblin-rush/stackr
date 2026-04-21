import { useEffect, useRef, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem, type Log } from 'viem';
import { FACTORY_ABI, FACTORY_ADDRESS, BONDING_CURVE_ABI, isHiddenToken } from '@/lib/contracts';

export interface GlobalTrade {
  id: string;
  type: 'buy' | 'sell';
  account: `0x${string}`;
  ethAmount: number;
  tokenAddress: `0x${string}`;
  symbol: string;
  timestamp: number;
  txHash: `0x${string}`;
}

const BUY_EVENT = parseAbiItem(
  'event Buy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 progress)'
);
const SELL_EVENT = parseAbiItem(
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 progress)'
);
const TOKEN_CREATED = parseAbiItem(
  'event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint256 index)'
);

const KEEP = 40;
const BACKFILL_BLOCKS = 9_000n; // publicnode free RPC limit is ~10k blocks per getLogs

export function useGlobalTradeTape(maxTokens = 200) {
  const client = usePublicClient();
  const [trades, setTrades] = useState<GlobalTrade[]>([]);
  const symbolMapRef = useRef<Map<string, string>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    let unwatchBuy: (() => void) | undefined;
    let unwatchSell: (() => void) | undefined;
    let unwatchCreated: (() => void) | undefined;

    const blockTsCache = new Map<bigint, number>();
    const getTs = async (bn: bigint) => {
      const c = blockTsCache.get(bn);
      if (c !== undefined) return c;
      try {
        const b = await client.getBlock({ blockNumber: bn });
        const ts = Number(b.timestamp) * 1000;
        blockTsCache.set(bn, ts);
        return ts;
      } catch {
        return Date.now();
      }
    };

    const pushTrades = (incoming: GlobalTrade[]) => {
      if (incoming.length === 0) return;
      setTrades((cur) => {
        const merged = [...incoming, ...cur].slice(0, KEEP);
        return merged;
      });
    };

    (async () => {
      try {
        // Use totalTokens + allTokens(i) since factory.getTokens() returns empty (bug)
        const total = (await client.readContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'totalTokens',
        })) as bigint;
        const totalNum = Math.min(Number(total), maxTokens);
        let addrs: `0x${string}`[] = [];
        if (totalNum > 0) {
          const calls = Array.from({ length: totalNum }, (_, i) => ({
            address: FACTORY_ADDRESS,
            abi: FACTORY_ABI,
            functionName: 'allTokens' as const,
            args: [BigInt(i)],
          }));
          const res = await client.multicall({ contracts: calls, allowFailure: true });
          addrs = res
            .map((r) => (r.status === 'success' ? (r.result as `0x${string}`) : null))
            .filter((a): a is `0x${string}` => !!a && !isHiddenToken(a));
        }

        if (cancelled || addrs.length === 0) {
          // still subscribe to TokenCreated so future tokens populate symbol map
        }

        // Fetch symbols (chunked multicall)
        if (addrs.length > 0) {
          const CHUNK = 60;
          for (let i = 0; i < addrs.length; i += CHUNK) {
            const chunk = addrs.slice(i, i + CHUNK);
            const res = await client.multicall({
              contracts: chunk.map((address) => ({
                address,
                abi: BONDING_CURVE_ABI,
                functionName: 'symbol' as const,
              })),
              allowFailure: true,
            });
            if (cancelled) return;
            chunk.forEach((a, idx) => {
              const r = res[idx];
              if (r?.status === 'success') {
                symbolMapRef.current.set(a.toLowerCase(), r.result as string);
              }
            });
          }
        }

        // Backfill recent buy/sell logs across all tokens
        if (addrs.length > 0) {
          const tip = await client.getBlockNumber();
          const fromBlock = tip > BACKFILL_BLOCKS ? tip - BACKFILL_BLOCKS : 0n;
          const [buyLogs, sellLogs] = await Promise.all([
            client.getLogs({ address: addrs, event: BUY_EVENT, fromBlock, toBlock: tip }),
            client.getLogs({ address: addrs, event: SELL_EVENT, fromBlock, toBlock: tip }),
          ]);
          if (cancelled) return;

          const all: Array<{ log: any; isBuy: boolean }> = [
            ...(buyLogs as any[]).map((l) => ({ log: l, isBuy: true })),
            ...(sellLogs as any[]).map((l) => ({ log: l, isBuy: false })),
          ];
          // Sort newest first
          all.sort((a, b) => {
            const bn = Number(b.log.blockNumber - a.log.blockNumber);
            if (bn !== 0) return bn;
            return Number((b.log.logIndex ?? 0) - (a.log.logIndex ?? 0));
          });
          const slice = all.slice(0, KEEP);

          // Resolve unique block timestamps
          const blocks = new Set<bigint>();
          slice.forEach(({ log }) => blocks.add(log.blockNumber));
          await Promise.all(Array.from(blocks).map((b) => getTs(b)));

          const built: GlobalTrade[] = [];
          for (const { log, isBuy } of slice) {
            const id = `${log.transactionHash}:${log.logIndex}`;
            if (seenRef.current.has(id)) continue;
            seenRef.current.add(id);
            const tokenAddress = log.address as `0x${string}`;
            const symbol = symbolMapRef.current.get(tokenAddress.toLowerCase()) || '?';
            const ethAmount = isBuy
              ? Number(formatEther(log.args.ethIn as bigint))
              : Number(formatEther(log.args.ethOut as bigint));
            const account = (isBuy ? log.args.buyer : log.args.seller) as `0x${string}`;
            built.push({
              id,
              type: isBuy ? 'buy' : 'sell',
              account,
              ethAmount,
              tokenAddress,
              symbol,
              timestamp: blockTsCache.get(log.blockNumber) ?? Date.now(),
              txHash: log.transactionHash as `0x${string}`,
            });
          }
          if (built.length > 0) setTrades(built.slice(0, KEEP));
        }

        // Live subscriptions
        const handleLive = async (logs: Log[], isBuy: boolean) => {
          const fresh: GlobalTrade[] = [];
          for (const l of logs as any[]) {
            const id = `${l.transactionHash}:${l.logIndex}`;
            if (seenRef.current.has(id)) continue;
            seenRef.current.add(id);
            const tokenAddress = l.address as `0x${string}`;
            const symbol = symbolMapRef.current.get(tokenAddress.toLowerCase()) || '?';
            const ethAmount = isBuy
              ? Number(formatEther(l.args.ethIn as bigint))
              : Number(formatEther(l.args.ethOut as bigint));
            const account = (isBuy ? l.args.buyer : l.args.seller) as `0x${string}`;
            const ts = await getTs(l.blockNumber);
            fresh.push({
              id,
              type: isBuy ? 'buy' : 'sell',
              account,
              ethAmount,
              tokenAddress,
              symbol,
              timestamp: ts,
              txHash: l.transactionHash as `0x${string}`,
            });
          }
          pushTrades(fresh);
        };

        const subscribe = (currentAddrs: `0x${string}`[]) => {
          unwatchBuy?.();
          unwatchSell?.();
          if (currentAddrs.length === 0) return;
          unwatchBuy = client.watchEvent({
            address: currentAddrs,
            event: BUY_EVENT,
            onLogs: (logs) => handleLive(logs, true),
          });
          unwatchSell = client.watchEvent({
            address: currentAddrs,
            event: SELL_EVENT,
            onLogs: (logs) => handleLive(logs, false),
          });
        };

        subscribe(addrs);

        // Watch new tokens — re-subscribe with extended address list
        const trackedAddrs = new Set(addrs.map((a) => a.toLowerCase()));
        unwatchCreated = client.watchEvent({
          address: FACTORY_ADDRESS,
          event: TOKEN_CREATED,
          onLogs: (logs) => {
            const newTokens: `0x${string}`[] = [];
            for (const l of logs as any[]) {
              const a = l.args.token as `0x${string}`;
              if (!trackedAddrs.has(a.toLowerCase())) {
                trackedAddrs.add(a.toLowerCase());
                newTokens.push(a);
                symbolMapRef.current.set(a.toLowerCase(), (l.args.symbol as string) || '?');
              }
            }
            if (newTokens.length > 0) {
              subscribe(Array.from(trackedAddrs) as `0x${string}`[]);
            }
          },
        });
      } catch {
        /* ignore — tape is non-critical */
      }
    })();

    return () => {
      cancelled = true;
      unwatchBuy?.();
      unwatchSell?.();
      unwatchCreated?.();
    };
  }, [client, maxTokens]);

  return trades;
}
