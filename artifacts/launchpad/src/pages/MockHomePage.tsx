import './mock-home.css';
import { Menu, Search, Plus, Wallet, ArrowUp, ArrowDown, Globe, ExternalLink, Flame, TrendingUp, Sparkles, Clock } from 'lucide-react';

type Tok = {
  sym: string; name: string; addr: string; mcap: string; price: string; ch: number;
  bond: number; vol: string; holders: number; age: string; img: string; trend: number[];
};

const TOKENS: Tok[] = [
  { sym: 'PEPEX', name: 'Pepe Extended', addr: '0x9a2c…b71f', mcap: '$248.4K', price: '$0.0000412', ch: +18.6, bond: 64, vol: '$92.1K', holders: 412, age: '2h', img: '🐸', trend: [4,5,6,5,7,8,9,11,10,12,14,13,15,17,16,18] },
  { sym: 'WAGMI', name: 'We All Gonna Make It', addr: '0x4f81…02ad', mcap: '$184.0K', price: '$0.0000301', ch: +9.2, bond: 47, vol: '$61.3K', holders: 286, age: '5h', img: '🚀', trend: [10,11,9,12,13,12,14,13,15,14,16,15,17,16,18,17] },
  { sym: 'FUDOFF', name: 'Fud Off', addr: '0x71e0…9f4c', mcap: '$132.7K', price: '$0.0000218', ch: -4.1, bond: 33, vol: '$44.2K', holders: 198, age: '8h', img: '🛑', trend: [16,15,14,13,14,13,12,13,12,11,12,11,10,11,10,9] },
  { sym: 'CHAD', name: 'Sigma Chad', addr: '0x2bd9…30aa', mcap: '$96.5K', price: '$0.0000159', ch: +24.8, bond: 24, vol: '$38.9K', holders: 153, age: '11h', img: '💪', trend: [3,4,3,5,4,6,5,7,8,7,9,11,10,12,14,16] },
  { sym: 'NORM', name: 'Normie Coin', addr: '0xc017…5e22', mcap: '$71.2K', price: '$0.0000118', ch: +2.4, bond: 18, vol: '$22.0K', holders: 121, age: '13h', img: '🧢', trend: [9,10,9,10,11,10,11,10,11,12,11,12,11,12,11,12] },
  { sym: 'GIGA', name: 'Giga Brain', addr: '0xae45…77b1', mcap: '$58.9K', price: '$0.0000098', ch: +12.0, bond: 14, vol: '$19.4K', holders: 104, age: '15h', img: '🧠', trend: [6,7,8,7,9,10,9,11,10,12,11,13,12,14,13,15] },
  { sym: 'WOJK', name: 'Wojak Capital', addr: '0x18de…c4a9', mcap: '$42.1K', price: '$0.0000070', ch: -7.6, bond: 10, vol: '$12.8K', holders: 87, age: '17h', img: '😢', trend: [14,13,12,13,12,11,10,11,10,9,10,9,8,9,8,7] },
  { sym: 'BASED', name: 'Based God', addr: '0x6610…8f3d', mcap: '$31.0K', price: '$0.0000051', ch: +5.5, bond: 7, vol: '$9.9K', holders: 64, age: '19h', img: '🗿', trend: [8,9,8,9,10,9,10,9,10,11,10,11,10,11,10,12] },
];

const TAPE = [
  { type: 'BUY', sym: 'PEPEX', eth: '0.42', addr: '0x9a2c…b71f', t: '2s' },
  { type: 'SELL', sym: 'CHAD', eth: '0.18', addr: '0x71f1…aa02', t: '4s' },
  { type: 'BUY', sym: 'WAGMI', eth: '0.91', addr: '0x4f81…02ad', t: '6s' },
  { type: 'BUY', sym: 'CHAD', eth: '0.27', addr: '0x2bd9…30aa', t: '9s' },
  { type: 'SELL', sym: 'FUDOFF', eth: '0.06', addr: '0x71e0…9f4c', t: '12s' },
  { type: 'BUY', sym: 'GIGA', eth: '0.55', addr: '0xae45…77b1', t: '15s' },
  { type: 'BUY', sym: 'PEPEX', eth: '1.08', addr: '0x9a2c…b71f', t: '18s' },
  { type: 'SELL', sym: 'NORM', eth: '0.04', addr: '0xc017…5e22', t: '22s' },
];

function Spark({ data, up }: { data: number[]; up: boolean }) {
  const w = 96, h = 28;
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? 'hsl(166 75% 65%)' : 'hsl(0 65% 55%)'} strokeWidth="1.5" />
    </svg>
  );
}

function TokenCard({ t }: { t: Tok }) {
  const up = t.ch >= 0;
  return (
    <div className="bg-[hsl(200_8%_14%)] border border-[hsl(200_6%_22%)] rounded-md p-3 hover:border-[hsl(166_75%_65%/0.5)] transition-colors cursor-pointer">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-11 w-11 rounded-md bg-[hsl(200_7%_18%)] border border-[hsl(200_6%_24%)] flex items-center justify-center text-2xl shrink-0">{t.img}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[hsl(0_0%_96%)] text-sm">{t.sym}</span>
            <span className="text-[10px] font-mono text-[hsl(200_5%_60%)] truncate">{t.addr}</span>
          </div>
          <div className="text-xs text-[hsl(200_5%_60%)] truncate">{t.name}</div>
        </div>
        <div className={`text-xs font-mono font-semibold flex items-center gap-0.5 ${up ? 'text-[hsl(166_75%_65%)]' : 'text-[hsl(0_65%_55%)]'}`}>
          {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(t.ch).toFixed(1)}%
        </div>
      </div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[hsl(200_5%_60%)]">Mcap</div>
          <div className="text-[hsl(0_0%_96%)] font-mono text-sm font-semibold">{t.mcap}</div>
        </div>
        <Spark data={t.trend} up={up} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-[hsl(200_5%_60%)] uppercase tracking-wider">Bonding · {t.bond}%</span>
          <span className="text-[hsl(200_5%_60%)]">{t.vol} vol</span>
        </div>
        <div className="h-1 w-full bg-[hsl(200_7%_18%)] rounded-full overflow-hidden">
          <div className="h-full bg-[hsl(166_75%_65%)]" style={{ width: `${t.bond}%` }} />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-[hsl(200_5%_60%)]">
          <span>{t.holders} holders</span>
          <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{t.age}</span>
        </div>
      </div>
    </div>
  );
}

export default function MockHomePage() {
  return (
    <div className="min-h-screen bg-[hsl(200_8%_11%)] text-[hsl(0_0%_96%)] flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header className="border-b border-[hsl(200_6%_22%)] bg-[hsl(200_8%_14%)]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded bg-[hsl(166_75%_65%)] flex items-center justify-center">
              <span className="text-[hsl(195_25%_8%)] font-black text-sm">Æ</span>
            </div>
            <span className="font-bold tracking-tight text-base">aethpad</span>
            <span className="hidden md:inline text-[10px] font-mono uppercase tracking-wider text-[hsl(200_5%_60%)] border border-[hsl(200_6%_22%)] px-1.5 py-0.5 rounded">mainnet</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden md:flex items-center gap-1.5 h-8 px-3 bg-[hsl(166_75%_65%)] text-[hsl(195_25%_8%)] rounded text-xs font-semibold hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Create token
            </button>
            <button className="hidden md:flex items-center gap-1.5 h-8 px-3 border border-[hsl(200_6%_22%)] rounded text-xs font-mono">
              <Wallet className="h-3.5 w-3.5" /> 0x71e0…9f4c
            </button>
            <button className="h-8 w-8 flex items-center justify-center border border-[hsl(200_6%_22%)] rounded">
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Trade tape strip */}
      <div className="border-b border-[hsl(200_6%_22%)] bg-[hsl(200_8%_14%)]/80 h-7 overflow-hidden relative">
        <div className="flex items-center gap-6 h-full px-4 whitespace-nowrap" style={{ animation: 'tape 40s linear infinite' }}>
          {[...TAPE, ...TAPE].map((tr, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
              <span className={tr.type === 'BUY' ? 'text-[hsl(166_75%_65%)] font-semibold' : 'text-[hsl(0_65%_55%)] font-semibold'}>{tr.type}</span>
              <span className="text-[hsl(0_0%_96%)] font-semibold">{tr.sym}</span>
              <span className="text-[hsl(200_5%_60%)]">{tr.eth} ETH</span>
              <span className="text-[hsl(200_5%_60%)]">{tr.addr}</span>
              <span className="text-[hsl(200_5%_60%)]">{tr.t} ago</span>
              <span className="text-[hsl(200_6%_30%)]">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-5">
        {/* Search + tabs */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
          <div className="relative md:w-80">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[hsl(200_5%_60%)]" />
            <input
              placeholder="Search ticker, name, contract…"
              className="h-9 w-full pl-8 pr-3 bg-[hsl(200_7%_17%)] border border-[hsl(200_6%_22%)] rounded text-xs placeholder:text-[hsl(200_5%_60%)] focus:outline-none focus:border-[hsl(166_75%_65%/0.5)]"
            />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {[
              { l: 'Trending', i: <Flame className="h-3 w-3" />, on: true },
              { l: 'New', i: <Sparkles className="h-3 w-3" /> },
              { l: 'Top mcap', i: <TrendingUp className="h-3 w-3" /> },
              { l: 'Near bond', i: null },
            ].map((t) => (
              <button key={t.l} className={`h-8 px-3 rounded text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5 border ${t.on ? 'bg-[hsl(166_75%_65%/0.12)] border-[hsl(166_75%_65%/0.4)] text-[hsl(166_75%_65%)]' : 'border-[hsl(200_6%_22%)] text-[hsl(200_5%_60%)] hover:text-[hsl(0_0%_96%)]'}`}>
                {t.i} {t.l}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {[
            { l: 'Tokens deployed', v: '1,284' },
            { l: '24h volume', v: '$2.41M' },
            { l: 'Bonded today', v: '7' },
            { l: 'Active traders 24h', v: '4,127' },
          ].map((s) => (
            <div key={s.l} className="bg-[hsl(200_8%_14%)] border border-[hsl(200_6%_22%)] rounded-md px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-[hsl(200_5%_60%)] font-mono">{s.l}</div>
              <div className="text-[hsl(0_0%_96%)] font-mono font-semibold text-base">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Token grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TOKENS.map((t) => <TokenCard key={t.sym} t={t} />)}
        </div>
      </main>

      {/* Status bar */}
      <footer className="border-t border-[hsl(200_6%_22%)] bg-[hsl(200_8%_14%)]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-7 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[hsl(200_5%_60%)]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-[hsl(166_75%_65%)] rounded-full" /> Ethereum mainnet</span>
            <span>Blk #24,925,621</span>
            <span>Gas 0.23 gwei</span>
            <span>ETH $2,309</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">Factory 0x5843…5894 <ExternalLink className="h-2.5 w-2.5" /></span>
            <span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" /> rpc.ankr</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
