import { useEffect, useRef, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem, type Log } from 'viem';
import { FACTORY_V2_ADDRESS, FACTORY_V2_ABI, TOKEN_V2_ABI, CURVE_V2_ABI, isHiddenToken } from '@/lib/contracts';

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

// V2 events on CURVE contracts
const BUY_EVENT = parseAbiItem(
  'event Buy(address indexed buyer, uint256 ethIn, uint256 ethForCurve, uint256 tokensOut, uint256 progressBps)'
);
const SELL_EVENT = parseAbiItem(
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ethOutGross, uint256 ethToUser, uint256 progressBps)'
);
const TOKEN_DEPLOYED = parseAbiItem(
  'event TokenDeployed(address indexed token, address indexed curve, address indexed creator, string name, string symbol, string metadataURI, uint256 devBuyEth, uint256 devBuyTokens)'
);

const KEEP = 40;
const BACKFILL_BLOCKS = 9_000n;

export function useGlobalTradeTape(maxTokens = 200) {
  const client = usePublicClient();
  const [trades, setTrades] = useState<GlobalTrade[]>([]);
  // Maps lowercase curveAddress → { tokenAddress, symbol }
  const curveMapRef = useRef<Map<string, { tokenAddress: `0x${string}`; symbol: string }>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!client || !FACTORY_V2_ADDRESS) return;
    const factory = FACTORY_V2_ADDRESS;
    let cancelled = false;
    let unwatchBuy: (() => void) | undefined;
    let unwatchSell: (() => void) | undefined;
    let unwatchDeployed: (() => void) | undefined;

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
      setTrades((cur) => [...incoming, ...cur].slice(0, KEEP));
    };

    const subscribe = (curves: `0x${string}`[]) => {
      unwatchBuy?.();
      unwatchSell?.();
      if (curves.length === 0) return;
      unwatchBuy = client.watchEvent({
        address: curves,
        event: BUY_EVENT,
        onLogs: (logs) => handleLive(logs, true),
      });
      unwatchSell = client.watchEvent({
        address: curves,
        event: SELL_EVENT,
        onLogs: (logs) => handleLive(logs, false),
      });
    };

    const handleLive = async (logs: Log[], isBuy: boolean) => {
      const fresh: GlobalTrade[] = [];
      for (const l of logs as any[]) {
        const id = `${l.transactionHash}:${l.logIndex}`;
        if (seenRef.current.has(id)) continue;
        seenRef.current.add(id);
        const curveAddr = (l.address as string).toLowerCase();
        const entry = curveMapRef.current.get(curveAddr);
        if (!entry) continue;
        const ethAmount = isBuy
          ? Number(formatEther(l.args.ethIn as bigint))
          : Number(formatEther(l.args.ethToUser as bigint));
        const account = (isBuy ? l.args.buyer : l.args.seller) as `0x${string}`;
        const ts = await getTs(l.blockNumber);
        fresh.push({
          id,
          type: isBuy ? 'buy' : 'sell',
          account,
          ethAmount,
          tokenAddress: entry.tokenAddress,
          symbol: entry.symbol,
          timestamp: ts,
          txHash: l.transactionHash as `0x${string}`,
        });
      }
      pushTrades(fresh);
    };

    (async () => {
      try {
        if (!factory) return;

        // 1) Enumerate tokens from V2 factory
        const total = (await client.readContract({
          address: factory,
          abi: FACTORY_V2_ABI,
          functionName: 'allTokensLength',
        })) as bigint;
        const totalNum = Math.min(Number(total), maxTokens);

        let tokenAddrs: `0x${string}`[] = [];
        if (totalNum > 0) {
          const calls = Array.from({ length: totalNum }, (_, i) => ({
            address: factory,
            abi: FACTORY_V2_ABI,
            functionName: 'allTokens' as const,
            args: [BigInt(i)],
          }));
          const res = await client.multicall({ contracts: calls, allowFailure: true });
          tokenAddrs = res
            .map((r) => (r.status === 'success' ? (r.result as `0x${string}`) : null))
            .filter((a): a is `0x${string}` => !!a && !isHiddenToken(a));
        }

        if (cancelled) return;

        // 2) Get records (curve + symbol) via multicall
        if (tokenAddrs.length > 0) {
          const CHUNK = 40;
          for (let i = 0; i < tokenAddrs.length; i += CHUNK) {
            const chunk = tokenAddrs.slice(i, i + CHUNK);
            const recordCalls = chunk.map((t) => ({
              address: factory,
              abi: FACTORY_V2_ABI,
              functionName: 'getRecord' as const,
              args: [t] as [`0x${string}`],
            }));
            const symbolCalls = chunk.map((t) => ({
              address: t,
              abi: TOKEN_V2_ABI,
              functionName: 'symbol' as const,
            }));
            const [recordRes, symbolRes] = await Promise.all([
              client.multicall({ contracts: recordCalls, allowFailure: true }),
              client.multicall({ contracts: symbolCalls, allowFailure: true }),
            ]);
            if (cancelled) return;
            type RecordTuple = { creator: `0x${string}`; curve: `0x${string}`; createdAt: bigint; metadataURI: string };
            chunk.forEach((tokenAddress, j) => {
              const rec = recordRes[j]?.status === 'success' ? (recordRes[j].result as unknown as RecordTuple) : null;
              const sym = symbolRes[j]?.status === 'success' ? (symbolRes[j].result as string) : '?';
              if (rec?.curve) {
                curveMapRef.current.set(rec.curve.toLowerCase(), { tokenAddress, symbol: sym });
              }
            });
          }

          // 3) Backfill recent trades
          const curveAddrs = Array.from(curveMapRef.current.keys()) as `0x${string}`[];
          if (curveAddrs.length > 0) {
            const tip = await client.getBlockNumber();
            const fromBlock = tip > BACKFILL_BLOCKS ? tip - BACKFILL_BLOCKS : 0n;
            const [buyLogs, sellLogs] = await Promise.all([
              client.getLogs({ address: curveAddrs, event: BUY_EVENT, fromBlock, toBlock: tip }).catch(() => []),
              client.getLogs({ address: curveAddrs, event: SELL_EVENT, fromBlock, toBlock: tip }).catch(() => []),
            ]);
            if (cancelled) return;

            const all: Array<{ log: any; isBuy: boolean }> = [
              ...(buyLogs as any[]).map((l) => ({ log: l, isBuy: true })),
              ...(sellLogs as any[]).map((l) => ({ log: l, isBuy: false })),
            ];
            all.sort((a, b) => {
              const bn = Number(b.log.blockNumber - a.log.blockNumber);
              return bn !== 0 ? bn : Number((b.log.logIndex ?? 0) - (a.log.logIndex ?? 0));
            });
            const slice = all.slice(0, KEEP);

            const blocks = new Set<bigint>();
            slice.forEach(({ log }) => blocks.add(log.blockNumber));
            await Promise.all(Array.from(blocks).map((b) => getTs(b)));

            const built: GlobalTrade[] = [];
            for (const { log, isBuy } of slice) {
              const id = `${log.transactionHash}:${log.logIndex}`;
              if (seenRef.current.has(id)) continue;
              seenRef.current.add(id);
              const curveAddr = (log.address as string).toLowerCase();
              const entry = curveMapRef.current.get(curveAddr);
              if (!entry) continue;
              const ethAmount = isBuy
                ? Number(formatEther(log.args.ethIn as bigint))
                : Number(formatEther(log.args.ethToUser as bigint));
              const account = (isBuy ? log.args.buyer : log.args.seller) as `0x${string}`;
              built.push({
                id,
                type: isBuy ? 'buy' : 'sell',
                account,
                ethAmount,
                tokenAddress: entry.tokenAddress,
                symbol: entry.symbol,
                timestamp: blockTsCache.get(log.blockNumber) ?? Date.now(),
                txHash: log.transactionHash as `0x${string}`,
              });
            }
            if (built.length > 0) setTrades(built.slice(0, KEEP));
          }
        }

        // 4) Subscribe to live trades on all known curves
        subscribe(Array.from(curveMapRef.current.keys()) as `0x${string}`[]);

        // 5) Watch new TokenDeployed to track new curves
        unwatchDeployed = client.watchEvent({
          address: factory,
          event: TOKEN_DEPLOYED,
          onLogs: (logs) => {
            let added = false;
            for (const l of logs as any[]) {
              const tokenAddress = l.args.token as `0x${string}`;
              const curveAddress = l.args.curve as `0x${string}`;
              const sym = (l.args.symbol as string) || '?';
              if (!curveMapRef.current.has(curveAddress.toLowerCase())) {
                curveMapRef.current.set(curveAddress.toLowerCase(), { tokenAddress, symbol: sym });
                added = true;
              }
            }
            if (added) subscribe(Array.from(curveMapRef.current.keys()) as `0x${string}`[]);
          },
        });
      } catch {
        /* tape is non-critical */
      }
    })();

    return () => {
      cancelled = true;
      unwatchBuy?.();
      unwatchSell?.();
      unwatchDeployed?.();
    };
  }, [client, maxTokens]);

  return trades;
}
