const ACCENT = '#f97316';
const BG = '#0d0d0d';
const CARD_BG = '#141414';
const BORDER = '#222222';
const MUTED = '#555555';
const TEXT = '#f0f0f0';

const mockToken = {
  name: 'Asteroid Shiba',
  symbol: 'ASTEROIDSTR',
  description: 'The degen dog that survived the asteroid. Community-driven, bonding curve launched.',
  raised: 1.84,
  target: 3.5,
  mcap: '$24,300',
  price: '0.0000142',
  avatarColor: '#e85d04',
};

export function TokenCard() {
  const progress = Math.min((mockToken.raised / mockToken.target) * 100, 100);

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: '300px',
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: '6px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = ACCENT + '66')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
      >
        {/* Top bar — thin orange line on hover could go here */}
        <div style={{ padding: '14px 14px 0' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
            {/* Avatar */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              background: mockToken.avatarColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontWeight: 800,
              fontSize: '13px',
              color: '#fff',
              letterSpacing: '-0.5px',
            }}>
              {mockToken.symbol.slice(0, 2)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {mockToken.name}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  color: ACCENT,
                  background: ACCENT + '15',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  ${mockToken.symbol}
                </span>
              </div>
              <p style={{
                fontSize: '11px',
                color: MUTED,
                marginTop: '4px',
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {mockToken.description}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '11px', color: MUTED }}>
                {mockToken.raised} / {mockToken.target} ETH
              </span>
              <span style={{ fontSize: '11px', color: ACCENT, fontWeight: 600 }}>
                {progress.toFixed(1)}%
              </span>
            </div>
            <div style={{ height: '3px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: ACCENT,
                borderRadius: '2px',
              }} />
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div style={{
          display: 'flex',
          borderTop: `1px solid ${BORDER}`,
          padding: '10px 14px',
          gap: '0',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: MUTED, marginBottom: '2px' }}>Market cap</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: TEXT, fontFamily: 'monospace' }}>{mockToken.mcap}</div>
          </div>
          <div style={{ width: '1px', background: BORDER, margin: '0 12px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: MUTED, marginBottom: '2px' }}>Price</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: TEXT, fontFamily: 'monospace' }}>{mockToken.price} ETH</div>
          </div>
        </div>
      </div>
    </div>
  );
}
