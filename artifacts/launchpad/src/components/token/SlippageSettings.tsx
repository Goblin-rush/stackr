import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings2, AlertTriangle } from 'lucide-react';
import { useSlippage } from '@/hooks/use-slippage';

const PRESETS = [0.5, 1, 3];

export function SlippageSettings() {
  const { percent, setPercent, isHigh, isVeryLow, MIN_PERCENT, MAX_PERCENT } = useSlippage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(percent.toString());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(percent.toString());
      setError(null);
    }
  }, [open, percent]);

  const isPreset = PRESETS.includes(percent);

  const apply = (val: string) => {
    const n = parseFloat(val);
    if (!Number.isFinite(n)) {
      setError('Enter a valid number');
      return;
    }
    if (n < MIN_PERCENT) {
      setError(`Minimum ${MIN_PERCENT}%`);
      return;
    }
    if (n > MAX_PERCENT) {
      setError(`Maximum ${MAX_PERCENT}%`);
      return;
    }
    setError(null);
    setPercent(n);
  };

  const formattedPercent = percent < 0.1 ? percent.toFixed(2) : percent % 1 === 0 ? percent.toString() : percent.toFixed(2);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border transition-colors ${
            isHigh
              ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
              : isVeryLow
              ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
          }`}
          title="Slippage settings"
        >
          <Settings2 className="h-3 w-3" />
          <span>Slippage</span>
          <span className="text-foreground">{formattedPercent}%</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-4 bg-card border-border"
        align="end"
        sideOffset={6}
      >
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Slippage tolerance
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Your order reverts if price moves more than this amount.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPercent(p);
                  setDraft(p.toString());
                  setError(null);
                }}
                className={`text-xs font-mono py-1.5 rounded border transition-colors ${
                  percent === p
                    ? 'bg-primary/15 border-primary/50 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                }`}
              >
                {p}%
              </button>
            ))}
            <div
              className={`relative flex items-center rounded border ${
                !isPreset
                  ? 'bg-primary/10 border-primary/50'
                  : 'border-border'
              }`}
            >
              <input
                type="text"
                inputMode="decimal"
                value={draft}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft(v);
                  if (v.trim() === '') {
                    setError(null);
                    return;
                  }
                  apply(v);
                }}
                onBlur={() => {
                  if (draft.trim() === '' || error) {
                    setDraft(percent.toString());
                    setError(null);
                  }
                }}
                placeholder="Custom"
                className="w-full bg-transparent text-xs font-mono text-foreground text-right pr-4 pl-1.5 py-1.5 outline-none"
              />
              <span className="absolute right-1.5 text-[10px] text-muted-foreground pointer-events-none">
                %
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-400">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!error && isHigh && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded p-2">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>High slippage. Your order may be front-run.</span>
            </div>
          )}

          {!error && isVeryLow && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded p-2">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Very low slippage. Order may fail.</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
