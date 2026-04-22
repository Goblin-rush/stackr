import { useParams, Link } from 'wouter';
import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Globe, Send } from 'lucide-react';

interface DemoToken {
  symbol: string;
  name: string;
  description: string;
  creator: string;
  age: string;
  graduated: boolean;
  priceUsd: string;
  priceEth: string;
  mcapUsd: string;
  raisedEth: number;
  targetEth: number;
  holders: number;
  change24h: number;
  trades: { type: 'buy' | 'sell'; eth: string; tokens: string; addr: string; ago: string }[];
  topHolders: { addr: string; pct: number; tokens: string }[];
  twitter?: string;
  telegram?: string;
  website?: string;
}

const DEMO_TOKENS: Record<string, DemoToken> = {
  STR: {
    symbol: 'STR',
    name: 'Asteroid Shiba',
    description:
      'The degen dog that survived the asteroid. Community-driven memecoin launched on the Aethpad bonding curve.',
    creator: '0x9f12…21Ab',
    age: '2h',
    graduated: false,
    priceUsd: '$0.0000142',
    priceEth: '0.0000000041',
    mcapUsd: '$24.3K',
    raisedEth: 1.84,
    targetEth: 3.5,
    holders: 142,
    change24h: 18.4,
    trades: [
      { type: 'buy', eth: '0.041', tokens: '14.2M', addr: '0xa1…44', ago: '12s' },
      { type: 'buy', eth: '0.087', tokens: '29.8M', addr: '0xbe…02', ago: '38s' },
      { type: 'sell', eth: '0.022', tokens: '7.5M', addr: '0xc4…11', ago: '1m' },
      { type: 'buy', eth: '0.155', tokens: '52.1M', addr: '0xd0…aa', ago: '2m' },
      { type: 'buy', eth: '0.013', tokens: '4.4M', addr: '0xee…81', ago: '4m' },
    ],
    topHolders: [
      { addr: '0xa1d4…1234', pct: 4.8, tokens: '48.0M' },
      { addr: '0xbe02…aa11', pct: 3.2, tokens: '32.0M' },
      { addr: '0xc4f1…cc02', pct: 2.6, tokens: '26.0M' },
      { addr: '0xd0aa…ee31', pct: 1.9, tokens: '19.0M' },
      { addr: '0xee81…ff10', pct: 1.4, tokens: '14.0M' },
    ],
    twitter: 'asteroidshiba',
    telegram: 'asteroidshiba',
    website: 'https://asteroidshiba.xyz',
  },
  BNK: {
    symbol: 'BNK',
    name: 'Bonkers',
    description: 'Fully bonded. Liquidity migrated to Uniswap V2 with LP tokens burned forever.',
    creator: '0x33ab…be12',
    age: '6d',
    graduated: true,
    priceUsd: '$0.0001231',
    priceEth: '0.000000035',
    mcapUsd: '$148K',
    raisedEth: 3.5,
    targetEth: 3.5,
    holders: 1820,
    change24h: -4.2,
    trades: [
      { type: 'sell', eth: '0.812', tokens: '6.6M', addr: '0xf1…22', ago: '8s' },
      { type: 'buy', eth: '1.250', tokens: '10.2M', addr: '0x88…91', ago: '24s' },
      { type: 'buy', eth: '0.430', tokens: '3.5M', addr: '0x12…7b', ago: '1m' },
    ],
    topHolders: [
      { addr: '0xf1cc…2200', pct: 6.2, tokens: '62.0M' },
      { addr: '0x88ab…9131', pct: 4.4, tokens: '44.0M' },
      { addr: '0x1234…7b01', pct: 3.1, tokens: '31.0M' },
    ],
    twitter: 'bonkerscoin',
    telegram: 'bonkerscoin_tg',
  },
  PEPE: {
    symbol: 'PEPE',
    name: 'Memetics Lab',
    description: 'Lab-grown memetics. Fresh bond, early entry zone.',
    creator: '0xf244…00cc',
    age: '11m',
    graduated: false,
    priceUsd: '$0.00000091',
    priceEth: '0.00000000026',
    mcapUsd: '$3.1K',
    raisedEth: 0.42,
    targetEth: 3.5,
    holders: 31,
    change24h: 0,
    trades: [
      { type: 'buy', eth: '0.012', tokens: '46.1M', addr: '0xaa…01', ago: '1m' },
      { type: 'buy', eth: '0.055', tokens: '211M', addr: '0xbb…22', ago: '3m' },
    ],
    topHolders: [
      { addr: '0xaa11…0101', pct: 8.1, tokens: '81.0M' },
      { addr: '0xbb22…0202', pct: 5.2, tokens: '52.0M' },
    ],
    twitter: 'memeticslab',
  },
  BASED: {
    symbol: 'BASED',
    name: 'Based God Coin',
    description: 'For the based, by the based. Ship code, hold bags.',
    creator: '0xab77…77f1',
    age: '4h',
    graduated: false,
    priceUsd: '$0.0000087',
    priceEth: '0.0000000025',
    mcapUsd: '$14.7K',
    raisedEth: 1.12,
    targetEth: 3.5,
    holders: 88,
    change24h: 7.8,
    trades: [
      { type: 'buy', eth: '0.025', tokens: '10.0M', addr: '0x1a…ff', ago: '40s' },
      { type: 'sell', eth: '0.011', tokens: '4.4M', addr: '0x2b…ee', ago: '2m' },
    ],
    topHolders: [
      { addr: '0x1aff…ff01', pct: 5.1, tokens: '51.0M' },
      { addr: '0x2bee…ee02', pct: 3.8, tokens: '38.0M' },
    ],
    twitter: 'basedgodcoin',
    telegram: 'basedgodcoin',
    website: 'https://basedgod.xyz',
  },
  BLU: {
    symbol: 'BLU',
    name: 'Blue Chip Inu',
    description: 'Pretending to be a blue chip until it actually is.',
    creator: '0x7d11…1144',
    age: '38m',
    graduated: false,
    priceUsd: '$0.000003',
    priceEth: '0.00000000087',
    mcapUsd: '$8.2K',
    raisedEth: 0.71,
    targetEth: 3.5,
    holders: 54,
    change24h: 2.1,
    trades: [
      { type: 'buy', eth: '0.018', tokens: '20.7M', addr: '0xcc…11', ago: '50s' },
    ],
    topHolders: [
      { addr: '0xcc11…1100', pct: 4.2, tokens: '42.0M' },
    ],
    twitter: 'bluechipinu',
    telegram: 'bluechipinu',
  },
};

function ProgressBar({ pct }: { pct: number }) {
  const p = Math.min(pct, 100);
  let gradient = 'linear-gradient(90deg, hsl(142 66% 36%) 0%, hsl(152 68% 48%) 100%)';
  let glow = '0 0 10px hsl(142 66% 44% / 0.38)';
  if (p >= 85) {
    gradient = 'linear-gradient(90deg, hsl(4 84% 46%) 0%, hsl(18 92% 64%) 100%)';
    glow = '0 0 14px hsl(4 84% 58% / 0.55)';
  } else if (p >= 60) {
    gradient = 'linear-gradient(90deg, hsl(24 90% 46%) 0%, hsl(36 92% 60%) 100%)';
    glow = '0 0 12px hsl(24 90% 55% / 0.45)';
  } else if (p >= 30) {
    gradient = 'linear-gradient(90deg, hsl(42 88% 42%) 0%, hsl(48 90% 56%) 100%)';
    glow = '0 0 10px hsl(42 88% 50% / 0.40)';
  }
  return (
    <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/6">
      <div
        className="absolute top-0 left-0 h-full rounded-full overflow-hidden transition-all duration-700"
        style={{ width: `${p}%`, background: gradient, boxShadow: p > 3 ? glow : 'none' }}
      >
        <span
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
            animation: 'shimmer 2.2s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

export default function DemoTokenPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const t = DEMO_TOKENS[symbol?.toUpperCase() ?? ''];
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');

  if (!t) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground font-mono">Demo token not found.</p>
        </main>
      </div>
    );
  }

  const pct = Math.min((t.raisedEth / t.targetEth) * 100, 100);

  const change24hPositive = t.change24h >= 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-5 md:px-8">
        <div className="flex items-center justify-between mb-5">
          <Link href="/">
            <button className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3 w-3" strokeWidth={2.5} />
              All tokens
            </button>
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60 bg-white/4 border border-border/40 rounded-full px-3 py-1">
            <span className="h-1.5 w-1.5 bg-amber-400/70 rounded-full" />
            Preview · demo data
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT */}
          <div className="lg:col-span-8 space-y-4">

            {/* Token header */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              {/* Primary stripe accent */}
              <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />

              <div className="p-5 md:p-6">
                {/* Symbol + name row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-3xl md:text-4xl font-black tracking-tighter leading-none text-gradient">
                        ${t.symbol}
                      </span>
                      <h1 className="text-base md:text-lg font-bold text-foreground/90 truncate">
                        {t.name}
                      </h1>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-1.5">
                      by {t.creator} · {t.age} ago · {t.holders} holders
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full border ${
                    t.graduated
                      ? 'border-primary/50 text-primary bg-primary/10'
                      : 'border-border/60 text-muted-foreground bg-white/4'
                  }`}>
                    {t.graduated ? 'ON DEX' : 'BONDING'}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Price', value: t.priceUsd, highlight: false },
                    { label: 'Market Cap', value: t.mcapUsd, highlight: false },
                    {
                      label: '24h Change',
                      value: `${change24hPositive ? '+' : ''}${t.change24h.toFixed(1)}%`,
                      highlight: true,
                      positive: change24hPositive,
                    },
                    { label: 'Holders', value: String(t.holders), highlight: false },
                  ].map((cell) => (
                    <div key={cell.label} className="rounded-lg bg-white/3 border border-border/40 px-3 py-2.5">
                      <div className="text-[9px] font-semibold tracking-wider text-muted-foreground/70 mb-1 uppercase">
                        {cell.label}
                      </div>
                      <div className={`text-sm font-bold tabular-nums ${
                        cell.highlight
                          ? cell.positive ? 'text-emerald-400' : 'text-primary'
                          : 'text-foreground'
                      }`}>
                        {cell.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bonding curve progress */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                      Bonding curve
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-foreground/80">
                      {pct.toFixed(0)}% · {t.raisedEth} / {t.targetEth} ETH
                    </span>
                  </div>
                  <ProgressBar pct={pct} />
                </div>
              </div>
            </div>

            {/* About */}
            <div className="rounded-xl bg-card border border-border/60 p-5">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase mb-2.5">About</p>
              <p className="text-sm text-foreground/90 leading-relaxed">{t.description}</p>
              {(t.twitter || t.telegram || t.website) && (
                <div className="flex items-center gap-2 mt-3.5 flex-wrap">
                  {t.twitter && (
                    <a
                      href={`https://x.com/${t.twitter}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/50 bg-white/3 hover:bg-white/6 hover:border-primary/40 hover:text-primary transition-all"
                    >
                      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span>@{t.twitter}</span>
                    </a>
                  )}
                  {t.telegram && (
                    <a
                      href={`https://t.me/${t.telegram}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/50 bg-white/3 hover:bg-white/6 hover:border-primary/40 hover:text-primary transition-all"
                    >
                      <Send className="h-3 w-3 shrink-0" />
                      <span>@{t.telegram}</span>
                    </a>
                  )}
                  {t.website && (
                    <a
                      href={t.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/50 bg-white/3 hover:bg-white/6 hover:border-primary/40 hover:text-primary transition-all"
                    >
                      <Globe className="h-3 w-3 shrink-0" />
                      <span>{t.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Chart */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  Price · 15m
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
                  mock
                </span>
              </div>
              <div className="relative h-64 px-2 pt-2 pb-1">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none px-2 pt-2 pb-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="border-t border-border/25" />
                  ))}
                </div>
                <div className="absolute left-2 top-0 bottom-0 flex flex-col justify-between text-[8px] font-mono text-muted-foreground/50 py-2">
                  <span>0.000018</span>
                  <span>0.000016</span>
                  <span>0.000014</span>
                  <span>0.000012</span>
                  <span>0.000010</span>
                </div>
                <div className="absolute inset-0 pl-14 pr-3 flex items-stretch gap-[3px]">
                  {(() => {
                    const candles = [
                      { o: 30, c: 38, h: 42, l: 28, up: true },
                      { o: 38, c: 35, h: 41, l: 32, up: false },
                      { o: 35, c: 44, h: 47, l: 33, up: true },
                      { o: 44, c: 41, h: 46, l: 38, up: false },
                      { o: 41, c: 50, h: 54, l: 40, up: true },
                      { o: 50, c: 48, h: 53, l: 45, up: false },
                      { o: 48, c: 56, h: 60, l: 47, up: true },
                      { o: 56, c: 54, h: 58, l: 51, up: false },
                      { o: 54, c: 62, h: 65, l: 53, up: true },
                      { o: 62, c: 58, h: 64, l: 56, up: false },
                      { o: 58, c: 67, h: 70, l: 56, up: true },
                      { o: 67, c: 72, h: 76, l: 65, up: true },
                      { o: 72, c: 69, h: 74, l: 67, up: false },
                      { o: 69, c: 78, h: 82, l: 68, up: true },
                      { o: 78, c: 75, h: 80, l: 73, up: false },
                      { o: 75, c: 84, h: 88, l: 74, up: true },
                      { o: 84, c: 81, h: 86, l: 79, up: false },
                      { o: 81, c: 88, h: 91, l: 80, up: true },
                      { o: 88, c: 92, h: 95, l: 86, up: true },
                      { o: 92, c: 90, h: 94, l: 88, up: false },
                      { o: 90, c: 95, h: 97, l: 89, up: true },
                    ];
                    return candles.map((c, i) => {
                      const top = 100 - c.h;
                      const bottom = 100 - c.l;
                      const bodyTop = 100 - Math.max(c.o, c.c);
                      const bodyBot = 100 - Math.min(c.o, c.c);
                      const color = c.up ? '#22c55e' : '#D63A1F';
                      return (
                        <div key={i} className="relative flex-1">
                          <div
                            className="absolute left-1/2 -translate-x-1/2 w-px opacity-70"
                            style={{ top: `${top}%`, height: `${bottom - top}%`, background: color }}
                          />
                          <div
                            className="absolute left-[10%] right-[10%] rounded-sm"
                            style={{
                              top: `${bodyTop}%`,
                              height: `${Math.max(bodyBot - bodyTop, 1.5)}%`,
                              background: c.up ? color : 'transparent',
                              border: `1px solid ${color}`,
                            }}
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Recent trades */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="px-5 py-3 border-b border-border/40">
                <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  Recent Trades
                </span>
              </div>
              <div>
                {t.trades.map((tr, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 items-center gap-2 px-5 py-2.5 border-b border-border/30 last:border-0 text-xs font-mono tabular-nums hover:bg-white/2 transition-colors"
                  >
                    <div className="col-span-2 flex items-center gap-1.5">
                      {tr.type === 'buy' ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-primary" strokeWidth={2.5} />
                      )}
                      <span className={`font-semibold text-[10px] uppercase tracking-wider ${
                        tr.type === 'buy' ? 'text-emerald-400' : 'text-primary'
                      }`}>
                        {tr.type}
                      </span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="text-foreground/90">{tr.eth}</span>
                      <span className="text-muted-foreground/60 ml-1 text-[10px]">ETH</span>
                    </div>
                    <div className="col-span-3 text-right text-foreground/80">{tr.tokens}</div>
                    <div className="col-span-2 text-right text-muted-foreground/60">{tr.addr}</div>
                    <div className="col-span-2 text-right text-muted-foreground/50">{tr.ago}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — trade widget + holders */}
          <div className="lg:col-span-4 space-y-4">

            {/* Trade widget */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="grid grid-cols-2 p-1.5 gap-1.5 border-b border-border/40">
                {(['buy', 'sell'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`text-[11px] font-semibold uppercase tracking-wider py-2.5 rounded-lg transition-all ${
                      side === s
                        ? s === 'buy'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold tracking-wider text-muted-foreground/70 mb-1.5 uppercase">
                    Amount ({side === 'buy' ? 'ETH' : t.symbol})
                  </label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-background/60 border border-border/60 rounded-lg px-3 py-2.5 text-base font-mono tabular-nums focus:outline-none focus:border-primary/60 focus:bg-background transition-all"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['0.01', '0.05', '0.1', '0.5'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(v)}
                      className="text-[10px] font-mono py-1.5 rounded-md border border-border/50 bg-white/3 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <button
                  className={`w-full text-[12px] font-semibold uppercase tracking-wider py-3 rounded-lg transition-all ${
                    side === 'buy'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-900/30'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20'
                  }`}
                  onClick={() => alert('Demo only — connect wallet to trade.')}
                >
                  {side === 'buy' ? 'Buy' : 'Sell'} {t.symbol}
                </button>
                <p className="text-[10px] font-mono text-muted-foreground/50 text-center">
                  Tax: 1.5% burn · 2% holders · 1.5% platform
                </p>
              </div>
            </div>

            {/* Top holders */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="px-5 py-3 border-b border-border/40">
                <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  Top Holders
                </span>
              </div>
              <div>
                {t.topHolders.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-5 py-2.5 border-b border-border/30 last:border-0 text-xs font-mono hover:bg-white/2 transition-colors"
                  >
                    <span className="text-muted-foreground/40 tabular-nums w-4 shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-foreground/80 truncate">{h.addr}</span>
                    <span className="text-muted-foreground/60 tabular-nums shrink-0">{h.tokens}</span>
                    <span className="text-foreground font-semibold tabular-nums shrink-0 w-10 text-right">{h.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
