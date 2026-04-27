import { Link } from 'wouter';
import { useAccount, useDisconnect } from 'wagmi';
import { useWalletModal } from '@/components/wallet/WalletModalContext';
import { Plus, Menu, X, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavbarProps {
  onCreate?: () => void;
}

const X_URL = 'https://x.com/_stackr?s=21';

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2H21l-6.52 7.45L22 22h-6.81l-4.78-6.27L4.8 22H2l7-8L2 2h6.92l4.32 5.74L18.244 2Zm-1.19 18h1.86L7.07 4h-2L17.054 20Z" />
    </svg>
  );
}

export function Navbar({ onCreate }: NavbarProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  // Always open the picker modal so users with multiple wallets installed
  // (Phantom + MetaMask + Rainbow + ...) can choose which one to connect.
  // EIP-6963 discovery inside the modal lists every announced wallet.
  const handleConnect = () => open();

  return (
    <>
      <nav className="border-b border-border/60 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-14 items-center max-w-7xl mx-auto px-4 md:px-8 gap-3">
          {/* Wordmark */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap group">
              <span className="font-black text-base tracking-tight text-foreground group-hover:text-primary transition-colors">
                STACKR
              </span>
            </div>
          </Link>

          {/* Chain chip */}
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest rounded-full border border-primary/40 text-primary px-2.5 py-1 leading-none bg-primary/8">
            ETH Mainnet
          </span>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5 ml-3">
            {[
              { href: '/', label: 'Feed' },
              { href: '/docs', label: 'Docs' },
              { href: '/faq', label: 'FAQ' },
              { href: '/disclaimer', label: 'Disclaimer' },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <span className="text-[12px] font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-white/5">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Follow on X"
              className="hidden md:flex p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
            >
              <XIcon className="h-3.5 w-3.5" />
            </a>
            {isConnected && address ? (
              <div className="flex items-center gap-1.5 bg-white/5 border border-border/60 rounded-md pl-2.5 pr-1.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[11px] font-mono text-foreground/80">
                  {address.slice(0, 6)}··{address.slice(-4)}
                </span>
                <button
                  onClick={() => disconnect()}
                  title="Disconnect"
                  className="ml-1 p-0.5 text-muted-foreground/50 hover:text-destructive rounded transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="inline-flex items-center text-[12px] font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-all glow-primary"
              >
                Connect
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

      {/* Drawer */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} className="fixed inset-0 bg-black/60 z-[200]" />
          <div className="fixed right-0 top-0 bottom-0 w-64 bg-[#0c0c0d] border-l border-white/8 z-[201] flex flex-col">

            {/* Top bar */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/8 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-[14px] tracking-tight text-foreground">STACKR</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Wallet row */}
            <div className="px-4 py-3 border-b border-white/8 shrink-0">
              {isConnected && address ? (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[12px] font-mono text-foreground/70 flex-1 truncate">{address.slice(0, 6)}···{address.slice(-4)}</span>
                  <button onClick={() => { disconnect(); setMenuOpen(false); }} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { handleConnect(); setMenuOpen(false); }}
                  className="flex items-center gap-2 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {[
                { href: '/', label: 'Feed' },
                { href: '/docs', label: 'Docs' },
                { href: '/faq', label: 'FAQ' },
                { href: '/disclaimer', label: 'Disclaimer' },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center px-3 py-2.5 rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    {item.label}
                  </div>
                </Link>
              ))}
            </nav>

            {/* Create Token */}
            <div className="px-4 pb-4 shrink-0">
              <button
                onClick={() => { setMenuOpen(false); if (onCreate) onCreate(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Token
              </button>
            </div>

            {/* Footer */}
            <div className="border-t border-white/8 px-5 py-3 flex items-center justify-between shrink-0">
              <a href={X_URL} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <XIcon className="h-3 w-3" />
                @stackr
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
