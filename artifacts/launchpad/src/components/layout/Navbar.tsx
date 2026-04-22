import { Link } from 'wouter';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAccount } from 'wagmi';
import { Plus, Menu, Rocket, X, LayoutDashboard } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useEthPrice } from '@/hooks/use-eth-price';

interface NavbarProps {
  onCreate?: () => void;
}

const X_URL = 'https://x.com/aethpad?s=21';

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2H21l-6.52 7.45L22 22h-6.81l-4.78-6.27L4.8 22H2l7-8L2 2h6.92l4.32 5.74L18.244 2Zm-1.19 18h1.86L7.07 4h-2L17.054 20Z" />
    </svg>
  );
}

export function Navbar({ onCreate }: NavbarProps) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: ethPrice } = useEthPrice();

  useEffect(() => {
    if (!ready || !authenticated || !wallets.length) return;
    const injected = wallets.find((w) => w.walletClientType === 'metamask' || w.connectorType === 'injected');
    const target = injected ?? wallets[0];
    if (target) setActiveWallet(target).catch(() => {});
  }, [ready, authenticated, wallets, setActiveWallet]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  const displayAddr = address ?? (user?.wallet?.address as `0x${string}` | undefined);

  return (
    <nav className="border-b-2 border-border bg-background sticky top-0 z-50">
      <div className="container flex h-14 items-center max-w-7xl mx-auto px-4 md:px-8 gap-3">
        {/* Brutal wordmark */}
        <Link href="/">
          <div className="flex items-baseline gap-1.5 cursor-pointer select-none whitespace-nowrap group">
            <span className="font-black text-lg tracking-tighter text-foreground group-hover:text-primary transition-colors">
              AETHPAD
            </span>
            <span className="h-1.5 w-1.5 bg-primary rounded-full self-center -translate-y-px" />
          </div>
        </Link>

        {/* BASE chip — prominent chain identifier */}
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest border-2 border-primary text-primary px-2 py-1 leading-none">
          <span className="h-1.5 w-1.5 bg-primary animate-pulse" />
          BASE
        </span>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 ml-3">
          <Link href="/">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary px-2.5 py-1.5 cursor-pointer transition-colors">
              Feed
            </span>
          </Link>
          <Link href="/dashboard">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary px-2.5 py-1.5 cursor-pointer transition-colors">
              <LayoutDashboard className="h-3 w-3" />
              Dashboard
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {authenticated && displayAddr ? (
            <>
              <span className="hidden sm:block text-[11px] font-mono font-semibold text-foreground bg-secondary border border-border px-2.5 py-1.5">
                {displayAddr.slice(0, 6)}··{displayAddr.slice(-4)}
              </span>
              <button
                onClick={() => logout()}
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive px-2 py-1.5 transition-colors"
              >
                disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => login()}
              disabled={!ready}
              className="inline-flex items-center text-[11px] font-black uppercase tracking-widest bg-primary text-primary-foreground px-3 py-2 hover:bg-primary/85 transition-colors disabled:opacity-50 border-2 border-primary"
            >
              {ready ? 'Connect' : '…'}
            </button>
          )}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r-2 border-border z-50 flex flex-col">
            <div className="flex items-center justify-between h-14 px-4 border-b-2 border-border">
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-lg tracking-tighter text-foreground">AETHPAD</span>
                <span className="h-1.5 w-1.5 bg-primary rounded-full self-center -translate-y-px" />
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 py-2">
              <Link href="/">
                <div
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-foreground hover:bg-secondary transition-colors cursor-pointer border-l-2 border-transparent hover:border-primary"
                >
                  <Rocket className="h-3.5 w-3.5 text-muted-foreground" />
                  Feed
                </div>
              </Link>
              <Link href="/dashboard">
                <div
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-foreground hover:bg-secondary transition-colors cursor-pointer border-l-2 border-transparent hover:border-primary"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
                  My Dashboard
                </div>
              </Link>
              {onCreate && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onCreate();
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-foreground hover:bg-secondary transition-colors border-l-2 border-transparent hover:border-primary"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  Create token
                </button>
              )}
            </nav>
            <div className="border-t-2 border-border px-4 pt-3 pb-2 md:hidden">
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Aethpad on X"
                onClick={() => setMenuOpen(false)}
                className="inline-flex p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </a>
            </div>
            <div className="border-t-2 border-border p-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground space-y-2">
              <div className="flex items-center justify-between">
                <span>Chain</span>
                <span className="flex items-center gap-1.5 text-primary font-bold">
                  <span className="h-1.5 w-1.5 bg-primary" /> BASE
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>ETH</span>
                <span className="text-foreground font-semibold tabular-nums">{ethPrice ? `$${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
