import { TARGET_ETH } from '@/lib/contracts';
import { formatEther } from 'viem';

interface BondingCurveProgressProps {
  realEthRaised: bigint | undefined;
  graduated: boolean | undefined;
}

export function BondingCurveProgress({ realEthRaised, graduated }: BondingCurveProgressProps) {
  const raised = realEthRaised ? Number(formatEther(realEthRaised)) : 0;
  const target = Number(formatEther(TARGET_ETH));
  const progress = Math.min((raised / target) * 100, 100);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Bonding Curve Progress</h3>
          <p className="font-mono text-2xl font-bold mt-1 text-foreground">
            {raised.toFixed(3)} <span className="text-muted-foreground text-sm">/ {target} ETH</span>
          </p>
        </div>
        <div className="text-right">
          <span className="font-mono text-xl text-primary">{progress.toFixed(2)}%</span>
        </div>
      </div>

      <div className="relative h-4 w-full bg-secondary overflow-hidden border border-border/50">
        <div 
          className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Market grid lines */}
        {[25, 50, 75].map(tick => (
          <div 
            key={tick}
            className="absolute top-0 bottom-0 border-l border-background/20"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>

      {graduated ? (
        <div className="bg-primary/10 border border-primary/20 p-4 rounded text-sm">
          <p className="text-primary font-bold mb-1">BONDING CURVE COMPLETE</p>
          <p className="text-primary/80">Liquidity has been migrated to DEX and LP tokens burned.</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          When the curve reaches {target} ETH, all liquidity is deposited to a DEX and burned.
        </p>
      )}
    </div>
  );
}
