import { useEffect, useRef } from 'react';
import type { Timeframe } from './PriceChart';

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

const VIRTUAL_ETH = 1.5;
const VIRTUAL_TOKENS = 1_073_000_000;
const K = VIRTUAL_ETH * VIRTUAL_TOKENS;

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

function priceFromEthReserve(e: number): number {
  return e / (K / e);
}

const TF_SECONDS: Record<string, number> = {
  '1': 60, '3': 180, '5': 300, '15': 900,
  '30': 1800, '60': 3600, '120': 7200,
  '240': 14400, '1D': 86400,
};

function generateAllBars(seed: string, baseEthRaised: number, graduated: boolean, resolution: string) {
  const intervalSec = TF_SECONDS[resolution] ?? 900;
  const rand = mulberry32(hashSeed(`${seed}:${resolution}`));
  const targetEthReserve = VIRTUAL_ETH + baseEthRaised;
  const candleCount = 300;
  const ticksPerCandle = 6;
  const totalTicks = candleCount * ticksPerCandle;

  let ethReserve = VIRTUAL_ETH;
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
    const price = priceFromEthReserve(newReserve);

    if (pendingOpen === null) {
      pendingOpen = priceFromEthReserve(ethReserve);
      pendingHigh = pendingOpen;
      pendingLow = pendingOpen;
      pendingVol = 0;
    }
    pendingHigh = Math.max(pendingHigh, price);
    pendingLow = Math.min(pendingLow, price);
    pendingClose = price;
    pendingVol += Math.abs(delta);
    ethReserve = newReserve;

    if ((tick + 1) % ticksPerCandle === 0) {
      const candleIdx = Math.floor(tick / ticksPerCandle);
      const t = startBucket + candleIdx * intervalSec;
      bars.push({ time: t, open: pendingOpen!, high: pendingHigh, low: pendingLow, close: pendingClose, volume: pendingVol });
      pendingOpen = null;
    }
  }

  return bars;
}

function makeDemoDatasource(seed: string, baseEthRaised: number, graduated: boolean) {
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
          full_name: symbolName,
          description: seed,
          type: 'crypto',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: '',
          listed_exchange: '',
          minmov: 1,
          pricescale: 100000000,
          has_intraday: true,
          has_daily: true,
          supported_resolutions: supportedResolutions,
          volume_precision: 8,
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
      const allBars = generateAllBars(seed, baseEthRaised, graduated, resolution);
      const filtered = allBars.filter(b => b.time >= periodParams.from && b.time <= periodParams.to);
      if (filtered.length === 0 && periodParams.firstDataRequest) {
        onResult(allBars, { noData: false });
      } else {
        onResult(filtered, { noData: filtered.length === 0 });
      }
    },
    subscribeBars(
      _symbolInfo: unknown,
      _resolution: string,
      _onTick: (bar: unknown) => void,
      listenerGuid: string,
    ) {
      void listenerGuid;
    },
    unsubscribeBars(listenerGuid: string) {
      void listenerGuid;
    },
  };
}

interface TVAdvancedChartProps {
  seed: string;
  baseEthRaised: number;
  graduated?: boolean;
  timeframe?: Timeframe;
  height?: number;
  symbol?: string;
}

let _chartCounter = 0;

export function TVAdvancedChart({
  seed,
  baseEthRaised,
  graduated = false,
  height = 320,
  symbol,
}: TVAdvancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);
  const idRef = useRef(`tv_chart_${++_chartCounter}`);

  useEffect(() => {
    const containerId = idRef.current;
    if (!containerRef.current) return;
    if (!window.TradingView?.widget) return;

    const displaySymbol = symbol ?? seed;
    const datafeed = makeDemoDatasource(seed, baseEthRaised, graduated);

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
  }, [seed, baseEthRaised, graduated, symbol]);

  return (
    <div
      id={idRef.current}
      ref={containerRef}
      style={{ height: `${height}px`, width: '100%' }}
    />
  );
}
