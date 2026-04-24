import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem, type Log } from 'viem';
import {
  computePoolId,
  sqrtPriceX96ToEthPerToken,
  createChainClient,
  getV3Contracts,
} from '@/lib/contracts';
import { useV3Contracts } from '@/hooks/use-v3-contracts';
import type { LiveTrade, LiveHolder } from '@/types/live';

// V4 PoolManager Swap event
const SWAP_EVENT = parseAbiItem(
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'
);

// ERC-20 Transfer event (emitted by the token contract)
const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

// Hook TaxCollected event for detecting trades
const TAX_COLLECTED_EVENT = parseAbiItem(
  'event TaxCollected(bytes32 indexed poolId, bool isBuy, uint256 ethAmount, uint256 antiSnipeBps)'
);

export interface ChainLiveState {
  trades: LiveTrade[];
  holders: LiveHolder[];
  lastTrade: LiveTrade | null;
  currentPrice: number;
  volume24hEth: number;
  priceChange24hPct: number;
  isInitialLoading: boolean;
  loadError: string | null;
  snapshotKey: number;
}

const LOOKBACK_BLOCKS = 9_000n;
const HOLDER_TOP = 50;
const TRADE_KEEP = 5000;
const ZERO = '0x0000000000000000000000000000000000000000';
const TOTAL_SUPPLY = 1_000_000_000;

function compute24h(trades: LiveTrade[]) {
  if (trades.length === 0) return { volume24hEth: 0, priceChange24hPct: 0 };
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = trades.filter((t) => t.timestamp >= cutoff);
  const volume24hEth = recent.reduce((s, t) => s + t.ethAmount, 0);
  const newest = trades[0];
  const oldest24h = recent[recent.length - 1];
  const priceChange24hPct =
    oldest24h && newest && oldest24h.price > 0
      ? ((newest.price - oldest24h.price) / oldest24h.price) * 100
      : 0;
  return { volume24hEth, priceChange24hPct };
}

export function useChainTokenLive(
  tokenAddress: `0x${string}` | undefined,
  _curveAddress?: `0x${string}` | undefined,
  chainId?: number
): ChainLiveState {
  const walletClient = usePublicClient();
  const walletContracts = useV3Contracts();

  const fixedClient    = useMemo(() => chainId !== undefined ? createChainClient(chainId) : null, [chainId]);
  const fixedContracts = useMemo(() => chainId !== undefined ? getV3Contracts(chainId)    : null, [chainId]);

  const client = fixedClient ?? walletClient;
  const { hookAddress, poolManagerAddress } = fixedContracts ?? walletContracts;
  const [state, setState] = useState<ChainLiveState>({
    trades: [],
    holders: [],
    lastTrade: null,
    currentPrice: 0,
    volume24hEth: 0,
    priceChange24hPct: 0,
    isInitialLoading: true,
    loadError: null,
    snapshotKey: 0,
  });

  const balancesRef = useRef<Map<string, bigint>>(new Map());
  const tradeIdRef = useRef(1);
  const blockTimeCacheRef = useRef<Map<bigint, number>>(new Map());
  const seenSwapRef = useRef<Set<string>>(new Set());
  const seenTransferRef = useRef<Set<string>>(new Set());

  const recomputeHolders = useCallback((): LiveHolder[] => {
    const totalScaled = BigInt(TOTAL_SUPPLY) * 10n ** 18n;
    const list: LiveHolder[] = [];
    const lowerPool = poolManagerAddress.toLowerCase();
    for (const [addr, bal] of balancesRef.current.entries()) {
      if (bal <= 0n) continue;
      const isPool = addr.toLowerCase() === lowerPool;
      const amount = Number(formatEther(bal));
      const percent = totalScaled === 0n ? 0 : Number((bal * 10000n) / totalScaled) / 100;
      list.push({
        address: addr,
        amount,
        percent,
        label: isPool ? 'V4 Pool (LP)' : undefined,
      });
    }
    list.sort((a, b) => b.percent - a.percent);
    return list.slice(0, HOLDER_TOP);
  }, [poolManagerAddress]);

  const getBlockTimestamp = useCallback(
    async (blockNumber: bigint): Promise<number> => {
      if (!client) return Date.now();
      const cached = blockTimeCacheRef.current.get(blockNumber);
      if (cached !== undefined) return cached;
      try {
        const block = await client.getBlock({ blockNumber });
        const ts = Number(block.timestamp) * 1000;
        blockTimeCacheRef.current.set(blockNumber, ts);
        return ts;
      } catch {
        return Date.now();
      }
    },
    [client]
  );

  useEffect(() => {
    if (!client || !tokenAddress) return;
    let cancelled = false;
    let unwatchSwap: (() => void) | undefined;
    let unwatchTransfer: (() => void) | undefined;

    balancesRef.current = new Map();
    tradeIdRef.current = 1;
    seenSwapRef.current = new Set();
    seenTransferRef.current = new Set();

    const poolId = computePoolId(tokenAddress, hookAddress);

    const earlySwapBuffer: any[] = [];
    const earlyTransferBuffer: any[] = [];
    let backfillDone = false;

    const handleSwapLog = async (l: any) => {
      const key = `${l.transactionHash}:${l.logIndex}`;
      if (seenSwapRef.current.has(key)) return;
      seenSwapRef.current.add(key);
      const ts = await getBlockTimestamp(l.blockNumber);

      const amount0 = l.args.amount0 as bigint;
      const amount1 = l.args.amount1 as bigint;
      const sqrtPriceX96 = l.args.sqrtPriceX96 as bigint;

      // amount0 < 0 → hook paid ETH into pool → user bought token → BUY
      // amount0 > 0 → hook received ETH from pool → user sold token → SELL
      const isBuy = amount0 < 0n;
      const ethAmount = isBuy ? -amount0 : amount0; // always positive
      const tokenAmount = isBuy ? amount1 : -amount1; // always positive

      const ethAmountNum = Number(formatEther(ethAmount));
      const tokenAmountNum = tokenAmount > 0n ? Number(formatEther(tokenAmount)) : 0;
      const price = sqrtPriceX96ToEthPerToken(sqrtPriceX96);

      const trade: LiveTrade = {
        id: tradeIdRef.current++,
        type: isBuy ? 'buy' : 'sell',
        account: l.args.sender as `0x${string}`,
        ethAmount: ethAmountNum,
        tokenAmount: tokenAmountNum,
        price,
        timestamp: ts,
        txHash: l.transactionHash,
      };

      setState((s) => {
        const newTrades = [trade, ...s.trades].slice(0, TRADE_KEEP);
        const stats = compute24h(newTrades);
        return {
          ...s,
          trades: newTrades,
          lastTrade: trade,
          currentPrice: price,
          volume24hEth: stats.volume24hEth,
          priceChange24hPct: stats.priceChange24hPct,
        };
      });
    };

    const handleTransferLog = (l: any) => {
      const key = `${l.transactionHash}:${l.logIndex}`;
      if (seenTransferRef.current.has(key)) return;
      seenTransferRef.current.add(key);
      const from = (l.args.from as string).toLowerCase();
      const to = (l.args.to as string).toLowerCase();
      const v = l.args.value as bigint;
      if (from !== ZERO) {
        const cur = balancesRef.current.get(from) ?? 0n;
        balancesRef.current.set(from, cur - v);
      }
      if (to !== ZERO) {
        const cur = balancesRef.current.get(to) ?? 0n;
        balancesRef.current.set(to, cur + v);
      }
    };

    (async () => {
      try {
        setState((s) => ({ ...s, isInitialLoading: true, loadError: null }));

        // Start watchers before backfill to avoid missing live events
        unwatchSwap = client.watchEvent({
          address: poolManagerAddress,
          event: SWAP_EVENT,
          args: { id: poolId },
          onLogs: (logs: Log[]) => {
            if (cancelled) return;
            if (!backfillDone) {
              for (const l of logs as any[]) earlySwapBuffer.push(l);
              return;
            }
            for (const l of logs as any[]) handleSwapLog(l);
          },
        });

        unwatchTransfer = client.watchEvent({
          address: tokenAddress,
          event: TRANSFER_EVENT,
          onLogs: (logs: Log[]) => {
            if (cancelled) return;
            if (!backfillDone) {
              for (const l of logs as any[]) earlyTransferBuffer.push(l);
              return;
            }
            for (const l of logs as any[]) handleTransferLog(l);
            setState((s) => ({ ...s, holders: recomputeHolders() }));
          },
        });

        // Backfill
        const tip = await client.getBlockNumber();
        const fromBlock = tip > LOOKBACK_BLOCKS ? tip - LOOKBACK_BLOCKS : 0n;

        const [swapLogs, transferLogs] = await Promise.all([
          client
            .getLogs({
              address: poolManagerAddress,
              event: SWAP_EVENT,
              args: { id: poolId },
              fromBlock,
              toBlock: tip,
            })
            .catch(() => [] as any[]),
          client
            .getLogs({
              address: tokenAddress,
              event: TRANSFER_EVENT,
              fromBlock,
              toBlock: tip,
            })
            .catch(() => [] as any[]),
        ]);

        if (cancelled) return;

        // Prefetch block timestamps for swap logs
        const uniqueBlocks = Array.from(new Set((swapLogs as any[]).map((l: any) => l.blockNumber)));
        await Promise.all(uniqueBlocks.map((bn) => getBlockTimestamp(bn)));

        // Sort swap logs oldest-first, process, then reverse for display
        const sortedSwaps = [...(swapLogs as any[])].sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) return Number(a.blockNumber - b.blockNumber);
          return a.logIndex - b.logIndex;
        });

        const trades: LiveTrade[] = [];
        for (const l of sortedSwaps) {
          const key = `${l.transactionHash}:${l.logIndex}`;
          if (seenSwapRef.current.has(key)) continue;
          seenSwapRef.current.add(key);
          const ts = blockTimeCacheRef.current.get(l.blockNumber) ?? Date.now();
          const amount0 = l.args.amount0 as bigint;
          const amount1 = l.args.amount1 as bigint;
          const sqrtPriceX96 = l.args.sqrtPriceX96 as bigint;
          const isBuy = amount0 < 0n;
          const ethAmount = isBuy ? -amount0 : amount0;
          const tokenAmount = isBuy ? amount1 : -amount1;
          trades.push({
            id: tradeIdRef.current++,
            type: isBuy ? 'buy' : 'sell',
            account: l.args.sender as `0x${string}`,
            ethAmount: Number(formatEther(ethAmount)),
            tokenAmount: tokenAmount > 0n ? Number(formatEther(tokenAmount)) : 0,
            price: sqrtPriceX96ToEthPerToken(sqrtPriceX96),
            timestamp: ts,
            txHash: l.transactionHash,
          });
        }
        trades.reverse(); // newest first

        for (const l of transferLogs as any[]) {
          const key = `${l.transactionHash}:${l.logIndex}`;
          if (seenTransferRef.current.has(key)) continue;
          seenTransferRef.current.add(key);
          const from = (l.args.from as string).toLowerCase();
          const to = (l.args.to as string).toLowerCase();
          const v = l.args.value as bigint;
          if (from !== ZERO) {
            const cur = balancesRef.current.get(from) ?? 0n;
            balancesRef.current.set(from, cur - v);
          }
          if (to !== ZERO) {
            const cur = balancesRef.current.get(to) ?? 0n;
            balancesRef.current.set(to, cur + v);
          }
        }

        const stats = compute24h(trades);
        const newest = trades[0];

        setState((s) => ({
          ...s,
          trades,
          holders: recomputeHolders(),
          lastTrade: newest ?? null,
          currentPrice: newest?.price ?? 0,
          volume24hEth: stats.volume24hEth,
          priceChange24hPct: stats.priceChange24hPct,
          isInitialLoading: false,
          loadError: null,
          snapshotKey: s.snapshotKey + 1,
        }));

        backfillDone = true;
        for (const l of earlySwapBuffer) await handleSwapLog(l);
        let transferDrained = false;
        for (const l of earlyTransferBuffer) { handleTransferLog(l); transferDrained = true; }
        if (transferDrained) setState((s) => ({ ...s, holders: recomputeHolders() }));
      } catch (err: any) {
        if (cancelled) return;
        backfillDone = true;
        setState((s) => ({
          ...s,
          isInitialLoading: false,
          loadError: err?.shortMessage || err?.message || 'Failed to load on-chain data',
        }));
      }
    })();

    return () => {
      cancelled = true;
      unwatchSwap?.();
      unwatchTransfer?.();
    };
  }, [tokenAddress, client, hookAddress, poolManagerAddress, getBlockTimestamp, recomputeHolders]);

  return state;
}

// Re-export for backward compatibility with TVAdvancedChart and similar
export const TOTAL_SUPPLY_EXPORT = TOTAL_SUPPLY;
