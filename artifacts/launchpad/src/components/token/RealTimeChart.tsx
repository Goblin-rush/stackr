import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
  type MouseEventParams,
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
  trades: LiveTrade[];
  lastTrade: LiveTrade | null;
  timeframe: Timeframe;
  snapshotKey: string | number;
  height?: number;
  baselinePrice?: number;
  symbol?: string;
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

interface OHLCVLegend {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  color: 'up' | 'down' | 'flat';
}

function formatPrice(p: number): string {
  if (!Number.isFinite(p) || p === 0) return '0.00000000';
  if (p < 0.000001) return p.toExponential(4);
  if (p < 0.001) return p.toFixed(8);
  if (p < 1) return p.toFixed(6);
  return p.toFixed(4);
}

function formatVol(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(2)}K`;
  return v.toFixed(4);
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
        open: t.price, high: t.price, low: t.price, close: t.price,
        volume: t.ethAmount, net: signed,
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
    time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
  }));
  const volumes: HistogramData<UTCTimestamp>[] = ordered.map((b) => ({
    time: b.time,
    value: b.volume,
    color: b.net >= 0 ? 'rgba(34, 197, 94, 0.50)' : 'rgba(220, 38, 38, 0.50)',
  }));
  return { candles, volumes };
}

// ─── Chart colours (TradingView-style dark theme) ───────────────────────────
const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#dc2626';
const UP_COLOR_DIM = 'rgba(34, 197, 94, 0.08)';
const DOWN_COLOR_DIM = 'rgba(220, 38, 38, 0.08)';
const GRID_COLOR = 'rgba(255,255,255,0.04)';
const BORDER_COLOR = 'rgba(255,255,255,0.07)';
const LABEL_BG = '#0f0f12';
const TEXT_COLOR = '#6b7280';

export function RealTimeChart({
  trades,
  lastTrade,
  timeframe,
  snapshotKey,
  height = 380,
  baselinePrice,
  symbol = 'TOKEN',
}: RealTimeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const baselineLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const tradesRef = useRef<LiveTrade[]>(trades);
  const liveBucketRef = useRef<{
    candle: CandlestickData<UTCTimestamp>;
    volume: HistogramData<UTCTimestamp>;
    net: number;
  } | null>(null);
  const lastCandleRef = useRef<BucketAgg | null>(null);

  const [legend, setLegend] = useState<OHLCVLegend | null>(null);

  tradesRef.current = trades;

  const updateLegendFromCandle = useCallback((c: CandlestickData<UTCTimestamp>, vol: number) => {
    setLegend({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: vol,
      color: c.close >= c.open ? 'up' : 'down',
    });
  }, []);

  // Create chart — stable per timeframe change
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: TEXT_COLOR,
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      rightPriceScale: {
        borderColor: BORDER_COLOR,
        scaleMargins: { top: 0.06, bottom: 0.26 },
      },
      timeScale: {
        borderColor: BORDER_COLOR,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255,255,255,0.18)',
          width: 1,
          style: 3,
          labelBackgroundColor: LABEL_BG,
        },
        horzLine: {
          color: 'rgba(255,255,255,0.18)',
          width: 1,
          style: 3,
          labelBackgroundColor: LABEL_BG,
        },
      },
      autoSize: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
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

    if (lastCandle) {
      updateLegendFromCandle(lastCandle, (lastVol?.value as number) || 0);
    }

    // Crosshair move → update OHLCV legend
    chart.subscribeCrosshairMove((param: MouseEventParams<UTCTimestamp>) => {
      if (!param.time || param.seriesData.size === 0) {
        // Crosshair left chart: show last candle
        const last = liveBucketRef.current?.candle;
        if (last) {
          updateLegendFromCandle(last, (liveBucketRef.current?.volume.value as number) || 0);
        }
        return;
      }
      const cd = param.seriesData.get(candleSeries) as CandlestickData<UTCTimestamp> | undefined;
      const vd = param.seriesData.get(volumeSeries) as HistogramData<UTCTimestamp> | undefined;
      if (cd) {
        updateLegendFromCandle(cd, (vd?.value as number) || 0);
      }
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      liveBucketRef.current = null;
      lastCandleRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  // Re-seed on snapshot key change (backfill complete / token switch)
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
    if (lastCandle) updateLegendFromCandle(lastCandle, (lastVol?.value as number) || 0);
    else setLegend(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey, timeframe]);

  // Baseline price line when no trades
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    if (baselineLineRef.current) {
      series.removePriceLine(baselineLineRef.current);
      baselineLineRef.current = null;
    }
    if (trades.length === 0 && baselinePrice && Number.isFinite(baselinePrice) && baselinePrice > 0) {
      baselineLineRef.current = series.createPriceLine({
        price: baselinePrice,
        color: '#4ADE80',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'curve',
      });
    }
  }, [trades.length, baselinePrice, snapshotKey, timeframe]);

  // Incremental live updates
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (trades.length === 0) return;

    const lastSeen = lastSeenIdRef.current;
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
          color: signed >= 0 ? 'rgba(34, 197, 94, 0.50)' : 'rgba(220, 38, 38, 0.50)',
        };
        liveBucketRef.current = { candle: newCandle, volume: newVol, net: signed };
      } else {
        live.candle.high = Math.max(live.candle.high, trade.price);
        live.candle.low = Math.min(live.candle.low, trade.price);
        live.candle.close = trade.price;
        live.volume.value = (live.volume.value as number) + trade.ethAmount;
        live.net += signed;
        live.volume.color = live.net >= 0 ? 'rgba(34, 197, 94, 0.50)' : 'rgba(220, 38, 38, 0.50)';
      }
      candleSeriesRef.current.update(liveBucketRef.current!.candle);
      volumeSeriesRef.current.update(liveBucketRef.current!.volume);
    }
    const newest = unseen[unseen.length - 1];
    lastSeenIdRef.current = newest.id;
    if (liveBucketRef.current) {
      updateLegendFromCandle(
        liveBucketRef.current.candle,
        (liveBucketRef.current.volume.value as number) || 0
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, timeframe]);

  const legendColor = legend
    ? legend.color === 'up'
      ? UP_COLOR
      : legend.color === 'down'
      ? DOWN_COLOR
      : '#9ca3af'
    : '#9ca3af';

  return (
    <div className="relative select-none">
      {/* OHLCV Legend Overlay — TradingView style top-left */}
      <div
        className="absolute top-0 left-0 z-10 pointer-events-none px-2 pt-1.5 pb-1"
        style={{ minWidth: 220 }}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] font-black font-mono tracking-wider" style={{ color: '#e5e7eb' }}>
            {symbol}/ETH
          </span>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest bg-muted/30 px-1 py-0.5 rounded">
            Base
          </span>
        </div>
        {legend ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[10px] font-mono">
              <span className="text-muted-foreground/60">O </span>
              <span style={{ color: legendColor }}>{formatPrice(legend.open)}</span>
            </span>
            <span className="text-[10px] font-mono">
              <span className="text-muted-foreground/60">H </span>
              <span style={{ color: UP_COLOR }}>{formatPrice(legend.high)}</span>
            </span>
            <span className="text-[10px] font-mono">
              <span className="text-muted-foreground/60">L </span>
              <span style={{ color: DOWN_COLOR }}>{formatPrice(legend.low)}</span>
            </span>
            <span className="text-[10px] font-mono">
              <span className="text-muted-foreground/60">C </span>
              <span style={{ color: legendColor, fontWeight: 700 }}>{formatPrice(legend.close)}</span>
            </span>
            <span className="text-[10px] font-mono">
              <span className="text-muted-foreground/60">V </span>
              <span className="text-foreground/70">{formatVol(legend.volume)} ETH</span>
            </span>
            {legend.open > 0 && (
              <span
                className="text-[10px] font-mono font-bold"
                style={{ color: legendColor }}
              >
                {legend.close >= legend.open ? '+' : ''}
                {(((legend.close - legend.open) / legend.open) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/50 font-mono">No trades yet</p>
        )}
      </div>

      <div ref={containerRef} style={{ height: `${height}px`, width: '100%' }} />

      {trades.length === 0 && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
          <p className="text-[11px] font-mono text-muted-foreground/50 bg-background/40 px-3 py-1.5 rounded border border-border/20">
            No trades yet — showing bonding curve start price
          </p>
        </div>
      )}
    </div>
  );
}
