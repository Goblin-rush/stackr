import { Navbar } from '@/components/layout/Navbar';
import { TokenCard } from '@/components/token/TokenCard';
import { CreateTokenModal } from '@/components/token/CreateTokenModal';
import { useLaunchpadTokens } from '@/hooks/use-launchpad';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Plus } from 'lucide-react';

export default function HomeFeedPage() {
  const { data: tokens, isLoading } = useLaunchpadTokens(0n, 50n);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Reverse to show newest first
  const displayTokens = tokens ? [...tokens].reverse() : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-8 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-border/50 pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter">MARKET</h1>
            <p className="text-muted-foreground font-mono text-sm mt-2 uppercase tracking-widest">Live Terminal Feed</p>
          </div>
          
          <Button onClick={() => setIsCreateOpen(true)} className="font-bold tracking-wide shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" /> LAUNCH TOKEN
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-muted/50 animate-pulse border border-border/50" />
            ))}
          </div>
        ) : displayTokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-border/50 border-dashed rounded-lg bg-muted/10">
            <p className="text-muted-foreground font-mono mb-4">NO ACTIVE MARKETS DETECTED</p>
            <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
              Initialize First Token
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
