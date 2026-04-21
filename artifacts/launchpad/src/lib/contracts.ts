export const FACTORY_ADDRESS = '0x58439e7474725725b9A934299bA503e7F0625894' as const;

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
