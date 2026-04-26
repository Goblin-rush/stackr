import {
  createPublicClient,
  fallback,
  http,
  parseAbiItem,
} from 'viem';
import { mainnet } from 'viem/chains';
import { getSql, ADDR_RE } from './_lib.js';

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
].filter(Boolean);

function getClient() {
  return createPublicClient({
    chain: mainnet,
    transport: fallback(
      RPC_URLS.map((u) => http(u, { timeout: 6_000, retryCount: 1 })),
      { rank: false, retryCount: 1 },
    ),
  });
}

async function computeHolders(tokenAddr, fromBlock, deadlineMs) {
  const client = getClient();
  const tip = await client.getBlockNumber();
  const balances = new Map();
  const STEP = 9_999n;

  for (let start = fromBlock; start <= tip; start = start + STEP + 1n) {
    if (Date.now() > deadlineMs) {
      throw new Error('Holder scan timed out — too much history for serverless. Try again shortly.');
    }
    const end = start + STEP > tip ? tip : start + STEP;
    let logs = [];
    try {
      logs = await client.getLogs({
        address: tokenAddr,
        event: TRANSFER_EVENT,
        fromBlock: start,
        toBlock: end,
      });
    } catch {
      logs = [];
    }
    for (const l of logs) {
      const a = l.args || {};
      if (!a.from || !a.to || a.value === undefined) continue;
      const v = a.value;
      const from = a.from.toLowerCase();
      const to = a.to.toLowerCase();
      if (from !== ZERO) balances.set(from, (balances.get(from) ?? 0n) - v);
      if (to !== ZERO) balances.set(to, (balances.get(to) ?? 0n) + v);
    }
  }

  const positive = [];
  let total = 0n;
  for (const [a, b] of balances.entries()) {
    if (b > 0n) {
      positive.push({ address: a, balance: b });
      total += b;
    }
  }
  positive.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
  const holders = positive.map((h) => ({
    address: h.address,
    balance: h.balance.toString(),
    pct: total === 0n ? 0 : Number((h.balance * 1_000_000n) / total) / 10_000,
  }));
  return { total, holders };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const addr = String(req.query.address || '').toLowerCase();
    if (!ADDR_RE.test(addr)) {
      res.status(400).json({ error: 'Invalid address' });
      return;
    }
    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
    const sql = getSql();
    const rows = await sql`
      SELECT block_number FROM token_records_v4 WHERE address = ${addr} LIMIT 1
    `;
    if (rows.length === 0) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }
    const fromBlock = BigInt(rows[0].block_number);
    const deadlineMs = Date.now() + 9_000;
    const { total, holders } = await computeHolders(addr, fromBlock, deadlineMs);
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json({
      tokenAddress: addr,
      totalSupply: total.toString(),
      count: holders.length,
      holders: holders.slice(0, limit),
      cached: false,
    });
  } catch (err) {
    console.error('v4 holders error:', err);
    res.status(500).json({ error: err?.message || 'Failed to compute holders' });
  }
}
