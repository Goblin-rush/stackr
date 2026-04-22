import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const dbUrl = process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    res.status(500).json({ error: 'DB not configured' });
    return;
  }

  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT address, website, twitter, telegram, description, image, created_at
      FROM token_metadata
    `;

    const result = {};
    for (const row of rows) {
      result[row.address.toLowerCase()] = {
        website: row.website,
        twitter: row.twitter,
        telegram: row.telegram,
        description: row.description,
        image: row.image,
        createdAt: row.created_at,
      };
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(result);
  } catch (err) {
    console.error('metadata bulk fetch error:', err);
    res.status(500).json({ error: 'DB error' });
  }
}
