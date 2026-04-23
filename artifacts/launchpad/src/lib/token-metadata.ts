import { useEffect, useState } from 'react';

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
// Keys MUST be lowercase.
const SEED: Record<string, TokenMetadata> = {
  '0x768923190d6cff2a1bf1139ed5fc5487458cb953': {
    image: 'ipfs://bafkreibhb4ze4ujlz5oewg7ao6kv3syiybzjkyjgmwgsiao23fuhhglqfe',
    createdAt: 0,
  },
};

// In-memory cache populated from the API.
const remoteCache = new Map<string, TokenMetadata>();
const subscribers = new Set<() => void>();

function notify() {
  for (const cb of subscribers) cb();
}

function getLocalAll(): Record<string, TokenMetadata> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

/** Synchronous read: merges SEED + remote cache + local. local wins, then remote, then seed. */
export function getTokenMetadata(address: string): TokenMetadata | null {
  const key = address.toLowerCase();
  const local = getLocalAll()[key];
  const remote = remoteCache.get(key);
  const seed = SEED[key];
  if (!local && !remote && !seed) return null;
  return { ...(seed ?? {}), ...(remote ?? {}), ...(local ?? {}) } as TokenMetadata;
}

/** Save locally only. */
export function saveTokenMetadataLocal(address: string, meta: Omit<TokenMetadata, 'createdAt'>) {
  const all = getLocalAll();
  all[address.toLowerCase()] = { ...meta, createdAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(all));
  notify();
}

/** Save locally AND publish to the API server so other users can see it. */
export async function saveTokenMetadata(
  address: string,
  meta: Omit<TokenMetadata, 'createdAt'>,
): Promise<void> {
  saveTokenMetadataLocal(address, meta);
  const key = address.toLowerCase();
  try {
    await fetch(`/api/tokens/${key}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    });
    // Also seed remote cache so any open tab sees it without refetch.
    remoteCache.set(key, { ...meta, createdAt: Date.now() });
    notify();
  } catch {
    // Server save failed — local copy still works for the creator.
  }
}

/** Update just the image field for an existing token metadata record. */
export async function updateTokenMetadataImage(address: string, imageUrl: string): Promise<void> {
  const key = address.toLowerCase();
  try {
    await fetch(`/api/tokens/${key}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageUrl }),
    });
    const existing = remoteCache.get(key);
    remoteCache.set(key, { ...(existing ?? { createdAt: Date.now() }), image: imageUrl });
    notify();
  } catch {
    // silent — local copy already updated
  }
}

/** Fetch a single token's metadata from the API and cache it. */
export async function fetchTokenMetadataRemote(address: string): Promise<TokenMetadata | null> {
  const key = address.toLowerCase();
  try {
    const r = await fetch(`/api/tokens/${key}/metadata`);
    if (r.status === 404) return null;
    if (!r.ok) return null;
    const meta = (await r.json()) as TokenMetadata;
    remoteCache.set(key, meta);
    notify();
    return meta;
  } catch {
    return null;
  }
}

/** Bulk prefetch all known token metadata into the cache. Called once at app boot. */
export async function prefetchAllTokenMetadata(): Promise<void> {
  try {
    const r = await fetch('/api/tokens/metadata');
    if (!r.ok) return;
    const all = (await r.json()) as Record<string, TokenMetadata>;
    for (const [addr, meta] of Object.entries(all)) {
      remoteCache.set(addr.toLowerCase(), meta);
    }
    notify();
  } catch {
    // ignore
  }
}

/** Hook that returns merged metadata and re-renders when remote/local changes. */
export function useTokenMetadata(address: string | undefined | null): TokenMetadata | null {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((n) => n + 1);
    subscribers.add(cb);
    if (address) {
      const key = address.toLowerCase();
      if (!remoteCache.has(key)) {
        void fetchTokenMetadataRemote(address);
      }
    }
    return () => {
      subscribers.delete(cb);
    };
  }, [address]);
  if (!address) return null;
  return getTokenMetadata(address);
}
