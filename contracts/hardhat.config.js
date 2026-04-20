require("@nomicfoundation/hardhat-ethers");

module.exports = {
  solidity: "0.8.20",
  networks: {
    mainnet: {
      url: "https://ethereum.publicnode.com",
      accounts: [process.env.Private_key],
    },
  },
};
