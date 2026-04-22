export const FACTORY_ADDRESS = '0x58439e7474725725b9A934299bA503e7F0625894' as const;

// Tokens hidden from public feed and global trade tape (e.g. dev/test tokens).
// Lowercase addresses only.
export const HIDDEN_TOKENS: ReadonlySet<string> = new Set([
  '0x49adaeb41d12cb01de7dbd93ad2798e392fde4b2', // duplicate AETH (hidden)
]);

export function isHiddenToken(address: string): boolean {
  return HIDDEN_TOKENS.has(address.toLowerCase());
}

export const FACTORY_ABI = [
  {
    name: 'createToken',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_name', type: 'string' },
      { name: '_symbol', type: 'string' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    name: 'totalTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'getTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ name: 'result', type: 'address[]' }],
  },
  {
    name: 'getTokensByCreator',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_creator', type: 'address' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'TokenCreated',
    type: 'event',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'index', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const BONDING_CURVE_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'realEthRaised', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'virtualTokenReserve', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'graduated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'getProgress', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'currentPrice', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getBuyAmount', type: 'function', stateMutability: 'view', inputs: [{ name: 'ethAmount', type: 'uint256' }], outputs: [{ name: 'tokensOut', type: 'uint256' }] },
  { name: 'getSellAmount', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenAmount', type: 'uint256' }], outputs: [{ name: 'ethOut', type: 'uint256' }] },
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'minTokensOut', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'minEthOut', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'withdrawEth',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'EthWithdrawn',
    type: 'event',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'Buy',
    type: 'event',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'ethIn', type: 'uint256', indexed: false },
      { name: 'tokensOut', type: 'uint256', indexed: false },
      { name: 'progress', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Sell',
    type: 'event',
    inputs: [
      { name: 'seller', type: 'address', indexed: true },
      { name: 'tokensIn', type: 'uint256', indexed: false },
      { name: 'ethOut', type: 'uint256', indexed: false },
      { name: 'progress', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Graduated',
    type: 'event',
    inputs: [{ name: 'ethRaised', type: 'uint256', indexed: false }],
  },
] as const;

export const TARGET_ETH = BigInt('3500000000000000000'); // 3.5 ETH
export const VIRTUAL_ETH = BigInt('1500000000000000000'); // 1.5 ETH
export const TOTAL_SUPPLY = BigInt('1000000000000000000000000000'); // 1B tokens

// ═══════════════════════════════════════════════════════════════════
//  AETHPAD V2 — Base mainnet, holder rewards + anti-snipe + dev buy
// ═══════════════════════════════════════════════════════════════════

export const FACTORY_V2_ADDRESS =
  (import.meta.env.VITE_FACTORY_V2_ADDRESS as `0x${string}` | undefined) ?? null;

export const V2_TARGET_REAL_ETH = BigInt('5000000000000000000'); // 5 ETH
export const V2_VIRTUAL_ETH = BigInt('3000000000000000000'); // 3 ETH
export const V2_BURN_BPS = 150;
export const V2_REWARD_BPS = 200;
export const V2_PLATFORM_BPS = 150;
export const V2_TAX_BPS = V2_BURN_BPS + V2_REWARD_BPS + V2_PLATFORM_BPS; // 500 = 5%

// Anti-snipe tiers (extra sell tax in bps)
export const V2_SNIPE_TIERS = [
  { upToSec: 5 * 60, extraBps: 2000, label: '<5min' },
  { upToSec: 60 * 60, extraBps: 1000, label: '<1hr' },
  { upToSec: 24 * 3600, extraBps: 500, label: '<24hr' },
] as const;

export const FACTORY_V2_ABI = [
  {
    name: 'createToken',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [
      { name: 'tokenAddr', type: 'address' },
      { name: 'curveAddr', type: 'address' },
    ],
  },
  {
    name: 'allTokensLength',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'getRecord',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'curve', type: 'address' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'metadataURI', type: 'string' },
        ],
      },
    ],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'accumulatedPlatformFees',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'withdrawPlatformFees',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
  {
    name: 'forceCloseCurve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'TokenDeployed',
    type: 'event',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'curve', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
      { name: 'devBuyEth', type: 'uint256', indexed: false },
      { name: 'devBuyTokens', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const TOKEN_V2_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'graduated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'uniswapPair', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'pendingRewards', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'holdScore', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'totalHoldScoreLive', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'antiSnipeBpsFor', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'totalRewardsDistributed', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'RewardClaimed',
    type: 'event',
    inputs: [
      { name: 'holder', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const CURVE_V2_ABI = [
  { name: 'realEthRaised', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'virtualEthReserve', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'virtualTokenReserve', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'targetEth', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'graduated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'forceClosed', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'getProgress', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'currentPrice', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getBuyAmount', type: 'function', stateMutability: 'view', inputs: [{ name: 'eth', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'getSellAmount', type: 'function', stateMutability: 'view', inputs: [{ name: 'tok', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'lastBuyAt', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint64' }] },
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'minTokensOut', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokens', type: 'uint256' },
      { name: 'minEthOut', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'Buy',
    type: 'event',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'ethIn', type: 'uint256', indexed: false },
      { name: 'ethForCurve', type: 'uint256', indexed: false },
      { name: 'tokensOut', type: 'uint256', indexed: false },
      { name: 'progressBps', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Sell',
    type: 'event',
    inputs: [
      { name: 'seller', type: 'address', indexed: true },
      { name: 'tokensIn', type: 'uint256', indexed: false },
      { name: 'ethOutGross', type: 'uint256', indexed: false },
      { name: 'ethToUser', type: 'uint256', indexed: false },
      { name: 'progressBps', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Graduated',
    type: 'event',
    inputs: [
      { name: 'ethToLp', type: 'uint256', indexed: false },
      { name: 'tokensToLp', type: 'uint256', indexed: false },
      { name: 'pair', type: 'address', indexed: true },
    ],
  },
] as const;

/**
 * Compute remaining seconds in current anti-snipe tier given lastBuyAt.
 * Returns { tier, extraBps, secondsLeft } or null if no extra tax applies.
 */
export function getAntiSnipeStatus(lastBuyAtSec: bigint | number | undefined, nowSec = Math.floor(Date.now() / 1000)) {
  if (!lastBuyAtSec) return null;
  const last = Number(lastBuyAtSec);
  if (last === 0) return null;
  const elapsed = nowSec - last;
  for (const tier of V2_SNIPE_TIERS) {
    if (elapsed < tier.upToSec) {
      return {
        label: tier.label,
        extraBps: tier.extraBps,
        secondsLeft: tier.upToSec - elapsed,
      };
    }
  }
  return null;
}
