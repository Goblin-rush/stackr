import { useBlockNumber, useGasPrice } from 'wagmi';
import { useEthPrice } from '@/hooks/use-eth-price';
import { FACTORY_ADDRESS } from '@/lib/contracts';
import { formatGwei } from 'viem';

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function StatusBar() {
  const { data: block } = useBlockNumber({ watch: true, query: { refetchInterval: 12_000 } });
  const { data: gas } = useGasPrice({ query: { refetchInterval: 15_000 } });
  const { data: ethPrice } = useEthPrice();

  const gwei = gas ? Number(formatGwei(gas)) : null;

  return (
    <div className="border-t border-border bg-card/60 backdrop-blur-sm">
      <div className="container max-w-7xl mx-auto px-4 md:px-8 h-7 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-3 md:gap-4 whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-foreground/80">ETH·MAINNET</span>
          </span>
          <span className="text-border">|</span>
          <span>
            BLK <span className="text-foreground/90 tabular-nums">{block ? `#${block.toString()}` : '—'}</span>
          </span>
          <span className="text-border">|</span>
          <span>
            GAS <span className="text-foreground/90 tabular-nums">{gwei != null ? gwei.toFixed(2) : '—'}</span> gwei
          </span>
          <span className="text-border hidden sm:inline">|</span>
          <span className="hidden sm:inline">
            ETH <span className="text-foreground/90 tabular-nums">${ethPrice ? ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</span>
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-4 whitespace-nowrap">
          <span className="hidden md:inline">
            FACTORY{' '}
            <a
              href={`https://etherscan.io/address/${FACTORY_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="text-foreground/90 hover:text-primary transition-colors"
            >
              {shortAddr(FACTORY_ADDRESS)}
            </a>
          </span>
          <span className="text-border hidden md:inline">|</span>
          <span>RPC <span className="text-foreground/90">publicnode</span></span>
        </div>
      </div>
    </div>
  );
}
