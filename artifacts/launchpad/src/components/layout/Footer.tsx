export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background/60 backdrop-blur-sm">
      <div className="container max-w-7xl mx-auto px-4 md:px-8 h-10 flex items-center text-[11px] font-mono text-muted-foreground overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-4 whitespace-nowrap flex-1">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-primary rounded-full dot-live" />
            <span className="text-foreground/70">Base</span>
          </span>
        </div>
        <span className="text-muted-foreground/40 text-[10px]">© Aethpad 2025</span>
      </div>
    </footer>
  );
}
