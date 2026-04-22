import { useToken } from '@/hooks/use-token';
import { useEthPrice } from '@/hooks/use-eth-price';
import { TARGET_ETH, TOTAL_SUPPLY } from '@/lib/contracts';
import { formatEther } from 'viem';
import { Link } from 'wouter';
import { useTokenMetadata, ipfsToHttp } from '@/lib/token-metadata';

interface TokenCardProps {
  address: `0x${string}`;
}

export function TokenCard({ address }: TokenCardProps) {
  const { name, symbol, realEthRaised, graduated, currentPrice } = useToken(address);
  const { data: ethPrice } = useEthPrice();
  const meta = useTokenMetadata(address);
  const imageUrl = ipfsToHttp(meta?.image);

  if (!name || !symbol) {
    return (
      <div className="h-48 bg-card animate-pulse border border-border rounded-md" />
    );
  }

  const progress = realEthRaised ? Math.min(Number((realEthRaised * 100n) / TARGET_ETH), 100) : 0;
  const ethRaised = realEthRaised ? Number(formatEther(realEthRaised)) : 0;
  const priceInEth = currentPrice ? Number(formatEther(currentPrice)) : 0;
  const mcEth = priceInEth * Number(formatEther(TOTAL_SUPPLY));
  const mcUsd = ethPrice ? mcEth * ethPrice : null;

  return (
    <Link href={`/token/${address}`}>
      <div className="group bg-card border border-border rounded-md p-4 cursor-pointer hover:border-primary/40 transition-colors flex flex-col gap-3 h-full">

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-muted border border-border/50 flex items-center justify-center shrink-0 overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt={symbol} className="w-full h-full object-cover" />
            ) : (
              <span className="text-muted-foreground font-black text-sm leading-none">
                {symbol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">{name}</p>
              {graduated && (
                <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 border-2 border-primary text-primary shrink-0">
                  DEX
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">${symbol}</p>
          </div>
        </div>

        {meta?.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {meta.description}
          </p>
        )}

        <div className="mt-auto space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{ethRaised.toFixed(3)} ETH</span>
            <span className="text-primary font-medium">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between text-xs border-t border-border pt-2">
          <span className="text-muted-foreground">
            MCap: <span className="text-foreground font-mono">
              {mcUsd ? `$${mcUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${mcEth.toFixed(3)} ETH`}
            </span>
          </span>
          <span className="text-muted-foreground font-mono">{priceInEth < 0.000001 ? '<0.000001' : priceInEth.toFixed(7)}</span>
        </div>
      </div>
    </Link>
  );
}
