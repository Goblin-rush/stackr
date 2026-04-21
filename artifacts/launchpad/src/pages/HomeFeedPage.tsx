import { Navbar } from '@/components/layout/Navbar';
import { TokenCard } from '@/components/token/TokenCard';
import { CreateTokenModal } from '@/components/token/CreateTokenModal';
import { useLaunchpadTokens } from '@/hooks/use-launchpad';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function HomeFeedPage() {
  const { data: tokens, isLoading } = useLaunchpadTokens(0n, 50n);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const displayTokens = tokens ? [...tokens].reverse() : [];

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
        ) : displayTokens.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground text-sm">No tokens launched yet.</p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-3 text-primary text-sm underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              Be the first →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayTokens.map((address) => (
              <TokenCard key={address} address={address} />
            ))}
          </div>
        )}
      </main>

      <CreateTokenModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
