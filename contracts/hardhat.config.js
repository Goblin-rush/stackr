require("@nomicfoundation/hardhat-ethers");

const networks = {};
if (process.env.Private_key && process.env.Private_key.length === 64) {
  networks.mainnet = {
    url: "https://ethereum.publicnode.com",
    accounts: [process.env.Private_key],
  };
  networks.base = {
    url: "https://mainnet.base.org",
    accounts: [process.env.Private_key],
  };
  networks.baseSepolia = {
    url: "https://sepolia.base.org",
    accounts: [process.env.Private_key],
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
