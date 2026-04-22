export default function VariantC() {
  const featured = {
    sym: 'STR', name: 'Asteroid Shiba', age: '2h ago', pct: 53,
    raised: '1.84', target: '3.5', mcap: '$24.3K', holders: 142,
    change: '+18.4%', up: true,
    desc: 'The apex predator of the meme cycle. Combines asteroid impact energy with loyal shiba community.',
  };

  const tokens = [
    { sym: 'PEPE', name: 'Memetics Lab', mcap: '$3.1K', pct: 12, change: '+4.1%', up: true, holders: 31, age: '11m' },
    { sym: 'BASED', name: 'Based God Coin', mcap: '$1.8K', pct: 5, change: '-2.3%', up: false, holders: 18, age: '4h' },
    { sym: 'BLU', name: 'Blueprint Token', mcap: '$2.2K', pct: 9, change: '+1.2%', up: true, holders: 22, age: '6h' },
    { sym: 'BNK', name: 'Bonkers', mcap: '$148K', pct: 100, change: 'DEX', up: true, holders: 891, age: '6d', dex: true },
    { sym: 'REKT', name: 'Rekt Finance', mcap: '$0.9K', pct: 3, change: '+0.5%', up: true, holders: 9, age: '22m' },
    { sym: 'CULT', name: 'Cult Classic', mcap: '$5.7K', pct: 21, change: '+7.8%', up: true, holders: 64, age: '8h' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F2EEE5', fontFamily: "'JetBrains Mono', monospace", display: 'flex', flexDirection: 'column' }}>

      {/* NAV */}
      <nav style={{ borderBottom: '2px solid #000', padding: '0 24px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <span style={{ fontWeight: 900, fontSize: '16px', letterSpacing: '-0.5px' }}>▲ LAUNCH</span>
          <div style={{ display: 'flex', gap: '24px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {['Active', 'Top', 'Graduated', 'Docs'].map((label, i) => (
              <span key={label} style={{ cursor: 'pointer', color: i === 0 ? '#000' : 'rgba(0,0,0,0.35)', borderBottom: i === 0 ? '2px solid #000' : 'none', paddingBottom: i === 0 ? '2px' : '0' }}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>ETH $3,241</span>
          <button style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit', border: '2px solid #000', padding: '6px 14px', background: '#000', color: '#F2EEE5', cursor: 'pointer' }}>
            + Launch
          </button>
        </div>
      </nav>

      {/* LIVE TICKER */}
      <div style={{ borderBottom: '1px solid rgba(0,0,0,0.12)', padding: '7px 24px', display: 'flex', gap: '4px', fontSize: '10px', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.05em', overflow: 'hidden', flexShrink: 0 }}>
        <span style={{ color: '#D63A1F', fontWeight: 700, marginRight: '8px' }}>● LIVE</span>
        {[
          ['BUY', '$STR', '0.041 ETH'], ['SELL', '$BNK', '0.812 ETH'], ['BUY', '$PEPE', '0.012 ETH'],
          ['BUY', '$CULT', '0.055 ETH'], ['BUY', '$STR', '0.087 ETH'], ['SELL', '$BASED', '0.019 ETH'],
        ].map(([type, sym, amt], i) => (
          <span key={i} style={{ display: 'flex', gap: '4px', marginRight: '16px', whiteSpace: 'nowrap' }}>
            <span style={{ color: type === 'BUY' ? '#1a6b3a' : '#D63A1F', fontWeight: 700 }}>{type}</span>
            <span style={{ color: '#000' }}>{sym}</span>
            <span>{amt}</span>
          </span>
        ))}
      </div>

      {/* MAIN BODY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', flex: 1, minHeight: 0 }}>

        {/* LEFT COLUMN */}
        <div style={{ borderRight: '2px solid #000', display: 'flex', flexDirection: 'column' }}>

          {/* FEATURED HERO */}
          <div style={{ borderBottom: '2px solid #000', padding: '28px 28px 24px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#D63A1F', borderRadius: '50%' }} />
              Featured · Most Active
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>${featured.sym}</span>
                  <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', fontWeight: 400 }}>{featured.name}</span>
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.55)', lineHeight: 1.6, maxWidth: '380px', marginBottom: '20px' }}>
                  {featured.desc}
                </p>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: '24px', fontSize: '11px' }}>
                  {[
                    ['MCAP', featured.mcap],
                    ['RAISED', `${featured.raised} / ${featured.target} ETH`],
                    ['HOLDERS', String(featured.holders)],
                    ['AGE', featured.age],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Change badge */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-1px', color: '#1a6b3a', lineHeight: 1 }}>{featured.change}</div>
                <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.35)', marginTop: '4px' }}>24h</div>
              </div>
            </div>

            {/* Bonding curve bar */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(0,0,0,0.4)', marginBottom: '6px' }}>
                <span>Bonding curve</span>
                <span style={{ fontWeight: 700, color: '#000' }}>{featured.pct}% filled</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(0,0,0,0.1)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${featured.pct}%`, background: '#D63A1F' }} />
              </div>
            </div>
          </div>

          {/* TOKEN LIST */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* Header */}
            <div style={{ padding: '10px 28px 8px', display: 'grid', gap: '0', fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}
              className="grid"
            >
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 100px 56px 70px', gap: '0' }}>
                <span>Ticker</span>
                <span>Name</span>
                <span>Mcap</span>
                <span>Curve</span>
                <span>Holders</span>
                <span style={{ textAlign: 'right' }}>24h</span>
              </div>
            </div>

            {tokens.map((t, i) => (
              <div key={t.sym} style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 80px 100px 56px 70px',
                padding: '14px 28px', alignItems: 'center', cursor: 'pointer',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                background: 'transparent',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontWeight: 900, fontSize: '13px', letterSpacing: '-0.3px' }}>${t.sym}</span>
                <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.55)', paddingRight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{t.mcap}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ flex: 1, height: '3px', background: 'rgba(0,0,0,0.1)', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${t.pct}%`, background: t.dex ? '#1a6b3a' : '#D63A1F' }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.35)', width: '28px', textAlign: 'right' }}>{t.pct}%</span>
                </div>
                <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{t.holders}</span>
                <span style={{ textAlign: 'right', fontSize: '12px', fontWeight: 700, color: t.dex ? '#1a6b3a' : t.up ? '#1a6b3a' : '#D63A1F' }}>{t.change}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* LAUNCH CTA */}
          <div style={{ borderBottom: '2px solid #000', padding: '24px 20px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', marginBottom: '12px' }}>Launch a token</div>
            <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.5, marginBottom: '16px', color: '#000' }}>
              0% creator tax.<br />LP burned at graduation.<br />Fair launch, always.
            </div>
            <button style={{ width: '100%', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: '2px solid #000', padding: '12px', background: '#000', color: '#F2EEE5', cursor: 'pointer' }}>
              Launch now
            </button>
          </div>

          {/* HOW IT WORKS */}
          <div style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', padding: '20px 20px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', marginBottom: '12px' }}>How it works</div>
            {[
              ['01', 'Buy tokens on the bonding curve — price rises with each buy'],
              ['02', 'Earn 2% of every trade, weighted by hold time'],
              ['03', 'At 100% raise, LP auto-deploys to DEX and burns'],
            ].map(([num, text]) => (
              <div key={num} style={{ display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '11px' }}>
                <span style={{ color: 'rgba(0,0,0,0.25)', fontWeight: 700, flexShrink: 0 }}>{num}</span>
                <span style={{ color: 'rgba(0,0,0,0.6)', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* STATS */}
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', marginBottom: '14px' }}>Protocol stats</div>
            {[
              ['Total raised', '18.4 ETH'],
              ['Tokens launched', '312'],
              ['Graduated', '14'],
              ['ETH burned', '0.92 ETH'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
                <span style={{ color: 'rgba(0,0,0,0.45)' }}>{label}</span>
                <span style={{ fontWeight: 700 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
