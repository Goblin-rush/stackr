import { Link } from 'wouter';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Plus, Menu, Rocket, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavbarProps {
  onCreate?: () => void;
}

export function Navbar({ onCreate }: NavbarProps) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);

  // Auto-connect: if user opens this in a dapp browser (MetaMask/Trust/Rainbow in-app)
  // and there's an injected wallet, set it as active so trades work seamlessly.
  useEffect(() => {
    if (!ready || !authenticated || !wallets.length) return;
    const injected = wallets.find((w) => w.walletClientType === 'metamask' || w.connectorType === 'injected');
    const target = injected ?? wallets[0];
    if (target) setActiveWallet(target).catch(() => {});
  }, [ready, authenticated, wallets, setActiveWallet]);

  // Close menu on Esc
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  const displayAddr = address ?? (user?.wallet?.address as `0x${string}` | undefined);

  return (
    <nav className="border-b border-border bg-card sticky top-0 z-50">
      <div className="container flex h-12 items-center max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-1 items-center justify-between">
          <Link href="/">
            <span className="font-black text-base tracking-tight text-foreground hover:text-primary transition-colors cursor-pointer select-none">
              Aethpad
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {authenticated && displayAddr ? (
              <>
                <span className="hidden sm:block text-xs font-mono text-muted-foreground bg-secondary border border-border px-2.5 py-1.5 rounded">
                  {displayAddr.slice(0, 6)}···{displayAddr.slice(-4)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => logout()} className="text-xs text-muted-foreground hover:text-foreground">
                  disconnect
                </Button>
              </>
            ) : (
              <button
                onClick={() => login()}
                disabled={!ready}
                className="inline-flex items-center text-xs font-bold bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {ready ? 'Connect wallet' : 'Loading…'}
              </button>
            )}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border z-50 flex flex-col">
            <div className="flex items-center justify-between h-12 px-4 border-b border-border">
              <span className="font-black text-base tracking-tight text-foreground">Aethpad</span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 py-2">
              <Link href="/">
                <div
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer"
                >
                  <Rocket className="h-4 w-4 text-muted-foreground" />
                  Launchpad
                </div>
              </Link>
              {onCreate && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onCreate();
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  Create token
                </button>
              )}
            </nav>
          </div>
        </>
      )}
    </nav>
  );
}
