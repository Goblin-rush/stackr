import { Link } from 'wouter';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { metaMask } from 'wagmi/connectors';

export function Navbar() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-14 items-center max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-1 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-mono font-bold text-xl tracking-tight text-primary">TERMINAL</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {isConnected ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground font-mono hidden sm:inline-block">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <Button variant="outline" size="sm" onClick={() => disconnect()}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => connect({ connector: metaMask() })}>
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
