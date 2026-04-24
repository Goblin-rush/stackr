import { useEffect, useState } from 'react';
import {
  useAccount,
  useConnect,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import { formatEther, parseEther } from 'viem';
import { Navbar } from '@/components/layout/Navbar';
import {
  FACTORY_V3_ABI,
  TOKEN_V3_ABI,
  STACKR_V2_TOKEN_ABI,
  UNISWAP_V2_PAIR_ABI,
  ETH_STACKR_V2_TOKEN,
  ETH_STACKR_V2_PAIR,
} from '@/lib/contracts';
import { useV3Contracts } from '@/hooks/use-v3-contracts';
import { Shield, AlertTriangle, ExternalLink, DollarSign, Database, Zap, Settings } from 'lucide-react';
import NotFound from '@/pages/not-found';

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { factoryAddress, explorerUrl, chainName } = useV3Contracts();

  const { data: factoryOwner, isLoading: ownerLoading } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: FACTORY_V3_ABI,
    functionName: 'owner',
    query: { enabled: !!factoryAddress },
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
          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
            V3 · Uniswap V4 · {chainName}
          </span>
        </div>

        {!factoryAddress ? (
          <div className="border border-amber-500/20 bg-amber-500/5 rounded-md p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-amber-200 font-mono">
              Factory not configured for this network.
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
          <AdminDashboard adminAddress={address!} factoryAddress={factoryAddress} explorerUrl={explorerUrl} />
        )}
      </main>
    </div>
  );
}

function AdminDashboard({ adminAddress, factoryAddress, explorerUrl }: { adminAddress: string; factoryAddress: `0x${string}`; explorerUrl: string }) {
  const factory = factoryAddress;

  const { data: statsData, refetch: refetchStats } = useReadContracts({
    contracts: [
      { address: factory, abi: FACTORY_V3_ABI, functionName: 'totalTokens' },
      { address: factory, abi: FACTORY_V3_ABI, functionName: 'accumulatedPlatformFees' },
    ],
  });

  const total       = statsData?.[0]?.status === 'success' ? Number(statsData[0].result as bigint) : 0;
  const pendingFees = statsData?.[1]?.status === 'success' ? (statsData[1].result as bigint) : 0n;

  const { data: tokenSlots } = useReadContracts({
    contracts: Array.from({ length: total }, (_, i) => ({
      address: factory,
      abi: FACTORY_V3_ABI,
      functionName: 'allTokens' as const,
      args: [BigInt(i)] as [bigint],
    })),
    query: { enabled: total > 0 },
  });

  const tokenAddresses = (tokenSlots ?? [])
    .map((r) => (r?.status === 'success' ? (r.result as `0x${string}`) : null))
    .filter((a): a is `0x${string}` => !!a)
    .reverse();

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [withdrawAmount, setWithdrawAmount] = useState('');
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
      const amount = withdrawAmount ? parseEther(withdrawAmount as `${number}`) : pendingFees;
      await writeContractAsync({
        address: factory,
        abi: FACTORY_V3_ABI,
        functionName: 'withdrawPlatformFees',
        args: [adminAddress as `0x${string}`, amount],
      });
    } catch (e: any) {
      setWithdrawError(e?.shortMessage || e?.message || 'Transaction failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Connected as" value={shortAddr(adminAddress)} />
        <StatCard label="Factory V3" value={shortAddr(factory)} link={`${explorerUrl}/address/${factory}`} />
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
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Accumulated</p>
            <p className="font-mono text-base tabular-nums text-primary font-bold">
              {Number(formatEther(pendingFees)).toFixed(6)} ETH
            </p>
          </div>
          <div className="flex-1 min-w-[140px]">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Amount to withdraw</p>
            <input
              type="number"
              placeholder={Number(formatEther(pendingFees)).toFixed(6)}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full text-xs font-mono px-2 py-1.5 bg-background border border-border rounded text-foreground"
            />
          </div>
          <button
            onClick={handleWithdrawFees}
            disabled={pendingFees === 0n || isPending || isMining}
            className="ml-auto text-xs font-bold px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isPending ? 'Sign…' : isMining ? 'Mining…' : 'Withdraw'}
          </button>
        </div>
        {withdrawError && (
          <p className="mt-2 text-[11px] text-red-400 font-mono break-all">{withdrawError}</p>
        )}
        {withdrawDone && (
          <p className="mt-2 text-[11px] text-emerald-400 font-mono">
            Withdrawn.{' '}
            <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">
              View tx
            </a>
          </p>
        )}
      </div>

      {/* StackrV2 Token Management */}
      <StackrV2Panel adminAddress={adminAddress} />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Deployed tokens ({total})
          </h2>
        </div>
        {total === 0 ? (
          <div className="border border-border rounded-md bg-card p-8 text-center text-sm text-muted-foreground font-mono">
            No tokens deployed via this factory yet.
          </div>
        ) : (
          <div className="space-y-2">
            {tokenAddresses.map((addr) => (
              <AdminTokenRow key={addr} tokenAddress={addr} adminAddress={adminAddress as `0x${string}`} factoryAddress={factory} explorerUrl={explorerUrl} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StackrV2Panel({ adminAddress }: { adminAddress: string }) {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const { data: tokenData, refetch: refetchToken } = useReadContracts({
    contracts: [
      { address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI, functionName: 'taxBps' },
      { address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI, functionName: 'platformWallet' },
      { address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI, functionName: 'rewardsWallet' },
      { address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI, functionName: 'uniswapV2Pair' },
      { address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI, functionName: 'owner' },
      { address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI, functionName: 'balanceOf', args: [adminAddress as `0x${string}`] },
    ],
    query: { enabled: chainId === 1 },
  });

  const { data: pairData } = useReadContracts({
    contracts: [
      { address: ETH_STACKR_V2_PAIR, abi: UNISWAP_V2_PAIR_ABI, functionName: 'getReserves' },
    ],
    query: { enabled: chainId === 1 },
  });

  const taxBps        = tokenData?.[0]?.status === 'success' ? Number(tokenData[0].result as bigint) : null;
  const platformWallet = tokenData?.[1]?.status === 'success' ? (tokenData[1].result as string) : null;
  const rewardsWallet  = tokenData?.[2]?.status === 'success' ? (tokenData[2].result as string) : null;
  const pairAddr       = tokenData?.[3]?.status === 'success' ? (tokenData[3].result as string) : null;
  const owner          = tokenData?.[4]?.status === 'success' ? (tokenData[4].result as string) : null;
  const balance        = tokenData?.[5]?.status === 'success' ? (tokenData[5].result as bigint) : 0n;
  const reserves       = pairData?.[0]?.status === 'success' ? (pairData[0].result as [bigint, bigint, number]) : null;

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [newTax, setNewTax]             = useState('');
  const [newPlatform, setNewPlatform]   = useState('');
  const [newRewards, setNewRewards]     = useState('');
  const [newPair, setNewPair]           = useState('');
  const [actionError, setActionError]   = useState<string | null>(null);
  const [actionDone, setActionDone]     = useState<string | null>(null);
  const [confirmRenounce, setConfirmRenounce] = useState(false);

  useEffect(() => {
    if (isSuccess) { refetchToken(); setActionDone('Done'); }
  }, [isSuccess, refetchToken]);

  const exec = async (fn: () => Promise<void>) => {
    setActionError(null); setActionDone(null);
    try { await fn(); } catch (e: any) { setActionError(e?.shortMessage || e?.message || 'Failed'); }
  };

  const needsEth = chainId !== 1;

  return (
    <div className="border border-primary/30 rounded-md bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground font-mono">
          STACKR V2 — ETH Mainnet Tax Token
        </h2>
        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded uppercase">
          Live · Uniswap V2
        </span>
      </div>

      {needsEth ? (
        <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs font-mono text-amber-300">Switch to Ethereum mainnet to manage this token.</p>
          <button
            onClick={() => switchChain({ chainId: 1 })}
            className="ml-auto text-xs font-bold px-3 py-1.5 bg-amber-500 text-black rounded hover:bg-amber-400"
          >
            Switch
          </button>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            <div className="border border-border rounded p-2">
              <p className="text-muted-foreground text-[10px] uppercase">Tax</p>
              <p className="font-bold text-primary">{taxBps !== null ? `${(taxBps / 100).toFixed(2)}%` : '…'}</p>
            </div>
            <div className="border border-border rounded p-2">
              <p className="text-muted-foreground text-[10px] uppercase">Owner</p>
              <p className="font-bold truncate">{owner ? shortAddr(owner) : '…'}</p>
            </div>
            <div className="border border-border rounded p-2 col-span-2">
              <p className="text-muted-foreground text-[10px] uppercase">Admin STACKR Balance</p>
              <p className="font-bold">{(Number(balance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })} STACKR</p>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
            {[
              { label: 'Token', addr: ETH_STACKR_V2_TOKEN },
              { label: 'V2 Pair', addr: ETH_STACKR_V2_PAIR },
              { label: 'Platform Wallet', addr: platformWallet },
              { label: 'Rewards Wallet', addr: rewardsWallet },
            ].map(({ label, addr }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-muted-foreground w-28 shrink-0">{label}:</span>
                {addr ? (
                  <a
                    href={`https://etherscan.io/address/${addr}`}
                    target="_blank" rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {shortAddr(addr)} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : <span className="text-muted-foreground">…</span>}
              </div>
            ))}
          </div>

          {/* Reserves */}
          {reserves && (
            <p className="text-[11px] font-mono text-muted-foreground">
              V2 Reserves: {Number(reserves[0]) / 1e18 < 1
                ? `${(Number(reserves[0]) / 1e18).toFixed(6)} ETH`
                : `${(Number(reserves[0]) / 1e18).toLocaleString()} STACKR`
              } / {Number(reserves[1]) / 1e18 < 1
                ? `${(Number(reserves[1]) / 1e18).toFixed(6)} ETH`
                : `${(Number(reserves[1]) / 1e18).toLocaleString()} STACKR`
              }
            </p>
          )}

          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-1 mb-3">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Owner controls</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* setTax */}
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Set Tax (bps, max 500)</p>
                <div className="flex gap-2">
                  <input type="number" placeholder={taxBps?.toString() ?? '300'} value={newTax} onChange={e => setNewTax(e.target.value)}
                    className="flex-1 text-xs font-mono px-2 py-1.5 bg-background border border-border rounded text-foreground" />
                  <button
                    disabled={!newTax || isPending || isMining}
                    onClick={() => exec(() => writeContractAsync({
                      address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI,
                      functionName: 'setTax', args: [BigInt(newTax)],
                    }))}
                    className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-30"
                  >
                    {isPending || isMining ? '…' : 'Set'}
                  </button>
                </div>
              </div>

              {/* setPair */}
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Set V2 Pair</p>
                <div className="flex gap-2">
                  <input type="text" placeholder={pairAddr ?? '0x…'} value={newPair} onChange={e => setNewPair(e.target.value)}
                    className="flex-1 text-xs font-mono px-2 py-1.5 bg-background border border-border rounded text-foreground" />
                  <button
                    disabled={!newPair || isPending || isMining}
                    onClick={() => exec(() => writeContractAsync({
                      address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI,
                      functionName: 'setPair', args: [newPair as `0x${string}`],
                    }))}
                    className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-30"
                  >
                    {isPending || isMining ? '…' : 'Set'}
                  </button>
                </div>
              </div>

              {/* setWallets */}
              <div className="space-y-1 md:col-span-2">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Set Wallets (platform, rewards)</p>
                <div className="flex gap-2 flex-wrap">
                  <input type="text" placeholder="Platform 0x…" value={newPlatform} onChange={e => setNewPlatform(e.target.value)}
                    className="flex-1 min-w-[140px] text-xs font-mono px-2 py-1.5 bg-background border border-border rounded text-foreground" />
                  <input type="text" placeholder="Rewards 0x…" value={newRewards} onChange={e => setNewRewards(e.target.value)}
                    className="flex-1 min-w-[140px] text-xs font-mono px-2 py-1.5 bg-background border border-border rounded text-foreground" />
                  <button
                    disabled={!newPlatform || !newRewards || isPending || isMining}
                    onClick={() => exec(() => writeContractAsync({
                      address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI,
                      functionName: 'setWallets',
                      args: [newPlatform as `0x${string}`, newRewards as `0x${string}`],
                    }))}
                    className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-30"
                  >
                    {isPending || isMining ? '…' : 'Set'}
                  </button>
                </div>
              </div>
            </div>

            {/* Links */}
            <div className="flex gap-3 mt-3 flex-wrap">
              <a
                href={`https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=${ETH_STACKR_V2_TOKEN}&chain=mainnet`}
                target="_blank" rel="noreferrer"
                className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                Trade on Uniswap <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href={`https://v2.info.uniswap.org/pair/${ETH_STACKR_V2_PAIR}`}
                target="_blank" rel="noreferrer"
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                V2 Pair info <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href={`https://etherscan.io/token/${ETH_STACKR_V2_TOKEN}`}
                target="_blank" rel="noreferrer"
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Etherscan <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            {/* Renounce ownership */}
            <div className="mt-4 pt-3 border-t border-border">
              {!confirmRenounce ? (
                <button
                  onClick={() => setConfirmRenounce(true)}
                  className="text-[11px] font-mono text-red-400/60 hover:text-red-400 underline"
                >
                  Renounce ownership
                </button>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-red-400 font-mono">⚠ This permanently removes owner access. Irreversible.</p>
                  <div className="flex gap-2">
                    <button
                      disabled={isPending || isMining}
                      onClick={() => exec(() => writeContractAsync({
                        address: ETH_STACKR_V2_TOKEN, abi: STACKR_V2_TOKEN_ABI,
                        functionName: 'renounceOwnership',
                      }))}
                      className="text-xs font-bold px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50"
                    >
                      {isPending || isMining ? '…' : 'Confirm renounce'}
                    </button>
                    <button onClick={() => setConfirmRenounce(false)} className="text-xs px-2 py-1.5 text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {actionError && <p className="mt-2 text-[11px] text-red-400 font-mono break-all">{actionError}</p>}
            {actionDone && txHash && (
              <p className="mt-2 text-[11px] text-emerald-400 font-mono">
                {actionDone}.{' '}
                <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">View tx</a>
              </p>
            )}
          </div>
        </>
      )}
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
  factoryAddress,
  explorerUrl,
}: {
  tokenAddress: `0x${string}`;
  adminAddress: `0x${string}`;
  factoryAddress: `0x${string}`;
  explorerUrl: string;
}) {
  const factory = factoryAddress;

  const { data: recordData } = useReadContract({
    address: factory,
    abi: FACTORY_V3_ABI,
    functionName: 'getRecord',
    args: [tokenAddress],
  });
  const record = recordData as {
    token: `0x${string}`;
    creator: `0x${string}`;
    deployedAt: bigint;
    metadataURI: string;
    poolKey: {
      currency0: `0x${string}`;
      currency1: `0x${string}`;
      fee: number;
      tickSpacing: number;
      hooks: `0x${string}`;
    };
  } | undefined;

  const { data: tokenMeta } = useReadContracts({
    contracts: [
      { address: tokenAddress, abi: TOKEN_V3_ABI, functionName: 'name' },
      { address: tokenAddress, abi: TOKEN_V3_ABI, functionName: 'symbol' },
    ],
  });

  const name   = tokenMeta?.[0]?.result as string | undefined;
  const symbol = tokenMeta?.[1]?.result as string | undefined;

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [confirmLP, setConfirmLP] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isSuccess) setDone(true);
  }, [isSuccess]);

  const handleWithdrawLP = async () => {
    setError(null);
    setDone(false);
    try {
      await writeContractAsync({
        address: factory,
        abi: FACTORY_V3_ABI,
        functionName: 'withdrawLP',
        args: [tokenAddress, adminAddress],
      });
      setConfirmLP(false);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Transaction failed');
    }
  };

  const deployedAt = record?.deployedAt ? new Date(Number(record.deployedAt) * 1000).toLocaleDateString() : '–';

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
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded uppercase tracking-wider">
              V4 Pool
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <a
              href={`${explorerUrl}/address/${tokenAddress}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Token: {shortAddr(tokenAddress)} <ExternalLink className="h-2.5 w-2.5" />
            </a>
            {record?.creator && (
              <span className="text-[11px] font-mono text-muted-foreground">
                Creator: {shortAddr(record.creator)}
              </span>
            )}
            <span className="text-[11px] font-mono text-muted-foreground">
              Deployed: {deployedAt}
            </span>
          </div>

          {record?.poolKey && (
            <p className="text-[11px] font-mono text-muted-foreground/60 mt-1">
              Pool: fee={record.poolKey.fee} tickSpacing={record.poolKey.tickSpacing}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!confirmLP ? (
            <button
              onClick={() => { setConfirmLP(true); setError(null); setDone(false); }}
              disabled={isPending || isMining}
              className="text-xs font-bold px-3 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/30 disabled:opacity-30"
            >
              Withdraw LP
            </button>
          ) : null}
        </div>
      </div>

      {confirmLP && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] text-amber-400 font-mono">
            This will remove the LP position from the V4 pool. Action is logged on-chain via LPWithdrawn event.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleWithdrawLP}
              disabled={isPending || isMining}
              className="text-xs font-bold px-3 py-1.5 bg-amber-500 text-black rounded hover:bg-amber-400 disabled:opacity-50"
            >
              {isPending ? 'Sign…' : isMining ? 'Mining…' : 'Confirm withdraw LP'}
            </button>
            <button
              onClick={() => setConfirmLP(false)}
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
          Done.{' '}
          <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">
            View tx
          </a>
        </p>
      )}
    </div>
  );
}
