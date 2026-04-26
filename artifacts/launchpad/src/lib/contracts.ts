
// Tokens hidden from public feed and global trade tape (e.g. dev/test tokens).
// Lowercase addresses only.
export const HIDDEN_TOKENS: ReadonlySet<string> = new Set([
  '0x49adaeb41d12cb01de7dbd93ad2798e392fde4b2', // duplicate AETH (hidden)
  '0x5e4143663e9525d32e9863e646e8ab6c429a8e4e', // Test (dev test token)
  '0xe56f88d278fc312cf4a4734d72adb7e3b97ddd67', // Last test (dev test token)
  '0xec1c2f9638471a8123889371d51f4e0052cada11', // 1more (dev test token)
  '0x9a50755b3df55429f7c1f33b50c93b0c0238659e', // Last (dev test token)
  // V4 factory test tokens
  '0xa3b9648cf0cf4c6b5ea2c2f3f56a339ffa62f771',
  '0xcf9467c2ffb6a9449b9ae5d44c5748cf0681b5e5',
  '0x8fab3c308e641402e53d39aa4f7abfa7f633fa34',
  '0x8c8069e3a22724b7dfe61708845584d1846ac770', // Old ETH STACKR V1 (no V4 pool)
  '0x39205a4c372fec91b18613c945d09c4b0f4aeea7', // Old ETH STACKR V4 (replaced by V2 tax token)
  '0x5115b090c81958e7bbc59fdea814d7b1de5df9a9', // Mistakenly deployed ETH STACKR V4 (hidden)
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
    name: 'setTokenKeeper',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAddr', type: 'address' },
      { name: 'newKeeper', type: 'address' },
    ],
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
  { name: 'keeper', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'pushRewards',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'holders', type: 'address[]' }],
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

// ═════════════════════════════════════════════════════════════
//  V4 — Pump.fun-style bonding curve → graduate to Uniswap V2
//  Mainnet only. $5K starting FDV via Chainlink, 2.75 ETH bond.
//  800M curve / 200M LP reserve. 1% trade fee → token creator.
//  All LP/ETH withdrawals → factory owner only.
// ═════════════════════════════════════════════════════════════
export const ETH_FACTORY_V4_ADDRESS = '0xCd2eF35fbe85460dbc4cb549945fd119d17F03D1' as `0x${string}`;
export const V4_BOND_THRESHOLD_WEI  = 2750000000000000000n; // 2.75 ETH
export const V4_CURVE_TOKEN_SUPPLY  = 800_000_000n * (10n ** 18n);
export const V4_LP_RESERVE_TOKENS   = 200_000_000n * (10n ** 18n);
export const V4_FEE_BPS             = 100; // 1%

export const SUPPORTED_CHAIN_IDS = [1] as const;


/**
 * Convert a V4 sqrtPriceX96 to ETH-per-token price.
 * sqrtPriceX96 = sqrt(token_per_ETH) * 2^96
 * ETH_per_token = 1 / (sqrtPriceX96 / 2^96)^2
 */
export function sqrtPriceX96ToEthPerToken(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  const Q96 = 2 ** 96;
  const sqrtRatio = Number(sqrtPriceX96) / Q96;
  const tokenPerEth = sqrtRatio * sqrtRatio;
  return tokenPerEth === 0 ? 0 : 1 / tokenPerEth;
}

// ═══════════════════════════════════════════════════════════════════
//  STACKR V2 TAX TOKEN — ETH Mainnet (manually deployed, not factory)
//  3% buy/sell tax: 1.5% platform + 1.5% rewards, built into transfer
// ═══════════════════════════════════════════════════════════════════

export const ETH_STACKR_V2_TOKEN   = '0xd059d47a5663ac796cc1f7d000c01501e6ca1951' as `0x${string}`;
export const ETH_STACKR_V2_PAIR    = '0xc8cFd687a2b8D23E35F87E1a1edbDFd78a5CE3f7' as `0x${string}`;
export const UNISWAP_V2_ROUTER     = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as `0x${string}`;
export const UNISWAP_V2_FACTORY    = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as `0x${string}`;
export const ETH_STACKR_V2_CHAIN   = 1;

/** Returns true if the address is the ETH mainnet StackrV2 tax token */
export function isStackrV2Token(address: string): boolean {
  return address.toLowerCase() === ETH_STACKR_V2_TOKEN.toLowerCase();
}

export const STACKR_V2_TOKEN_ABI = [
  { name: 'name',           type: 'function', stateMutability: 'view',        inputs: [],                                                                         outputs: [{ type: 'string'  }] },
  { name: 'symbol',         type: 'function', stateMutability: 'view',        inputs: [],                                                                         outputs: [{ type: 'string'  }] },
  { name: 'decimals',       type: 'function', stateMutability: 'view',        inputs: [],                                                                         outputs: [{ type: 'uint8'   }] },
  { name: 'totalSupply',    type: 'function', stateMutability: 'view',        inputs: [],                                                                         outputs: [{ type: 'uint256' }] },
  { name: 'taxBps',         type: 'function', stateMutability: 'view',        inputs: [],                                                                         outputs: [{ type: 'uint256' }] },
  { name: 'platformWallet', type: 'function', stateMutability: 'view',        inputs: [],                                                                         outputs: [{ type: 'address' }] },
  { name: 'rewardsWallet',  type: 'function', stateMutability: 'view',        inputs: [],                                                                         outputs: [{ type: 'address' }] },
  { name: 'uniswapV2Pair',  type: 'function', stateMutability: 'view',        inputs: [],                                                                         outputs: [{ type: 'address' }] },
  { name: 'owner',          type: 'function', stateMutability: 'view',        inputs: [],                                                                         outputs: [{ type: 'address' }] },
  { name: 'balanceOf',      type: 'function', stateMutability: 'view',        inputs: [{ name: 'a',   type: 'address'  }],                                        outputs: [{ type: 'uint256' }] },
  { name: 'allowance',      type: 'function', stateMutability: 'view',        inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve',        type: 'function', stateMutability: 'nonpayable',  inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool'    }] },
  { name: 'transfer',       type: 'function', stateMutability: 'nonpayable',  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],      outputs: [{ type: 'bool'    }] },
  { name: 'setPair',        type: 'function', stateMutability: 'nonpayable',  inputs: [{ name: 'pair', type: 'address'  }],                                        outputs: [] },
  { name: 'setTax',         type: 'function', stateMutability: 'nonpayable',  inputs: [{ name: 'bps',  type: 'uint256'  }],                                        outputs: [] },
  { name: 'setWallets',     type: 'function', stateMutability: 'nonpayable',  inputs: [{ name: 'p',    type: 'address'  }, { name: 'r', type: 'address' }],        outputs: [] },
  { name: 'renounceOwnership', type: 'function', stateMutability: 'nonpayable', inputs: [],                                                                        outputs: [] },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from',  type: 'address', indexed: true  },
      { name: 'to',    type: 'address', indexed: true  },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const UNISWAP_V2_PAIR_ABI = [
  { name: 'token0',     type: 'function', stateMutability: 'view', inputs: [],                                                                 outputs: [{ type: 'address' }] },
  { name: 'token1',     type: 'function', stateMutability: 'view', inputs: [],                                                                 outputs: [{ type: 'address' }] },
  { name: 'getReserves',type: 'function', stateMutability: 'view', inputs: [],                                                                 outputs: [{ name: 'reserve0', type: 'uint112' }, { name: 'reserve1', type: 'uint112' }, { name: 'blockTimestampLast', type: 'uint32' }] },
  { name: 'totalSupply',type: 'function', stateMutability: 'view', inputs: [],                                                                 outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf',  type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }],                              outputs: [{ type: 'uint256' }] },
] as const;
