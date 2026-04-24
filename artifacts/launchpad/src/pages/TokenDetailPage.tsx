import { useParams } from 'wouter';
import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { Navbar } from '@/components/layout/Navbar';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useChainTokenLive } from '@/hooks/use-chain-token-live';
import { TradeWidget } from '@/components/token/TradeWidget';
import { TVAdvancedChart } from '@/components/token/TVAdvancedChart';
import { TradeHistoryTable } from '@/components/token/TradeHistoryTable';
import { HoldersList } from '@/components/token/HoldersList';
import {
  FACTORY_V3_ABI,
  TOKEN_V3_ABI,
  computePoolId,
  getV3Contracts,
  createChainClient,
} from '@/lib/contracts';
import { Copy, Check, ExternalLink, Globe, Send, ImagePlus, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTokenMetadata, ipfsToHttp, ipfsNextGateway, normalizeWebsite, normalizeTwitter, normalizeTelegram, saveTokenMetadata, updateTokenMetadataImage } from '@/lib/token-metadata';
import { uploadImage } from '@/lib/upload';
import { toast } from 'sonner';

const TOTAL_SUPPLY = 1_000_000_000;

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

export default function TokenDetailPage() {
  const { address, chainId: chainIdStr } = useParams<{ address: `0x${string}`; chainId?: string }>();
  const chainId = chainIdStr ? Number(chainIdStr) : 8453;
  const contracts = getV3Contracts(chainId);

  const [infoTab, setInfoTab] = useState<'trades' | 'holders'>('trades');
  const [copiedCA, setCopiedCA] = useState(false);
  const [imgUpdating, setImgUpdating] = useState(false);
  const [displayImgSrc, setDisplayImgSrc] = useState<string | null>(null);
  const imgGatewayTriedRef = useRef(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const { address: walletAddress } = useAccount();

  // Chain-aware token info via viem (works regardless of wallet connection)
  const [tokenInfo, setTokenInfo] = useState<{ name: string | null; symbol: string | null; isLoading: boolean }>({
    name: null, symbol: null, isLoading: true,
  });
  const [record, setRecord] = useState<any>(null);
  const [isRecordLoading, setIsRecordLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setTokenInfo({ name: null, symbol: null, isLoading: true });
    setIsRecordLoading(true);
    const viemClient = createChainClient(chainId);
    (async () => {
      try {
        const results = await viemClient.multicall({
          contracts: [
            { address: address as `0x${string}`, abi: TOKEN_V3_ABI, functionName: 'name' },
            { address: address as `0x${string}`, abi: TOKEN_V3_ABI, functionName: 'symbol' },
            { address: contracts.factoryAddress, abi: FACTORY_V3_ABI, functionName: 'getRecord', args: [address as `0x${string}`] },
          ],
          allowFailure: true,
        });
        setTokenInfo({
          name: results[0].status === 'success' ? (results[0].result as string) : null,
          symbol: results[1].status === 'success' ? (results[1].result as string) : null,
          isLoading: false,
        });
        setRecord(results[2].status === 'success' ? results[2].result : null);
      } catch {
        setTokenInfo({ name: null, symbol: null, isLoading: false });
      } finally {
        setIsRecordLoading(false);
      }
    })();
  }, [address, chainId, contracts.factoryAddress]);

  const name = tokenInfo.name;
  const symbol = tokenInfo.symbol;
  const isLoading = tokenInfo.isLoading;

  const { data: ethPrice } = useEthPrice();
  const live = useChainTokenLive(address, undefined, chainId);
  const meta = useTokenMetadata(address);

  const priceInEth = live.currentPrice;
  const mcEth = priceInEth * TOTAL_SUPPLY;
  const mcUsd = ethPrice ? mcEth * ethPrice : null;
  const change24h = live.priceChange24hPct;

  const rec = record as any;
  const creator = rec?.creator as string | undefined;
  const deployedAt = rec?.deployedAt ? Number(rec.deployedAt) * 1000 : null;
  const isCreator = !!(walletAddress && creator && walletAddress.toLowerCase() === creator.toLowerCase());

  const poolId = address ? computePoolId(address, contracts.hookAddress) : null;

  const handleUpdateImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;
    setImgUpdating(true);
    const tid = toast.loading('Uploading image…');
    try {
      const r = await uploadImage(file);
      await updateTokenMetadataImage(address, r.url);
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
  const fallbackAvatar = symbol ? genAvatarUri(symbol) : '';
  const resolvedImgSrc = displayImgSrc ?? imgUrl ?? fallbackAvatar;

  useEffect(() => {
    imgGatewayTriedRef.current = false;
    setDisplayImgSrc(imgUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.image]);

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* LEFT — 8 cols */}
          <div className="lg:col-span-8 space-y-4">

            {/* Unified Header Card */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="p-5 md:p-6">

                {/* Symbol + name + badge */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="relative w-12 h-12 shrink-0 mt-0.5 group">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-border/30 bg-muted">
                        {resolvedImgSrc && (
                          <img
                            src={resolvedImgSrc}
                            alt={symbol || ''}
                            className="w-full h-full object-cover"
                            onError={() => {
                              if (!imgGatewayTriedRef.current && resolvedImgSrc) {
                                const next = ipfsNextGateway(resolvedImgSrc);
                                if (next) { imgGatewayTriedRef.current = true; setDisplayImgSrc(next); return; }
                              }
                              setDisplayImgSrc(fallbackAvatar);
                            }}
                          />
                        )}
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
                      {(creator || deployedAt) && (
                        <p className="text-[11px] text-muted-foreground font-mono mt-1.5">
                          {creator && (
                            <>
                              by{' '}
                              <a href={`${contracts.explorerUrl}/address/${creator}`} target="_blank" rel="noreferrer"
                                className="hover:text-primary transition-colors">
                                {shortAddr(creator)}
                              </a>
                              {' · '}
                            </>
                          )}
                          {deployedAt ? `${timeAgo(deployedAt)} ago` : ''}
                          {` · ${contracts.chainName} · Uniswap V4`}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full border border-primary/50 text-primary bg-primary/10">
                    V4 POOL
                  </span>
                </div>

                {/* CA row */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 font-mono">
                  <span className="text-[9px] font-semibold tracking-wider text-muted-foreground/50 uppercase shrink-0">CA</span>
                  <a href={`${contracts.explorerUrl}/address/${address}`} target="_blank" rel="noreferrer noopener"
                    className="text-[11px] text-muted-foreground/70 hover:text-primary transition-colors break-all">
                    {address}
                  </a>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a href={`${contracts.explorerUrl}/address/${address}`} target="_blank" rel="noreferrer noopener"
                      className="text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button onClick={() => { navigator.clipboard.writeText(address); setCopiedCA(true); setTimeout(() => setCopiedCA(false), 2000); }}
                      className="text-muted-foreground hover:text-primary transition-colors">
                      {copiedCA ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    {poolId && (
                      <a
                        href={`${contracts.explorerUrl}/address/${contracts.factoryAddress}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors"
                      >
                        V4 Pool
                      </a>
                    )}
                    <a
                      href={`https://app.uniswap.org/swap?chain=${chainId === 1 ? 'mainnet' : 'base'}&outputCurrency=${address}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors"
                    >
                      Uniswap
                    </a>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-0 mb-5 pt-3 border-t border-border/30">
                  {[
                    {
                      label: 'Price',
                      value: priceInEth > 0
                        ? (ethPrice ? `$${(priceInEth * ethPrice).toFixed(7)}` : `${priceInEth.toFixed(8)} ETH`)
                        : '—',
                      color: '',
                    },
                    {
                      label: 'Market Cap',
                      value: mcUsd ? `$${mcUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : (mcEth > 0 ? `${mcEth.toFixed(3)} ETH` : '—'),
                      color: '',
                    },
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

                {/* Pool info row */}
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Pool</span>
                  <span className="text-[11px] font-mono text-muted-foreground">Uniswap V4 · 0.3% LP fee · 3% swap tax</span>
                  <span className="text-[11px] font-mono text-primary/70">1.5% rewards / 1.5% platform</span>
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

            {/* TradingView Chart */}
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <TVAdvancedChart
                seed={address}
                baseEthRaised={0}
                graduated={true}
                symbol={`${symbol || 'TOKEN'}/ETH`}
                height={440}
                ethPrice={ethPrice ?? 3000}
                currentMcUsd={mcUsd}
                initialDevBuyEth={0}
                lastTrade={live.lastTrade ? { price: live.lastTrade.price, ethAmount: live.lastTrade.ethAmount, timestamp: live.lastTrade.timestamp } : null}
              />
            </div>

            {/* Trades / Holders tabbed */}
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
            <TradeWidget
              tokenAddress={address}
              currentPriceEth={live.currentPrice}
              symbol={symbol ?? undefined}
              chainId={chainId}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
