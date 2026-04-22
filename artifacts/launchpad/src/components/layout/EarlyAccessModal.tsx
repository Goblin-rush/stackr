import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  onContinue: () => void;
}

export function EarlyAccessModal({ onContinue }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[14px] font-black tracking-tight text-foreground leading-none">Early Access Warning</h2>
              <p className="text-[10px] text-primary font-semibold mt-0.5">Stackr is under active development</p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
            By proceeding, you acknowledge and accept that:
          </p>

          <ul className="space-y-2 mb-4">
            {[
              'This app is in beta. Use at your own risk.',
              'Visual bugs and interface issues may be present',
              'Data may not always be live and may require refreshes',
              'Features may not work as intended at all times',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <div
            className="flex items-start gap-2.5 p-3 rounded-lg bg-white/3 border border-border/50 mb-4 cursor-pointer group"
            onClick={() => setChecked((v) => !v)}
          >
            <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-primary border-primary' : 'border-border/60 group-hover:border-primary/40'}`}>
              {checked && (
                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-[11px] text-foreground/80 leading-snug select-none">
              I understand the risks and agree to continue
            </span>
          </div>

          <button
            onClick={onContinue}
            disabled={!checked}
            className="w-full py-2.5 rounded-xl text-[12px] font-bold tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed enabled:bg-primary enabled:text-primary-foreground enabled:hover:bg-primary/90 enabled:glow-primary"
          >
            Continue to Stackr
          </button>
        </div>
      </div>
    </div>
  );
}
