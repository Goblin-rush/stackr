import { useEffect, useRef, useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem, type Log } from 'viem';
import {
  FACTORY_V3_ABI,
  TOKEN_V3_ABI,
  computePoolId,
  sqrtPriceX96ToEthPerToken,
  isHiddenToken,
} from '@/lib/contracts';
import { useV3Contracts } from '@/hooks/use-v3-contracts';

export interface FeedToken {
  address: `0x${string}`;
  curveAddress: `0x${string}` | null;
  name: string;
  symbol: string;
  realEthRaised: number;
  currentPriceEth: number;
  marketCapEth: number;
  graduated: boolean;
  createdAtMs: number | null;
  createdIndex: number;
  lastTradeMs: number | null;
  creator: `0x${string}` | null;
}

export interface LaunchpadFeedState {
  tokens: FeedToken[];
  isLoading: boolean;
  loadError: string | null;
  refresh: () => void;
}

const TOTAL_SUPPLY_NUM = 1_000_000_000;

const TOKEN_DEPLOYED_EVENT = parseAbiItem(
  'event TokenDeployed(address indexed token, address indexed creator, string name, string symbol, string metadataURI)'
);

const SWAP_EVENT = parseAbiItem(
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'
);

const POOL_REGISTERED_EVENT = parseAbiItem(
  'event PoolRegistered(bytes32 indexed poolId, address indexed token)'
);

const TAX_COLLECTED_EVENT = parseAbiItem(
  'event TaxCollected(bytes32 indexed poolId, bool isBuy, uint256 ethAmount, uint256 antiSnipeBps)'
);

const LOOKBACK_BLOCKS = 9_000n;
const MULTICALL_CHUNK = 30;

export function useLaunchpadFeed(maxTokens = 200): LaunchpadFeedState {
  const client = usePublicClient();
  const { factoryAddress, hookAddress, poolManagerAddress } = useV3Contracts();
  const [state, setState] = useState<LaunchpadFeedState>({
    tokens: [],
    isLoading: !!factoryAddress,
    loadError: null,
    refresh: () => {},
  });

  const tokensRef = useRef<Map<string, FeedToken>>(new Map());
  // Maps lowercase poolId → lowercase tokenAddress
  const poolIdToTokenRef = useRef<Map<string, string>>(new Map());
  const blockTsCacheRef = useRef<Map<bigint, number>>(new Map());
  const reloadCounterRef = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    reloadCounterRef.current += 1;
    setReloadKey(reloadCounterRef.current);
  }, []);

  const getBlockTs = useCallback(
    async (bn: bigint): Promise<number> => {
      if (!client) return Date.now();
      const cached = blockTsCacheRef.current.get(bn);
      if (cached !== undefined) return cached;
      try {
        const b = await client.getBlock({ blockNumber: bn });
        const ts = Number(b.timestamp) * 1000;
        blockTsCacheRef.current.set(bn, ts);
        return ts;
      } catch {
        return Date.now();
      }
    },
    [client]
  );

  const publishTokens = useCallback(() => {
    const list = Array.from(tokensRef.current.values());
    list.sort((a, b) => b.createdIndex - a.createdIndex);
    setState((s) => ({ ...s, tokens: list, isLoading: false }));
  }, []);

  useEffect(() => {
    setState((s) => ({ ...s, refresh }));
  }, [refresh]);

  useEffect(() => {
    if (!client || !factoryAddress) return;
    let cancelled = false;
    let unwatchSwap: (() => void) | undefined;
    let unwatchDeployed: (() => void) | undefined;
    let unwatchTax: (() => void) | undefined;

    tokensRef.current = new Map();
    poolIdToTokenRef.current = new Map();

    (async () => {
      try {
        // 1) Enumerate all tokens from V3 factory
        const total = (await client.readContract({
          address: factoryAddress,
          abi: FACTORY_V3_ABI,
          functionName: 'totalTokens',
        })) as bigint;

        const totalNum = Math.min(Number(total), maxTokens);
        let tokenAddrs: `0x${string}`[] = [];

        if (totalNum > 0) {
          const calls = Array.from({ length: totalNum }, (_, i) => ({
            address: factoryAddress,
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

        // 2) Fetch metadata + pool info for each token
        for (let i = 0; i < tokenAddrs.length; i += MULTICALL_CHUNK) {
          if (cancelled) return;
          const chunk = tokenAddrs.slice(i, i + MULTICALL_CHUNK);

          const metaCalls = chunk.flatMap((t) => [
            { address: t, abi: TOKEN_V3_ABI, functionName: 'name' as const },
            { address: t, abi: TOKEN_V3_ABI, functionName: 'symbol' as const },
            { address: factoryAddress, abi: FACTORY_V3_ABI, functionName: 'getRecord' as const, args: [t] as [`0x${string}`] },
          ]);

          const results = await client.multicall({ contracts: metaCalls, allowFailure: true });

          if (cancelled) return;

          for (let j = 0; j < chunk.length; j++) {
            const t = chunk[j];
            const off = j * 3;
            const name = results[off]?.status === 'success' ? (results[off].result as string) : 'Unknown';
            const symbol = results[off + 1]?.status === 'success' ? (results[off + 1].result as string) : '???';
            const record = results[off + 2]?.status === 'success' ? (results[off + 2].result as any) : null;

            const creator = record?.creator as `0x${string}` | null;
            const deployedAt = record?.deployedAt ? Number(record.deployedAt) * 1000 : null;

            // Compute poolId from token address (chain-aware hook)
            const poolId = computePoolId(t, hookAddress).toLowerCase();
            poolIdToTokenRef.current.set(poolId, t.toLowerCase());

            tokensRef.current.set(t.toLowerCase(), {
              address: t,
              curveAddress: null,
              name,
              symbol,
              realEthRaised: 0,
              currentPriceEth: 0,
              marketCapEth: 0,
              graduated: false,
              createdAtMs: deployedAt,
              createdIndex: i + j,
              lastTradeMs: null,
              creator: creator ?? null,
            });
          }
        }

        if (cancelled) return;

        // 3) Get current price for all tokens from PoolManager getSlot0
        const tokenList = Array.from(tokensRef.current.keys()) as string[];
        const CHUNK_PRICE = 20;
        for (let i = 0; i < tokenList.length; i += CHUNK_PRICE) {
          if (cancelled) return;
          const chunk = tokenList.slice(i, i + CHUNK_PRICE);
          const slot0Calls = chunk.map((t) => ({
            address: poolManagerAddress,
            abi: [
              {
                name: 'getSlot0',
                type: 'function' as const,
                stateMutability: 'view' as const,
                inputs: [{ name: 'id', type: 'bytes32' }],
                outputs: [
                  { name: 'sqrtPriceX96', type: 'uint160' },
                  { name: 'tick', type: 'int24' },
                  { name: 'protocolFee', type: 'uint24' },
                  { name: 'lpFee', type: 'uint24' },
                ],
              },
            ] as const,
            functionName: 'getSlot0' as const,
            args: [computePoolId(t as `0x${string}`, hookAddress)] as [`0x${string}`],
          }));

          const slot0Results = await client.multicall({ contracts: slot0Calls, allowFailure: true }).catch(() => []);

          for (let j = 0; j < chunk.length; j++) {
            const t = chunk[j];
            const token = tokensRef.current.get(t);
            if (!token) continue;
            const r = slot0Results[j];
            if (r?.status === 'success') {
              const sqrtPriceX96 = (r.result as any)[0] as bigint;
              const priceEth = sqrtPriceX96ToEthPerToken(sqrtPriceX96);
              token.currentPriceEth = priceEth;
              token.marketCapEth = priceEth * TOTAL_SUPPLY_NUM;
              tokensRef.current.set(t, token);
            }
          }
        }

        if (cancelled) return;

        // 4) Backfill recent swap events for lastTradeMs
        const tip = await client.getBlockNumber();
        const fromBlock = tip > LOOKBACK_BLOCKS ? tip - LOOKBACK_BLOCKS : 0n;

        const taxLogs = await client
          .getLogs({
            address: hookAddress,
            event: TAX_COLLECTED_EVENT,
            fromBlock,
            toBlock: tip,
          })
          .catch(() => [] as any[]);

        if (cancelled) return;

        const uniqueBlocks = new Set<bigint>((taxLogs as any[]).map((l: any) => l.blockNumber));
        await Promise.all(Array.from(uniqueBlocks).map((b) => getBlockTs(b)));

        for (const l of taxLogs as any[]) {
          const poolId = (l.args.poolId as string).toLowerCase();
          const tokenAddr = poolIdToTokenRef.current.get(poolId);
          if (!tokenAddr) continue;
          const token = tokensRef.current.get(tokenAddr);
          if (!token) continue;
          const ts = blockTsCacheRef.current.get(l.blockNumber) ?? Date.now();
          if (token.lastTradeMs === null || ts > token.lastTradeMs) {
            token.lastTradeMs = ts;
            tokensRef.current.set(tokenAddr, token);
          }
        }

        if (cancelled) return;
        publishTokens();

        // 5) Subscribe to live PoolManager Swap events for price updates
        // Watch all swaps and filter by known poolIds in the handler
        unwatchSwap = client.watchEvent({
          address: poolManagerAddress,
          event: SWAP_EVENT,
          onLogs: (logs: Log[]) => {
            if (cancelled) return;
            let changed = false;
            for (const l of logs as any[]) {
              const poolId = (l.args.id as string).toLowerCase();
              const tokenAddr = poolIdToTokenRef.current.get(poolId);
              if (!tokenAddr) continue;
              const token = tokensRef.current.get(tokenAddr);
              if (!token) continue;
              const sqrtPriceX96 = l.args.sqrtPriceX96 as bigint;
              const priceEth = sqrtPriceX96ToEthPerToken(sqrtPriceX96);
              token.currentPriceEth = priceEth;
              token.marketCapEth = priceEth * TOTAL_SUPPLY_NUM;
              token.lastTradeMs = Date.now();
              tokensRef.current.set(tokenAddr, token);
              changed = true;
            }
            if (changed) publishTokens();
          },
        });

        // 6) Watch for new token deployments
        unwatchDeployed = client.watchEvent({
          address: factoryAddress,
          event: TOKEN_DEPLOYED_EVENT,
          onLogs: async (logs: Log[]) => {
            if (cancelled) return;
            let added = false;
            for (const l of logs as any[]) {
              const tokenAddr = (l.args.token as string).toLowerCase() as `0x${string}`;
              if (tokensRef.current.has(tokenAddr) || isHiddenToken(tokenAddr)) continue;
              const ts = await getBlockTs(l.blockNumber);
              const poolId = computePoolId(tokenAddr as `0x${string}`, hookAddress).toLowerCase();
              poolIdToTokenRef.current.set(poolId, tokenAddr);
              const newIndex = tokensRef.current.size;
              tokensRef.current.set(tokenAddr, {
                address: tokenAddr as `0x${string}`,
                curveAddress: null,
                name: l.args.name as string,
                symbol: l.args.symbol as string,
                realEthRaised: 0,
                currentPriceEth: 0,
                marketCapEth: 0,
                graduated: false,
                createdAtMs: ts,
                createdIndex: newIndex,
                lastTradeMs: null,
                creator: (l.args.creator as `0x${string}`) ?? null,
              });
              added = true;
            }
            if (added) publishTokens();
          },
        });
      } catch (err: any) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          isLoading: false,
          loadError: err?.shortMessage || err?.message || 'Failed to load tokens',
        }));
      }
    })();

    return () => {
      cancelled = true;
      unwatchSwap?.();
      unwatchDeployed?.();
      unwatchTax?.();
    };
  }, [client, factoryAddress, hookAddress, poolManagerAddress, maxTokens, reloadKey, getBlockTs, publishTokens]);

  return state;
}
