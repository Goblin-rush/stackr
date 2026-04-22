export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pinataJwt = process.env.JWT || process.env.PINATA_JWT;
  if (!pinataJwt) {
    res.status(500).json({ error: 'PINATA_JWT not configured' });
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyBuf = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] ?? 'application/octet-stream';

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
      const statusCode = pinataRes.status >= 400 && pinataRes.status < 500 ? 400 : 502;
      res.status(statusCode).json({ error: 'Pinata error', detail: errText });
      return;
    }

    const data = await pinataRes.json();
    const cid = data.IpfsHash;
    res.status(200).json({
      cid,
      url: `ipfs://${cid}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
    });
  } catch (err) {
    console.error('upload-image error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}
