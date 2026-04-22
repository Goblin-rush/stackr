import { Navbar } from '@/components/layout/Navbar';
import { CreateTokenModal } from '@/components/token/CreateTokenModal';
import { useLaunchpadFeed, type FeedToken } from '@/hooks/use-launchpad-feed';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { TARGET_ETH } from '@/lib/contracts';
import { formatEther } from 'viem';
import { Search, X, Plus, Flame, TrendingUp } from 'lucide-react';

type FeedSort = 'new' | 'movers' | 'graduated' | 'mcap' | 'oldest' | 'lasttrade';

const SORT_TABS: { id: FeedSort; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'movers', label: 'Top' },
  { id: 'graduated', label: 'Graduated' },
  { id: 'mcap', label: 'Mcap' },
  { id: 'oldest', label: 'Old' },
  { id: 'lasttrade', label: 'Recent' },
];

const TARGET_ETH_NUM = Number(formatEther(TARGET_ETH));

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
  graduated: boolean;
  priceLabel: string;
  mcapLabel: string;
  raisedLabel: string;
  progress: number;
  ageLabel: string;
  creatorLabel: string | null;
  isDemo?: boolean;
}

const DEMO_ROWS: RowDisplay[] = [
  { href: '/demo/STR',   symbol: 'STR',   name: 'Asteroid Shiba',  graduated: false, priceLabel: '$0.0000142',  mcapLabel: '$24.3K',  raisedLabel: '1.84 / 3.5 ETH', progress: 53,  ageLabel: '2h ago',   creatorLabel: '0x9f…21Ab', isDemo: true },
  { href: '/demo/BNK',   symbol: 'BNK',   name: 'Bonkers',         graduated: true,  priceLabel: '$0.0001231',  mcapLabel: '$148K',   raisedLabel: '3.5 / 3.5 ETH',  progress: 100, ageLabel: '6d ago',   creatorLabel: '0x33…be12', isDemo: true },
  { href: '/demo/PEPE',  symbol: 'PEPE',  name: 'Memetics Lab',    graduated: false, priceLabel: '$0.00000091', mcapLabel: '$3.1K',   raisedLabel: '0.42 / 3.5 ETH', progress: 12,  ageLabel: '11m ago',  creatorLabel: '0xf2…00cc', isDemo: true },
  { href: '/demo/BASED', symbol: 'BASED', name: 'Based God Coin',  graduated: false, priceLabel: '$0.0000087',  mcapLabel: '$14.7K',  raisedLabel: '1.12 / 3.5 ETH', progress: 32,  ageLabel: '4h ago',   creatorLabel: '0xab…77f1', isDemo: true },
  { href: '/demo/BLU',   symbol: 'BLU',   name: 'Blue Chip Inu',   graduated: false, priceLabel: '$0.000003',   mcapLabel: '$8.2K',   raisedLabel: '0.71 / 3.5 ETH', progress: 20,  ageLabel: '38m ago',  creatorLabel: '0x7d…1144', isDemo: true },
];

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

/* ─── Activity ticker ────────────────────────────── */
const DEMO_TICKER = [
  { sym: 'STR',   type: 'buy'  as const, eth: '0.041' },
  { sym: 'BNK',   type: 'sell' as const, eth: '0.812' },
  { sym: 'PEPE',  type: 'buy'  as const, eth: '0.012' },
  { sym: 'BASED', type: 'buy'  as const, eth: '0.025' },
  { sym: 'STR',   type: 'buy'  as const, eth: '0.087' },
  { sym: 'BLU',   type: 'buy'  as const, eth: '0.018' },
  { sym: 'BNK',   type: 'buy'  as const, eth: '1.250' },
  { sym: 'STR',   type: 'sell' as const, eth: '0.022' },
  { sym: 'PEPE',  type: 'buy'  as const, eth: '0.055' },
  { sym: 'BASED', type: 'sell' as const, eth: '0.011' },
];

function ActivityTicker() {
  const items = [...DEMO_TICKER, ...DEMO_TICKER];
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 mb-4 overflow-hidden">
      <div className="flex items-center">
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-2 text-[10px] font-semibold uppercase tracking-widest shrink-0 border-r border-border/60">
          <span className="h-1.5 w-1.5 bg-primary rounded-full dot-live" />
          Live
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-6 py-2 px-3 whitespace-nowrap animate-[ticker_40s_linear_infinite]">
            {items.map((t, i) => (
              <span key={i} className="text-[11px] font-mono tabular-nums flex items-center gap-1.5">
                <span className={`font-semibold text-[10px] uppercase tracking-wider ${t.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.type}
                </span>
                <span className="text-foreground font-semibold">${t.sym}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-foreground/80">{t.eth} ETH</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Featured card ──────────────────────────────── */
function FeaturedRow({ d }: { d: RowDisplay }) {
  return (
    <Link href={d.href}>
      <div className="relative rounded-xl border border-primary/30 bg-gradient-to-br from-primary/8 via-card to-card mb-3 cursor-pointer group card-hover overflow-hidden">
        {/* Top badge */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <Flame className="h-3 w-3" />
            Top Mover · 24h
          </span>
          <span className="text-[11px] font-semibold text-emerald-400 tabular-nums">+18.4%</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5">
          {/* Big ticker */}
          <div className="md:col-span-2 border-b md:border-b-0 md:border-r border-border/60 px-5 py-5 flex flex-col justify-center">
            <div className="text-5xl md:text-6xl font-black tracking-tighter leading-none text-gradient">
              ${d.symbol}
            </div>
            <div className="text-sm font-semibold text-foreground/90 mt-2">{d.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono mt-1">
              {d.creatorLabel ? `by ${d.creatorLabel} · ` : ''}{d.ageLabel}
            </div>
          </div>

          {/* Stats */}
          <div className="md:col-span-3 grid grid-cols-2 md:grid-rows-2">
            {[
              { label: 'PRICE', value: d.priceLabel },
              { label: 'MCAP',  value: d.mcapLabel },
              { label: 'RAISED', value: d.raisedLabel },
              { label: 'CURVE', value: `${d.progress}%`, big: true },
            ].map((cell, i) => (
              <div
                key={cell.label}
                className={`px-4 py-3 ${i < 2 ? 'border-b border-border/60' : ''} ${i % 2 === 0 ? 'border-r border-border/60' : ''}`}
              >
                <div className="text-[9px] font-semibold tracking-widest text-muted-foreground/70 mb-1 uppercase">{cell.label}</div>
                <div className={`font-bold tabular-nums text-foreground ${cell.big ? 'text-3xl text-gradient' : 'text-sm'}`}>
                  {cell.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border/60">
          <ProgressBar pct={d.progress} size="sm" />
        </div>
      </div>
    </Link>
  );
}

/* ─── Standard row card ──────────────────────────── */
function Row({ d }: { d: RowDisplay }) {
  return (
    <Link href={d.href}>
      <div className="relative rounded-xl bg-card border border-border/60 mb-2.5 cursor-pointer group card-hover overflow-hidden">
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/40 group-hover:bg-primary transition-colors rounded-l-xl" />

        {/* Header */}
        <div className="flex items-center border-b border-border/40 pl-3">
          <div className="flex-1 px-3 py-2.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[14px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{d.name}</p>
              <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{d.symbol}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
              {d.creatorLabel ? `${d.creatorLabel} · ` : ''}{d.ageLabel}
              {d.isDemo && <span className="opacity-40"> · demo</span>}
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
  const progress = Math.min((token.realEthRaised / TARGET_ETH_NUM) * 100, 100);
  const mcUsd = ethPrice ? token.marketCapEth * ethPrice : null;
  const priceUsd = ethPrice ? token.currentPriceEth * ethPrice : null;
  return (
    <Row
      d={{
        href: `/token/${token.address}`,
        symbol: token.symbol || '?',
        name: token.name || 'Unnamed',
        graduated: token.graduated,
        priceLabel: priceUsd
          ? `$${priceUsd.toFixed(priceUsd < 0.01 ? 8 : 4)}`
          : token.currentPriceEth.toExponential(2),
        mcapLabel: mcUsd ? formatUsd(mcUsd) : `${token.marketCapEth.toFixed(2)} ETH`,
        raisedLabel: `${token.realEthRaised.toFixed(3)} / ${TARGET_ETH_NUM} ETH`,
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

        {/* Page header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Base Network</p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-none">
              Token Feed
            </h1>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 text-[12px] font-semibold bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-all glow-primary"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            New Token
          </button>
        </div>

        {/* Search + sort */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5 mb-4">
          <div className="relative md:w-64">
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

          <div className="flex items-center bg-white/4 border border-border/50 rounded-lg overflow-hidden">
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
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Preview · Demo Data
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Be First
              </button>
            </div>
            <ActivityTicker />
            <FeaturedRow d={DEMO_ROWS[0]} />
            {DEMO_ROWS.slice(1).map((d) => (
              <Row key={d.symbol} d={d} />
            ))}
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
