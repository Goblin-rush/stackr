import { getSql, rowToTokenRecord, ADDR_RE } from './_lib.js';

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
    const sql = getSql();
    const rows = await sql`
      SELECT address, curve_address, creator, name, symbol, metadata_uri,
             deployed_at, block_number, eth_usd_price_8, virtual_eth_reserve,
             graduated, cancelled, v2_pair, real_eth, tokens_sold,
             last_trade_at, indexed_at, chain_id
      FROM token_records_v4
      WHERE address = ${addr}
      LIMIT 1
    `;
    if (rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=15');
    res.status(200).json(rowToTokenRecord(rows[0]));
  } catch (err) {
    console.error('v4 token detail error:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch v4 token' });
  }
}
