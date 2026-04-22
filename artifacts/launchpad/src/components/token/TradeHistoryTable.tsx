import { useEffect, useState } from 'react';
import type { LiveTrade } from '@/types/live';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TradeHistoryTableProps {
  trades: LiveTrade[];
  symbol: string;
  pageSize?: number;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatAge(ms: number): string {
  const s = ms / 1000;
  if (s < 5) return 'now';
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function TradeRow({ trade, isFresh }: { trade: LiveTrade; isFresh: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const ageMs = Date.now() - trade.timestamp;

  return (
    <tr
      className={`border-b border-border/30 transition-colors ${
        isFresh
          ? trade.type === 'buy'
            ? 'bg-foreground/[0.04] animate-[fade_2.5s_ease-out]'
            : 'bg-primary/[0.06] animate-[fade_2.5s_ease-out]'
          : 'hover:bg-muted/20'
      }`}
    >
      <td className="py-2 px-3">
        <span className={trade.type === 'buy' ? 'text-emerald-400 font-black uppercase tracking-widest' : 'text-primary font-black uppercase tracking-widest'}>
          {trade.type}
        </span>
      </td>
      <td className="text-right py-2 px-3 text-foreground tabular-nums">{trade.price.toFixed(8)}</td>
      <td className="text-right py-2 px-3 text-foreground tabular-nums">
        {trade.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </td>
      <td className="text-right py-2 px-3 text-foreground tabular-nums">{trade.ethAmount.toFixed(4)}</td>
      <td className="py-2 px-3 text-muted-foreground">{shortAddr(trade.account)}</td>
      <td className="text-right py-2 px-3 text-muted-foreground tabular-nums">{formatAge(ageMs)}</td>
      <td className="text-right py-2 px-3 text-primary/70 hover:text-primary cursor-pointer">
        {trade.txHash.slice(0, 6)}
      </td>
    </tr>
  );
}

export function TradeHistoryTable({ trades, symbol, pageSize = 20 }: TradeHistoryTableProps) {
  const [page, setPage] = useState(0);
  const newestId = trades[0]?.id;
  const totalPages = Math.max(1, Math.ceil(trades.length / pageSize));
  const paginated = trades.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-muted-foreground uppercase text-[10px] tracking-widest border-b border-border/50">
              <th className="text-left py-2 px-3 font-medium">Type</th>
              <th className="text-right py-2 px-3 font-medium">Price (ETH)</th>
              <th className="text-right py-2 px-3 font-medium">{symbol}</th>
              <th className="text-right py-2 px-3 font-medium">ETH</th>
              <th className="text-left py-2 px-3 font-medium">Trader</th>
              <th className="text-right py-2 px-3 font-medium">Age</th>
              <th className="text-right py-2 px-3 font-medium">Tx</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((t) => (
              <TradeRow key={t.id} trade={t} isFresh={t.id === newestId && page === 0 && Date.now() - t.timestamp < 2500} />
            ))}
          </tbody>
        </table>
      </div>

      {trades.length > 0 && (
        <div className="flex items-center justify-center gap-4 px-3 py-2.5 border-t border-border/40">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          <span className="text-[11px] font-mono text-muted-foreground/60">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
