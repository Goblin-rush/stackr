import { useParams } from 'wouter';
import { useState, useEffect } from 'react';
import { useReadContract, useWatchContractEvent } from 'wagmi';
import { Navbar } from '@/components/layout/Navbar';
import { useToken } from '@/hooks/use-token';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useChainTokenLive } from '@/hooks/use-chain-token-live';
import { BondingCurveProgress } from '@/components/token/BondingCurveProgress';
import { TradeWidget } from '@/components/token/TradeWidget';
import { RealTimeChart } from '@/components/token/RealTimeChart';
import { TradeTape } from '@/components/token/TradeTape';
import { TradeHistoryTable } from '@/components/token/TradeHistoryTable';
import { HoldersList } from '@/components/token/HoldersList';
import { type Timeframe } from '@/components/token/PriceChart';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TOTAL_SUPPLY, FACTORY_V2_ADDRESS, FACTORY_V2_ABI, CURVE_V2_ABI } from '@/lib/contracts';
import { Copy, ExternalLink, Globe, Send } from 'lucide-react';
import { formatEther } from 'viem';
import { Skeleton } from '@/components/ui/skeleton';
import { useTokenMetadata, ipfsToHttp, normalizeWebsite, normalizeTwitter, normalizeTelegram } from '@/lib/token-metadata';

function timeAgo(ts: number | null): string {
  if (!ts) return '–';
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function TokenDetailPage() {
  const { address } = useParams<{ address: `0x${string}` }>();
  const [tab, setTab] = useState('chart');
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Look up curve address from V2 factory
  const { data: record } = useReadContract({
    address: FACTORY_V2_ADDRESS ?? undefined,
    abi: FACTORY_V2_ABI,
    functionName: 'getRecord',
    args: [address],
    query: { enabled: !!FACTORY_V2_ADDRESS && !!address },
  });
  const curveAddress = (record as any)?.curve as `0x${string}` | undefined;

  const { name, symbol, realEthRaised, graduated, currentPrice, isLoading, refetch } = useToken(address, curveAddress);
  const { data: ethPrice } = useEthPrice();
  const live = useChainTokenLive(address, curveAddress);
  const meta = useTokenMetadata(address);

  // Refetch on-chain reads when curve emits Buy/Sell/Graduated
  useWatchContractEvent({
    address: curveAddress,
    abi: CURVE_V2_ABI,
    eventName: 'Buy',
    enabled: !!curveAddress,
    onLogs: () => refetch(),
  });
  useWatchContractEvent({
    address: curveAddress,
    abi: CURVE_V2_ABI,
    eventName: 'Sell',
    enabled: !!curveAddress,
    onLogs: () => refetch(),
  });
  useWatchContractEvent({
    address: curveAddress,
    abi: CURVE_V2_ABI,
    eventName: 'Graduated',
    enabled: !!curveAddress,
    onLogs: () => refetch(),
  });

  // Polling fallback every 12s
  useEffect(() => {
    const id = setInterval(() => refetch(), 12000);
    return () => clearInterval(id);
  }, [refetch]);

  const priceInEth = currentPrice ? Number(formatEther(currentPrice)) : live.currentPrice;
  const mcEth = priceInEth * Number(formatEther(TOTAL_SUPPLY));
  const mcUsd = ethPrice ? mcEth * ethPrice : null;
  const change24h = live.priceChange24hPct;

  if (isLoading && !name) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-8 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Skeleton className="h-32 w-full bg-muted/50" />
              <Skeleton className="h-64 w-full bg-muted/50" />
            </div>
            <div><Skeleton className="h-[400px] w-full bg-muted/50" /></div>
          </div>
        </main>
      </div>
    );
  }

  if (!name) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground font-mono">Token not found or not indexed yet.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-8 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Main Content (Left) */}
          <div className="lg:col-span-8 space-y-6">

            {/* Header / Meta */}
            <div className="p-6 border border-border/50 bg-card">
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div className="min-w-0 flex items-start gap-4">
                  {(() => {
                    const url = ipfsToHttp(meta?.image);
                    return (
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-md bg-muted border border-border/50 overflow-hidden shrink-0 flex items-center justify-center">
                        {url ? (
                          <img src={url} alt={symbol || ''} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-muted-foreground font-black text-lg">{(symbol || '').slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground break-words">{name}</h1>
                      <span className="text-lg md:text-xl text-primary font-mono uppercase bg-primary/10 px-2 py-1 border border-primary/20">${symbol}</span>
                      {graduated ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 border-2 border-primary text-primary uppercase tracking-widest flex items-center gap-1">
                          <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
                          On DEX
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-1.5 py-0.5 border-2 border-foreground text-foreground uppercase tracking-widest flex items-center gap-1">
                          <span className="h-1.5 w-1.5 bg-foreground rounded-full animate-pulse" />
                          Bonding
                        </span>
                      )}
                    </div>
                    {((record as any)?.creator || (record as any)?.createdAt) && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-2">
                        {(record as any)?.creator && (
                          <>
                            by{' '}
                            <a
                              href={`https://basescan.org/address/${(record as any).creator}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-primary transition-colors"
                            >
                              {shortAddr((record as any).creator)}
                            </a>
                            {' '}·{' '}
                          </>
                        )}
                        {(record as any)?.createdAt
                          ? timeAgo(Number((record as any).createdAt) * 1000)
                          : ''}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-3 text-xs font-mono text-muted-foreground">
                      <span className="opacity-60">Token</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(address);
                          setCopiedAddr(true);
                          setTimeout(() => setCopiedAddr(false), 1500);
                        }}
                        className="flex items-center gap-1.5 text-foreground hover:text-primary cursor-pointer truncate text-left"
                      >
                        <span className="truncate">{address.slice(0, 6)}…{address.slice(-4)}</span>
                        {copiedAddr ? (
                          <span className="text-[10px] text-primary font-bold">copied</span>
                        ) : (
                          <Copy className="h-3 w-3 shrink-0" />
                        )}
                      </button>
                      <a
                        href={`https://basescan.org/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> Basescan
                      </a>
                      {curveAddress && (
                        <a
                          href={`https://basescan.org/address/${curveAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" /> Curve
                        </a>
                      )}
                    </div>

                    {(() => {
                      const web = normalizeWebsite(meta?.website);
                      const tw = normalizeTwitter(meta?.twitter);
                      const tg = normalizeTelegram(meta?.telegram);
                      if (!web && !tw && !tg && !meta?.description) return null;
                      return (
                        <div className="mt-3 space-y-3">
                          {meta?.description && (
                            <p className="text-sm text-foreground/80 leading-relaxed max-w-2xl">{meta.description}</p>
                          )}
                          {(web || tw || tg) && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {web && (
                                <a href={web} target="_blank" rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border border-border/50 bg-muted/30 hover:bg-muted hover:border-primary/40 hover:text-primary transition-colors">
                                  <Globe className="h-3 w-3" />
                                  <span className="truncate max-w-[160px]">{web.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                                </a>
                              )}
                              {tw && (
                                <a href={tw} target="_blank" rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border border-border/50 bg-muted/30 hover:bg-muted hover:border-primary/40 hover:text-primary transition-colors">
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                  <span>@{tw.split('/').pop()}</span>
                                </a>
                              )}
                              {tg && (
                                <a href={tg} target="_blank" rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border border-border/50 bg-muted/30 hover:bg-muted hover:border-primary/40 hover:text-primary transition-colors">
                                  <Send className="h-3 w-3" />
                                  <span>@{tg.split('/').pop()}</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-6 border-t border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Price USD</p>
                  <p className="font-mono text-lg font-bold text-primary tabular-nums">
                    {ethPrice && priceInEth ? `$${(priceInEth * ethPrice).toFixed(7)}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">24h Change</p>
                  <p className={`font-mono text-lg tabular-nums font-bold ${change24h >= 0 ? 'text-foreground' : 'text-primary'}`}>
                    {live.trades.length > 1 ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : '–'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Market Cap</p>
                  <p className="font-mono text-lg tabular-nums">
                    {mcUsd ? `$${mcUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${mcEth.toFixed(2)} ETH`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">24h Volume</p>
                  <p className="font-mono text-lg tabular-nums">{live.volume24hEth.toFixed(3)} ETH</p>
                </div>
              </div>
            </div>

            {/* Bonding Curve */}
            <div className="p-6 border border-border/50 bg-card">
              <BondingCurveProgress realEthRaised={realEthRaised} graduated={graduated} />
            </div>

            {/* Chart / Trades / Holders */}
            <div className="border border-border/50 bg-card overflow-hidden">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-muted/10 h-10 px-2 gap-1">
                  <TabsTrigger value="chart" className="text-xs font-mono uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-none rounded-sm">Chart</TabsTrigger>
                  <TabsTrigger value="trades" className="text-xs font-mono uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-none rounded-sm">
                    Trades
                    {live.trades.length > 0 && (
                      <span className="ml-1.5 text-[9px] bg-primary/15 text-primary px-1 rounded">{live.trades.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="holders" className="text-xs font-mono uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-none rounded-sm">
                    Holders
                    {live.holders.length > 0 && (
                      <span className="ml-1.5 text-[9px] bg-primary/15 text-primary px-1 rounded">{live.holders.length}</span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="m-0 p-3">
                  <div className="flex items-center gap-1 mb-2 px-1 flex-wrap">
                    {(['5m', '15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                          timeframe === tf
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground border border-transparent'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                    <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                      <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
                      LIVE · BASE
                    </div>
                  </div>
                  <RealTimeChart
                    baselinePrice={priceInEth}
                    trades={live.trades}
                    lastTrade={live.lastTrade}
                    timeframe={timeframe}
                    snapshotKey={`${address}:${live.snapshotKey}`}
                    symbol={symbol || 'TOKEN'}
                    height={380}
                  />
                  {live.isInitialLoading && (
                    <p className="text-[11px] text-muted-foreground font-mono mt-2 text-center">
                      Loading historical trades from Base…
                    </p>
                  )}
                  {live.loadError && (
                    <p className="text-[11px] text-primary font-mono mt-2 text-center">{live.loadError}</p>
                  )}
                </TabsContent>

                <TabsContent value="trades" className="m-0">
                  {live.isInitialLoading ? (
                    <div className="p-8 text-center text-xs font-mono text-muted-foreground">Loading trades from chain…</div>
                  ) : live.trades.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-muted-foreground">No trades yet.</div>
                  ) : (
                    <TradeHistoryTable trades={live.trades} symbol={symbol || 'TOKEN'} />
                  )}
                </TabsContent>

                <TabsContent value="holders" className="m-0">
                  {live.isInitialLoading ? (
                    <div className="p-8 text-center text-xs font-mono text-muted-foreground">Loading holders from chain…</div>
                  ) : live.holders.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-muted-foreground">No holders yet.</div>
                  ) : (
                    <HoldersList holders={live.holders} symbol={symbol || 'TOKEN'} />
                  )}
                </TabsContent>
              </Tabs>
            </div>

          </div>

          {/* Trade Widget (Right) */}
          <div className="lg:col-span-4 space-y-6">
            <TradeWidget tokenAddress={address} curveAddress={curveAddress} />

            {live.trades.length > 0 && (
              <div className="border border-border/50 bg-muted/10">
                <TradeTape trades={live.trades} symbol={symbol || 'TOKEN'} />
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
