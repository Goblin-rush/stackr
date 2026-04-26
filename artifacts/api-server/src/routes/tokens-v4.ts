/**
 * GET /api/v4/tokens
 *   Returns all V4 tokens, newest first.
 *
 * GET /api/v4/tokens/:address
 *   Returns a single V4 token record by address (lowercase).
 */
import { Router, type IRouter } from 'express';
import { db, tokenRecordsV4 } from '@workspace/db';
import { desc, eq } from 'drizzle-orm';

const router: IRouter = Router();

router.get('/v4/tokens', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(tokenRecordsV4)
      .orderBy(desc(tokenRecordsV4.deployedAt));
    res.json({ count: rows.length, tokens: rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch v4 tokens' });
  }
});

router.get('/v4/tokens/:address', async (req, res) => {
  try {
    const addr = req.params.address.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(addr)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    const rows = await db
      .select()
      .from(tokenRecordsV4)
      .where(eq(tokenRecordsV4.address, addr))
      .limit(1);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch v4 token' });
  }
});

export default router;
