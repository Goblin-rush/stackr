/**
 * V3 Chain Indexer — cron job that runs every 60 seconds.
 *
 * Indexes TokenDeployed events from both Base and Ethereum mainnet factories.
 * Each chain has its own cursor in indexer_cursors.
 */

import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
} from 'viem';
import { base, mainnet } from 'viem/chains';
import { db, tokenRecordsV3, indexerCursors } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { logger } from './logger';

// ─── Chain configs ────────────────────────────────────────────────────────────

const CHAINS = [
  {
    chainId: 8453,
    name: 'base',
    chain: base,
    factory: '0xc01e4b239eA7cF7abaB4A9ECbc03cc51a656C76f' as Address,
    cursorId: 'v3-token-indexer-v4',
    getRpc: () => process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org',
    initialLookback: 500_000n,
    batch: 9_000n,
  },
  {
    chainId: 1,
    name: 'ethereum',
    chain: mainnet,
    factory: '0x6d9907040C25C0B3675bbAcef54a3c42710826E9' as Address,
    cursorId: 'v3-token-indexer-eth-mainnet',
    getRpc: () => process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    initialLookback: 50_000n,
    batch: 2_000n,
  },
] as const;

// ─── Events ───────────────────────────────────────────────────────────────────

const TOKEN_DEPLOYED_EVENT = parseAbiItem(
  'event TokenDeployed(address indexed token, address indexed creator, string name, string symbol, string metadataURI)'
);

// ─── Cursor helpers ───────────────────────────────────────────────────────────

async function getCursor(cursorId: string): Promise<bigint | null> {
  const rows = await db
    .select()
    .from(indexerCursors)
    .where(eq(indexerCursors.id, cursorId))
    .limit(1);
  return rows[0] ? BigInt(rows[0].lastBlock) : null;
}

async function saveCursor(cursorId: string, block: bigint) {
  await db
    .insert(indexerCursors)
    .values({ id: cursorId, lastBlock: Number(block), updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: indexerCursors.id,
      set: { lastBlock: Number(block), updatedAt: Date.now() },
    });
}

// ─── Per-chain indexer ────────────────────────────────────────────────────────

async function runChain(cfg: typeof CHAINS[number]) {
  const client = createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.getRpc()),
  });

  const tip = await client.getBlockNumber();
  const cursor = await getCursor(cfg.cursorId);

  const from = cursor !== null
    ? cursor + 1n
    : (tip > cfg.initialLookback ? tip - cfg.initialLookback : 0n);

  if (from > tip) return;

  for (let start = from; start <= tip; start += cfg.batch) {
    const end = start + cfg.batch - 1n > tip ? tip : start + cfg.batch - 1n;

    const deployedLogs = await client.getLogs({
      address: cfg.factory,
      event: TOKEN_DEPLOYED_EVENT,
      fromBlock: start,
      toBlock: end,
    }).catch(() => []);

    if (deployedLogs.length > 0) {
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
        const tokenAddr  = (l.args as any).token as string;
        const creator    = (l.args as any).creator as string;
        const metaURI    = (l.args as any).metadataURI as string | undefined;
        const deployedAt = tsByBlock.get(l.blockNumber) ?? Math.floor(Date.now() / 1000);

        await db
          .insert(tokenRecordsV3)
          .values({
            address:     tokenAddr.toLowerCase(),
            creator:     creator.toLowerCase(),
            deployedAt,
            metadataURI: metaURI ?? null,
            indexedAt:   Date.now(),
            blockNumber: Number(l.blockNumber),
            chainId:     cfg.chainId,
          })
          .onConflictDoNothing();
      }

      logger.info(
        { chain: cfg.name, count: deployedLogs.length, from: String(start), to: String(end) },
        'indexer: indexed tokens'
      );
    }

    await saveCursor(cfg.cursorId, end);
  }
}

// ─── Main tick ────────────────────────────────────────────────────────────────

async function runOnce() {
  await Promise.allSettled(CHAINS.map(runChain));
}

// ─── Exported starter ─────────────────────────────────────────────────────────

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

  void tick();
  setInterval(tick, 60_000);
  logger.info('indexer: started (60s interval, base + ethereum)');
}
