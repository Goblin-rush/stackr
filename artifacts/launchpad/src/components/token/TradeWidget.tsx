import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAccount, useBalance, useConnect } from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import { parseEther, formatEther, formatUnits, parseUnits } from 'viem';
import { useToken, useTokenBalance, useTokenPreviewBuy, useTokenPreviewSell, useTokenTrade } from '@/hooks/use-token';
import { BONDING_CURVE_ABI } from '@/lib/contracts';
import { Loader2 } from 'lucide-react';
import { useSlippage } from '@/hooks/use-slippage';
import { SlippageSettings } from '@/components/token/SlippageSettings';
import { txPendingToast, txSubmittedToast, txSuccessToast, txErrorToast } from '@/lib/tx-toast';

interface TradeWidgetProps {
  address: `0x${string}`;
}

export function TradeWidget({ address }: TradeWidgetProps) {
  const { isConnected, address: userAddress } = useAccount();
  const { connect } = useConnect();
  const { data: ethBalance } = useBalance({ address: userAddress });
  const { data: tokenBalance } = useTokenBalance(address, userAddress);
  const { graduated, symbol } = useToken(address);
  const { applyMinOut, percent: slippagePercent } = useSlippage();

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');

  const buyAmountWei = buyAmount && !isNaN(Number(buyAmount)) ? parseEther(buyAmount as `${number}`) : 0n;
  const sellAmountWei = sellAmount && !isNaN(Number(sellAmount)) ? parseUnits(sellAmount, 18) : 0n;

  const { data: previewTokensOut } = useTokenPreviewBuy(address, buyAmountWei);
  const { data: previewEthOut } = useTokenPreviewSell(address, sellAmountWei);

  const { writeContractAsync, isPending, isConfirming, isConfirmed, hash } = useTokenTrade();

  // Track the toast id and the EXACT hash we want to finalize on (the final tx of the flow).
  // For buy: that's the buy hash. For sell: that's the sell hash (NOT the approve hash).
  const pendingToastRef = useRef<{ id: string | number; label: string; expectedHash: `0x${string}` | null } | null>(null);

  // When `hash` matches the expected final hash, swap pending → submitted with etherscan link.
  useEffect(() => {
    const p = pendingToastRef.current;
    if (hash && p && p.expectedHash === hash) {
      txSubmittedToast(p.id, hash, p.label);
    }
  }, [hash]);

  // When the receipt of the expected hash confirms, finalize the toast as success.
  useEffect(() => {
    const p = pendingToastRef.current;
    if (isConfirmed && hash && p && p.expectedHash === hash) {
      txSuccessToast(p.id, hash, `${p.label} confirmed`);
      pendingToastRef.current = null;
    }
  }, [isConfirmed, hash]);

  const handleBuy = async () => {
    if (!isConnected) {
      connect({ connector: metaMask() });
      return;
    }
    if (!buyAmountWei) return;
    const id = txPendingToast(`Buying ${symbol || 'tokens'}`);
    pendingToastRef.current = { id, label: `Bought ${symbol || 'tokens'}`, expectedHash: null };
    try {
      const minTokensOut = previewTokensOut ? applyMinOut(previewTokensOut) : 0n;
      const txHash = await writeContractAsync({
        address,
        abi: BONDING_CURVE_ABI,
        functionName: 'buy',
        args: [minTokensOut],
        value: buyAmountWei,
      });
      // Mark which hash to finalize on (buy is single-tx).
      if (pendingToastRef.current) pendingToastRef.current.expectedHash = txHash;
      setBuyAmount('');
    } catch (error) {
      console.error('Buy failed', error);
      txErrorToast(id, error);
      pendingToastRef.current = null;
    }
  };

  const handleSell = async () => {
    if (!isConnected) {
      connect({ connector: metaMask() });
      return;
    }
    if (!sellAmountWei) return;
    const id = txPendingToast(`Selling ${symbol || 'tokens'}`);
    pendingToastRef.current = { id, label: `Sold ${symbol || 'tokens'}`, expectedHash: null };
    try {
      const minEthOut = previewEthOut ? applyMinOut(previewEthOut) : 0n;

      // Approve happens silently (no toast swap — expectedHash stays null until sell submitted).
      await writeContractAsync({
        address,
        abi: BONDING_CURVE_ABI,
        functionName: 'approve',
        args: [address, sellAmountWei],
      });
      const sellHash = await writeContractAsync({
        address,
        abi: BONDING_CURVE_ABI,
        functionName: 'sell',
        args: [sellAmountWei, minEthOut],
      });
      // Now lock the toast onto the sell hash for final confirmation.
      if (pendingToastRef.current) pendingToastRef.current.expectedHash = sellHash;

      setSellAmount('');
    } catch (error) {
      console.error('Sell failed', error);
      txErrorToast(id, error);
      pendingToastRef.current = null;
    }
  };

  const isLoading = isPending || isConfirming;

  const minTokensOut = previewTokensOut ? applyMinOut(previewTokensOut) : 0n;
  const minEthOut = previewEthOut ? applyMinOut(previewEthOut) : 0n;

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Trade</span>
        <SlippageSettings />
      </div>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'buy' | 'sell')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-border/50 h-12 bg-muted/20 mt-3">
          <TabsTrigger value="buy" className="rounded-none data-[state=active]:bg-card data-[state=active]:text-primary font-mono uppercase tracking-widest text-xs">Buy</TabsTrigger>
          <TabsTrigger value="sell" className="rounded-none data-[state=active]:bg-card data-[state=active]:text-destructive font-mono uppercase tracking-widest text-xs">Sell</TabsTrigger>
        </TabsList>
        
        <div className="p-4">
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
                  className="font-mono text-lg bg-muted/30 border-border/50 h-12"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  disabled={isLoading}
                />
                <span className="absolute right-4 top-3 text-muted-foreground font-mono">ETH</span>
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
                  <span className="text-foreground">
                    {minTokensOut ? Number(formatUnits(minTokensOut, 18)).toLocaleString() : '0'} {symbol}
                  </span>
                </div>
              </div>
            )}

            <Button 
              className="w-full h-12 font-bold tracking-wider text-primary-foreground" 
              onClick={handleBuy}
              disabled={isLoading || (isConnected && !buyAmountWei)}
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !isConnected ? 'CONNECT WALLET TO BUY' : 'PLACE BUY ORDER'}
            </Button>
          </TabsContent>

          <TabsContent value="sell" className="mt-0 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
                <span>Amount ({symbol})</span>
                <span>Balance: {tokenBalance ? Number(formatUnits(tokenBalance, 18)).toLocaleString() : '0'}</span>
              </div>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="0.0" 
                  className="font-mono text-lg bg-muted/30 border-border/50 h-12"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  disabled={isLoading || graduated}
                />
                <div className="absolute right-2 top-2 flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs font-mono px-2"
                    onClick={() => tokenBalance && setSellAmount(formatUnits(tokenBalance, 18))}
                    disabled={isLoading || graduated || !tokenBalance}
                  >
                    MAX
                  </Button>
                  <span className="text-muted-foreground font-mono mr-2">{symbol}</span>
                </div>
              </div>
            </div>

            {graduated ? (
              <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded text-sm text-center">
                Token has graduated. Trading moved to DEX.
              </div>
            ) : (
              <>
                {sellAmountWei > 0n && (
                  <div className="bg-muted/30 p-3 rounded border border-border/30 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">You receive (est.)</span>
                    <span className="font-mono text-foreground font-bold">
                      {previewEthOut ? Number(formatEther(previewEthOut)).toFixed(6) : '0'} ETH
                    </span>
                  </div>
                )}

                <Button 
                  variant="destructive"
                  className="w-full h-12 font-bold tracking-wider" 
                  onClick={handleSell}
                  disabled={isLoading || (isConnected && !sellAmountWei) || graduated}
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
