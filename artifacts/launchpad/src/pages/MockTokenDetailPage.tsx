import { useParams, Link } from 'wouter';
import { useState, useMemo } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PriceChart, type Timeframe } from '@/components/token/PriceChart';
import { TradeHistoryTable } from '@/components/token/TradeHistoryTable';
import { HoldersList } from '@/components/token/HoldersList';
import { SlippageSettings } from '@/components/token/SlippageSettings';
import { useLiveToken } from '@/hooks/use-live-token';
import { useSlippage } from '@/hooks/use-slippage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Copy, ExternalLink, Globe, Twitter } from 'lucide-react';

const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h', '1d'];
const TARGET_ETH = 3.5;
const VIRTUAL_ETH = 1.5;
const VIRTUAL_TOKENS = 1_073_000_000;
const K = VIRTUAL_ETH * VIRTUAL_TOKENS;

export default function MockTokenDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const live = useLiveToken(slug);
  const [tab, setTab] = useState('chart');
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const { applyMinOut, percent: slippagePercent } = useSlippage();

  const baseEthRaisedRef = useState(() => live?.token.raised ?? 0)[0];

  const amountNum = parseFloat(amount);
  const isValidAmount = Number.isFinite(amountNum) && amountNum > 0;

  const previewOut = useMemo(() => {
    if (!live || !isValidAmount) return null;
    if (side === 'buy') {
      const newReserve = live.ethReserve + amountNum;
      const tokensOut = K / live.ethReserve - K / newReserve;
      return { tokens: tokensOut, eth: amountNum, isBuy: true };
    } else {
      const tokenReserve = K / live.ethReserve;
      const tokensIn = amountNum;
      const newTokenReserve = tokenReserve + tokensIn;
      const newEthReserve = K / newTokenReserve;
      const ethOut = live.ethReserve - newEthReserve;
      return { tokens: tokensIn, eth: ethOut, isBuy: false };
    }
  }, [live, amountNum, isValidAmount, side]);

  const minReceived = useMemo(() => {
    if (!previewOut) return null;
    const expected = previewOut.isBuy ? previewOut.tokens : previewOut.eth;
    const scaled = BigInt(Math.max(0, Math.floor(expected * 1e9)));
    const min = applyMinOut(scaled);
    return Number(min) / 1e9;
  }, [previewOut, applyMinOut]);

  if (!live) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground font-mono">Token not found.</p>
        </main>
      </div>
    );
  }

  const { token } = live;
  const progress = Math.min((live.ethRaised / TARGET_ETH) * 100, 100);
  const change24h = live.priceChange24hPct;

  const presets = side === 'buy' ? ['0.05', '0.1', '0.5', '1'] : ['25%', '50%', '75%', 'MAX'];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6 md:px-8 overflow-x-hidden w-full min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* MAIN COLUMN */}
          <div className="lg:col-span-8 space-y-4 min-w-0">
            {/* HEADER */}
            <div className="border border-border rounded-md bg-card p-4 md:p-5 min-w-0">
              <div className="flex items-start gap-3 md:gap-4 min-w-0">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-muted-foreground">
                    {token.symbol.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground break-words">
                      {token.name}
                    </h1>
                    <span className="text-sm text-primary font-mono uppercase bg-primary/10 px-2 py-0.5 border border-primary/20 rounded">
                      ${token.symbol}
                    </span>
                    {live.graduated && (
                      <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                        · DEX
                      </span>
                    )}
                  </div>

                  {token.description && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {token.description}
                    </p>
                  )}

                  <div className="mt-3 space-y-1 text-xs font-mono text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span className="opacity-60 shrink-0">Contract</span>
                      <span className="flex items-center gap-1.5 text-foreground hover:text-primary cursor-pointer min-w-0">
                        <span className="truncate">
                          {token.contract.slice(0, 6)}…{token.contract.slice(-4)}
                        </span>
                        <Copy className="h-3 w-3 shrink-0" />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="opacity-60 shrink-0">Created by</span>
                      <span className="text-foreground truncate">
                        {token.creator.slice(0, 6)}…{token.creator.slice(-4)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs font-mono text-muted-foreground">
                    <a className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                      <Globe className="h-3 w-3" /> Website
                    </a>
                    <a className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                      <Twitter className="h-3 w-3" /> Twitter
                    </a>
                    <a className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                      <ExternalLink className="h-3 w-3" /> Etherscan
                    </a>
                  </div>
                </div>
              </div>

              {/* STATS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-border/60">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Price</p>
                  <p className="font-mono text-base font-bold text-foreground tabular-nums">
                    ${(live.price * 3000).toFixed(7)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">24h Change</p>
                  <p
                    className={`font-mono text-base font-bold tabular-nums ${
                      change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {change24h >= 0 ? '+' : ''}
                    {change24h.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Market Cap</p>
                  <p className="font-mono text-base font-bold text-foreground tabular-nums">
                    ${live.marketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">24h Volume</p>
                  <p className="font-mono text-base font-bold text-foreground tabular-nums">
                    {live.volume24hEth.toFixed(2)} ETH
                  </p>
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
                    <span className="ml-1.5 text-[9px] bg-primary/15 text-primary px-1 rounded">
                      {live.trades.length}
                    </span>
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
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded transition-colors ${
                          timeframe === tf
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground border border-transparent'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                  <PriceChart
                    seed={token.slug}
                    baseEthRaised={baseEthRaisedRef}
                    graduated={live.graduated}
                    timeframe={timeframe}
                    height={380}
                    liveTrade={live.lastTrade}
                  />
                </TabsContent>

                <TabsContent value="trades" className="m-0">
                  <TradeHistoryTable trades={live.trades} symbol={token.symbol} />
                </TabsContent>

                <TabsContent value="holders" className="m-0">
                  <HoldersList holders={live.holders} symbol={token.symbol} />
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
                <span className="font-mono text-xs text-foreground tabular-nums">
                  {live.ethRaised.toFixed(3)}{' '}
                  <span className="text-muted-foreground">/ {TARGET_ETH} ETH</span>
                </span>
              </div>

              <div className="relative h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-[width] duration-700 ${
                    live.graduated
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : 'bg-gradient-to-r from-primary/80 to-primary'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex justify-between mt-2">
                <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                  {progress.toFixed(2)}% filled
                </span>
                {live.graduated ? (
                  <span className="text-[11px] text-emerald-400 font-medium">Graduated ✓</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">target {TARGET_ETH} ETH</span>
                )}
              </div>

              {live.graduated && (
                <div className="mt-3 bg-emerald-500/8 border border-emerald-500/20 p-2.5 rounded text-[11px] text-emerald-400 font-mono">
                  Liquidity migrated to DEX. LP tokens burned.
                </div>
              )}
            </div>

            {/* TRADE WIDGET */}
            <div className="border border-border rounded-md bg-card overflow-hidden">
              <div className="flex items-center justify-between px-3 pt-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Trade
                </span>
                <SlippageSettings />
              </div>

              <div className="grid grid-cols-2 border-b border-border h-10 bg-muted/10 mt-3">
                <button
                  onClick={() => {
                    setSide('buy');
                    setAmount('');
                  }}
                  className={`text-xs font-mono uppercase tracking-widest transition-colors ${
                    side === 'buy'
                      ? 'text-emerald-400 bg-card border-r border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => {
                    setSide('sell');
                    setAmount('');
                  }}
                  className={`text-xs font-mono uppercase tracking-widest transition-colors ${
                    side === 'sell'
                      ? 'text-red-400 bg-card border-l border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sell
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  <span>Amount ({side === 'buy' ? 'ETH' : token.symbol})</span>
                  <span>Balance: 0.0000</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
                    }}
                    className="w-full font-mono text-lg bg-muted/30 border border-border/50 h-12 px-3 pr-16 rounded outline-none focus:border-primary/40 tabular-nums"
                  />
                  <span className="absolute right-3 top-3.5 text-muted-foreground font-mono text-sm">
                    {side === 'buy' ? 'ETH' : token.symbol}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {presets.map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(v.replace('%', '').replace('MAX', '0'))}
                      className="text-[11px] font-mono py-1 bg-muted/30 hover:bg-muted/60 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>

                {previewOut && (
                  <div className="bg-muted/30 p-3 rounded border border-border/30 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">You receive (est.)</span>
                      <span className={side === 'buy' ? 'text-emerald-400 font-bold' : 'text-foreground font-bold'}>
                        {previewOut.isBuy
                          ? `${previewOut.tokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${token.symbol}`
                          : `${previewOut.eth.toFixed(6)} ETH`}
                      </span>
                    </div>
                    {minReceived !== null && (
                      <div className="flex justify-between text-[10px] border-t border-border/30 pt-1.5">
                        <span className="text-muted-foreground">
                          Min received ({slippagePercent}% slip)
                        </span>
                        <span className="text-foreground">
                          {previewOut.isBuy
                            ? `${minReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${token.symbol}`
                            : `${minReceived.toFixed(6)} ETH`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  className={`w-full h-11 font-bold tracking-widest text-xs uppercase rounded transition-colors ${
                    side === 'buy'
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-red-500 text-white hover:bg-red-500/90'
                  }`}
                >
                  Connect wallet
                </button>
                <p className="text-[10px] text-center text-muted-foreground font-mono">
                  Preview only · Live simulation
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
