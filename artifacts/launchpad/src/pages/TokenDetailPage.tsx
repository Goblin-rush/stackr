import { useParams } from 'wouter';
import { Navbar } from '@/components/layout/Navbar';
import { useToken } from '@/hooks/use-token';
import { useEthPrice } from '@/hooks/use-eth-price';
import { BondingCurveProgress } from '@/components/token/BondingCurveProgress';
import { TradeWidget } from '@/components/token/TradeWidget';
import { TOTAL_SUPPLY } from '@/lib/contracts';
import { formatEther } from 'viem';
import { Skeleton } from '@/components/ui/skeleton';

export default function TokenDetailPage() {
  const { address } = useParams<{ address: `0x${string}` }>();
  const { name, symbol, realEthRaised, graduated, currentPrice, isLoading } = useToken(address);
  const { data: ethPrice } = useEthPrice();

  const priceInEth = currentPrice ? Number(formatEther(currentPrice)) : 0;
  const mcEth = priceInEth * Number(formatEther(TOTAL_SUPPLY));
  const mcUsd = ethPrice ? mcEth * ethPrice : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-8 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Skeleton className="h-32 w-full bg-muted/50" />
              <Skeleton className="h-64 w-full bg-muted/50" />
            </div>
            <div>
              <Skeleton className="h-[400px] w-full bg-muted/50" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!name) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground font-mono">Token not found or not indexed yet.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-8 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content (Left) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Header / Meta */}
            <div className="p-6 border border-border/50 bg-card">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-black tracking-tighter text-foreground">{name}</h1>
                    <span className="text-xl text-primary font-mono uppercase bg-primary/10 px-2 py-1 border border-primary/20">${symbol}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-sm font-mono text-muted-foreground">
                    <span>Contract:</span>
                    <span className="text-foreground">{address}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-6 border-t border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Price USD</p>
                  <p className="font-mono text-lg font-bold text-primary">
                    {ethPrice && priceInEth ? `$${(priceInEth * ethPrice).toFixed(6)}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Price ETH</p>
                  <p className="font-mono text-lg">{priceInEth.toFixed(8)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Market Cap</p>
                  <p className="font-mono text-lg">
                    {mcUsd ? `$${mcUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${mcEth.toFixed(2)} ETH`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <p className="font-mono text-lg text-primary">{graduated ? 'DEX' : 'BONDING'}</p>
                </div>
              </div>
            </div>

            {/* Bonding Curve Section */}
            <div className="p-6 border border-border/50 bg-card">
              <BondingCurveProgress realEthRaised={realEthRaised} graduated={graduated} />
            </div>

          </div>

          {/* Trade Widget (Right) */}
          <div className="lg:col-span-4 space-y-6">
            <TradeWidget address={address} />
            
            <div className="p-4 border border-border/50 bg-muted/10 text-xs font-mono text-muted-foreground space-y-2">
              <p className="uppercase tracking-widest text-foreground font-bold mb-3 border-b border-border/50 pb-2">Terminal Guidelines</p>
              <ul className="space-y-2 list-disc pl-4">
                <li>Bonding curve ensures continuous liquidity.</li>
                <li>Price increases as supply is bought.</li>
                <li>At 3.5 ETH raised, trading halts and migrates to DEX.</li>
                <li>Standard 1% slippage applied to orders.</li>
              </ul>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
