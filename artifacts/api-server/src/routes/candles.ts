import { Router } from 'express';
import {
  createPublicClient,
  http,
  parseAbiItem,
  formatEther,
  keccak256,
  encodeAbiParameters,
  type Address,
} from 'viem';
import { base } from 'viem/chains';

const router = Router();

// V3 / V4 constants
const POOL_MANAGER_V4 = '0x498581ff718922c3f8e6a244956af099b2652b2b' as Address;
const HOOK_V3         = '0xe88D16864cAD90E9d6e0731D67a8946bc30700cc' as Address;
const ETH_ADDR        = '0x0000000000000000000000000000000000000000' as Address;
const V3_POOL_FEE     = 3000;
const V3_TICK_SPACING = 60;

const LOOKBACK_BLOCKS = 9_000n;

// V4 PoolManager Swap event
const SWAP_EVENT = parseAbiItem(
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'
);

const INTERVAL_SECONDS: Record<string, number> = {
  '1m':  60,
  '5m':  5 * 60,
  '15m': 15 * 60,
  '1h':  60 * 60,
  '4h':  4 * 60 * 60,
  '1d':  24 * 60 * 60,
};

function getClient() {
  const rpcUrl = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

function computePoolId(tokenAddress: string): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24'  },
        { type: 'int24'   },
        { type: 'address' },
      ],
      [ETH_ADDR, tokenAddress as Address, V3_POOL_FEE, V3_TICK_SPACING, HOOK_V3]
    )
  );
}

function sqrtPriceX96ToEthPerToken(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  const Q96 = 2 ** 96;
  const sqrtRatio = Number(sqrtPriceX96) / Q96;
  const tokenPerEth = sqrtRatio * sqrtRatio;
  return tokenPerEth === 0 ? 0 : 1 / tokenPerEth;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

interface RawTrade {
  type: 'buy' | 'sell';
  price: number;
  ethAmount: number;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number;
}

function buildCandles(raw: RawTrade[], intervalSec: number, limitNum: number): Candle[] {
  const buckets = new Map<number, {
    open: number; high: number; low: number; close: number;
    volume: number; buyVolume: number; sellVolume: number;
  }>();

  for (const t of raw) {
    if (!Number.isFinite(t.price) || t.price <= 0) continue;
    const bucketSec = Math.floor(t.timestamp / intervalSec) * intervalSec;
    const existing = buckets.get(bucketSec);
    if (!existing) {
      buckets.set(bucketSec, {
        open: t.price, high: t.price, low: t.price, close: t.price,
        volume: t.ethAmount,
        buyVolume:  t.type === 'buy'  ? t.ethAmount : 0,
        sellVolume: t.type === 'sell' ? t.ethAmount : 0,
      });
    } else {
      existing.high = Math.max(existing.high, t.price);
      existing.low  = Math.min(existing.low,  t.price);
      existing.close = t.price;
      existing.volume += t.ethAmount;
      if (t.type === 'buy')  existing.buyVolume  += t.ethAmount;
      else                   existing.sellVolume += t.ethAmount;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .slice(-limitNum)
    .map(([time, b]) => ({
      time,
      open: b.open, high: b.high, low: b.low, close: b.close,
      volume: b.volume, buyVolume: b.buyVolume, sellVolume: b.sellVolume,
    }));
}

async function fetchFromChain(tokenAddress: string): Promise<RawTrade[]> {
  const client = getClient();
  const poolId = computePoolId(tokenAddress);
  const tip = await client.getBlockNumber();
  const fromBlock = tip > LOOKBACK_BLOCKS ? tip - LOOKBACK_BLOCKS : 0n;

  const swapLogs = await client.getLogs({
    address: POOL_MANAGER_V4,
    event: SWAP_EVENT,
    args: { id: poolId },
    fromBlock,
    toBlock: tip,
  }).catch(() => []);

  const allLogs = swapLogs as any[];
  const blockNums = Array.from(new Set(allLogs.map((l) => l.blockNumber)));
  const blockTimestamps = new Map<bigint, number>();

  const CHUNK = 20;
  for (let i = 0; i < blockNums.length; i += CHUNK) {
    const chunk = blockNums.slice(i, i + CHUNK);
    const results = await Promise.allSettled(chunk.map((bn) => client.getBlock({ blockNumber: bn })));
    for (let j = 0; j < chunk.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled') blockTimestamps.set(chunk[j], Number(r.value.timestamp));
    }
  }

  const raw: RawTrade[] = [];

  for (const l of allLogs) {
    const ts = blockTimestamps.get(l.blockNumber);
    if (!ts) continue;
    const amount0 = l.args.amount0 as bigint;
    const sqrtPriceX96 = l.args.sqrtPriceX96 as bigint;
    const isBuy = amount0 > 0n;
    const ethAmount = Number(formatEther(isBuy ? amount0 : -amount0));
    const price = sqrtPriceX96ToEthPerToken(sqrtPriceX96);
    if (price <= 0 || ethAmount <= 0) continue;
    raw.push({
      type: isBuy ? 'buy' : 'sell',
      price,
      ethAmount,
      blockNumber: l.blockNumber,
      logIndex: l.logIndex,
      timestamp: ts,
    });
  }

  raw.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return Number(a.blockNumber - b.blockNumber);
    return a.logIndex - b.logIndex;
  });

  return raw;
}

/**
 * GET /api/candles?tokenAddress=0x...&interval=15m&limit=500
 * Returns OHLCV candle data for the given V3 token address (V4 pool).
 * Also accepts curveAddress for backward compatibility (treated as tokenAddress).
 */
router.get('/candles', async (req, res) => {
  const { tokenAddress, curveAddress, interval = '15m', limit = '500' } = req.query as Record<string, string>;

  // Support both tokenAddress (V3) and curveAddress (V2 backward compat)
  const addr = tokenAddress || curveAddress;

  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    return res.status(400).json({ error: 'Invalid tokenAddress (or curveAddress)' });
  }

  const intervalSec = INTERVAL_SECONDS[interval];
  if (!intervalSec) {
    return res.status(400).json({ error: `Invalid interval. Use: ${Object.keys(INTERVAL_SECONDS).join(', ')}` });
  }

  const limitNum = Math.min(parseInt(limit, 10) || 500, 2000);

  try {
    const raw = await fetchFromChain(addr);
    const candles = buildCandles(raw, intervalSec, limitNum);

    res.json({
      tokenAddress: addr,
      interval,
      intervalSeconds: intervalSec,
      count: candles.length,
      source: 'chain',
      candles,
    });
  } catch (err: any) {
    const msg = err?.shortMessage || err?.message || 'Failed to fetch candles';
    res.status(500).json({ error: msg });
  }
});

export default router;
