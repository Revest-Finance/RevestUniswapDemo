// Run with `npx hardhat test test/UniswapDemo.spec.ts`
import chai from "chai";
import hre, { ethers } from "hardhat";
import { deployContract, solidity } from "ethereum-waffle";
import dotenv from "dotenv";
dotenv.config();

import {
  advanceTimeAndBlock,
  approveAll,
  DAY,
  ERC20ABI,
  IProvider,
  ITestProvider,
  PROVIDERS,
  REVEST,
  REVESTABI,
  SEPERATOR,
  setupImpersonator,
  TEST_TOKEN,
  UNISWAP,
  WETH,
  WHALES,
} from "./utils";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { JsonRpcSigner } from "@ethersproject/providers";

const { expect } = chai;

chai.use(solidity);

let owner: SignerWithAddress;
let chainId: number;
let UniswapDemo: Contract;
let rvstTokenContract;
let fnftId: number;

const quantity = 1;

let whaleSigners: JsonRpcSigner[] = [];

describe("Revest", function () {
  before(async () => {
    return new Promise(async resolve => {
      // runs once before the first test in this block
      // Deploy needed contracts and set up necessary functions
      [owner] = await ethers.getSigners();
      const network = await ethers.provider.getNetwork();
      chainId = network.chainId;

      let PROVIDER_ADDRESS = PROVIDERS[chainId as keyof IProvider];
      let UNISWAP_ADDRESS = UNISWAP[chainId as keyof IProvider];

      console.log(SEPERATOR);
      console.log("\tDeploying Uniswap Test System");
      const UniswapDemoFactory = await ethers.getContractFactory("UniswapDemo");
      UniswapDemo = await UniswapDemoFactory.deploy(PROVIDER_ADDRESS, UNISWAP_ADDRESS);
      await UniswapDemo.deployed();

      // The contract object
      rvstTokenContract = new ethers.Contract(WETH[chainId as keyof IProvider], ERC20ABI, owner);

      for (const whale of WHALES) {
        const signer = await ethers.provider.getSigner(whale);
        whaleSigners.push(signer);
        await setupImpersonator(whale);
        await approveAll(signer, UniswapDemo.address, rvstTokenContract);
      }
      await approveAll(owner, UniswapDemo.address, rvstTokenContract);

      resolve();
    });
  });

  it("Should test minting of an FNFT with this system", async function () {
    // Outline the parameters that will govern the FNFT
    let expiration = Math.floor(Date.now() / 1000) + 3600 * 48;
    let fee = ethers.utils.parseEther("3"); //FTM fee
    let amountPer = ethers.utils.parseEther("0.0001"); //WFTM
    let asset1 = WETH[chainId as keyof IProvider];
    let asset2 = TEST_TOKEN[chainId as keyof ITestProvider];

    // Mint the FNFT
    fnftId = await UniswapDemo.connect(whaleSigners[0]).callStatic.mintTimeLockToUniswap(
      expiration,
      amountPer,
      quantity,
      [asset1, asset2],
      { value: fee },
    );
    let txn = await UniswapDemo.connect(whaleSigners[0]).mintTimeLockToUniswap(
      expiration,
      amountPer,
      quantity,
      [asset1, asset2],
      { value: fee },
    );
  });

  it("Should test the metadata calls", async () => {
    let res = await UniswapDemo.getOutputDisplayValues(fnftId);
    console.log(res);
  });

  it("Should fast-forward time and attempt to unlock that FNFT", async () => {
    await advanceTimeAndBlock(3 * DAY);
    // Instantiate the Revest and WETH contracts
    let wethContract = new ethers.Contract(TEST_TOKEN[chainId as keyof ITestProvider], ERC20ABI, whaleSigners[0]);
    let Revest = new ethers.Contract(REVEST, REVESTABI, whaleSigners[0]);

    // Check our current balance of WETH
    let orginalBal = await wethContract.balanceOf(WHALES[0]);

    console.log("Here");

    // Withdraw from the FNFT and execute the swap
    let txn = await Revest.withdrawFNFT(fnftId, quantity);

    console.log("Here2");

    // If the swap was correctly executed, we have a greater balance of WETH than when we started
    let newBal = await wethContract.balanceOf(WHALES[0]);
    expect(newBal).to.eq(orginalBal);
  });
});
