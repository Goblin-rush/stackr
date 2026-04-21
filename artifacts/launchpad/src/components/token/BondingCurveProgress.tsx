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
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Bonding curve</span>
        <span className="font-mono text-sm text-foreground">
          {raised.toFixed(3)} <span className="text-muted-foreground">/ {target} ETH</span>
        </span>
      </div>

      <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-primary transition-all duration-700 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between">
        <span className="text-xs text-muted-foreground font-mono">{progress.toFixed(2)}% filled</span>
        {graduated ? (
          <span className="text-xs text-emerald-400 font-medium">Graduated to DEX ✓</span>
        ) : (
          <span className="text-xs text-muted-foreground">target: {target} ETH</span>
        )}
      </div>

      {graduated && (
        <div className="bg-emerald-500/8 border border-emerald-500/20 p-3 rounded text-xs text-emerald-400">
          Liquidity migrated to DEX. LP tokens burned.
        </div>
      )}
    </div>
  );
}
