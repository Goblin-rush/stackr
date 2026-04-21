import { useMemo, useState } from 'react';
import {
  useAccount,
  useConnect,
  useReadContract,
  useReadContracts,
  useBalance,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import { formatEther } from 'viem';
import { Navbar } from '@/components/layout/Navbar';
import { FACTORY_ADDRESS, FACTORY_ABI, BONDING_CURVE_ABI } from '@/lib/contracts';
import { Shield, AlertTriangle, ExternalLink } from 'lucide-react';
import NotFound from '@/pages/not-found';

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  // Read factory owner from chain (source of truth)
  const { data: factoryOwner, isLoading: ownerLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'owner',
  });

  const isAdmin =
    !!address &&
    !!factoryOwner &&
    address.toLowerCase() === (factoryOwner as string).toLowerCase();

  // Always show 404-style page if connected but not admin (security through chain not obscurity)
  if (!ownerLoading && isConnected && !isAdmin) {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-8 md:px-8">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-black tracking-tight">Admin Console</h1>
          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded">
            restricted
          </span>
        </div>

        {!isConnected ? (
          <div className="border border-border rounded-md bg-card p-8 text-center">
            <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4 font-mono">
              Connect deployer wallet to access admin functions.
            </p>
            <button
              onClick={() => connect({ connector: metaMask() })}
              className="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Connect wallet
            </button>
          </div>
        ) : ownerLoading ? (
          <div className="text-center py-12 text-muted-foreground font-mono text-sm">
            Verifying admin access…
          </div>
        ) : (
          <AdminDashboard adminAddress={address!} />
        )}
      </main>
    </div>
  );
}

function AdminDashboard({ adminAddress }: { adminAddress: string }) {
  const { data: totalTokens } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'totalTokens',
  });

  const total = totalTokens ? Number(totalTokens) : 0;

  const { data: tokens } = useReadContracts({
    contracts: Array.from({ length: total }, (_, i) => ({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'allTokens' as const,
      args: [BigInt(i)],
    })),
    query: { enabled: total > 0 },
  });

  const tokenAddresses = (tokens ?? [])
    .map((r) => (r?.status === 'success' ? (r.result as `0x${string}`) : null))
    .filter((a): a is `0x${string}` => !!a);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Connected as" value={`${adminAddress.slice(0, 6)}…${adminAddress.slice(-4)}`} />
        <StatCard label="Factory" value={`${FACTORY_ADDRESS.slice(0, 6)}…${FACTORY_ADDRESS.slice(-4)}`} />
        <StatCard label="Tokens deployed" value={total.toString()} />
      </div>

      <div className="border border-amber-500/20 bg-amber-500/5 rounded-md p-3 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 font-mono leading-relaxed">
          <strong className="text-amber-400">Withdraw warning:</strong> Calling withdraw on a
          non-graduated token will <strong>permanently force-close trading</strong> for that token
          (no more buys/sells). Use only when you intend to migrate liquidity to a DEX.
        </div>
      </div>

      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Deployed tokens
        </h2>
        {total === 0 ? (
          <div className="border border-border rounded-md bg-card p-8 text-center text-sm text-muted-foreground font-mono">
            No tokens deployed via this factory yet.
          </div>
        ) : (
          <div className="space-y-2">
            {tokenAddresses.map((addr) => (
              <AdminTokenRow key={addr} address={addr} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-md bg-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">
        {label}
      </p>
      <p className="font-mono text-sm text-foreground tabular-nums truncate">{value}</p>
    </div>
  );
}

function AdminTokenRow({ address }: { address: `0x${string}` }) {
  const { data: meta, refetch: refetchMeta } = useReadContracts({
    contracts: [
      { address, abi: BONDING_CURVE_ABI, functionName: 'name' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'symbol' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'realEthRaised' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'graduated' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'getProgress' },
    ],
  });

  const { data: ethBalance, refetch: refetchBal } = useBalance({ address });

  const [name, symbol, raised, graduated, progress] = (meta ?? []).map((r) => r?.result);

  const balanceEth = ethBalance ? Number(formatEther(ethBalance.value)) : 0;
  const raisedEth = raised ? Number(formatEther(raised as bigint)) : 0;
  const progressNum = progress ? Number(progress as bigint) : 0;
  const isGraduated = !!graduated;

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh after success
  useMemo(() => {
    if (isSuccess) {
      refetchMeta();
      refetchBal();
    }
  }, [isSuccess, refetchMeta, refetchBal]);

  const handleWithdraw = async () => {
    setError(null);
    try {
      await writeContractAsync({
        address,
        abi: BONDING_CURVE_ABI,
        functionName: 'withdrawEth',
      });
      setConfirmOpen(false);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Transaction failed');
    }
  };

  const canWithdraw = balanceEth > 0;

  return (
    <div className="border border-border rounded-md bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-foreground">{(name as string) || '—'}</p>
            <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
              ${symbol as string || '?'}
            </span>
            {isGraduated ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase tracking-wider">
                Graduated
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded uppercase tracking-wider">
                Bonding · {progressNum}%
              </span>
            )}
          </div>
          <a
            href={`https://etherscan.io/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1"
          >
            {address}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Raised
            </p>
            <p className="font-mono text-sm tabular-nums">{raisedEth.toFixed(4)} ETH</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              In contract
            </p>
            <p className="font-mono text-sm tabular-nums text-emerald-400">
              {balanceEth.toFixed(4)} ETH
            </p>
          </div>

          {!confirmOpen ? (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canWithdraw || isPending || isMining}
              className="text-xs font-bold px-3 py-2 bg-red-500/90 text-white rounded hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Withdraw
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleWithdraw}
                disabled={isPending || isMining}
                className="text-xs font-bold px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                {isPending ? 'Sign…' : isMining ? 'Mining…' : `Confirm ${balanceEth.toFixed(4)} ETH`}
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setError(null);
                }}
                disabled={isPending || isMining}
                className="text-xs px-2 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {!isGraduated && confirmOpen && (
        <p className="mt-2 text-[11px] text-amber-400 font-mono">
          ⚠ This token is not graduated yet — withdrawing will permanently disable trading.
        </p>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-red-400 font-mono break-all">{error}</p>
      )}

      {isSuccess && (
        <p className="mt-2 text-[11px] text-emerald-400 font-mono">
          ✓ Withdraw successful.{' '}
          <a
            href={`https://etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View tx
          </a>
        </p>
      )}
    </div>
  );
}
