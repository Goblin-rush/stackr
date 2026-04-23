import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { formatEther, formatUnits } from 'viem';
import { useTokenBalance } from '@/hooks/use-token';
import { ExternalLink, ArrowRightLeft } from 'lucide-react';
import { V3_BASE_TAX_BPS, V3_REWARD_BPS, V3_PLATFORM_BPS, V3_LP_FEE_BPS } from '@/lib/contracts';

interface TradeWidgetProps {
  tokenAddress: `0x${string}`;
  curveAddress?: `0x${string}`;
  currentPriceEth?: number;
  symbol?: string;
}

const UNISWAP_BASE_URL = 'https://app.uniswap.org/swap';

function formatPrice(ethPerToken: number): string {
  if (!ethPerToken || ethPerToken === 0) return '—';
  if (ethPerToken < 0.000001) return ethPerToken.toExponential(3) + ' ETH';
  if (ethPerToken < 0.001) return ethPerToken.toFixed(8) + ' ETH';
  return ethPerToken.toFixed(6) + ' ETH';
}

export function TradeWidget({ tokenAddress, currentPriceEth = 0, symbol }: TradeWidgetProps) {
  const { isConnected, address: userAddress } = useAccount();
  const { open } = useAppKit();
  const { data: ethBalance } = useBalance({ address: userAddress });
  const { data: tokenBalance } = useTokenBalance(tokenAddress, userAddress);

  const [side, setSide] = useState<'buy' | 'sell'>('buy');

  const ethBalanceNum = ethBalance ? Number(formatEther(ethBalance.value)) : 0;
  const tokenBalanceNum = tokenBalance ? Number(formatUnits(tokenBalance, 18)) : 0;

  const uniswapUrl = `${UNISWAP_BASE_URL}?chain=base&outputCurrency=${tokenAddress}${side === 'sell' ? `&inputCurrency=${tokenAddress}` : ''}`;

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Trade · Uniswap V4</span>
        <a
          href={`https://basescan.org/address/${tokenAddress}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted-foreground/50 hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* V4 info banner */}
      <div className="mx-3 mt-2 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2.5 flex items-start gap-2">
        <ArrowRightLeft className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-semibold text-primary">Uniswap V4 Pool</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
            Trading is live on Uniswap V4. Click below to swap.
          </p>
        </div>
      </div>

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

      <div className="p-4 space-y-4">
        {/* Current price */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Current price</span>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatPrice(currentPriceEth)}
          </span>
        </div>

        {/* Balance row */}
        {isConnected && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {side === 'buy' ? 'ETH Balance' : `${symbol || 'Token'} Balance`}
            </span>
            <span className="text-[12px] font-mono text-muted-foreground/70">
              {side === 'buy'
                ? `${ethBalanceNum.toFixed(4)} ETH`
                : `${tokenBalanceNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol || 'tokens'}`}
            </span>
          </div>
        )}

        {/* Fee structure */}
        <div className="bg-muted/20 rounded-lg px-3 py-2.5 space-y-1.5 border border-border/30">
          <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1.5">Fee structure</p>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Swap tax</span>
            <span className="font-mono text-foreground">{V3_BASE_TAX_BPS / 100}%</span>
          </div>
          <div className="flex justify-between text-[11px] pl-3">
            <span className="text-muted-foreground/70">Holder rewards</span>
            <span className="font-mono text-primary">{V3_REWARD_BPS / 100}%</span>
          </div>
          <div className="flex justify-between text-[11px] pl-3">
            <span className="text-muted-foreground/70">Platform</span>
            <span className="font-mono text-muted-foreground">{V3_PLATFORM_BPS / 100}%</span>
          </div>
          <div className="flex justify-between text-[11px] border-t border-border/20 pt-1.5 mt-1">
            <span className="text-muted-foreground">LP fee</span>
            <span className="font-mono text-muted-foreground">{V3_LP_FEE_BPS / 100}%</span>
          </div>
        </div>

        {/* Action button */}
        {isConnected ? (
          <a
            href={uniswapUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={`w-full text-[12px] font-semibold uppercase tracking-wider py-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
              side === 'buy'
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            <ArrowRightLeft className="h-4 w-4" />
            {side === 'buy' ? 'Buy' : 'Sell'} {symbol || 'Tokens'} on Uniswap
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <button
            onClick={() => open()}
            className="w-full text-[12px] font-semibold uppercase tracking-wider py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Connect Wallet
          </button>
        )}

        <p className="text-center text-[9px] font-mono text-muted-foreground/40">
          Powered by Uniswap V4 · Base mainnet
        </p>
      </div>
    </div>
  );
}
