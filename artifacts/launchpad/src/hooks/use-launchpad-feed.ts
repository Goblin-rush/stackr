import { useEffect, useRef, useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem, type Log } from 'viem';
import { FACTORY_V2_ADDRESS, FACTORY_V2_ABI, TOKEN_V2_ABI, CURVE_V2_ABI, TOTAL_SUPPLY, isHiddenToken } from '@/lib/contracts';

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

// V2 events — Buy/Sell/Graduated fire on CURVE contracts, not token contracts
const TOKEN_DEPLOYED = parseAbiItem(
  'event TokenDeployed(address indexed token, address indexed curve, address indexed creator, string name, string symbol, string metadataURI, uint256 devBuyEth, uint256 devBuyTokens)'
);
const BUY_EVENT = parseAbiItem(
  'event Buy(address indexed buyer, uint256 ethIn, uint256 ethForCurve, uint256 tokensOut, uint256 progressBps)'
);
const SELL_EVENT = parseAbiItem(
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ethOutGross, uint256 ethToUser, uint256 progressBps)'
);
const GRADUATED_EVENT = parseAbiItem(
  'event Graduated(uint256 ethToLp, uint256 tokensToLp, address indexed pair)'
);

const LOOKBACK_BLOCKS = 9_000n;
const MULTICALL_CHUNK = 30;
const TOTAL_SUPPLY_NUM = Number(formatEther(TOTAL_SUPPLY));

export function useLaunchpadFeed(maxTokens = 200): LaunchpadFeedState {
  const client = usePublicClient();
  const [state, setState] = useState<LaunchpadFeedState>({
    tokens: [],
    isLoading: !!FACTORY_V2_ADDRESS,
    loadError: null,
    refresh: () => {},
  });
  const tokensRef = useRef<Map<string, FeedToken>>(new Map());
  // Maps lowercase curveAddress → lowercase tokenAddress (for event routing)
  const curveToTokenRef = useRef<Map<string, string>>(new Map());
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
    if (!client || !FACTORY_V2_ADDRESS) return;
    const factory = FACTORY_V2_ADDRESS;
    let cancelled = false;
    let unwatchDeployed: (() => void) | undefined;
    let unwatchBuy: (() => void) | undefined;
    let unwatchSell: (() => void) | undefined;
    let unwatchGraduated: (() => void) | undefined;
    let pollTimer: number | undefined;

    tokensRef.current = new Map();
    curveToTokenRef.current = new Map();

    (async () => {
      try {
        setState((s) => ({ ...s, isLoading: true, loadError: null, refresh }));

        // 1) Enumerate token addresses from factory
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

        if (tokenAddrs.length === 0) {
          setState({ tokens: [], isLoading: false, loadError: null, refresh });
          // Still watch for new deployments
        } else {
          // 2) Multicall getRecord(tokenAddr) to get curve addresses
          const recordCalls = tokenAddrs.map((t) => ({
            address: factory,
            abi: FACTORY_V2_ABI,
            functionName: 'getRecord' as const,
            args: [t] as [`0x${string}`],
          }));
          const recordResults = await client.multicall({ contracts: recordCalls, allowFailure: true });
          if (cancelled) return;

          type RecordTuple = { token: `0x${string}`; curve: `0x${string}`; creator: `0x${string}`; deployedAt: bigint; metadataURI: string; initialDevBuyEth: bigint; initialDevBuyTokens: bigint };
          const records: (RecordTuple | null)[] = recordResults.map((r) =>
            r.status === 'success' ? (r.result as unknown as RecordTuple) : null
          );

          const curveAddrs = records.map((r) => r?.curve ?? null);

          // 3) Per-token chunked multicall: name+symbol from TOKEN, realEthRaised+graduated+currentPrice from CURVE
          for (let i = 0; i < tokenAddrs.length; i += MULTICALL_CHUNK) {
            const chunkTokens = tokenAddrs.slice(i, i + MULTICALL_CHUNK);
            const chunkCurves = curveAddrs.slice(i, i + MULTICALL_CHUNK);
            const chunkRecords = records.slice(i, i + MULTICALL_CHUNK);

            const contracts = chunkTokens.flatMap((tokenAddress, j) => {
              const curveAddress = chunkCurves[j];
              return [
                { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'name' as const },
                { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'symbol' as const },
                { address: curveAddress ?? tokenAddress, abi: CURVE_V2_ABI, functionName: 'realEthRaised' as const },
                { address: curveAddress ?? tokenAddress, abi: CURVE_V2_ABI, functionName: 'graduated' as const },
                { address: curveAddress ?? tokenAddress, abi: CURVE_V2_ABI, functionName: 'currentPrice' as const },
              ];
            });

            const res = await client.multicall({ contracts, allowFailure: true });
            if (cancelled) return;

            for (let j = 0; j < chunkTokens.length; j++) {
              const base = j * 5;
              const tokenAddress = chunkTokens[j];
              const curveAddress = chunkCurves[j];
              const rec = chunkRecords[j];
              const name = res[base]?.status === 'success' ? (res[base].result as string) : '';
              const symbol = res[base + 1]?.status === 'success' ? (res[base + 1].result as string) : '';
              const realEthRaisedBI = res[base + 2]?.status === 'success' ? (res[base + 2].result as bigint) : 0n;
              const graduated = res[base + 3]?.status === 'success' ? !!res[base + 3].result : false;
              const priceBI = res[base + 4]?.status === 'success' ? (res[base + 4].result as bigint) : 0n;
              const currentPriceEth = Number(formatEther(priceBI));
              const createdAtMs = rec ? Number(rec.deployedAt) * 1000 : null;

              const feedToken: FeedToken = {
                address: tokenAddress,
                curveAddress: curveAddress ?? null,
                name,
                symbol,
                realEthRaised: Number(formatEther(realEthRaisedBI)),
                currentPriceEth,
                marketCapEth: currentPriceEth * TOTAL_SUPPLY_NUM,
                graduated,
                createdAtMs,
                createdIndex: i + j,
                lastTradeMs: null,
                creator: rec?.creator ?? null,
              };
              tokensRef.current.set(tokenAddress.toLowerCase(), feedToken);
              if (curveAddress) {
                curveToTokenRef.current.set(curveAddress.toLowerCase(), tokenAddress.toLowerCase());
              }
            }
          }

          // 4) Backfill lastTradeMs via Buy/Sell logs on CURVE addresses
          const validCurves = curveAddrs.filter((c): c is `0x${string}` => !!c);
          if (validCurves.length > 0) {
            const tip = await client.getBlockNumber();
            const fromBlock = tip > LOOKBACK_BLOCKS ? tip - LOOKBACK_BLOCKS : 0n;
            const safeLogs = async <T,>(p: Promise<T[]>): Promise<T[]> => {
              try { return await p; } catch { return []; }
            };
            const [buyLogs, sellLogs, gradLogs, deployedLogs] = await Promise.all([
              safeLogs(client.getLogs({ address: validCurves, event: BUY_EVENT, fromBlock, toBlock: tip })),
              safeLogs(client.getLogs({ address: validCurves, event: SELL_EVENT, fromBlock, toBlock: tip })),
              safeLogs(client.getLogs({ address: validCurves, event: GRADUATED_EVENT, fromBlock, toBlock: tip })),
              safeLogs(client.getLogs({ address: factory, event: TOKEN_DEPLOYED, fromBlock, toBlock: tip })),
            ]);
            if (cancelled) return;

            const lastTradeBlockByCurve = new Map<string, bigint>();
            for (const l of [...(buyLogs as any[]), ...(sellLogs as any[])]) {
              const ca = (l.address as string).toLowerCase();
              const cur = lastTradeBlockByCurve.get(ca) ?? 0n;
              if (l.blockNumber > cur) lastTradeBlockByCurve.set(ca, l.blockNumber);
            }
            const graduatedCurves = new Set<string>();
            for (const l of gradLogs as any[]) graduatedCurves.add((l.address as string).toLowerCase());

            // TokenDeployed backfill for any tokens missed by multicall
            for (const l of deployedLogs as any[]) {
              const tAddr = (l.args.token as `0x${string}`).toLowerCase();
              const cAddr = (l.args.curve as `0x${string}`).toLowerCase();
              if (!tokensRef.current.has(tAddr)) continue;
              curveToTokenRef.current.set(cAddr, tAddr);
            }

            const blocksToResolve = new Set<bigint>(lastTradeBlockByCurve.values());
            await Promise.all(Array.from(blocksToResolve).map((b) => getBlockTs(b)));

            for (const [curveAddr, blockNum] of lastTradeBlockByCurve.entries()) {
              const tokenAddr = curveToTokenRef.current.get(curveAddr);
              if (!tokenAddr) continue;
              const tok = tokensRef.current.get(tokenAddr);
              if (tok) tok.lastTradeMs = blockTsCacheRef.current.get(blockNum) ?? null;
            }
            for (const curveAddr of graduatedCurves) {
              const tokenAddr = curveToTokenRef.current.get(curveAddr);
              if (!tokenAddr) continue;
              const tok = tokensRef.current.get(tokenAddr);
              if (tok) tok.graduated = true;
            }
          }

          if (cancelled) return;
          setState({
            tokens: Array.from(tokensRef.current.values()),
            isLoading: false,
            loadError: null,
            refresh,
          });
        }

        // 5) Live: watch TokenDeployed to add new tokens
        unwatchDeployed = client.watchEvent({
          address: factory,
          event: TOKEN_DEPLOYED,
          onLogs: async (logs: Log[]) => {
            if (cancelled) return;
            for (const l of logs as any[]) {
              const tokenAddr = (l.args.token as `0x${string}`);
              const curveAddr = (l.args.curve as `0x${string}`);
              const lower = tokenAddr.toLowerCase();
              const curveLower = curveAddr.toLowerCase();
              if (tokensRef.current.has(lower)) continue;
              const ts = await getBlockTs(l.blockNumber);
              const newTok: FeedToken = {
                address: tokenAddr,
                curveAddress: curveAddr,
                name: (l.args.name as string) || '',
                symbol: (l.args.symbol as string) || '',
                realEthRaised: l.args.devBuyEth ? Number(formatEther(l.args.devBuyEth as bigint)) : 0,
                currentPriceEth: 0,
                marketCapEth: 0,
                graduated: false,
                createdAtMs: ts,
                createdIndex: tokensRef.current.size,
                lastTradeMs: null,
                creator: (l.args.creator as `0x${string}`) ?? null,
              };
              tokensRef.current.set(lower, newTok);
              curveToTokenRef.current.set(curveLower, lower);
            }
            publishTokens();
          },
        });

        // 6) Live: Buy/Sell/Graduated on curve addresses
        const allCurves = () => Array.from(curveToTokenRef.current.keys()) as `0x${string}`[];

        const handleTradeLive = async (l: any, isBuy: boolean) => {
          const curveAddr = (l.address as string).toLowerCase();
          const tokenAddr = curveToTokenRef.current.get(curveAddr);
          if (!tokenAddr) return;
          const tok = tokensRef.current.get(tokenAddr);
          if (!tok) return;
          const ts = await getBlockTs(l.blockNumber);
          // V2: ethForCurve for buy price, ethOutGross for sell price
          const ethForCurve = isBuy ? (l.args.ethForCurve as bigint) : (l.args.ethOutGross as bigint);
          const tokAmt = isBuy ? (l.args.tokensOut as bigint) : (l.args.tokensIn as bigint);
          const price = tokAmt === 0n ? tok.currentPriceEth : Number(formatEther(ethForCurve)) / Number(formatEther(tokAmt));
          const ethDelta = isBuy ? Number(formatEther(ethForCurve)) : -Number(formatEther(ethForCurve));
          tok.realEthRaised = Math.max(0, tok.realEthRaised + ethDelta);
          tok.currentPriceEth = price;
          tok.marketCapEth = price * TOTAL_SUPPLY_NUM;
          tok.lastTradeMs = ts;
          publishTokens();
        };

        const curves = allCurves();
        if (curves.length > 0) {
          unwatchBuy = client.watchEvent({
            address: curves,
            event: BUY_EVENT,
            onLogs: (logs) => { for (const l of logs as any[]) handleTradeLive(l, true); },
          });
          unwatchSell = client.watchEvent({
            address: curves,
            event: SELL_EVENT,
            onLogs: (logs) => { for (const l of logs as any[]) handleTradeLive(l, false); },
          });
          unwatchGraduated = client.watchEvent({
            address: curves,
            event: GRADUATED_EVENT,
            onLogs: (logs) => {
              for (const l of logs as any[]) {
                const curveAddr = (l.address as string).toLowerCase();
                const tokenAddr = curveToTokenRef.current.get(curveAddr);
                if (!tokenAddr) continue;
                const tok = tokensRef.current.get(tokenAddr);
                if (tok) tok.graduated = true;
              }
              publishTokens();
            },
          });
        }

        // 7) Polling fallback every 20s
        pollTimer = window.setInterval(async () => {
          try {
            const latestTotal = (await client.readContract({
              address: factory,
              abi: FACTORY_V2_ABI,
              functionName: 'allTokensLength',
            })) as bigint;
            if (Number(latestTotal) > tokensRef.current.size) refresh();
          } catch { /* ignore */ }
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
      unwatchDeployed?.();
      unwatchBuy?.();
      unwatchSell?.();
      unwatchGraduated?.();
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [client, maxTokens, reloadKey, refresh, getBlockTs, publishTokens]);

  return state;
}
