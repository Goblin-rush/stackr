import { Link } from 'wouter';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { metaMask } from 'wagmi/connectors';

export function Navbar() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <nav className="border-b border-border bg-background sticky top-0 z-50">
      <div className="container flex h-13 items-center max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-1 items-center justify-between">
          <Link href="/">
            <span className="font-black text-lg tracking-tight text-foreground hover:text-primary transition-colors cursor-pointer select-none">
              pump<span className="text-primary">.eth</span>
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
              <button onClick={() => connect({ connector: metaMask() })} style={{ color: '#ff6a00', fontWeight: 600 }} className="text-sm hover:opacity-75 transition-opacity">
                Connect wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
