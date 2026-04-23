/**
 * deployV3.js
 *
 * Deploys the Stackr V3 contracts on Base mainnet (or Base Sepolia for testing).
 *
 * Deployment order:
 *   1. Mine CREATE2 salt so hook lands at address with flags 0xCC  (cached to minedSalt.json)
 *   2. Deploy StackrHookV3 via Nick's CREATE2 factory using mined salt
 *   3. Deploy StackrFactoryV3 pointing at the hook address
 *   4. Call hook.setFactory(factoryAddress) to wire them together
 *   5. Verify hook flags on-chain
 *
 * Required env:
 *   Private_key  — deployer private key (with or without 0x prefix)
 *
 * Usage:
 *   npx hardhat run scripts/deployV3.js --network base
 *   npx hardhat run scripts/deployV3.js --network baseSepolia
 */

const { ethers, network } = require("hardhat");
const { existsSync, readFileSync, writeFileSync } = require("fs");

// Nick's deterministic CREATE2 factory (same address on all EVM chains)
const NICKS_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

const POOL_MANAGERS = {
  mainnet:     "0x000000000004444c5dc75cB358380D2e3dE08A90",
  base:        "0x498581ff718922c3f8e6a244956af099b2652b2b",
  baseSepolia: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
};

// Required: lowest 14 bits of hook address == 0x00CC
// (flags: BEFORE_SWAP, AFTER_SWAP, BEFORE_SWAP_RETURNS_DELTA, AFTER_SWAP_RETURNS_DELTA)
const REQUIRED_FLAGS = 0xCCn;
const FLAG_MASK      = 0x3FFFn; // bottom 14 bits

const GAS_BY_NETWORK = {
  mainnet:     { maxFeePerGas: ethers.parseUnits("3", "gwei"), maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei") },
  base:        { maxFeePerGas: ethers.parseUnits("0.15", "gwei"), maxPriorityFeePerGas: ethers.parseUnits("0.01", "gwei") },
  baseSepolia: { maxFeePerGas: ethers.parseUnits("0.15", "gwei"), maxPriorityFeePerGas: ethers.parseUnits("0.01", "gwei") },
};

// ─── Salt miner ────────────────────────────────────────────────────────────

async function mineSalt(HookFactory, poolManager, deployerAddr, netName) {
  const saltFile = `./scripts/minedSalt-${netName}.json`;

  if (existsSync(saltFile)) {
    const cached = JSON.parse(readFileSync(saltFile, "utf8"));
    // Sanity-check the cached result still matches the current initcode
    const initCodeHash = computeInitCodeHash(HookFactory, poolManager, deployerAddr);
    const verify = ethers.getCreate2Address(NICKS_FACTORY, cached.salt, initCodeHash);
    if (verify.toLowerCase() === cached.hookAddress.toLowerCase()) {
      console.log("Using cached salt from minedSalt.json");
      console.log("  Salt        :", cached.salt);
      console.log("  Hook address:", cached.hookAddress);
      return cached;
    }
    console.log("Cached salt no longer valid (bytecode changed?), re-mining...");
  }

  const initCodeHash = computeInitCodeHash(HookFactory, poolManager, deployerAddr);
  console.log("Mining CREATE2 salt for hook flags 0x00CC ...");

  let salt = 0n;
  while (true) {
    const saltHex = "0x" + salt.toString(16).padStart(64, "0");
    const addr    = ethers.getCreate2Address(NICKS_FACTORY, saltHex, initCodeHash);
    if ((BigInt(addr) & FLAG_MASK) === REQUIRED_FLAGS) {
      const result = { salt: saltHex, hookAddress: addr };
      writeFileSync(saltFile, JSON.stringify(result, null, 2));
      console.log("\n  Found!");
      console.log("  Salt        :", saltHex);
      console.log("  Hook address:", addr);
      return result;
    }
    salt++;
    if (salt % 100_000n === 0n) {
      process.stdout.write(`\r  Tried ${salt.toLocaleString()} salts...`);
    }
  }
}

function computeInitCodeHash(HookFactory, poolManager, deployerAddr) {
  const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address"],
    [poolManager, deployerAddr]
  );
  const initCode = ethers.concat([HookFactory.bytecode, encodedArgs]);
  return ethers.keccak256(initCode);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  const netName    = network.name;
  const poolMgr    = POOL_MANAGERS[netName];

  if (!poolMgr) throw new Error(`No PoolManager configured for network: ${netName}`);

  console.log("=".repeat(60));
  console.log("Stackr V3 Deploy");
  console.log("=".repeat(60));
  console.log("Network    :", netName);
  console.log("Deployer   :", deployer.address);
  console.log("Balance    :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("PoolManager:", poolMgr);

  const GAS = GAS_BY_NETWORK[netName] || GAS_BY_NETWORK.base;

  const HookFactory    = await ethers.getContractFactory("StackrHookV3");
  const FactoryFactory = await ethers.getContractFactory("StackrFactoryV3");

  // ── 1. Mine / load salt ────────────────────────────────────────────────────
  const { salt, hookAddress } = await mineSalt(HookFactory, poolMgr, deployer.address, netName);

  // Verify flags before spending gas
  const addrFlags = BigInt(hookAddress) & FLAG_MASK;
  if (addrFlags !== REQUIRED_FLAGS) {
    throw new Error(`Salt produced wrong flags: 0x${addrFlags.toString(16)} != 0xCC`);
  }

  // ── 2. Deploy hook via Nick's CREATE2 factory ─────────────────────────────
  const existingCode = await ethers.provider.getCode(hookAddress);
  if (existingCode !== "0x") {
    console.log("\nHook already deployed at", hookAddress, "(skipping)");
  } else {
    console.log("\nDeploying StackrHookV3 via CREATE2 ...");
    const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address"],
      [poolMgr, deployer.address]
    );
    const initCode   = ethers.concat([HookFactory.bytecode, encodedArgs]);
    const deployData = ethers.concat([salt, initCode]);

    const tx = await deployer.sendTransaction({ to: NICKS_FACTORY, data: deployData, ...GAS });
    console.log("  tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("  gas used:", receipt.gasUsed.toString());

    const code = await ethers.provider.getCode(hookAddress);
    if (code === "0x") throw new Error("Hook deploy failed — no code at predicted address");
    console.log("  Hook deployed:", hookAddress);
  }

  const hook = HookFactory.attach(hookAddress);

  // ── 3. Deploy StackrFactoryV3 ─────────────────────────────────────────────
  console.log("\nDeploying StackrFactoryV3 ...");
  const factory = await FactoryFactory.deploy(poolMgr, hookAddress, { ...GAS });
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("  Factory deployed:", factoryAddress);

  // ── 4. Wire hook → factory ─────────────────────────────────────────────────
  console.log("\nCalling hook.setFactory(factoryAddress) ...");
  const currentFactory = await hook.factory();
  if (currentFactory.toLowerCase() === factoryAddress.toLowerCase()) {
    console.log("  Factory already set (skipping)");
  } else if (currentFactory !== ethers.ZeroAddress) {
    throw new Error(`hook.factory() already set to different address: ${currentFactory}`);
  } else {
    const setTx = await hook.setFactory(factoryAddress, { ...GAS });
    console.log("  tx:", setTx.hash);
    await setTx.wait();
    console.log("  Wired");
  }

  // ── 5. Verify ──────────────────────────────────────────────────────────────
  console.log("\nVerifying ...");
  const flagsOk = await hook.validateHookAddress();
  if (!flagsOk) throw new Error("Hook address does not satisfy required V4 flag bits!");
  console.log("  validateHookAddress():", flagsOk, "(PASS)");
  console.log("  hook.factory()       :", await hook.factory());
  console.log("  factory.hook()       :", await factory.hook());

  // ── 6. Print summary ───────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("Network         :", netName);
  console.log("PoolManager     :", poolMgr);
  console.log("StackrHookV3    :", hookAddress);
  console.log("StackrFactoryV3 :", factoryAddress);
  console.log("=".repeat(60));

  const result = {
    network:     netName,
    poolManager: poolMgr,
    hook:        hookAddress,
    factory:     factoryAddress,
    deployedAt:  new Date().toISOString(),
  };
  writeFileSync("./scripts/deployedAddresses.json", JSON.stringify(result, null, 2));
  console.log("Addresses saved to scripts/deployedAddresses.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
