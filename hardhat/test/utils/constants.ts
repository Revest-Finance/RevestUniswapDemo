import { constants } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

import { IProvider, ITestProvider } from "./index";

const { AddressZero, MaxUint256, One, Two, Zero } = constants;

export const ADDRESS_ZERO = AddressZero;
export const EMPTY_BYTES = "0x";
export const MAX_UINT_256 = MaxUint256;
export const ONE = One;
export const TWO = Two;
export const THREE = BigNumber.from(3);
export const ZERO = Zero;
export const MAX_INT_256 = "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
export const MIN_INT_256 = "-0x8000000000000000000000000000000000000000000000000000000000000000";
export const ONE_DAY_IN_SECONDS = BigNumber.from(60 * 60 * 24);
export const ONE_HOUR_IN_SECONDS = BigNumber.from(60 * 60);
export const ONE_YEAR_IN_SECONDS = BigNumber.from(60 * 60 * 24 * 365);
export const ONE_WEEK_IN_SECONDS = BigNumber.from(60 * 60 * 24 * 7);
export const ONE_DAY_SECONDS = 60 * 60 * 24;

// 31337 is the default hardhat forking network
export const PROVIDERS: IProvider = {
  1: "0xD721A90dd7e010c8C5E022cc0100c55aC78E0FC4",
  31337: "0xe0741aE6a8A6D87A68B7b36973d8740704Fd62B9",
  4: "0x21744C9A65608645E1b39a4596C39848078C2865",
  137: "0xC03bB46b3BFD42e6a2bf20aD6Fa660e4Bd3736F8",
  250: "0xe0741aE6a8A6D87A68B7b36973d8740704Fd62B9",
  43114: "0x64e12fEA089e52A06A7A76028C809159ba4c1b1a",
};

export const WETH: IProvider = {
  1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  31337: "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83",
  4: "0xc778417e063141139fce010982780140aa0cd5ab",
  137: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  250: "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83",
  43114: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
};

export const UNISWAP: IProvider = {
  1: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  31337: "0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52",
  4: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  137: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", //QuickSwap
  250: "0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52", //SpiritSwap
  43114: "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106", //Pangolin
};

export const TEST_TOKEN: ITestProvider= {
  1: "0x120a3879da835A5aF037bB2d1456beBd6B54d4bA", //RVST
  31337: "0x5cc61a78f164885776aa610fb0fe1257df78e59b", //SPIRIT
};

// Tooled for mainnet Ethereum
export const REVEST = "0x951e7c0A50b70Cd7bB5C244A9bD7aF76e563485F";
export const REVESTABI = ["function withdrawFNFT(uint tokenUID, uint quantity) external"];

// The ERC-20 Contract ABI, which is a common contract interface
// for tokens (this is the Human-Readable ABI format)
export const ERC20ABI = [
  // Some details about the token
  "function symbol() view returns (string)",

  // Get the account balance
  "function balanceOf(address) view returns (uint)",

  // Send some of your tokens to someone else
  "function transfer(address to, uint amount)",

  // An event triggered whenever anyone transfers to someone else
  "event Transfer(address indexed from, address indexed to, uint amount)",

  "function approve(address spender, uint256 amount) external returns (bool)",
];
// Whales
export const WHALES = [
  "0x9EB52C04e420E40846f73D09bD47Ab5e25821445", //Holds a ton of RVST
];

// Time
export const HOUR = 3600;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
export const MONTH = DAY * 30;
export const YEAR = DAY * 365;

export const PRECISE_UNIT = constants.WeiPerEther;
export const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const SEPERATOR = "\t-----------------------------------------";

// Run with SKIP=true npx hardhat test test/revest-primary.js to skip tests
export const SKIP = process.env.SKIP || false;
