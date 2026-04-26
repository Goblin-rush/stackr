import { useParams, Link } from 'wouter';
import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Globe, Send, Copy, Check, ExternalLink, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { TVAdvancedChart } from '@/components/token/TVAdvancedChart';
import { SlippageSettings } from '@/components/token/SlippageSettings';

function genAvatarUri(symbol: string): string {
  const palette = ['#c2410c','#7c3aed','#15803d','#1d4ed8','#0e7490','#b45309','#9f1239','#4d7c0f'];
  const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = palette[hash % palette.length];
  const label = symbol.slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="${color}"/><text x="20" y="27" font-family="monospace,sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

interface DemoToken {
  symbol: string;
  name: string;
  image: string;
  address: string;
  description: string;
  creator: string;
  creatorAddress: string;
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
    image: genAvatarUri('STR'),
    address: '0xA1d4F83bE802345Cc1234567890abCDEF12345AB',
    description:
      'The degen dog that survived the asteroid. Community-driven memecoin launched on the Stackr bonding curve.',
    creator: '0x9f12…21Ab',
    creatorAddress: '0x9f1234567890ABcDEF1234567890aBcDeF1221Ab',
    age: '2h',
    graduated: false,
    priceUsd: '$0.0000142',
    priceEth: '0.0000000041',
    mcapUsd: '$24.3K',
    raisedEth: 1.84,
    targetEth: 5,
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
    image: genAvatarUri('BNK'),
    address: '0xBe12cC3344aBEF77Dc9012345678901CdEF23456',
    description: 'Fully bonded. Liquidity migrated to Uniswap V2 with LP tokens burned forever.',
    creator: '0x33ab…be12',
    creatorAddress: '0x33Ab4567890ABcDEF1234567890abcdef33bE12',
    age: '6d',
    graduated: true,
    priceUsd: '$0.0001231',
    priceEth: '0.000000035',
    mcapUsd: '$148K',
    raisedEth: 5,
    targetEth: 5,
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
    image: genAvatarUri('PEPE'),
    address: '0xF244aB00Cc9087fedCBA987654321DEF34567890',
    description: 'Lab-grown memetics. Fresh bond, early entry zone.',
    creator: '0xf244…00cc',
    creatorAddress: '0xF2441234567890ABcDEF1234567890abcD00Cc',
    age: '11m',
    graduated: false,
    priceUsd: '$0.00000091',
    priceEth: '0.00000000026',
    mcapUsd: '$3.1K',
    raisedEth: 0.42,
    targetEth: 5,
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
    image: genAvatarUri('BASED'),
    address: '0xAb77F100Ef2345678901234567890abcDEF45678',
    description: 'For the based, by the based. Ship code, hold bags.',
    creator: '0xab77…77f1',
    creatorAddress: '0xAb771234567890ABcDEF1234567890abcD77F1',
    age: '4h',
    graduated: false,
    priceUsd: '$0.0000087',
    priceEth: '0.0000000025',
    mcapUsd: '$14.7K',
    raisedEth: 1.12,
    targetEth: 5,
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
    image: genAvatarUri('BLU'),
    address: '0x7D1144AbCDef5678901234567890abcDEF56789a',
    description: 'Pretending to be a blue chip until it actually is.',
    creator: '0x7d11…1144',
    creatorAddress: '0x7D111234567890ABcDEF1234567890abcD1144',
    age: '38m',
    graduated: false,
    priceUsd: '$0.000003',
    priceEth: '0.00000000087',
    mcapUsd: '$8.2K',
    raisedEth: 0.71,
    targetEth: 5,
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
  const [infoTab, setInfoTab] = useState<'trades' | 'holders'>('trades');
  const [tradePage, setTradePage] = useState(0);
  const [holderPage, setHolderPage] = useState(0);
  const PAGE_SIZE = 10;
  const DEMO_TOKEN_BALANCE = 985_420;
  const [copied, setCopied] = useState(false);

  const copyCA = () => {
    if (!t) return;
    navigator.clipboard.writeText(t.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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

            {/* Token header — contains stats, progress, about, links */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="p-5 md:p-6">

                {/* Symbol + name + badge */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border/30 bg-muted mt-0.5">
                      <img src={t.image} alt={t.symbol} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-3xl md:text-4xl font-black tracking-tighter leading-none text-gradient">
                        {t.symbol}
                      </span>
                      <h1 className="text-base md:text-lg font-bold text-foreground/90">
                        {t.name}
                      </h1>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-1.5">
                      by{' '}
                      <a
                        href={`https://etherscan.io/address/${t.creatorAddress}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:text-primary transition-colors underline-offset-2 hover:underline"
                      >
                        {t.creator}
                      </a>
                      {' '}· {t.age} ago
                    </p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full border ${
                    t.graduated
                      ? 'border-primary/50 text-primary bg-primary/10'
                      : 'border-border/60 text-muted-foreground bg-white/4'
                  }`}>
                    {t.graduated ? 'DEX' : 'BONDING'}
                  </span>
                </div>

                {/* CA row */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 font-mono">
                  <span className="text-[9px] font-semibold tracking-wider text-muted-foreground/50 uppercase shrink-0">CA</span>
                  <a
                    href={`https://etherscan.io/address/${t.address}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[11px] text-muted-foreground/70 hover:text-primary transition-colors break-all"
                  >
                    {t.address}
                  </a>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`https://etherscan.io/address/${t.address}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={copyCA}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      {copied
                        ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                        : <Copy className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                </div>

                {/* Stats — flat, thin vertical dividers only */}
                <div className="grid grid-cols-4 gap-0 mb-5 pt-3 border-t border-border/30">
                  {[
                    { label: 'Price', value: t.priceUsd, color: '' },
                    { label: 'Market Cap', value: t.mcapUsd, color: '' },
                    {
                      label: '24h',
                      value: `${change24hPositive ? '+' : ''}${t.change24h.toFixed(1)}%`,
                      color: change24hPositive ? 'text-emerald-400' : 'text-primary',
                    },
                    { label: 'Holders', value: String(t.holders), color: '' },
                  ].map((cell, i) => (
                    <div key={cell.label} className={i > 0 ? 'pl-4 border-l border-border/30' : ''}>
                      <div className="text-[9px] font-semibold tracking-wider text-muted-foreground/50 mb-1 uppercase">
                        {cell.label}
                      </div>
                      <div className={`text-sm font-bold tabular-nums ${cell.color || 'text-foreground'}`}>
                        {cell.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bonding curve progress */}
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
                      Bonding curve
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-foreground/80">
                      {pct.toFixed(0)}% · {t.raisedEth} / {t.targetEth} ETH
                    </span>
                  </div>
                  <ProgressBar pct={pct} />
                </div>

                {/* About — merged in, no separate card */}
                <div className="pt-4 border-t border-border/30">
                  <p className="text-sm text-foreground/80 leading-relaxed mb-3">{t.description}</p>
                  {(t.twitter || t.telegram || t.website) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.twitter && (
                        <a href={`https://x.com/${t.twitter}`} target="_blank" rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/40 hover:border-primary/40 hover:text-primary transition-all">
                          <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                          @{t.twitter}
                        </a>
                      )}
                      {t.telegram && (
                        <a href={`https://t.me/${t.telegram}`} target="_blank" rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/40 hover:border-primary/40 hover:text-primary transition-all">
                          <Send className="h-3 w-3 shrink-0" />
                          @{t.telegram}
                        </a>
                      )}
                      {t.website && (
                        <a href={t.website} target="_blank" rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border/40 hover:border-primary/40 hover:text-primary transition-all">
                          <Globe className="h-3 w-3 shrink-0" />
                          {t.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chart — TradingView Advanced Charts */}
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <TVAdvancedChart
                seed={t.symbol}
                baseEthRaised={t.raisedEth}
                graduated={t.graduated}
                symbol={`${t.symbol}/ETH`}
                height={440}
                currentMcUsd={parseFloat(t.mcapUsd.replace(/[^0-9.]/g, '')) || null}
              />
            </div>

            {/* Trades / Holders — tabbed, one card */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="flex border-b border-border/40">
                {(['trades', 'holders'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setInfoTab(tab)}
                    className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                      infoTab === tab
                        ? 'text-foreground border-b-2 border-primary -mb-px'
                        : 'text-muted-foreground/60 hover:text-muted-foreground'
                    }`}
                  >
                    {tab === 'trades' ? 'Recent Trades' : 'Top Holders'}
                  </button>
                ))}
              </div>

              {infoTab === 'trades' ? (() => {
                const totalTradePages = Math.max(1, Math.ceil(t.trades.length / PAGE_SIZE));
                const pageTrades = t.trades.slice(tradePage * PAGE_SIZE, (tradePage + 1) * PAGE_SIZE);
                return (
                  <div>
                    {pageTrades.map((tr, i) => (
                      <div key={i} className="grid grid-cols-12 items-center gap-2 px-5 py-2.5 border-b border-border/30 last:border-0 text-xs font-mono tabular-nums hover:bg-white/2 transition-colors">
                        <div className="col-span-2 flex items-center gap-1.5">
                          {tr.type === 'buy'
                            ? <ArrowUpRight className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
                            : <ArrowDownRight className="h-3 w-3 text-primary" strokeWidth={2.5} />}
                          <span className={`font-semibold text-[10px] uppercase tracking-wider ${tr.type === 'buy' ? 'text-emerald-400' : 'text-primary'}`}>
                            {tr.type}
                          </span>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-foreground/90">{tr.eth}</span>
                          <span className="text-muted-foreground/50 ml-1 text-[10px]">ETH</span>
                        </div>
                        <div className="col-span-3 text-right text-foreground/70">{tr.tokens}</div>
                        <div className="col-span-2 text-right">
                          <a href={`https://etherscan.io/address/${tr.addr}`} target="_blank" rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-muted-foreground/50 hover:text-primary transition-colors">
                            {tr.addr}<ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        </div>
                        <div className="col-span-2 text-right text-muted-foreground/40">{tr.ago}</div>
                      </div>
                    ))}
                    {pageTrades.length > 0 && (
                      <div className="flex items-center justify-between px-5 py-2 border-t border-border/40">
                        <span className="text-[11px] font-mono text-muted-foreground/50">{t.trades.length} swaps</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setTradePage(0)} disabled={tradePage === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronFirst className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setTradePage((p) => Math.max(0, p - 1))} disabled={tradePage === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
                          <span className="text-[11px] font-mono text-muted-foreground/70 px-2">Page {tradePage + 1} of {totalTradePages}</span>
                          <button onClick={() => setTradePage((p) => Math.min(totalTradePages - 1, p + 1))} disabled={tradePage === totalTradePages - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronRight className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setTradePage(totalTradePages - 1)} disabled={tradePage === totalTradePages - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronLast className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })() : (() => {
                const totalHolderPages = Math.max(1, Math.ceil(t.topHolders.length / PAGE_SIZE));
                const pageHolders = t.topHolders.slice(holderPage * PAGE_SIZE, (holderPage + 1) * PAGE_SIZE);
                return (
                  <div>
                    {pageHolders.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-2.5 border-b border-border/30 last:border-0 text-xs font-mono hover:bg-white/2 transition-colors">
                        <span className="text-muted-foreground/40 tabular-nums w-4 shrink-0">{holderPage * PAGE_SIZE + i + 1}</span>
                        <a href={`https://etherscan.io/address/${h.addr}`} target="_blank" rel="noreferrer noopener"
                          className="flex-1 text-foreground/80 truncate hover:text-primary transition-colors inline-flex items-center gap-1">
                          {h.addr}<ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
                        </a>
                        <span className="text-muted-foreground/50 tabular-nums shrink-0">{h.tokens}</span>
                        <span className="text-foreground font-semibold tabular-nums shrink-0 w-10 text-right">{h.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                    {pageHolders.length > 0 && (
                      <div className="flex items-center justify-between px-5 py-2 border-t border-border/40">
                        <span className="text-[11px] font-mono text-muted-foreground/50">{t.topHolders.length} holders</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setHolderPage(0)} disabled={holderPage === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronFirst className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setHolderPage((p) => Math.max(0, p - 1))} disabled={holderPage === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
                          <span className="text-[11px] font-mono text-muted-foreground/70 px-2">Page {holderPage + 1} of {totalHolderPages}</span>
                          <button onClick={() => setHolderPage((p) => Math.min(totalHolderPages - 1, p + 1))} disabled={holderPage === totalHolderPages - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronRight className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setHolderPage(totalHolderPages - 1)} disabled={holderPage === totalHolderPages - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronLast className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* RIGHT — trade widget only */}
          <div className="lg:col-span-4">
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden sticky top-4">
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Trade</span>
                <SlippageSettings />
              </div>
              <div className="grid grid-cols-2 p-1.5 gap-1.5 border-b border-border/40">
                {(['buy', 'sell'] as const).map((s) => (
                  <button key={s} onClick={() => setSide(s)}
                    className={`text-[11px] font-semibold uppercase tracking-wider py-2.5 rounded-lg transition-all ${
                      side === s
                        ? s === 'buy' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
                      Amount ({side === 'buy' ? 'ETH' : t.symbol})
                    </label>
                    {side === 'sell' && (
                      <span className="text-[10px] font-mono text-muted-foreground/50">
                        Bal: {DEMO_TOKEN_BALANCE.toLocaleString()} {t.symbol}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-background/60 border border-border/60 rounded-lg px-3 py-2.5 text-base font-mono tabular-nums focus:outline-none focus:border-primary/60 transition-all"
                  />
                </div>
                {side === 'buy' ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {['0.01','0.05','0.1','0.5'].map((v) => (
                      <button key={v} onClick={() => setAmount(v)}
                        className="text-[10px] font-mono py-1.5 rounded-md border border-border/50 bg-white/3 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all">
                        {v}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {[25, 50, 75].map((pct) => (
                      <button key={pct}
                        onClick={() => setAmount(Math.floor(DEMO_TOKEN_BALANCE * pct / 100).toString())}
                        className="text-[10px] font-mono py-1.5 rounded-md border border-border/50 bg-white/3 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all">
                        {pct}%
                      </button>
                    ))}
                    <button
                      onClick={() => setAmount(DEMO_TOKEN_BALANCE.toString())}
                      className="text-[10px] font-semibold py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-all">
                      MAX
                    </button>
                  </div>
                )}
                <button
                  className={`w-full text-[12px] font-semibold uppercase tracking-wider py-3 rounded-lg transition-all ${
                    side === 'buy'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                  }`}
                  onClick={() => alert('Demo only. Connect wallet to trade.')}
                >
                  {side === 'buy' ? 'Buy' : 'Sell'} {t.symbol}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
