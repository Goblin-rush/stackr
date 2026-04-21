import { Navbar } from '@/components/layout/Navbar';
import { TokenCard } from '@/components/token/TokenCard';
import { CreateTokenModal } from '@/components/token/CreateTokenModal';
import { useLaunchpadTokens } from '@/hooks/use-launchpad';
import { useState } from 'react';

const MOCK_TOKENS = [
  {
    name: 'Asteroid Shiba',
    symbol: 'ASTEROIDSTR',
    description: 'The degen dog that survived the asteroid. Community-driven meme coin on Ethereum.',
    raised: 1.84,
    target: 3.5,
    mcap: '$24,300',
    price: '0.0000142',
    avatarColor: '#e85d04',
  },
  {
    name: 'Pepe Classic',
    symbol: 'PEPEC',
    description: 'The original frog is back. Rarer than rare, bonding curve edition.',
    raised: 3.5,
    target: 3.5,
    mcap: '$198,000',
    price: '0.000198',
    avatarColor: '#16a34a',
    graduated: true,
  },
  {
    name: 'MoonDoge',
    symbol: 'MDOGE',
    description: null,
    raised: 0.32,
    target: 3.5,
    mcap: '$4,100',
    price: '0.0000041',
    avatarColor: '#7c3aed',
  },
  {
    name: 'Chad Token',
    symbol: 'CHAD',
    description: 'Only chads hold this. Wagmi.',
    raised: 2.1,
    target: 3.5,
    mcap: '$61,500',
    price: '0.0000615',
    avatarColor: '#0284c7',
  },
];

function MockCard({ token }: { token: typeof MOCK_TOKENS[0] }) {
  const progress = Math.min((token.raised / token.target) * 100, 100);
  return (
    <div className="bg-card border border-border rounded-md p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 font-black text-sm text-white"
          style={{ background: token.avatarColor }}
        >
          {token.symbol.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-sm text-foreground truncate">{token.name}</p>
            {'graduated' in token && token.graduated && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded shrink-0">
                DEX
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">${token.symbol}</p>
          {token.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{token.description}</p>
          )}
        </div>
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{token.raised.toFixed(2)} ETH</span>
          <span className="text-primary font-medium">{progress.toFixed(1)}%</span>
        </div>
        <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex justify-between text-xs border-t border-border pt-2">
        <span className="text-muted-foreground">
          MCap: <span className="text-foreground font-mono">{token.mcap}</span>
        </span>
        <span className="text-muted-foreground font-mono">{token.price}</span>
      </div>
    </div>
  );
}

export default function HomeFeedPage() {
  const { data: tokens, isLoading } = useLaunchpadTokens(0n, 50n);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const displayTokens = tokens ? [...tokens].reverse() : [];
  const showMocks = !isLoading && displayTokens.length === 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6 md:px-8">

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              All tokens
            </h1>
            {!isLoading && displayTokens.length > 0 && (
              <span className="text-xs bg-secondary border border-border text-muted-foreground px-2 py-0.5 rounded font-mono">
                {displayTokens.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
          >
            + Create token
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 bg-card animate-pulse border border-border rounded-md" />
            ))}
          </div>
        ) : displayTokens.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayTokens.map((address) => (
              <TokenCard key={address} address={address} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
              {MOCK_TOKENS.map((t) => <MockCard key={t.symbol} token={t} />)}
            </div>
            <p className="text-center text-xs text-muted-foreground py-2">
              Preview only — <button onClick={() => setIsCreateOpen(true)} className="text-primary underline underline-offset-2">launch the first real token</button>
            </p>
          </>
        )}
      </main>

      <CreateTokenModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
