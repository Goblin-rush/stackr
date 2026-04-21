import { useBlockNumber, useGasPrice } from 'wagmi';
import { formatGwei } from 'viem';
import { useEthPrice } from '@/hooks/use-eth-price';

export function Footer() {
  const { data: block } = useBlockNumber({ watch: true, query: { refetchInterval: 12_000 } });
  const { data: gas } = useGasPrice({ query: { refetchInterval: 15_000 } });
  const { data: ethPrice } = useEthPrice();
  const gwei = gas ? Number(formatGwei(gas)) : null;

  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur-sm">
      <div className="container max-w-7xl mx-auto px-4 md:px-8 h-7 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-3 md:gap-4 whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-foreground/80">Network ETH·Mainnet</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Block <span className="text-foreground/90 tabular-nums">{block ? `#${block.toString()}` : '—'}</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Gas <span className="text-foreground/90 tabular-nums">{gwei != null ? gwei.toFixed(2) : '—'}</span> gwei
          </span>
          <span className="text-border hidden sm:inline">|</span>
          <span className="hidden sm:inline">
            ETH <span className="text-foreground/90 tabular-nums">${ethPrice ? ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
