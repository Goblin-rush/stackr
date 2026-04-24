import { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { formatEther, formatUnits, parseEther, parseUnits, maxUint256 } from 'viem';
import { useTokenBalance } from '@/hooks/use-token';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  HOOK_V3_ABI,
  V3_POOL_FEE,
  V3_TICK_SPACING,
  V3_BASE_TAX_BPS,
  V3_REWARD_BPS,
  V3_PLATFORM_BPS,
  V3_LP_FEE_BPS,
  getV3Contracts,
} from '@/lib/contracts';

const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

interface TradeWidgetProps {
  tokenAddress: `0x${string}`;
  curveAddress?: `0x${string}`;
  currentPriceEth?: number;
  symbol?: string;
  chainId?: number;
}

function formatPrice(ethPerToken: number): string {
  if (!ethPerToken || ethPerToken === 0) return '—';
  if (ethPerToken < 0.000001) return ethPerToken.toExponential(3) + ' ETH';
  if (ethPerToken < 0.001) return ethPerToken.toFixed(8) + ' ETH';
  return ethPerToken.toFixed(6) + ' ETH';
}

function estimateTokensOut(ethIn: number, priceEth: number): string {
  if (!priceEth || priceEth === 0 || !ethIn) return '—';
  const afterTax = ethIn * (1 - V3_BASE_TAX_BPS / 10000 - V3_LP_FEE_BPS / 10000);
  const tokens = afterTax / priceEth;
  return tokens.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function estimateEthOut(tokensIn: number, priceEth: number): string {
  if (!priceEth || priceEth === 0 || !tokensIn) return '—';
  const gross = tokensIn * priceEth;
  const afterTax = gross * (1 - V3_BASE_TAX_BPS / 10000 - V3_LP_FEE_BPS / 10000);
  return afterTax.toFixed(6);
}

export function TradeWidget({ tokenAddress, currentPriceEth = 0, symbol, chainId = 8453 }: TradeWidgetProps) {
  const contracts = getV3Contracts(chainId);
  const hookAddress = contracts.hookAddress;

  const { isConnected, address: userAddress } = useAccount();
  const { open } = useAppKit();
  const { data: ethBalance } = useBalance({ address: userAddress });
  const { data: tokenBalance } = useTokenBalance(tokenAddress, userAddress);

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [txError, setTxError] = useState<string | null>(null);

  const ethBalanceNum = ethBalance ? Number(formatEther(ethBalance.value)) : 0;
  const tokenBalanceNum = tokenBalance ? Number(formatUnits(tokenBalance, 18)) : 0;

  const poolKey = {
    currency0: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    currency1: tokenAddress,
    fee: V3_POOL_FEE,
    tickSpacing: V3_TICK_SPACING,
    hooks: hookAddress,
  } as const;

  // ERC20 allowance (for sell)
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, hookAddress] : undefined,
    query: { enabled: !!userAddress && side === 'sell' },
  });

  const tokenAmountWei = (() => {
    try { return parseUnits(amount || '0', 18); } catch { return 0n; }
  })();
  const needsApproval = side === 'sell' && tokenAmountWei > 0n && (allowance ?? 0n) < tokenAmountWei;

  // Write contract hooks
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isTxSuccess) {
      setAmount('');
      setTxHash(undefined);
      setTxError(null);
      if (side === 'sell') refetchAllowance();
    }
  }, [isTxSuccess, side, refetchAllowance]);

  const isLoading = isWritePending || isTxLoading;

  async function handleApprove() {
    setTxError(null);
    try {
      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [hookAddress, maxUint256],
      });
      setTxHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxError(msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
    }
  }

  async function handleBuy() {
    setTxError(null);
    const ethWei = (() => { try { return parseEther(amount || '0'); } catch { return 0n; } })();
    if (ethWei === 0n) return;
    try {
      const hash = await writeContractAsync({
        address: hookAddress,
        abi: HOOK_V3_ABI,
        functionName: 'buy',
        args: [poolKey],
        value: ethWei,
      });
      setTxHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxError(msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
    }
  }

  async function handleSell() {
    setTxError(null);
    if (tokenAmountWei === 0n) return;
    try {
      const hash = await writeContractAsync({
        address: hookAddress,
        abi: HOOK_V3_ABI,
        functionName: 'sell',
        args: [poolKey, tokenAmountWei],
      });
      setTxHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxError(msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
    }
  }

  function setMax() {
    if (side === 'buy') {
      const max = Math.max(0, ethBalanceNum - 0.002);
      setAmount(max.toFixed(6));
    } else {
      setAmount(tokenBalanceNum.toFixed(2));
    }
  }

  const amountNum = parseFloat(amount) || 0;
  const isBuyInvalid = side === 'buy' && amountNum > 0 && amountNum > ethBalanceNum;
  const isSellInvalid = side === 'sell' && amountNum > 0 && amountNum > tokenBalanceNum;

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Trade · {chainId === 1 ? 'ETH' : 'Base'}
        </span>
        <a
          href={`${contracts.explorerUrl}/address/${tokenAddress}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted-foreground/50 hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Buy / Sell switcher */}
      <div className="grid grid-cols-2 p-1.5 gap-1.5 mt-2 border-b border-border/40">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setSide(s); setAmount(''); setTxError(null); }}
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

        {/* Amount input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {side === 'buy' ? 'ETH to spend' : `${symbol || 'Tokens'} to sell`}
            </label>
            {isConnected && (
              <button
                onClick={setMax}
                className="text-[9px] font-mono text-primary hover:text-primary/80 uppercase tracking-wider"
              >
                MAX · {side === 'buy'
                  ? `${ethBalanceNum.toFixed(4)} ETH`
                  : `${tokenBalanceNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol || ''}`}
              </button>
            )}
          </div>
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 bg-muted/10 transition-colors ${
            (isBuyInvalid || isSellInvalid) ? 'border-destructive/60' : 'border-border/40 focus-within:border-primary/50'
          }`}>
            <input
              type="number"
              min="0"
              step={side === 'buy' ? '0.001' : '1'}
              placeholder={side === 'buy' ? '0.00 ETH' : '0 tokens'}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setTxError(null); }}
              className="flex-1 bg-transparent text-sm font-mono outline-none text-foreground placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              {side === 'buy' ? 'ETH' : symbol || 'TOK'}
            </span>
          </div>
          {(isBuyInvalid || isSellInvalid) && (
            <p className="text-[10px] text-destructive font-mono">Insufficient balance</p>
          )}
        </div>

        {/* Estimated output */}
        {amountNum > 0 && currentPriceEth > 0 && (
          <div className="bg-muted/10 rounded-lg px-3 py-2 border border-border/20">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Estimated receive</span>
              <span className="font-mono text-foreground">
                {side === 'buy'
                  ? `~${estimateTokensOut(amountNum, currentPriceEth)} ${symbol || 'tokens'}`
                  : `~${estimateEthOut(amountNum, currentPriceEth)} ETH`}
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground/50 font-mono mt-0.5">Estimate only. Actual amount may vary.</p>
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

        {/* Error */}
        {txError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
            <p className="text-[10px] font-mono text-destructive break-words">{txError}</p>
          </div>
        )}

        {/* Success */}
        {isTxSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            <p className="text-[10px] font-mono text-emerald-400">Transaction confirmed!</p>
          </div>
        )}

        {/* Action button(s) */}
        {!isConnected ? (
          <button
            onClick={() => open()}
            className="w-full text-[12px] font-semibold uppercase tracking-wider py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Connect Wallet
          </button>
        ) : side === 'sell' && needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="w-full text-[12px] font-semibold uppercase tracking-wider py-3 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Approving…' : `Approve ${symbol || 'Token'}`}
          </button>
        ) : (
          <button
            onClick={side === 'buy' ? handleBuy : handleSell}
            disabled={isLoading || !amount || amountNum <= 0 || isBuyInvalid || isSellInvalid}
            className={`w-full text-[12px] font-semibold uppercase tracking-wider py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
              side === 'buy'
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading
              ? isTxLoading ? 'Confirming…' : 'Sending…'
              : side === 'buy'
                ? `Buy ${symbol || 'Tokens'}`
                : `Sell ${symbol || 'Tokens'}`}
          </button>
        )}

        <p className="text-center text-[9px] font-mono text-muted-foreground/40">
          Uniswap V4 hook · {chainId === 1 ? 'ETH mainnet' : 'Base mainnet'} · 3% tax
        </p>
      </div>
    </div>
  );
}
