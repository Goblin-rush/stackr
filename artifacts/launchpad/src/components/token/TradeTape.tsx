import { useEffect, useRef, useState } from 'react';
import type { LiveTrade } from '@/types/live';
import { ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';

interface Props {
  trades: LiveTrade[];
  symbol: string;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return 'now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatEth(n: number): string {
  if (n >= 1) return n.toFixed(3);
  if (n >= 0.001) return n.toFixed(4);
  return n.toFixed(6);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function TradeTape({ trades, symbol }: Props) {
  const [, force] = useState(0);
  const lastIdRef = useRef<number | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);

  // Tick every 5s so "time ago" labels stay fresh
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5_000);
    return () => clearInterval(t);
  }, []);

  // Flash highlight on new trade
  useEffect(() => {
    const newest = trades[0];
    if (!newest) return;
    if (lastIdRef.current === null) {
      lastIdRef.current = newest.id;
      return;
    }
    if (newest.id !== lastIdRef.current) {
      lastIdRef.current = newest.id;
      setFlashId(newest.id);
      const t = setTimeout(() => setFlashId(null), 1200);
      return () => clearTimeout(t);
    }
    return;
  }, [trades]);

  const recent = trades.slice(0, 8);

  if (recent.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border/50">
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-border/30 bg-muted/20">
        <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Tape · last {recent.length}
        </span>
      </div>
      <div className="divide-y divide-border/30">
        {recent.map((t) => {
          const isBuy = t.type === 'buy';
          const flash = flashId === t.id;
          return (
            <div
              key={`${t.txHash}-${t.id}`}
              className={`px-3 py-1.5 grid grid-cols-12 items-center gap-2 text-[11px] font-mono tabular-nums transition-colors ${
                flash ? (isBuy ? 'bg-foreground/[0.06]' : 'bg-primary/[0.08]') : 'hover:bg-muted/20'
              }`}
            >
              {/* Type */}
              <div className="col-span-2 flex items-center gap-1 flex-wrap">
                {isBuy ? (
                  <ArrowUpRight className="h-3 w-3 text-foreground shrink-0" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-primary shrink-0" />
                )}
                <span className={`uppercase font-black tracking-widest ${isBuy ? 'text-foreground' : 'text-primary'}`}>
                  {t.type}
                </span>
                {t.isDevBuy && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 border border-amber-400/40 bg-amber-400/10 px-1 py-0.5 rounded leading-none">
                    Dev
                  </span>
                )}
              </div>
              {/* ETH amount */}
              <div className="col-span-3 text-right">
                <span className="text-foreground">{formatEth(t.ethAmount)}</span>
                <span className="text-muted-foreground ml-1">ETH</span>
              </div>
              {/* Token amount */}
              <div className="col-span-3 text-right hidden sm:block">
                <span className="text-foreground/70">{formatTokens(t.tokenAmount)}</span>
                <span className="text-muted-foreground ml-1 truncate">{symbol}</span>
              </div>
              {/* Address */}
              <div className="col-span-4 sm:col-span-3 text-right">
                <a
                  href={`https://basescan.org/address/${t.account}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                  title={t.account}
                >
                  {shortAddr(t.account)}
                </a>
              </div>
              {/* Time + tx link */}
              <div className="col-span-3 sm:col-span-1 text-right text-muted-foreground">
                <a
                  href={`https://basescan.org/tx/${t.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-primary transition-colors"
                  title={`tx ${t.txHash.slice(0, 10)}…`}
                >
                  {timeAgo(t.timestamp)}
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
