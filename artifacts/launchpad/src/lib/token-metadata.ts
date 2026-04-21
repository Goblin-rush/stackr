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

/** Normalize a website input. Adds https:// if missing scheme. Returns null if invalid. */
export function normalizeWebsite(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(url);
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Normalize a Twitter/X handle or URL into a full https URL. */
export function normalizeTwitter(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/^@+/, '');
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) {
    try { return new URL(v).toString(); } catch { return null; }
  }
  // Strip leading "twitter.com/" or "x.com/" if present
  const handle = v.replace(/^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\//i, '').replace(/^\/+/, '');
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  return `https://x.com/${handle}`;
}

/** Normalize a Telegram handle, t.me link, or URL into a full https URL. */
export function normalizeTelegram(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/^@+/, '');
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) {
    try { return new URL(v).toString(); } catch { return null; }
  }
  const handle = v.replace(/^(?:https?:\/\/)?(?:www\.)?t\.me\//i, '').replace(/^\/+/, '');
  if (!/^[A-Za-z0-9_+\-]{2,}$/.test(handle)) return null;
  return `https://t.me/${handle}`;
}

const KEY = 'launchpad:token-metadata';

// Built-in seed for tokens deployed before server-side metadata existed.
// Keys MUST be lowercase. These are visible to all users (not localStorage-only).
const SEED: Record<string, TokenMetadata> = {
  '0x768923190d6cff2a1bf1139ed5fc5487458cb953': {
    image: 'ipfs://bafkreibhb4ze4ujlz5oewg7ao6kv3syiybzjkyjgmwgsiao23fuhhglqfe',
    createdAt: 0,
  },
};

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
  const key = address.toLowerCase();
  const local = getAll()[key];
  const seed = SEED[key];
  if (!local && !seed) return null;
  return { ...(seed ?? {}), ...(local ?? {}) } as TokenMetadata;
}
