/**
 * V4 Bonding-Curve Indexer (Ethereum mainnet only).
 *
 * Watches:
 *   - StackrFactoryV4.TokenDeployed → upsert into tokenRecordsV4
 *   - StackrCurveV4.Bought / Sold    → insert into tradesV4 + update aggregates
 *   - StackrCurveV4.Graduated        → mark graduated, store v2Pair
 *   - StackrCurveV4.Cancelled        → mark cancelled
 *
 * Runs every 30 seconds.
 */

import {
  createPublicClient,
  fallback,
  http,
  parseAbiItem,
  type Address,
  type PublicClient,
} from 'viem';
import { mainnet } from 'viem/chains';
import { db, tokenRecordsV4, tradesV4, indexerCursors } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { logger } from './logger';

// ─── Config ───────────────────────────────────────────────────────────────────

const FACTORY_V4: Address = '0xCd2eF35fbe85460dbc4cb549945fd119d17F03D1';
const CURSOR_ID = 'v4-indexer-eth-mainnet';
const CHAIN_ID = 1;
const INITIAL_LOOKBACK = 30_000n; // ~4 days at ~12s/block
const BATCH_SIZE = 2_000n;
const TICK_INTERVAL_MS = 30_000;

// Fallback chain of free public RPCs. publicnode is most reliable, llamarpc/ankr are backups.
const RPC_URLS = [
  process.env.ETH_RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://rpc.ankr.com/eth',
  'https://eth.llamarpc.com',
  'https://cloudflare-eth.com',
].filter(Boolean) as string[];

function getClient(): PublicClient {
  return createPublicClient({
    chain: mainnet,
    transport: fallback(
      RPC_URLS.map((u) => http(u, { timeout: 8_000, retryCount: 1 })),
      { rank: false, retryCount: 2 },
    ),
  }) as PublicClient;
}

// ─── Event signatures ─────────────────────────────────────────────────────────

const TOKEN_DEPLOYED_EVENT = parseAbiItem(
  'event TokenDeployed(address indexed token, address indexed curve, address indexed creator, string name, string symbol, string metadataURI, uint256 ethUsdPrice8, uint256 virtualEthReserve)',
);
const BOUGHT_EVENT = parseAbiItem(
  'event Bought(address indexed buyer, uint256 ethIn, uint256 fee, uint256 tokensOut, uint256 totalBonded)',
);
const SOLD_EVENT = parseAbiItem(
  'event Sold(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 fee, uint256 totalBonded)',
);
const GRADUATED_EVENT = parseAbiItem(
  'event Graduated(uint256 ethToLP, uint256 tokensToLP, uint256 tokensBurned, address v2Pair)',
);
const CANCELLED_EVENT = parseAbiItem(
  'event Cancelled(uint256 realEthAtCancel)',
);

// ─── Cursor helpers ───────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceWeiPerToken(ethWei: bigint, tokenWei: bigint): bigint {
  if (tokenWei === 0n) return 0n;
  return (ethWei * 10n ** 18n) / tokenWei;
}

async function blockTsMap(client: PublicClient, blockNums: bigint[]): Promise<Map<bigint, number>> {
  const out = new Map<bigint, number>();
  const chunk = 20;
  for (let i = 0; i < blockNums.length; i += chunk) {
    const slice = blockNums.slice(i, i + chunk);
    const results = await Promise.allSettled(slice.map((bn) => client.getBlock({ blockNumber: bn })));
    for (let j = 0; j < slice.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled') out.set(slice[j], Number(r.value.timestamp));
    }
  }
  return out;
}

// ─── Track active curves so we know which addresses to watch ──────────────────

let activeCurves = new Map<Address, Address>(); // curve → token

async function loadActiveCurves() {
  const rows = await db.select().from(tokenRecordsV4);
  activeCurves = new Map(rows.map((r) => [r.curveAddress.toLowerCase() as Address, r.address as Address]));
}

// ─── Main scan ────────────────────────────────────────────────────────────────

async function scan() {
  const client = getClient();
  const tip = await client.getBlockNumber();
  const cursor = await getCursor();
  const from = cursor !== null
    ? cursor + 1n
    : (tip > INITIAL_LOOKBACK ? tip - INITIAL_LOOKBACK : 0n);

  if (from > tip) return;

  await loadActiveCurves();

  for (let start = from; start <= tip; start += BATCH_SIZE) {
    const end = start + BATCH_SIZE - 1n > tip ? tip : start + BATCH_SIZE - 1n;

    // 1. New token deployments
    const deployedLogs = await client.getLogs({
      address: FACTORY_V4,
      event: TOKEN_DEPLOYED_EVENT,
      fromBlock: start,
      toBlock: end,
    }).catch((e) => {
      logger.warn({ err: e?.message }, 'v4-indexer: deployedLogs error');
      return [];
    });

    if (deployedLogs.length > 0) {
      const tsMap = await blockTsMap(client, Array.from(new Set(deployedLogs.map((l) => l.blockNumber))));
      for (const l of deployedLogs) {
        const a = l.args as any;
        const tokenAddr = (a.token as string).toLowerCase();
        const curveAddr = (a.curve as string).toLowerCase();
        const ts = tsMap.get(l.blockNumber) ?? Math.floor(Date.now() / 1000);
        await db
          .insert(tokenRecordsV4)
          .values({
            address: tokenAddr,
            curveAddress: curveAddr,
            creator: (a.creator as string).toLowerCase(),
            name: a.name as string,
            symbol: a.symbol as string,
            metadataURI: (a.metadataURI as string) || null,
            deployedAt: ts,
            blockNumber: Number(l.blockNumber),
            ethUsdPrice8: (a.ethUsdPrice8 as bigint).toString(),
            virtualEthReserve: (a.virtualEthReserve as bigint).toString(),
            graduated: 0,
            cancelled: 0,
            v2Pair: null,
            realEth: '0',
            tokensSold: '0',
            indexedAt: Date.now(),
            chainId: CHAIN_ID,
          })
          .onConflictDoNothing();
        activeCurves.set(curveAddr as Address, tokenAddr as Address);
      }
      logger.info({ count: deployedLogs.length }, 'v4-indexer: tokens deployed');
    }

    // 2. Trade + lifecycle events on all known curves
    const curveAddrs = Array.from(activeCurves.keys());
    if (curveAddrs.length > 0) {
      const [boughtLogs, soldLogs, gradLogs, cancelLogs] = await Promise.all([
        client.getLogs({ address: curveAddrs, event: BOUGHT_EVENT, fromBlock: start, toBlock: end }).catch(() => []),
        client.getLogs({ address: curveAddrs, event: SOLD_EVENT, fromBlock: start, toBlock: end }).catch(() => []),
        client.getLogs({ address: curveAddrs, event: GRADUATED_EVENT, fromBlock: start, toBlock: end }).catch(() => []),
        client.getLogs({ address: curveAddrs, event: CANCELLED_EVENT, fromBlock: start, toBlock: end }).catch(() => []),
      ]);

      const allBlocks = new Set<bigint>();
      for (const l of [...boughtLogs, ...soldLogs, ...gradLogs, ...cancelLogs]) allBlocks.add(l.blockNumber);
      const tsMap2 = await blockTsMap(client, Array.from(allBlocks));

      // Buys
      for (const l of boughtLogs) {
        const a = l.args as any;
        const curve = (l.address as string).toLowerCase();
        const tokenAddr = activeCurves.get(curve as Address);
        if (!tokenAddr) continue;
        const ethIn = a.ethIn as bigint;
        const fee = a.fee as bigint;
        const tokensOut = a.tokensOut as bigint;
        const totalBonded = a.totalBonded as bigint;
        const ethForCurve = ethIn - fee;
        const ts = tsMap2.get(l.blockNumber) ?? Math.floor(Date.now() / 1000);
        await db.insert(tradesV4).values({
          tokenAddress: tokenAddr,
          curveAddress: curve,
          trader: (a.buyer as string).toLowerCase(),
          type: 'buy',
          ethAmount: ethIn.toString(),
          fee: fee.toString(),
          tokenAmount: tokensOut.toString(),
          totalBondedAfter: totalBonded.toString(),
          priceWeiPerToken: priceWeiPerToken(ethForCurve, tokensOut).toString(),
          txHash: l.transactionHash,
          blockNumber: Number(l.blockNumber),
          logIndex: l.logIndex,
          timestamp: ts,
        }).onConflictDoNothing();
        await db.update(tokenRecordsV4).set({
          realEth: totalBonded.toString(),
          lastTradeAt: ts,
        }).where(eq(tokenRecordsV4.address, tokenAddr));
      }

      // Sells
      for (const l of soldLogs) {
        const a = l.args as any;
        const curve = (l.address as string).toLowerCase();
        const tokenAddr = activeCurves.get(curve as Address);
        if (!tokenAddr) continue;
        const tokensIn = a.tokensIn as bigint;
        const ethOut = a.ethOut as bigint;
        const fee = a.fee as bigint;
        const totalBonded = a.totalBonded as bigint;
        const ethGross = ethOut + fee;
        const ts = tsMap2.get(l.blockNumber) ?? Math.floor(Date.now() / 1000);
        await db.insert(tradesV4).values({
          tokenAddress: tokenAddr,
          curveAddress: curve,
          trader: (a.seller as string).toLowerCase(),
          type: 'sell',
          ethAmount: ethGross.toString(),
          fee: fee.toString(),
          tokenAmount: tokensIn.toString(),
          totalBondedAfter: totalBonded.toString(),
          priceWeiPerToken: priceWeiPerToken(ethGross, tokensIn).toString(),
          txHash: l.transactionHash,
          blockNumber: Number(l.blockNumber),
          logIndex: l.logIndex,
          timestamp: ts,
        }).onConflictDoNothing();
        await db.update(tokenRecordsV4).set({
          realEth: totalBonded.toString(),
          lastTradeAt: ts,
        }).where(eq(tokenRecordsV4.address, tokenAddr));
      }

      // Graduated
      for (const l of gradLogs) {
        const a = l.args as any;
        const curve = (l.address as string).toLowerCase();
        const tokenAddr = activeCurves.get(curve as Address);
        if (!tokenAddr) continue;
        await db.update(tokenRecordsV4).set({
          graduated: 1,
          v2Pair: (a.v2Pair as string).toLowerCase(),
        }).where(eq(tokenRecordsV4.address, tokenAddr));
      }

      // Cancelled
      for (const l of cancelLogs) {
        const curve = (l.address as string).toLowerCase();
        const tokenAddr = activeCurves.get(curve as Address);
        if (!tokenAddr) continue;
        await db.update(tokenRecordsV4).set({ cancelled: 1 }).where(eq(tokenRecordsV4.address, tokenAddr));
      }

      const tradeTotal = boughtLogs.length + soldLogs.length;
      if (tradeTotal > 0 || gradLogs.length > 0 || cancelLogs.length > 0) {
        logger.info(
          { trades: tradeTotal, grad: gradLogs.length, cancel: cancelLogs.length, from: String(start), to: String(end) },
          'v4-indexer: indexed events',
        );
      }
    }

    await saveCursor(end);
  }
}

// ─── Public starter ───────────────────────────────────────────────────────────

let running = false;

export function startIndexerV4() {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await scan();
    } catch (err: any) {
      logger.error({ err: err?.message }, 'v4-indexer: error');
    } finally {
      running = false;
    }
  };
  void tick();
  setInterval(tick, TICK_INTERVAL_MS);
  logger.info('v4-indexer: started (30s interval, ethereum mainnet)');
}
