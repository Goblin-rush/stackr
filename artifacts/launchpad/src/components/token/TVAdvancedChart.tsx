import { useEffect, useRef, type MutableRefObject } from 'react';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

interface LiveBucket {
  time: number;   // seconds — bucket start
  open: number;
  high: number;
  low: number;
  volume: number;
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => {
        remove?: () => void;
        chart?: () => unknown;
      };
    };
  }
}

const TOTAL_SUPPLY = 1_000_000_000;

const TF_SECONDS: Record<string, number> = {
  '1': 60, '3': 180, '5': 300, '15': 900,
  '30': 1800, '60': 3600, '120': 7200,
  '240': 14400, '1D': 86400,
};

export interface RealTrade {
  type: 'buy' | 'sell';
  ethAmount: number;   // ETH (already converted from wei)
  tokenAmount: number; // tokens (already converted from wei)
  timestamp: number;   // seconds
}

// Build OHLC bars from real on-chain trades, bucketed by resolution.
// Empty buckets between trades carry forward the previous close (flat candles)
// so the chart stays continuous instead of leaving gaps.
function buildBarsFromTrades(
  trades: RealTrade[],
  resolution: string,
  ethPrice: number,
): { time: number; open: number; high: number; low: number; close: number; volume: number }[] {
  if (trades.length === 0) return [];
  const intervalSec = TF_SECONDS[resolution] ?? 900;

  // Sort ascending by timestamp (API returns DESC)
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };
  const byBucket = new Map<number, Bar>();

  for (const t of sorted) {
    if (t.tokenAmount <= 0) continue;
    const pricePerTokenEth = t.ethAmount / t.tokenAmount;
    const mc = pricePerTokenEth * TOTAL_SUPPLY * ethPrice;
    const bucketTime = Math.floor(t.timestamp / intervalSec) * intervalSec;
    const volUsd = t.ethAmount * ethPrice;

    const existing = byBucket.get(bucketTime);
    if (!existing) {
      byBucket.set(bucketTime, {
        time: bucketTime,
        open: mc,
        high: mc,
        low: mc,
        close: mc,
        volume: volUsd,
      });
    } else {
      existing.high = Math.max(existing.high, mc);
      existing.low = Math.min(existing.low, mc);
      existing.close = mc;
      existing.volume += volUsd;
    }
  }

  const filled: Bar[] = Array.from(byBucket.values()).sort((a, b) => a.time - b.time);
  if (filled.length === 0) return [];

  // Carry-forward fill empty buckets between first trade and now so the chart
  // doesn't leave gaps when trading is sparse.
  const nowSec = Math.floor(Date.now() / 1000);
  const lastBucket = Math.floor(nowSec / intervalSec) * intervalSec;
  const result: Bar[] = [];
  let prev: Bar | null = null;
  let cursor = filled[0].time;
  let idx = 0;
  while (cursor <= lastBucket) {
    if (idx < filled.length && filled[idx].time === cursor) {
      // Open of this bar should equal previous close for continuity
      if (prev) filled[idx].open = prev.close;
      result.push(filled[idx]);
      prev = filled[idx];
      idx++;
    } else if (prev) {
      // Empty bucket — flat candle at previous close
      result.push({
        time: cursor,
        open: prev.close,
        high: prev.close,
        low: prev.close,
        close: prev.close,
        volume: 0,
      });
    }
    cursor += intervalSec;
  }

  return result;
}

function makeRealDatasource(
  tradesRef: MutableRefObject<RealTrade[]>,
  ethPriceRef: MutableRefObject<number>,
  onTickRef: MutableRefObject<((bar: unknown) => void) | null>,
  resolutionRef: MutableRefObject<string>,
  bucketRef: MutableRefObject<LiveBucket | null>,
) {
  const supportedResolutions = ['1', '3', '5', '15', '30', '60', '120', '240', '1D'];
  return {
    onReady(callback: (config: unknown) => void) {
      setTimeout(() => callback({ supported_resolutions: supportedResolutions }), 0);
    },
    searchSymbols(
      _input: string,
      _exchange: string,
      _type: string,
      cb: (result: unknown[]) => void,
    ) {
      cb([]);
    },
    resolveSymbol(
      symbolName: string,
      onResolved: (info: unknown) => void,
      _onError: (err: string) => void,
    ) {
      setTimeout(() => {
        onResolved({
          name: symbolName,
          full_name: `STACKR:${symbolName}`,
          description: symbolName,
          type: 'crypto',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'STACKR',
          listed_exchange: 'STACKR',
          minmov: 1,
          pricescale: 1,
          has_intraday: true,
          has_daily: true,
          supported_resolutions: supportedResolutions,
          volume_precision: 2,
          data_status: 'streaming',
        });
      }, 0);
    },
    getBars(
      _symbolInfo: unknown,
      resolution: string,
      periodParams: { from: number; to: number; countBack?: number; firstDataRequest?: boolean },
      onResult: (bars: unknown[], meta: { noData: boolean }) => void,
      _onError: (err: string) => void,
    ) {
      const ep = ethPriceRef.current > 0 ? ethPriceRef.current : 3000;
      const allBars = buildBarsFromTrades(tradesRef.current, resolution, ep);
      const filtered = allBars.filter(b => b.time >= periodParams.from && b.time <= periodParams.to);
      if (filtered.length === 0 && periodParams.firstDataRequest) {
        onResult(allBars, { noData: allBars.length === 0 });
      } else {
        onResult(filtered, { noData: filtered.length === 0 });
      }
    },
    subscribeBars(
      _symbolInfo: unknown,
      resolution: string,
      onTick: (bar: unknown) => void,
      _listenerGuid: string,
    ) {
      onTickRef.current = onTick;
      resolutionRef.current = resolution;
      bucketRef.current = null;
    },
    unsubscribeBars(_listenerGuid: string) {
      onTickRef.current = null;
      bucketRef.current = null;
    },
  };
}

export interface LiveTradeTick {
  price: number;       // ETH per token
  ethAmount: number;   // ETH traded
  timestamp: number;   // ms
}

interface TVAdvancedChartProps {
  seed: string;
  graduated?: boolean;
  timeframe?: Timeframe;
  height?: number;
  symbol?: string;
  ethPrice?: number;
  trades: RealTrade[];
  lastTrade?: LiveTradeTick | null;
}

let _chartCounter = 0;

export function TVAdvancedChart({
  seed,
  graduated = false,
  height = 320,
  symbol,
  ethPrice = 3000,
  trades,
  lastTrade,
}: TVAdvancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);
  const idRef = useRef(`tv_chart_${++_chartCounter}`);

  const onTickRef = useRef<((bar: unknown) => void) | null>(null);
  const resolutionRef = useRef<string>('15');
  const bucketRef = useRef<LiveBucket | null>(null);

  // Keep mutable refs in sync with props — no widget recreation on data updates
  const tradesRef = useRef<RealTrade[]>(trades);
  const ethPriceRef = useRef(ethPrice);
  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { ethPriceRef.current = ethPrice; }, [ethPrice]);

  // Push a live tick to TradingView whenever a new trade arrives
  useEffect(() => {
    if (!lastTrade || !onTickRef.current) return;
    const resolvedEthPrice = ethPriceRef.current > 0 ? ethPriceRef.current : 3000;
    const intervalSec = TF_SECONDS[resolutionRef.current] ?? 900;
    const tradeSec = Math.floor(lastTrade.timestamp / 1000);
    const bucketTime = Math.floor(tradeSec / intervalSec) * intervalSec;
    const mcUsd = lastTrade.price * TOTAL_SUPPLY * resolvedEthPrice;
    const vol = lastTrade.ethAmount * resolvedEthPrice;

    const prev = bucketRef.current;
    if (!prev || bucketTime > prev.time) {
      bucketRef.current = { time: bucketTime, open: mcUsd, high: mcUsd, low: mcUsd, volume: vol };
    } else {
      bucketRef.current = {
        time: prev.time,
        open: prev.open,
        high: Math.max(prev.high, mcUsd),
        low: Math.min(prev.low, mcUsd),
        volume: prev.volume + vol,
      };
    }
    const b = bucketRef.current;
    onTickRef.current({ time: b.time, open: b.open, high: b.high, low: b.low, close: mcUsd, volume: b.volume });
  }, [lastTrade]);

  // Create widget once per token — stable deps only
  useEffect(() => {
    const containerId = idRef.current;
    if (!containerRef.current) return;
    if (!window.TradingView?.widget) return;

    const displaySymbol = symbol ?? seed;
    const datafeed = makeRealDatasource(tradesRef, ethPriceRef, onTickRef, resolutionRef, bucketRef);

    widgetRef.current = new window.TradingView.widget({
      symbol: displaySymbol,
      interval: '15',
      container: containerId,
      datafeed,
      library_path: '/charting_library/',
      locale: 'en',
      timezone: 'Etc/UTC',
      fullscreen: false,
      autosize: true,
      debug: false,
      theme: 'dark',
      disabled_features: [
        'use_localstorage_for_settings',
        'header_symbol_search',
        'header_compare',
        'header_undo_redo',
        'header_screenshot',
        'symbol_info',
        'go_to_date',
      ],
      enabled_features: [
        'side_toolbar_in_fullscreen_mode',
        'hide_left_toolbar_by_default',
      ],
      overrides: {
        'paneProperties.background': '#0d0d0f',
        'paneProperties.backgroundType': 'solid',
        'paneProperties.vertGridProperties.color': 'rgba(255,255,255,0.04)',
        'paneProperties.horzGridProperties.color': 'rgba(255,255,255,0.04)',
        'scalesProperties.textColor': '#6b7280',
        'scalesProperties.backgroundColor': '#0d0d0f',
        'mainSeriesProperties.candleStyle.upColor': '#22c55e',
        'mainSeriesProperties.candleStyle.downColor': '#D63A1F',
        'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.borderDownColor': '#D63A1F',
        'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.wickDownColor': '#D63A1F',
      },
      loading_screen: {
        backgroundColor: '#0d0d0f',
        foregroundColor: '#D63A1F',
      },
    });

    return () => {
      if (widgetRef.current?.remove) {
        try { widgetRef.current.remove(); } catch {}
      }
      widgetRef.current = null;
    };
  }, [seed, graduated, symbol]);

  return (
    <div
      id={idRef.current}
      ref={containerRef}
      style={{ height: `${height}px`, width: '100%' }}
    />
  );
}
