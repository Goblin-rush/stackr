import { getSql, rowToTokenRecord } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT address, curve_address, creator, name, symbol, metadata_uri,
             deployed_at, block_number, eth_usd_price_8, virtual_eth_reserve,
             graduated, cancelled, v2_pair, real_eth, tokens_sold,
             last_trade_at, indexed_at, chain_id
      FROM token_records_v4
      ORDER BY deployed_at DESC
    `;
    const tokens = rows.map(rowToTokenRecord);
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=15');
    res.status(200).json({ count: tokens.length, tokens });
  } catch (err) {
    console.error('v4 tokens list error:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch v4 tokens' });
  }
}
