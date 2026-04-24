import { keccak256, encodeAbiParameters, createPublicClient, http, type PublicClient } from 'viem';
import { base, mainnet } from 'viem/chains';

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

// ═══════════════════════════════════════════════════════════════════
//  STACKR V3 — Multi-chain, Uniswap V4 hook, no bonding curve
// ═══════════════════════════════════════════════════════════════════

// Base mainnet (chainId 8453)
export const HOOK_V3_ADDRESS    = '0x216f7C96Bcfd65a572b408D152D39945a00900cc' as `0x${string}`;
export const FACTORY_V3_ADDRESS = '0xc01e4b239eA7cF7abaB4A9ECbc03cc51a656C76f' as `0x${string}`;

// Ethereum mainnet (chainId 1)
export const ETH_HOOK_V3_ADDRESS    = '0x76F3624d08D120162377F9Ba195362293C2440cC' as `0x${string}`;
export const ETH_FACTORY_V3_ADDRESS = '0x6d9907040C25C0B3675bbAcef54a3c42710826E9' as `0x${string}`;

// Old V3 addresses (still deployed; LP withdrawal available via admin page)
export const OLD_HOOK_V3_ADDRESS    = '0x5965F3Ce0d494ecB339C9efa4e794846373F40cc' as `0x${string}`;
export const OLD_FACTORY_V3_ADDRESS = '0xe61CDb592851082a9Ab316937C9d1dD4550856C5' as `0x${string}`;

export interface V3Contracts {
  hookAddress:        `0x${string}`;
  factoryAddress:     `0x${string}`;
  poolManagerAddress: `0x${string}`;
  chainId:            number;
  explorerUrl:        string;
  chainName:          string;
  chainShort:         string;
  rpcUrl:             string;
  /** Extra token addresses to always show even if not in factory allTokens() */
  pinnedTokens:       readonly `0x${string}`[];
}

export const V3_CONTRACTS_BY_CHAIN: Record<number, V3Contracts> = {
  8453: {
    hookAddress:        HOOK_V3_ADDRESS,
    factoryAddress:     FACTORY_V3_ADDRESS,
    poolManagerAddress: '0x498581ff718922c3f8e6a244956af099b2652b2b' as `0x${string}`,
    chainId:            8453,
    explorerUrl:        'https://basescan.org',
    chainName:          'Base',
    chainShort:         'BASE',
    rpcUrl:             'https://mainnet.base.org',
    pinnedTokens:       [],
  },
  1: {
    hookAddress:        ETH_HOOK_V3_ADDRESS,
    factoryAddress:     ETH_FACTORY_V3_ADDRESS,
    poolManagerAddress: '0x000000000004444c5dc75cB358380D2e3dE08A90' as `0x${string}`,
    chainId:            1,
    explorerUrl:        'https://etherscan.io',
    chainName:          'Ethereum',
    chainShort:         'ETH',
    rpcUrl:             'https://eth.llamarpc.com',
    pinnedTokens:       ['0x8c8069e3a22724b7dfe61708845584d1846ac770'],
  },
};

/** Create a viem public client for a given supported chain — wallet-independent. */
export function createChainClient(chainId: number): PublicClient {
  const cfg = V3_CONTRACTS_BY_CHAIN[chainId] ?? V3_CONTRACTS_BY_CHAIN[8453];
  const viemChain = chainId === 1 ? mainnet : base;
  return createPublicClient({ chain: viemChain, transport: http(cfg.rpcUrl) }) as PublicClient;
}

export const SUPPORTED_CHAIN_IDS = [8453, 1] as const;

export function getV3Contracts(chainId: number): V3Contracts {
  return V3_CONTRACTS_BY_CHAIN[chainId] ?? V3_CONTRACTS_BY_CHAIN[8453];
}

// V3 fee structure
export const V3_BASE_TAX_BPS    = 300;  // 3% total swap tax
export const V3_REWARD_BPS      = 150;  // 1.5% to holder rewards
export const V3_PLATFORM_BPS    = 150;  // 1.5% to platform
export const V3_LP_FEE_BPS      = 30;   // 0.3% Uniswap V4 LP fee

export const V3_SNIPE_TIERS = [
  { upToSec: 5 * 60,    extraBps: 2000, label: '<5min'  },
  { upToSec: 60 * 60,   extraBps: 1000, label: '<1hr'   },
  { upToSec: 24 * 3600, extraBps: 500,  label: '<24hr'  },
] as const;

export const FACTORY_V3_ABI = [
  {
    name: 'createToken',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name',        type: 'string' },
      { name: 'symbol',      type: 'string' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [{ name: 'tokenAddr', type: 'address' }],
  },
  {
    name: 'getRecord',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'token',       type: 'address' },
          { name: 'creator',     type: 'address' },
          { name: 'deployedAt',  type: 'uint256' },
          { name: 'metadataURI', type: 'string'  },
          {
            name: 'poolKey',
            type: 'tuple',
            components: [
              { name: 'currency0',   type: 'address' },
              { name: 'currency1',   type: 'address' },
              { name: 'fee',         type: 'uint24'  },
              { name: 'tickSpacing', type: 'int24'   },
              { name: 'hooks',       type: 'address' },
            ],
          },
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
      { name: 'token',       type: 'address' },
      { name: 'creator',     type: 'address' },
      { name: 'deployedAt',  type: 'uint256' },
      { name: 'metadataURI', type: 'string'  },
    ],
  },
  {
    name: 'allTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'totalTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'hook',
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
    inputs: [
      { name: 'to',     type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'withdrawLP',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAddr', type: 'address' },
      { name: 'to',        type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'updateMetadata',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAddr', type: 'address' },
      { name: 'newURI',    type: 'string'  },
    ],
    outputs: [],
  },
  {
    name: 'distributeTax',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setKeeper',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAddr', type: 'address' },
      { name: 'keeper',    type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'TokenDeployed',
    type: 'event',
    inputs: [
      { name: 'token',       type: 'address', indexed: true  },
      { name: 'creator',     type: 'address', indexed: true  },
      { name: 'name',        type: 'string',  indexed: false },
      { name: 'symbol',      type: 'string',  indexed: false },
      { name: 'metadataURI', type: 'string',  indexed: false },
    ],
  },
  {
    name: 'MetadataUpdated',
    type: 'event',
    inputs: [
      { name: 'token',  type: 'address', indexed: true  },
      { name: 'newURI', type: 'string',  indexed: false },
    ],
  },
  {
    name: 'PlatformFeesWithdrawn',
    type: 'event',
    inputs: [
      { name: 'to',     type: 'address', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'LPWithdrawn',
    type: 'event',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'to',    type: 'address', indexed: true },
    ],
  },
] as const;

export const TOKEN_V3_ABI = [
  { name: 'name',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string'  }] },
  { name: 'symbol',      type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string'  }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'decimals',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8'   }] },
  { name: 'factory',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'tokenURI',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string'  }] },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
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

// ═══════════════════════════════════════════════════════════════════
//  UNISWAP V4 — Per-chain infrastructure (see V3_CONTRACTS_BY_CHAIN)
// ═══════════════════════════════════════════════════════════════════

// Default to Base (kept for backwards compatibility)
export const POOL_MANAGER_V4_ADDRESS = '0x498581ff718922c3f8e6a244956af099b2652b2b' as `0x${string}`;

export const POOL_MANAGER_V4_ABI = [
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96',  type: 'uint160' },
      { name: 'tick',          type: 'int24'   },
      { name: 'protocolFee',   type: 'uint24'  },
      { name: 'lpFee',         type: 'uint24'  },
    ],
  },
  {
    name: 'Swap',
    type: 'event',
    inputs: [
      { name: 'id',           type: 'bytes32', indexed: true  },
      { name: 'sender',       type: 'address', indexed: true  },
      { name: 'amount0',      type: 'int128',  indexed: false },
      { name: 'amount1',      type: 'int128',  indexed: false },
      { name: 'sqrtPriceX96', type: 'uint160', indexed: false },
      { name: 'liquidity',    type: 'uint128', indexed: false },
      { name: 'tick',         type: 'int24',   indexed: false },
      { name: 'fee',          type: 'uint24',  indexed: false },
    ],
  },
] as const;

export const HOOK_V3_ABI = [
  {
    name: 'PoolRegistered',
    type: 'event',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true  },
      { name: 'token',  type: 'address', indexed: true  },
    ],
  },
  {
    name: 'TaxCollected',
    type: 'event',
    inputs: [
      { name: 'poolId',       type: 'bytes32', indexed: true  },
      { name: 'isBuy',        type: 'bool',    indexed: false },
      { name: 'ethAmount',    type: 'uint256', indexed: false },
      { name: 'antiSnipeBps', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'TaxDistributed',
    type: 'event',
    inputs: [
      { name: 'poolId',      type: 'bytes32', indexed: true  },
      { name: 'rewardEth',   type: 'uint256', indexed: false },
      { name: 'platformEth', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'LPWithdrawn',
    type: 'event',
    inputs: [
      { name: 'poolId',       type: 'bytes32', indexed: true  },
      { name: 'to',           type: 'address', indexed: true  },
      { name: 'ethReceived',  type: 'uint256', indexed: false },
      { name: 'tokensReceived', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BuyExecuted',
    type: 'event',
    inputs: [
      { name: 'poolId',     type: 'bytes32', indexed: true  },
      { name: 'buyer',      type: 'address', indexed: true  },
      { name: 'ethIn',      type: 'uint256', indexed: false },
      { name: 'tokensOut',  type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'SellExecuted',
    type: 'event',
    inputs: [
      { name: 'poolId',     type: 'bytes32', indexed: true  },
      { name: 'seller',     type: 'address', indexed: true  },
      { name: 'tokensIn',   type: 'uint256', indexed: false },
      { name: 'ethOut',     type: 'uint256', indexed: false },
    ],
  },
  // ── Public buy: send ETH, receive tokens ─────────────────────────
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0',   type: 'address' },
          { name: 'currency1',   type: 'address' },
          { name: 'fee',         type: 'uint24'  },
          { name: 'tickSpacing', type: 'int24'   },
          { name: 'hooks',       type: 'address' },
        ],
      },
    ],
    outputs: [],
  },
  // ── Public sell: approve + send tokens, receive ETH ──────────────
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0',   type: 'address' },
          { name: 'currency1',   type: 'address' },
          { name: 'fee',         type: 'uint24'  },
          { name: 'tickSpacing', type: 'int24'   },
          { name: 'hooks',       type: 'address' },
        ],
      },
      { name: 'tokenAmount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

// V4 pool key constants (values used in PoolKey struct, not in bps)
export const V3_POOL_FEE       = 3000; // 0.30% in Uniswap V4 fee units (1/1000000)
export const V3_TICK_SPACING   = 60;

/**
 * Compute the V4 PoolId (bytes32) for a given token address.
 * PoolId = keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
 * where currency0 = address(0) (ETH), currency1 = token, fee=3000, tickSpacing=60.
 *
 * @param tokenAddress  - The ERC-20 token address.
 * @param hookAddress   - The hook address for this chain (defaults to Base hook).
 */
export function computePoolId(
  tokenAddress: `0x${string}`,
  hookAddress: `0x${string}` = HOOK_V3_ADDRESS,
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24'  },
        { type: 'int24'   },
        { type: 'address' },
      ],
      [
        '0x0000000000000000000000000000000000000000' as `0x${string}`,
        tokenAddress,
        V3_POOL_FEE,
        V3_TICK_SPACING,
        hookAddress,
      ]
    )
  );
}

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
