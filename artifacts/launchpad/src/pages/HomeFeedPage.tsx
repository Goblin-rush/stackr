import { Navbar } from '@/components/layout/Navbar';
import { CreateTokenModal } from '@/components/token/CreateTokenModal';
import { useLaunchpadFeed, type FeedToken } from '@/hooks/use-launchpad-feed';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { TARGET_ETH } from '@/lib/contracts';
import { formatEther } from 'viem';
import { Search, X, Plus } from 'lucide-react';
import { MOCK_TOKENS, type MockToken } from '@/lib/mock-tokens';

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

function TokenRow({ token, ethPrice }: { token: FeedToken; ethPrice: number | undefined }) {
  const progress = Math.min((token.realEthRaised / TARGET_ETH_NUM) * 100, 100);
  const mcUsd = ethPrice ? token.marketCapEth * ethPrice : null;
  const priceUsd = ethPrice ? token.currentPriceEth * ethPrice : null;

  return (
    <Link href={`/token/${token.address}`}>
      <div className="grid grid-cols-12 items-center gap-3 px-3 py-2.5 border-b border-border hover:bg-secondary/40 cursor-pointer transition-colors group">
        {/* Token (3 cols) */}
        <div className="col-span-4 md:col-span-3 flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground">
              {(token.symbol || '?').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
              {token.name || 'Unnamed'}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono leading-tight">
              ${token.symbol || '???'}
              {token.graduated && <span className="ml-1.5 text-emerald-400">· DEX</span>}
            </p>
          </div>
        </div>

        {/* Price (hidden on mobile) */}
        <div className="hidden md:block col-span-2 text-right">
          <p className="text-xs font-mono tabular-nums text-foreground">
            {priceUsd ? `$${priceUsd.toFixed(priceUsd < 0.01 ? 8 : 4)}` : `${token.currentPriceEth.toExponential(2)}`}
          </p>
        </div>

        {/* Market cap */}
        <div className="col-span-3 md:col-span-2 text-right">
          <p className="text-xs font-mono tabular-nums text-foreground">
            {mcUsd ? formatUsd(mcUsd) : `${token.marketCapEth.toFixed(2)} ETH`}
          </p>
        </div>

        {/* Progress (raised + bar) */}
        <div className="col-span-3 md:col-span-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-10 text-right">
              {progress.toFixed(0)}%
            </span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {token.realEthRaised.toFixed(3)} / {TARGET_ETH_NUM} ETH
          </p>
        </div>

        {/* Age */}
        <div className="col-span-2 md:col-span-2 text-right">
          <p className="text-xs font-mono text-muted-foreground tabular-nums">
            {timeAgo(token.lastTradeMs ?? token.createdAtMs)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function MockTokenRow({ token }: { token: MockToken }) {
  const progress = Math.min((token.raised / token.target) * 100, 100);
  return (
    <Link href={`/preview/${token.slug}`}>
      <div className="grid grid-cols-12 items-center gap-3 px-3 py-2.5 border-b border-border hover:bg-secondary/40 cursor-pointer transition-colors group">
        <div className="col-span-4 md:col-span-3 flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground">
              {token.symbol.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
              {token.name}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono leading-tight">
              ${token.symbol}
              {token.graduated && <span className="ml-1.5 text-emerald-400">· DEX</span>}
            </p>
          </div>
        </div>
        <div className="hidden md:block col-span-2 text-right">
          <p className="text-xs font-mono tabular-nums text-foreground">{token.price}</p>
        </div>
        <div className="col-span-3 md:col-span-2 text-right">
          <p className="text-xs font-mono tabular-nums text-foreground">{token.mcap}</p>
        </div>
        <div className="col-span-3 md:col-span-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-10 text-right">
              {progress.toFixed(0)}%
            </span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {token.raised.toFixed(2)} / {token.target} ETH
          </p>
        </div>
        <div className="col-span-2 md:col-span-2 text-right">
          <p className="text-[10px] font-mono text-muted-foreground italic">demo</p>
        </div>
      </div>
    </Link>
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

        {/* Table header */}
        <div className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4 md:col-span-3">Token</div>
          <div className="hidden md:block col-span-2 text-right">Price</div>
          <div className="col-span-3 md:col-span-2 text-right">Mcap</div>
          <div className="col-span-3 md:col-span-3">Bonding</div>
          <div className="col-span-2 md:col-span-2 text-right">Age</div>
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
          <>
            <div className="border-b border-border">
              {MOCK_TOKENS.map((t) => (
                <MockTokenRow key={t.slug} token={t} />
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground font-mono py-3">
              Demo data shown — <button onClick={() => setIsCreateOpen(true)} className="text-primary hover:underline underline-offset-2">launch the first real token →</button>
            </p>
          </>
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
