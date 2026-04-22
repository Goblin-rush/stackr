import type { IncomingMessage, ServerResponse } from 'node:http';

function getBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'PINATA_JWT not configured' }));
    return;
  }

  try {
    const bodyBuf = await getBodyBuffer(req);
    const contentType = (req.headers['content-type'] as string) ?? 'application/octet-stream';

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        'Content-Type': contentType,
      },
      body: bodyBuf,
    });

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Pinata error', detail: errText }));
      return;
    }

    const pinataData = await pinataRes.json() as { IpfsHash: string };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ cid: pinataData.IpfsHash }));
  } catch (err) {
    console.error('upload-image error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upload failed' }));
  }
}
