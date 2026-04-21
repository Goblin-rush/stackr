import { useToken } from '@/hooks/use-token';
import { useEthPrice } from '@/hooks/use-eth-price';
import { Card } from '@/components/ui/card';
import { TARGET_ETH, TOTAL_SUPPLY } from '@/lib/contracts';
import { formatEther } from 'viem';
import { Link } from 'wouter';

interface TokenCardProps {
  address: `0x${string}`;
}

export function TokenCard({ address }: TokenCardProps) {
  const { name, symbol, realEthRaised, graduated, currentPrice } = useToken(address);
  const { data: ethPrice } = useEthPrice();

  if (!name || !symbol) {
    return (
      <Card className="p-4 h-32 animate-pulse bg-muted/50 border-border/50">
        <div className="h-full w-full rounded" />
      </Card>
    );
  }

  const progress = realEthRaised ? Number((realEthRaised * 100n) / TARGET_ETH) : 0;
  const ethRaisedFormatted = realEthRaised ? formatEther(realEthRaised) : '0';
  
  // Market cap = total supply * current price (virtual)
  // Assuming currentPrice is per 1e18 tokens in wei
  // It might need better scaling depending on contract math, but as a rough estimate:
  const priceInEth = currentPrice ? Number(formatEther(currentPrice)) : 0;
  const mcEth = priceInEth * Number(formatEther(TOTAL_SUPPLY));
  const mcUsd = ethPrice ? mcEth * ethPrice : null;

  return (
    <Link href={`/token/${address}`}>
      <Card className="group relative overflow-hidden p-5 transition-all hover:border-primary/50 hover:bg-muted/50 cursor-pointer h-full flex flex-col gap-4 border-border/50">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg leading-none tracking-tight text-foreground group-hover:text-primary transition-colors">{name}</h3>
            <p className="text-sm text-muted-foreground font-mono mt-1">${symbol}</p>
          </div>
          {graduated && (
            <span className="text-xs font-mono px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded">
              GRADUATED
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5 mt-auto">
          <div className="flex justify-between text-xs font-mono text-muted-foreground">
            <span>Progress</span>
            <span>{Math.min(progress, 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-mono text-muted-foreground mt-1">
            <span>{Number(ethRaisedFormatted).toFixed(3)} ETH</span>
            <span>3.5 ETH</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Market Cap</p>
            <p className="font-mono text-sm">
              {mcUsd ? `$${mcUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${mcEth.toFixed(2)} ETH`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">Price</p>
            <p className="font-mono text-sm text-primary">
              {priceInEth < 0.000001 ? '<0.000001' : priceInEth.toFixed(6)} ETH
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
