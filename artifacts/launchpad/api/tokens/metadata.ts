import { neon } from '@neondatabase/serverless';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const dbUrl = process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'DB not configured' }));
    return;
  }

  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT address, website, twitter, telegram, description, image, created_at
      FROM token_metadata
    `;

    const result: Record<string, object> = {};
    for (const row of rows) {
      result[(row.address as string).toLowerCase()] = {
        website: row.website,
        twitter: row.twitter,
        telegram: row.telegram,
        description: row.description,
        image: row.image,
        createdAt: row.created_at,
      };
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('metadata bulk fetch error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'DB error' }));
  }
}
