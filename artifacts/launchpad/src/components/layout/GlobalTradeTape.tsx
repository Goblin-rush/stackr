import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useGlobalTradeTape } from '@/hooks/use-global-trade-tape';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return 'now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function shortAddr(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-3)}`;
}

function formatEth(n: number): string {
  if (n >= 1) return n.toFixed(3);
  if (n >= 0.001) return n.toFixed(4);
  return n.toFixed(6);
}

export function GlobalTradeTape() {
  const trades = useGlobalTradeTape(200);
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5_000);
    return () => clearInterval(t);
  }, []);

  // Duplicate items so the marquee loops smoothly
  const items = [...trades, ...trades];

  if (trades.length === 0) {
    return <div className="border-b border-border bg-card/40 h-7" />;
  }

  return (
    <div className="border-b border-border bg-card/40 h-7 overflow-hidden relative">
      <div className="h-full flex items-center px-4">
        <div className="flex items-center gap-5 animate-tape-scroll whitespace-nowrap">
          {items.map((t, i) => {
            const isBuy = t.type === 'buy';
            return (
              <Link key={`${t.id}-${i}`} href={`/token/${t.tokenAddress}`}>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono cursor-pointer hover:text-primary transition-colors group">
                  {isBuy ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-400 shrink-0" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-400 shrink-0" />
                  )}
                  <span className={`uppercase font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.type}
                  </span>
                  <span className="text-foreground tabular-nums">{formatEth(t.ethAmount)}</span>
                  <span className="text-muted-foreground">ETH</span>
                  <span className="text-foreground/80">${t.symbol}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground tabular-nums">{shortAddr(t.account)}</span>
                  <span className="text-muted-foreground/60 tabular-nums">{timeAgo(t.timestamp)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
