require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

const networks = {};
const rawKey = process.env.Private_key || "";
// Accept with or without 0x prefix
const deployerKey = rawKey.startsWith("0x") ? rawKey : rawKey.length === 64 ? `0x${rawKey}` : null;
if (deployerKey) {
  networks.mainnet = {
    url: "https://ethereum.publicnode.com",
    accounts: [deployerKey],
  };
  networks.base = {
    url: "https://mainnet.base.org",
    accounts: [deployerKey],
  };
  networks.baseSepolia = {
    url: "https://sepolia.base.org",
    accounts: [deployerKey],
  };
}

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
    },
  },
  networks,
};
