import { formatEther } from 'viem';
import { useEffect, useRef, useState } from 'react';
import { useCurveConstants } from '@/hooks/use-curve-constants';

interface BondingCurveProgressProps {
  realEthRaised: bigint | undefined;
  graduated: boolean | undefined;
  /** progressBps from contract getProgress() — 0..10000. If provided, used directly instead of recomputing. */
  progressBps?: bigint | undefined;
  /** Live ETH raised as number (from event-tracked state). Preferred over realEthRaised when present. */
  liveRaisedEth?: number;
}

export function BondingCurveProgress({ realEthRaised, graduated, progressBps, liveRaisedEth }: BondingCurveProgressProps) {
  const { targetEth } = useCurveConstants();

  const raised = liveRaisedEth !== undefined
    ? liveRaisedEth
    : realEthRaised ? Number(formatEther(realEthRaised)) : 0;

  const progress = graduated
    ? 100
    : progressBps !== undefined
      ? Math.min(Number(progressBps) / 100, 100)   // bps → percent
      : Math.min((raised / targetEth) * 100, 100);

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

  function barStyle(p: number): { gradient: string; glow: string } {
    if (p >= 85) return {
      gradient: 'linear-gradient(90deg, hsl(4 84% 46%) 0%, hsl(18 92% 64%) 100%)',
      glow: `0 0 18px hsl(4 84% 58% / 0.55)`,
    };
    if (p >= 60) return {
      gradient: 'linear-gradient(90deg, hsl(24 90% 46%) 0%, hsl(36 92% 60%) 100%)',
      glow: `0 0 16px hsl(24 90% 55% / 0.45)`,
    };
    if (p >= 30) return {
      gradient: 'linear-gradient(90deg, hsl(42 88% 42%) 0%, hsl(48 90% 56%) 100%)',
      glow: `0 0 14px hsl(42 88% 50% / 0.40)`,
    };
    return {
      gradient: 'linear-gradient(90deg, hsl(142 66% 36%) 0%, hsl(152 68% 48%) 100%)',
      glow: `0 0 12px hsl(142 66% 44% / 0.38)`,
    };
  }

  const { gradient, glow } = barStyle(pct);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Bonding Curve</span>
        <span className="font-mono text-sm text-foreground tabular-nums">
          {raised.toFixed(3)} <span className="text-muted-foreground">/ {targetEth} ETH</span>
        </span>
      </div>

      <div className="relative h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/8">
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-none overflow-hidden"
          style={{
            width: `${pct}%`,
            background: gradient,
            boxShadow: pct > 2 ? glow : 'none',
          }}
        >
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
          <span className="text-xs text-muted-foreground font-mono">target: {targetEth} ETH</span>
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
