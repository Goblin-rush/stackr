export interface TokenMetadata {
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
  createdAt: number;
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
