const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://ethereum.publicnode.com");
  const wallet = new ethers.Wallet(process.env.Private_key, provider);

  console.log("Deployer:", wallet.address);
  const bal = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(bal), "ETH");

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/BondingCurveLaunchpad.sol/BondingCurveLaunchpad.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // ── CONFIG: change these before deploying ──
  const TOKEN_NAME   = "My Token";
  const TOKEN_SYMBOL = "MTKN";
  const ADMIN        = wallet.address; // derived from Private_key secret
  // ───────────────────────────────────────────

  console.log(`\nDeploying ${TOKEN_NAME} (${TOKEN_SYMBOL})...`);
  const contract = await factory.deploy(TOKEN_NAME, TOKEN_SYMBOL, ADMIN);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  console.log("\n✅ Deployed:", addr);
  console.log("Etherscan:  https://etherscan.io/address/" + addr);
  console.log("\nTokenomics:");
  console.log("  Total supply  : 1,000,000,000", TOKEN_SYMBOL);
  console.log("  Curve supply  : 800,000,000 (80%) — held by contract");
  console.log("  Team supply   : 200,000,000 (20%) — sent to admin");
  console.log("  Target ETH    : 3.5 ETH");
  console.log("  Virtual ETH   : 1.5 ETH (sets starting price)");
  console.log("\nAdmin wallet  :", ADMIN);
  console.log("Contract      :", addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
