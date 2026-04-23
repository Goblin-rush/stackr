import { useEffect, useRef, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem, type Log } from 'viem';
import {
  HOOK_V3_ADDRESS,
  FACTORY_V3_ADDRESS,
  FACTORY_V3_ABI,
  TOKEN_V3_ABI,
  isHiddenToken,
} from '@/lib/contracts';

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

// Hook events
const TAX_COLLECTED_EVENT = parseAbiItem(
  'event TaxCollected(bytes32 indexed poolId, bool isBuy, uint256 ethAmount, uint256 antiSnipeBps)'
);
const POOL_REGISTERED_EVENT = parseAbiItem(
  'event PoolRegistered(bytes32 indexed poolId, address indexed token)'
);

const KEEP = 40;
const BACKFILL_BLOCKS = 9_000n;

export function useGlobalTradeTape(maxTokens = 200) {
  const client = usePublicClient();
  const [trades, setTrades] = useState<GlobalTrade[]>([]);
  // Maps lowercase poolId → { tokenAddress, symbol }
  const poolMapRef = useRef<Map<string, { tokenAddress: `0x${string}`; symbol: string }>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!client || !FACTORY_V3_ADDRESS || !HOOK_V3_ADDRESS) return;
    let cancelled = false;
    let unwatchTax: (() => void) | undefined;
    let unwatchRegistered: (() => void) | undefined;

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

    const handleTaxCollected = async (logs: Log[]) => {
      const fresh: GlobalTrade[] = [];
      for (const l of logs as any[]) {
        const id = `${l.transactionHash}:${l.logIndex}`;
        if (seenRef.current.has(id)) continue;
        seenRef.current.add(id);
        const poolId = (l.args.poolId as string).toLowerCase();
        const entry = poolMapRef.current.get(poolId);
        if (!entry) continue;
        const isBuy = l.args.isBuy as boolean;
        const ethAmount = Number(formatEther(l.args.ethAmount as bigint));
        const ts = await getTs(l.blockNumber);
        fresh.push({
          id,
          type: isBuy ? 'buy' : 'sell',
          account: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          ethAmount,
          tokenAddress: entry.tokenAddress,
          symbol: entry.symbol,
          timestamp: ts,
          txHash: l.transactionHash as `0x${string}`,
        });
      }
      if (fresh.length > 0) pushTrades(fresh.reverse());
    };

    (async () => {
      try {
        // 1) Enumerate tokens from V3 factory
        const total = (await client.readContract({
          address: FACTORY_V3_ADDRESS,
          abi: FACTORY_V3_ABI,
          functionName: 'totalTokens',
        })) as bigint;

        const totalNum = Math.min(Number(total), maxTokens);
        let tokenAddrs: `0x${string}`[] = [];

        if (totalNum > 0) {
          const calls = Array.from({ length: totalNum }, (_, i) => ({
            address: FACTORY_V3_ADDRESS,
            abi: FACTORY_V3_ABI,
            functionName: 'allTokens' as const,
            args: [BigInt(i)],
          }));
          const res = await client.multicall({ contracts: calls, allowFailure: true });
          tokenAddrs = res
            .map((r) => (r.status === 'success' ? (r.result as `0x${string}`) : null))
            .filter((a): a is `0x${string}` => !!a && !isHiddenToken(a));
        }

        if (cancelled) return;

        // 2) Get symbol for each token + poolId via PoolRegistered events
        if (tokenAddrs.length > 0) {
          const tip = await client.getBlockNumber();
          const fromBlock = 0n; // need full history for PoolRegistered

          const [poolRegisteredLogs, symbolResults] = await Promise.all([
            client
              .getLogs({
                address: HOOK_V3_ADDRESS,
                event: POOL_REGISTERED_EVENT,
                fromBlock,
                toBlock: tip,
              })
              .catch(() => [] as any[]),
            client.multicall({
              contracts: tokenAddrs.map((t) => ({
                address: t,
                abi: TOKEN_V3_ABI,
                functionName: 'symbol' as const,
              })),
              allowFailure: true,
            }),
          ]);

          if (cancelled) return;

          // Build tokenAddress → symbol map
          const symbolMap = new Map<string, string>();
          tokenAddrs.forEach((addr, i) => {
            const sym =
              symbolResults[i]?.status === 'success'
                ? (symbolResults[i].result as string)
                : '?';
            symbolMap.set(addr.toLowerCase(), sym);
          });

          // Build poolId → token map from PoolRegistered events
          const knownTokenSet = new Set(tokenAddrs.map((a) => a.toLowerCase()));
          for (const l of poolRegisteredLogs as any[]) {
            const poolId = (l.args.poolId as string).toLowerCase();
            const token = (l.args.token as string).toLowerCase() as `0x${string}`;
            if (!knownTokenSet.has(token) || isHiddenToken(token)) continue;
            const sym = symbolMap.get(token) ?? '?';
            poolMapRef.current.set(poolId, { tokenAddress: token as `0x${string}`, symbol: sym });
          }

          if (cancelled) return;

          // 3) Backfill recent TaxCollected events
          if (poolMapRef.current.size > 0) {
            const taxLogs = await client
              .getLogs({
                address: HOOK_V3_ADDRESS,
                event: TAX_COLLECTED_EVENT,
                fromBlock: tip > BACKFILL_BLOCKS ? tip - BACKFILL_BLOCKS : 0n,
                toBlock: tip,
              })
              .catch(() => [] as any[]);

            if (cancelled) return;

            const filtered = (taxLogs as any[])
              .filter((l) => poolMapRef.current.has((l.args.poolId as string).toLowerCase()))
              .sort((a, b) => {
                const bn = Number(b.blockNumber - a.blockNumber);
                return bn !== 0 ? bn : (b.logIndex ?? 0) - (a.logIndex ?? 0);
              })
              .slice(0, KEEP);

            const blocks = new Set<bigint>(filtered.map((l: any) => l.blockNumber));
            await Promise.all(Array.from(blocks).map((b) => getTs(b)));

            const built: GlobalTrade[] = [];
            for (const l of filtered) {
              const id = `${l.transactionHash}:${l.logIndex}`;
              if (seenRef.current.has(id)) continue;
              seenRef.current.add(id);
              const poolId = (l.args.poolId as string).toLowerCase();
              const entry = poolMapRef.current.get(poolId);
              if (!entry) continue;
              built.push({
                id,
                type: (l.args.isBuy as boolean) ? 'buy' : 'sell',
                account: '0x0000000000000000000000000000000000000000' as `0x${string}`,
                ethAmount: Number(formatEther(l.args.ethAmount as bigint)),
                tokenAddress: entry.tokenAddress,
                symbol: entry.symbol,
                timestamp: blockTsCache.get(l.blockNumber) ?? Date.now(),
                txHash: l.transactionHash as `0x${string}`,
              });
            }
            if (built.length > 0) setTrades(built.slice(0, KEEP));
          }
        }

        if (cancelled) return;

        // 4) Subscribe to live TaxCollected events
        unwatchTax = client.watchEvent({
          address: HOOK_V3_ADDRESS,
          event: TAX_COLLECTED_EVENT,
          onLogs: (logs) => { if (!cancelled) void handleTaxCollected(logs); },
        });

        // 5) Watch for new PoolRegistered events (new token deployments)
        unwatchRegistered = client.watchEvent({
          address: HOOK_V3_ADDRESS,
          event: POOL_REGISTERED_EVENT,
          onLogs: async (logs) => {
            if (cancelled) return;
            for (const l of logs as any[]) {
              const poolId = (l.args.poolId as string).toLowerCase();
              const token = (l.args.token as string).toLowerCase() as `0x${string}`;
              if (poolMapRef.current.has(poolId) || isHiddenToken(token)) continue;
              try {
                const sym = (await client.readContract({
                  address: token as `0x${string}`,
                  abi: TOKEN_V3_ABI,
                  functionName: 'symbol',
                })) as string;
                poolMapRef.current.set(poolId, { tokenAddress: token as `0x${string}`, symbol: sym });
              } catch {
                poolMapRef.current.set(poolId, { tokenAddress: token as `0x${string}`, symbol: '?' });
              }
            }
          },
        });
      } catch {
        /* tape is non-critical */
      }
    })();

    return () => {
      cancelled = true;
      unwatchTax?.();
      unwatchRegistered?.();
    };
  }, [client, maxTokens]);

  return trades;
}
