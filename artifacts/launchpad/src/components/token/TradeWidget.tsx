import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAccount, useBalance, useConnect } from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import { parseEther, formatEther, formatUnits, parseUnits, maxUint256 } from 'viem';
import {
  useToken, useTokenBalance, useTokenPreviewBuy, useTokenPreviewSell,
  useTokenTrade, useTokenAllowance,
} from '@/hooks/use-token';
import { TOKEN_V2_ABI, CURVE_V2_ABI } from '@/lib/contracts';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useSlippage } from '@/hooks/use-slippage';
import { SlippageSettings } from '@/components/token/SlippageSettings';
import { txPendingToast, txSubmittedToast, txSuccessToast, txErrorToast } from '@/lib/tx-toast';

interface TradeWidgetProps {
  tokenAddress: `0x${string}`;
  curveAddress?: `0x${string}`;
}

const BUY_QUICK = ['0.01', '0.05', '0.1', '0.5'];

export function TradeWidget({ tokenAddress, curveAddress }: TradeWidgetProps) {
  const { isConnected, address: userAddress } = useAccount();
  const { connect } = useConnect();
  const { data: ethBalance } = useBalance({ address: userAddress });
  const { data: tokenBalance } = useTokenBalance(tokenAddress, userAddress);
  const { graduated, symbol, forceClosed, uniswapPair } = useToken(tokenAddress, curveAddress);
  const { applyMinOut, percent: slippagePercent } = useSlippage();

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');

  const buyAmountWei  = buyAmount  && !isNaN(Number(buyAmount))  ? parseEther(buyAmount as `${number}`)   : 0n;
  const sellAmountWei = sellAmount && !isNaN(Number(sellAmount)) ? parseUnits(sellAmount, 18)              : 0n;

  const { data: previewTokensOut } = useTokenPreviewBuy(curveAddress, buyAmountWei);
  const { data: previewEthOut }    = useTokenPreviewSell(curveAddress, sellAmountWei, userAddress);

  const { allowance, refetch: refetchAllowance } = useTokenAllowance(tokenAddress, userAddress, curveAddress);

  const { writeContractAsync, isPending, isConfirming, isConfirmed, hash } = useTokenTrade();

  const pendingToastRef = useRef<{ id: string | number; label: string; expectedHash: `0x${string}` | null } | null>(null);

  useEffect(() => {
    const p = pendingToastRef.current;
    if (hash && p && p.expectedHash === hash) txSubmittedToast(p.id, hash, p.label);
  }, [hash]);

  useEffect(() => {
    const p = pendingToastRef.current;
    if (isConfirmed && hash && p && p.expectedHash === hash) {
      txSuccessToast(p.id, hash, `${p.label} confirmed`);
      pendingToastRef.current = null;
      refetchAllowance();
    }
  }, [isConfirmed, hash, refetchAllowance]);

  const handleBuy = async () => {
    if (!isConnected) { connect({ connector: metaMask() }); return; }
    if (!buyAmountWei || !curveAddress) return;
    const id = txPendingToast(`Buying ${symbol || 'tokens'}`);
    pendingToastRef.current = { id, label: `Bought ${symbol || 'tokens'}`, expectedHash: null };
    try {
      const minTokensOut = previewTokensOut ? applyMinOut(previewTokensOut) : 0n;
      const txHash = await writeContractAsync({
        address: curveAddress,
        abi: CURVE_V2_ABI,
        functionName: 'buy',
        args: [minTokensOut],
        value: buyAmountWei,
      });
      if (pendingToastRef.current) pendingToastRef.current.expectedHash = txHash;
      setBuyAmount('');
    } catch (error) {
      txErrorToast(id, error);
      pendingToastRef.current = null;
    }
  };

  const handleSell = async () => {
    if (!isConnected) { connect({ connector: metaMask() }); return; }
    if (!sellAmountWei || !curveAddress) return;
    const id = txPendingToast(`Selling ${symbol || 'tokens'}`);
    pendingToastRef.current = { id, label: `Sold ${symbol || 'tokens'}`, expectedHash: null };
    try {
      const minEthOut = previewEthOut ? applyMinOut(previewEthOut) : 0n;
      if (allowance === undefined || allowance < sellAmountWei) {
        await writeContractAsync({
          address: tokenAddress,
          abi: TOKEN_V2_ABI,
          functionName: 'approve',
          args: [curveAddress, maxUint256],
        });
      }
      const sellHash = await writeContractAsync({
        address: curveAddress,
        abi: CURVE_V2_ABI,
        functionName: 'sell',
        args: [sellAmountWei, minEthOut],
      });
      if (pendingToastRef.current) pendingToastRef.current.expectedHash = sellHash;
      setSellAmount('');
    } catch (error) {
      txErrorToast(id, error);
      pendingToastRef.current = null;
    }
  };

  const isLoading    = isPending || isConfirming;
  const minTokensOut = previewTokensOut ? applyMinOut(previewTokensOut) : 0n;
  const minEthOut    = previewEthOut    ? applyMinOut(previewEthOut)    : 0n;

  const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
  const pairAddr = uniswapPair && uniswapPair !== ZERO_ADDR ? uniswapPair : null;

  const tokenBalanceNum = tokenBalance ? Number(formatUnits(tokenBalance, 18)) : 0;

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Trade</span>
        <SlippageSettings />
      </div>

      {/* Force-closed banner */}
      {forceClosed && (
        <div className="mx-3 mt-2 flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[11px] text-destructive font-mono leading-relaxed">
            This curve has been force-closed by the protocol admin. Trading is disabled.
          </p>
        </div>
      )}

      {/* Graduated DEX link */}
      {graduated && pairAddr && (
        <div className="mx-3 mt-2 flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-md px-3 py-2.5">
          <span className="text-[11px] text-primary font-mono flex-1">Token graduated. Trading on DEX.</span>
          <a
            href={`https://app.uniswap.org/explore/pools/base/${pairAddr}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Uniswap <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Buy / Sell switcher */}
      <div className="grid grid-cols-2 p-1.5 gap-1.5 mt-2 border-b border-border/40">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`text-[11px] font-semibold uppercase tracking-wider py-2.5 rounded-lg transition-all ${
              side === s
                ? s === 'buy'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Trade panel */}
      <div className="p-4 space-y-3">
        {/* Amount input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
              Amount ({side === 'buy' ? 'ETH' : (symbol || 'tokens')})
            </label>
            {side === 'buy' ? (
              <span className="text-[10px] font-mono text-muted-foreground/50">
                Bal: {ethBalance ? Number(formatEther(ethBalance.value)).toFixed(4) : '0'} ETH
              </span>
            ) : (
              <span className="text-[10px] font-mono text-muted-foreground/50">
                Bal: {tokenBalanceNum.toLocaleString()} {symbol}
              </span>
            )}
          </div>
          <Input
            type="number"
            placeholder="0.0"
            className="w-full font-mono text-base bg-background/60 border-border/60 h-11 focus:border-primary/60"
            value={side === 'buy' ? buyAmount : sellAmount}
            onChange={(e) => side === 'buy' ? setBuyAmount(e.target.value) : setSellAmount(e.target.value)}
            disabled={isLoading || !!forceClosed}
          />
        </div>

        {/* Quick amounts */}
        {side === 'buy' ? (
          <div className="grid grid-cols-4 gap-1.5">
            {BUY_QUICK.map((v) => (
              <button
                key={v}
                onClick={() => setBuyAmount(v)}
                disabled={isLoading || !!forceClosed}
                className="text-[10px] font-mono py-1.5 rounded-md border border-border/50 bg-white/3 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all disabled:opacity-40"
              >
                {v}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {[25, 50, 75].map((pct) => (
              <button
                key={pct}
                onClick={() => setSellAmount(Math.floor(tokenBalanceNum * pct / 100).toString())}
                disabled={isLoading || !tokenBalance}
                className="text-[10px] font-mono py-1.5 rounded-md border border-border/50 bg-white/3 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-40"
              >
                {pct}%
              </button>
            ))}
            <button
              onClick={() => tokenBalance && setSellAmount(formatUnits(tokenBalance, 18))}
              disabled={isLoading || !tokenBalance}
              className="text-[10px] font-semibold py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
            >
              MAX
            </button>
          </div>
        )}

        {/* Preview box */}
        {side === 'buy' && buyAmountWei > 0n && (
          <div className="bg-muted/30 p-3 rounded border border-border/30 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">You receive (est.)</span>
              <span className="font-mono text-emerald-400 font-bold">
                {previewTokensOut ? Number(formatUnits(previewTokensOut, 18)).toLocaleString() : '0'} {symbol}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground border-t border-border/30 pt-1.5">
              <span>Min received ({slippagePercent}% slip)</span>
              <span className="text-foreground">{minTokensOut ? Number(formatUnits(minTokensOut, 18)).toLocaleString() : '0'} {symbol}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
              <span>5% tax (burn + rewards + platform)</span>
              <span>{(Number(buyAmount) * 0.05).toFixed(4)} ETH</span>
            </div>
          </div>
        )}

        {side === 'sell' && sellAmountWei > 0n && !graduated && !forceClosed && (
          <div className="bg-muted/30 p-3 rounded border border-border/30 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">You receive (est.)</span>
              <span className="font-mono text-foreground font-bold">
                {previewEthOut ? Number(formatEther(previewEthOut)).toFixed(6) : '0'} ETH
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground border-t border-border/30 pt-1.5">
              <span>Min received ({slippagePercent}% slip)</span>
              <span className="text-foreground">{minEthOut ? Number(formatEther(minEthOut)).toFixed(6) : '0'} ETH</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
              <span>Sell tax</span>
              <span>5%</span>
            </div>
            {allowance !== undefined && allowance >= sellAmountWei && (
              <div className="text-[10px] font-mono text-muted-foreground/50">
                Allowance approved. No separate approve tx needed.
              </div>
            )}
          </div>
        )}

        {/* Action button */}
        {!forceClosed && (
          <button
            onClick={side === 'buy' ? handleBuy : handleSell}
            disabled={isLoading || (isConnected && (side === 'buy' ? (!buyAmountWei || !curveAddress) : (!sellAmountWei || !curveAddress || graduated)))}
            className={`w-full text-[12px] font-semibold uppercase tracking-wider py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              side === 'buy'
                ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !isConnected ? (
              `Connect Wallet to ${side === 'buy' ? 'Buy' : 'Sell'}`
            ) : (
              `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol || 'Tokens'}`
            )}
          </button>
        )}
      </div>
    </div>
  );
}
