// Deploys Aethpad v2 contracts on Base (or Base Sepolia).
// Required env:
//   Private_key      — deployer key (64 hex chars, no 0x)
// Usage:
//   npx hardhat run scripts/deployV2.js --network baseSepolia
//   npx hardhat run scripts/deployV2.js --network base

const { ethers, network } = require("hardhat");

// Uniswap V2 router addresses
// Base mainnet:   0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24 (BaseSwap / Uniswap V2 fork)
// Base Sepolia:   0x1689E7B1F10000AE47eBfE339a4f69dECd19F602 (Uniswap V2 router, fallback addr)
// Adjust per actual deployment target
const ROUTERS = {
  base: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
  baseSepolia: "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance: ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const router = ROUTERS[network.name];
  if (!router) throw new Error(`No router configured for network: ${network.name}`);
  console.log("Router:  ", router);

  // 1. Deploy Factory
  const Factory = await ethers.getContractFactory("AethpadFactoryV2");
  const factory = await Factory.deploy(router);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("Factory: ", factoryAddr);

  // 2. Deploy Deployer (needs factory address)
  const Deployer = await ethers.getContractFactory("AethpadDeployer");
  const helper = await Deployer.deploy(factoryAddr, router);
  await helper.waitForDeployment();
  const helperAddr = await helper.getAddress();
  console.log("Deployer:", helperAddr);

  // 3. Wire factory → deployer
  const tx = await factory.setDeployer(helperAddr);
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
