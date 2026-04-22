# Aethpad v2 — How It Works

FIRE-inspired token launchpad on Base. Fair launch, bonding curve, auto-graduation to Uniswap V2 with burned LP. Built to fix what V1 broke.

---

## 1. Token Lifecycle

```
  CREATE  →  BONDING CURVE  →  GRADUATION  →  DEX (Uniswap V2)
  (anyone)   (5 ETH target)    (auto, on-chain)  (LP burned)
```

1. **Create** — Anyone deploys a token via `AethpadFactoryV2`. Fixed 1B supply, no premint to creator.
2. **Bonding curve** — Buyers and sellers trade against the curve until it raises **5 ETH real** (3 ETH virtual reserve makes the early curve gentler).
3. **Graduation** — When the target hits, the contract automatically:
   - Pulls liquidity off the curve
   - Pairs remaining tokens + raised ETH on Uniswap V2
   - **Burns the LP tokens** (sent to `0xdead`) — liquidity locked forever
   - Emits `Graduated(ethRaised)`
4. **DEX trading** — Token is now a normal ERC-20. Curve closes.

---

## 2. Tax (5% on every curve trade)

Every buy and sell on the bonding curve takes a flat **5%** ETH-side tax, split:

| Bucket    | Share | Where it goes                              |
|-----------|-------|--------------------------------------------|
| Burn      | 1.5%  | Tokens bought from curve and sent to `0xdead` |
| Holders   | 2.0%  | Pro-rata to time-weighted holders (see §4) |
| Platform  | 1.5%  | Aethpad treasury                            |
| Creator   | 0.0%  | **Zero.** No creator skim.                  |

> Constants live in `artifacts/launchpad/src/lib/contracts.ts` (`V2_BURN_BPS`, `V2_REWARD_BPS`, `V2_PLATFORM_BPS`).

---

## 3. Anti-Snipe Tiers

To punish snipers and protect organic buyers, **sells** carry an extra tax based on how long ago you bought:

| Time since first buy | Extra sell tax |
|----------------------|---------------|
| < 5 minutes          | +20%          |
| < 1 hour             | +10%          |
| < 24 hours           | +5%           |
| ≥ 24 hours           | 0%            |

The extra tax is added to the standard 5%. The penalty portion is routed to the holder rewards pool, so diamond hands are paid by paper hands.

---

## 4. Time-Weighted Holder Rewards

Standard "% of supply" reward systems get gamed by snipers. We weight by **token-seconds held**:

- Every holder accrues `balance × time_held` continuously.
- The 2% holder share of every trade tax goes into a reward pool.
- Pool is distributed pro-rata to accrued token-seconds.
- Selling resets your weight on the sold portion.

Net effect: you earn more by holding longer with a larger position. Sniping and dumping earns you nothing.

---

## 5. Bonding Curve Math

Constant-product curve with virtual reserves:

```
k = (VIRTUAL_ETH + raisedETH) × tokensRemaining
```

- `VIRTUAL_ETH = 3 ETH` — softens the early curve so the first buyer doesn't get an absurd discount, and the last buyer doesn't pay a vertical price.
- `TARGET_REAL_ETH = 5 ETH` — graduation trigger.
- `TOTAL_SUPPLY = 1,000,000,000` — fixed.

Price discovery is fully on-chain. No oracle, no admin price setting.

---

## 6. Contracts

Located in `contracts/contracts/v2/`:

| Contract                  | Role                                           |
|---------------------------|------------------------------------------------|
| `AethpadFactoryV2.sol`    | Deploys new tokens + curves. Single entry point. |
| `AethpadTokenV2.sol`      | ERC-20 with reward accrual hooks.              |
| `AethpadBondingCurveV2.sol` | Holds reserves, executes buy/sell, taxes, graduates. |
| `AethpadDeployer.sol`     | Helper for atomic deploy + dev-buy.            |

**Tests:** `contracts/test/aethpadV2.test.js` — 20 Hardhat tests, all passing.

**Deploy:** Set `PRIVATE_KEY` env var, then `cd contracts && npx hardhat run scripts/deploy-v2.js --network base`. The deployed factory address must be set as `VITE_FACTORY_V2_ADDRESS` for the frontend to wire up.

---

## 7. Frontend

Monorepo: `pnpm` workspaces.

| Artifact                   | Role                                |
|----------------------------|-------------------------------------|
| `artifacts/launchpad`      | Public web app (React + Vite + wagmi/Privy) |
| `artifacts/api-server`     | Indexer / metadata API              |
| `artifacts/mockup-sandbox` | Canvas component previews           |

**Key routes:**
- `/` — token feed (featured "Top Mover" + activity ticker + classified-style rows)
- `/token/:address` — live token detail (curve progress, candle chart, trades, buy/sell)
- `/demo/:symbol` — mock detail page used while V2 is unfunded
- `/dashboard` — user holdings + pending rewards
- `/new` — create a token

**Design system:** Editorial Paper palette — cream `#F2EEE5`, vermillion `#D63A1F`, JetBrains Mono, zero radius, 2px hairlines. Forest green `#1f6b3e` only for buy semantics.

---

## 8. What's Different vs. V1

| Concern              | V1                          | V2                                  |
|----------------------|-----------------------------|-------------------------------------|
| Creator tax          | Yes (rugpull vector)        | **0%**                              |
| LP after graduation  | Held by deployer            | **Burned to `0xdead`**              |
| Sniper protection    | None                        | **Tiered sell tax (20/10/5%)**      |
| Holder incentive     | Flat % of supply            | **Time-weighted token-seconds**     |
| Graduation           | Manual / admin              | **Automatic on-chain at 5 ETH**     |
| Visual identity      | Generic "degen" UI          | Editorial paper, brutalist          |

---

## 9. Status

- ✅ Contracts written, 20 tests passing
- ✅ Frontend redesigned (Editorial Paper, hierarchy, activity)
- ✅ Demo pages live for all 5 mock tokens
- ⏳ Mainnet deploy pending `PRIVATE_KEY` env var
- ⏳ Once factory deployed, set `VITE_FACTORY_V2_ADDRESS` and the demo data steps aside for real tokens
