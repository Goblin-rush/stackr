import { useState } from 'react';
import { X, ShieldCheck, Flame, Coins, Lock } from 'lucide-react';

const STORAGE_KEY = 'aethpad-v2-trust-dismissed';

const POINTS = [
  { icon: Lock, label: 'LP Burned', sub: 'No rug possible' },
  { icon: Coins, label: '2% → Holders', sub: 'Every trade pays you' },
  { icon: Flame, label: '1.5% Burn', sub: 'Supply only deflates' },
  { icon: ShieldCheck, label: '0% Creator', sub: 'No dev wallet allocation' },
];

export function TrustBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });

  if (dismissed) return null;

  return (
    <div className="border-b-2 border-primary bg-card brutal-stripes">
      <div className="container max-w-7xl mx-auto px-4 md:px-8 py-4 relative">
        <button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, '1');
            setDismissed(true);
          }}
          aria-label="Dismiss"
          className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8 pr-8">
          <div className="shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                NEW · v2 LIVE ON BASE
              </span>
            </div>
            <h2 className="text-base md:text-lg font-black text-foreground leading-tight mt-1">
              Rebuilt from zero.<br className="hidden md:inline" /> Rug-proof by code.
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-md leading-relaxed">
              v1 was on Ethereum. Hindi pumalo. v2 is a full rewrite — different
              chain, different contracts, different economics.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
            {POINTS.map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="border border-border bg-background/60 px-3 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-foreground truncate">
                    {label}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  {sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
