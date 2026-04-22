import { neon } from '@neondatabase/serverless';
import type { IncomingMessage, ServerResponse } from 'node:http';

function getBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string> },
  res: ServerResponse,
) {
  const url = req.url ?? '';
  const parts = url.split('/').filter(Boolean);
  const addressIdx = parts.indexOf('tokens') + 1;
  const address = (parts[addressIdx] ?? '').toLowerCase();

  if (!address || !/^0x[0-9a-f]{40}$/i.test(address)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid address' }));
    return;
  }

  const dbUrl = process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'DB not configured' }));
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
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
      const row = rows[0];
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      });
      res.end(JSON.stringify({
        website: row.website,
        twitter: row.twitter,
        telegram: row.telegram,
        description: row.description,
        image: row.image,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.error('metadata GET error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'DB error' }));
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const rawBody = await getBody(req);
      const body = JSON.parse(rawBody) as {
        website?: string;
        twitter?: string;
        telegram?: string;
        description?: string;
        image?: string;
      };

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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('metadata POST error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'DB error' }));
    }
    return;
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
}
