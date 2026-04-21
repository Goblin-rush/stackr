import { XIcon } from './Navbar';

const X_URL = 'https://x.com/aethpad?s=21';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur-sm">
      <div className="container max-w-7xl mx-auto px-4 md:px-8 h-10 flex items-center justify-center">
        <a
          href={X_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Aethpad on X"
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <XIcon className="h-4 w-4" />
        </a>
      </div>
    </footer>
  );
}
