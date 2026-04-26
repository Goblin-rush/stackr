/**
 * V4 buy/sell widget for the bonding curve.
 * Standalone, uses V4_CURVE_ABI / V4_TOKEN_ABI directly.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { useModal } from 'connectkit';
import { formatEther, formatUnits, maxUint256, parseEther, parseUnits } from 'viem';
import { Loader2, ExternalLink, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { V4_FEE_BPS } from '@/lib/contracts';
import { V4_CURVE_ABI, V4_TOKEN_ABI } from '@/lib/v4-abi';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const MAINNET = 1;
const ETHERSCAN = 'https://etherscan.io';

interface Props {
  tokenAddress: `0x${string}`;
  curveAddress: `0x${string}`;
  graduated: boolean;
  cancelled: boolean;
}

export function V4TradeWidget({ tokenAddress, curveAddress, graduated, cancelled }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { setOpen } = useModal();
  const open = () => setOpen(true);
  const wrongChain = isConnected && chainId !== MAINNET;
  const disabled = !isConnected || wrongChain || graduated || cancelled;

  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amountStr, setAmountStr] = useState('');
  const [slippagePct, setSlippagePct] = useState(5);

  const amountWei = useMemo(() => {
    try {
      return mode === 'buy' ? parseEther(amountStr || '0') : parseUnits(amountStr || '0', 18);
    } catch {
      return 0n;
    }
  }, [amountStr, mode]);

  const { data: quote } = useReadContract({
    address: curveAddress,
    abi: V4_CURVE_ABI,
    functionName: mode === 'buy' ? 'quoteBuy' : 'quoteSell',
    args: [amountWei],
    chainId: MAINNET,
    query: { enabled: amountWei > 0n },
  });
  const [out, fee] = (quote as readonly [bigint, bigint] | undefined) ?? [0n, 0n];

  const { data: allowance } = useReadContract({
    address: tokenAddress,
    abi: V4_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, curveAddress] : undefined,
    chainId: MAINNET,
    query: { enabled: !!address && mode === 'sell' },
  });
  const needsApproval = mode === 'sell' && (allowance as bigint | undefined ?? 0n) < amountWei;

  // Balances for max/percent quick-pick
  const { data: ethBal } = useBalance({
    address,
    chainId: MAINNET,
    query: { enabled: !!address, refetchInterval: 8000 },
  });
  const { data: tokenBal } = useReadContract({
    address: tokenAddress,
    abi: V4_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: MAINNET,
    query: { enabled: !!address, refetchInterval: 8000 },
  });
  const ethBalWei = ethBal?.value ?? 0n;
  const tokenBalWei = (tokenBal as bigint | undefined) ?? 0n;
  // Reserve small buffer for gas when using 100% of ETH
  const GAS_BUFFER_WEI = parseEther('0.005');

  const applyPct = (pct: number) => {
    if (mode === 'buy') {
      if (ethBalWei === 0n) return;
      let amt = (ethBalWei * BigInt(pct)) / 100n;
      if (pct >= 100) {
        amt = ethBalWei > GAS_BUFFER_WEI ? ethBalWei - GAS_BUFFER_WEI : 0n;
      }
      setAmountStr(formatEther(amt));
    } else {
      if (tokenBalWei === 0n) return;
      const amt = (tokenBalWei * BigInt(pct)) / 100n;
      setAmountStr(formatUnits(amt, 18));
    }
  };

  const { writeContract: writeTrade, data: tradeHash, isPending: tradePending } = useWriteContract();
  const { isLoading: tradeMining, isSuccess: tradeSuccess } = useWaitForTransactionReceipt({ hash: tradeHash });
  const { writeContract: writeApprove, data: approveHash, isPending: approvePending } = useWriteContract();
  const { isLoading: approveMining, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  useEffect(() => {
    if (tradeSuccess) {
      toast.success(`${mode === 'buy' ? 'Buy' : 'Sell'} success!`);
      setAmountStr('');
    }
  }, [tradeSuccess, mode]);
  useEffect(() => {
    if (approveSuccess) toast.success('Approved');
  }, [approveSuccess]);

  const slippageBps = Math.max(10, Math.min(5000, Math.round(slippagePct * 100)));
  const minOut = (out * BigInt(10000 - slippageBps)) / 10000n;

  const submit = () => {
    if (mode === 'buy') {
      writeTrade({
        address: curveAddress,
        abi: V4_CURVE_ABI,
        functionName: 'buy',
        args: [minOut],
        value: amountWei,
        chainId: MAINNET,
      });
    } else {
      writeTrade({
        address: curveAddress,
        abi: V4_CURVE_ABI,
        functionName: 'sell',
        args: [amountWei, minOut],
        chainId: MAINNET,
      });
    }
  };

  return (
    <div className="border border-border bg-card rounded-xl p-4">
      {graduated && (
        <div className="mb-3 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-400 font-mono">
          Graduated — trade on{' '}
          <a
            href={`https://app.uniswap.org/#/swap?outputCurrency=${tokenAddress}&chain=mainnet`}
            target="_blank"
            rel="noreferrer"
            className="underline font-bold"
          >
            Uniswap V2
          </a>
          .
        </div>
      )}
      {cancelled && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 font-mono">
          Launch cancelled.
        </div>
      )}
      <div className="flex gap-2 mb-3 items-stretch">
        <button
          onClick={() => { setMode('buy'); setAmountStr(''); }}
          className="flex-1 py-2 rounded text-sm font-bold transition bg-emerald-500 text-black hover:bg-emerald-400"
        >
          Buy
        </button>
        <button
          onClick={() => { setMode('buy'); setAmountStr(''); }}
          className="flex-1 py-2 rounded text-sm font-bold transition bg-emerald-500 text-black hover:bg-emerald-400"
        >
          Buy
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Trade settings"
              title={`Slippage ${slippagePct}%`}
              className="px-2.5 rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70 transition inline-flex items-center justify-center"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
                Slippage tolerance
              </span>
              <span className="text-[11px] font-mono font-bold">{slippagePct}%</span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 5, 10, 20].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSlippagePct(v)}
                  className={`flex-1 py-1 rounded text-[11px] font-bold transition ${
                    slippagePct === v
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={slippagePct}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setSlippagePct(Math.max(0.1, Math.min(50, v)));
                }}
                className="flex-1 px-2 py-1 bg-background border border-border rounded text-right font-mono text-[11px]"
                aria-label="Custom slippage percent"
              />
              <span className="text-[11px] text-muted-foreground font-mono">%</span>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground leading-snug">
              Trade reverts if price moves more than this from the quoted amount.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          {mode === 'buy' ? 'Amount in ETH' : 'Token amount'}
        </label>
        {isConnected && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Bal:{' '}
            <span className="text-foreground">
              {mode === 'buy'
                ? `${Number(formatEther(ethBalWei)).toFixed(4)} ETH`
                : `${Number(formatUnits(tokenBalWei, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            </span>
          </span>
        )}
      </div>
      <input
        type="number"
        step="any"
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        placeholder={mode === 'buy' ? '0.01' : '1000'}
        className="w-full mt-1 px-3 py-2 bg-background border border-border rounded font-mono text-sm focus:outline-none focus:border-primary"
      />
      {isConnected && (
        <div className="mt-2 grid grid-cols-5 gap-1">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPct(p)}
              disabled={mode === 'buy' ? ethBalWei === 0n : tokenBalWei === 0n}
              className="py-1 rounded text-[10px] font-bold bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground transition disabled:opacity-40"
            >
              {p}%
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyPct(100)}
            disabled={mode === 'buy' ? ethBalWei === 0n : tokenBalWei === 0n}
            className="py-1 rounded text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary/30 transition disabled:opacity-40"
          >
            MAX
          </button>
        </div>
      )}

      {amountWei > 0n && out > 0n && (
        <div className="mt-3 p-2 bg-muted/30 rounded text-[11px] font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Receive</span>
            <span>
              {mode === 'buy'
                ? `${Number(formatUnits(out, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens`
                : `${Number(formatEther(out)).toFixed(6)} ETH`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fee ({V4_FEE_BPS / 100}% creator)</span>
            <span>{Number(formatEther(fee)).toFixed(6)} ETH</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Min out ({slippagePct}% slip)</span>
            <span>
              {mode === 'buy'
                ? Number(formatUnits(minOut, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                : `${Number(formatEther(minOut)).toFixed(6)} ETH`}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3">
        {!isConnected ? (
          <button
            onClick={() => open()}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded font-bold text-sm hover:bg-primary/90"
          >
            Connect Wallet
          </button>
        ) : wrongChain ? (
          <button
            onClick={() => switchChain({ chainId: MAINNET })}
            className="w-full py-2.5 bg-amber-500 text-black rounded font-bold text-sm hover:bg-amber-400"
          >
            Switch to Mainnet
          </button>
        ) : needsApproval ? (
          <button
            disabled={approvePending || approveMining}
            onClick={() =>
              writeApprove({
                address: tokenAddress,
                abi: V4_TOKEN_ABI,
                functionName: 'approve',
                args: [curveAddress, maxUint256],
                chainId: MAINNET,
              })
            }
            className="w-full py-2.5 bg-primary text-primary-foreground rounded font-bold text-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {(approvePending || approveMining) && <Loader2 className="h-4 w-4 animate-spin" />}
            Approve
          </button>
        ) : (
          <button
            disabled={disabled || tradePending || tradeMining || amountWei === 0n}
            onClick={submit}
            className={`w-full py-2.5 rounded font-bold text-sm disabled:opacity-40 inline-flex items-center justify-center gap-2 ${
              mode === 'buy'
                ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                : 'bg-red-500 text-black hover:bg-red-400'
            }`}
          >
            {(tradePending || tradeMining) && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'buy' ? 'Buy' : 'Sell'}
          </button>
        )}
      </div>
      {tradeHash && (
        <a
          href={`${ETHERSCAN}/tx/${tradeHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 text-[11px] text-blue-400 underline inline-flex items-center gap-1"
        >
          View tx <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
