const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Uniswap V2 Router on Ethereum mainnet
  const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  const Factory = await ethers.getContractFactory("AsteroidStrategy");
  const contract = await Factory.deploy(UNISWAP_ROUTER);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ AsteroidStrategy deployed to:", address);
  console.log("🔗 Etherscan: https://etherscan.io/address/" + address);
}

main().catch((e) => { console.error(e); process.exit(1); });
