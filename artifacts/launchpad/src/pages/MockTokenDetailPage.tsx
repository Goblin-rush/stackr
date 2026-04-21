import { useParams, Link } from 'wouter';
import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PriceChart } from '@/components/token/PriceChart';
import { TradeHistoryTable } from '@/components/token/TradeHistoryTable';
import { HoldersList } from '@/components/token/HoldersList';
import { getMockToken } from '@/lib/mock-tokens';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Copy, ArrowLeft, ExternalLink, Globe, Twitter } from 'lucide-react';

export default function MockTokenDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const token = getMockToken(slug);
  const [tab, setTab] = useState('chart');

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground font-mono">Token not found.</p>
        </main>
      </div>
    );
  }

  const progress = Math.min((token.raised / token.target) * 100, 100);
  const change24h = token.graduated ? -2.4 : 18.7;
  const volume24h = token.graduated ? 42.1 : token.raised * 1.8;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6 md:px-8 overflow-x-hidden w-full min-w-0">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 font-mono uppercase tracking-widest">
            <ArrowLeft className="h-3 w-3" /> All tokens
          </button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* MAIN COLUMN */}
          <div className="lg:col-span-8 space-y-4 min-w-0">

            {/* HEADER */}
            <div className="border border-border rounded-md bg-card p-4 md:p-5 min-w-0">
              <div className="flex items-start gap-3 md:gap-4 min-w-0">
                <div
                  className="w-12 h-12 md:w-14 md:h-14 rounded-md flex items-center justify-center shrink-0 font-black text-white text-base"
                  style={{ background: token.avatarColor }}
                >
                  {token.symbol.slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground break-words">
                      {token.name}
                    </h1>
                    <span className="text-sm text-primary font-mono uppercase bg-primary/10 px-2 py-0.5 border border-primary/20 rounded">
                      ${token.symbol}
                    </span>
                    {token.graduated ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase tracking-wider">
                        Graduated · DEX
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded uppercase tracking-wider">
                        Bonding
                      </span>
                    )}
                  </div>

                  {token.description && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {token.description}
                    </p>
                  )}

                  <div className="flex items-center gap-x-3 gap-y-1.5 mt-3 text-xs font-mono text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors min-w-0">
                      <span className="opacity-60">Contract:</span>
                      <span className="text-foreground truncate">
                        {token.contract.slice(0, 6)}…{token.contract.slice(-4)}
                      </span>
                      <Copy className="h-3 w-3 shrink-0" />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="opacity-60">Created by:</span>
                      <span className="text-foreground">
                        {token.creator.slice(0, 6)}…{token.creator.slice(-4)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                      <Globe className="h-3 w-3" /> Website
                    </span>
                    <span className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                      <Twitter className="h-3 w-3" /> Twitter
                    </span>
                    <span className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                      <ExternalLink className="h-3 w-3" /> Etherscan
                    </span>
                  </div>
                </div>
              </div>

              {/* STATS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-border/60">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Price</p>
                  <p className="font-mono text-base font-bold text-foreground">${token.price}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">24h Change</p>
                  <p className={`font-mono text-base font-bold ${change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Market Cap</p>
                  <p className="font-mono text-base font-bold text-foreground">{token.mcap}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">24h Volume</p>
                  <p className="font-mono text-base font-bold text-foreground">{volume24h.toFixed(2)} ETH</p>
                </div>
              </div>
            </div>

            {/* CHART + TABS */}
            <div className="border border-border rounded-md bg-card overflow-hidden">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full justify-start rounded-none border-b border-border bg-muted/10 h-10 px-2 gap-1">
                  <TabsTrigger
                    value="chart"
                    className="text-xs font-mono uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-none rounded-sm"
                  >
                    Chart
                  </TabsTrigger>
                  <TabsTrigger
                    value="trades"
                    className="text-xs font-mono uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-none rounded-sm"
                  >
                    Trades
                  </TabsTrigger>
                  <TabsTrigger
                    value="holders"
                    className="text-xs font-mono uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-none rounded-sm"
                  >
                    Holders
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="m-0 p-3">
                  <div className="flex items-center gap-1 mb-2 px-1 flex-wrap">
                    {['5m', '15m', '1h', '4h', '1d'].map((tf, i) => (
                      <button
                        key={tf}
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                          i === 1
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground border border-transparent'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                    <div className="ml-auto text-[10px] font-mono text-muted-foreground hidden md:block">
                      Powered by lightweight-charts
                    </div>
                  </div>
                  <PriceChart seed={token.slug} basePrice={token.priceNum} graduated={token.graduated} height={380} />
                </TabsContent>

                <TabsContent value="trades" className="m-0">
                  <TradeHistoryTable seed={token.slug} basePrice={token.priceNum} symbol={token.symbol} />
                </TabsContent>

                <TabsContent value="holders" className="m-0">
                  <HoldersList seed={token.slug} symbol={token.symbol} graduated={token.graduated} />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="lg:col-span-4 space-y-4 min-w-0">

            {/* BONDING CURVE PROGRESS */}
            <div className="border border-border rounded-md bg-card p-4">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                  Bonding curve
                </span>
                <span className="font-mono text-xs text-foreground">
                  {token.raised.toFixed(3)}{' '}
                  <span className="text-muted-foreground">/ {token.target} ETH</span>
                </span>
              </div>

              <div className="relative h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${
                    token.graduated
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : 'bg-gradient-to-r from-primary/80 to-primary'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex justify-between mt-2">
                <span className="text-[11px] text-muted-foreground font-mono">
                  {progress.toFixed(2)}% filled
                </span>
                {token.graduated ? (
                  <span className="text-[11px] text-emerald-400 font-medium">Graduated ✓</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">target {token.target} ETH</span>
                )}
              </div>

              {token.graduated && (
                <div className="mt-3 bg-emerald-500/8 border border-emerald-500/20 p-2.5 rounded text-[11px] text-emerald-400 font-mono">
                  Liquidity migrated to DEX. LP tokens burned.
                </div>
              )}
            </div>

            {/* TRADE WIDGET (mock) */}
            <div className="border border-border rounded-md bg-card overflow-hidden">
              <div className="grid grid-cols-2 border-b border-border h-10 bg-muted/10">
                <button className="text-xs font-mono uppercase tracking-widest text-emerald-400 bg-card border-r border-border">
                  Buy
                </button>
                <button className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                  Sell
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  <span>Amount (ETH)</span>
                  <span>Balance: 0.0000</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="0.0"
                    className="w-full font-mono text-lg bg-muted/30 border border-border/50 h-12 px-3 rounded outline-none focus:border-primary/40"
                    readOnly
                  />
                  <span className="absolute right-4 top-3.5 text-muted-foreground font-mono text-sm">ETH</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['0.05', '0.1', '0.5', '1'].map((v) => (
                    <button
                      key={v}
                      className="text-[11px] font-mono py-1 bg-muted/30 hover:bg-muted/60 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <button className="w-full h-11 font-bold tracking-widest text-xs uppercase bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">
                  Connect wallet
                </button>
                <p className="text-[10px] text-center text-muted-foreground font-mono">
                  Preview only · 1% slippage applied
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
