import { useEffect, useRef, useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem, type Log } from 'viem';
import { FACTORY_ABI, FACTORY_ADDRESS, BONDING_CURVE_ABI, TOTAL_SUPPLY } from '@/lib/contracts';

export interface FeedToken {
  address: `0x${string}`;
  name: string;
  symbol: string;
  realEthRaised: number;
  currentPriceEth: number;
  marketCapEth: number;
  graduated: boolean;
  createdAtMs: number | null; // from TokenCreated event
  createdIndex: number; // factory array index (0 = oldest)
  lastTradeMs: number | null;
  creator: `0x${string}` | null;
}

export interface LaunchpadFeedState {
  tokens: FeedToken[];
  isLoading: boolean;
  loadError: string | null;
  refresh: () => void;
}

const TOKEN_CREATED = parseAbiItem(
  'event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint256 index)'
);
const BUY_EVENT = parseAbiItem(
  'event Buy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 progress)'
);
const SELL_EVENT = parseAbiItem(
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 progress)'
);
const GRADUATED_EVENT = parseAbiItem('event Graduated(uint256 ethRaised)');

const LOOKBACK_BLOCKS = 9_000n; // publicnode free RPC limit is ~10k blocks per getLogs
const MULTICALL_CHUNK = 30; // tokens per multicall batch (5 reads each = 150 calls)
const TOTAL_SUPPLY_NUM = Number(formatEther(TOTAL_SUPPLY));

export function useLaunchpadFeed(maxTokens = 200): LaunchpadFeedState {
  const client = usePublicClient();
  const [state, setState] = useState<LaunchpadFeedState>({
    tokens: [],
    isLoading: true,
    loadError: null,
    refresh: () => {},
  });
  const tokensRef = useRef<Map<string, FeedToken>>(new Map());
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
    setState((s) => ({ ...s, tokens: Array.from(tokensRef.current.values()) }));
  }, []);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    let unwatchCreated: (() => void) | undefined;
    let unwatchBuy: (() => void) | undefined;
    let unwatchSell: (() => void) | undefined;
    let unwatchGraduated: (() => void) | undefined;
    let pollTimer: number | undefined;

    tokensRef.current = new Map();

    (async () => {
      try {
        setState((s) => ({ ...s, isLoading: true, loadError: null, refresh }));

        // 1) Fetch token addresses via totalTokens + allTokens(i) multicall
        //    (factory's getTokens(offset,limit) returns empty due to a bug — workaround)
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
            .filter((a): a is `0x${string}` => !!a);
        }

        if (cancelled) return;
        if (addrs.length === 0) {
          setState({ tokens: [], isLoading: false, loadError: null, refresh });
          return;
        }

        const tip = await client.getBlockNumber();
        const fromBlock = tip > LOOKBACK_BLOCKS ? tip - LOOKBACK_BLOCKS : 0n;

        // 2) In parallel: TokenCreated logs, Buy logs (all addrs), Sell logs (all addrs), per-token reads
        //    Each wrapped to prevent one failing call from killing the whole load.
        const safeLogs = async <T,>(p: Promise<T[]>): Promise<T[]> => {
          try { return await p; } catch { return []; }
        };
        const [createdLogs, buyLogs, sellLogs, gradLogs] = await Promise.all([
          safeLogs(client.getLogs({ address: FACTORY_ADDRESS, event: TOKEN_CREATED, fromBlock, toBlock: tip })),
          safeLogs(client.getLogs({ address: addrs, event: BUY_EVENT, fromBlock, toBlock: tip })),
          safeLogs(client.getLogs({ address: addrs, event: SELL_EVENT, fromBlock, toBlock: tip })),
          safeLogs(client.getLogs({ address: addrs, event: GRADUATED_EVENT, fromBlock, toBlock: tip })),
        ]);

        // Per-token chunked multicall for: name, symbol, realEthRaised, graduated, currentPrice
        const reads: FeedToken[] = [];
        for (let i = 0; i < addrs.length; i += MULTICALL_CHUNK) {
          const chunk = addrs.slice(i, i + MULTICALL_CHUNK);
          const contracts = chunk.flatMap((address) => [
            { address, abi: BONDING_CURVE_ABI, functionName: 'name' as const },
            { address, abi: BONDING_CURVE_ABI, functionName: 'symbol' as const },
            { address, abi: BONDING_CURVE_ABI, functionName: 'realEthRaised' as const },
            { address, abi: BONDING_CURVE_ABI, functionName: 'graduated' as const },
            { address, abi: BONDING_CURVE_ABI, functionName: 'currentPrice' as const },
          ]);
          const res = await client.multicall({ contracts, allowFailure: true });
          if (cancelled) return;
          for (let j = 0; j < chunk.length; j++) {
            const base = j * 5;
            const address = chunk[j];
            const name = res[base]?.status === 'success' ? (res[base].result as string) : '';
            const symbol = res[base + 1]?.status === 'success' ? (res[base + 1].result as string) : '';
            const realEthRaisedBI =
              res[base + 2]?.status === 'success' ? (res[base + 2].result as bigint) : 0n;
            const graduated =
              res[base + 3]?.status === 'success' ? !!res[base + 3].result : false;
            const priceBI =
              res[base + 4]?.status === 'success' ? (res[base + 4].result as bigint) : 0n;
            const currentPriceEth = Number(formatEther(priceBI));
            reads.push({
              address,
              name,
              symbol,
              realEthRaised: Number(formatEther(realEthRaisedBI)),
              currentPriceEth,
              marketCapEth: currentPriceEth * TOTAL_SUPPLY_NUM,
              graduated,
              createdAtMs: null,
              createdIndex: 0,
              lastTradeMs: null,
              creator: null,
            });
          }
        }

        // 3) Map TokenCreated → createdAtMs + createdIndex + creator per address
        const createdByAddr = new Map<
          string,
          { blockNumber: bigint; index: number; creator: `0x${string}` }
        >();
        for (const l of createdLogs as any[]) {
          const tokAddr = (l.args.token as string).toLowerCase();
          const idx = Number(l.args.index ?? 0n);
          const creator = (l.args.creator as `0x${string}`) ?? null;
          createdByAddr.set(tokAddr, { blockNumber: l.blockNumber, index: idx, creator });
        }

        // 4) Reduce Buy/Sell to lastTrade block per address
        const lastTradeBlock = new Map<string, bigint>();
        for (const l of [...(buyLogs as any[]), ...(sellLogs as any[])]) {
          const a = (l.address as string).toLowerCase();
          const cur = lastTradeBlock.get(a) ?? 0n;
          if (l.blockNumber > cur) lastTradeBlock.set(a, l.blockNumber);
        }
        // Ensure graduation flag picks up any event the read may have missed
        const graduatedFromLogs = new Set<string>();
        for (const l of gradLogs as any[]) {
          graduatedFromLogs.add((l.address as string).toLowerCase());
        }

        // 5) Resolve unique block timestamps in parallel
        const blocksToResolve = new Set<bigint>();
        for (const v of createdByAddr.values()) blocksToResolve.add(v.blockNumber);
        for (const v of lastTradeBlock.values()) blocksToResolve.add(v);
        await Promise.all(Array.from(blocksToResolve).map((b) => getBlockTs(b)));

        for (const t of reads) {
          const lower = t.address.toLowerCase();
          const created = createdByAddr.get(lower);
          if (created) {
            t.createdAtMs = blockTsCacheRef.current.get(created.blockNumber) ?? null;
            t.createdIndex = created.index;
          }
          const lastBlk = lastTradeBlock.get(lower);
          if (lastBlk) t.lastTradeMs = blockTsCacheRef.current.get(lastBlk) ?? null;
          if (graduatedFromLogs.has(lower)) t.graduated = true;
          tokensRef.current.set(lower, t);
        }

        if (cancelled) return;
        setState({
          tokens: Array.from(tokensRef.current.values()),
          isLoading: false,
          loadError: null,
          refresh,
        });

        // 6) Live: watch new TokenCreated to add tokens
        unwatchCreated = client.watchEvent({
          address: FACTORY_ADDRESS,
          event: TOKEN_CREATED,
          onLogs: async (logs: Log[]) => {
            if (cancelled) return;
            for (const l of logs as any[]) {
              const addr = l.args.token as `0x${string}`;
              const lower = addr.toLowerCase();
              if (tokensRef.current.has(lower)) continue;
              const ts = await getBlockTs(l.blockNumber);
              const newTok: FeedToken = {
                address: addr,
                name: (l.args.name as string) || '',
                symbol: (l.args.symbol as string) || '',
                realEthRaised: 0,
                currentPriceEth: 0,
                marketCapEth: 0,
                graduated: false,
                createdAtMs: ts,
                createdIndex: Number(l.args.index ?? 0n),
                lastTradeMs: null,
                creator: (l.args.creator as `0x${string}`) ?? null,
              };
              tokensRef.current.set(lower, newTok);
            }
            publishTokens();
          },
        });

        // 7) Live: Buy/Sell across all tracked tokens — update raised/price/lastTrade
        const allAddrs = () => Array.from(tokensRef.current.keys()) as `0x${string}`[];
        const handleTradeLive = async (
          l: any,
          isBuy: boolean
        ) => {
          const a = (l.address as string).toLowerCase();
          const tok = tokensRef.current.get(a);
          if (!tok) return;
          const ts = await getBlockTs(l.blockNumber);
          const ethDelta = isBuy
            ? Number(formatEther(l.args.ethIn as bigint))
            : -Number(formatEther(l.args.ethOut as bigint));
          const ethAmt = isBuy ? (l.args.ethIn as bigint) : (l.args.ethOut as bigint);
          const tokAmt = isBuy ? (l.args.tokensOut as bigint) : (l.args.tokensIn as bigint);
          const price =
            tokAmt === 0n
              ? tok.currentPriceEth
              : Number(formatEther(ethAmt)) / Number(formatEther(tokAmt));
          tok.realEthRaised = Math.max(0, tok.realEthRaised + ethDelta);
          tok.currentPriceEth = price;
          tok.marketCapEth = price * TOTAL_SUPPLY_NUM;
          tok.lastTradeMs = ts;
          publishTokens();
        };

        unwatchBuy = client.watchEvent({
          address: allAddrs(),
          event: BUY_EVENT,
          onLogs: (logs) => {
            for (const l of logs) handleTradeLive(l, true);
          },
        });

        unwatchSell = client.watchEvent({
          address: allAddrs(),
          event: SELL_EVENT,
          onLogs: (logs) => {
            for (const l of logs) handleTradeLive(l, false);
          },
        });

        unwatchGraduated = client.watchEvent({
          address: allAddrs(),
          event: GRADUATED_EVENT,
          onLogs: (logs) => {
            for (const l of logs as any[]) {
              const a = (l.address as string).toLowerCase();
              const tok = tokensRef.current.get(a);
              if (tok) tok.graduated = true;
            }
            publishTokens();
          },
        });

        // 8) Polling fallback every 20s — also catches new tokens whose event subs missed
        pollTimer = window.setInterval(async () => {
          try {
            const latestTotal = (await client.readContract({
              address: FACTORY_ADDRESS,
              abi: FACTORY_ABI,
              functionName: 'totalTokens',
            })) as bigint;
            if (Number(latestTotal) > tokensRef.current.size) refresh();
          } catch {
            /* ignore */
          }
        }, 20000);
      } catch (err: any) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          isLoading: false,
          loadError: err?.shortMessage || err?.message || 'Failed to load tokens',
          refresh,
        }));
      }
    })();

    return () => {
      cancelled = true;
      unwatchCreated?.();
      unwatchBuy?.();
      unwatchSell?.();
      unwatchGraduated?.();
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [client, maxTokens, reloadKey, refresh, getBlockTs, publishTokens]);

  return state;
}
