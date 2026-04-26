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

## Stackr V3 — Token Launchpad (ETH Mainnet) · Uniswap V4

### Deployed Contracts (ETH Mainnet, chain ID 1)
- **StackrHookV3**: `0x37d90eD6709A942dB0e4D76aAbCB7551c0bc40cC` — V4 hook, CREATE2-mined for `0xCC` flag mask, salt `0x...0396`, validateHookAddress() = `true`, funded with 0.005 ETH LP buffer
- **StackrFactoryV3**: `0xF957c94763eD1E8211A19C8a73C862dF45690AB1` — token factory, owner = deployer, wired to hook + Chainlink feed
- **Uniswap V4 PoolManager**: `0x000000000004444c5dc75cB358380D2e3dE08A90` (ETH mainnet)
- **Chainlink ETH/USD AggregatorV3**: `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` (ETH mainnet, 8 decimals)
- **Deployer EOA**: `0xaAd5f333dFBD6c5561C9D41E624A12069b337B46`
- *Stale Base mainnet addresses (no longer used): hook `0xe88D...00cc`, factory `0x77a2...7e73`*
- *Orphan ETH mainnet factory (deployed by accident on second run, NOT wired): `0x5A793060a8bec3B95C54C17916fF6B0eBE501019` — DO NOT USE*

### V3 Architecture (bankr.bot / Doppler-style — NO BONDING CURVE)
- Factory deploys Token (ERC20) + registers V4 pool immediately — no bonding curve
- `factory.getRecord(tokenAddress)` returns `{ token, creator, deployedAt, metadataURI, poolKey, sqrtPriceX96AtLaunch, ethUsdPriceAtLaunch }`
- All trades happen via Uniswap V4 PoolManager (pool key: ETH/token, fee=3000, tickSpacing=60)
- **Linear fee decay** on every swap (same fee for buys and sells):
  - t = 0s → 80.0% (`LAUNCH_FEE_BPS`)
  - linear interpolation 0–10s
  - t ≥ 10s → 3.0% (`STEADY_FEE_BPS`)
  - Computed by `currentFeeBps(poolId)` view on Hook
- **Fee split** (constant 50/50): rewards / platform
- **Anti-snipe REMOVED** — snipers pay the 80% launch fee themselves; that fee flows back to holders + platform
- **Dynamic $5K starting FDV via Chainlink** — every launch reads ETH/USD live and computes `sqrtPriceX96` so FDV is always exactly $5,000 USD regardless of ETH price.
  - `TARGET_USD_FDV = 5000` (immutable constant — deployer cannot override)
  - `getEthUsdPrice8()` reverts on negative answers, zero updates, or staleness > 1 hour
  - `computeLaunchSqrtPriceX96()` does the BigInt-safe sqrt math on-chain
- **MasterChef-style holder rewards** (time-weighting DROPPED — was source of CRITICAL audit finding):
  - `accRewardPerToken` accumulator increments on every hook deposit
  - `pendingEth[user] = balance × accRewardPerToken − rewardDebt[user]`
  - Settled BEFORE every transfer (`_update` override) and at `claim()`
  - `setHook(_hook, _poolManager)` auto-excludes BOTH addresses from `isExcluded` — prevents the 1B tokens parked in the V4 PoolManager from diluting holder rewards
  - Provably correct: `Σ pendingEth ≤ Σ deposited ETH` under any deposit cadence
- **Pull-only `claim()`** on token — no keeper, no `pushRewards`, no `setKeeper`
- **`withdrawLP()` retained** on factory for manual burn flow (owner withdraws → owner sends to 0xdead)
- **Hook flag check is strict** — `validateHookAddress()` enforces `(addr & 0xFF) == 0xCC` exactly (rejects extra V4 hook permission bits the contract does not implement)
- **No `updateFactory()` escape hatch** — factory wiring on hook is one-shot via `setFactory()`, immutable thereafter
- LP fee 0.3% goes to pool LP held by hook
- V3 event signatures:
  - `HookSet(address indexed hook, address indexed poolManager)` on Token
  - `AddressExcluded(address indexed addr)` on Token
  - `RewardsDeposited(uint256 ethAmount, uint256 newAccRewardPerToken)` on Token *(was `newCumulative`)*
  - `RewardsClaimed(address indexed user, uint256 ethAmount)` on Token
  - `PoolRegistered(bytes32 indexed poolId, address indexed token)` on Hook
  - `TaxCollected(bytes32 indexed poolId, bool isBuy, uint256 ethAmount, uint256 feeBps)` on Hook
  - `TaxDistributed(bytes32 indexed poolId, uint256 rewardEth, uint256 platformEth)` on Hook
  - `LPWithdrawn(bytes32 indexed poolId, address indexed to, uint256 ethReceived, uint256 tokensReceived)` on Hook
  - `TokenDeployed(address token, address creator, string name, string symbol, string metadataURI, uint160 sqrtPriceX96, uint256 ethUsdPrice8)` on Factory
  - `Swap(bytes32 indexed id, ...)` on PoolManager (V4 standard)
- `createToken(name, symbol, metadataURI)` — optional dev buy via `msg.value` (payable)
- Factory constructor signature: `constructor(IPoolManager _poolManager, StackrHookV3 _hook, AggregatorV3Interface _ethUsdFeed)` — verifies `_hook.poolManager() == _poolManager`
- Solc bumped to **0.8.26** with `evmVersion: cancun` (matches V4 transient-storage requirements)
- `auto-distributor.ts` retained but no longer started (claims now pull-only); permissionless `distributeTax(key)` remains on-chain

### ⚠️ Pending after this refactor
1. ~~Recompile contracts~~ ✓ DONE — Hardhat compiles 22 files clean (solc 0.8.26 / cancun)
2. ~~CREATE2-mine hook salt~~ ✓ DONE — salt `0x...0396` → hook `0x37d9...40cC`
3. ~~Deploy Hook → Factory → wire → fund~~ ✓ DONE — see addresses above
4. **Update frontend addresses** in `artifacts/launchpad/src/lib/contracts.ts` (also switch chain to mainnet, chain ID 1)
5. **Update frontend ABI + constants** to match new contract surface:
   - Replace `V3_BASE_TAX_BPS` constant with `V3_LAUNCH_FEE_BPS=8000`, `V3_STEADY_FEE_BPS=300`, `V3_FEE_DECAY_SECONDS=10`
   - Replace `getAntiSnipeStatus()` helper with `getCurrentFeeBps(poolLaunchTs)`
   - Update `TaxCollected` event sig: `antiSnipeBps` → `feeBps` in 3 hook files (`use-launchpad-feed.ts`, `use-global-trade-tape.ts`, `use-chain-token-live.ts`)
   - Replace token reward ABI: drop `checkpoints`, `cumulativeEthPerScore`, `lastRewardTimestamp`, `totalAccumulatedScore`, `totalSettledBalance`; add `accRewardPerToken`, `rewardDebt(address)`, `pendingEth(address)`, `totalEligibleSupply`
   - Update `TokenDeployed` ABI: add `sqrtPriceX96` and `ethUsdPrice8` fields
   - Add factory ABI: `getEthUsdPrice8()`, `computeLaunchSqrtPriceX96()`, `TARGET_USD_FDV`
   - Add `TokenRecord` extra fields: `sqrtPriceX96AtLaunch`, `ethUsdPriceAtLaunch`
   - Remove ABI entries: `antiSnipeBpsFor`, `lastBuyAt`, `pushRewards`, `setKeeper`, `updateHook`, `updateFactory`, `VIRTUAL_SQRT_PRICE_X96`
   - Add ABI entry: `currentFeeBps(bytes32)` view on Hook
   - Update `TradeWidget.tsx` to display live decaying fee instead of fixed 3%
- Trading: redirect to `https://app.uniswap.org/swap?chain=mainnet&outputCurrency={token}`
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
