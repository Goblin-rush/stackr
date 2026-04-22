import { Navbar } from '@/components/layout/Navbar';
import { CreateTokenModal } from '@/components/token/CreateTokenModal';
import { useLaunchpadFeed, type FeedToken } from '@/hooks/use-launchpad-feed';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { useCurveConstants } from '@/hooks/use-curve-constants';
import { Search, X, Plus, Rocket } from 'lucide-react';
import { useTokenMetadata, ipfsToHttp } from '@/lib/token-metadata';

function genAvatarUri(symbol: string): string {
  const palette = ['#c2410c','#7c3aed','#15803d','#1d4ed8','#0e7490','#b45309','#9f1239','#4d7c0f'];
  const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = palette[hash % palette.length];
  const label = symbol.slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="${color}"/><text x="20" y="27" font-family="monospace,sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

type FeedSort = 'new' | 'movers' | 'graduated' | 'mcap' | 'oldest' | 'lasttrade';

const SORT_TABS: { id: FeedSort; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'movers', label: 'Top' },
  { id: 'graduated', label: 'Graduated' },
  { id: 'mcap', label: 'Mcap' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'lasttrade', label: 'Recent' },
];

function timeAgo(ts: number | null): string {
  if (!ts) return '–';
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function sortTokens(tokens: FeedToken[], sort: FeedSort): FeedToken[] {
  const arr = [...tokens];
  switch (sort) {
    case 'new':      return arr.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || b.createdIndex - a.createdIndex);
    case 'oldest':   return arr.sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0) || a.createdIndex - b.createdIndex);
    case 'movers':   return arr.filter((t) => !t.graduated).sort((a, b) => b.realEthRaised - a.realEthRaised);
    case 'graduated':return arr.filter((t) => t.graduated).sort((a, b) => (b.lastTradeMs ?? 0) - (a.lastTradeMs ?? 0));
    case 'mcap':     return arr.sort((a, b) => b.marketCapEth - a.marketCapEth);
    case 'lasttrade':return arr.filter((t) => t.lastTradeMs).sort((a, b) => (b.lastTradeMs ?? 0) - (a.lastTradeMs ?? 0));
    default:         return arr;
  }
}

interface RowDisplay {
  href: string;
  symbol: string;
  name: string;
  image?: string;
  graduated: boolean;
  priceLabel: string;
  mcapLabel: string;
  raisedLabel: string;
  progress: number;
  ageLabel: string;
  creatorLabel: string | null;
}

function accentColor(pct: number): string {
  if (pct >= 85) return 'hsl(4 84% 58%)';
  if (pct >= 60) return 'hsl(24 90% 55%)';
  if (pct >= 30) return 'hsl(42 88% 50%)';
  return 'hsl(142 66% 44%)';
}

/* ─── Animated progress bar ───────────────────────── */
function ProgressBar({ pct, size = 'sm' }: { pct: number; size?: 'sm' | 'xs' }) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = Math.min(pct, 100);
    const duration = 800;
    const startTime = performance.now();
    function step(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = start + (end - start) * eased;
      setDisplayed(val);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else prevRef.current = end;
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [pct]);

  const h = size === 'sm' ? 'h-2' : 'h-1.5';

  function barStyle(p: number): { gradient: string; glow: string } {
    if (p >= 85) return {
      gradient: 'linear-gradient(90deg, hsl(4 84% 46%) 0%, hsl(18 92% 64%) 100%)',
      glow: '0 0 14px hsl(4 84% 58% / 0.55)',
    };
    if (p >= 60) return {
      gradient: 'linear-gradient(90deg, hsl(24 90% 46%) 0%, hsl(36 92% 60%) 100%)',
      glow: '0 0 12px hsl(24 90% 55% / 0.45)',
    };
    if (p >= 30) return {
      gradient: 'linear-gradient(90deg, hsl(42 88% 42%) 0%, hsl(48 90% 56%) 100%)',
      glow: '0 0 10px hsl(42 88% 50% / 0.40)',
    };
    return {
      gradient: 'linear-gradient(90deg, hsl(142 66% 36%) 0%, hsl(152 68% 48%) 100%)',
      glow: '0 0 10px hsl(142 66% 44% / 0.38)',
    };
  }

  const { gradient, glow } = barStyle(pct);

  return (
    <div className={`relative ${h} w-full bg-white/5 rounded-full overflow-hidden border border-white/6`}>
      <div
        className="absolute top-0 left-0 h-full rounded-full overflow-hidden"
        style={{
          width: `${displayed}%`,
          background: gradient,
          boxShadow: displayed > 3 ? glow : 'none',
          transition: 'box-shadow 0.3s ease',
        }}
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

/* ─── Standard row card ──────────────────────────── */
function Row({ d }: { d: RowDisplay }) {
  return (
    <Link href={d.href}>
      <div className="relative rounded-xl bg-card border border-border/60 mb-2.5 cursor-pointer group card-hover overflow-hidden">
        {/* Left accent bar — color follows bonding curve progress */}
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl transition-all"
          style={{ backgroundColor: accentColor(d.progress), opacity: 0.7 }}
        />

        {/* Header */}
        <div className="flex items-center border-b border-border/40 pl-3 gap-2.5">
          {d.image && (
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-border/30 bg-muted">
              <img src={d.image} alt={d.symbol} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 py-2.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[14px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{d.name}</p>
              <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{d.symbol}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
              {d.creatorLabel ? `${d.creatorLabel} · ` : ''}{d.ageLabel}
            </p>
          </div>
          {d.graduated && (
            <span className="self-center mr-3 text-[9px] font-semibold tracking-wider text-primary bg-primary/12 border border-primary/30 rounded-full px-2 py-0.5">
              DEX
            </span>
          )}
        </div>

        {/* Data row */}
        <div className="grid grid-cols-3 pl-3">
          {[
            { label: 'PRICE', value: d.priceLabel },
            { label: 'MCAP',  value: d.mcapLabel },
            { label: 'RAISED', value: d.raisedLabel },
          ].map((cell, i) => (
            <div key={cell.label} className={`px-3 py-2.5 ${i < 2 ? 'border-r border-border/40' : ''}`}>
              <div className="text-[9px] font-semibold tracking-widest text-muted-foreground/60 mb-0.5 uppercase">{cell.label}</div>
              <div className="text-[12px] font-semibold tabular-nums text-foreground/90 truncate">{cell.value}</div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="px-4 pb-3 pt-2.5 pl-4.5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] font-semibold tracking-widest text-muted-foreground/60 uppercase">Curve → DEX</span>
            <span className="text-[11px] font-semibold tabular-nums text-foreground/80">{d.progress.toFixed(0)}%</span>
          </div>
          <ProgressBar pct={d.progress} size="xs" />
        </div>
      </div>
    </Link>
  );
}

function shortAddr(a: string | null): string | null {
  if (!a) return null;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function TokenRow({ token, ethPrice }: { token: FeedToken; ethPrice: number | undefined }) {
  const { targetEth } = useCurveConstants();
  const progress = Math.min((token.realEthRaised / targetEth) * 100, 100);
  const mcUsd = ethPrice ? token.marketCapEth * ethPrice : null;
  const priceUsd = ethPrice ? token.currentPriceEth * ethPrice : null;
  const meta = useTokenMetadata(token.address);
  const image = ipfsToHttp(meta?.image) ?? genAvatarUri(token.symbol || '?');
  return (
    <Row
      d={{
        href: `/token/${token.address}`,
        symbol: token.symbol || '?',
        name: token.name || 'Unnamed',
        image,
        graduated: token.graduated,
        priceLabel: priceUsd
          ? `$${priceUsd.toFixed(priceUsd < 0.01 ? 8 : 4)}`
          : token.currentPriceEth.toExponential(2),
        mcapLabel: mcUsd ? formatUsd(mcUsd) : `${token.marketCapEth.toFixed(2)} ETH`,
        raisedLabel: `${token.realEthRaised.toFixed(3)} / ${targetEth} ETH`,
        progress,
        ageLabel: timeAgo(token.lastTradeMs ?? token.createdAtMs),
        creatorLabel: shortAddr(token.creator),
      }}
    />
  );
}

/* ─── Page ───────────────────────────────────────── */
export default function HomeFeedPage() {
  const { tokens, isLoading } = useLaunchpadFeed(200);
  const { data: ethPrice } = useEthPrice();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sort, setSort] = useState<FeedSort>('new');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let list = sortTokens(tokens, sort);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(q) ||
          t.symbol?.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tokens, sort, query]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onCreate={() => setIsCreateOpen(true)} />

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6 md:px-8">

        {/* Search + sort + new token */}
        <div className="flex flex-col gap-2.5 mb-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 text-[12px] font-semibold bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-all glow-primary shrink-0"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span className="hidden sm:inline">New Token</span>
              <span className="sm:hidden">New</span>
            </button>
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tokens…"
                className="w-full pl-9 pr-8 py-2.5 bg-white/5 border border-border/60 rounded-lg text-[12px] font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:bg-white/7 transition-all"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground/60 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center bg-white/4 border border-border/50 rounded-lg overflow-hidden self-start">
            {SORT_TABS.map((t) => {
              const active = sort === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSort(t.id)}
                  className={`text-[11px] font-medium px-3.5 py-2 whitespace-nowrap transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/6'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Token list */}
        {isLoading ? (
          <div className="space-y-2.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-card/60 border border-border/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div>
            {filtered.map((token) => (
              <TokenRow key={token.address} token={token} ethPrice={ethPrice} />
            ))}
          </div>
        ) : tokens.length === 0 && !query.trim() ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-base font-bold mb-2">No tokens launched yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
              Be the first to launch a token on Base mainnet via the bonding curve.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 text-[13px] font-bold bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-all glow-primary"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Launch First Token
            </button>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground font-mono">No matches for "{query}"</p>
          </div>
        )}

      </main>

      <CreateTokenModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
