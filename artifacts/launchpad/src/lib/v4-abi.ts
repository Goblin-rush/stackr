// V4 Contract ABIs — bonding-curve launchpad
// Factory: see ETH_FACTORY_V4_ADDRESS in lib/contracts.ts

export const V4_FACTORY_ABI = [
  {
    name: 'deployToken',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
    ],
  },
  {
    name: 'deployTokenWithBuy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'metadataURI', type: 'string' },
      { name: 'minTokensOut', type: 'uint256' },
    ],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
      { name: 'tokensBought', type: 'uint256' },
    ],
  },
  {
    name: 'cancelLaunch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [],
  },
  {
    name: 'withdrawCurveEth',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAddr', type: 'address' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'withdrawCurveTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAddr', type: 'address' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'withdrawLP',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAddr', type: 'address' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'getAllTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    name: 'tokenCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
          { name: 'token', type: 'address' },
          { name: 'curve', type: 'address' },
          { name: 'creator', type: 'address' },
          { name: 'deployedAt', type: 'uint64' },
          { name: 'launchEthUsd8', type: 'uint64' },
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
    name: 'ethUsdPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // Events
  {
    type: 'event',
    name: 'TokenDeployed',
    inputs: [
      { indexed: true, name: 'token', type: 'address' },
      { indexed: true, name: 'curve', type: 'address' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'symbol', type: 'string' },
      { indexed: false, name: 'metadataURI', type: 'string' },
      { indexed: false, name: 'ethUsdPrice8', type: 'uint256' },
      { indexed: false, name: 'virtualEthReserve', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'DevBuy',
    inputs: [
      { indexed: true, name: 'token', type: 'address' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'ethIn', type: 'uint256' },
      { indexed: false, name: 'tokensOut', type: 'uint256' },
    ],
  },
] as const;

export const V4_CURVE_ABI = [
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
    name: 'claimCreatorFees',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
  {
    name: 'quoteBuy',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'ethIn', type: 'uint256' }],
    outputs: [
      { name: 'tokensOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    name: 'quoteSell',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAmount', type: 'uint256' }],
    outputs: [
      { name: 'ethOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    name: 'getCurveState',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'realEth', type: 'uint256' },
      { name: 'tokensSold', type: 'uint256' },
      { name: 'currentPriceWeiPerToken', type: 'uint256' },
      { name: 'percentBondedBps', type: 'uint256' },
      { name: 'graduated', type: 'bool' },
      { name: 'cancelled', type: 'bool' },
    ],
  },
  { name: 'creator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'creatorFeesAccrued', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'realEthCollected', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'tokensSold', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'graduated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'cancelled', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'v2Pair', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'virtualEthReserve', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'launchEthUsd', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

export const V4_TOKEN_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'metadataURI', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'who', type: 'address' }],
    outputs: [{ type: 'uint256' }],
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
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;
