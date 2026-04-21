export interface MockToken {
  slug: string;
  name: string;
  symbol: string;
  description: string | null;
  raised: number;
  target: number;
  mcap: string;
  price: string;
  priceNum: number;
  avatarColor: string;
  graduated?: boolean;
  contract: string;
  creator: string;
  createdAtMs: number;
}

export const MOCK_TOKENS: MockToken[] = [
  {
    slug: 'asteroid-shiba',
    name: 'Asteroid Shiba',
    symbol: 'ASTEROIDSTR',
    description: 'The degen dog that survived the asteroid. Community-driven meme coin on Ethereum.',
    raised: 1.84,
    target: 3.5,
    mcap: '$24,300',
    price: '0.0000142',
    priceNum: 0.0000142,
    avatarColor: '#e85d04',
    contract: '0x7a2c9b1e8f4d6a3b5c2e9d1f4b8a7c6e5d3f2a1b',
    creator: '0x4f3e2a1b8c7d6e5f4a3b2c1d9e8f7a6b5c4d3e2f',
    createdAtMs: Date.now() - 1000 * 60 * 47,
  },
  {
    slug: 'pepe-classic',
    name: 'Pepe Classic',
    symbol: 'PEPEC',
    description: 'The original frog is back. Rarer than rare, bonding curve edition.',
    raised: 3.5,
    target: 3.5,
    mcap: '$198,000',
    price: '0.000198',
    priceNum: 0.000198,
    avatarColor: '#16a34a',
    graduated: true,
    contract: '0x9b8c7d6e5f4a3b2c1d9e8f7a6b5c4d3e2f1a0b9c',
    creator: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    createdAtMs: Date.now() - 1000 * 60 * 60 * 8,
  },
  {
    slug: 'moondoge',
    name: 'MoonDoge',
    symbol: 'MDOGE',
    description: null,
    raised: 0.32,
    target: 3.5,
    mcap: '$4,100',
    price: '0.0000041',
    priceNum: 0.0000041,
    avatarColor: '#7c3aed',
    contract: '0x3e2d1c9b8a7f6e5d4c3b2a1f9e8d7c6b5a4f3e2d',
    creator: '0x8d7e6f5a4b3c2d1e9f8a7b6c5d4e3f2a1b9c8d7e',
    createdAtMs: Date.now() - 1000 * 60 * 13,
  },
  {
    slug: 'chad-token',
    name: 'Chad Token',
    symbol: 'CHAD',
    description: 'Only chads hold this. Wagmi.',
    raised: 2.1,
    target: 3.5,
    mcap: '$61,500',
    price: '0.0000615',
    priceNum: 0.0000615,
    avatarColor: '#0284c7',
    contract: '0x5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e9f8a7b6c5d',
    creator: '0xa9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0',
    createdAtMs: Date.now() - 1000 * 60 * 60 * 3,
  },
];

export function getMockToken(slug: string): MockToken | undefined {
  return MOCK_TOKENS.find((t) => t.slug === slug);
}
