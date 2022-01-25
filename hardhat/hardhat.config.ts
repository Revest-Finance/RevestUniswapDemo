import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-contract-sizer";
import "hardhat-deploy";

import "./tasks/accounts";
import "./tasks/clean";

import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// Ensure that we have all the environment variables we need.
let PRIVATE_KEY: string;
let TESTING_PRIVATE: string;
if (!process.env.PRIVATE_KEY || !process.env.TESTING_PRIVATE) {
  throw new Error("Please set your PRIVATEKEY in a .env file");
} else {
  PRIVATE_KEY = process.env.PRIVATE_KEY;
  TESTING_PRIVATE = process.env.TESTING_PRIVATE;
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://rpc.ftm.tools",
        blockNumber: 28600421,
      },
    },
    rinkeby: {
      url: process.env.RINKEBY,
      accounts: [TESTING_PRIVATE],
    },
    mainnet: {
      url: process.env.MAINNET,
      accounts: [PRIVATE_KEY],
      blockGasLimit: 12487794,
    },
    matic: {
      url: process.env.MATIC,
      accounts: [PRIVATE_KEY],
      gasPrice: 1711e9,
      chainId: 137,
      blockGasLimit: 12487794,
    },
    fantom: {
      url: process.env.FANTOM,
      accounts: [PRIVATE_KEY],
      gasPrice: 1813e9,
      chainId: 250,
      blockGasLimit: 12487794,
    },
    avax: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      accounts: [PRIVATE_KEY],
      gasPrice: 70e9,
      chainId: 43114,
      blockGasLimit: 8000000,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  solidity: {
    version: "0.8.4",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
      },
      // You should disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API,
  },
  mocha: {
    timeout: 200000,
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
      1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
    },
  },
};

export default config;
