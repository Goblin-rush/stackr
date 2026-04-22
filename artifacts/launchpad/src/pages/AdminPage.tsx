import { useEffect, useState } from 'react';
import {
  useAccount,
  useConnect,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import { formatEther } from 'viem';
import { Navbar } from '@/components/layout/Navbar';
import {
  FACTORY_V2_ADDRESS,
  FACTORY_V2_ABI,
  TOKEN_V2_ABI,
  CURVE_V2_ABI,
} from '@/lib/contracts';
import { Shield, AlertTriangle, ExternalLink, DollarSign, Zap } from 'lucide-react';
import NotFound from '@/pages/not-found';

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  const { data: factoryOwner, isLoading: ownerLoading } = useReadContract({
    address: FACTORY_V2_ADDRESS ?? undefined,
    abi: FACTORY_V2_ABI,
    functionName: 'owner',
    query: { enabled: !!FACTORY_V2_ADDRESS },
  });

  const isAdmin =
    !!address &&
    !!factoryOwner &&
    address.toLowerCase() === (factoryOwner as string).toLowerCase();

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
            V2 · restricted
          </span>
        </div>

        {!FACTORY_V2_ADDRESS ? (
          <div className="border border-amber-500/20 bg-amber-500/5 rounded-md p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-amber-200 font-mono">
              VITE_FACTORY_V2_ADDRESS not configured.
            </p>
          </div>
        ) : !isConnected ? (
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
  const factory = FACTORY_V2_ADDRESS!;

  const { data: statsData, refetch: refetchStats } = useReadContracts({
    contracts: [
      { address: factory, abi: FACTORY_V2_ABI, functionName: 'allTokensLength' },
      { address: factory, abi: FACTORY_V2_ABI, functionName: 'accumulatedPlatformFees' },
      { address: factory, abi: FACTORY_V2_ABI, functionName: 'totalPlatformFeesWithdrawn' },
    ],
  });

  const total         = statsData?.[0]?.status === 'success' ? Number(statsData[0].result as bigint) : 0;
  const pendingFees   = statsData?.[1]?.status === 'success' ? (statsData[1].result as bigint) : 0n;
  const withdrawnFees = statsData?.[2]?.status === 'success' ? (statsData[2].result as bigint) : 0n;

  const { data: tokenSlots } = useReadContracts({
    contracts: Array.from({ length: total }, (_, i) => ({
      address: factory,
      abi: FACTORY_V2_ABI,
      functionName: 'allTokens' as const,
      args: [BigInt(i)] as [bigint],
    })),
    query: { enabled: total > 0 },
  });

  const tokenAddresses = (tokenSlots ?? [])
    .map((r) => (r?.status === 'success' ? (r.result as `0x${string}`) : null))
    .filter((a): a is `0x${string}` => !!a)
    .reverse(); // newest first

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawDone, setWithdrawDone] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      setWithdrawDone(true);
      refetchStats();
    }
  }, [isSuccess, refetchStats]);

  const handleWithdrawFees = async () => {
    setWithdrawError(null);
    setWithdrawDone(false);
    try {
      await writeContractAsync({
        address: factory,
        abi: FACTORY_V2_ABI,
        functionName: 'withdrawPlatformFees',
        args: [adminAddress as `0x${string}`],
      });
    } catch (e: any) {
      setWithdrawError(e?.shortMessage || e?.message || 'Transaction failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Connected as" value={shortAddr(adminAddress)} />
        <StatCard label="Factory V2" value={shortAddr(factory)} link={`https://basescan.org/address/${factory}`} />
        <StatCard label="Tokens deployed" value={total.toString()} />
        <StatCard label="Platform fees (ETH)" value={Number(formatEther(pendingFees)).toFixed(4)} highlight />
      </div>

      {/* Platform fee withdrawal */}
      <div className="border border-border rounded-md bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground font-mono">
            Platform Fees
          </h2>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Pending</p>
            <p className="font-mono text-base tabular-nums text-primary font-bold">
              {Number(formatEther(pendingFees)).toFixed(6)} ETH
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Total Withdrawn</p>
            <p className="font-mono text-sm tabular-nums text-muted-foreground">
              {Number(formatEther(withdrawnFees)).toFixed(6)} ETH
            </p>
          </div>
          <button
            onClick={handleWithdrawFees}
            disabled={pendingFees === 0n || isPending || isMining}
            className="ml-auto text-xs font-bold px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isPending ? 'Sign…' : isMining ? 'Mining…' : `Withdraw ${Number(formatEther(pendingFees)).toFixed(4)} ETH`}
          </button>
        </div>
        {withdrawError && (
          <p className="mt-2 text-[11px] text-red-400 font-mono break-all">{withdrawError}</p>
        )}
        {withdrawDone && (
          <p className="mt-2 text-[11px] text-emerald-400 font-mono">
            ✓ Withdrawn.{' '}
            <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">
              View tx
            </a>
          </p>
        )}
      </div>

      <div className="border border-amber-500/20 bg-amber-500/5 rounded-md p-3 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 font-mono leading-relaxed">
          <strong className="text-amber-400">Force-close warning:</strong> Calling force-close on a
          non-graduated token will <strong>permanently disable trading</strong> and return remaining ETH to the factory.
          Burned tokens are sent to the zero address. Use only for emergency intervention.
        </div>
      </div>

      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Deployed tokens ({total})
        </h2>
        {total === 0 ? (
          <div className="border border-border rounded-md bg-card p-8 text-center text-sm text-muted-foreground font-mono">
            No tokens deployed via this factory yet.
          </div>
        ) : (
          <div className="space-y-2">
            {tokenAddresses.map((addr) => (
              <AdminTokenRow key={addr} tokenAddress={addr} adminAddress={adminAddress as `0x${string}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, link, highlight }: { label: string; value: string; link?: string; highlight?: boolean }) {
  return (
    <div className={`border rounded-md bg-card p-3 ${highlight ? 'border-primary/30' : 'border-border'}`}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">{label}</p>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className={`font-mono text-sm tabular-nums truncate flex items-center gap-1 hover:text-primary ${highlight ? 'text-primary' : 'text-foreground'}`}
        >
          {value} <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      ) : (
        <p className={`font-mono text-sm tabular-nums truncate ${highlight ? 'text-primary font-bold' : 'text-foreground'}`}>
          {value}
        </p>
      )}
    </div>
  );
}

function AdminTokenRow({
  tokenAddress,
  adminAddress,
}: {
  tokenAddress: `0x${string}`;
  adminAddress: `0x${string}`;
}) {
  const factory = FACTORY_V2_ADDRESS!;

  const { data: recordData } = useReadContract({
    address: factory,
    abi: FACTORY_V2_ABI,
    functionName: 'getRecord',
    args: [tokenAddress],
  });
  const record = recordData as {
    token: `0x${string}`;
    curve: `0x${string}`;
    creator: `0x${string}`;
    deployedAt: bigint;
    metadataURI: string;
    initialDevBuyEth: bigint;
    initialDevBuyTokens: bigint;
  } | undefined;

  const curveAddress = record?.curve;

  const { data: tokenMeta, refetch: refetchToken } = useReadContracts({
    contracts: [
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'name' },
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'symbol' },
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'graduated' },
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'pendingPlatformEth' },
    ],
  });

  const { data: curveMeta, refetch: refetchCurve } = useReadContracts({
    contracts: [
      { address: curveAddress!, abi: CURVE_V2_ABI, functionName: 'realEthRaised' },
      { address: curveAddress!, abi: CURVE_V2_ABI, functionName: 'progressBps' },
      { address: curveAddress!, abi: CURVE_V2_ABI, functionName: 'forceClosed' },
    ],
    query: { enabled: !!curveAddress },
  });

  const refetchMeta = () => { void refetchToken(); void refetchCurve(); };

  const name           = tokenMeta?.[0]?.result as string | undefined;
  const symbol         = tokenMeta?.[1]?.result as string | undefined;
  const graduated      = tokenMeta?.[2]?.result as boolean | undefined;
  const pendingPlatEth = tokenMeta?.[3]?.result as bigint | undefined;
  const realEthRaised  = curveMeta?.[0]?.result as bigint | undefined;
  const progressBps    = curveMeta?.[1]?.result as bigint | undefined;
  const forceClosed    = curveMeta?.[2]?.result as boolean | undefined;

  const progressPct = progressBps ? Number(progressBps) / 100 : 0;
  const raisedEth   = realEthRaised ? Number(formatEther(realEthRaised)) : 0;

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [confirmAction, setConfirmAction] = useState<'forceClose' | 'flush' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      setDone(true);
      refetchMeta();
    }
  }, [isSuccess, refetchMeta]);

  const handleForceClose = async () => {
    setError(null);
    setDone(false);
    try {
      await writeContractAsync({
        address: factory,
        abi: FACTORY_V2_ABI,
        functionName: 'forceCloseCurve',
        args: [tokenAddress, adminAddress],
      });
      setConfirmAction(null);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Transaction failed');
    }
  };

  const handleFlushPlatformEth = async () => {
    setError(null);
    setDone(false);
    try {
      await writeContractAsync({
        address: factory,
        abi: FACTORY_V2_ABI,
        functionName: 'flushTokenPlatformEth',
        args: [tokenAddress],
      });
      setConfirmAction(null);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Transaction failed');
    }
  };

  return (
    <div className="border border-border rounded-md bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-foreground">{name || '…'}</p>
            {symbol && (
              <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                ${symbol}
              </span>
            )}
            {graduated ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase tracking-wider">
                Graduated
              </span>
            ) : forceClosed ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded uppercase tracking-wider">
                Force Closed
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded uppercase tracking-wider">
                Bonding · {progressPct.toFixed(1)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <a
              href={`https://basescan.org/address/${tokenAddress}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Token: {shortAddr(tokenAddress)} <ExternalLink className="h-2.5 w-2.5" />
            </a>
            {curveAddress && (
              <a
                href={`https://basescan.org/address/${curveAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Curve: {shortAddr(curveAddress)} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {record?.creator && (
              <span className="text-[11px] font-mono text-muted-foreground">
                Creator: {shortAddr(record.creator)}
              </span>
            )}
          </div>

          {record && (record.initialDevBuyEth > 0n || record.initialDevBuyTokens > 0n) && (
            <p className="text-[11px] font-mono text-muted-foreground mt-1">
              Dev buy: {Number(formatEther(record.initialDevBuyEth)).toFixed(4)} ETH
              {' '}→ {(Number(formatEther(record.initialDevBuyTokens)) / 1e6).toFixed(2)}M tokens
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 text-right flex-wrap">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Raised</p>
            <p className="font-mono text-sm tabular-nums">{raisedEth.toFixed(4)} ETH</p>
          </div>

          {pendingPlatEth !== undefined && pendingPlatEth > 0n && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Parked fees</p>
              <p className="font-mono text-sm tabular-nums text-primary">
                {Number(formatEther(pendingPlatEth)).toFixed(6)} ETH
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {/* Flush parked platform ETH */}
            {pendingPlatEth !== undefined && pendingPlatEth > 0n && confirmAction !== 'flush' && (
              <button
                onClick={() => { setConfirmAction('flush'); setError(null); setDone(false); }}
                disabled={isPending || isMining}
                className="text-xs font-bold px-3 py-2 bg-primary/20 text-primary border border-primary/30 rounded hover:bg-primary/30 disabled:opacity-30"
              >
                <Zap className="h-3 w-3 inline mr-1" />
                Flush fees
              </button>
            )}

            {/* Force close */}
            {!graduated && !forceClosed && confirmAction !== 'forceClose' && confirmAction !== 'flush' && (
              <button
                onClick={() => { setConfirmAction('forceClose'); setError(null); setDone(false); }}
                disabled={isPending || isMining}
                className="text-xs font-bold px-3 py-2 bg-red-500/90 text-white rounded hover:bg-red-500 disabled:opacity-30"
              >
                Force close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm flush */}
      {confirmAction === 'flush' && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <p className="text-[11px] font-mono text-muted-foreground">
            Flush {Number(formatEther(pendingPlatEth ?? 0n)).toFixed(6)} ETH parked fees to factory?
          </p>
          <button
            onClick={handleFlushPlatformEth}
            disabled={isPending || isMining}
            className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded disabled:opacity-50"
          >
            {isPending ? 'Sign…' : isMining ? 'Mining…' : 'Confirm flush'}
          </button>
          <button
            onClick={() => setConfirmAction(null)}
            disabled={isPending || isMining}
            className="text-xs px-2 py-1.5 text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Confirm force close */}
      {confirmAction === 'forceClose' && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] text-amber-400 font-mono">
            ⚠ This will permanently disable trading on this token. ETH will be returned to your wallet.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleForceClose}
              disabled={isPending || isMining}
              className="text-xs font-bold px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {isPending ? 'Sign…' : isMining ? 'Mining…' : 'Confirm force close'}
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              disabled={isPending || isMining}
              className="text-xs px-2 py-1.5 text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-red-400 font-mono break-all">{error}</p>
      )}
      {done && (
        <p className="mt-2 text-[11px] text-emerald-400 font-mono">
          ✓ Done.{' '}
          <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">
            View tx
          </a>
        </p>
      )}
    </div>
  );
}
