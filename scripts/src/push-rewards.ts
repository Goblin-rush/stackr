/**
 * push-rewards.ts
 *
 * Keeper cron script — called hourly by GitHub Actions.
 *
 * For each token deployed by the factory:
 *   1. Ensures this wallet is set as the keeper (calls factory.setTokenKeeper if not).
 *   2. Discovers all unique holders via Transfer events from the token's deployment block.
 *   3. Filters holders with pendingRewards > 0.
 *   4. Calls token.pushRewards(batch) in groups of 150 (contract MAX_PUSH_BATCH).
 *
 * Required env vars:
 *   KEEPER_PRIVATE_KEY   — private key of the keeper wallet (funded with ETH on Base)
 *   FACTORY_V2_ADDRESS   — deployed factory address
 *   BASE_RPC_URL         — (optional) Base mainnet RPC, defaults to public node
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const FACTORY_ADDRESS = (process.env.FACTORY_V2_ADDRESS || '') as Address;
const RAW_KEY = process.env.KEEPER_PRIVATE_KEY || '';

if (!FACTORY_ADDRESS) throw new Error('FACTORY_V2_ADDRESS is required');
if (!RAW_KEY) throw new Error('KEEPER_PRIVATE_KEY is required');

const KEEPER_KEY = (RAW_KEY.startsWith('0x') ? RAW_KEY : `0x${RAW_KEY}`) as `0x${string}`;
const account = privateKeyToAccount(KEEPER_KEY);

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

const MAX_BATCH = 150;

const FACTORY_ABI = [
  { name: 'getAllTokens', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { name: 'getRecord', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenAddr', type: 'address' }], outputs: [{ type: 'tuple', components: [{ name: 'token', type: 'address' }, { name: 'curve', type: 'address' }, { name: 'creator', type: 'address' }, { name: 'deployedAt', type: 'uint256' }, { name: 'metadataURI', type: 'string' }, { name: 'initialDevBuyEth', type: 'uint256' }, { name: 'initialDevBuyTokens', type: 'uint256' }] }] },
  { name: 'setTokenKeeper', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenAddr', type: 'address' }, { name: 'newKeeper', type: 'address' }], outputs: [] },
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

const TOKEN_ABI = [
  { name: 'keeper', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'pendingRewards', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'pushRewards', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'holders', type: 'address[]' }], outputs: [] },
] as const;

const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

async function getHolders(tokenAddress: Address, fromBlock: bigint): Promise<Address[]> {
  const tip = await publicClient.getBlockNumber();
  const holders = new Set<string>();
  const STEP = 50_000n;

  for (let from = fromBlock; from <= tip; from += STEP) {
    const to = from + STEP - 1n > tip ? tip : from + STEP - 1n;
    try {
      const logs = await publicClient.getLogs({
        address: tokenAddress,
        event: TRANSFER_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const l of logs) {
        if (l.args.to && l.args.to !== '0x0000000000000000000000000000000000000000') {
          holders.add(l.args.to.toLowerCase());
        }
      }
    } catch {
      // Skip block range if RPC fails
    }
  }

  return Array.from(holders) as Address[];
}

async function processToken(tokenAddress: Address, deployedAtBlock: bigint): Promise<void> {
  const currentKeeper = await publicClient.readContract({
    address: tokenAddress,
    abi: TOKEN_ABI,
    functionName: 'keeper',
  }) as Address;

  if (currentKeeper.toLowerCase() !== account.address.toLowerCase()) {
    const factoryOwner = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'owner',
    }) as Address;

    if (factoryOwner.toLowerCase() === account.address.toLowerCase()) {
      console.log(`  Setting keeper on ${tokenAddress}...`);
      const hash = await walletClient.writeContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'setTokenKeeper',
        args: [tokenAddress, account.address],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  Keeper set: ${hash}`);
    } else {
      console.log(`  Skipping ${tokenAddress} — keeper is ${currentKeeper}, we are ${account.address}`);
      return;
    }
  }

  const holders = await getHolders(tokenAddress, deployedAtBlock);
  console.log(`  Found ${holders.length} unique holders`);
  if (holders.length === 0) return;

  const pending = await Promise.all(
    holders.map((h) =>
      publicClient.readContract({ address: tokenAddress, abi: TOKEN_ABI, functionName: 'pendingRewards', args: [h] })
        .then((v) => ({ address: h, pending: v as bigint }))
        .catch(() => ({ address: h, pending: 0n }))
    )
  );

  const eligible = pending.filter((h) => h.pending > 0n).map((h) => h.address);
  console.log(`  ${eligible.length} holders have pending rewards`);
  if (eligible.length === 0) return;

  for (let i = 0; i < eligible.length; i += MAX_BATCH) {
    const batch = eligible.slice(i, i + MAX_BATCH) as Address[];
    try {
      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: TOKEN_ABI,
        functionName: 'pushRewards',
        args: [batch],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  pushRewards batch ${Math.floor(i / MAX_BATCH) + 1}: ${hash}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  pushRewards batch failed: ${msg}`);
    }
  }
}

async function main() {
  console.log(`Keeper: ${account.address}`);
  console.log(`Factory: ${FACTORY_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}`);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${Number(balance) / 1e18} ETH`);

  const tokens = await publicClient.readContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'getAllTokens',
  }) as Address[];

  console.log(`\nTokens found: ${tokens.length}`);
  if (tokens.length === 0) {
    console.log('No tokens deployed yet.');
    return;
  }

  const currentBlock = await publicClient.getBlockNumber();

  for (const tokenAddress of tokens) {
    console.log(`\nProcessing ${tokenAddress}`);
    try {
      const record = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'getRecord',
        args: [tokenAddress],
      }) as { deployedAt: bigint };

      // Estimate deployment block from timestamp (Base ~2s per block)
      const now = BigInt(Math.floor(Date.now() / 1000));
      const secondsAgo = now - record.deployedAt;
      const blocksAgo = secondsAgo / 2n;
      const deployedBlock = currentBlock > blocksAgo ? currentBlock - blocksAgo : 0n;

      await processToken(tokenAddress, deployedBlock);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error processing ${tokenAddress}: ${msg}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
