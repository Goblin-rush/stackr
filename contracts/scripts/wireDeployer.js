// One-shot script: wire an existing factory to an existing deployer helper.
// Usage:
//   FACTORY_ADDR=0x... DEPLOYER_ADDR=0x... npx hardhat run scripts/wireDeployer.js --network base

const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const factoryAddr  = process.env.FACTORY_ADDR;
  const deployerAddr = process.env.DEPLOYER_ADDR;
  if (!factoryAddr || !deployerAddr) throw new Error("Set FACTORY_ADDR and DEPLOYER_ADDR");

  console.log("Network :", network.name);
  console.log("Signer  :", deployer.address);
  console.log("Balance :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Factory :", factoryAddr);
  console.log("Deployer:", deployerAddr);

  const feeData = await ethers.provider.getFeeData();
  const gasOverrides = {
    maxFeePerGas:         feeData.maxFeePerGas         ?? ethers.parseUnits("0.5", "gwei"),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? ethers.parseUnits("0.1", "gwei"),
  };
  console.log("Gas maxFee:", ethers.formatUnits(gasOverrides.maxFeePerGas, "gwei"), "gwei");

  const factory = await ethers.getContractAt("AethpadFactoryV2", factoryAddr);
  const tx = await factory.setDeployer(deployerAddr, gasOverrides);
  console.log("Tx sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block", receipt.blockNumber);

  console.log("\n=== WIRED ===");
  console.log(`VITE_FACTORY_V2_ADDRESS=${factoryAddr}`);
  console.log(`VITE_DEPLOYER_V2_ADDRESS=${deployerAddr}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
