import { Link } from 'wouter';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAccount } from 'wagmi';
import { Plus, Menu, Rocket, X, LayoutDashboard, BookOpen, Wallet, LogOut, TrendingUp } from 'lucide-react';
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
              { href: '/dashboard', label: 'Profile' },
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200]"
          />
          <div className="fixed right-0 top-0 bottom-0 w-72 bg-[#0e0e0f] border-l border-border/40 z-[201] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="relative px-5 pt-5 pb-4 border-b border-border/40 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 border border-primary/30">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="font-black text-[15px] tracking-tight text-foreground">AETHPAD</span>
                  <span className="h-1.5 w-1.5 bg-primary rounded-full dot-live" />
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/8 rounded-md transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Wallet status */}
              {authenticated && displayAddr ? (
                <div className="mt-3 flex items-center gap-2 bg-white/4 border border-border/40 rounded-md px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[11px] font-mono text-foreground/80 flex-1 truncate">{displayAddr.slice(0, 6)}··{displayAddr.slice(-4)}</span>
                  <button onClick={() => { logout(); setMenuOpen(false); }} className="text-muted-foreground hover:text-primary transition-colors">
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { login(); setMenuOpen(false); }}
                  disabled={!ready}
                  className="mt-3 w-full flex items-center justify-center gap-2 text-[12px] font-semibold bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Connect Wallet
                </button>
              )}
              {/* ETH price */}
              {ethPrice && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60">
                  <span className="h-1.5 w-1.5 bg-primary/50 rounded-full" />
                  ETH <span className="text-foreground/50">${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  <span className="ml-auto text-primary/60 uppercase tracking-widest">Base Network</span>
                </div>
              )}
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 px-2 space-y-0.5">
              {[
                { href: '/', icon: <Rocket className="h-4 w-4" />, label: 'Feed', color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/20' },
                { href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Profile', color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/20' },
                { href: '/docs', icon: <BookOpen className="h-4 w-4" />, label: 'Docs', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-foreground/70 hover:text-foreground hover:bg-white/5 transition-all cursor-pointer group"
                  >
                    <span className={`flex items-center justify-center w-7 h-7 rounded-md border ${item.bg} ${item.border} ${item.color} group-hover:scale-110 transition-transform`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </div>
                </Link>
              ))}

              {/* Create Token CTA */}
              <div className="pt-2 px-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (onCreate) onCreate();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[13px] font-bold bg-primary/10 hover:bg-primary/15 border border-primary/30 hover:border-primary/50 text-primary transition-all group"
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 border border-primary/30 group-hover:scale-110 transition-transform">
                    <Plus className="h-4 w-4" />
                  </span>
                  Create Token
                  <span className="ml-auto text-[10px] font-mono text-primary/50 uppercase tracking-widest">Launch</span>
                </button>
              </div>
            </nav>

            {/* Footer */}
            <div className="border-t border-border/40 px-5 py-4">
              <div className="flex items-center justify-between">
                <a href={X_URL} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/50 hover:text-primary transition-colors">
                  <XIcon className="h-3 w-3" />
                  @aethpad
                </a>
                <span className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-widest">v2 · Base</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
