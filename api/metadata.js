import { neon } from '@neondatabase/serverless';

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function getAddress(req) {
  const url = new URL(req.url, `http://localhost`);
  const addr = url.searchParams.get('address') || '';
  return /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr.toLowerCase() : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const dbUrl = process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    res.status(500).json({ error: 'DB not configured' });
    return;
  }

  const sql = neon(dbUrl);
  const address = getAddress(req);

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!address) {
      // Bulk: return all metadata as { [address]: {...} }
      try {
        const rows = await sql`
          SELECT address, website, twitter, telegram, description, image, created_at
          FROM token_metadata
        `;
        const result = {};
        for (const row of rows) {
          result[row.address] = {
            website: row.website,
            twitter: row.twitter,
            telegram: row.telegram,
            description: row.description,
            image: row.image,
            createdAt: row.created_at,
          };
        }
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(result);
      } catch (err) {
        console.error('metadata bulk GET error:', err);
        res.status(500).json({ error: 'DB error' });
      }
      return;
    }

    // Single token
    try {
      const rows = await sql`
        SELECT website, twitter, telegram, description, image, created_at
        FROM token_metadata WHERE address = ${address} LIMIT 1
      `;
      if (rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
      const r = rows[0];
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        website: r.website,
        twitter: r.twitter,
        telegram: r.telegram,
        description: r.description,
        image: r.image,
        createdAt: r.created_at,
      });
    } catch (err) {
      console.error('metadata GET error:', err);
      res.status(500).json({ error: 'DB error' });
    }
    return;
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!address) { res.status(400).json({ error: 'address required' }); return; }
    try {
      const rawBody = await getBody(req);
      const body = JSON.parse(rawBody || '{}');
      await sql`
        INSERT INTO token_metadata (address, website, twitter, telegram, description, image, created_at)
        VALUES (
          ${address},
          ${body.website ?? null},
          ${body.twitter ?? null},
          ${body.telegram ?? null},
          ${body.description ?? null},
          ${body.image ?? null},
          ${Date.now()}
        )
        ON CONFLICT (address) DO UPDATE SET
          website     = EXCLUDED.website,
          twitter     = EXCLUDED.twitter,
          telegram    = EXCLUDED.telegram,
          description = EXCLUDED.description,
          image       = COALESCE(EXCLUDED.image, token_metadata.image)
      `;
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('metadata POST error:', err);
      res.status(500).json({ error: 'DB error' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
