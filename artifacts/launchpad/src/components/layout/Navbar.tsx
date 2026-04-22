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
    <>
      <nav className="border-b border-border/60 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-14 items-center max-w-7xl mx-auto px-4 md:px-8 gap-3">
          {/* Wordmark */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap group">
              <span className="font-black text-base tracking-tight text-foreground group-hover:text-primary transition-colors">
                AETHPAD
              </span>
              <span className="h-1.5 w-1.5 bg-primary rounded-full dot-live" />
            </div>
          </Link>

          {/* BASE chip */}
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest rounded-full border border-primary/40 text-primary px-2.5 py-1 leading-none bg-primary/8">
            <span className="h-1.5 w-1.5 bg-primary rounded-full dot-live" />
            Base
          </span>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5 ml-3">
            {[
              { href: '/', label: 'Feed' },
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/docs', label: 'Docs' },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <span className="text-[12px] font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-white/5">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {authenticated && displayAddr ? (
              <>
                <span className="hidden sm:block text-[11px] font-mono text-muted-foreground bg-white/5 border border-border/60 rounded-md px-2.5 py-1.5">
                  {displayAddr.slice(0, 6)}··{displayAddr.slice(-4)}
                </span>
                <button
                  onClick={() => logout()}
                  className="text-[11px] font-medium text-muted-foreground hover:text-destructive px-2.5 py-1.5 rounded-md transition-colors hover:bg-destructive/8"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => login()}
                disabled={!ready}
                className="inline-flex items-center text-[12px] font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 glow-primary"
              >
                {ready ? 'Connect' : '…'}
              </button>
            )}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Drawer rendered OUTSIDE <nav> to escape backdrop-filter stacking context */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 bg-black/70 z-[200]"
          />
          <div className="fixed right-0 top-0 bottom-0 w-72 bg-card border-l border-border/60 z-[201] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between h-14 px-5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-tight text-foreground">AETHPAD</span>
                <span className="h-1.5 w-1.5 bg-primary rounded-full dot-live" />
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 py-3 px-2">
              {[
                { href: '/', icon: <Rocket className="h-3.5 w-3.5" />, label: 'Feed' },
                { href: '/dashboard', icon: <LayoutDashboard className="h-3.5 w-3.5" />, label: 'My Dashboard' },
                { href: '/docs', icon: <span className="font-mono text-[10px] w-3.5 text-center">§</span>, label: 'Docs' },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <span className="text-muted-foreground/70">{item.icon}</span>
                    {item.label}
                  </div>
                </Link>
              ))}
              {onCreate && (
                <button
                  onClick={() => { setMenuOpen(false); onCreate(); }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground/70" />
                  Create Token
                </button>
              )}
            </nav>
            <div className="border-t border-border/60 px-5 py-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>Chain</span>
                <span className="flex items-center gap-1.5 text-primary font-semibold">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full dot-live" /> Base
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>ETH</span>
                <span className="text-foreground font-semibold tabular-nums">
                  {ethPrice ? `$${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
