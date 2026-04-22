import { useParams, Link } from 'wouter';
import { useState, useEffect, useRef } from 'react';
import { useReadContract, useWatchContractEvent, useAccount } from 'wagmi';
import { Navbar } from '@/components/layout/Navbar';
import { useToken } from '@/hooks/use-token';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useChainTokenLive } from '@/hooks/use-chain-token-live';
import { TradeWidget } from '@/components/token/TradeWidget';
import { TVAdvancedChart } from '@/components/token/TVAdvancedChart';
import { TradeHistoryTable } from '@/components/token/TradeHistoryTable';
import { HoldersList } from '@/components/token/HoldersList';
import { TOTAL_SUPPLY, FACTORY_V2_ADDRESS, FACTORY_V2_ABI, CURVE_V2_ABI, V2_TARGET_REAL_ETH } from '@/lib/contracts';
import { ArrowLeft, Copy, Check, ExternalLink, Globe, Send, ImagePlus, Loader2 } from 'lucide-react';
import { formatEther } from 'viem';
import { Skeleton } from '@/components/ui/skeleton';
import { useTokenMetadata, ipfsToHttp, normalizeWebsite, normalizeTwitter, normalizeTelegram, saveTokenMetadata } from '@/lib/token-metadata';
import { uploadImage } from '@/lib/upload';
import { toast } from 'sonner';

function timeAgo(ts: number | null): string {
  if (!ts) return '–';
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function genAvatarUri(symbol: string): string {
  const palette = ['#c2410c','#7c3aed','#15803d','#1d4ed8','#0e7490','#b45309','#9f1239','#4d7c0f'];
  const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = palette[hash % palette.length];
  const label = symbol.slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="10" fill="${color}"/><text x="24" y="32" font-family="monospace,sans-serif" font-size="16" font-weight="900" text-anchor="middle" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function ProgressBar({ pct }: { pct: number }) {
  const p = Math.min(pct, 100);
  let gradient = 'linear-gradient(90deg, hsl(142 66% 36%) 0%, hsl(152 68% 48%) 100%)';
  let glow = '0 0 10px hsl(142 66% 44% / 0.38)';
  if (p >= 85) {
    gradient = 'linear-gradient(90deg, hsl(4 84% 46%) 0%, hsl(18 92% 64%) 100%)';
    glow = '0 0 14px hsl(4 84% 58% / 0.55)';
  } else if (p >= 60) {
    gradient = 'linear-gradient(90deg, hsl(24 90% 46%) 0%, hsl(36 92% 60%) 100%)';
    glow = '0 0 12px hsl(24 90% 55% / 0.45)';
  } else if (p >= 30) {
    gradient = 'linear-gradient(90deg, hsl(42 88% 42%) 0%, hsl(48 90% 56%) 100%)';
    glow = '0 0 10px hsl(42 88% 50% / 0.40)';
  }
  return (
    <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/6">
      <div
        className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
        style={{ width: `${p}%`, background: gradient, boxShadow: p > 3 ? glow : 'none' }}
      >
        <span
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
            animation: 'shimmer 2.2s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

export default function TokenDetailPage() {
  const { address } = useParams<{ address: `0x${string}` }>();
  const [infoTab, setInfoTab] = useState<'trades' | 'holders'>('trades');
  const [copiedCA, setCopiedCA] = useState(false);
  const [imgUpdating, setImgUpdating] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const { address: walletAddress } = useAccount();

  const { data: record, isLoading: isRecordLoading } = useReadContract({
    address: FACTORY_V2_ADDRESS ?? undefined,
    abi: FACTORY_V2_ABI,
    functionName: 'getRecord',
    args: [address],
    query: { enabled: !!FACTORY_V2_ADDRESS && !!address },
  });
  const curveAddress = (record as any)?.curve as `0x${string}` | undefined;

  const { name, symbol, realEthRaised, graduated, currentPrice, progress, uniswapPair, isLoading, refetch } = useToken(address, curveAddress);
  const { data: ethPrice } = useEthPrice();
  const live = useChainTokenLive(address, curveAddress);
  const meta = useTokenMetadata(address);

  useWatchContractEvent({ address: curveAddress, abi: CURVE_V2_ABI, eventName: 'Buy', enabled: !!curveAddress, onLogs: () => refetch() });
  useWatchContractEvent({ address: curveAddress, abi: CURVE_V2_ABI, eventName: 'Sell', enabled: !!curveAddress, onLogs: () => refetch() });
  useWatchContractEvent({ address: curveAddress, abi: CURVE_V2_ABI, eventName: 'Graduated', enabled: !!curveAddress, onLogs: () => refetch() });

  useEffect(() => {
    const id = setInterval(() => refetch(), 12000);
    return () => clearInterval(id);
  }, [refetch]);

  const priceInEth = currentPrice ? Number(formatEther(currentPrice)) : live.currentPrice;
  const mcEth = priceInEth * Number(formatEther(TOTAL_SUPPLY));
  const mcUsd = ethPrice ? mcEth * ethPrice : null;
  const change24h = live.priceChange24hPct;
  const TARGET_ETH_NUM = Number(formatEther(V2_TARGET_REAL_ETH)); // 5.0
  const realEthRaisedNum = realEthRaised
    ? Number(formatEther(realEthRaised))
    : live.realEthRaised > 0 ? live.realEthRaised : 0;
  const pct = progress
    ? Number(progress) / 100
    : Math.min((realEthRaisedNum / TARGET_ETH_NUM) * 100, 100);

  const creator = (record as any)?.creator as string | undefined;
  const isCreator = !!(walletAddress && creator && walletAddress.toLowerCase() === creator.toLowerCase());

  const handleUpdateImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;
    setImgUpdating(true);
    const tid = toast.loading('Uploading image…');
    try {
      const r = await uploadImage(file);
      await saveTokenMetadata(address, { image: r.url });
      toast.success('Image saved!', { id: tid, description: r.cid.slice(0, 12) + '…' });
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      toast.error('Upload failed', { id: tid, description: err?.message });
    } finally {
      setImgUpdating(false);
      if (imgInputRef.current) imgInputRef.current.value = '';
    }
  };

  const imgUrl = ipfsToHttp(meta?.image);
  const avatarSrc = imgUrl || (symbol ? genAvatarUri(symbol) : '');
  const web = normalizeWebsite(meta?.website);
  const tw = normalizeTwitter(meta?.twitter);
  const tg = normalizeTelegram(meta?.telegram);

  const holderCount = live.holders.length || 0;

  if ((isLoading || isRecordLoading) && !name) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-8 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-4">
              <Skeleton className="h-64 w-full bg-muted/50" />
              <Skeleton className="h-[440px] w-full bg-muted/50" />
            </div>
            <div className="lg:col-span-4"><Skeleton className="h-80 w-full bg-muted/50" /></div>
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

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-5 md:px-8">
        {/* Back link */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/">
            <button className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3 w-3" strokeWidth={2.5} />
              All tokens
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* LEFT — 8 cols */}
          <div className="lg:col-span-8 space-y-4">

            {/* ─── Unified Header Card ─── */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="p-5 md:p-6">

                {/* Symbol + name + badge */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="relative w-12 h-12 shrink-0 mt-0.5 group">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-border/30 bg-muted">
                        {avatarSrc && <img src={avatarSrc} alt={symbol || ''} className="w-full h-full object-cover" />}
                      </div>
                      {isCreator && (
                        <button
                          onClick={() => imgInputRef.current?.click()}
                          disabled={imgUpdating}
                          title="Update token image"
                          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                        >
                          {imgUpdating
                            ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                            : <ImagePlus className="h-4 w-4 text-white" />}
                        </button>
                      )}
                      <input
                        ref={imgInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUpdateImage}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-3xl md:text-4xl font-black tracking-tighter leading-none text-gradient">
                          {symbol}
                        </span>
                        <h1 className="text-base md:text-lg font-bold text-foreground/90">{name}</h1>
                      </div>
                      {((record as any)?.creator || (record as any)?.deployedAt) && (
                        <p className="text-[11px] text-muted-foreground font-mono mt-1.5">
                          {(record as any)?.creator && (
                            <>
                              by{' '}
                              <a href={`https://basescan.org/address/${(record as any).creator}`} target="_blank" rel="noreferrer"
                                className="hover:text-primary transition-colors">
                                {shortAddr((record as any).creator)}
                              </a>
                              {' · '}
                            </>
                          )}
                          {(record as any)?.deployedAt ? `${timeAgo(Number((record as any).deployedAt) * 1000)} ago` : ''}
                          {' · Base'}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full border ${
                    graduated
                      ? 'border-primary/50 text-primary bg-primary/10'
                      : 'border-border/60 text-muted-foreground bg-white/4'
                  }`}>
                    {graduated ? 'DEX' : 'BONDING'}
                  </span>
                </div>

                {/* CA row */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 font-mono">
                  <span className="text-[9px] font-semibold tracking-wider text-muted-foreground/50 uppercase shrink-0">CA</span>
                  <a href={`https://basescan.org/address/${address}`} target="_blank" rel="noreferrer noopener"
                    className="text-[11px] text-muted-foreground/70 hover:text-primary transition-colors break-all">
                    {address}
                  </a>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a href={`https://basescan.org/address/${address}`} target="_blank" rel="noreferrer noopener"
                      className="text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button onClick={() => { navigator.clipboard.writeText(address); setCopiedCA(true); setTimeout(() => setCopiedCA(false), 2000); }}
                      className="text-muted-foreground hover:text-primary transition-colors">
                      {copiedCA ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    {curveAddress && (
                      <a href={`https://basescan.org/address/${curveAddress}`} target="_blank" rel="noreferrer noopener"
                        className="text-[10px] font-mono text-muted-foreground/50 hover:text-primary transition-colors">
                        Curve
                      </a>
                    )}
                    {graduated && uniswapPair && uniswapPair !== '0x0000000000000000000000000000000000000000' && (
                      <a href={`https://app.uniswap.org/explore/pools/base/${uniswapPair}`} target="_blank" rel="noreferrer noopener"
                        className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors">
                        Uniswap
                      </a>
                    )}
                  </div>
                </div>

                {/* Stats — 4 cols with thin dividers */}
                <div className="grid grid-cols-4 gap-0 mb-5 pt-3 border-t border-border/30">
                  {[
                    { label: 'Price', value: ethPrice && priceInEth ? `$${(priceInEth * ethPrice).toFixed(7)}` : '–', color: '' },
                    { label: 'Market Cap', value: mcUsd ? `$${mcUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${mcEth.toFixed(3)} ETH`, color: '' },
                    {
                      label: '24h',
                      value: live.trades.length > 1 ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%` : '–',
                      color: live.trades.length > 1 ? (change24h >= 0 ? 'text-emerald-400' : 'text-primary') : '',
                    },
                    { label: 'Holders', value: holderCount > 0 ? String(holderCount) : '–', color: '' },
                  ].map((cell, i) => (
                    <div key={cell.label} className={i > 0 ? 'pl-4 border-l border-border/30' : ''}>
                      <div className="text-[9px] font-semibold tracking-wider text-muted-foreground/50 mb-1 uppercase">{cell.label}</div>
                      <div className={`text-sm font-bold tabular-nums ${cell.color || 'text-foreground'}`}>{cell.value}</div>
                    </div>
                  ))}
                </div>

                {/* Bonding curve */}
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase">Bonding curve</span>
                    <span className="text-[11px] font-semibold tabular-nums text-foreground/80">
                      {pct.toFixed(0)}% · {realEthRaisedNum.toFixed(2)} / {TARGET_ETH_NUM} ETH
                    </span>
                  </div>
                  <ProgressBar pct={pct} />
                </div>

                {/* Description + socials */}
                {(meta?.description || web || tw || tg) && (
                  <div className="pt-4 border-t border-border/30">
                    {meta?.description && (
                      <p className="text-sm text-foreground/80 leading-relaxed mb-3">{meta.description}</p>
                    )}
                    {(web || tw || tg) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {tw && (
                          <a href={tw} target="_blank" rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/40 hover:border-primary/40 hover:text-primary transition-all">
                            <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            @{tw.split('/').pop()}
                          </a>
                        )}
                        {tg && (
                          <a href={tg} target="_blank" rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/40 hover:border-primary/40 hover:text-primary transition-all">
                            <Send className="h-3 w-3 shrink-0" />
                            @{tg.split('/').pop()}
                          </a>
                        )}
                        {web && (
                          <a href={web} target="_blank" rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/40 hover:border-primary/40 hover:text-primary transition-all">
                            <Globe className="h-3 w-3 shrink-0" />
                            {web.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* ─── TradingView Chart ─── */}
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <TVAdvancedChart
                seed={address}
                baseEthRaised={realEthRaisedNum}
                graduated={graduated}
                symbol={`${symbol || 'TOKEN'}/ETH`}
                height={440}
                ethPrice={ethPrice ?? 3000}
                currentMcUsd={mcUsd}
                lastTrade={live.lastTrade ? { price: live.lastTrade.price, ethAmount: live.lastTrade.ethAmount, timestamp: live.lastTrade.timestamp } : null}
              />
            </div>

            {/* ─── Trades / Holders tabbed ─── */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="flex border-b border-border/40">
                {(['trades', 'holders'] as const).map((tab) => (
                  <button key={tab} onClick={() => setInfoTab(tab)}
                    className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                      infoTab === tab
                        ? 'text-foreground border-b-2 border-primary -mb-px'
                        : 'text-muted-foreground/60 hover:text-muted-foreground'
                    }`}>
                    {tab === 'trades' ? (
                      <>Recent Trades{live.trades.length > 0 && <span className="ml-1.5 text-[9px] bg-primary/15 text-primary px-1 py-0.5 rounded">{live.trades.length}</span>}</>
                    ) : (
                      <>Top Holders{live.holders.length > 0 && <span className="ml-1.5 text-[9px] bg-primary/15 text-primary px-1 py-0.5 rounded">{live.holders.length}</span>}</>
                    )}
                  </button>
                ))}
              </div>

              {infoTab === 'trades' ? (
                live.isInitialLoading ? (
                  <div className="p-8 text-center text-xs font-mono text-muted-foreground">Loading trades from chain…</div>
                ) : live.trades.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-muted-foreground">No trades yet.</div>
                ) : (
                  <TradeHistoryTable trades={live.trades} symbol={symbol || 'TOKEN'} />
                )
              ) : (
                live.isInitialLoading ? (
                  <div className="p-8 text-center text-xs font-mono text-muted-foreground">Loading holders from chain…</div>
                ) : live.holders.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-muted-foreground">No holders yet.</div>
                ) : (
                  <HoldersList holders={live.holders} symbol={symbol || 'TOKEN'} />
                )
              )}
            </div>

          </div>

          {/* RIGHT — 4 cols */}
          <div className="lg:col-span-4 space-y-4">
            <TradeWidget tokenAddress={address} curveAddress={curveAddress} />

          </div>

        </div>
      </main>
    </div>
  );
}
