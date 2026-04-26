/**
 * V4 Token Detail Page — `/v4/token/:address`
 *
 * Layout (desktop):
 *   [Header: name, symbol, creator, social links]
 *   [Stats grid: price, mcap, % bonded, holders est]
 *   [Chart (TVAdvancedChart)]   |   [V4TradeWidget + Bond progress]
 *   [Tabs: Recent Trades / Holders not yet]
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { Navbar } from '@/components/layout/Navbar';
import { TVAdvancedChart, type LiveTradeTick } from '@/components/token/TVAdvancedChart';
import { V4TradeWidget } from '@/components/token/V4TradeWidget';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useTokenMetadata, ipfsToHttp } from '@/lib/token-metadata';
import { useReadContract } from 'wagmi';
import { ETH_FACTORY_V4_ADDRESS, V4_BOND_THRESHOLD_WEI } from '@/lib/contracts';
import { V4_FACTORY_ABI, V4_CURVE_ABI } from '@/lib/v4-abi';
import { ExternalLink, Globe, Twitter, Send, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import NotFound from './not-found';

interface ApiV4Token {
  address: string;
  curveAddress: string;
  creator: string;
  name: string;
  symbol: string;
  metadataURI: string | null;
  deployedAt: number;
  graduated: number;
  cancelled: number;
  v2Pair: string | null;
  realEth: string;
  tokensSold: string;
  ethUsdPrice8: string;
  virtualEthReserve: string;
}

interface ApiV4Trade {
  id: number;
  trader: string;
  type: 'buy' | 'sell';
  ethAmount: string;
  tokenAmount: string;
  txHash: string;
  timestamp: number;
}

interface ApiV4Holder {
  address: string;
  balance: string;
  pct: number;
}

const ETHERSCAN = 'https://etherscan.io';
const TOTAL_SUPPLY = 1_000_000_000;
const CURVE_TOKENS = 800_000_000;

function shortAddr(a: string | null | undefined): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function bnToEth(s: string | undefined | null): number {
  if (!s) return 0;
  try { return Number(BigInt(s)) / 1e18; } catch { return 0; }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

/** Format very small USD prices using subscript zeros (e.g. $0.0₅2143). */
function fmtUsdPrice(v: number): string {
  if (v >= 1) return `$${v.toFixed(4)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  if (v <= 0) return '$0.00';
  const s = v.toExponential(); // e.g. "2.143e-9"
  const m = /^(\d)(?:\.(\d+))?e-(\d+)$/.exec(s);
  if (!m) return `$${v.toFixed(8)}`;
  const intPart = m[1];
  const frac = m[2] ?? '';
  const exp = parseInt(m[3], 10);
  const zeros = exp - 1; // leading zeros after the decimal point
  const subDigits: Record<string, string> = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
  const zerosStr = zeros.toString().split('').map((d) => subDigits[d] ?? d).join('');
  const sigFigs = (intPart + frac).slice(0, 4);
  return `$0.0${zerosStr}${sigFigs}`;
}

export default function V4TokenDetailPage() {
  const params = useParams<{ address: string }>();
  const tokenAddress = (params.address?.toLowerCase() ?? '') as `0x${string}`;
  const [token, setToken] = useState<ApiV4Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [trades, setTrades] = useState<ApiV4Trade[]>([]);
  const [holders, setHolders] = useState<ApiV4Holder[]>([]);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'trades' | 'holders'>('trades');

  // Fetch token record from API.
  // Indexer takes up to ~30s to pick up a fresh deploy, so we keep polling on
  // 404 for a grace period instead of flashing NotFound immediately.
  useEffect(() => {
    let cancelled = false;
    if (!/^0x[0-9a-f]{40}$/.test(tokenAddress)) { setNotFound(true); setLoading(false); return; }
    const startedAt = Date.now();
    const NOT_FOUND_GRACE_MS = 90_000; // give the indexer a couple of cycles
    const fetchToken = async () => {
      try {
        const base = (import.meta as any).env?.BASE_URL || '/';
        const url = `${base}api/v4/tokens/${tokenAddress}`.replace(/\/+/g, '/');
        const res = await fetch(url);
        if (res.status === 404) {
          if (cancelled) return;
          // Only declare NotFound after the grace period — fresh deploys may
          // not be indexed yet.
          if (Date.now() - startedAt > NOT_FOUND_GRACE_MS) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) { setToken(data); setLoading(false); setNotFound(false); }
      } catch {
        if (!cancelled) {
          // Network errors: keep retrying via the interval; do not flash NotFound.
        }
      }
    };
    void fetchToken();
    const id = setInterval(fetchToken, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [tokenAddress]);

  // Fetch trades
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchTrades = async () => {
      try {
        const base = (import.meta as any).env?.BASE_URL || '/';
        const url = `${base}api/v4/trades?tokenAddress=${tokenAddress}&limit=200`.replace(/\/+/g, '/');
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTrades(data.trades ?? []);
      } catch {}
    };
    void fetchTrades();
    const id = setInterval(fetchTrades, 6000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, tokenAddress]);

  // Fetch holders (lazy: only when Holders tab opens; refresh every 30s while active)
  useEffect(() => {
    if (!token || activeTab !== 'holders') return;
    let cancelled = false;
    const fetchHolders = async () => {
      try {
        setHoldersLoading(true);
        const base = (import.meta as any).env?.BASE_URL || '/';
        const url = `${base}api/v4/tokens/${tokenAddress}/holders?limit=100`.replace(/\/+/g, '/');
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setHolders(data.holders ?? []);
      } catch {}
      finally { if (!cancelled) setHoldersLoading(false); }
    };
    void fetchHolders();
    const id = setInterval(fetchHolders, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, tokenAddress, activeTab]);

  // On-chain live curve state (5s refresh)
  const { data: liveState } = useReadContract({
    address: token?.curveAddress as `0x${string}` | undefined,
    abi: V4_CURVE_ABI,
    functionName: 'getCurveState',
    chainId: 1,
    query: { enabled: !!token, refetchInterval: 5000 },
  });
  const [liveRealEth, liveTokensSold, livePrice, livePctBps, liveGraduated, liveCancelled] =
    (liveState as readonly [bigint, bigint, bigint, bigint, boolean, boolean] | undefined) ?? [];

  const { data: ethPrice } = useEthPrice();
  const meta = useTokenMetadata(tokenAddress);

  // Derived stats (prefer live values from chain, but for terminal states the
  // on-chain curve state can read back as zeros — fall back to the DB snapshot
  // so the historical bonded amount/price stay visible).
  const graduated = liveGraduated ?? (token?.graduated === 1);
  const cancelled = liveCancelled ?? (token?.cancelled === 1);
  const liveActive = !graduated && !cancelled;
  const dbRealEth = bnToEth(token?.realEth);
  const dbTokensSold = bnToEth(token?.tokensSold);
  const realEth = liveActive && liveRealEth !== undefined
    ? Number(liveRealEth) / 1e18
    : dbRealEth;
  const tokensSold = liveActive && liveTokensSold !== undefined
    ? Number(liveTokensSold) / 1e18
    : dbTokensSold;
  const virtualEth = bnToEth(token?.virtualEthReserve);
  const remaining = Math.max(CURVE_TOKENS - tokensSold, 1);
  const priceEthPerToken = liveActive && livePrice !== undefined && livePrice > 0n
    ? Number(livePrice) / 1e18
    : (virtualEth + realEth) / remaining;
  const marketCapEth = priceEthPerToken * TOTAL_SUPPLY;
  const marketCapUsd = ethPrice ? marketCapEth * ethPrice : null;
  const priceUsd = ethPrice ? priceEthPerToken * ethPrice : null;
  const bondPct = liveActive && livePctBps !== undefined
    ? Number(livePctBps) / 100
    : Math.min((realEth / (Number(V4_BOND_THRESHOLD_WEI) / 1e18)) * 100, 100);

  // Convert latest trade to chart tick
  const lastTrade: LiveTradeTick | null = useMemo(() => {
    if (trades.length === 0) return null;
    const t = trades[0];
    const ethAmt = bnToEth(t.ethAmount);
    const tokAmt = bnToEth(t.tokenAmount);
    if (tokAmt === 0) return null;
    return {
      price: ethAmt / tokAmt,
      ethAmount: ethAmt,
      timestamp: t.timestamp * 1000,
    };
  }, [trades]);

  if (notFound) return <NotFound />;
  if (loading || !token) {
    // Show whatever we already have from local metadata cache (for the
    // deployer who just launched, this is image + description + socials)
    // so the screen isn't blank while the indexer catches up (~30s).
    const previewImage = ipfsToHttp(meta?.image) || null;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container max-w-2xl mx-auto px-4 py-12">
          <div className="flex flex-col items-center text-center gap-4">
            {previewImage ? (
              <img
                src={previewImage}
                alt="Token preview"
                className="w-28 h-28 rounded-2xl object-cover border border-border/50"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-muted/30 border border-border/50 animate-pulse" />
            )}
            {meta?.description && (
              <p className="text-sm text-muted-foreground max-w-md">{meta.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <p className="text-xs font-mono text-muted-foreground">
                Indexing your token… this can take 30–90 seconds.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const image = ipfsToHttp(meta?.image) || ipfsToHttp(token.metadataURI) || null;

  const copyAddr = (addr: string, label: string) => {
    navigator.clipboard.writeText(addr).then(
      () => toast.success(`${label} copied`, { description: addr }),
      () => toast.error('Copy failed'),
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center text-2xl font-black">
            {image ? (
              <img src={image} alt={token.symbol} className="w-full h-full object-cover" />
            ) : (
              token.symbol.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black truncate">{token.name}</h1>
              <span className="text-sm font-mono text-muted-foreground">{token.symbol}</span>
              <span className="text-[10px] font-bold tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 rounded px-2 py-0.5">
                ETH · BONDING CURVE
              </span>
              {graduated && (
                <span className="text-[10px] font-bold tracking-wider text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 rounded px-2 py-0.5">
                  GRADUATED
                </span>
              )}
              {cancelled && (
                <span className="text-[10px] font-bold tracking-wider text-red-300 bg-red-500/20 border border-red-500/40 rounded px-2 py-0.5">
                  CANCELLED
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="inline-flex items-center gap-1">
                <span>token</span>
                <a href={`${ETHERSCAN}/address/${token.address}`} target="_blank" rel="noreferrer" className="underline">
                  {shortAddr(token.address)}
                </a>
                <button
                  type="button"
                  onClick={() => copyAddr(token.address, 'Token address')}
                  className="p-1 -m-1 hover:text-foreground"
                  aria-label="Copy token address"
                  title="Copy token address"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </span>
              <span className="inline-flex items-center gap-1">
                <span>curve</span>
                <a href={`${ETHERSCAN}/address/${token.curveAddress}`} target="_blank" rel="noreferrer" className="underline">
                  {shortAddr(token.curveAddress)}
                </a>
                <button
                  type="button"
                  onClick={() => copyAddr(token.curveAddress, 'Curve address')}
                  className="p-1 -m-1 hover:text-foreground"
                  aria-label="Copy curve address"
                  title="Copy curve address"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </span>
              <span>creator {shortAddr(token.creator)}</span>
              <span>· {timeAgo(token.deployedAt * 1000)}</span>
            </div>
            {meta?.description && (
              <p className="mt-2 text-sm text-muted-foreground/90 line-clamp-2">{meta.description}</p>
            )}
            <div className="mt-2 flex gap-2">
              {meta?.website && (
                <a href={meta.website} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <Globe className="h-4 w-4" />
                </a>
              )}
              {meta?.twitter && (
                <a href={meta.twitter} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              {meta?.telegram && (
                <a href={meta.telegram} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <Send className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Stat label="Price" value={priceUsd ? `$${priceUsd < 0.01 ? priceUsd.toFixed(8) : priceUsd.toFixed(6)}` : `${priceEthPerToken.toExponential(2)} ETH`} />
          <Stat label="Market Cap" value={marketCapUsd ? fmtUsd(marketCapUsd) : `${marketCapEth.toFixed(3)} ETH`} />
        </div>

        {/* Bonding curve progress bar */}
        <div className="border border-border bg-card rounded-xl p-4 mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">Bonding curve progress</span>
            <span className="font-mono text-sm font-bold">{bondPct.toFixed(2)}%</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ${graduated ? 'bg-emerald-500' : 'bg-gradient-to-r from-orange-500 via-pink-500 to-emerald-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, bondPct))}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] font-mono text-muted-foreground">
            {(Number(V4_BOND_THRESHOLD_WEI) / 1e18).toFixed(2)} ETH to graduate
          </div>
        </div>

        {/* Chart + Trade widget side by side */}
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 border border-border bg-card rounded-xl p-2">
            <TVAdvancedChart
              seed={token.address}
              symbol={token.symbol}
              baseEthRaised={realEth}
              graduated={graduated}
              ethPrice={ethPrice ?? 3000}
              currentMcUsd={marketCapUsd ?? undefined}
              lastTrade={lastTrade}
              height={420}
            />
          </div>
          <div className="space-y-3">
            <V4TradeWidget
              tokenAddress={token.address as `0x${string}`}
              curveAddress={token.curveAddress as `0x${string}`}
              graduated={graduated}
              cancelled={cancelled}
            />
          </div>
        </div>

        {/* Tabs: Trades / Holders */}
        <div className="border border-border bg-card rounded-xl p-4">
          <div className="flex items-center gap-1 border-b border-border/40 mb-3 -mx-4 px-4">
            <button
              type="button"
              onClick={() => setActiveTab('trades')}
              className={`px-3 py-2 text-xs font-bold tracking-wide border-b-2 -mb-px transition-colors ${
                activeTab === 'trades'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              RECENT TRADES
              <span className="ml-1.5 text-[10px] font-mono text-muted-foreground/70">
                ({trades.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('holders')}
              className={`px-3 py-2 text-xs font-bold tracking-wide border-b-2 -mb-px transition-colors ${
                activeTab === 'holders'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              HOLDERS
              {holders.length > 0 && (
                <span className="ml-1.5 text-[10px] font-mono text-muted-foreground/70">
                  ({holders.length})
                </span>
              )}
            </button>
          </div>

          {activeTab === 'trades' && (
            trades.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">No trades yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead className="text-muted-foreground border-b border-border/40">
                    <tr>
                      <th className="text-left py-1.5">Type</th>
                      <th className="text-left">Trader</th>
                      <th className="text-right">ETH</th>
                      <th className="text-right">Tokens</th>
                      <th className="text-right">Time</th>
                      <th className="text-right">Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.slice(0, 50).map((t) => {
                      const ethAmt = bnToEth(t.ethAmount);
                      const tokAmt = bnToEth(t.tokenAmount);
                      return (
                        <tr key={t.id} className="border-b border-border/20">
                          <td className={`py-1.5 ${t.type === 'buy' ? 'text-emerald-400' : 'text-red-400'} font-bold`}>
                            {t.type.toUpperCase()}
                          </td>
                          <td>{shortAddr(t.trader)}</td>
                          <td className="text-right">{ethAmt.toFixed(5)}</td>
                          <td className="text-right">
                            {tokAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="text-right text-muted-foreground">{timeAgo(t.timestamp * 1000)}</td>
                          <td className="text-right">
                            <a href={`${ETHERSCAN}/tx/${t.txHash}`} target="_blank" rel="noreferrer" className="text-blue-400 underline">
                              view
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'holders' && (
            holdersLoading && holders.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">Loading holders…</p>
            ) : holders.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">No holders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead className="text-muted-foreground border-b border-border/40">
                    <tr>
                      <th className="text-left py-1.5 w-10">#</th>
                      <th className="text-left">Address</th>
                      <th className="text-right">Balance</th>
                      <th className="text-right w-24">Share</th>
                      <th className="text-right w-16">Tag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holders.map((h, i) => {
                      const bal = bnToEth(h.balance);
                      const isCurve = token.curveAddress && h.address.toLowerCase() === token.curveAddress.toLowerCase();
                      const isPair = token.v2Pair && h.address.toLowerCase() === token.v2Pair.toLowerCase();
                      const isCreator = h.address.toLowerCase() === token.creator.toLowerCase();
                      const tag = isCurve ? 'curve' : isPair ? 'LP' : isCreator ? 'dev' : '';
                      return (
                        <tr key={h.address} className="border-b border-border/20">
                          <td className="py-1.5 text-muted-foreground">{i + 1}</td>
                          <td>
                            <a
                              href={`${ETHERSCAN}/address/${h.address}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 underline"
                            >
                              {shortAddr(h.address)}
                            </a>
                          </td>
                          <td className="text-right">
                            {bal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="text-right tabular-nums">{h.pct.toFixed(2)}%</td>
                          <td className="text-right">
                            {tag && (
                              <span className={`text-[9px] font-bold tracking-wider rounded px-1.5 py-0.5 border ${
                                isCurve ? 'text-blue-300 bg-blue-500/10 border-blue-500/30'
                                : isPair ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                                : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                              }`}>
                                {tag}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-mono mb-1">
        {label}
      </div>
      <div className="text-sm font-bold tabular-nums truncate">{value}</div>
    </div>
  );
}

function BondProgress({
  pct,
  graduated,
  cancelled,
  realEth,
}: {
  pct: number;
  graduated: boolean;
  cancelled: boolean;
  realEth: number;
}) {
  const color = graduated ? 'bg-emerald-500' : cancelled ? 'bg-red-500' : 'bg-blue-500';
  return (
    <div className="border border-border bg-card rounded-xl p-3">
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground/70 font-mono mb-1.5">
        <span>Bonding progress</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={color} style={{ width: `${Math.min(pct, 100)}%`, height: '100%' }} />
      </div>
      <div className="mt-1.5 text-[11px] font-mono text-muted-foreground">
        {realEth.toFixed(4)} / 2.75 ETH bonded
      </div>
    </div>
  );
}
