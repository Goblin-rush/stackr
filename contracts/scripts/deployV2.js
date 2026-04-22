// Deploys Aethpad v2 contracts on Base (or Base Sepolia).
// Required env:
//   Private_key      — deployer key (with or without 0x prefix)
//   FACTORY_ADDR     — (optional) skip factory deploy if already deployed
// Usage:
//   npx hardhat run scripts/deployV2.js --network base
//   npx hardhat run scripts/deployV2.js --network baseSepolia

const { ethers, network } = require("hardhat");

const ROUTERS = {
  base: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
  baseSepolia: "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602",
};

// Explicit gas override to avoid "replacement transaction underpriced" on Base
const GAS_OVERRIDES = {
  maxFeePerGas: ethers.parseUnits("0.1", "gwei"),
  maxPriorityFeePerGas: ethers.parseUnits("0.01", "gwei"),
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance: ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const router = ROUTERS[network.name];
  if (!router) throw new Error(`No router configured for network: ${network.name}`);
  console.log("Router:  ", router);

  let factoryAddr = process.env.FACTORY_ADDR;

  // 1. Deploy Factory (skip if already deployed)
  if (factoryAddr) {
    console.log("Factory: ", factoryAddr, "(reusing existing)");
  } else {
    const Factory = await ethers.getContractFactory("AethpadFactoryV2");
    const factory = await Factory.deploy(router, GAS_OVERRIDES);
    await factory.waitForDeployment();
    factoryAddr = await factory.getAddress();
    console.log("Factory: ", factoryAddr);
  }

  // 2. Deploy Deployer helper
  const Deployer = await ethers.getContractFactory("AethpadDeployer");
  const helper = await Deployer.deploy(factoryAddr, router, GAS_OVERRIDES);
  await helper.waitForDeployment();
  const helperAddr = await helper.getAddress();
  console.log("Deployer:", helperAddr);

  // 3. Wire factory → deployer
  const factory = await ethers.getContractAt("AethpadFactoryV2", factoryAddr);
  const tx = await factory.setDeployer(helperAddr, GAS_OVERRIDES);
  await tx.wait();
  console.log("Factory.setDeployer() done");

  console.log("\n=== DEPLOYED ===");
  console.log(`VITE_FACTORY_V2_ADDRESS=${factoryAddr}`);
  console.log(`VITE_DEPLOYER_V2_ADDRESS=${helperAddr}`);
  console.log(`VITE_UNISWAP_ROUTER=${router}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
