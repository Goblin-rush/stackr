const PAPER = '#F2EEE5';
const INK = '#0E0E0C';
const RULE = '#1A1A18';
const VERMILLION = '#D63A1F';
const MUTED = '#5A5650';
const PAPER_2 = '#ECE7DC';

const tokens = [
  {
    ticker: 'STR',
    name: 'Asteroid Shiba',
    raised: 1.84,
    target: 3.5,
    mcap: '$24.3K',
    price: '0.0000142',
    age: '2h',
    creator: '0x9f…21Ab',
    graduated: false,
  },
  {
    ticker: 'BNK',
    name: 'Bonkers',
    raised: 3.5,
    target: 3.5,
    mcap: '$148K',
    price: '0.0001231',
    age: '6d',
    creator: '0x33…be12',
    graduated: true,
  },
  {
    ticker: 'PEPE',
    name: 'Memetics Lab',
    raised: 0.42,
    target: 3.5,
    mcap: '$3.1K',
    price: '0.00000091',
    age: '11m',
    creator: '0xf2…00cc',
    graduated: false,
  },
];

function progressBlocks(pct: number) {
  const filled = Math.round((pct / 100) * 16);
  return Array.from({ length: 16 }, (_, i) => i < filled);
}

export function TokenCard() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: PAPER,
        padding: '32px 24px',
        fontFamily: "'JetBrains Mono', monospace",
        color: INK,
      }}
    >
      <div style={{ maxWidth: '420px', margin: '0 auto' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.2em',
            color: VERMILLION,
            marginBottom: '4px',
          }}
        >
          AETHPAD // V2 · BASE
        </div>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            margin: '0 0 14px 0',
          }}
        >
          Token Card
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tokens.map((t) => {
            const pct = Math.min((t.raised / t.target) * 100, 100);
            return (
              <div
                key={t.ticker}
                style={{
                  background: PAPER_2,
                  border: `1.5px solid ${RULE}`,
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* vermillion side stripe */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: VERMILLION,
                  }}
                />

                {/* HEADER ROW: ticker stamp + name */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    borderBottom: `1.5px solid ${RULE}`,
                  }}
                >
                  <div
                    style={{
                      borderRight: `1.5px solid ${RULE}`,
                      padding: '10px 14px 10px 18px',
                      minWidth: '78px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '20px',
                        fontWeight: 900,
                        letterSpacing: '-0.04em',
                        lineHeight: 1,
                      }}
                    >
                      ${t.ticker}
                    </span>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: MUTED,
                        marginTop: '2px',
                      }}
                    >
                      by {t.creator} · {t.age} ago
                    </div>
                  </div>
                  {t.graduated && (
                    <div
                      style={{
                        alignSelf: 'center',
                        marginRight: '14px',
                        border: `1.5px solid ${VERMILLION}`,
                        color: VERMILLION,
                        padding: '3px 7px',
                        fontSize: '9px',
                        fontWeight: 900,
                        letterSpacing: '0.15em',
                      }}
                    >
                      ON DEX
                    </div>
                  )}
                </div>

                {/* DATA ROW */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    borderBottom: `1.5px solid ${RULE}`,
                  }}
                >
                  {[
                    { label: 'PRICE', value: t.price },
                    { label: 'MCAP', value: t.mcap },
                    { label: 'RAISED', value: `${t.raised} / ${t.target}` },
                  ].map((cell, i) => (
                    <div
                      key={cell.label}
                      style={{
                        padding: '8px 12px',
                        borderRight: i < 2 ? `1.5px solid ${RULE}` : 'none',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '8.5px',
                          fontWeight: 800,
                          letterSpacing: '0.18em',
                          color: MUTED,
                          marginBottom: '2px',
                        }}
                      >
                        {cell.label}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {cell.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* PROGRESS — block segments */}
                <div style={{ padding: '10px 14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '8.5px',
                        fontWeight: 800,
                        letterSpacing: '0.18em',
                        color: MUTED,
                      }}
                    >
                      CURVE → DEX
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: t.graduated ? VERMILLION : INK,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '2px',
                      height: '10px',
                    }}
                  >
                    {progressBlocks(pct).map((on, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          background: on ? VERMILLION : 'transparent',
                          border: `1px solid ${on ? VERMILLION : RULE}`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
