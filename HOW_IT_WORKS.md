# How It Works

A fair-launch token protocol. Bonding curve → automatic graduation to a DEX with permanently burned LP. Designed to neutralize the three things that ruin most launchpads: creator rugs, sniper extraction, and dead liquidity.

---

## 1. Token Lifecycle

```
  CREATE  →  BONDING CURVE  →  GRADUATION  →  UNISWAP V2
  (anyone)   (5 ETH target)    (auto, on-chain)  (LP burned forever)
```

1. **Create:** Anyone deploys a token through the factory. Fixed 1B supply. **No premint to the creator.**
2. **Bonding curve:** Buyers and sellers trade against the curve until it raises **5 ETH real** (a 3 ETH virtual reserve smooths the early curve so the first buyer doesn't get an absurd discount).
3. **Graduation:** When the target hits, the contract automatically:
   - Closes the curve
   - Pairs remaining tokens + raised ETH on a DEX
   - **Burns the LP tokens** (sent to `0xdead`): liquidity locked permanently
   - Emits a `Graduated` event
4. **DEX trading:** The token becomes a normal ERC-20. The curve is closed forever.

---

## 2. Tax (5% on every curve trade)

Every buy and sell on the bonding curve takes a flat **5%** ETH-side tax, split:

| Bucket    | Share | Where it goes                                    |
|-----------|-------|--------------------------------------------------|
| Burn      | 1.5%  | Tokens bought from the curve and sent to `0xdead` |
| Holders   | 2.0%  | Pro-rata to time-weighted holders (see §4)       |
| Platform  | 1.5%  | Protocol treasury                                |
| Creator   | 0.0%  | **Zero. No creator skim, ever.**                 |

---

## 3. Anti-Snipe Tiers

To punish snipers and protect organic buyers, **sells** carry an extra tax based on how long ago the wallet first bought:

| Time since first buy | Extra sell tax |
|----------------------|---------------|
| < 5 minutes          | +20%          |
| < 1 hour             | +10%          |
| < 24 hours           | +5%           |
| ≥ 24 hours           | 0%            |

The penalty is added on top of the standard 5%. The extra portion is routed to the holder rewards pool: so diamond hands are paid by paper hands.

---

## 4. Time-Weighted Holder Rewards

Standard "% of supply" reward systems get gamed by snipers who hold for one block. This protocol weights by **token-seconds held**:

- Every holder accrues `balance × time_held` continuously.
- The 2% holder share of every trade tax goes into a reward pool.
- The pool is distributed pro-rata to accrued token-seconds.
- Selling resets the weight on the sold portion.

Net effect: you earn more by holding longer with a larger position. Sniping and dumping earns you nothing.

---

## 5. Bonding Curve Math

Constant-product curve with virtual reserves:

```
k = (VIRTUAL_ETH + raisedETH) × tokensRemaining
```

| Parameter        | Value           | Purpose                                      |
|------------------|-----------------|----------------------------------------------|
| `VIRTUAL_ETH`    | 3 ETH           | Softens early curve, prevents vertical price tail |
| `TARGET_REAL_ETH`| 5 ETH           | Graduation trigger                           |
| `TOTAL_SUPPLY`   | 1,000,000,000   | Fixed forever                                |

Price discovery is fully on-chain. No oracle, no admin price setting, no upgrade proxies on the curve.

---

## 6. What This Fixes

| Failure mode in most launchpads | This protocol                          |
|---------------------------------|----------------------------------------|
| Creator tax (rugpull vector)    | **0% creator tax**                     |
| LP held by deployer post-graduation | **LP burned to `0xdead`**          |
| Snipers extract early, dump on retail | **20% / 10% / 5% tiered sell tax** |
| Flat reward % gameable by 1-block holders | **Time-weighted token-seconds**  |
| Manual / admin graduation       | **Automatic on-chain at 5 ETH**        |

---

## 7. Trust Model

- All contracts non-upgradeable.
- LP burn is unconditional and immediate at graduation: verifiable on-chain.
- No admin function can pause trading, change tax, or seize tokens.
- Treasury (1.5%) is the only privileged address and only receives ETH; it cannot touch user balances or the curve.
