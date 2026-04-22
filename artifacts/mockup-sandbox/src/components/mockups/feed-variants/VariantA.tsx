export default function VariantA() {
  const tokens = [
    { rank: 1, sym: 'STR', name: 'Asteroid Shiba', price: '0.0000142', mcap: '24.3K', raised: 1.84, target: 3.5, pct: 53, age: '2h', holders: 142, change: '+18.4%', up: true },
    { rank: 2, sym: 'PEPE', name: 'Memetics Lab', price: '0.0000091', mcap: '3.1K', raised: 0.42, target: 3.5, pct: 12, age: '11m', holders: 31, change: '+4.1%', up: true },
    { rank: 3, sym: 'BASED', name: 'Based God Coin', price: '0.0000033', mcap: '1.8K', raised: 0.19, target: 3.5, pct: 5, age: '4h', holders: 18, change: '-2.3%', up: false },
    { rank: 4, sym: 'BLU', name: 'Blueprint Token', price: '0.0000071', mcap: '2.2K', raised: 0.31, target: 3.5, pct: 9, age: '6h', holders: 22, change: '+1.2%', up: true },
    { rank: 5, sym: 'BNK', name: 'Bonkers', price: '0.0001231', mcap: '148K', raised: 3.5, target: 3.5, pct: 100, age: '6d', holders: 891, change: '+0.0%', up: true, dex: true },
  ];

  const bar = (pct: number) => {
    const filled = Math.round(pct / 5);
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] font-mono text-[#e0e0e0] p-0">
      {/* Top bar */}
      <div className="border-b border-[#222] px-4 py-2 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-4">
          <span className="text-[#00e87a] font-bold tracking-widest">●&nbsp;LIVE</span>
          <span className="text-[#555]">5 tokens active</span>
          <span className="text-[#555]">|</span>
          <span className="text-[#555]">ETH $3,241</span>
        </div>
        <div className="flex items-center gap-4 text-[#555]">
          <span className="hover:text-[#e0e0e0] cursor-pointer">new</span>
          <span className="hover:text-[#e0e0e0] cursor-pointer">top</span>
          <span className="hover:text-[#e0e0e0] cursor-pointer">graduated</span>
          <span className="text-[#e0e0e0] underline underline-offset-2 cursor-pointer">all</span>
          <span className="ml-4 text-[#555]">|</span>
          <button className="text-[#00e87a] hover:text-white cursor-pointer">+ launch</button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid px-4 py-1.5 text-[10px] text-[#444] uppercase tracking-widest border-b border-[#1a1a1a]"
        style={{ gridTemplateColumns: '28px 72px 1fr 90px 72px 200px 60px 56px' }}>
        <span>#</span>
        <span>ticker</span>
        <span>name</span>
        <span>price</span>
        <span>mcap</span>
        <span>curve progress</span>
        <span>holders</span>
        <span className="text-right">24h</span>
      </div>

      {/* Token rows */}
      <div className="divide-y divide-[#141414]">
        {tokens.map(t => (
          <div key={t.sym}
            className="grid px-4 py-3 items-center hover:bg-[#111] cursor-pointer transition-colors group"
            style={{ gridTemplateColumns: '28px 72px 1fr 90px 72px 200px 60px 56px' }}>
            <span className="text-[#333] text-[11px]">{t.rank}</span>
            <span className="font-bold text-[13px] text-white tracking-tight">
              {t.dex
                ? <><span className="text-[#00e87a]">${t.sym}</span></>
                : <span className="group-hover:text-[#00e87a] transition-colors">${t.sym}</span>
              }
            </span>
            <span className="text-[#888] text-[12px] truncate pr-4">{t.name}
              {t.dex && <span className="ml-2 text-[10px] text-[#00e87a] border border-[#00e87a]/30 px-1">DEX</span>}
            </span>
            <span className="text-[13px] tabular-nums">${t.price}</span>
            <span className="text-[12px] tabular-nums text-[#aaa]">${t.mcap}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#333] tabular-nums whitespace-nowrap font-mono">
                [{<span className={t.pct === 100 ? 'text-[#00e87a]' : 'text-[#e87a00]'}>{bar(t.pct)}</span>}]
              </span>
              <span className="text-[10px] text-[#555] tabular-nums">{t.pct}%</span>
            </div>
            <span className="text-[12px] tabular-nums text-[#aaa]">{t.holders}</span>
            <span className={`text-right text-[12px] tabular-nums font-bold ${t.up ? 'text-[#00e87a]' : 'text-[#e84040]'}`}>
              {t.change}
            </span>
          </div>
        ))}
      </div>

      {/* Activity tape */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#1a1a1a] bg-[#0c0c0c] px-4 py-1.5 text-[10px] text-[#444] overflow-hidden">
        <span className="text-[#555] mr-3">TRADES</span>
        <span className="text-[#00e87a]">BUY</span> $STR 0.041 ETH &nbsp;·&nbsp;
        <span className="text-[#e84040]">SELL</span> $BNK 0.812 ETH &nbsp;·&nbsp;
        <span className="text-[#00e87a]">BUY</span> $PEPE 0.012 ETH &nbsp;·&nbsp;
        <span className="text-[#00e87a]">BUY</span> $BASED 0.025 ETH &nbsp;·&nbsp;
        <span className="text-[#00e87a]">BUY</span> $STR 0.087 ETH
      </div>
    </div>
  );
}
