/**
 * GET /api/tokens
 * Returns the list of V3 tokens indexed from the StackrFactoryV3 chain events.
 * Ordered by deployedAt descending (newest first).
 */
import { Router, type IRouter } from 'express';
import { db, tokenRecordsV3 } from '@workspace/db';
import { desc } from 'drizzle-orm';

const router: IRouter = Router();

router.get('/tokens', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(tokenRecordsV3)
      .orderBy(desc(tokenRecordsV3.deployedAt));
    res.json({ count: rows.length, tokens: rows });
  } catch (err: any) {
    const detail = err?.cause?.message || err?.message || 'Failed to fetch tokens';
    res.status(500).json({ error: detail });
  }
});

export default router;
