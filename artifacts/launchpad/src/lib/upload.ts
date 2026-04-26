export interface UploadResult {
  cid: string;
  url: string; // ipfs://CID
  gatewayUrl: string;
}

// All image uploads go through the server (`/api/upload-image`) so the Pinata
// JWT stays on the backend. NEVER read a `VITE_PINATA_JWT` here — anything on
// `import.meta.env.VITE_*` is bundled into the public JavaScript and would
// leak the credential to every visitor.
export async function uploadImage(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', file);
  // Use the artifact's BASE_URL so the path resolves correctly when the app
  // is mounted under a sub-path by the Replit preview proxy.
  const apiUrl = `${import.meta.env.BASE_URL}api/upload-image`.replace(/\/{2,}/g, '/');
  const res = await fetch(apiUrl, { method: 'POST', body: fd });
  if (!res.ok) {
    let msg = 'Upload failed';
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  return (await res.json()) as UploadResult;
}
