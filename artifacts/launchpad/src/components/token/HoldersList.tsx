import type { LiveHolder } from '@/hooks/use-live-token';

interface HoldersListProps {
  holders: LiveHolder[];
  symbol: string;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function HoldersList({ holders, symbol }: HoldersListProps) {
  return (
    <div className="max-h-[480px] overflow-y-auto">
      <div className="grid grid-cols-12 text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-3 py-2 border-b border-border/50 sticky top-0 bg-card z-10">
        <span className="col-span-1">#</span>
        <span className="col-span-5">Holder</span>
        <span className="col-span-3 text-right">Amount ({symbol})</span>
        <span className="col-span-3 text-right">%</span>
      </div>
      <ul className="divide-y divide-border/30">
        {holders.map((h, i) => (
          <li
            key={h.address}
            className="grid grid-cols-12 items-center px-3 py-2 text-xs font-mono hover:bg-muted/20 transition-colors"
          >
            <span className="col-span-1 text-muted-foreground">{i + 1}</span>
            <span className="col-span-5 truncate">
              <span className="text-foreground">{shortAddr(h.address)}</span>
              {h.label && (
                <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                  {h.label}
                </span>
              )}
            </span>
            <span className="col-span-3 text-right text-foreground tabular-nums">
              {h.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="col-span-3 text-right">
              <div className="flex items-center justify-end gap-2">
                <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(h.percent * 2.2, 100)}%` }}
                  />
                </div>
                <span className="text-foreground tabular-nums w-12 text-right">
                  {h.percent.toFixed(2)}%
                </span>
              </div>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
