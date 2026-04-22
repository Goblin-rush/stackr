import { TARGET_ETH } from '@/lib/contracts';
import { formatEther } from 'viem';
import { useEffect, useRef, useState } from 'react';

interface BondingCurveProgressProps {
  realEthRaised: bigint | undefined;
  graduated: boolean | undefined;
}

export function BondingCurveProgress({ realEthRaised, graduated }: BondingCurveProgressProps) {
  const raised = realEthRaised ? Number(formatEther(realEthRaised)) : 0;
  const target = Number(formatEther(TARGET_ETH));
  const progress = Math.min((raised / target) * 100, 100);

  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = displayed;
    const end = progress;
    const duration = 900;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(start + (end - start) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [progress]);

  const pct = Math.min(displayed, 100);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Bonding Curve</span>
        <span className="font-mono text-sm text-foreground tabular-nums">
          {raised.toFixed(3)} <span className="text-muted-foreground">/ {target} ETH</span>
        </span>
      </div>

      {/* Animated bar */}
      <div className="relative h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/8">
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-none overflow-hidden"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, hsl(4 84% 46%) 0%, hsl(4 84% 60%) 60%, hsl(18 92% 64%) 100%)',
            boxShadow: pct > 2 ? '0 0 16px hsl(4 84% 58% / 0.50)' : 'none',
          }}
        >
          {/* shimmer sweep */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent progress-shimmer" />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {pct.toFixed(1)}% filled
        </span>
        {graduated ? (
          <span className="text-xs text-primary font-semibold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-primary rounded-full" />
            Graduated to DEX
          </span>
        ) : (
          <span className="text-xs text-muted-foreground font-mono">target: {target} ETH</span>
        )}
      </div>

      {graduated && (
        <div className="rounded-lg border border-primary/30 bg-primary/8 px-4 py-3 text-xs text-primary font-medium">
          Liquidity migrated to DEX · LP tokens burned ✓
        </div>
      )}
    </div>
  );
}
