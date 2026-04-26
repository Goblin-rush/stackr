import { getSql, rowToTokenRecord } from './_lib.js';

const HIDDEN_TOKENS_V4 = new Set([
  '0xad9a072d6a98f022038c8b2b27f688de69a4b3fb',
  '0x8fab3c308e641402e53d39aa4f7abfa7f633fa34',
  '0xa3b9648cf0cf4c6b5ea2c2f3f56a339ffa62f771',
]);

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
      WHERE COALESCE(hidden, 0) = 0
      ORDER BY deployed_at DESC
    `;
    const tokens = rows
      .map(rowToTokenRecord)
      .filter((t) => !HIDDEN_TOKENS_V4.has(String(t.address || '').toLowerCase()));
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=15');
    res.status(200).json({ count: tokens.length, tokens });
  } catch (err) {
    console.error('v4 tokens list error:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch v4 tokens' });
  }
}
