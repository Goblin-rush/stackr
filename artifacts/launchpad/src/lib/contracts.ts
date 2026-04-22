// Tokens hidden from public feed and global trade tape (e.g. dev/test tokens).
// Lowercase addresses only.
export const HIDDEN_TOKENS: ReadonlySet<string> = new Set([
  '0x49adaeb41d12cb01de7dbd93ad2798e392fde4b2', // duplicate AETH (hidden)
]);

export function isHiddenToken(address: string): boolean {
  return HIDDEN_TOKENS.has(address.toLowerCase());
}

export const TOTAL_SUPPLY = BigInt('1000000000000000000000000000'); // 1B tokens

// ═══════════════════════════════════════════════════════════════════
//  STACKR V2 — Base mainnet, holder rewards + anti-snipe + dev buy
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
    name: 'getAllTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    // TokenRecord: token, curve, creator, deployedAt, metadataURI, initialDevBuyEth, initialDevBuyTokens
    name: 'getRecord',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'curve', type: 'address' },
          { name: 'creator', type: 'address' },
          { name: 'deployedAt', type: 'uint256' },
          { name: 'metadataURI', type: 'string' },
          { name: 'initialDevBuyEth', type: 'uint256' },
          { name: 'initialDevBuyTokens', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'records',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'deployedAt', type: 'uint256' },
      { name: 'metadataURI', type: 'string' },
      { name: 'initialDevBuyEth', type: 'uint256' },
      { name: 'initialDevBuyTokens', type: 'uint256' },
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
    name: 'totalPlatformFeesWithdrawn',
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
      { name: 'tokenAddr', type: 'address' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'flushTokenPlatformEth',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [],
  },
  {
    name: 'updateMetadataURI',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAddr', type: 'address' },
      { name: 'newURI', type: 'string' },
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
  {
    name: 'MetadataUpdated',
    type: 'event',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'newURI', type: 'string', indexed: false },
    ],
  },
  {
    name: 'PlatformFeeReceived',
    type: 'event',
    inputs: [
      { name: 'fromToken', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const TOKEN_V2_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'graduated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'uniswapPair', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'curve', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'factory', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'pendingRewards', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'holdScore', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'totalHoldScoreLive', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalRewardPool', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'rewardIndex', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'antiSnipeBpsFor', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'pendingPlatformEth', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalReceivedByHolder', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdrawPendingPlatform',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
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
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    // event RewardsClaimed(address indexed user, uint256 ethAmount)
    name: 'RewardsClaimed',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'ethAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Graduated',
    type: 'event',
    inputs: [
      { name: 'pair', type: 'address', indexed: true },
    ],
  },
] as const;

export const CURVE_V2_ABI = [
  { name: 'realEthRaised', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'virtualTokenReserve', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'TOKEN_SUPPLY', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'TARGET_REAL_ETH', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'VIRTUAL_ETH', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'graduated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'forceClosed', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  // progressBps: bonding curve progress in basis points (0–10000)
  { name: 'progressBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'currentPrice', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getBuyAmount', type: 'function', stateMutability: 'view', inputs: [{ name: 'ethIn', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  // getSellAmount(tokenAmount, seller) — seller needed for anti-snipe tax calc
  { name: 'getSellAmount', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenAmount', type: 'uint256' }, { name: 'seller', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'lastBuyAt', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint64' }] },
  { name: 'token', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'factory', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
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
