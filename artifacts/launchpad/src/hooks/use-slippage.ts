import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'stackr:slippage-bps';
const DEFAULT_BPS = 100;
const MIN_BPS = 10;
const MAX_BPS = 5000;

const listeners = new Set<(bps: number) => void>();

function readStored(): number {
  if (typeof window === 'undefined') return DEFAULT_BPS;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (!v) return DEFAULT_BPS;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return DEFAULT_BPS;
    return Math.min(MAX_BPS, Math.max(MIN_BPS, n));
  } catch {
    return DEFAULT_BPS;
  }
}

function writeStored(bps: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(bps));
  } catch {
    // ignore
  }
}

export function useSlippage() {
  const [bps, setBpsState] = useState<number>(() => readStored());

  useEffect(() => {
    const fn = (v: number) => setBpsState(v);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const setBps = useCallback((next: number) => {
    const clamped = Math.min(MAX_BPS, Math.max(MIN_BPS, Math.round(next)));
    writeStored(clamped);
    listeners.forEach((l) => l(clamped));
  }, []);

  const setPercent = useCallback(
    (pct: number) => {
      setBps(Math.round(pct * 100));
    },
    [setBps]
  );

  const percent = bps / 100;

  const applyMinOut = useCallback(
    (expectedOut: bigint): bigint => {
      const numerator = BigInt(10000 - bps);
      return (expectedOut * numerator) / 10000n;
    },
    [bps]
  );

  const applyMaxIn = useCallback(
    (expectedIn: bigint): bigint => {
      const numerator = BigInt(10000 + bps);
      return (expectedIn * numerator) / 10000n;
    },
    [bps]
  );

  return {
    bps,
    percent,
    setBps,
    setPercent,
    applyMinOut,
    applyMaxIn,
    isHigh: bps >= 500,
    isVeryLow: bps < 30,
    MIN_PERCENT: MIN_BPS / 100,
    MAX_PERCENT: MAX_BPS / 100,
  };
}
