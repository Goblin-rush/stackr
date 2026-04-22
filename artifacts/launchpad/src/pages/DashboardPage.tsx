import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { Link } from 'wouter';
import { formatEther } from 'viem';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useEthPrice } from '@/hooks/use-eth-price';
import {
  FACTORY_V2_ADDRESS,
  FACTORY_V2_ABI,
  TOKEN_V2_ABI,
  CURVE_V2_ABI,
} from '@/lib/contracts';
import { Wallet, Sparkles, Clock, Coins, RefreshCw, Loader2 } from 'lucide-react';
import { txPendingToast, txSubmittedToast, txSuccessToast, txErrorToast } from '@/lib/tx-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface Holding {
  token: `0x${string}`;
  curve: `0x${string}`;
  name: string;
  symbol: string;
  balance: bigint;
  holdScore: bigint; // sum of (balance × seconds)
  pendingRewards: bigint;
  graduated: boolean;
  realEthRaised: bigint;
  curvePriceEth: bigint; // 1 token in wei
}

const SECONDS_PER_DAY = 86400;

/** multiplier = average hold time in days (holdScore / balance / 86400) */
function multiplierDays(h: Holding): number {
  if (h.balance === 0n) return 0;
  // holdScore is in token-seconds; divide by balance to get average seconds, then by 86400
  const avgSec = Number(h.holdScore) / Number(h.balance);
  return avgSec / SECONDS_PER_DAY;
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
    if (!claimHash) return;
    claimToastId.current = txSubmittedToast(claimHash);
  }, [claimHash]);

  useEffect(() => {
    if (isClaimSuccess && claimHash && claimToastId.current) {
      txSuccessToast(claimHash, claimToastId.current);
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
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const total = (await client.readContract({
          address: FACTORY_V2_ADDRESS,
          abi: FACTORY_V2_ABI,
          functionName: 'allTokensLength',
        })) as bigint;

        if (total === 0n) {
          if (!cancelled) {
            setHoldings([]);
            setLoading(false);
          }
          return;
        }

        // Fetch token addresses
        const tokenCalls = Array.from({ length: Number(total) }, (_, i) => ({
          address: FACTORY_V2_ADDRESS,
          abi: FACTORY_V2_ABI,
          functionName: 'allTokens' as const,
          args: [BigInt(i)],
        }));
        const tokenResults = await client.multicall({ contracts: tokenCalls, allowFailure: true });
        const tokens = tokenResults
          .map((r) => (r.status === 'success' ? (r.result as `0x${string}`) : null))
          .filter((x): x is `0x${string}` => !!x);

        // For each token, read balance + record (curve)
        const balCalls = tokens.flatMap((t) => [
          { address: t, abi: TOKEN_V2_ABI, functionName: 'balanceOf' as const, args: [address] },
          { address: FACTORY_V2_ADDRESS, abi: FACTORY_V2_ABI, functionName: 'getRecord' as const, args: [t] },
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
          if (!cancelled) {
            setHoldings([]);
            setLoading(false);
          }
          return;
        }

        // Detail multicall: name, symbol, holdScore, pendingRewards, graduated (token) +
        // realEthRaised, currentPrice (curve)
        const detailCalls = candidates.flatMap((c) => [
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'name' as const },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'symbol' as const },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'holdScoreOf' as const, args: [address] },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'pendingRewards' as const, args: [address] },
          { address: c.token, abi: TOKEN_V2_ABI, functionName: 'graduated' as const },
          { address: c.curve, abi: CURVE_V2_ABI, functionName: 'realEthRaised' as const },
          { address: c.curve, abi: CURVE_V2_ABI, functionName: 'currentPrice' as const },
        ]);
        const detailResults = await client.multicall({ contracts: detailCalls, allowFailure: true });

        const list: Holding[] = candidates.map((c, i) => {
          const off = i * 7;
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
            pendingRewards: get<bigint>(3, 0n),
            graduated: get<boolean>(4, false),
            realEthRaised: get<bigint>(5, 0n),
            curvePriceEth: get<bigint>(6, 0n),
          };
        });

        // Sort: highest pending rewards first, then biggest holding
        list.sort((a, b) => {
          if (b.pendingRewards !== a.pendingRewards) return b.pendingRewards > a.pendingRewards ? 1 : -1;
          return b.balance > a.balance ? 1 : -1;
        });

        if (!cancelled) {
          setHoldings(list);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, isConnected, client, refreshKey]);

  // Aggregate stats
  const totals = useMemo(() => {
    if (!holdings) return null;
    let pendingEth = 0n;
    let portfolioEth = 0n;
    let weightedScoreNum = 0;
    let totalBalanceNum = 0;
    for (const h of holdings) {
      pendingEth += h.pendingRewards;
      // value = balance × price (both 1e18 → divide)
      portfolioEth += (h.balance * h.curvePriceEth) / 10n ** 18n;
      const bal = Number(h.balance);
      totalBalanceNum += bal;
      weightedScoreNum += Number(h.holdScore);
    }
    const avgMultDays = totalBalanceNum > 0 ? weightedScoreNum / totalBalanceNum / SECONDS_PER_DAY : 0;
    return { pendingEth, portfolioEth, avgMultDays, count: holdings.length };
  }, [holdings]);

  const handleClaim = async (token: `0x${string}`) => {
    if (claimingRef.current) return;
    claimingRef.current = token;
    claimToastId.current = txPendingToast();
    try {
      await writeContractAsync({
        address: token,
        abi: TOKEN_V2_ABI,
        functionName: 'claim',
      });
    } catch (e) {
      txErrorToast(e, claimToastId.current);
      claimToastId.current = null;
      claimingRef.current = null;
    }
  };

  // Empty / unconfigured states
  if (!FACTORY_V2_ADDRESS) {
    return (
      <Shell>
        <EmptyCard
          title="Dashboard not yet active"
          body="Aethpad v2 contracts are not yet deployed. Once the factory address is set, your holdings, multipliers, and ETH rewards will appear here."
        />
      </Shell>
    );
  }

  if (!isConnected) {
    return (
      <Shell>
        <div className="border border-border rounded-md bg-card p-10 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-1">Connect your wallet</h2>
          <p className="text-sm text-muted-foreground mb-5 font-mono">
            Tingnan ang multiplier mo, hold-score, at claimable ETH rewards.
          </p>
          <button
            onClick={() => login()}
            disabled={!ready}
            className="text-sm font-bold px-5 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            Connect wallet
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Holdings"
          value={loading ? <Skeleton className="h-5 w-12 bg-muted/40" /> : (totals?.count ?? 0).toString()}
          sub="tokens"
        />
        <StatCard
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Portfolio"
          value={
            loading ? (
              <Skeleton className="h-5 w-16 bg-muted/40" />
            ) : (
              <>{totals ? Number(formatEther(totals.portfolioEth)).toFixed(4) : '0'} <span className="text-xs text-muted-foreground">ETH</span></>
            )
          }
          sub={
            ethPrice && totals
              ? `≈ $${(Number(formatEther(totals.portfolioEth)) * ethPrice).toFixed(2)}`
              : '—'
          }
        />
        <StatCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Avg multiplier"
          value={
            loading ? (
              <Skeleton className="h-5 w-12 bg-muted/40" />
            ) : (
              <>{totals ? totals.avgMultDays.toFixed(2) : '0.00'}<span className="text-xs text-muted-foreground">×d</span></>
            )
          }
          sub="balance × days held"
        />
        <StatCard
          icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
          label="Claimable"
          value={
            loading ? (
              <Skeleton className="h-5 w-16 bg-muted/40" />
            ) : (
              <span className="text-primary">
                {totals ? Number(formatEther(totals.pendingEth)).toFixed(6) : '0'}{' '}
                <span className="text-xs text-muted-foreground">ETH</span>
              </span>
            )
          }
          sub={
            ethPrice && totals
              ? `≈ $${(Number(formatEther(totals.pendingEth)) * ethPrice).toFixed(2)}`
              : '—'
          }
        />
      </div>

      {/* Refresh */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Your Holdings</h2>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="text-[11px] font-mono uppercase text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          refresh
        </button>
      </div>

      {error && (
        <div className="border-2 border-primary bg-primary/5 text-primary text-sm font-mono p-3 mb-4">
          {error}
        </div>
      )}

      {loading && !holdings && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-muted/40" />
          ))}
        </div>
      )}

      {holdings && holdings.length === 0 && !loading && (
        <EmptyCard
          title="Wala ka pang hawak"
          body="Bumili ka ng kahit isang token sa Launchpad. Pag-may balance ka na, lalabas dito ang multiplier mo at ang ETH rewards mo na claimable."
        />
      )}

      {holdings && holdings.length > 0 && (
        <div className="space-y-2">
          {holdings.map((h) => {
            const mult = multiplierDays(h);
            const valEth = Number(formatEther((h.balance * h.curvePriceEth) / 10n ** 18n));
            const balanceK = Number(formatEther(h.balance));
            const isClaiming = claimingRef.current === h.token && (isClaimConfirming || !!claimHash);
            const canClaim = h.pendingRewards > 0n;
            return (
              <div
                key={h.token}
                className="border border-border rounded-md bg-card p-3 md:p-4 hover:border-primary/40 transition-colors"
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  {/* Identity */}
                  <Link href={`/token/${h.token}`}>
                    <div className="col-span-12 md:col-span-3 cursor-pointer min-w-0">
                      <div className="font-bold text-sm truncate hover:text-primary transition-colors">
                        ${h.symbol}
                        {h.graduated && (
                          <span className="ml-1.5 text-[9px] font-black uppercase tracking-widest text-primary border-2 border-primary px-1 py-0.5">
                            grad
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate font-mono">{h.name}</div>
                    </div>
                  </Link>

                  {/* Stats */}
                  <Stat label="Balance" value={`${formatCompact(balanceK)} ${h.symbol}`} />
                  <Stat label="Value" value={`${valEth.toFixed(5)} ETH`} />
                  <Stat
                    label="Multiplier"
                    value={
                      <span className="text-foreground">
                        {mult.toFixed(2)}<span className="text-xs text-muted-foreground">×d</span>
                      </span>
                    }
                  />
                  <Stat
                    label="Pending"
                    value={
                      h.pendingRewards > 0n ? (
                        <span className="text-primary font-bold">
                          {Number(formatEther(h.pendingRewards)).toFixed(6)} ETH
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    }
                  />

                  {/* Claim CTA */}
                  <div className="col-span-12 md:col-span-2 md:text-right">
                    <button
                      onClick={() => handleClaim(h.token)}
                      disabled={!canClaim || isClaiming || !!claimingRef.current}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isClaiming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {isClaiming ? 'claiming…' : 'Claim'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] font-mono text-muted-foreground mt-6 leading-relaxed">
        Multiplier = average days held × your balance. The longer you hold, the larger your share of every
        2% ETH-tax stream from buyers and sellers. Auto-accrues. No staking required.
      </p>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-10">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-2xl font-black tracking-tight">My Dashboard</h1>
          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
            v2
          </span>
        </div>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-md bg-card p-3 md:p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
        {icon}
        {label}
      </div>
      <div className="text-lg md:text-xl font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[11px] font-mono text-muted-foreground mt-1.5">{sub}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="col-span-6 md:col-span-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-border rounded-md bg-card p-10 text-center">
      <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <h2 className="text-lg font-bold mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto leading-relaxed">{body}</p>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}
