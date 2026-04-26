import { useEffect, useRef, type MutableRefObject } from 'react';

// Locally-defined timeframe options. The original `./PriceChart` module no
// longer exists, so the type is colocated here to keep callers' prop shapes
// stable.
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

const VIRTUAL_ETH = 3.0;
const VIRTUAL_TOKENS = 1_073_000_000;
const K = VIRTUAL_ETH * VIRTUAL_TOKENS;
// Total supply used for market-cap display, must match the header
// (TOTAL_SUPPLY in V4TokenDetailPage / use-v4-feed = 1B).
const TOTAL_SUPPLY = 1_000_000_000;

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (Math.imul(h, 16777619)) >>> 0;
  }
  return h;
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

// Returns market cap in USD: price_per_token_eth * total_supply * eth_price_usd
function mcFromEthReserve(e: number, ethPrice: number): number {
  const pricePerTokenEth = (e * e) / K;
  return pricePerTokenEth * TOTAL_SUPPLY * ethPrice;
}

const TF_SECONDS: Record<string, number> = {
  '1': 60, '3': 180, '5': 300, '15': 900,
  '30': 1800, '60': 3600, '120': 7200,
  '240': 14400, '1D': 86400,
};

function generateAllBars(
  seed: string,
  baseEthRaised: number,
  graduated: boolean,
  resolution: string,
  ethPrice: number,
  currentMcUsd?: number | null,
  initialDevBuyEth?: number,
) {
  const intervalSec = TF_SECONDS[resolution] ?? 900;
  const rand = mulberry32(hashSeed(`${seed}:${resolution}`));
  const targetEthReserve = VIRTUAL_ETH + baseEthRaised;
  const candleCount = 300;
  const ticksPerCandle = 6;
  const totalTicks = candleCount * ticksPerCandle;

  // Start the simulated history from the reserve right after the dev buy,
  // so the opening candle reflects the correct post-launch market cap.
  const startReserve = VIRTUAL_ETH + (initialDevBuyEth ?? 0);
  let ethReserve = startReserve;
  const nowSec = Math.floor(Date.now() / 1000);
  const bucketNow = Math.floor(nowSec / intervalSec) * intervalSec;
  const startBucket = bucketNow - (candleCount - 1) * intervalSec;

  const bars: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];

  let pendingOpen: number | null = null;
  let pendingHigh = 0;
  let pendingLow = Infinity;
  let pendingClose = 0;
  let pendingVol = 0;

  for (let tick = 0; tick < totalTicks; tick++) {
    const progress = tick / totalTicks;
    const idealReserve = VIRTUAL_ETH + (targetEthReserve - VIRTUAL_ETH) * progress;
    const drift = (idealReserve - ethReserve) * 0.18;
    const baseVol = ethReserve * 0.012 * (0.6 + rand() * 0.9);
    const noise = (rand() - 0.5) * baseVol * 2;
    let delta = drift + noise;
    if (graduated && progress > 0.92) delta = (rand() - 0.5) * baseVol * 1.4;
    const minR = VIRTUAL_ETH * 0.98;
    if (ethReserve + delta < minR) delta = minR - ethReserve;

    const newReserve = ethReserve + delta;
    // Use market cap in USD as the "price" value — gives readable Y-axis ($9K range)
    const mc = mcFromEthReserve(newReserve, ethPrice);

    if (pendingOpen === null) {
      pendingOpen = mcFromEthReserve(ethReserve, ethPrice);
      pendingHigh = pendingOpen;
      pendingLow = pendingOpen;
      pendingVol = 0;
    }
    pendingHigh = Math.max(pendingHigh, mc);
    pendingLow = Math.min(pendingLow, mc);
    pendingClose = mc;
    pendingVol += Math.abs(delta) * ethPrice;
    ethReserve = newReserve;

    if ((tick + 1) % ticksPerCandle === 0) {
      const candleIdx = Math.floor(tick / ticksPerCandle);
      const t = startBucket + candleIdx * intervalSec;
      bars.push({ time: t, open: pendingOpen!, high: pendingHigh, low: pendingLow, close: pendingClose, volume: pendingVol });
      pendingOpen = null;
    }
  }

  // Anchor the last candle to the real on-chain market cap so the chart and
  // header always agree on the current value.
  if (currentMcUsd && currentMcUsd > 0 && bars.length > 0) {
    const last = bars[bars.length - 1];
    const scale = currentMcUsd / last.close;
    for (const b of bars) {
      b.open  *= scale;
      b.high  *= scale;
      b.low   *= scale;
      b.close *= scale;
    }
  }

  return bars;
}

function makeDemoDatasource(
  seed: string,
  baseEthRaisedRef: MutableRefObject<number>,
  graduated: boolean,
  ethPriceRef: MutableRefObject<number>,
  currentMcUsdRef: MutableRefObject<number | null | undefined>,
  onTickRef: MutableRefObject<((bar: unknown) => void) | null>,
  resolutionRef: MutableRefObject<string>,
  bucketRef: MutableRefObject<LiveBucket | null>,
  initialDevBuyEth?: number,
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
      const allBars = generateAllBars(seed, baseEthRaisedRef.current, graduated, resolution, ep, currentMcUsdRef.current, initialDevBuyEth);
      const filtered = allBars.filter(b => b.time >= periodParams.from && b.time <= periodParams.to);
      if (filtered.length === 0 && periodParams.firstDataRequest) {
        onResult(allBars, { noData: false });
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
  baseEthRaised: number;
  graduated?: boolean;
  timeframe?: Timeframe;
  height?: number;
  symbol?: string;
  ethPrice?: number;
  currentMcUsd?: number | null;
  lastTrade?: LiveTradeTick | null;
  initialDevBuyEth?: number;
}

let _chartCounter = 0;

export function TVAdvancedChart({
  seed,
  baseEthRaised,
  graduated = false,
  height = 320,
  symbol,
  ethPrice = 3000,
  currentMcUsd,
  lastTrade,
  initialDevBuyEth,
}: TVAdvancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);
  const idRef = useRef(`tv_chart_${++_chartCounter}`);

  const onTickRef = useRef<((bar: unknown) => void) | null>(null);
  const resolutionRef = useRef<string>('15');
  const bucketRef = useRef<LiveBucket | null>(null);

  // Keep mutable refs in sync with props — no widget recreation on price updates
  const baseEthRaisedRef = useRef(baseEthRaised);
  const ethPriceRef = useRef(ethPrice);
  const currentMcUsdRef = useRef(currentMcUsd);
  useEffect(() => { baseEthRaisedRef.current = baseEthRaised; }, [baseEthRaised]);
  useEffect(() => { ethPriceRef.current = ethPrice; }, [ethPrice]);
  useEffect(() => { currentMcUsdRef.current = currentMcUsd; }, [currentMcUsd]);

  // Push a live tick to TradingView whenever a new trade arrives
  useEffect(() => {
    if (!lastTrade || !onTickRef.current) return;
    const resolvedEthPrice = ethPriceRef.current > 0 ? ethPriceRef.current : 3000;
    const intervalSec = TF_SECONDS[resolutionRef.current] ?? 900;
    const tradeSec = Math.floor(lastTrade.timestamp / 1000);
    const bucketTime = Math.floor(tradeSec / intervalSec) * intervalSec;
    const mcUsd = lastTrade.price * TOTAL_SUPPLY * resolvedEthPrice;
    const vol = lastTrade.ethAmount;

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

  // Create widget once per token — stable deps only, no price values
  useEffect(() => {
    const containerId = idRef.current;
    if (!containerRef.current) return;
    if (!window.TradingView?.widget) return;

    const displaySymbol = symbol ?? seed;
    const datafeed = makeDemoDatasource(seed, baseEthRaisedRef, graduated, ethPriceRef, currentMcUsdRef, onTickRef, resolutionRef, bucketRef, initialDevBuyEth);

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
  }, [seed, graduated, symbol, initialDevBuyEth]);

  return (
    <div
      id={idRef.current}
      ref={containerRef}
      style={{ height: `${height}px`, width: '100%' }}
    />
  );
}
