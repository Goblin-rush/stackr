const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://ethereum.publicnode.com");
  const wallet = new ethers.Wallet(process.env.Private_key, provider);

  console.log("Deployer / Factory Owner:", wallet.address);
  const bal = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(bal), "ETH");

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/LaunchpadFactory.sol/LaunchpadFactory.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("\nDeploying LaunchpadFactory...");
  const contract = await factory.deploy(wallet.address);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  console.log("\n✅ LaunchpadFactory deployed:", addr);
  console.log("Etherscan: https://etherscan.io/address/" + addr);
  console.log("\nFactory owner (gets all ETH from all tokens):", wallet.address);
  console.log("\nAnyone can now call createToken(name, symbol) to launch a bonding curve token.");
  console.log("All raised ETH from every token auto-forwards to:", wallet.address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
