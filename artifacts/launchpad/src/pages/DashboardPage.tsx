import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, usePublicClient, useBlockNumber } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Link } from 'wouter';
import { formatEther, formatUnits } from 'viem';
import { Navbar } from '@/components/layout/Navbar';
import { useEthPrice } from '@/hooks/use-eth-price';
import {
  FACTORY_V3_ADDRESS,
  FACTORY_V3_ABI,
  TOKEN_V3_ABI,
  POOL_MANAGER_V4_ADDRESS,
  computePoolId,
  sqrtPriceX96ToEthPerToken,
} from '@/lib/contracts';
import { Wallet, Coins, ExternalLink, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const TOTAL_SUPPLY = 1_000_000_000;

interface Holding {
  token: `0x${string}`;
  name: string;
  symbol: string;
  balance: bigint;
  priceEth: number;
}

function formatCompact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}

const SLOT0_ABI = [
  {
    name: 'getSlot0',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
] as const;

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
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
    if (!isConnected || !address || !client || !FACTORY_V3_ADDRESS) {
      setHoldings(null);
      return;
    }
    const factory = FACTORY_V3_ADDRESS;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const total = (await client.readContract({
          address: factory,
          abi: FACTORY_V3_ABI,
          functionName: 'totalTokens',
        })) as bigint;

        if (total === 0n) {
          if (!cancelled) { setHoldings([]); setLoading(false); }
          return;
        }

        const tokenCalls = Array.from({ length: Number(total) }, (_, i) => ({
          address: factory,
          abi: FACTORY_V3_ABI,
          functionName: 'allTokens' as const,
          args: [BigInt(i)],
        }));
        const tokenResults = await client.multicall({ contracts: tokenCalls, allowFailure: true });
        const tokens = tokenResults
          .map((r) => (r.status === 'success' ? (r.result as `0x${string}`) : null))
          .filter((x): x is `0x${string}` => !!x);

        // Get balances for all tokens
        const balCalls = tokens.map((t) => ({
          address: t,
          abi: TOKEN_V3_ABI,
          functionName: 'balanceOf' as const,
          args: [address],
        }));
        const balResults = await client.multicall({ contracts: balCalls, allowFailure: true });

        const candidates: `0x${string}`[] = [];
        const balances = new Map<string, bigint>();
        for (let i = 0; i < tokens.length; i++) {
          const balR = balResults[i];
          if (balR.status !== 'success') continue;
          const balance = balR.result as bigint;
          if (balance === 0n) continue;
          candidates.push(tokens[i]);
          balances.set(tokens[i].toLowerCase(), balance);
        }

        if (candidates.length === 0) {
          if (!cancelled) { setHoldings([]); setLoading(false); }
          return;
        }

        // Get name + symbol for candidates
        const metaCalls = candidates.flatMap((t) => [
          { address: t, abi: TOKEN_V3_ABI, functionName: 'name' as const },
          { address: t, abi: TOKEN_V3_ABI, functionName: 'symbol' as const },
        ]);
        const metaResults = await client.multicall({ contracts: metaCalls, allowFailure: true });

        // Get current price via PoolManager.getSlot0
        const slot0Calls = candidates.map((t) => ({
          address: POOL_MANAGER_V4_ADDRESS,
          abi: SLOT0_ABI,
          functionName: 'getSlot0' as const,
          args: [computePoolId(t)] as [`0x${string}`],
        }));
        const slot0Results = await client.multicall({ contracts: slot0Calls, allowFailure: true }).catch(() => []);

        if (cancelled) return;

        const list: Holding[] = candidates.map((t, i) => {
          const name = metaResults[i * 2]?.status === 'success' ? (metaResults[i * 2].result as string) : 'Unknown';
          const symbol = metaResults[i * 2 + 1]?.status === 'success' ? (metaResults[i * 2 + 1].result as string) : '???';
          const balance = balances.get(t.toLowerCase()) ?? 0n;

          let priceEth = 0;
          if (slot0Results[i]?.status === 'success') {
            const sqrtPriceX96 = (slot0Results[i].result as any)[0] as bigint;
            priceEth = sqrtPriceX96ToEthPerToken(sqrtPriceX96);
          }

          return { token: t, name, symbol, balance, priceEth };
        });

        // Sort by portfolio value descending
        list.sort((a, b) => {
          const va = Number(formatUnits(a.balance, 18)) * a.priceEth;
          const vb = Number(formatUnits(b.balance, 18)) * b.priceEth;
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
    let portfolioEth = 0;
    for (const h of holdings) {
      portfolioEth += Number(formatUnits(h.balance, 18)) * h.priceEth;
    }
    return { portfolioEth, count: holdings.length };
  }, [holdings]);

  if (!FACTORY_V3_ADDRESS) {
    return (
      <Shell>
        <EmptyState
          icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
          title="Dashboard not yet active"
          body="Contracts not deployed yet. Once live, your holdings will appear here."
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
            See your token holdings and portfolio value.
          </p>
          <button
            onClick={() => open()}
            className="text-sm font-bold px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        <SummaryCard
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Holdings"
          value={loading ? null : String(totals?.count ?? 0)}
          sub="V3 tokens held"
        />
        <SummaryCard
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Portfolio"
          value={loading ? null : `${(totals?.portfolioEth ?? 0).toFixed(4)} ETH`}
          sub={ethPrice && totals ? `≈ $${(totals.portfolioEth * ethPrice).toFixed(2)}` : '--'}
        />
        <SummaryCard
          icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
          label="Pool"
          value="Uniswap V4"
          sub="1.5% rewards auto-distributed"
          highlight
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
            <Skeleton key={i} className="h-[80px] w-full bg-muted/30 rounded-xl" />
          ))}
        </div>
      )}

      {holdings && holdings.length === 0 && !loading && (
        <EmptyState
          icon={<Coins className="h-8 w-8 text-muted-foreground" />}
          title="No holdings yet"
          body="Buy a token on the Launchpad via Uniswap V4. Your holdings will appear here automatically."
        />
      )}

      {holdings && holdings.length > 0 && (
        <div className="space-y-3">
          {holdings.map((h) => {
            const balanceNum = Number(formatUnits(h.balance, 18));
            const valEth = balanceNum * h.priceEth;
            const valUsd = ethPrice ? valEth * ethPrice : null;
            const balFormatted = formatCompact(balanceNum);

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
                      <span className="text-[11px] text-muted-foreground font-mono">{h.name}</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded uppercase tracking-wider">
                        V4
                      </span>
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

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
                  <StatCell label="Balance" value={`${balFormatted} ${h.symbol}`} />
                  <StatCell label="Price" value={h.priceEth > 0 ? `${h.priceEth.toFixed(8)} ETH` : '—'} />
                  <StatCell
                    label="Value (ETH)"
                    value={valEth > 0 ? `${valEth.toFixed(5)} ETH` : '—'}
                  />
                  <StatCell
                    label="Value (USD)"
                    value={valUsd ? `$${valUsd.toFixed(2)}` : '—'}
                    highlight={valEth > 0}
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
          <p className="text-sm text-muted-foreground mt-1">Your Stackr V3 token holdings on Base mainnet</p>
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

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-0.5">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums truncate ${highlight ? 'text-primary' : 'text-foreground/90'}`}>
        {value}
      </div>
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
