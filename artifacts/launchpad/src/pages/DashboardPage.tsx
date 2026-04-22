import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, usePublicClient, useBlockNumber } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { Link } from 'wouter';
import { formatEther, formatUnits } from 'viem';
import { Navbar } from '@/components/layout/Navbar';
import { useEthPrice } from '@/hooks/use-eth-price';
import {
  FACTORY_V2_ADDRESS,
  FACTORY_V2_ABI,
  TOKEN_V2_ABI,
  CURVE_V2_ABI,
} from '@/lib/contracts';
import { Wallet, Coins, ExternalLink, TrendingUp, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Holding {
  token: `0x${string}`;
  curve: `0x${string}`;
  name: string;
  symbol: string;
  balance: bigint;
  holdScore: bigint;
  totalLiveScore: bigint;
  pendingRewards: bigint;       // pendingRewards(address) — allocated but not yet pushed
  totalReceivedByHolder: bigint; // totalReceivedByHolder(address) — cumulative auto-distributed ETH
  graduated: boolean;
  curvePriceEth: bigint;
}

function poolSharePct(h: Holding): number {
  if (h.totalLiveScore === 0n) return 0;
  return (Number(h.holdScore) / Number(h.totalLiveScore)) * 100;
}

function formatCompact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}


export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { login, ready } = usePrivy();
  const client = usePublicClient();
  const { data: ethPrice } = useEthPrice();
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: blockNumber } = useBlockNumber({ watch: true });
  const lastFetchBlock = useRef<bigint>(0n);
  useEffect(() => {
    if (!blockNumber) return;
    if (blockNumber - lastFetchBlock.current < 6n) return;
    lastFetchBlock.current = blockNumber;
    setRefreshKey((k) => k + 1);
  }, [blockNumber]);

  useEffect(() => {
    if (!isConnected || !address || !client || !FACTORY_V2_ADDRESS) {
      setHoldings(null);
      return;
    }
    const factory = FACTORY_V2_ADDRESS;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const total = (await client.readContract({
          address: factory,
          abi: FACTORY_V2_ABI,
          functionName: 'allTokensLength',
        })) as bigint;

        if (total === 0n) {
          if (!cancelled) { setHoldings([]); setLoading(false); }
          return;
        }

        const tokenCalls = Array.from({ length: Number(total) }, (_, i) => ({
          address: factory,
          abi: FACTORY_V2_ABI,
          functionName: 'allTokens' as const,
          args: [BigInt(i)],
        }));
        const tokenResults = await client.multicall({ contracts: tokenCalls, allowFailure: true });
        const tokens = tokenResults
          .map((r) => (r.status === 'success' ? (r.result as `0x${string}`) : null))
          .filter((x): x is `0x${string}` => !!x);

        const balCalls = tokens.flatMap((t) => [
          { address: t, abi: TOKEN_V2_ABI, functionName: 'balanceOf' as const, args: [address] },
          { address: factory, abi: FACTORY_V2_ABI, functionName: 'getRecord' as const, args: [t] },
        ]);
        const balResults = await client.multicall({ contracts: balCalls, allowFailure: true });

        const candidates: { token: `0x${string}`; curve: `0x${string}`; balance: bigint }[] = [];
        for (let i = 0; i < tokens.length; i++) {
          const balR = balResults[i * 2];
          const recR = balResults[i * 2 + 1];
          if (balR.status !== 'success' || recR.status !== 'success') continue;
          const balance = balR.result as bigint;
          if (balance === 0n) continue;
          const rec = recR.result as { curve: `0x${string}` };
          candidates.push({ token: tokens[i], curve: rec.curve, balance });
        }

        if (candidates.length === 0) {
          if (!cancelled) { setHoldings([]); setLoading(false); }
          return;
        }

        // 8 multicall slots per token:
        // 0 name  1 symbol  2 holdScore  3 totalHoldScoreLive
        // 4 graduated  5 currentPrice  6 pendingRewards  7 totalReceivedByHolder
        const detailCalls = candidates.flatMap((c) => [
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'name' as const },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'symbol' as const },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'holdScore' as const, args: [address] as [`0x${string}`] },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'totalHoldScoreLive' as const },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'graduated' as const },
          { address: c.curve, abi: CURVE_V2_ABI, functionName: 'currentPrice' as const },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'pendingRewards' as const, args: [address] as [`0x${string}`] },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'totalReceivedByHolder' as const, args: [address] as [`0x${string}`] },
        ]);

        const detailResults = await client.multicall({ contracts: detailCalls, allowFailure: true });

        const list: Holding[] = candidates.map((c, i) => {
          const off = i * 8;
          const get = <T,>(idx: number, fallback: T): T => {
            const r = detailResults[off + idx];
            return r.status === 'success' ? (r.result as T) : fallback;
          };
          return {
            token: c.token,
            curve: c.curve,
            balance: c.balance,
            name: get<string>(0, 'Unknown'),
            symbol: get<string>(1, '???'),
            holdScore: get<bigint>(2, 0n),
            totalLiveScore: get<bigint>(3, 0n),
            graduated: get<boolean>(4, false),
            curvePriceEth: get<bigint>(5, 0n),
            pendingRewards: get<bigint>(6, 0n),
            totalReceivedByHolder: get<bigint>(7, 0n),
          };
        });

        list.sort((a, b) => {
          const va = Number(formatEther((a.balance * a.curvePriceEth) / 10n ** 18n));
          const vb = Number(formatEther((b.balance * b.curvePriceEth) / 10n ** 18n));
          return vb - va;
        });

        if (!cancelled) { setHoldings(list); setLoading(false); }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [address, isConnected, client, refreshKey]);

  const totals = useMemo(() => {
    if (!holdings) return null;
    let portfolioEth = 0n;
    let totalReceived = 0n;
    let totalPending = 0n;
    for (const h of holdings) {
      portfolioEth += (h.balance * h.curvePriceEth) / 10n ** 18n;
      totalReceived += h.totalReceivedByHolder;
      totalPending  += h.pendingRewards;
    }
    return { portfolioEth, totalReceived, totalPending, count: holdings.length };
  }, [holdings]);

  if (!FACTORY_V2_ADDRESS) {
    return (
      <Shell>
        <EmptyState
          icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
          title="Dashboard not yet active"
          body="Contracts not deployed yet. Once live, your holdings and reward stats will appear here."
        />
      </Shell>
    );
  }

  if (!isConnected) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/30 border border-border flex items-center justify-center mb-5">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold mb-2">Connect your wallet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
            See your token holdings and ETH rewards received.
          </p>
          <button
            onClick={() => login()}
            disabled={!ready}
            className="text-sm font-bold px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Connect wallet
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <SummaryCard
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Holdings"
          value={loading ? null : String(totals?.count ?? 0)}
          sub="tokens held"
        />
        <SummaryCard
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Portfolio"
          value={loading ? null : `${Number(formatEther(totals?.portfolioEth ?? 0n)).toFixed(4)} ETH`}
          sub={ethPrice && totals ? `≈ $${(Number(formatEther(totals.portfolioEth)) * ethPrice).toFixed(2)}` : '--'}
        />
        <SummaryCard
          icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
          label="Total Received"
          value={
            loading
              ? null
              : totals && totals.totalReceived > 0n
                ? `${Number(formatEther(totals.totalReceived)).toFixed(6)} ETH`
                : '--'
          }
          sub={
            ethPrice && totals && totals.totalReceived > 0n
              ? `≈ $${(Number(formatEther(totals.totalReceived)) * ethPrice).toFixed(2)}`
              : 'auto-distributed'
          }
          highlight={!!totals && totals.totalReceived > 0n}
        />
        <SummaryCard
          icon={<Star className="h-3.5 w-3.5 text-amber-400" />}
          label="Est. Pending"
          value={
            loading
              ? null
              : totals && totals.totalPending > 0n
                ? `${Number(formatEther(totals.totalPending)).toFixed(6)} ETH`
                : '--'
          }
          sub="pushed on next trade"
          highlight={!!totals && totals.totalPending > 0n}
          highlightColor="amber"
        />
      </div>

      {error && (
        <div className="border border-destructive/30 bg-destructive/10 text-destructive text-sm font-mono px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Holdings</h2>
      </div>

      {loading && !holdings && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[100px] w-full bg-muted/30 rounded-xl" />
          ))}
        </div>
      )}

      {holdings && holdings.length === 0 && !loading && (
        <EmptyState
          icon={<Coins className="h-8 w-8 text-muted-foreground" />}
          title="No holdings yet"
          body="Buy a token on the Launchpad. Your holdings and rewards will appear here automatically."
        />
      )}

      {holdings && holdings.length > 0 && (
        <div className="space-y-3">
          {holdings.map((h) => {
            const share = poolSharePct(h);
            const valEth = Number(formatEther((h.balance * h.curvePriceEth) / 10n ** 18n));
            const balFormatted = formatCompact(Number(formatUnits(h.balance, 18)));
            const received = Number(formatEther(h.totalReceivedByHolder));
            const pending  = Number(formatEther(h.pendingRewards));
            const scoreStr = formatCompact(Number(formatUnits(h.holdScore, 18)));

            return (
              <div
                key={h.token}
                className="rounded-xl border border-border/60 bg-card overflow-hidden hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                  <Link href={`/token/${h.token}`}>
                    <div className="flex items-center gap-2 cursor-pointer group">
                      <span className="text-sm font-bold group-hover:text-primary transition-colors">
                        ${h.symbol}
                      </span>
                      {h.graduated && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary border border-primary/50 bg-primary/10 px-1.5 py-0.5 rounded">
                          DEX
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground font-mono">{h.name}</span>
                    </div>
                  </Link>
                  <a
                    href={`https://basescan.org/address/${h.token}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
                  <StatCell label="Balance" value={`${balFormatted} ${h.symbol}`} />
                  <StatCell label="Value" value={`${valEth.toFixed(5)} ETH`} />
                  <StatCell
                    label="Hold Score"
                    value={scoreStr}
                    sub="reward multiplier"
                  />
                  <StatCell
                    label="Pool Share"
                    value={`${share.toFixed(2)}%`}
                    sub="of reward pool"
                  />
                  <StatCell
                    label="Est. Pending"
                    value={pending > 0 ? `${pending.toFixed(6)} ETH` : '--'}
                    sub={pending > 0 ? 'pushed on next trade' : 'nothing queued'}
                    highlightAmber={pending > 0}
                  />
                  <StatCell
                    label="Total Received"
                    value={received > 0 ? `${received.toFixed(6)} ETH` : '--'}
                    sub={received > 0 ? 'auto-distributed' : 'no rewards yet'}
                    highlight={received > 0}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8 md:px-8 md:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tight">Profile</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  highlight,
  highlightColor = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  sub: React.ReactNode;
  highlight?: boolean;
  highlightColor?: 'primary' | 'amber';
}) {
  const isAmber = highlight && highlightColor === 'amber';
  const isPrimary = highlight && highlightColor === 'primary';
  return (
    <div className={`rounded-xl border bg-card p-4 transition-colors ${isAmber ? 'border-amber-500/30 bg-amber-500/5' : isPrimary ? 'border-primary/30 bg-primary/5' : 'border-border/60'}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
        {icon}
        {label}
      </div>
      {value === null ? (
        <Skeleton className="h-6 w-24 bg-muted/40 mb-1" />
      ) : (
        <div className={`text-lg font-bold tabular-nums leading-tight ${isAmber ? 'text-amber-400' : isPrimary ? 'text-primary' : 'text-foreground'}`}>
          {value}
        </div>
      )}
      <div className="text-[11px] font-mono text-muted-foreground/60 mt-1">{sub}</div>
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  highlight,
  highlightAmber,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  highlightAmber?: boolean;
}) {
  const color = highlightAmber ? 'text-amber-400' : highlight ? 'text-primary' : 'text-foreground/90';
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-0.5">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums truncate ${color}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{sub}</div>}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-muted/30 border border-border flex items-center justify-center mb-4">
        {icon}
      </div>
      <h2 className="text-base font-bold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{body}</p>
    </div>
  );
}
