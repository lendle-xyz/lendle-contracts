require("@nomicfoundation/hardhat-toolbox");
require('dotenv/config');
require('@nomicfoundation/hardhat-verify');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: { 
            enabled: true, 
            runs: 200 
          },
          evmVersion: "istanbul",
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: { 
            enabled: true, 
            runs: 200 
          },
          evmVersion: "paris",
        },
      },
    ],
  },
  networks: {
    mantle: {
      url: process.env.MANTLE_RPC,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      'mantle': process.env.ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: "mantle",
        chainId: 5000,
        urls: {
          apiURL: "https://api.mantlescan.xyz/api",
          browserURL: "https://mantlescan.xyz/",
        },
      },
    ],
  },
};
