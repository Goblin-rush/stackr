import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const QUICK_AMOUNTS = ['0.05', '0.1', '0.5', '1'];

export function TradeWidget({ tokenAddress, curveAddress }: TradeWidgetProps) {
  const { isConnected, address: userAddress } = useAccount();
  const { connect } = useConnect();
  const { data: ethBalance } = useBalance({ address: userAddress });
  const { data: tokenBalance } = useTokenBalance(tokenAddress, userAddress);
  const { graduated, symbol, forceClosed, uniswapPair } = useToken(tokenAddress, curveAddress);
  const { applyMinOut, percent: slippagePercent } = useSlippage();

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');

  const buyAmountWei  = buyAmount  && !isNaN(Number(buyAmount))  ? parseEther(buyAmount as `${number}`)   : 0n;
  const sellAmountWei = sellAmount && !isNaN(Number(sellAmount)) ? parseUnits(sellAmount, 18)              : 0n;

  const { data: previewTokensOut } = useTokenPreviewBuy(curveAddress, buyAmountWei);
  const { data: previewEthOut }    = useTokenPreviewSell(curveAddress, sellAmountWei, userAddress);

  // Allowance check — avoid re-approving if already sufficient
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

      // Only approve if allowance is insufficient — approve MaxUint256 so future sells skip this step
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

  // Uniswap pair URL on Base (Uniswap v2-style)
  const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
  const pairAddr = uniswapPair && uniswapPair !== ZERO_ADDR ? uniswapPair : null;

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Trade</span>
        <SlippageSettings />
      </div>

      {/* Force-closed banner */}
      {forceClosed && (
        <div className="mx-3 mt-3 flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[11px] text-destructive font-mono leading-relaxed">
            This curve has been force-closed by the protocol admin. Trading is disabled.
          </p>
        </div>
      )}

      {/* Graduated DEX link */}
      {graduated && pairAddr && (
        <div className="mx-3 mt-3 flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-md px-3 py-2.5">
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'buy' | 'sell')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-border/50 h-12 bg-muted/20 mt-3">
          <TabsTrigger value="buy"  className="rounded-none data-[state=active]:bg-card data-[state=active]:text-primary font-mono uppercase tracking-widest text-xs">Buy</TabsTrigger>
          <TabsTrigger value="sell" className="rounded-none data-[state=active]:bg-card data-[state=active]:text-destructive font-mono uppercase tracking-widest text-xs">Sell</TabsTrigger>
        </TabsList>

        <div className="p-4">
          {/* ── BUY ── */}
          <TabsContent value="buy" className="mt-0 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
                <span>Amount (ETH)</span>
                <span>Balance: {ethBalance ? Number(formatEther(ethBalance.value)).toFixed(4) : '0'} ETH</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  className="font-mono text-lg bg-muted/30 border-border/50 h-12 pr-16"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  disabled={isLoading || !!forceClosed}
                />
                <span className="absolute right-4 top-3 text-muted-foreground font-mono text-sm">ETH</span>
              </div>
              {/* Quick-amount chips */}
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBuyAmount(amt)}
                    disabled={isLoading || !!forceClosed}
                    className="text-[10px] font-mono px-2.5 py-1 rounded border border-border/50 hover:border-primary/40 hover:text-primary text-muted-foreground transition-colors disabled:opacity-40"
                  >
                    {amt} ETH
                  </button>
                ))}
              </div>
            </div>

            {buyAmountWei > 0n && (
              <div className="bg-muted/30 p-3 rounded border border-border/30 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">You receive (est.)</span>
                  <span className="font-mono text-primary font-bold">
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

            <Button
              className="w-full h-12 font-bold tracking-wider text-primary-foreground"
              onClick={handleBuy}
              disabled={isLoading || !!forceClosed || (isConnected && (!buyAmountWei || !curveAddress))}
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !isConnected ? 'CONNECT WALLET TO BUY' : 'PLACE BUY ORDER'}
            </Button>
          </TabsContent>

          {/* ── SELL ── */}
          <TabsContent value="sell" className="mt-0 space-y-4">
            {graduated ? (
              <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded text-sm text-center">
                Token graduated. Trading has moved to DEX.
                {pairAddr && (
                  <a
                    href={`https://app.uniswap.org/explore/pools/base/${pairAddr}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ml-2 underline underline-offset-2"
                  >
                    Trade on Uniswap ↗
                  </a>
                )}
              </div>
            ) : forceClosed ? null : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
                    <span>Amount ({symbol})</span>
                    <span>Balance: {tokenBalance ? Number(formatUnits(tokenBalance, 18)).toLocaleString() : '0'}</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.0"
                      className="font-mono text-lg bg-muted/30 border-border/50 h-12 pr-20"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      disabled={isLoading}
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs font-mono px-2"
                        onClick={() => tokenBalance && setSellAmount(formatUnits(tokenBalance, 18))}
                        disabled={isLoading || !tokenBalance}
                      >
                        MAX
                      </Button>
                      <span className="text-muted-foreground font-mono mr-2 text-xs">{symbol}</span>
                    </div>
                  </div>
                </div>

                {sellAmountWei > 0n && (
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
                        Allowance already approved. No separate approve tx needed.
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="destructive"
                  className="w-full h-12 font-bold tracking-wider"
                  onClick={handleSell}
                  disabled={isLoading || (isConnected && (!sellAmountWei || !curveAddress))}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !isConnected ? 'CONNECT WALLET TO SELL' : 'PLACE SELL ORDER'}
                </Button>
              </>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
