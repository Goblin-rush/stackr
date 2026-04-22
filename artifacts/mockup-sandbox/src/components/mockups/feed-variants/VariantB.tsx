export default function VariantB() {
  const tokens = [
    { rank: 1, sym: 'STR', name: 'Asteroid Shiba', price: '$0.0000142', mcap: '$24.3K', pct: 53, raised: '1.84', target: '3.5', age: '2h', change: '+18.4', up: true },
    { rank: 2, sym: 'PEPE', name: 'Memetics Lab', price: '$0.0000091', mcap: '$3.1K', pct: 12, raised: '0.42', target: '3.5', age: '11m', change: '+4.1', up: true },
    { rank: 3, sym: 'BASED', name: 'Based God Coin', price: '$0.0000033', mcap: '$1.8K', pct: 5, raised: '0.19', target: '3.5', age: '4h', change: '-2.3', up: false },
    { rank: 4, sym: 'BLU', name: 'Blueprint Token', price: '$0.0000071', mcap: '$2.2K', pct: 9, raised: '0.31', target: '3.5', age: '6h', change: '+1.2', up: true },
    { rank: 5, sym: 'BNK', name: 'Bonkers', price: '$0.0001231', mcap: '$148K', pct: 100, raised: '3.5', target: '3.5', age: '6d', change: '+0.0', up: true, dex: true },
  ];

  return (
    <div className="min-h-screen bg-[#F2EEE5] font-mono">

      {/* Navbar — stripped down */}
      <div className="border-b border-black/15 px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-black text-[15px] tracking-tighter text-black">●</span>
          <nav className="flex gap-5 text-[11px] font-bold uppercase tracking-widest text-black/40">
            <span className="text-black border-b-2 border-black pb-px cursor-pointer">Active</span>
            <span className="hover:text-black cursor-pointer transition-colors">Top</span>
            <span className="hover:text-black cursor-pointer transition-colors">Graduated</span>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-black/40 font-mono">ETH $3,241</span>
          <button className="font-bold uppercase tracking-widest text-[11px] border border-black px-3 py-1.5 hover:bg-black hover:text-[#F2EEE5] transition-colors">
            Launch
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="px-6 pt-6 pb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-black/30">5 tokens · sorted by activity</span>
        <span className="text-[10px] text-black/30">0% creator tax · LP burned at graduation</span>
      </div>

      {/* Column labels */}
      <div className="px-6 pb-1 grid text-[9px] font-bold uppercase tracking-widest text-black/30"
        style={{ gridTemplateColumns: '24px 64px 1fr 100px 80px 140px 70px' }}>
        <span></span>
        <span>Ticker</span>
        <span>Name</span>
        <span>Price</span>
        <span>Mcap</span>
        <span>Raised</span>
        <span className="text-right">24h</span>
      </div>

      <div className="border-t border-black/10 mx-6" />

      {/* Rows */}
      <div className="px-6">
        {tokens.map((t, i) => (
          <div key={t.sym}>
            <div className="grid items-center py-4 cursor-pointer group"
              style={{ gridTemplateColumns: '24px 64px 1fr 100px 80px 140px 70px' }}>
              <span className="text-[11px] text-black/20 tabular-nums">{t.rank}</span>
              <span className="font-black text-[14px] tracking-tight group-hover:underline underline-offset-2">
                ${t.sym}
                {t.dex && <span className="ml-1.5 text-[8px] font-bold tracking-widest text-black/40 border border-black/25 px-1 py-px align-middle">DEX</span>}
              </span>
              <span className="text-[12px] text-black/60 truncate pr-4">{t.name}</span>
              <span className="text-[12px] tabular-nums">{t.price}</span>
              <span className="text-[12px] tabular-nums text-black/60">{t.mcap}</span>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-px bg-black/10 relative">
                  <div className="absolute top-[-1px] left-0 h-[3px] bg-black/70"
                    style={{ width: `${t.pct}%` }} />
                </div>
                <span className="text-[10px] tabular-nums text-black/40 w-8 text-right">{t.pct}%</span>
              </div>
              <span className={`text-right text-[12px] tabular-nums font-bold ${t.up ? 'text-[#1f6b3e]' : 'text-[#D63A1F]'}`}>
                {t.change}%
              </span>
            </div>
            {i < tokens.length - 1 && <div className="border-t border-black/[0.06]" />}
          </div>
        ))}
      </div>

      {/* Bottom strip */}
      <div className="mx-6 mt-4 border-t border-black/10 pt-3 pb-6 flex items-center justify-between text-[10px] text-black/30 font-mono">
        <span>Last trade: $STR 0.041 ETH · 12s ago</span>
        <span>5% tax: 1.5 burn / 2.0 holders / 1.5 platform / 0 creator</span>
      </div>
    </div>
  );
}
