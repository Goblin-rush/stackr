import { XIcon } from './Navbar';

const X_URL = 'https://x.com/stakr_?s=21';

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background/60 backdrop-blur-sm">
      <div className="container max-w-7xl mx-auto px-4 md:px-8 h-10 flex items-center text-[11px] font-mono text-muted-foreground overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-4 whitespace-nowrap flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-foreground/70">Base</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <XIcon className="h-3 w-3" />
            <span>@stakr_</span>
          </a>
          <span className="text-muted-foreground/40 text-[10px]">© Stackr 2026</span>
        </div>
      </div>
    </footer>
  );
}
