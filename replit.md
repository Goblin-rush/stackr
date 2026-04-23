# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Stackr V3 — Token Launchpad (Base Mainnet) · Uniswap V4

### Deployed Contracts (Base Mainnet)
- **StackrHookV3**: `0xe88D16864cAD90E9d6e0731D67a8946bc30700cc` — Uniswap V4 hook
- **StackrFactoryV3**: `0x77a29992f609A90d7d911B056145fF95Ca7e7e73` — token factory
- **Uniswap V4 PoolManager**: `0x498581ff718922c3f8e6a244956af099b2652b2b`
- **Deployer EOA**: `0xaAd5f333dFBD6c5561C9D41E624A12069b337B46`

### V3 Architecture (NO BONDING CURVE)
- Factory deploys Token (ERC20) + registers V4 pool immediately — no bonding curve
- `factory.getRecord(tokenAddress)` returns `{ token, creator, deployedAt, metadataURI, poolKey }`
- All trades happen via Uniswap V4 PoolManager (pool key: ETH/token, fee=3000, tickSpacing=60)
- Hook tax 3% on every swap: 1.5% holder rewards + 1.5% platform (100% anti-snipe to rewards)
- LP fee 0.3% goes to pool LP held by factory
- V3 event signatures:
  - `PoolRegistered(bytes32 indexed poolId, address indexed token)` on Hook
  - `TaxCollected(bytes32 indexed poolId, bool isBuy, uint256 ethAmount, uint256 antiSnipeBps)` on Hook
  - `TaxDistributed(bytes32 indexed poolId, uint256 rewardEth, uint256 platformEth)` on Hook
  - `LPWithdrawn(bytes32 indexed poolId, address indexed to, uint256 ethReceived, uint256 tokensReceived)` on Hook
  - `Swap(bytes32 indexed id, ...)` on PoolManager (V4 standard)
  - `TokenDeployed(address indexed token, address indexed creator, ...)` on Factory
- `createToken(name, symbol, metadataURI)` — no dev buy, no ETH value needed (nonpayable)
- Trading: redirect to `https://app.uniswap.org/swap?chain=base&outputCurrency={token}`
- PoolId = keccak256(abi.encode(ETH, token, 3000, 60, hookAddress))
- Price: `sqrtPriceX96ToEthPerToken()` from PoolManager.getSlot0(poolId)

### V3 Frontend (artifacts/launchpad)
- React + Vite + Tailwind v4 + wagmi + viem
- Chain: Base mainnet (chain ID 8453)
- TradeWidget: redirects to Uniswap V4 (no direct swap in app)
- Charts: simulated OHLCV with live Swap event ticks
- Admin: withdrawPlatformFees(to, amount) + withdrawLP(token, to)
- Key contracts in `artifacts/launchpad/src/lib/contracts.ts`

### V3 API Server (artifacts/api-server)
- Express 5 + TypeScript + viem
- `GET /api/candles?tokenAddress=0x...&interval=15m` — OHLCV REST endpoint
  - Fetches V4 PoolManager Swap events filtered by poolId from Base via viem getLogs
  - Returns `{ candles: [{ time, open, high, low, close, volume, buyVolume, sellVolume }] }`
- `POST /api/upload-image` — Pinata IPFS image upload (falls back to server JWT if client JWT missing)
- `GET /api/tokens/metadata` — bulk fetch all token metadata (address → metadata map)
- `GET /api/tokens/:address/metadata` — single token metadata
- `POST /api/tokens/:address/metadata` — create token metadata (once-write for all fields)
- `PATCH /api/tokens/:address/metadata` — update individual fields (used by creator to update image)
- `GET /api/tokens` — list all V3 tokens indexed from chain (from token_records_v3 DB table)
- `GET /api/healthz` — health check
- **Cron indexer** (`lib/indexer.ts`): runs every 60s, indexes `TokenDeployed` events from StackrFactoryV3
  - On first run backtracks 500k blocks (~11 days) for historical deployments
  - Progress tracked in `indexer_cursors` table; tokens stored in `token_records_v3` table

### DB Tables (Neon PostgreSQL via NEON_DATABASE_URL)
- `token_metadata` — per-token metadata (description, website, twitter, telegram, image)
- `token_records_v3` — on-chain indexed V3 tokens (address, creator, deployedAt, metadataURI, blockNumber)
- `indexer_cursors` — indexer progress cursors (lastBlock per cursor ID)
- `trades` — V2 trade history (legacy, not used in V3)
