import { Navbar } from '@/components/layout/Navbar';
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
  { id: 'movers', label: 'Movers' },
  { id: 'graduated', label: 'Graduated' },
  { id: 'mcap', label: 'Market cap' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'lasttrade', label: 'Last trade' },
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

function Row({ d }: { d: RowDisplay }) {
  return (
    <Link href={d.href}>
      <div className="px-4 py-4 border-b border-border hover:bg-secondary/40 cursor-pointer transition-colors group">
        {/* Mobile: stacked layout */}
        <div className="md:hidden flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] font-bold text-muted-foreground">
              {d.symbol.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {d.name}
              </p>
              <p className="text-sm font-mono tabular-nums text-foreground shrink-0">{d.mcapLabel}</p>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1.5">
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                ${d.symbol}
                {d.graduated && <span className="ml-2 text-emerald-400">· DEX</span>}
                {d.isDemo && <span className="ml-2 italic">· demo</span>}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                {d.ageLabel}
              </p>
            </div>
            {d.creatorLabel && (
              <p className="text-[10px] text-muted-foreground/70 font-mono mt-1 truncate">
                by {d.creatorLabel}
              </p>
            )}
            <div className="flex items-center gap-2.5 mt-3">
              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${d.progress}%` }} />
              </div>
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-9 text-right">
                {d.progress.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Desktop: table grid */}
        <div className="hidden md:grid grid-cols-12 items-center gap-4">
          <div className="col-span-3 flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground">
                {d.symbol.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                {d.name}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono leading-tight mt-0.5 truncate">
                ${d.symbol}
                {d.graduated && <span className="ml-1.5 text-emerald-400">· DEX</span>}
                {d.creatorLabel && (
                  <span className="ml-1.5 opacity-60">· by {d.creatorLabel}</span>
                )}
              </p>
            </div>
          </div>
          <div className="col-span-2 text-right">
            <p className="text-xs font-mono tabular-nums text-foreground">{d.priceLabel}</p>
          </div>
          <div className="col-span-2 text-right">
            <p className="text-xs font-mono tabular-nums text-foreground">{d.mcapLabel}</p>
          </div>
          <div className="col-span-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${d.progress}%` }} />
              </div>
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-10 text-right">
                {d.progress.toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{d.raisedLabel}</p>
          </div>
          <div className="col-span-2 text-right">
            <p className="text-xs font-mono text-muted-foreground tabular-nums">
              {d.isDemo ? <span className="italic">demo</span> : d.ageLabel}
            </p>
          </div>
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

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-4 md:px-8">
        {/* Single control strip: search + create + tabs */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
          <div className="flex items-center gap-2 md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, symbol, address…"
                className="w-full pl-8 pr-8 py-1.5 bg-card border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
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
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3 w-3" />
              Create
            </button>
          </div>

          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-1">
            {SORT_TABS.map((t) => {
              const active = sort === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSort(t.id)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                    active
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table header (desktop only) */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <div className="col-span-3">Token</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">Mcap</div>
          <div className="col-span-3">Bonding</div>
          <div className="col-span-2 text-right">Age</div>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="divide-y divide-border">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-card/30 animate-pulse" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="border-b border-border">
            {filtered.map((token) => (
              <TokenRow key={token.address} token={token} ethPrice={ethPrice} />
            ))}
          </div>
        ) : tokens.length === 0 && !query.trim() ? (
          <div className="text-center py-20 border-b border-border">
            <p className="text-sm text-foreground font-mono mb-2">No tokens launched yet</p>
            <p className="text-xs text-muted-foreground font-mono mb-4">Be the first to deploy on Aethpad</p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Launch the first token
            </button>
          </div>
        ) : (
          <div className="text-center py-20 border-b border-border">
            <p className="text-xs text-muted-foreground font-mono">
              No tokens match "{query}"
            </p>
          </div>
        )}

        {/* Footer count */}
        {!isLoading && filtered.length > 0 && (
          <p className="text-[10px] font-mono text-muted-foreground text-right mt-2">
            {filtered.length} of {tokens.length}
          </p>
        )}
      </main>

      <CreateTokenModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
