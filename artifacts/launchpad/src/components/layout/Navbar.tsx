import { Link } from 'wouter';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { metaMask } from 'wagmi/connectors';
import { Plus, Menu, Rocket, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavbarProps {
  onCreate?: () => void;
}

export function Navbar({ onCreate }: NavbarProps) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

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
            {isConnected ? (
              <>
                <span className="hidden sm:block text-xs font-mono text-muted-foreground bg-secondary border border-border px-2.5 py-1.5 rounded">
                  {address?.slice(0, 6)}···{address?.slice(-4)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => disconnect()} className="text-xs text-muted-foreground hover:text-foreground">
                  disconnect
                </Button>
              </>
            ) : (
              <button
                onClick={() => connect({ connector: metaMask() })}
                className="inline-flex items-center text-xs font-bold bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
              >
                Connect wallet
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
                <a
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <Rocket className="h-4 w-4 text-muted-foreground" />
                  Launchpad
                </a>
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
            <div className="border-t border-border px-4 py-3 text-[10px] font-mono text-muted-foreground">
              Ethereum Mainnet · Live
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
