import { useEffect, useRef, useState } from 'react';
import { getMockToken, type MockToken } from '@/lib/mock-tokens';

const VIRTUAL_ETH = 1.5;
const VIRTUAL_TOKENS = 1_073_000_000;
const K = VIRTUAL_ETH * VIRTUAL_TOKENS;
const TARGET_ETH = 3.5;
const TOTAL_SUPPLY = 1_000_000_000;

export interface LiveTrade {
  id: number;
  type: 'buy' | 'sell';
  account: string;
  ethAmount: number;
  tokenAmount: number;
  price: number;
  timestamp: number;
  txHash: string;
}

export interface LiveHolder {
  address: string;
  amount: number;
  percent: number;
  label?: string;
}

export interface LiveTokenState {
  token: MockToken;
  ethRaised: number;
  ethReserve: number;
  price: number;
  marketCapUsd: number;
  marketCapEth: number;
  volume24hEth: number;
  priceChange24hPct: number;
  graduated: boolean;
  trades: LiveTrade[];
  holders: LiveHolder[];
  lastTrade: LiveTrade | null;
  tickId: number;
}

function priceFromReserve(ethReserve: number) {
  return ethReserve / (K / ethReserve);
}

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randAddr(r: () => number) {
  const hex = '0123456789abcdef';
  let s = '0x';
  for (let i = 0; i < 40; i++) s += hex[Math.floor(r() * 16)];
  return s;
}

function initialHolders(token: MockToken): LiveHolder[] {
  const r = rng(token.slug + ':holders');
  const arr: LiveHolder[] = [];
  if (token.graduated) {
    arr.push({
      address: '0x' + 'd'.repeat(40),
      amount: TOTAL_SUPPLY * 0.18,
      percent: 18,
      label: 'Uniswap V2: Pair',
    });
  } else {
    const curvePct = 100 - (token.raised / TARGET_ETH) * 80;
    arr.push({
      address: '0x' + 'b'.repeat(40),
      amount: TOTAL_SUPPLY * (curvePct / 100),
      percent: curvePct,
      label: 'Bonding Curve',
    });
  }
  const remaining = 100 - arr[0].percent;
  const top = 24;
  const weights: number[] = [];
  for (let i = 0; i < top; i++) weights.push(Math.pow(r(), 1.6));
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top; i++) {
    const pct = (weights[i] / sum) * remaining;
    arr.push({
      address: randAddr(r),
      amount: TOTAL_SUPPLY * (pct / 100),
      percent: pct,
    });
  }
  return arr.sort((a, b) => b.percent - a.percent);
}

function initialTrades(token: MockToken): LiveTrade[] {
  const r = rng(token.slug + ':inittrades');
  const arr: LiveTrade[] = [];
  let age = 6 + r() * 30;
  const now = Math.floor(Date.now());
  let id = 1000;
  for (let i = 0; i < 22; i++) {
    const isBuy = r() > 0.42;
    const ethAmount = +(0.005 + r() * 0.45).toFixed(4);
    const drift = 0.6 + (22 - i) / 22 * 0.6;
    const price = token.priceNum * drift * (0.92 + r() * 0.18);
    arr.push({
      id: id++,
      type: isBuy ? 'buy' : 'sell',
      account: randAddr(r),
      ethAmount,
      tokenAmount: ethAmount / price,
      price,
      timestamp: now - age * 1000,
      txHash: randAddr(r),
    });
    age += 30 + r() * 600;
  }
  return arr;
}

export function useLiveToken(slug: string): LiveTokenState | null {
  const token = getMockToken(slug);
  const stateRef = useRef<LiveTokenState | null>(null);
  const tradeIdRef = useRef(10000);
  const randRef = useRef<() => number>(Math.random);

  const [, force] = useState(0);

  useEffect(() => {
    if (!token) return;
    randRef.current = rng(token.slug + ':live');

    const ethReserve = VIRTUAL_ETH + token.raised;
    const price = priceFromReserve(ethReserve);
    const initTrades = initialTrades(token);
    const initHolders = initialHolders(token);
    const open24h = price * (token.graduated ? 1.025 : 0.84);
    const ethUsd = 3000;

    stateRef.current = {
      token,
      ethRaised: token.raised,
      ethReserve,
      price,
      marketCapEth: price * TOTAL_SUPPLY,
      marketCapUsd: price * TOTAL_SUPPLY * ethUsd,
      volume24hEth: token.graduated ? 42 : token.raised * 1.8,
      priceChange24hPct: ((price - open24h) / open24h) * 100,
      graduated: !!token.graduated,
      trades: initTrades,
      holders: initHolders,
      lastTrade: null,
      tickId: 0,
    };
    force((n) => n + 1);

    const tick = () => {
      const s = stateRef.current;
      if (!s) return;
      const r = randRef.current;

      // bias buys when not graduated and below target; sells when graduated
      const buyBias = s.graduated ? 0.45 : 0.5 + (1 - s.ethRaised / TARGET_ETH) * 0.18;
      const isBuy = r() < buyBias;
      const sizeFactor = Math.pow(r(), 2.2);
      const ethAmount = +(0.005 + sizeFactor * (s.graduated ? 0.6 : 0.35)).toFixed(4);

      let newReserve: number;
      let tokenAmount: number;
      let executedEth = ethAmount;

      if (isBuy) {
        if (!s.graduated && s.ethReserve - VIRTUAL_ETH + ethAmount > TARGET_ETH) {
          executedEth = TARGET_ETH - (s.ethReserve - VIRTUAL_ETH);
          if (executedEth <= 0) executedEth = 0.001;
        }
        newReserve = s.ethReserve + executedEth;
        const newTokenReserve = K / newReserve;
        tokenAmount = K / s.ethReserve - newTokenReserve;
      } else {
        const sellEth = Math.min(executedEth, (s.ethReserve - VIRTUAL_ETH) * 0.4 + 0.001);
        executedEth = sellEth;
        newReserve = Math.max(s.ethReserve - sellEth, VIRTUAL_ETH * 0.99);
        const newTokenReserve = K / newReserve;
        tokenAmount = newTokenReserve - K / s.ethReserve;
      }

      const newPrice = priceFromReserve(newReserve);
      const ethRaised = Math.max(0, newReserve - VIRTUAL_ETH);
      const justGraduated = !s.graduated && ethRaised >= TARGET_ETH;
      const graduated = s.graduated || justGraduated;

      const trade: LiveTrade = {
        id: ++tradeIdRef.current,
        type: isBuy ? 'buy' : 'sell',
        account: randAddr(r),
        ethAmount: executedEth,
        tokenAmount: Math.abs(tokenAmount),
        price: newPrice,
        timestamp: Date.now(),
        txHash: randAddr(r),
      };

      const ethUsd = 3000;
      const open24h = s.price / (1 + s.priceChange24hPct / 100);

      // Occasionally update a holder
      const newHolders = [...s.holders];
      if (isBuy && r() < 0.35) {
        const idx = 1 + Math.floor(r() * Math.min(8, newHolders.length - 1));
        if (newHolders[idx]) {
          const bumpPct = (executedEth / TARGET_ETH) * 100 * 0.5;
          newHolders[idx] = {
            ...newHolders[idx],
            percent: newHolders[idx].percent + bumpPct,
            amount: newHolders[idx].amount + (TOTAL_SUPPLY * bumpPct) / 100,
          };
          newHolders.sort((a, b) => b.percent - a.percent);
        }
      }
      // Update bonding curve / DEX holder
      if (newHolders[0]?.label) {
        const curveAmount = graduated
          ? TOTAL_SUPPLY * 0.18
          : TOTAL_SUPPLY * Math.max(0.18, 1 - ethRaised / TARGET_ETH * 0.82);
        const curvePct = (curveAmount / TOTAL_SUPPLY) * 100;
        const top = newHolders.find((h) => h.label);
        if (top) {
          top.amount = curveAmount;
          top.percent = curvePct;
          top.label = graduated ? 'Uniswap V2: Pair' : 'Bonding Curve';
        }
      }

      stateRef.current = {
        ...s,
        ethReserve: newReserve,
        ethRaised,
        price: newPrice,
        marketCapEth: newPrice * TOTAL_SUPPLY,
        marketCapUsd: newPrice * TOTAL_SUPPLY * ethUsd,
        volume24hEth: s.volume24hEth + executedEth,
        priceChange24hPct: ((newPrice - open24h) / open24h) * 100,
        graduated,
        trades: [trade, ...s.trades].slice(0, 60),
        holders: newHolders,
        lastTrade: trade,
        tickId: s.tickId + 1,
      };
      force((n) => n + 1);
    };

    const schedule = () => {
      const delay = 1200 + randRef.current() * 2400;
      const id = window.setTimeout(() => {
        tick();
        nextId = schedule();
      }, delay);
      return id;
    };
    let nextId = schedule();

    return () => {
      window.clearTimeout(nextId);
    };
  }, [slug, token]);

  return stateRef.current;
}
