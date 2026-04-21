export interface TokenMetadata {
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
  image?: string; // ipfs://CID
  createdAt: number;
}

const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export function ipfsToHttp(uri?: string | null): string | null {
  if (!uri) return null;
  if (uri.startsWith('ipfs://')) return IPFS_GATEWAY + uri.slice(7);
  if (/^https?:\/\//i.test(uri)) return uri;
  return null;
}

const KEY = 'launchpad:token-metadata';

function getAll(): Record<string, TokenMetadata> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveTokenMetadata(address: string, meta: Omit<TokenMetadata, 'createdAt'>) {
  const all = getAll();
  all[address.toLowerCase()] = { ...meta, createdAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getTokenMetadata(address: string): TokenMetadata | null {
  return getAll()[address.toLowerCase()] ?? null;
}
