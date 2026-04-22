import { useEffect, useRef, useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem, type Log } from 'viem';
import { CURVE_V2_ABI, TARGET_ETH as TARGET_ETH_BI, V2_VIRTUAL_ETH as V2_VIRTUAL_ETH_BI } from '@/lib/contracts';
import type { LiveTrade, LiveHolder } from '@/types/live';

const TARGET_ETH = Number(formatEther(TARGET_ETH_BI));   // 3.5 ETH
const TOTAL_SUPPLY = 1_000_000_000;
const VIRTUAL_ETH = Number(formatEther(V2_VIRTUAL_ETH_BI)); // 3.0 ETH

// V2 event signatures — emitted by the CURVE contract
const buyEvent = parseAbiItem(
  'event Buy(address indexed buyer, uint256 ethIn, uint256 ethForCurve, uint256 tokensOut, uint256 progressBps)'
);
const sellEvent = parseAbiItem(
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ethOutGross, uint256 ethToUser, uint256 progressBps)'
);
// Transfer is emitted by the TOKEN contract
const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);
// V2 Graduated has different args — emitted by CURVE
const graduatedEvent = parseAbiItem(
  'event Graduated(uint256 ethToLp, uint256 tokensToLp, address indexed pair)'
);

export interface ChainLiveState {
  trades: LiveTrade[];
  holders: LiveHolder[];
  lastTrade: LiveTrade | null;
  realEthRaised: number;
  currentPrice: number;
  creator: `0x${string}` | null;
  graduated: boolean;
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

function priceFromTrade(ethAmount: bigint, tokenAmount: bigint): number {
  if (tokenAmount === 0n) return 0;
  const num = Number(formatEther(ethAmount));
  const den = Number(formatEther(tokenAmount));
  return den === 0 ? 0 : num / den;
}

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

/**
 * tokenAddress = ERC20 token contract (for Transfer events and holder tracking)
 * curveAddress = bonding curve contract (for Buy/Sell/Graduated events and state reads)
 */
export function useChainTokenLive(
  tokenAddress: `0x${string}` | undefined,
  curveAddress: `0x${string}` | undefined
): ChainLiveState {
  const client = usePublicClient();
  const [state, setState] = useState<ChainLiveState>({
    trades: [],
    holders: [],
    lastTrade: null,
    realEthRaised: 0,
    currentPrice: 0,
    creator: null,
    graduated: false,
    volume24hEth: 0,
    priceChange24hPct: 0,
    isInitialLoading: true,
    loadError: null,
    snapshotKey: 0,
  });

  const balancesRef = useRef<Map<string, bigint>>(new Map());
  const tradeIdRef = useRef(1);
  const blockTimeCacheRef = useRef<Map<bigint, number>>(new Map());
  const seenTradeRef = useRef<Set<string>>(new Set());
  const seenTransferRef = useRef<Set<string>>(new Set());

  const recomputeHolders = useCallback((): LiveHolder[] => {
    const totalScaled = BigInt(TOTAL_SUPPLY) * 10n ** 18n;
    const list: LiveHolder[] = [];
    const lowerCurve = curveAddress?.toLowerCase();
    for (const [addr, bal] of balancesRef.current.entries()) {
      if (bal <= 0n) continue;
      const isCurve = lowerCurve && addr.toLowerCase() === lowerCurve;
      const amount = Number(formatEther(bal));
      const percent = totalScaled === 0n ? 0 : Number((bal * 10000n) / totalScaled) / 100;
      list.push({
        address: addr,
        amount,
        percent,
        label: isCurve ? 'Bonding Curve' : undefined,
      });
    }
    list.sort((a, b) => b.percent - a.percent);
    return list.slice(0, HOLDER_TOP);
  }, [curveAddress]);

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
    if (!client || !tokenAddress || !curveAddress) return;
    let cancelled = false;
    let unwatchBuy: (() => void) | undefined;
    let unwatchSell: (() => void) | undefined;
    let unwatchTransfer: (() => void) | undefined;
    let unwatchGraduated: (() => void) | undefined;

    balancesRef.current = new Map();
    tradeIdRef.current = 1;
    seenTradeRef.current = new Set();
    seenTransferRef.current = new Set();

    const earlyTradeBuffer: Array<{
      type: 'buy' | 'sell';
      account: string;
      ethAmount: bigint;
      tokenAmount: bigint;
      blockNumber: bigint;
      logIndex: number;
      txHash: string;
    }> = [];
    const earlyTransferBuffer: Array<{
      from: string;
      to: string;
      value: bigint;
      blockNumber: bigint;
      logIndex: number;
      txHash: string;
    }> = [];
    let earlyGraduated = false;
    let backfillDone = false;

    const handleTrade = async (type: 'buy' | 'sell', l: any) => {
      const key = `${l.transactionHash}:${l.logIndex}`;
      if (seenTradeRef.current.has(key)) return;
      seenTradeRef.current.add(key);
      const ts = await getBlockTimestamp(l.blockNumber);
      // V2: Buy uses ethForCurve (post-tax curve ETH) for price; Sell uses ethOutGross
      const ethAmt = type === 'buy' ? l.args.ethIn : l.args.ethToUser;
      const ethForPrice = type === 'buy' ? l.args.ethForCurve : l.args.ethOutGross;
      const tokAmt = type === 'buy' ? l.args.tokensOut : l.args.tokensIn;
      const trade: LiveTrade = {
        id: tradeIdRef.current++,
        type,
        account: type === 'buy' ? l.args.buyer : l.args.seller,
        ethAmount: Number(formatEther(ethAmt)),
        tokenAmount: Number(formatEther(tokAmt)),
        price: priceFromTrade(ethForPrice, tokAmt),
        timestamp: ts,
        txHash: l.transactionHash,
      };
      setState((s) => {
        const newTrades = [trade, ...s.trades].slice(0, TRADE_KEEP);
        const stats = compute24h(newTrades);
        const ethForCurve = type === 'buy' ? (l.args.ethForCurve as bigint) : (l.args.ethOutGross as bigint);
        const ethDelta = type === 'buy' ? Number(formatEther(ethForCurve)) : -Number(formatEther(ethForCurve));
        return {
          ...s,
          trades: newTrades,
          lastTrade: trade,
          currentPrice: trade.price,
          realEthRaised: Math.max(0, s.realEthRaised + ethDelta),
          volume24hEth: stats.volume24hEth,
          priceChange24hPct: stats.priceChange24hPct,
        };
      });
    };

    const handleTransfer = (l: any) => {
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

        // Start watchers FIRST to avoid missing events during backfill
        unwatchBuy = client.watchEvent({
          address: curveAddress,
          event: buyEvent,
          onLogs: (logs: Log[]) => {
            if (cancelled) return;
            if (!backfillDone) {
              for (const l of logs as any[]) {
                earlyTradeBuffer.push({
                  type: 'buy',
                  account: l.args.buyer,
                  ethAmount: l.args.ethIn,
                  tokenAmount: l.args.tokensOut,
                  blockNumber: l.blockNumber,
                  logIndex: l.logIndex,
                  txHash: l.transactionHash,
                });
              }
              return;
            }
            for (const l of logs as any[]) handleTrade('buy', l);
          },
        });

        unwatchSell = client.watchEvent({
          address: curveAddress,
          event: sellEvent,
          onLogs: (logs: Log[]) => {
            if (cancelled) return;
            if (!backfillDone) {
              for (const l of logs as any[]) {
                earlyTradeBuffer.push({
                  type: 'sell',
                  account: l.args.seller,
                  ethAmount: l.args.ethToUser,
                  tokenAmount: l.args.tokensIn,
                  blockNumber: l.blockNumber,
                  logIndex: l.logIndex,
                  txHash: l.transactionHash,
                });
              }
              return;
            }
            for (const l of logs as any[]) handleTrade('sell', l);
          },
        });

        unwatchTransfer = client.watchEvent({
          address: tokenAddress,
          event: transferEvent,
          onLogs: (logs: Log[]) => {
            if (cancelled) return;
            if (!backfillDone) {
              for (const l of logs as any[]) {
                earlyTransferBuffer.push({
                  from: (l.args.from as string).toLowerCase(),
                  to: (l.args.to as string).toLowerCase(),
                  value: l.args.value as bigint,
                  blockNumber: l.blockNumber,
                  logIndex: l.logIndex,
                  txHash: l.transactionHash,
                });
              }
              return;
            }
            for (const l of logs as any[]) handleTransfer(l);
            setState((s) => ({ ...s, holders: recomputeHolders() }));
          },
        });

        unwatchGraduated = client.watchEvent({
          address: curveAddress,
          event: graduatedEvent,
          onLogs: () => {
            if (cancelled) return;
            if (!backfillDone) { earlyGraduated = true; return; }
            setState((s) => ({ ...s, graduated: true }));
          },
        });

        // Backfill
        const tip = await client.getBlockNumber();
        const fromBlock = tip > LOOKBACK_BLOCKS ? tip - LOOKBACK_BLOCKS : 0n;

        const [buyLogs, sellLogs, transferLogs, gradLogs, contractState] = await Promise.all([
          client.getLogs({ address: curveAddress, event: buyEvent, fromBlock, toBlock: tip }),
          client.getLogs({ address: curveAddress, event: sellEvent, fromBlock, toBlock: tip }),
          client.getLogs({ address: tokenAddress, event: transferEvent, fromBlock, toBlock: tip }),
          client.getLogs({ address: curveAddress, event: graduatedEvent, fromBlock, toBlock: tip }),
          client.multicall({
            contracts: [
              { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'realEthRaised' },
              { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'currentPrice' },
              { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'graduated' },
            ],
            allowFailure: true,
          }),
        ]);

        if (cancelled) return;

        type RawTrade = {
          type: 'buy' | 'sell';
          account: string;
          ethAmount: bigint;
          ethForPrice: bigint;
          tokenAmount: bigint;
          blockNumber: bigint;
          logIndex: number;
          txHash: string;
        };
        const raw: RawTrade[] = [];
        for (const l of buyLogs as any[]) {
          raw.push({
            type: 'buy',
            account: l.args.buyer,
            ethAmount: l.args.ethIn,
            ethForPrice: l.args.ethForCurve,
            tokenAmount: l.args.tokensOut,
            blockNumber: l.blockNumber,
            logIndex: l.logIndex,
            txHash: l.transactionHash,
          });
        }
        for (const l of sellLogs as any[]) {
          raw.push({
            type: 'sell',
            account: l.args.seller,
            ethAmount: l.args.ethToUser,
            ethForPrice: l.args.ethOutGross,
            tokenAmount: l.args.tokensIn,
            blockNumber: l.blockNumber,
            logIndex: l.logIndex,
            txHash: l.transactionHash,
          });
        }
        raw.sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) return Number(a.blockNumber - b.blockNumber);
          return a.logIndex - b.logIndex;
        });

        const uniqueBlocks = Array.from(new Set(raw.map((r) => r.blockNumber)));
        await Promise.all(uniqueBlocks.map((b) => getBlockTimestamp(b)));

        const trades: LiveTrade[] = [];
        for (const r of raw) {
          const key = `${r.txHash}:${r.logIndex}`;
          if (seenTradeRef.current.has(key)) continue;
          seenTradeRef.current.add(key);
          const ts = blockTimeCacheRef.current.get(r.blockNumber) ?? Date.now();
          trades.push({
            id: tradeIdRef.current++,
            type: r.type,
            account: r.account,
            ethAmount: Number(formatEther(r.ethAmount)),
            tokenAmount: Number(formatEther(r.tokenAmount)),
            price: priceFromTrade(r.ethForPrice, r.tokenAmount),
            timestamp: ts,
            txHash: r.txHash,
          });
        }
        trades.reverse();

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

        const realEthRaised =
          contractState[0]?.status === 'success'
            ? Number(formatEther(contractState[0].result as bigint))
            : 0;
        const currentPrice =
          contractState[1]?.status === 'success'
            ? Number(formatEther(contractState[1].result as bigint))
            : newest?.price ?? 0;
        const graduated =
          contractState[2]?.status === 'success'
            ? !!contractState[2].result
            : gradLogs.length > 0 || earlyGraduated;

        setState((s) => ({
          ...s,
          trades,
          holders: recomputeHolders(),
          lastTrade: newest ?? null,
          realEthRaised,
          currentPrice,
          creator: null,
          graduated,
          volume24hEth: stats.volume24hEth,
          priceChange24hPct: stats.priceChange24hPct,
          isInitialLoading: false,
          loadError: null,
          snapshotKey: s.snapshotKey + 1,
        }));

        backfillDone = true;
        for (const e of earlyTradeBuffer) {
          await handleTrade(e.type, {
            args:
              e.type === 'buy'
                ? { buyer: e.account, ethIn: e.ethAmount, ethForCurve: e.ethAmount, tokensOut: e.tokenAmount }
                : { seller: e.account, tokensIn: e.tokenAmount, ethOutGross: e.ethAmount, ethToUser: e.ethAmount },
            blockNumber: e.blockNumber,
            logIndex: e.logIndex,
            transactionHash: e.txHash,
          });
        }
        let transferDrained = false;
        for (const e of earlyTransferBuffer) {
          handleTransfer({
            args: { from: e.from, to: e.to, value: e.value },
            blockNumber: e.blockNumber,
            logIndex: e.logIndex,
            transactionHash: e.txHash,
          });
          transferDrained = true;
        }
        if (transferDrained) setState((s) => ({ ...s, holders: recomputeHolders() }));
        if (earlyGraduated) setState((s) => ({ ...s, graduated: true }));
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
      unwatchBuy?.();
      unwatchSell?.();
      unwatchTransfer?.();
      unwatchGraduated?.();
    };
  }, [tokenAddress, curveAddress, client, getBlockTimestamp, recomputeHolders]);

  return state;
}

export { TARGET_ETH, TOTAL_SUPPLY, VIRTUAL_ETH };
