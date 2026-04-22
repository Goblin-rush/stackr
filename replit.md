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

## Aethpad V2 — Token Launchpad (Base Mainnet)

### Deployed Contracts (Base Mainnet)
- **Factory V2**: `0x2315896A0e8fd675235178e11D30567Dc6C6f0b8` — set in `VITE_FACTORY_V2_ADDRESS`
- **Deployer**: `0x3cAb46C265e365dab9F5D4a1b6ac5074aEdC0128`
- **Router**: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`

### V2 Architecture
- Factory deploys **two separate contracts**: Token (ERC20) + Curve (bonding curve AMM)
- `factory.getRecord(tokenAddress)` returns `{ creator, curve, createdAt, metadataURI }`
- **Buy/Sell/Graduated events are on the CURVE contract** (not the token)
- V2 event signatures:
  - `Buy(buyer, ethIn, ethForCurve, tokensOut, progressBps)` on Curve
  - `Sell(seller, tokensIn, ethOutGross, ethToUser, progressBps)` on Curve
  - `Graduated(ethToLp, tokensToLp, pair)` on Curve
  - `TokenDeployed(token, curve, creator, name, symbol, metadataURI, devBuyEth, devBuyTokens)` on Factory
- 5% ETH tax: 1.5% burn / 2% holder rewards (time-weighted hold score) / 1.5% platform
- Anti-snipe tiers: <5min +20%, <1hr +10%, <24hr +5% extra sell tax
- `createToken(name, symbol, metadataURI, { value: devBuyEth })` — dev buy in same tx
- `approve(curveAddress, amount)` on Token, then `sell(tokens, minEthOut)` on Curve

### Frontend (artifacts/launchpad)
- React + Vite + Tailwind v4 + wagmi + Privy + viem
- Chain: Base mainnet (chain ID 8453)
- Charts: `lightweight-charts` with OHLCV crosshair legend overlay (TradingView-style)
- All Etherscan links → Basescan links
- Key contracts in `artifacts/launchpad/src/lib/contracts.ts`

### API Server (artifacts/api-server)
- Express 5 + TypeScript + viem
- `GET /api/candles?curveAddress=0x...&interval=15m` — OHLCV REST endpoint
  - Fetches Buy/Sell events from Base via viem getLogs
  - Returns `{ candles: [{ time, open, high, low, close, volume, buyVolume, sellVolume }] }`
- `POST /api/upload` — Pinata IPFS image upload
- `GET/POST /api/tokens/metadata` — local metadata store (description, links, image)
