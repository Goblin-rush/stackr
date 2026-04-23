/**
 * V3 Chain Indexer — cron job that runs every 60 seconds.
 *
 * Jobs:
 *  1. Reads PoolRegistered events from StackrFactoryV3 and stores
 *     new tokens in the token_records_v3 table.
 *  2. Tracks the last indexed block in indexer_cursors.
 */

import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
} from 'viem';
import { base } from 'viem/chains';
import { db, tokenRecordsV3, indexerCursors } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { logger } from './logger';

const FACTORY_V3 = '0x77a29992f609A90d7d911B056145fF95Ca7e7e73' as Address;
const CURSOR_ID  = 'v3-token-indexer';
const BATCH           = 9_000n;
// On first run (no cursor), look back this many blocks to catch historical tokens.
// ~500k blocks ≈ 11 days at 2s/block on Base.
const INITIAL_LOOKBACK = 500_000n;

const POOL_REGISTERED_EVENT = parseAbiItem(
  'event PoolRegistered(bytes32 indexed poolId, address indexed token)'
);

const TOKEN_DEPLOYED_EVENT = parseAbiItem(
  'event TokenDeployed(address indexed token, address indexed creator, string name, string symbol, string metadataURI)'
);

function getClient() {
  const rpcUrl = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

async function getCursor(): Promise<bigint | null> {
  const rows = await db
    .select()
    .from(indexerCursors)
    .where(eq(indexerCursors.id, CURSOR_ID))
    .limit(1);
  return rows[0] ? BigInt(rows[0].lastBlock) : null;
}

async function saveCursor(block: bigint) {
  await db
    .insert(indexerCursors)
    .values({ id: CURSOR_ID, lastBlock: Number(block), updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: indexerCursors.id,
      set: { lastBlock: Number(block), updatedAt: Date.now() },
    });
}

async function runOnce() {
  const client = getClient();

  const tip = await client.getBlockNumber();
  const cursor = await getCursor();

  // First run: look back INITIAL_LOOKBACK blocks to catch historical deployments.
  const from = cursor !== null
    ? cursor + 1n
    : (tip > INITIAL_LOOKBACK ? tip - INITIAL_LOOKBACK : 0n);

  if (from > tip) return; // Nothing to index.

  // Process in BATCH-sized windows.
  for (let start = from; start <= tip; start += BATCH) {
    const end = start + BATCH - 1n > tip ? tip : start + BATCH - 1n;

    // Fetch TokenDeployed events (carries creator + metadataURI)
    const deployedLogs = await client.getLogs({
      address: FACTORY_V3,
      event: TOKEN_DEPLOYED_EVENT,
      fromBlock: start,
      toBlock: end,
    }).catch(() => []);

    if (deployedLogs.length > 0) {
      // Fetch block timestamps for new tokens.
      const blockNums = Array.from(new Set(deployedLogs.map((l) => l.blockNumber)));
      const tsByBlock = new Map<bigint, number>();
      await Promise.all(
        blockNums.map(async (bn) => {
          try {
            const b = await client.getBlock({ blockNumber: bn });
            tsByBlock.set(bn, Number(b.timestamp));
          } catch {
            tsByBlock.set(bn, Math.floor(Date.now() / 1000));
          }
        })
      );

      for (const l of deployedLogs) {
        const tokenAddr = (l.args as any).token as string;
        const creator   = (l.args as any).creator as string;
        const metaURI   = (l.args as any).metadataURI as string | undefined;
        const deployedAt = tsByBlock.get(l.blockNumber) ?? Math.floor(Date.now() / 1000);

        await db
          .insert(tokenRecordsV3)
          .values({
            address: tokenAddr.toLowerCase(),
            creator: creator.toLowerCase(),
            deployedAt,
            metadataURI: metaURI ?? null,
            indexedAt: Date.now(),
            blockNumber: Number(l.blockNumber),
          })
          .onConflictDoNothing();
      }

      logger.info({ count: deployedLogs.length, from: String(start), to: String(end) }, 'indexer: indexed tokens');
    }

    await saveCursor(end);
  }
}

let running = false;

export function startIndexer() {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } catch (err: any) {
      logger.error({ err: err?.message }, 'indexer: error');
    } finally {
      running = false;
    }
  };

  // Run immediately, then every 60 seconds.
  void tick();
  setInterval(tick, 60_000);
  logger.info('indexer: started (60s interval)');
}
