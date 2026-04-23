import { useToken } from '@/hooks/use-token';
import { useEthPrice } from '@/hooks/use-eth-price';
import { Link } from 'wouter';
import { useTokenMetadata, ipfsToHttp } from '@/lib/token-metadata';

const TOTAL_SUPPLY = 1_000_000_000;

interface TokenCardProps {
  address: `0x${string}`;
  currentPriceEth?: number;
}

export function TokenCard({ address, currentPriceEth = 0 }: TokenCardProps) {
  const { name, symbol } = useToken(address);
  const { data: ethPrice } = useEthPrice();
  const meta = useTokenMetadata(address);
  const imageUrl = ipfsToHttp(meta?.image);

  if (!name || !symbol) {
    return (
      <div className="h-48 bg-card animate-pulse border border-border rounded-md" />
    );
  }

  const mcEth = currentPriceEth * TOTAL_SUPPLY;
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
              <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 border border-primary/50 text-primary shrink-0">
                V4
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">${symbol}</p>
          </div>
        </div>

        {meta?.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {meta.description}
          </p>
        )}

        <div className="flex justify-between text-xs border-t border-border pt-2 mt-auto">
          <span className="text-muted-foreground">
            MCap: <span className="text-foreground font-mono">
              {mcUsd ? `$${mcUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${mcEth.toFixed(3)} ETH`}
            </span>
          </span>
          <span className="text-muted-foreground font-mono">
            {currentPriceEth > 0 ? (currentPriceEth < 0.000001 ? '<0.000001' : currentPriceEth.toFixed(7)) : '—'}
          </span>
        </div>
      </div>
    </Link>
  );
}
