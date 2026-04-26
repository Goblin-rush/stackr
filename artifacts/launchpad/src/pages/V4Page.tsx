import { useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { formatEther, parseEther, formatUnits, parseUnits, maxUint256 } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  ETH_FACTORY_V4_ADDRESS,
  V4_BOND_THRESHOLD_WEI,
  V4_CURVE_TOKEN_SUPPLY,
  V4_FEE_BPS,
} from '@/lib/contracts';
import { V4_FACTORY_ABI, V4_CURVE_ABI, V4_TOKEN_ABI } from '@/lib/v4-abi';

const MAINNET_CHAIN_ID = 1;
const ETHERSCAN = 'https://etherscan.io';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtEth = (v?: bigint, dp = 6) =>
  v === undefined ? '—' : Number(formatEther(v)).toFixed(dp);
const fmtToken = (v?: bigint, dp = 4) =>
  v === undefined ? '—' : Number(formatUnits(v, 18)).toLocaleString(undefined, { maximumFractionDigits: dp });
const fmtAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');

// ─── Page ──────────────────────────────────────────────────────────────────
export default function V4Page() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { open } = useAppKit();
  const wrongChain = isConnected && chainId !== MAINNET_CHAIN_ID;

  // Owner check
  const { data: factoryOwner } = useReadContract({
    address: ETH_FACTORY_V4_ADDRESS,
    abi: V4_FACTORY_ABI,
    functionName: 'owner',
    chainId: MAINNET_CHAIN_ID,
  });
  const isOwner =
    address && factoryOwner ? address.toLowerCase() === (factoryOwner as string).toLowerCase() : false;

  // Token list
  const { data: allTokens, refetch: refetchAll } = useReadContract({
    address: ETH_FACTORY_V4_ADDRESS,
    abi: V4_FACTORY_ABI,
    functionName: 'getAllTokens',
    chainId: MAINNET_CHAIN_ID,
  });
  const tokens = (allTokens as `0x${string}`[] | undefined) ?? [];

  const [selected, setSelected] = useState<`0x${string}` | null>(null);
  useEffect(() => {
    if (!selected && tokens.length) setSelected(tokens[tokens.length - 1]);
  }, [tokens, selected]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Stackr V4 — Bonding Curve Launchpad</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Mainnet test page · factory{' '}
            <a
              href={`${ETHERSCAN}/address/${ETH_FACTORY_V4_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {fmtAddr(ETH_FACTORY_V4_ADDRESS)} <ExternalLink className="inline h-3 w-3" />
            </a>
            {isOwner && <Badge className="ml-2 bg-emerald-600">FACTORY OWNER</Badge>}
          </p>
        </div>
        <div className="flex gap-2">
          {!isConnected ? (
            <Button onClick={() => open()}>Connect Wallet</Button>
          ) : wrongChain ? (
            <Button onClick={() => switchChain({ chainId: MAINNET_CHAIN_ID })}>Switch to Mainnet</Button>
          ) : (
            <Badge variant="outline">{fmtAddr(address)}</Badge>
          )}
        </div>
      </div>

      {wrongChain && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded text-yellow-200 text-sm">
          Switch to Ethereum Mainnet (chainId 1) to interact with V4 contracts.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <DeployTokenCard onDeployed={() => refetchAll()} disabled={!isConnected || wrongChain} />
        <TokenListCard tokens={tokens} selected={selected} onSelect={setSelected} />
      </div>

      {selected && (
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <CurveStateCard tokenAddr={selected} />
          <TradeCard tokenAddr={selected} disabled={!isConnected || wrongChain} />
        </div>
      )}

      {selected && isOwner && (
        <div className="mt-6">
          <OwnerControls tokenAddr={selected} ownerAddr={address!} />
        </div>
      )}
    </div>
  );
}

// ─── Deploy Card ────────────────────────────────────────────────────────────
function DeployTokenCard({ onDeployed, disabled }: { onDeployed: () => void; disabled: boolean }) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [metaURI, setMetaURI] = useState('ipfs://');
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      toast.success('Token deployed!');
      setName(''); setSymbol(''); setMetaURI('ipfs://');
      onDeployed();
    }
  }, [isSuccess, onDeployed]);

  return (
    <Card>
      <CardHeader><CardTitle>Deploy New V4 Token</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Token" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Symbol</label>
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="MTK" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Metadata URI</label>
          <Input value={metaURI} onChange={(e) => setMetaURI(e.target.value)} placeholder="ipfs://..." />
        </div>
        <Button
          className="w-full"
          disabled={disabled || isPending || isMining || !name || !symbol}
          onClick={() => {
            writeContract({
              address: ETH_FACTORY_V4_ADDRESS,
              abi: V4_FACTORY_ABI,
              functionName: 'deployToken',
              args: [name, symbol, metaURI],
              chainId: MAINNET_CHAIN_ID,
            });
          }}
        >
          {(isPending || isMining) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isPending ? 'Confirm in wallet…' : isMining ? 'Mining…' : 'Deploy Token'}
        </Button>
        {hash && (
          <a
            href={`${ETHERSCAN}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 underline block"
          >
            View tx <ExternalLink className="inline h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Token List ─────────────────────────────────────────────────────────────
function TokenListCard({
  tokens,
  selected,
  onSelect,
}: {
  tokens: `0x${string}`[];
  selected: `0x${string}` | null;
  onSelect: (a: `0x${string}`) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Deployed Tokens ({tokens.length})</CardTitle></CardHeader>
      <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
        {tokens.length === 0 && <p className="text-sm text-muted-foreground">No tokens deployed yet.</p>}
        {tokens.slice().reverse().map((t) => (
          <button
            key={t}
            onClick={() => onSelect(t)}
            className={`w-full text-left p-2 rounded border ${
              selected === t ? 'border-emerald-500 bg-emerald-950/20' : 'border-border'
            } hover:bg-muted/40`}
          >
            <TokenRow tokenAddr={t} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function TokenRow({ tokenAddr }: { tokenAddr: `0x${string}` }) {
  const { data } = useReadContracts({
    contracts: [
      { address: tokenAddr, abi: V4_TOKEN_ABI, functionName: 'name', chainId: MAINNET_CHAIN_ID },
      { address: tokenAddr, abi: V4_TOKEN_ABI, functionName: 'symbol', chainId: MAINNET_CHAIN_ID },
    ],
  });
  const name = data?.[0]?.result as string | undefined;
  const symbol = data?.[1]?.result as string | undefined;
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-semibold">{symbol ?? '…'}</div>
        <div className="text-xs text-muted-foreground">{name ?? '…'}</div>
      </div>
      <span className="text-xs font-mono">{fmtAddr(tokenAddr)}</span>
    </div>
  );
}

// ─── Curve State ────────────────────────────────────────────────────────────
function CurveStateCard({ tokenAddr }: { tokenAddr: `0x${string}` }) {
  const { data: rec } = useReadContract({
    address: ETH_FACTORY_V4_ADDRESS,
    abi: V4_FACTORY_ABI,
    functionName: 'getRecord',
    args: [tokenAddr],
    chainId: MAINNET_CHAIN_ID,
  });
  const curve = (rec as any)?.curve as `0x${string}` | undefined;
  const creator = (rec as any)?.creator as `0x${string}` | undefined;

  const { data: state, refetch } = useReadContract({
    address: curve,
    abi: V4_CURVE_ABI,
    functionName: 'getCurveState',
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!curve, refetchInterval: 5000 },
  });
  const { data: feesAccrued } = useReadContract({
    address: curve,
    abi: V4_CURVE_ABI,
    functionName: 'creatorFeesAccrued',
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!curve, refetchInterval: 5000 },
  });
  const { data: v2Pair } = useReadContract({
    address: curve,
    abi: V4_CURVE_ABI,
    functionName: 'v2Pair',
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!curve },
  });

  const [realEth, tokensSold, priceWeiPerToken, pctBps, graduated, cancelled] =
    (state as readonly [bigint, bigint, bigint, bigint, boolean, boolean] | undefined) ?? [];

  const status = graduated
    ? 'GRADUATED'
    : cancelled
      ? 'CANCELLED'
      : 'ACTIVE';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Curve State
          <Badge
            className={
              status === 'GRADUATED'
                ? 'bg-emerald-600'
                : status === 'CANCELLED'
                  ? 'bg-red-600'
                  : 'bg-blue-600'
            }
          >
            {status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm font-mono">
        <Row label="Token">
          <a href={`${ETHERSCAN}/address/${tokenAddr}`} target="_blank" rel="noopener noreferrer" className="underline">
            {fmtAddr(tokenAddr)} <ExternalLink className="inline h-3 w-3" />
          </a>
        </Row>
        <Row label="Curve">
          {curve ? (
            <a href={`${ETHERSCAN}/address/${curve}`} target="_blank" rel="noopener noreferrer" className="underline">
              {fmtAddr(curve)} <ExternalLink className="inline h-3 w-3" />
            </a>
          ) : '—'}
        </Row>
        <Row label="Creator">
          {creator ? (
            <a href={`${ETHERSCAN}/address/${creator}`} target="_blank" rel="noopener noreferrer" className="underline">
              {fmtAddr(creator)}
            </a>
          ) : '—'}
        </Row>
        <Row label="Real ETH bonded">
          {fmtEth(realEth as bigint)} / {fmtEth(V4_BOND_THRESHOLD_WEI)} ETH
          {pctBps !== undefined && ` (${(Number(pctBps) / 100).toFixed(2)}%)`}
        </Row>
        <Row label="Tokens sold">
          {fmtToken(tokensSold as bigint)} / {fmtToken(V4_CURVE_TOKEN_SUPPLY)}
        </Row>
        <Row label="Price/token">
          {priceWeiPerToken !== undefined ? `${fmtEth(priceWeiPerToken as bigint, 12)} ETH` : '—'}
        </Row>
        <Row label="Creator fees accrued">{fmtEth(feesAccrued as bigint | undefined)} ETH</Row>
        {graduated && v2Pair && (v2Pair as string) !== '0x0000000000000000000000000000000000000000' && (
          <Row label="V2 Pair">
            <a
              href={`${ETHERSCAN}/address/${v2Pair}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {fmtAddr(v2Pair as string)} <ExternalLink className="inline h-3 w-3" />
            </a>
          </Row>
        )}
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

// ─── Trade Card ─────────────────────────────────────────────────────────────
function TradeCard({ tokenAddr, disabled }: { tokenAddr: `0x${string}`; disabled: boolean }) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amountStr, setAmountStr] = useState('');
  const { address } = useAccount();

  const { data: rec } = useReadContract({
    address: ETH_FACTORY_V4_ADDRESS,
    abi: V4_FACTORY_ABI,
    functionName: 'getRecord',
    args: [tokenAddr],
    chainId: MAINNET_CHAIN_ID,
  });
  const curve = (rec as any)?.curve as `0x${string}` | undefined;

  // Quote
  const amountWei = useMemo(() => {
    try {
      return mode === 'buy' ? parseEther(amountStr || '0') : parseUnits(amountStr || '0', 18);
    } catch {
      return 0n;
    }
  }, [amountStr, mode]);

  const { data: quote } = useReadContract({
    address: curve,
    abi: V4_CURVE_ABI,
    functionName: mode === 'buy' ? 'quoteBuy' : 'quoteSell',
    args: [amountWei],
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!curve && amountWei > 0n },
  });

  const [out, fee] = (quote as readonly [bigint, bigint] | undefined) ?? [0n, 0n];

  // Allowance check (sell only)
  const { data: allowance } = useReadContract({
    address: tokenAddr,
    abi: V4_TOKEN_ABI,
    functionName: 'allowance',
    args: address && curve ? [address, curve] : undefined,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!address && !!curve && mode === 'sell' },
  });
  const needsApproval = mode === 'sell' && (allowance as bigint | undefined ?? 0n) < amountWei;

  const { writeContract: writeTrade, data: tradeHash, isPending: tradePending } = useWriteContract();
  const { isLoading: tradeMining, isSuccess: tradeSuccess } = useWaitForTransactionReceipt({ hash: tradeHash });
  const { writeContract: writeApprove, data: approveHash, isPending: approvePending } = useWriteContract();
  const { isLoading: approveMining, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  useEffect(() => {
    if (tradeSuccess) {
      toast.success(`${mode === 'buy' ? 'Buy' : 'Sell'} successful!`);
      setAmountStr('');
    }
  }, [tradeSuccess, mode]);
  useEffect(() => {
    if (approveSuccess) toast.success('Approved!');
  }, [approveSuccess]);

  const slippageBps = 500; // 5%
  const minOut = (out * BigInt(10000 - slippageBps)) / 10000n;

  const submit = () => {
    if (!curve) return;
    if (mode === 'buy') {
      writeTrade({
        address: curve,
        abi: V4_CURVE_ABI,
        functionName: 'buy',
        args: [minOut],
        value: amountWei,
        chainId: MAINNET_CHAIN_ID,
      });
    } else {
      writeTrade({
        address: curve,
        abi: V4_CURVE_ABI,
        functionName: 'sell',
        args: [amountWei, minOut],
        chainId: MAINNET_CHAIN_ID,
      });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Trade</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant={mode === 'buy' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => { setMode('buy'); setAmountStr(''); }}
          >
            Buy
          </Button>
          <Button
            variant={mode === 'sell' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => { setMode('sell'); setAmountStr(''); }}
          >
            Sell
          </Button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            {mode === 'buy' ? 'Amount in ETH' : 'Token amount'}
          </label>
          <Input
            type="number"
            step="any"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder={mode === 'buy' ? '0.01' : '1000'}
          />
        </div>
        {amountWei > 0n && out > 0n && (
          <div className="p-2 bg-muted/30 rounded text-xs space-y-1 font-mono">
            <div className="flex justify-between">
              <span>You'll receive</span>
              <span>{mode === 'buy' ? `${fmtToken(out)} tokens` : `${fmtEth(out)} ETH`}</span>
            </div>
            <div className="flex justify-between">
              <span>Fee ({V4_FEE_BPS / 100}% to creator)</span>
              <span>{fmtEth(fee)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span>Min out (5% slippage)</span>
              <span>{mode === 'buy' ? fmtToken(minOut) : `${fmtEth(minOut)} ETH`}</span>
            </div>
          </div>
        )}
        {needsApproval ? (
          <Button
            className="w-full"
            disabled={disabled || approvePending || approveMining}
            onClick={() =>
              writeApprove({
                address: tokenAddr,
                abi: V4_TOKEN_ABI,
                functionName: 'approve',
                args: [curve!, maxUint256],
                chainId: MAINNET_CHAIN_ID,
              })
            }
          >
            {(approvePending || approveMining) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Approve
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={disabled || tradePending || tradeMining || amountWei === 0n}
            onClick={submit}
          >
            {(tradePending || tradeMining) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === 'buy' ? 'Buy' : 'Sell'}
          </Button>
        )}
        {tradeHash && (
          <a
            href={`${ETHERSCAN}/tx/${tradeHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 underline block"
          >
            View tx <ExternalLink className="inline h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Owner Controls ─────────────────────────────────────────────────────────
function OwnerControls({ tokenAddr, ownerAddr }: { tokenAddr: `0x${string}`; ownerAddr: `0x${string}` }) {
  const { data: rec } = useReadContract({
    address: ETH_FACTORY_V4_ADDRESS,
    abi: V4_FACTORY_ABI,
    functionName: 'getRecord',
    args: [tokenAddr],
    chainId: MAINNET_CHAIN_ID,
  });
  const curve = (rec as any)?.curve as `0x${string}` | undefined;

  const { data: graduated } = useReadContract({
    address: curve,
    abi: V4_CURVE_ABI,
    functionName: 'graduated',
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!curve, refetchInterval: 5000 },
  });
  const { data: cancelled } = useReadContract({
    address: curve,
    abi: V4_CURVE_ABI,
    functionName: 'cancelled',
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!curve, refetchInterval: 5000 },
  });

  const [recipient, setRecipient] = useState(ownerAddr);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (isSuccess) toast.success('Owner action confirmed');
  }, [isSuccess]);

  const callOwner = (fn: 'cancelLaunch' | 'withdrawCurveEth' | 'withdrawCurveTokens' | 'withdrawLP') => {
    if (fn === 'cancelLaunch') {
      writeContract({
        address: ETH_FACTORY_V4_ADDRESS,
        abi: V4_FACTORY_ABI,
        functionName: fn,
        args: [tokenAddr],
        chainId: MAINNET_CHAIN_ID,
      });
    } else {
      writeContract({
        address: ETH_FACTORY_V4_ADDRESS,
        abi: V4_FACTORY_ABI,
        functionName: fn,
        args: [tokenAddr, recipient],
        chainId: MAINNET_CHAIN_ID,
      });
    }
  };

  const busy = isPending || mining;

  return (
    <Card className="border-amber-700/40">
      <CardHeader>
        <CardTitle className="text-amber-400">Owner Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Recipient address</label>
          <Input value={recipient} onChange={(e) => setRecipient(e.target.value as `0x${string}`)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="destructive"
            disabled={busy || graduated as boolean || cancelled as boolean}
            onClick={() => callOwner('cancelLaunch')}
          >
            cancelLaunch
          </Button>
          <Button
            variant="outline"
            disabled={busy || !cancelled}
            onClick={() => callOwner('withdrawCurveEth')}
          >
            withdrawCurveEth
          </Button>
          <Button
            variant="outline"
            disabled={busy || !cancelled}
            onClick={() => callOwner('withdrawCurveTokens')}
          >
            withdrawCurveTokens
          </Button>
          <Button
            variant="outline"
            disabled={busy || !graduated}
            onClick={() => callOwner('withdrawLP')}
          >
            withdrawLP
          </Button>
        </div>
        {hash && (
          <a
            href={`${ETHERSCAN}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 underline block"
          >
            View tx <ExternalLink className="inline h-3 w-3" />
          </a>
        )}
        <p className="text-xs text-muted-foreground">
          Cancel only works pre-grad/pre-cancel. WithdrawCurveEth/Tokens require cancelled state.
          WithdrawLP requires graduated state.
        </p>
      </CardContent>
    </Card>
  );
}
