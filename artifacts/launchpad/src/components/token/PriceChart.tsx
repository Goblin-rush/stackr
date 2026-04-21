import { useEffect, useRef, useMemo } from 'react';
import { createChart, ColorType, CrosshairMode, type IChartApi, type ISeriesApi, type CandlestickData, type HistogramData, type UTCTimestamp } from 'lightweight-charts';

interface PriceChartProps {
  seed: string;
  basePrice: number;
  graduated?: boolean;
  height?: number;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCandles(seed: string, basePrice: number, graduated: boolean) {
  const rand = mulberry32(hashSeed(seed));
  const candles: CandlestickData<UTCTimestamp>[] = [];
  const volumes: HistogramData<UTCTimestamp>[] = [];

  const now = Math.floor(Date.now() / 1000);
  const interval = 60 * 15;
  const count = 240;

  let price = basePrice * 0.25;
  const target = basePrice;

  for (let i = 0; i < count; i++) {
    const t = (now - (count - i) * interval) as UTCTimestamp;

    const progress = i / count;
    const drift = (target - price) * 0.015 * (0.6 + rand() * 0.8);
    const vol = price * (0.04 + rand() * 0.06);
    const noise = (rand() - 0.5) * vol * 2;

    const open = price;
    let close = Math.max(open + drift + noise, basePrice * 0.05);

    if (graduated && progress > 0.85) {
      close = open + (rand() - 0.45) * vol * 1.5;
    }

    const wickRange = vol * (0.6 + rand() * 0.8);
    const high = Math.max(open, close) + rand() * wickRange;
    const low = Math.max(Math.min(open, close) - rand() * wickRange, basePrice * 0.04);

    candles.push({ time: t, open, high, low, close });

    const baseVol = (0.5 + rand() * 1.5) * (1 + Math.abs(close - open) / (open || 1) * 8);
    volumes.push({
      time: t,
      value: baseVol,
      color: close >= open ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
    });

    price = close;
  }

  return { candles, volumes };
}

export function PriceChart({ seed, basePrice, graduated = false, height = 380 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const { candles, volumes } = useMemo(
    () => generateCandles(seed, basePrice, graduated),
    [seed, basePrice, graduated]
  );

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

    const candleSeries: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
    });
    candleSeries.setData(candles);

    const volumeSeries: ISeriesApi<'Histogram'> = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    volumeSeries.setData(volumes);

    chart.timeScale().fitContent();

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, volumes]);

  return <div ref={containerRef} style={{ height: `${height}px`, width: '100%' }} />;
}
