import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { LiveTrade } from '@/types/live';
import type { Timeframe } from '@/components/token/PriceChart';

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '1d': 24 * 60 * 60,
};

interface RealTimeChartProps {
  trades: LiveTrade[]; // newest-first
  lastTrade: LiveTrade | null;
  timeframe: Timeframe;
  snapshotKey: string | number; // changes when initial backfill completes or token changes
  height?: number;
}

interface BucketAgg {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  net: number;
}

function buildCandles(trades: LiveTrade[], timeframe: Timeframe) {
  if (trades.length === 0) return { candles: [] as CandlestickData<UTCTimestamp>[], volumes: [] as HistogramData<UTCTimestamp>[] };
  const intervalSec = TIMEFRAME_SECONDS[timeframe];
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  const buckets = new Map<number, BucketAgg>();

  for (const t of sorted) {
    if (!Number.isFinite(t.timestamp) || !Number.isFinite(t.price)) continue;
    const sec = Math.floor(t.timestamp / 1000);
    const bucketSec = Math.floor(sec / intervalSec) * intervalSec;
    const existing = buckets.get(bucketSec);
    const signed = t.type === 'buy' ? t.ethAmount : -t.ethAmount;
    if (!existing) {
      buckets.set(bucketSec, {
        time: bucketSec as UTCTimestamp,
        open: t.price,
        high: t.price,
        low: t.price,
        close: t.price,
        volume: t.ethAmount,
        net: signed,
      });
    } else {
      existing.high = Math.max(existing.high, t.price);
      existing.low = Math.min(existing.low, t.price);
      existing.close = t.price;
      existing.volume += t.ethAmount;
      existing.net += signed;
    }
  }

  const ordered = Array.from(buckets.values()).sort((a, b) => Number(a.time) - Number(b.time));

  const candles: CandlestickData<UTCTimestamp>[] = ordered.map((b) => ({
    time: b.time,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }));
  const volumes: HistogramData<UTCTimestamp>[] = ordered.map((b) => ({
    time: b.time,
    value: b.volume,
    color: b.net >= 0 ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
  }));

  return { candles, volumes };
}

export function RealTimeChart({ trades, lastTrade, timeframe, snapshotKey, height = 380 }: RealTimeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const tradesRef = useRef<LiveTrade[]>(trades);
  const liveBucketRef = useRef<{
    candle: CandlestickData<UTCTimestamp>;
    volume: HistogramData<UTCTimestamp>;
    net: number;
  } | null>(null);

  // Always keep latest trades reference (for seed when timeframe changes)
  tradesRef.current = trades;

  // Create chart once, rebuild on timeframe change only (chart instance is stable)
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 3, labelBackgroundColor: '#1f2937' },
        horzLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 3, labelBackgroundColor: '#1f2937' },
      },
      autoSize: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Seed with whatever trades we currently have
    const { candles, volumes } = buildCandles(tradesRef.current, timeframe);
    candleSeries.setData(candles);
    volumeSeries.setData(volumes);
    if (candles.length > 0) chart.timeScale().fitContent();

    const lastCandle = candles[candles.length - 1];
    const lastVol = volumes[volumes.length - 1];
    liveBucketRef.current = lastCandle && lastVol
      ? { candle: { ...lastCandle }, volume: { ...lastVol }, net: 0 }
      : null;
    lastSeenIdRef.current = null;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      liveBucketRef.current = null;
    };
  }, [timeframe]);

  // When the trade SET changes (initial backfill arrives or timeframe-needs-refresh), seed full data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;
    const { candles, volumes } = buildCandles(trades, timeframe);
    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volumes);
    if (candles.length > 0) chartRef.current.timeScale().fitContent();
    const lastCandle = candles[candles.length - 1];
    const lastVol = volumes[volumes.length - 1];
    liveBucketRef.current = lastCandle && lastVol
      ? { candle: { ...lastCandle }, volume: { ...lastVol }, net: 0 }
      : null;
    lastSeenIdRef.current = lastTrade?.id ?? null;
    // Only re-seed when explicit snapshotKey changes (initial backfill complete or token switch),
    // or when timeframe changes (handled by chart-creation effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey, timeframe]);

  // Incremental live updates: process every trade newer than lastSeenId, in chronological order.
  // This handles bursts where multiple trades arrive in a single onLogs call but React batches renders.
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (trades.length === 0) return;

    const lastSeen = lastSeenIdRef.current;
    // trades are newest-first; collect all unseen, then iterate oldest-first
    const unseen: LiveTrade[] = [];
    for (const t of trades) {
      if (lastSeen !== null && t.id <= lastSeen) break;
      if (!Number.isFinite(t.timestamp) || !Number.isFinite(t.price)) continue;
      unseen.push(t);
    }
    if (unseen.length === 0) return;
    unseen.reverse();

    const intervalSec = TIMEFRAME_SECONDS[timeframe];
    for (const trade of unseen) {
      const bucketSec = Math.floor(trade.timestamp / 1000 / intervalSec) * intervalSec;
      const bucketTime = bucketSec as UTCTimestamp;
      const signed = trade.type === 'buy' ? trade.ethAmount : -trade.ethAmount;

      const live = liveBucketRef.current;
      if (!live || live.candle.time !== bucketTime) {
        const prevClose = live?.candle.close ?? trade.price;
        const newCandle: CandlestickData<UTCTimestamp> = {
          time: bucketTime,
          open: prevClose,
          high: Math.max(prevClose, trade.price),
          low: Math.min(prevClose, trade.price),
          close: trade.price,
        };
        const newVol: HistogramData<UTCTimestamp> = {
          time: bucketTime,
          value: trade.ethAmount,
          color: signed >= 0 ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
        };
        liveBucketRef.current = { candle: newCandle, volume: newVol, net: signed };
      } else {
        live.candle.high = Math.max(live.candle.high, trade.price);
        live.candle.low = Math.min(live.candle.low, trade.price);
        live.candle.close = trade.price;
        live.volume.value = (live.volume.value as number) + trade.ethAmount;
        live.net += signed;
        live.volume.color = live.net >= 0 ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)';
      }
      candleSeriesRef.current.update(liveBucketRef.current!.candle);
      volumeSeriesRef.current.update(liveBucketRef.current!.volume);
    }
    lastSeenIdRef.current = unseen[unseen.length - 1].id;
    // Suppress lastTrade dep warning — we read it transitively through trades.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, timeframe]);

  return (
    <div className="relative">
      <div ref={containerRef} style={{ height: `${height}px`, width: '100%' }} />
      {trades.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs font-mono text-muted-foreground">
            No trades yet — chart will populate after the first buy.
          </p>
        </div>
      )}
    </div>
  );
}
