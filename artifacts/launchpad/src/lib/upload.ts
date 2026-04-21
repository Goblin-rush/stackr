export interface UploadResult {
  cid: string;
  url: string; // ipfs://CID
  gatewayUrl: string;
}

export async function uploadImage(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload-image', {
    method: 'POST',
    body: fd,
  });
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
