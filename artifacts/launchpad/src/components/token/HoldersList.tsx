import { useMemo } from 'react';

interface HoldersListProps {
  seed: string;
  symbol: string;
  graduated?: boolean;
}

interface Holder {
  address: string;
  amount: number;
  percent: number;
  label?: string;
}

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randAddr(r: () => number) {
  const hex = '0123456789abcdef';
  let s = '0x';
  for (let i = 0; i < 40; i++) s += hex[Math.floor(r() * 16)];
  return s;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const TOTAL_SUPPLY = 1_000_000_000;

function generate(seed: string, graduated: boolean): Holder[] {
  const r = rng(seed + ':holders');
  const holders: Holder[] = [];

  if (graduated) {
    holders.push({
      address: '0x' + 'd'.repeat(40),
      amount: TOTAL_SUPPLY * 0.18,
      percent: 18,
      label: 'Uniswap V2: Pair',
    });
  } else {
    holders.push({
      address: '0x' + 'b'.repeat(40),
      amount: TOTAL_SUPPLY * 0.42,
      percent: 42,
      label: 'Bonding Curve',
    });
  }

  const remaining = 100 - holders[0].percent;
  let acc = 0;
  const top = 24;
  const weights: number[] = [];
  for (let i = 0; i < top; i++) {
    weights.push(Math.pow(r(), 1.6));
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top; i++) {
    const pct = (weights[i] / sum) * remaining;
    acc += pct;
    holders.push({
      address: randAddr(r),
      amount: TOTAL_SUPPLY * (pct / 100),
      percent: pct,
    });
  }

  return holders.sort((a, b) => b.percent - a.percent);
}

export function HoldersList({ seed, symbol, graduated = false }: HoldersListProps) {
  const holders = useMemo(() => generate(seed, graduated), [seed, graduated]);

  return (
    <div>
      <div className="grid grid-cols-12 text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-3 py-2 border-b border-border/50">
        <span className="col-span-1">#</span>
        <span className="col-span-5">Holder</span>
        <span className="col-span-3 text-right">Amount ({symbol})</span>
        <span className="col-span-3 text-right">%</span>
      </div>
      <ul className="divide-y divide-border/30">
        {holders.map((h, i) => (
          <li key={h.address} className="grid grid-cols-12 items-center px-3 py-2 text-xs font-mono hover:bg-muted/20 transition-colors">
            <span className="col-span-1 text-muted-foreground">{i + 1}</span>
            <span className="col-span-5 truncate">
              <span className="text-foreground">{shortAddr(h.address)}</span>
              {h.label && (
                <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                  {h.label}
                </span>
              )}
            </span>
            <span className="col-span-3 text-right text-foreground">
              {h.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="col-span-3 text-right">
              <div className="flex items-center justify-end gap-2">
                <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="h-full bg-primary"
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
