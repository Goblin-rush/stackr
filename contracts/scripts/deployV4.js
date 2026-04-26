const { ethers } = require("hardhat");
const fs = require("fs");

const MAINNET_ADDRS = {
  ethUsdFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  v2Router:   "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  v2Factory:  "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  weth:       "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;

  const bal = await provider.getBalance(signer.address);
  console.log("Deployer:        ", signer.address);
  console.log("Balance:         ", ethers.formatEther(bal), "ETH");

  // Tight gas
  const block = await provider.getBlock("latest");
  const baseFee = block.baseFeePerGas ?? ethers.parseUnits("0.05", "gwei");
  const maxFeePerGas = baseFee + ethers.parseUnits("0.05", "gwei");
  const maxPriorityFeePerGas = ethers.parseUnits("0.01", "gwei");
  console.log("baseFee:         ", ethers.formatUnits(baseFee, "gwei"), "gwei");
  console.log("maxFeePerGas:    ", ethers.formatUnits(maxFeePerGas, "gwei"), "gwei");

  const Factory = await ethers.getContractFactory("StackrFactoryV4", signer);
  const deployTx = await Factory.getDeployTransaction(
    MAINNET_ADDRS.ethUsdFeed,
    MAINNET_ADDRS.v2Router,
    MAINNET_ADDRS.v2Factory,
    MAINNET_ADDRS.weth,
    signer.address
  );
  const estGas = await provider.estimateGas({ ...deployTx, from: signer.address });
  console.log("est gas:         ", estGas.toString());
  const gasLimit = (estGas * 120n) / 100n;
  const gasCost = gasLimit * maxFeePerGas;
  console.log("max gas cost:    ", ethers.formatEther(gasCost), "ETH");
  if (gasCost > bal) throw new Error("Insufficient ETH for deploy");

  console.log("\nDeploying StackrFactoryV4...");
  const factory = await Factory.deploy(
    MAINNET_ADDRS.ethUsdFeed,
    MAINNET_ADDRS.v2Router,
    MAINNET_ADDRS.v2Factory,
    MAINNET_ADDRS.weth,
    signer.address,
    { gasLimit, maxFeePerGas, maxPriorityFeePerGas }
  );
  console.log("Tx:              ", factory.deploymentTransaction().hash);
  const rcpt = await factory.deploymentTransaction().wait();
  const factoryAddress = await factory.getAddress();
  console.log("Mined block:     ", rcpt.blockNumber);
  console.log("Gas used:        ", rcpt.gasUsed.toString());
  console.log("Factory address: ", factoryAddress);

  // Verify owner + Chainlink read
  const owner = await factory.owner();
  const ethUsd = await factory.ethUsdPrice();
  console.log("\nVerification:");
  console.log("  factory.owner():       ", owner);
  console.log("  factory.ethUsdPrice(): ", Number(ethUsd) / 1e8, "USD/ETH");

  // Persist addresses
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync("./scripts/deployedAddresses.json", "utf8")); } catch {}
  existing.v4 = {
    network: "mainnet",
    chainId: 1,
    factory: factoryAddress,
    ethUsdFeed: MAINNET_ADDRS.ethUsdFeed,
    v2Router: MAINNET_ADDRS.v2Router,
    v2Factory: MAINNET_ADDRS.v2Factory,
    weth: MAINNET_ADDRS.weth,
    owner: owner,
    deployedAt: new Date().toISOString(),
    deployTx: factory.deploymentTransaction().hash,
    block: rcpt.blockNumber,
    config: {
      launchFdvUsd: 5000,
      bondThresholdEth: "2.75",
      curveTokenSupply: "800000000",
      lpReserveTokens: "200000000",
      totalSupply: "1000000000",
      feeBps: 100,
      feeRecipient: "token creator",
      lpRecipient: "factory owner",
    }
  };
  fs.writeFileSync("./scripts/deployedAddresses.json", JSON.stringify(existing, null, 2));
  console.log("\nAddresses written to scripts/deployedAddresses.json (.v4)");

  const balAfter = await provider.getBalance(signer.address);
  console.log("Balance after:   ", ethers.formatEther(balAfter), "ETH");
  console.log("ETH spent:       ", ethers.formatEther(bal - balAfter), "ETH");
}

main().catch((e) => { console.error(e); process.exit(1); });
