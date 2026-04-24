import { Navbar } from '@/components/layout/Navbar';
import { CreateTokenModal } from '@/components/token/CreateTokenModal';
import { useLaunchpadFeed, type FeedToken } from '@/hooks/use-launchpad-feed';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useState, useMemo, useRef } from 'react';
import { Link } from 'wouter';
import { Search, X, Plus, Rocket } from 'lucide-react';
import { useTokenMetadata, ipfsToHttp, ipfsNextGateway } from '@/lib/token-metadata';

function ImgWithFallback({ src, alt, fallback, className }: { src: string; alt: string; fallback: string; className?: string }) {
  const [cur, setCur] = useState(src);
  const triedRef = useRef(false);
  return (
    <img
      src={cur}
      alt={alt}
      className={className}
      onError={() => {
        if (!triedRef.current) {
          const next = ipfsNextGateway(cur);
          if (next) { triedRef.current = true; setCur(next); return; }
        }
        setCur(fallback);
      }}
    />
  );
}

function genAvatarUri(symbol: string): string {
  const palette = ['#c2410c','#7c3aed','#15803d','#1d4ed8','#0e7490','#b45309','#9f1239','#4d7c0f'];
  const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = palette[hash % palette.length];
  const label = symbol.slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="${color}"/><text x="20" y="27" font-family="monospace,sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

type FeedSort = 'new' | 'mcap' | 'oldest' | 'lasttrade';

const SORT_TABS: { id: FeedSort; label: string }[] = [
  { id: 'new',       label: 'New'    },
  { id: 'lasttrade', label: 'Recent' },
  { id: 'mcap',      label: 'Mcap'   },
  { id: 'oldest',    label: 'Oldest' },
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
    case 'new':       return arr.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || b.createdIndex - a.createdIndex);
    case 'oldest':    return arr.sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0) || a.createdIndex - b.createdIndex);
    case 'mcap':      return arr.sort((a, b) => b.marketCapEth - a.marketCapEth);
    case 'lasttrade': return arr.filter((t) => t.lastTradeMs).sort((a, b) => (b.lastTradeMs ?? 0) - (a.lastTradeMs ?? 0));
    default:          return arr;
  }
}

interface RowDisplay {
  href: string;
  symbol: string;
  name: string;
  image?: string;
  priceLabel: string;
  mcapLabel: string;
  tradeLabel: string;
  ageLabel: string;
  creatorLabel: string | null;
  chainLabel: string;
}

function Row({ d }: { d: RowDisplay }) {
  return (
    <Link href={d.href}>
      <div className="relative rounded-xl bg-card border border-border/60 mb-2.5 cursor-pointer group card-hover overflow-hidden">
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl bg-primary opacity-40" />

        {/* Header */}
        <div className="flex items-center border-b border-border/40 pl-3 gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-border/30 bg-muted flex items-center justify-center">
            <ImgWithFallback
              src={d.image || genAvatarUri(d.symbol)}
              alt={d.symbol}
              fallback={genAvatarUri(d.symbol)}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 py-2.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[14px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{d.name}</p>
              <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{d.symbol}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
              {d.creatorLabel ? `${d.creatorLabel} · ` : ''}{d.ageLabel}
            </p>
          </div>
          <span className="self-center mr-3 text-[9px] font-semibold tracking-wider text-primary bg-primary/12 border border-primary/30 rounded-full px-2 py-0.5 whitespace-nowrap">
            {d.chainLabel}
          </span>
        </div>

        {/* Data row */}
        <div className="grid grid-cols-3 pl-3">
          {[
            { label: 'PRICE',      value: d.priceLabel  },
            { label: 'MCAP',       value: d.mcapLabel   },
            { label: 'LAST TRADE', value: d.tradeLabel  },
          ].map((cell, i) => (
            <div key={cell.label} className={`px-3 py-2.5 ${i < 2 ? 'border-r border-border/40' : ''}`}>
              <div className="text-[9px] font-semibold tracking-widest text-muted-foreground/60 mb-0.5 uppercase">{cell.label}</div>
              <div className="text-[12px] font-semibold tabular-nums text-foreground/90 truncate">{cell.value}</div>
            </div>
          ))}
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
        priceLabel: priceUsd
          ? `$${priceUsd < 0.01 ? priceUsd.toFixed(8) : priceUsd.toFixed(4)}`
          : token.currentPriceEth > 0
          ? `${token.currentPriceEth.toExponential(2)} ETH`
          : '—',
        mcapLabel: mcUsd ? formatUsd(mcUsd) : token.marketCapEth > 0 ? `${token.marketCapEth.toFixed(2)} ETH` : '—',
        tradeLabel: token.lastTradeMs ? timeAgo(token.lastTradeMs) : '—',
        ageLabel: timeAgo(token.createdAtMs),
        creatorLabel: shortAddr(token.creator),
        chainLabel: token.chainId === 1 ? 'ETH · V4' : 'BASE · V4',
      }}
    />
  );
}

/* ─── Page ───────────────────────────────────────── */
export default function HomeFeedPage() {
  // Always fetch from BOTH chains regardless of wallet connection
  const baseFeed = useLaunchpadFeed(200, 8453);
  const ethFeed  = useLaunchpadFeed(200, 1);
  const tokens   = useMemo(() => [...baseFeed.tokens, ...ethFeed.tokens], [baseFeed.tokens, ethFeed.tokens]);
  const isLoading = baseFeed.isLoading || ethFeed.isLoading;
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
              <div key={i} className="h-24 bg-card/60 border border-border/40 rounded-xl animate-pulse" />
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
              Be the first to launch a token on Base mainnet via Uniswap V4.
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
