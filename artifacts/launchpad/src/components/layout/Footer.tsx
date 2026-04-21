import { useGasPrice } from 'wagmi';
import { formatGwei } from 'viem';

export function Footer() {
  const { data: gas } = useGasPrice({ query: { refetchInterval: 15_000 } });
  const gwei = gas ? Number(formatGwei(gas)) : null;

  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur-sm">
      <div className="container max-w-7xl mx-auto px-4 md:px-8 h-7 flex items-center justify-end text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <span className="whitespace-nowrap">
          GAS <span className="text-foreground/90 tabular-nums">{gwei != null ? gwei.toFixed(2) : '—'}</span> gwei
        </span>
      </div>
    </footer>
  );
}
