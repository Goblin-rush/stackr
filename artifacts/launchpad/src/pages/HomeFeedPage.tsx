import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CreateTokenModal } from '@/components/token/CreateTokenModal';
import { useLaunchpadFeed, type FeedToken } from '@/hooks/use-launchpad-feed';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { TARGET_ETH } from '@/lib/contracts';
import { formatEther } from 'viem';
import { Search, X, Plus } from 'lucide-react';

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
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function sortTokens(tokens: FeedToken[], sort: FeedSort): FeedToken[] {
  const arr = [...tokens];
  switch (sort) {
    case 'new':
      return arr.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || b.createdIndex - a.createdIndex);
    case 'oldest':
      return arr.sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0) || a.createdIndex - b.createdIndex);
    case 'movers':
      return arr.filter((t) => !t.graduated).sort((a, b) => b.realEthRaised - a.realEthRaised);
    case 'graduated':
      return arr.filter((t) => t.graduated).sort((a, b) => (b.lastTradeMs ?? 0) - (a.lastTradeMs ?? 0));
    case 'mcap':
      return arr.sort((a, b) => b.marketCapEth - a.marketCapEth);
    case 'lasttrade':
      return arr.filter((t) => t.lastTradeMs).sort((a, b) => (b.lastTradeMs ?? 0) - (a.lastTradeMs ?? 0));
    default:
      return arr;
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

function ProgressBlocks({ pct }: { pct: number }) {
  const total = 16;
  const filled = Math.round((pct / 100) * total);
  return (
    <div className="flex gap-[2px] h-2.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`flex-1 border ${
            i < filled ? 'bg-primary border-primary' : 'border-border bg-transparent'
          }`}
        />
      ))}
    </div>
  );
}

function Row({ d }: { d: RowDisplay }) {
  return (
    <Link href={d.href}>
      <div className="relative bg-card border-2 border-border mb-3 cursor-pointer group hover:border-primary transition-colors">
        {/* vermillion side stripe */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />

        {/* HEADER: ticker stamp + name + graduated chip */}
        <div className="flex items-stretch border-b-2 border-border">
          <div className="border-r-2 border-border px-3 md:px-4 py-2.5 pl-4 md:pl-5 flex items-center min-w-[80px] md:min-w-[100px]">
            <span className="text-base md:text-xl font-black tracking-tighter leading-none text-foreground">
              ${d.symbol.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 px-3 py-2 flex flex-col justify-center min-w-0">
            <p className="text-sm font-bold text-foreground truncate leading-tight">
              {d.name}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
              {d.creatorLabel ? `by ${d.creatorLabel} · ` : ''}{d.ageLabel} ago
              {d.isDemo && ' · demo'}
            </p>
          </div>
          {d.graduated && (
            <div className="self-center mr-3 border-2 border-primary text-primary px-1.5 py-0.5 text-[9px] font-black tracking-widest leading-none">
              ON DEX
            </div>
          )}
        </div>

        {/* DATA ROW: price · mcap · raised */}
        <div className="grid grid-cols-3 border-b-2 border-border">
          {[
            { label: 'PRICE', value: d.priceLabel },
            { label: 'MCAP', value: d.mcapLabel },
            { label: 'RAISED', value: d.raisedLabel.replace(' ETH', '') + ' ETH' },
          ].map((cell, i) => (
            <div
              key={cell.label}
              className={`px-3 py-2 ${i < 2 ? 'border-r-2 border-border' : ''}`}
            >
              <div className="text-[8.5px] font-black tracking-widest text-muted-foreground mb-0.5">
                {cell.label}
              </div>
              <div className="text-xs font-bold tabular-nums text-foreground truncate">
                {cell.value}
              </div>
            </div>
          ))}
        </div>

        {/* PROGRESS */}
        <div className="px-3 py-2.5">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[8.5px] font-black tracking-widest text-muted-foreground">
              CURVE → DEX
            </span>
            <span className="text-[11px] font-black tabular-nums text-foreground">
              {d.progress.toFixed(0)}%
            </span>
          </div>
          <ProgressBlocks pct={d.progress} />
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

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-5 md:px-8">
        {/* Header: title + actions */}
        <div className="flex items-end justify-between mb-4 border-b-2 border-border pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              BASE
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground leading-none mt-1">
              Tokens
            </h1>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest bg-primary text-primary-foreground px-3 py-2 hover:bg-primary/85 transition-colors whitespace-nowrap border-2 border-primary"
          >
            <Plus className="h-3 w-3" strokeWidth={3} />
            New token
          </button>
        </div>

        {/* Search + sort tabs */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
          <div className="relative md:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search…"
              className="w-full pl-8 pr-8 py-2 bg-card border-2 border-border text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none flex-1 border-2 border-border md:ml-2">
            {SORT_TABS.map((t, i) => {
              const active = sort === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSort(t.id)}
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 whitespace-nowrap transition-colors ${
                    i > 0 ? 'border-l-2 border-border' : ''
                  } ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-card border-2 border-border animate-pulse" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div>
            {filtered.map((token) => (
              <TokenRow key={token.address} token={token} ethPrice={ethPrice} />
            ))}
          </div>
        ) : tokens.length === 0 && !query.trim() ? (
          <div className="text-center py-20 border-b border-border">
            <p className="text-sm font-bold text-foreground mb-2">No tokens yet.</p>
            <p className="text-xs text-muted-foreground font-mono mb-5">Be first.</p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest bg-primary text-primary-foreground px-4 py-2.5 hover:bg-primary/85 transition-colors border-2 border-primary"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
              Deploy
            </button>
          </div>
        ) : (
          <div className="text-center py-20 border-b border-border">
            <p className="text-xs text-muted-foreground font-mono">
              No matches for "{query}".
            </p>
          </div>
        )}

      </main>

      <Footer />
      <CreateTokenModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
