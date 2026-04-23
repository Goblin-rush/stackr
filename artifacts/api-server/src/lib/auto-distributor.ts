/**
 * Auto-Distributor — cron job that runs every 5 minutes.
 *
 * For each V3 token registered in the DB:
 *  1. Computes the Uniswap V4 poolId from the token address.
 *  2. Reads accumulatedEthClaims[poolId] from StackrHookV3.
 *  3. If the accumulated amount exceeds DISTRIBUTE_THRESHOLD, calls
 *     distributeTax(key) on the hook contract.
 *
 * distributeTax is permissionless — anyone can call it.
 * The keeper wallet just pays gas; it doesn't hold any protocol funds.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  zeroAddress,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { db, tokenRecordsV3 } from '@workspace/db';
import { logger } from './logger';

// ─── Config ─────────────────────────────────────────────────────────────────

const HOOK_ADDRESS    = '0x7C96cAb69CC3599f8dDABEAbEa35E7D2128Cc0cc' as Address;
const POOL_FEE        = 3000;        // 0.3% Uniswap V4 LP fee
const TICK_SPACING    = 60;
const INTERVAL_MS     = 5 * 60_000; // 5 minutes

/** Only trigger distributeTax when pending rewards > this threshold (0.0001 ETH). */
const DISTRIBUTE_THRESHOLD = parseEther('0.0001');

// ─── Minimal ABIs ────────────────────────────────────────────────────────────

const HOOK_ABI = [
  {
    name: 'accumulatedEthClaims',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'distributeTax',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{
      name: 'key',
      type: 'tuple',
      components: [
        { name: 'currency0',   type: 'address' },
        { name: 'currency1',   type: 'address' },
        { name: 'fee',         type: 'uint24'  },
        { name: 'tickSpacing', type: 'int24'   },
        { name: 'hooks',       type: 'address' },
      ],
    }],
    outputs: [],
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computePoolId(tokenAddress: Address): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, uint24, int24, address'),
      [zeroAddress, tokenAddress, POOL_FEE, TICK_SPACING, HOOK_ADDRESS],
    ),
  );
}

function buildPoolKey(tokenAddress: Address) {
  return {
    currency0:   zeroAddress as Address,
    currency1:   tokenAddress,
    fee:         POOL_FEE,
    tickSpacing: TICK_SPACING,
    hooks:       HOOK_ADDRESS,
  };
}

function getClients() {
  const rpcUrl    = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
  const rawKey    = process.env.Private_key as Hex | undefined;

  if (!rawKey) throw new Error('Private_key env var not set — keeper cannot sign transactions');

  const account       = privateKeyToAccount(rawKey);
  const publicClient  = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const walletClient  = createWalletClient({ chain: base, transport: http(rpcUrl), account });

  return { publicClient, walletClient, account };
}

// ─── Core logic ──────────────────────────────────────────────────────────────

async function runOnce() {
  const { publicClient, walletClient } = getClients();

  // Load every registered V3 token from the DB.
  const tokens = await db.select({ address: tokenRecordsV3.address }).from(tokenRecordsV3);

  if (tokens.length === 0) return;

  for (const { address } of tokens) {
    const tokenAddress = address as Address;
    const poolId       = computePoolId(tokenAddress);

    let accumulated: bigint;
    try {
      accumulated = await publicClient.readContract({
        address: HOOK_ADDRESS,
        abi: HOOK_ABI,
        functionName: 'accumulatedEthClaims',
        args: [poolId],
      });
    } catch (err: any) {
      logger.warn({ token: tokenAddress, err: err?.message }, 'distributor: failed to read accumulatedEthClaims');
      continue;
    }

    if (accumulated < DISTRIBUTE_THRESHOLD) {
      logger.debug({ token: tokenAddress, accumulated: accumulated.toString() }, 'distributor: below threshold, skipping');
      continue;
    }

    logger.info({ token: tokenAddress, accumulated: accumulated.toString() }, 'distributor: calling distributeTax');

    try {
      const txHash = await walletClient.writeContract({
        address: HOOK_ADDRESS,
        abi: HOOK_ABI,
        functionName: 'distributeTax',
        args: [buildPoolKey(tokenAddress)],
      });
      logger.info({ token: tokenAddress, txHash }, 'distributor: distributeTax sent');

      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      logger.info({ token: tokenAddress, txHash }, 'distributor: distributeTax confirmed');
    } catch (err: any) {
      logger.error({ token: tokenAddress, err: err?.message }, 'distributor: distributeTax failed');
    }
  }
}

// ─── Exported starter ────────────────────────────────────────────────────────

let running = false;

export function startAutoDistributor() {
  const rawKey = process.env.Private_key;
  if (!rawKey) {
    logger.warn('distributor: Private_key not set — auto-distributor disabled');
    return;
  }

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } catch (err: any) {
      logger.error({ err: err?.message }, 'distributor: error');
    } finally {
      running = false;
    }
  };

  void tick();
  setInterval(tick, INTERVAL_MS);
  logger.info('distributor: started (5-min interval)');
}
