import { useEthPrice } from '@/hooks/use-eth-price';

export function Footer() {
  const { data: ethPrice } = useEthPrice();

  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur-sm">
      <div className="container max-w-7xl mx-auto px-3 md:px-8 h-7 flex items-center text-[10px] font-mono uppercase tracking-wider text-muted-foreground overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 md:gap-4 whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
            <span className="text-foreground/80"><span className="hidden sm:inline">Network </span>Base</span>
          </span>
          <span className="text-border">|</span>
          <span>
            ETH <span className="text-foreground/90 tabular-nums">${ethPrice ? ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
