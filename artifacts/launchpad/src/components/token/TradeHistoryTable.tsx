import { useMemo } from 'react';

interface TradeHistoryTableProps {
  seed: string;
  basePrice: number;
  symbol: string;
}

interface Trade {
  type: 'buy' | 'sell';
  account: string;
  ethAmount: number;
  tokenAmount: number;
  price: number;
  ageSec: number;
  txHash: string;
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

function formatAge(s: number): string {
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function generate(seed: string, basePrice: number): Trade[] {
  const r = rng(seed + ':trades');
  const out: Trade[] = [];
  let age = 8 + r() * 40;
  for (let i = 0; i < 35; i++) {
    const isBuy = r() > 0.42;
    const ethAmount = +(0.005 + r() * 0.45).toFixed(4);
    const drift = 0.6 + (35 - i) / 35 * 0.6;
    const price = basePrice * drift * (0.92 + r() * 0.18);
    const tokenAmount = ethAmount / price;
    out.push({
      type: isBuy ? 'buy' : 'sell',
      account: randAddr(r),
      ethAmount,
      tokenAmount,
      price,
      ageSec: age,
      txHash: randAddr(r),
    });
    age += 30 + r() * 600;
  }
  return out;
}

export function TradeHistoryTable({ seed, basePrice, symbol }: TradeHistoryTableProps) {
  const trades = useMemo(() => generate(seed, basePrice), [seed, basePrice]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-muted-foreground uppercase text-[10px] tracking-widest border-b border-border/50">
            <th className="text-left py-2 px-3 font-medium">Type</th>
            <th className="text-right py-2 px-3 font-medium">Price (ETH)</th>
            <th className="text-right py-2 px-3 font-medium">{symbol}</th>
            <th className="text-right py-2 px-3 font-medium">ETH</th>
            <th className="text-left py-2 px-3 font-medium">Trader</th>
            <th className="text-right py-2 px-3 font-medium">Age</th>
            <th className="text-right py-2 px-3 font-medium">Tx</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
              <td className="py-2 px-3">
                <span
                  className={
                    t.type === 'buy'
                      ? 'text-emerald-400 font-semibold uppercase'
                      : 'text-red-400 font-semibold uppercase'
                  }
                >
                  {t.type}
                </span>
              </td>
              <td className="text-right py-2 px-3 text-foreground">{t.price.toFixed(8)}</td>
              <td className="text-right py-2 px-3 text-foreground">
                {t.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className="text-right py-2 px-3 text-foreground">{t.ethAmount.toFixed(4)}</td>
              <td className="py-2 px-3 text-muted-foreground">{shortAddr(t.account)}</td>
              <td className="text-right py-2 px-3 text-muted-foreground">{formatAge(t.ageSec)}</td>
              <td className="text-right py-2 px-3 text-primary/70 hover:text-primary cursor-pointer">
                {t.txHash.slice(0, 6)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
