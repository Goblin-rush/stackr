import { neon } from '@neondatabase/serverless';

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const url = req.url ?? '';
  const parts = url.split('/').filter(Boolean);
  const tokensIdx = parts.indexOf('tokens');
  const address = tokensIdx >= 0 ? (parts[tokensIdx + 1] ?? '').toLowerCase() : '';

  if (!address || !/^0x[0-9a-f]{40}$/i.test(address)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }

  const dbUrl = process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    res.status(500).json({ error: 'DB not configured' });
    return;
  }

  const sql = neon(dbUrl);

  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT website, twitter, telegram, description, image, created_at
        FROM token_metadata
        WHERE address = ${address}
        LIMIT 1
      `;
      if (rows.length === 0) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const row = rows[0];
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.status(200).json({
        website: row.website,
        twitter: row.twitter,
        telegram: row.telegram,
        description: row.description,
        image: row.image,
        createdAt: row.created_at,
      });
    } catch (err) {
      console.error('metadata GET error:', err);
      res.status(500).json({ error: 'DB error' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const rawBody = await getBody(req);
      const body = JSON.parse(rawBody);
      const now = Date.now();

      await sql`
        INSERT INTO token_metadata (address, website, twitter, telegram, description, image, created_at)
        VALUES (
          ${address},
          ${body.website ?? null},
          ${body.twitter ?? null},
          ${body.telegram ?? null},
          ${body.description ?? null},
          ${body.image ?? null},
          ${now}
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
