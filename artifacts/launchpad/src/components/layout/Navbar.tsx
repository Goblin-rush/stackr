import { Link } from 'wouter';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAccount, useBlockNumber, useGasPrice } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Plus, Menu, Rocket, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatGwei } from 'viem';
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

  const { data: block } = useBlockNumber({ watch: true, query: { refetchInterval: 12_000 } });
  const { data: gas } = useGasPrice({ query: { refetchInterval: 15_000 } });
  const { data: ethPrice } = useEthPrice();
  const gwei = gas ? Number(formatGwei(gas)) : null;

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
      <div className="container flex h-12 items-center max-w-7xl mx-auto px-4 md:px-8 gap-4">
        <Link href="/">
          <span className="font-black text-base tracking-tight text-foreground hover:text-primary transition-colors cursor-pointer select-none whitespace-nowrap">
            Aethpad
          </span>
        </Link>

        <div className="flex items-center gap-2 ml-auto">
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
            <div className="border-t border-border px-4 pt-3 pb-2 md:hidden">
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Aethpad on X"
                onClick={() => setMenuOpen(false)}
                className="inline-flex p-1.5 -ml-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </a>
            </div>
            <div className="border-t border-border p-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground space-y-1.5 md:hidden">
              <div className="flex items-center justify-between">
                <span>Network</span>
                <span className="flex items-center gap-1.5 text-foreground/80">
                  <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full" /> ETH·Mainnet
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Block</span>
                <span className="text-foreground/90 tabular-nums">{block ? `#${block.toString()}` : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Gas</span>
                <span className="text-foreground/90 tabular-nums">{gwei != null ? `${gwei.toFixed(2)} gwei` : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>ETH</span>
                <span className="text-foreground/90 tabular-nums">{ethPrice ? `$${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
