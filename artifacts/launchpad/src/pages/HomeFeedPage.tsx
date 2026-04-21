import { Navbar } from '@/components/layout/Navbar';
import { CreateTokenModal } from '@/components/token/CreateTokenModal';
import { useLaunchpadFeed, type FeedToken } from '@/hooks/use-launchpad-feed';
import { useEthPrice } from '@/hooks/use-eth-price';
import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { MOCK_TOKENS, type MockToken } from '@/lib/mock-tokens';
import { TARGET_ETH } from '@/lib/contracts';
import { formatEther } from 'viem';
import { Search, Plus, Sparkles, Flame, GraduationCap, BarChart3, Clock, Activity } from 'lucide-react';

type FeedSort = 'new' | 'movers' | 'graduated' | 'mcap' | 'oldest' | 'lasttrade';

const SORT_TABS: { id: FeedSort; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'new', label: 'New', icon: Sparkles },
  { id: 'movers', label: 'Movers', icon: Flame },
  { id: 'graduated', label: 'Graduated', icon: GraduationCap },
  { id: 'mcap', label: 'Market cap', icon: BarChart3 },
  { id: 'oldest', label: 'Oldest', icon: Clock },
  { id: 'lasttrade', label: 'Last trade', icon: Activity },
];

const TARGET_ETH_NUM = Number(formatEther(TARGET_ETH));

const AVATAR_COLORS = [
  'bg-orange-500', 'bg-sky-500', 'bg-emerald-500', 'bg-pink-500',
  'bg-yellow-500', 'bg-violet-500', 'bg-red-500', 'bg-cyan-500',
];

function avatarColor(addr: string) {
  const n = parseInt(addr.slice(2, 4), 16);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function timeAgo(ts: number | null): string {
  if (!ts) return '–';
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function FeedCard({ token, ethPrice }: { token: FeedToken; ethPrice: number | undefined }) {
  const progress = Math.min((token.realEthRaised / TARGET_ETH_NUM) * 100, 100);
  const mcUsd = ethPrice ? token.marketCapEth * ethPrice : null;

  return (
    <Link href={`/token/${token.address}`}>
      <div className="group bg-card/80 backdrop-blur border border-border rounded-lg p-4 cursor-pointer hover:border-primary/40 hover:bg-card transition-all flex flex-col gap-3 h-full hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-md ${avatarColor(token.address)} flex items-center justify-center shrink-0 ring-1 ring-white/10`}>
            <span className="text-white font-black text-sm leading-none">
              {(token.symbol || '?').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {token.name || 'Unnamed'}
              </p>
              {token.graduated ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded shrink-0 uppercase tracking-wider">
                  DEX
                </span>
              ) : (
                <span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded shrink-0 uppercase tracking-wider flex items-center gap-1">
                  <span className="h-1 w-1 bg-amber-400 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">${token.symbol || '???'}</p>
          </div>
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{token.realEthRaised.toFixed(3)} ETH</span>
            <span className="text-primary font-medium tabular-nums">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-end text-xs border-t border-border pt-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">MCap</p>
            <p className="text-foreground font-mono tabular-nums text-xs">
              {mcUsd
                ? mcUsd > 1_000_000
                  ? `$${(mcUsd / 1_000_000).toFixed(2)}M`
                  : mcUsd > 1000
                  ? `$${(mcUsd / 1000).toFixed(1)}K`
                  : `$${mcUsd.toFixed(0)}`
                : `${token.marketCapEth.toFixed(2)} ETH`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {token.lastTradeMs ? 'Last trade' : 'Created'}
            </p>
            <p className="text-muted-foreground font-mono text-xs">
              {timeAgo(token.lastTradeMs ?? token.createdAtMs)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MockCard({ token }: { token: MockToken }) {
  const progress = Math.min((token.raised / token.target) * 100, 100);
  return (
    <Link href={`/preview/${token.slug}`}>
      <div className="bg-card/80 backdrop-blur border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors cursor-pointer h-full">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 font-black text-sm text-white" style={{ background: token.avatarColor }}>
            {token.symbol.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-sm text-foreground truncate">{token.name}</p>
              {'graduated' in token && token.graduated && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded shrink-0">DEX</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">${token.symbol}</p>
            {token.description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{token.description}</p>
            )}
          </div>
        </div>
        <div className="mt-auto space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{token.raised.toFixed(2)} ETH</span>
            <span className="text-primary font-medium">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex justify-between text-xs border-t border-border pt-2">
          <span className="text-muted-foreground">MCap: <span className="text-foreground font-mono">{token.mcap}</span></span>
          <span className="text-muted-foreground font-mono">{token.price}</span>
        </div>
      </div>
    </Link>
  );
}

function sortTokens(tokens: FeedToken[], sort: FeedSort): FeedToken[] {
  const arr = [...tokens];
  switch (sort) {
    case 'new':
      return arr.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || b.createdIndex - a.createdIndex);
    case 'oldest':
      return arr.sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0) || a.createdIndex - b.createdIndex);
    case 'movers':
      // active bonding only, by raised desc
      return arr
        .filter((t) => !t.graduated)
        .sort((a, b) => b.realEthRaised - a.realEthRaised);
    case 'graduated':
      return arr.filter((t) => t.graduated).sort((a, b) => (b.lastTradeMs ?? 0) - (a.lastTradeMs ?? 0));
    case 'mcap':
      return arr.sort((a, b) => b.marketCapEth - a.marketCapEth);
    case 'lasttrade':
      return arr
        .filter((t) => t.lastTradeMs)
        .sort((a, b) => (b.lastTradeMs ?? 0) - (a.lastTradeMs ?? 0));
    default:
      return arr;
  }
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

  const showMocks = !isLoading && tokens.length === 0 && !query.trim();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
              Launchpad <span className="text-primary">Terminal</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live ETH bonding-curve tokens · {tokens.length} indexed
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-bold bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 self-start md:self-auto"
          >
            <Plus className="h-3 w-3" />
            Create
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, symbol, or contract address…"
            className="w-full pl-9 pr-9 py-2.5 bg-card/60 backdrop-blur border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              clear
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-5 overflow-x-auto scrollbar-none -mx-1 px-1">
          {SORT_TABS.map((t) => {
            const Icon = t.icon;
            const active = sort === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSort(t.id)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground bg-card/40 border border-border hover:border-border/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-44 bg-card/60 animate-pulse border border-border rounded-lg" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((token) => (
              <FeedCard key={token.address} token={token} ethPrice={ethPrice} />
            ))}
          </div>
        ) : showMocks ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
              {MOCK_TOKENS.map((t) => <MockCard key={t.symbol} token={t} />)}
            </div>
            <p className="text-center text-xs text-muted-foreground py-2">
              Preview only — <button onClick={() => setIsCreateOpen(true)} className="text-primary underline underline-offset-2">launch the first real token</button>
            </p>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground font-mono">
              {query ? `No tokens match "${query}"` : 'No tokens in this view yet.'}
            </p>
          </div>
        )}
      </main>

      <CreateTokenModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
