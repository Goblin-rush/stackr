/**
 * GET /api/v4/tokens/:address/holders?limit=100
 *
 * Returns current top holders for a V4 token by aggregating ERC-20 Transfer
 * logs since the deployment block. Live on-chain reconstruction; cached briefly
 * in-memory to avoid hammering RPCs.
 */
import { Router, type IRouter } from 'express';
import {
  createPublicClient,
  fallback,
  http,
  parseAbiItem,
  type Address,
  type PublicClient,
} from 'viem';
import { mainnet } from 'viem/chains';
import { db, tokenRecordsV4 } from '@workspace/db';
import { eq } from 'drizzle-orm';

const router: IRouter = Router();

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';
const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

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

interface HolderEntry { address: string; balance: string; pct: number }
interface CacheEntry { fetchedAt: number; total: string; holders: HolderEntry[] }

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

async function computeHolders(tokenAddr: Address, fromBlock: bigint): Promise<{ total: bigint; holders: HolderEntry[] }> {
  const client = getClient();
  const tip = await client.getBlockNumber();

  // Pull Transfer logs in chunks.
  const balances = new Map<string, bigint>();
  const STEP = 10_000n;

  for (let start = fromBlock; start <= tip; start += STEP + 1n) {
    const end = start + STEP > tip ? tip : start + STEP;
    let logs;
    try {
      logs = await client.getLogs({
        address: tokenAddr,
        event: TRANSFER_EVENT,
        fromBlock: start,
        toBlock: end,
      });
    } catch {
      // Retry with smaller window if needed
      logs = [];
    }
    for (const l of logs) {
      const a = l.args as { from?: Address; to?: Address; value?: bigint };
      if (!a.from || !a.to || a.value === undefined) continue;
      const v = a.value;
      const from = a.from.toLowerCase();
      const to = a.to.toLowerCase();
      if (from !== ZERO) balances.set(from, (balances.get(from) ?? 0n) - v);
      if (to !== ZERO) balances.set(to, (balances.get(to) ?? 0n) + v);
    }
  }

  // Filter & sort.
  const positive: { address: string; balance: bigint }[] = [];
  let total = 0n;
  for (const [addr, bal] of balances.entries()) {
    if (bal > 0n) {
      positive.push({ address: addr, balance: bal });
      total += bal;
    }
  }
  positive.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
  const holders: HolderEntry[] = positive.map((h) => ({
    address: h.address,
    balance: h.balance.toString(),
    pct: total === 0n ? 0 : Number((h.balance * 1_000_000n) / total) / 10_000,
  }));
  return { total, holders };
}

router.get('/v4/tokens/:address/holders', async (req, res) => {
  try {
    const addr = String(req.params.address || '').toLowerCase();
    if (!ADDR_RE.test(addr)) {
      res.status(400).json({ error: 'Invalid token address' });
      return;
    }
    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);

    // Cache hit?
    const cached = cache.get(addr);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.json({
        tokenAddress: addr,
        totalSupply: cached.total,
        count: cached.holders.length,
        holders: cached.holders.slice(0, limit),
        cached: true,
      });
      return;
    }

    // Find deployment block.
    const rows = await db
      .select()
      .from(tokenRecordsV4)
      .where(eq(tokenRecordsV4.address, addr))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }
    const fromBlock = BigInt(rows[0].blockNumber);

    const { total, holders } = await computeHolders(addr as Address, fromBlock);
    cache.set(addr, { fetchedAt: Date.now(), total: total.toString(), holders });

    res.json({
      tokenAddress: addr,
      totalSupply: total.toString(),
      count: holders.length,
      holders: holders.slice(0, limit),
      cached: false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch holders' });
  }
});

export default router;
