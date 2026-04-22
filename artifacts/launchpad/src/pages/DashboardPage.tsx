import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
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
import { Wallet, Sparkles, PieChart, Coins, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { txPendingToast, txSubmittedToast, txSuccessToast, txErrorToast } from '@/lib/tx-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface Holding {
  token: `0x${string}`;
  curve: `0x${string}`;
  name: string;
  symbol: string;
  balance: bigint;
  holdScore: bigint;
  totalLiveScore: bigint;
  pendingRewards: bigint;
  graduated: boolean;
  realEthRaised: bigint;
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
  const claimingRef = useRef<`0x${string}` | null>(null);

  const { writeContractAsync, data: claimHash } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimHash });
  const claimToastId = useRef<string | number | null>(null);

  useEffect(() => {
    if (!claimHash || !claimToastId.current) return;
    txSubmittedToast(claimToastId.current, claimHash, 'Claiming rewards');
  }, [claimHash]);

  useEffect(() => {
    if (isClaimSuccess && claimHash && claimToastId.current) {
      txSuccessToast(claimToastId.current, claimHash, 'Rewards claimed!');
      claimToastId.current = null;
      claimingRef.current = null;
      setRefreshKey((k) => k + 1);
    }
  }, [isClaimSuccess, claimHash]);

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
          const rec = recR.result as { creator: `0x${string}`; curve: `0x${string}`; createdAt: bigint; metadataURI: string };
          candidates.push({ token: tokens[i], curve: rec.curve, balance });
        }

        if (candidates.length === 0) {
          if (!cancelled) { setHoldings([]); setLoading(false); }
          return;
        }

        const detailCalls = candidates.flatMap((c) => [
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'name' as const },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'symbol' as const },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'holdScore' as const, args: [address] },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'totalHoldScoreLive' as const },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'pendingRewards' as const, args: [address] },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'graduated' as const },
          { address: c.curve, abi: CURVE_V2_ABI, functionName: 'realEthRaised' as const },
          { address: c.curve, abi: CURVE_V2_ABI, functionName: 'currentPrice' as const },
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
            pendingRewards: get<bigint>(4, 0n),
            graduated: get<boolean>(5, false),
            realEthRaised: get<bigint>(6, 0n),
            curvePriceEth: get<bigint>(7, 0n),
          };
        });

        list.sort((a, b) => {
          if (b.pendingRewards !== a.pendingRewards) return b.pendingRewards > a.pendingRewards ? 1 : -1;
          return b.balance > a.balance ? 1 : -1;
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
    let pendingEth = 0n;
    let portfolioEth = 0n;
    let totalShareWeighted = 0;
    for (const h of holdings) {
      pendingEth += h.pendingRewards;
      portfolioEth += (h.balance * h.curvePriceEth) / 10n ** 18n;
      totalShareWeighted += poolSharePct(h);
    }
    return { pendingEth, portfolioEth, totalShareWeighted, count: holdings.length };
  }, [holdings]);

  const handleClaim = async (token: `0x${string}`) => {
    if (claimingRef.current) return;
    claimingRef.current = token;
    claimToastId.current = txPendingToast('Claiming rewards…');
    try {
      await writeContractAsync({ address: token, abi: TOKEN_V2_ABI, functionName: 'claim' });
    } catch (e) {
      txErrorToast(claimToastId.current ?? undefined, e);
      claimToastId.current = null;
      claimingRef.current = null;
    }
  };

  if (!FACTORY_V2_ADDRESS) {
    return (
      <Shell loading={false} onRefresh={() => {}}>
        <EmptyState
          icon={<Sparkles className="h-8 w-8 text-muted-foreground" />}
          title="Dashboard not yet active"
          body="Contracts not deployed yet. Once live, your holdings, pool share, and ETH rewards will appear here."
        />
      </Shell>
    );
  }

  if (!isConnected) {
    return (
      <Shell loading={false} onRefresh={() => {}}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/30 border border-border flex items-center justify-center mb-5">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold mb-2">Connect your wallet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
            See your token holdings, reward pool share, and claimable ETH.
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
    <Shell loading={loading} onRefresh={() => setRefreshKey((k) => k + 1)}>
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
          sub={ethPrice && totals ? `≈ $${(Number(formatEther(totals.portfolioEth)) * ethPrice).toFixed(2)}` : '—'}
        />
        <SummaryCard
          icon={<PieChart className="h-3.5 w-3.5" />}
          label="Avg Pool Weight"
          value={loading ? null : `${totals ? totals.totalShareWeighted.toFixed(2) : '0.00'}%`}
          sub="across all holdings"
        />
        <SummaryCard
          icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
          label="Total Claimable"
          value={
            loading
              ? null
              : totals && totals.pendingEth > 0n
                ? `${Number(formatEther(totals.pendingEth)).toFixed(6)} ETH`
                : '—'
          }
          sub={
            ethPrice && totals && totals.pendingEth > 0n
              ? `≈ $${(Number(formatEther(totals.pendingEth)) * ethPrice).toFixed(2)}`
              : 'no pending rewards'
          }
          highlight={!!totals && totals.pendingEth > 0n}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="border border-destructive/30 bg-destructive/10 text-destructive text-sm font-mono px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Holdings list */}
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
          body="Buy a token on the Launchpad. Once you hold a balance, your pool share and ETH rewards will appear here."
        />
      )}

      {holdings && holdings.length > 0 && (
        <div className="space-y-3">
          {holdings.map((h) => {
            const share = poolSharePct(h);
            const valEth = Number(formatEther((h.balance * h.curvePriceEth) / 10n ** 18n));
            const balFormatted = formatCompact(Number(formatUnits(h.balance, 18)));
            const pendingEth = Number(formatEther(h.pendingRewards));
            const hasPending = h.pendingRewards > 0n;
            const isClaiming = claimingRef.current === h.token && (isClaimConfirming || !!claimHash);
            const isOtherClaiming = !!claimingRef.current && claimingRef.current !== h.token;

            return (
              <div
                key={h.token}
                className={`rounded-xl border bg-card overflow-hidden transition-colors ${
                  hasPending ? 'border-primary/30 hover:border-primary/50' : 'border-border/60 hover:border-border'
                }`}
              >
                {/* Token header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                  <Link href={`/token/${h.token}`}>
                    <div className="flex items-center gap-2.5 cursor-pointer group">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold group-hover:text-primary transition-colors">
                            ${h.symbol}
                          </span>
                          {h.graduated && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary border border-primary/50 bg-primary/10 px-1.5 py-0.5 rounded">
                              DEX
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">{h.name}</span>
                      </div>
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

                {/* Stats + Claim */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
                  {/* Stats grid */}
                  <div className="flex-1 grid grid-cols-3 divide-x divide-border/40">
                    <StatCell label="Balance" value={`${balFormatted} ${h.symbol}`} />
                    <StatCell label="Value" value={`${valEth.toFixed(5)} ETH`} />
                    <StatCell label="Pool share" value={`${share.toFixed(2)}%`} />
                  </div>

                  {/* Claimable + button */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 px-4 py-3 sm:min-w-[200px]">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                        Claimable
                      </div>
                      <div className={`text-sm font-bold tabular-nums ${hasPending ? 'text-primary' : 'text-muted-foreground/50'}`}>
                        {hasPending ? `${pendingEth.toFixed(6)} ETH` : '—'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleClaim(h.token)}
                      disabled={!hasPending || isClaiming || isOtherClaiming}
                      className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-all ${
                        hasPending && !isClaiming && !isOtherClaiming
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20'
                          : 'bg-muted/40 text-muted-foreground/50 cursor-not-allowed'
                      }`}
                    >
                      {isClaiming ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Claiming…</>
                      ) : (
                        <><Sparkles className="h-3.5 w-3.5" /> Claim</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] font-mono text-muted-foreground/50 mt-8 leading-relaxed max-w-2xl">
        Pool share = time-weighted holdScore ÷ total holdScore across all holders.
        Every trade deposits 2% ETH into the reward pool. Longer you hold without selling, the larger your share.
        No staking required — accrues automatically.
      </p>
    </Shell>
  );
}

function Shell({
  children,
  loading,
  onRefresh,
}: {
  children: React.ReactNode;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8 md:px-8 md:py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
              v2
            </span>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  sub: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 transition-colors ${highlight ? 'border-primary/30 bg-primary/5' : 'border-border/60'}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
        {icon}
        {label}
      </div>
      {value === null ? (
        <Skeleton className="h-6 w-24 bg-muted/40 mb-1" />
      ) : (
        <div className={`text-lg font-bold tabular-nums leading-tight ${highlight ? 'text-primary' : 'text-foreground'}`}>
          {value}
        </div>
      )}
      <div className="text-[11px] font-mono text-muted-foreground/60 mt-1">{sub}</div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-0.5">{label}</div>
      <div className="text-[13px] font-semibold tabular-nums text-foreground/90 truncate">{value}</div>
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
