export interface UploadResult {
  cid: string;
  url: string; // ipfs://CID
  gatewayUrl: string;
}

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined;
const PINATA_API = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const GATEWAY = 'https://gateway.pinata.cloud/ipfs';

export async function uploadImage(file: File): Promise<UploadResult> {
  if (PINATA_JWT) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('pinataMetadata', JSON.stringify({ name: file.name }));
    fd.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const res = await fetch(PINATA_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pinata upload failed: ${text}`);
    }

    const data = (await res.json()) as { IpfsHash: string };
    const cid = data.IpfsHash;
    return { cid, url: `ipfs://${cid}`, gatewayUrl: `${GATEWAY}/${cid}` };
  }

  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
  if (!res.ok) {
    let msg = 'Upload failed';
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as UploadResult;
}
