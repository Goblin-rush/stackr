/**
 * Fetches V4 token feed from /api/v4/tokens with periodic refresh.
 * Returns FeedToken-shaped objects so the HomeFeedPage Row UI works.
 */
import { useEffect, useState } from 'react';

const REFRESH_MS = 15_000;

export interface FeedToken {
  address: `0x${string}`;
  curveAddress: `0x${string}`;
  name: string;
  symbol: string;
  metadataURI: string | null;
  realEthRaised: number;
  currentPriceEth: number;
  marketCapEth: number;
  graduated: boolean;
  createdAtMs: number;
  createdIndex: number;
  lastTradeMs: number | null;
  creator: `0x${string}`;
  chainId: number;
}

interface ApiV4Token {
  address: string;
  curveAddress: string;
  creator: string;
  name: string;
  symbol: string;
  metadataURI: string | null;
  deployedAt: number;
  blockNumber: number;
  ethUsdPrice8: string;
  virtualEthReserve: string;
  graduated: number;
  cancelled: number;
  v2Pair: string | null;
  realEth: string;
  tokensSold: string;
  lastTradeAt: number | null;
  chainId: number;
}

const TOTAL_SUPPLY = 1_000_000_000;
const CURVE_TOKENS = 800_000_000;

function bnToEth(s: string): number {
  try {
    return Number(BigInt(s)) / 1e18;
  } catch {
    return 0;
  }
}

function toFeedToken(t: ApiV4Token, idx: number): FeedToken {
  const realEth = bnToEth(t.realEth);
  const tokensSoldNum = bnToEth(t.tokensSold);
  const virtualEth = bnToEth(t.virtualEthReserve);
  // Constant-product price: priceEthPerToken = (virtualEth + realEth) / (CURVE_TOKENS - tokensSoldNum)
  const remaining = Math.max(CURVE_TOKENS - tokensSoldNum, 1);
  const priceEthPerToken = (virtualEth + realEth) / remaining;
  const marketCapEth = priceEthPerToken * TOTAL_SUPPLY;
  return {
    address: t.address as `0x${string}`,
    curveAddress: t.curveAddress as `0x${string}`,
    name: t.name,
    symbol: t.symbol,
    metadataURI: t.metadataURI,
    realEthRaised: realEth,
    currentPriceEth: priceEthPerToken,
    marketCapEth,
    graduated: t.graduated === 1,
    createdAtMs: t.deployedAt * 1000,
    createdIndex: idx,
    lastTradeMs: t.lastTradeAt ? t.lastTradeAt * 1000 : null,
    creator: t.creator as `0x${string}`,
    chainId: t.chainId,
  };
}

export function useV4Feed(): { tokens: FeedToken[]; isLoading: boolean; refetch: () => void } {
  const [tokens, setTokens] = useState<FeedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const base = (import.meta as any).env?.BASE_URL || '/';
        const url = `${base}api/v4/tokens`.replace(/\/+/g, '/');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const list = (json.tokens as ApiV4Token[]) ?? [];
        setTokens(list.map((t, i) => toFeedToken(t, list.length - i)));
      } catch (e) {
        // silent fail — keep prior tokens
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchData();
    return () => { cancelled = true; };
  }, [tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return { tokens, isLoading, refetch: () => setTick((n) => n + 1) };
}
