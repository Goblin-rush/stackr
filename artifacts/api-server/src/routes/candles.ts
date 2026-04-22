import { Router } from 'express';
import { createPublicClient, http, parseAbiItem, formatEther, type Address } from 'viem';
import { base } from 'viem/chains';

const router = Router();

const LOOKBACK_BLOCKS = 9_000n;

const BUY_EVENT = parseAbiItem(
  'event Buy(address indexed buyer, uint256 ethIn, uint256 ethForCurve, uint256 tokensOut, uint256 progressBps)'
);
const SELL_EVENT = parseAbiItem(
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ethOutGross, uint256 ethToUser, uint256 progressBps)'
);

const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '1d': 24 * 60 * 60,
};

function getClient() {
  const rpcUrl = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
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
  ethForPrice: number;
  ethAmount: number;
  tokenAmount: number;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number;
}

/**
 * GET /api/candles?curveAddress=0x...&interval=15m&limit=500
 * Returns OHLCV candle data for the given curve address.
 * Fetches Buy/Sell events from Base mainnet and builds candles.
 */
router.get('/candles', async (req, res) => {
  const { curveAddress, interval = '15m', limit = '500' } = req.query as Record<string, string>;

  if (!curveAddress || !/^0x[0-9a-fA-F]{40}$/.test(curveAddress)) {
    return res.status(400).json({ error: 'Invalid curveAddress' });
  }

  const intervalSec = INTERVAL_SECONDS[interval];
  if (!intervalSec) {
    return res.status(400).json({ error: `Invalid interval. Use: ${Object.keys(INTERVAL_SECONDS).join(', ')}` });
  }

  const limitNum = Math.min(parseInt(limit, 10) || 500, 2000);

  try {
    const client = getClient();
    const tip = await client.getBlockNumber();
    const fromBlock = tip > LOOKBACK_BLOCKS ? tip - LOOKBACK_BLOCKS : 0n;

    const [buyLogs, sellLogs] = await Promise.all([
      client.getLogs({ address: curveAddress as Address, event: BUY_EVENT, fromBlock, toBlock: tip }),
      client.getLogs({ address: curveAddress as Address, event: SELL_EVENT, fromBlock, toBlock: tip }),
    ]);

    // Collect unique block numbers to fetch timestamps
    const allLogs = [...buyLogs, ...sellLogs] as any[];
    const blockNums = Array.from(new Set(allLogs.map((l) => l.blockNumber)));
    const blockTimestamps = new Map<bigint, number>();

    // Fetch timestamps in parallel chunks
    const CHUNK = 20;
    for (let i = 0; i < blockNums.length; i += CHUNK) {
      const chunk = blockNums.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map((bn) => client.getBlock({ blockNumber: bn }))
      );
      for (let j = 0; j < chunk.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          blockTimestamps.set(chunk[j], Number(r.value.timestamp));
        }
      }
    }

    // Build raw trades
    const raw: RawTrade[] = [];
    for (const l of buyLogs as any[]) {
      const ts = blockTimestamps.get(l.blockNumber);
      if (!ts) continue;
      const ethForCurve = Number(formatEther(l.args.ethForCurve as bigint));
      const tokensOut = Number(formatEther(l.args.tokensOut as bigint));
      if (tokensOut === 0) continue;
      raw.push({
        type: 'buy',
        ethForPrice: ethForCurve,
        ethAmount: Number(formatEther(l.args.ethIn as bigint)),
        tokenAmount: tokensOut,
        blockNumber: l.blockNumber,
        logIndex: l.logIndex,
        timestamp: ts,
      });
    }
    for (const l of sellLogs as any[]) {
      const ts = blockTimestamps.get(l.blockNumber);
      if (!ts) continue;
      const ethOutGross = Number(formatEther(l.args.ethOutGross as bigint));
      const tokensIn = Number(formatEther(l.args.tokensIn as bigint));
      if (tokensIn === 0) continue;
      raw.push({
        type: 'sell',
        ethForPrice: ethOutGross,
        ethAmount: Number(formatEther(l.args.ethToUser as bigint)),
        tokenAmount: tokensIn,
        blockNumber: l.blockNumber,
        logIndex: l.logIndex,
        timestamp: ts,
      });
    }

    // Sort ascending by block + logIndex
    raw.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return Number(a.blockNumber - b.blockNumber);
      return a.logIndex - b.logIndex;
    });

    // Build candles
    const buckets = new Map<number, {
      open: number; high: number; low: number; close: number;
      volume: number; buyVolume: number; sellVolume: number;
    }>();

    for (const t of raw) {
      const price = t.ethForPrice / t.tokenAmount;
      if (!Number.isFinite(price) || price <= 0) continue;
      const bucketSec = Math.floor(t.timestamp / intervalSec) * intervalSec;
      const existing = buckets.get(bucketSec);
      if (!existing) {
        buckets.set(bucketSec, {
          open: price, high: price, low: price, close: price,
          volume: t.ethAmount,
          buyVolume: t.type === 'buy' ? t.ethAmount : 0,
          sellVolume: t.type === 'sell' ? t.ethAmount : 0,
        });
      } else {
        existing.high = Math.max(existing.high, price);
        existing.low = Math.min(existing.low, price);
        existing.close = price;
        existing.volume += t.ethAmount;
        if (t.type === 'buy') existing.buyVolume += t.ethAmount;
        else existing.sellVolume += t.ethAmount;
      }
    }

    const candles: Candle[] = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .slice(-limitNum)
      .map(([time, b]) => ({
        time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        buyVolume: b.buyVolume,
        sellVolume: b.sellVolume,
      }));

    res.json({
      curveAddress,
      interval,
      intervalSeconds: intervalSec,
      count: candles.length,
      candles,
    });
  } catch (err: any) {
    const msg = err?.shortMessage || err?.message || 'Failed to fetch candles';
    res.status(500).json({ error: msg });
  }
});

export default router;
