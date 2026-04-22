import { useEffect, useRef, useMemo } from 'react';
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

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1d';

interface PriceChartProps {
  seed: string;
  baseEthRaised: number;
  graduated?: boolean;
  timeframe: Timeframe;
  height?: number;
  liveTrade?: { price: number; ethAmount: number; type: 'buy' | 'sell'; timestamp: number; id: number } | null;
}

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '1d': 24 * 60 * 60,
};

const VIRTUAL_ETH = 3.0; // V2 virtual ETH reserve
const VIRTUAL_TOKENS = 1_073_000_000;
const K = VIRTUAL_ETH * VIRTUAL_TOKENS;

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

function priceFromEthReserve(ethReserve: number): number {
  return ethReserve / (K / ethReserve);
}

function generateCandles(
  seed: string,
  baseEthRaised: number,
  graduated: boolean,
  timeframe: Timeframe
) {
  const rand = mulberry32(hashSeed(`${seed}:${timeframe}`));
  const candles: CandlestickData<UTCTimestamp>[] = [];
  const volumes: HistogramData<UTCTimestamp>[] = [];

  const intervalSec = TIMEFRAME_SECONDS[timeframe];
  const candleCount = 200;
  const ticksPerCandle = 6;
  const totalTicks = candleCount * ticksPerCandle;

  const targetEthReserve = VIRTUAL_ETH + baseEthRaised;
  const startEthReserve = VIRTUAL_ETH;

  let ethReserve = startEthReserve;
  const now = Math.floor(Date.now() / 1000);
  const bucketStart = Math.floor(now / intervalSec) * intervalSec;

  let pendingOpen: number | null = null;
  let pendingHigh = 0;
  let pendingLow = 0;
  let pendingClose = 0;
  let pendingVolEth = 0;
  let pendingNetEth = 0;

  for (let tick = 0; tick < totalTicks; tick++) {
    const progress = tick / totalTicks;
    const idealReserve = startEthReserve + (targetEthReserve - startEthReserve) * progress;
    const drift = (idealReserve - ethReserve) * 0.18;
    const baseVolatility = ethReserve * 0.012 * (0.6 + rand() * 0.9);
    const noise = (rand() - 0.5) * baseVolatility * 2;
    let deltaEth = drift + noise;

    if (graduated && progress > 0.92) {
      deltaEth = (rand() - 0.5) * baseVolatility * 1.4;
    }
    const minReserve = VIRTUAL_ETH * 0.98;
    if (ethReserve + deltaEth < minReserve) deltaEth = minReserve - ethReserve;

    const newReserve = ethReserve + deltaEth;
    const price = priceFromEthReserve(newReserve);
    const tradeVolEth = Math.abs(deltaEth);

    if (pendingOpen === null) {
      pendingOpen = priceFromEthReserve(ethReserve);
      pendingHigh = pendingOpen;
      pendingLow = pendingOpen;
      pendingVolEth = 0;
      pendingNetEth = 0;
    }
    pendingHigh = Math.max(pendingHigh, price);
    pendingLow = Math.min(pendingLow, price);
    pendingClose = price;
    pendingVolEth += tradeVolEth;
    pendingNetEth += deltaEth;

    ethReserve = newReserve;

    const isLastTickOfCandle = (tick + 1) % ticksPerCandle === 0;
    if (isLastTickOfCandle) {
      const candleIndex = Math.floor(tick / ticksPerCandle);
      const t = (bucketStart - (candleCount - 1 - candleIndex) * intervalSec) as UTCTimestamp;
      candles.push({
        time: t,
        open: pendingOpen,
        high: pendingHigh,
        low: pendingLow,
        close: pendingClose,
      });
      volumes.push({
        time: t,
        value: pendingVolEth,
        color: pendingNetEth >= 0 ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
      });
      pendingOpen = null;
    }
  }

  return { candles, volumes };
}

export function PriceChart({
  seed,
  baseEthRaised,
  graduated = false,
  timeframe,
  height = 380,
  liveTrade,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const liveCandleRef = useRef<CandlestickData<UTCTimestamp> | null>(null);
  const liveVolumeRef = useRef<HistogramData<UTCTimestamp> | null>(null);
  const liveNetRef = useRef<number>(0);
  const lastLiveIdRef = useRef<number | null>(null);

  const { candles, volumes } = useMemo(
    () => generateCandles(seed, baseEthRaised, graduated, timeframe),
    [seed, baseEthRaised, graduated, timeframe]
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

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
    });
    candleSeries.setData(candles);

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    volumeSeries.setData(volumes);

    chart.timeScale().fitContent();

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const last = candles[candles.length - 1];
    const lastVol = volumes[volumes.length - 1];
    liveCandleRef.current = last ? { ...last } : null;
    liveVolumeRef.current = lastVol ? { ...lastVol } : null;
    liveNetRef.current = 0;
    lastLiveIdRef.current = null;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [candles, volumes]);

  useEffect(() => {
    if (!liveTrade || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (lastLiveIdRef.current === liveTrade.id) return;
    lastLiveIdRef.current = liveTrade.id;

    const intervalSec = TIMEFRAME_SECONDS[timeframe];
    const tradeTimeSec = Math.floor(liveTrade.timestamp / 1000);
    const bucketTime = (Math.floor(tradeTimeSec / intervalSec) * intervalSec) as UTCTimestamp;

    const signedDelta = liveTrade.type === 'buy' ? liveTrade.ethAmount : -liveTrade.ethAmount;

    if (!liveCandleRef.current || liveCandleRef.current.time !== bucketTime) {
      const prevClose = liveCandleRef.current ? liveCandleRef.current.close : liveTrade.price;
      liveCandleRef.current = {
        time: bucketTime,
        open: prevClose,
        high: Math.max(prevClose, liveTrade.price),
        low: Math.min(prevClose, liveTrade.price),
        close: liveTrade.price,
      };
      liveVolumeRef.current = {
        time: bucketTime,
        value: liveTrade.ethAmount,
        color: signedDelta >= 0 ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
      };
      liveNetRef.current = signedDelta;
    } else {
      liveCandleRef.current.high = Math.max(liveCandleRef.current.high, liveTrade.price);
      liveCandleRef.current.low = Math.min(liveCandleRef.current.low, liveTrade.price);
      liveCandleRef.current.close = liveTrade.price;
      if (liveVolumeRef.current) {
        liveVolumeRef.current.value += liveTrade.ethAmount;
      }
      liveNetRef.current += signedDelta;
      if (liveVolumeRef.current) {
        liveVolumeRef.current.color =
          liveNetRef.current >= 0 ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)';
      }
    }

    candleSeriesRef.current.update(liveCandleRef.current);
    if (liveVolumeRef.current) {
      volumeSeriesRef.current.update(liveVolumeRef.current);
    }
  }, [liveTrade, timeframe]);

  return <div ref={containerRef} style={{ height: `${height}px`, width: '100%' }} />;
}
