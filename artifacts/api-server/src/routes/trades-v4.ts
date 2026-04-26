/**
 * GET /api/v4/trades?tokenAddress=0x...&limit=200
 * Recent trades for a V4 token (newest first).
 */
import { Router, type IRouter } from 'express';
import { db, tradesV4 } from '@workspace/db';
import { desc, eq } from 'drizzle-orm';

const router: IRouter = Router();

router.get('/v4/trades', async (req, res) => {
  try {
    const tokenAddress = String(req.query.tokenAddress || '').toLowerCase();
    const limit = Math.min(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1000);
    if (!/^0x[0-9a-f]{40}$/.test(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid tokenAddress' });
    }
    const rows = await db
      .select()
      .from(tradesV4)
      .where(eq(tradesV4.tokenAddress, tokenAddress))
      .orderBy(desc(tradesV4.timestamp), desc(tradesV4.logIndex))
      .limit(limit);
    res.json({ count: rows.length, tokenAddress, trades: rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch v4 trades' });
  }
});

export default router;
