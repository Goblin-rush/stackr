/**
 * index-trades.ts
 *
 * Trade indexer cron script — runs every 5 minutes via GitHub Actions.
 *
 * Fetches new Buy/Sell events from all curve contracts on Base mainnet
 * and persists them to the `trades` table in PostgreSQL. The `indexer_cursors`
 * table tracks the last indexed block so each run only fetches new events.
 *
 * Required env vars:
 *   DATABASE_URL        — PostgreSQL connection string
 *   FACTORY_V2_ADDRESS  — deployed factory address
 *   BASE_RPC_URL        — (optional) Base mainnet RPC, defaults to public node
 */

import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { base } from 'viem/chains';
import pg from 'pg';

const { Pool } = pg;

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const FACTORY_ADDRESS = (process.env.FACTORY_V2_ADDRESS || '') as Address;
const DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';

if (!FACTORY_ADDRESS) throw new Error('FACTORY_V2_ADDRESS is required');
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const CURSOR_ID = 'trades_v2';
// Public Base RPC limits eth_getLogs to 10,000 block range
const STEP = 9_999n;
// Factory V2 deploy block — skip scanning genesis
const GENESIS_BLOCK = 28_000_000n;

const FACTORY_ABI = [
  { name: 'getAllTokens', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { name: 'records', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenAddr', type: 'address' }], outputs: [{ name: 'token', type: 'address' }, { name: 'curve', type: 'address' }, { name: 'creator', type: 'address' }, { name: 'deployedAt', type: 'uint256' }, { name: 'metadataURI', type: 'string' }, { name: 'initialDevBuyEth', type: 'uint256' }, { name: 'initialDevBuyTokens', type: 'uint256' }] },
] as const;

const BUY_EVENT = parseAbiItem(
  'event Buy(address indexed buyer, uint256 ethIn, uint256 ethForCurve, uint256 tokensOut, uint256 progressBps)'
);
const SELL_EVENT = parseAbiItem(
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ethOutGross, uint256 ethToUser, uint256 progressBps)'
);

// Retry wrapper for transient RPC errors
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 6000): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? '');
      const isTransient =
        msg.includes('healthy') || msg.includes('timeout') ||
        msg.includes('502') || msg.includes('503') || msg.includes('ECONNRESET');
      if (isTransient && attempt < retries - 1) {
        console.log(`  Transient RPC error (attempt ${attempt + 1}/${retries}), retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw new Error('unreachable');
}

async function ensureTables(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      token_address TEXT NOT NULL,
      curve_address TEXT NOT NULL,
      trader TEXT NOT NULL,
      type TEXT NOT NULL,
      eth_amount TEXT NOT NULL,
      eth_for_price TEXT NOT NULL,
      token_amount TEXT NOT NULL,
      progress_bps INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      block_number BIGINT NOT NULL,
      log_index INTEGER NOT NULL,
      timestamp BIGINT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS trades_txhash_logidx ON trades (tx_hash, log_index);

    CREATE TABLE IF NOT EXISTS indexer_cursors (
      id TEXT PRIMARY KEY,
      last_block BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `);
}

async function getCursor(client: pg.PoolClient): Promise<bigint> {
  const res = await client.query('SELECT last_block FROM indexer_cursors WHERE id = $1', [CURSOR_ID]);
  if (res.rows.length === 0) return GENESIS_BLOCK;
  return BigInt(res.rows[0].last_block);
}

async function setCursor(client: pg.PoolClient, block: bigint): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await client.query(`
    INSERT INTO indexer_cursors (id, last_block, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (id) DO UPDATE SET last_block = $2, updated_at = $3
  `, [CURSOR_ID, block.toString(), now]);
}

async function getBlockTimestamps(blockNums: bigint[]): Promise<Map<bigint, number>> {
  const map = new Map<bigint, number>();
  const CHUNK = 20;
  for (let i = 0; i < blockNums.length; i += CHUNK) {
    const chunk = blockNums.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((bn) => publicClient.getBlock({ blockNumber: bn }))
    );
    for (let j = 0; j < chunk.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled') map.set(chunk[j], Number(r.value.timestamp));
    }
  }
  return map;
}

async function main() {
  console.log(`Factory: ${FACTORY_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}`);

  const client = await pool.connect();
  try {
    await ensureTables(client);

    const tokens = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'getAllTokens',
    }) as Address[];

    console.log(`Tokens: ${tokens.length}`);
    if (tokens.length === 0) {
      console.log('No tokens deployed yet.');
      return;
    }

    const curveByToken = new Map<string, string>();
    for (const t of tokens) {
      try {
        const rec = await publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'records',
          args: [t],
        }) as { curve: Address };
        if (rec.curve) curveByToken.set(t.toLowerCase(), rec.curve.toLowerCase());
      } catch {}
    }

    const curveAddresses = Array.from(curveByToken.values()) as Address[];
    if (curveAddresses.length === 0) {
      console.log('No curve addresses found.');
      return;
    }

    const tip = await publicClient.getBlockNumber();
    const fromBlock = (await getCursor(client)) + 1n;

    if (fromBlock > tip) {
      console.log('Already up to date at block', tip.toString());
      return;
    }

    console.log(`Indexing blocks ${fromBlock} → ${tip}`);

    let totalInserted = 0;

    for (let from = fromBlock; from <= tip; from += STEP) {
      const to = from + STEP - 1n > tip ? tip : from + STEP - 1n;
      console.log(`  Fetching ${from} → ${to}...`);

      let buyLogs: Awaited<ReturnType<typeof publicClient.getLogs>> = [];
      let sellLogs: Awaited<ReturnType<typeof publicClient.getLogs>> = [];

      try {
        const results = await withRetry(() => Promise.all([
          publicClient.getLogs({ address: curveAddresses, event: BUY_EVENT, fromBlock: from, toBlock: to }),
          publicClient.getLogs({ address: curveAddresses, event: SELL_EVENT, fromBlock: from, toBlock: to }),
        ]));
        buyLogs = results[0];
        sellLogs = results[1];
      } catch (err) {
        console.warn(`  Skipping chunk ${from}–${to} after retries: ${(err as Error).message?.slice(0,80)}`);
        // Advance cursor to just before this chunk so next run retries from here
        if (from > fromBlock) await setCursor(client, from - 1n);
        break;
      }

      const allLogs = [...buyLogs, ...sellLogs] as Array<{
        blockNumber: bigint;
        logIndex: number;
        transactionHash: `0x${string}`;
        address: Address;
        args: Record<string, unknown>;
      }>;

      if (allLogs.length > 0) {
        const blockNums = Array.from(new Set(allLogs.map((l) => l.blockNumber)));
        const timestamps = await getBlockTimestamps(blockNums);

        const curveToToken = new Map<string, string>();
        for (const [tok, crv] of curveByToken.entries()) curveToToken.set(crv, tok);

        for (const log of allLogs) {
          const ts = timestamps.get(log.blockNumber);
          if (!ts) continue;

          const curveAddr = log.address.toLowerCase();
          const tokenAddr = curveToToken.get(curveAddr) || '';
          const isBuy = 'buyer' in log.args;

          const trader = isBuy
            ? (log.args.buyer as string).toLowerCase()
            : (log.args.seller as string).toLowerCase();

          const ethAmount = isBuy
            ? String(log.args.ethIn as bigint)
            : String(log.args.ethToUser as bigint);

          const ethForPrice = isBuy
            ? String(log.args.ethForCurve as bigint)
            : String(log.args.ethOutGross as bigint);

          const tokenAmount = isBuy
            ? String(log.args.tokensOut as bigint)
            : String(log.args.tokensIn as bigint);

          try {
            await client.query(`
              INSERT INTO trades
                (token_address, curve_address, trader, type, eth_amount, eth_for_price, token_amount, progress_bps, tx_hash, block_number, log_index, timestamp)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (tx_hash, log_index) DO NOTHING
            `, [
              tokenAddr,
              curveAddr,
              trader,
              isBuy ? 'buy' : 'sell',
              ethAmount,
              ethForPrice,
              tokenAmount,
              Number(log.args.progressBps as bigint),
              log.transactionHash.toLowerCase(),
              String(log.blockNumber),
              log.logIndex,
              ts,
            ]);
            totalInserted++;
          } catch {}
        }
      }

      // Save cursor after every chunk — transient failures don't lose progress
      await setCursor(client, to);
    }

    console.log(`Done. Inserted ${totalInserted} trades.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
