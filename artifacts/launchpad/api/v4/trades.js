import { getSql, rowToTrade, ADDR_RE } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const tokenAddress = String(req.query.tokenAddress || '').toLowerCase();
    if (!ADDR_RE.test(tokenAddress)) {
      res.status(400).json({ error: 'Invalid tokenAddress' });
      return;
    }
    const limit = Math.min(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1000);
    const sql = getSql();
    const rows = await sql`
      SELECT id, token_address, curve_address, trader, type, eth_amount, fee,
             token_amount, total_bonded_after, price_wei_per_token, tx_hash,
             block_number, log_index, timestamp
      FROM trades_v4
      WHERE token_address = ${tokenAddress}
      ORDER BY timestamp DESC, log_index DESC
      LIMIT ${limit}
    `;
    const trades = rows.map(rowToTrade);
    res.setHeader('Cache-Control', 's-maxage=3, stale-while-revalidate=10');
    res.status(200).json({ count: trades.length, tokenAddress, trades });
  } catch (err) {
    console.error('v4 trades error:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch v4 trades' });
  }
}
