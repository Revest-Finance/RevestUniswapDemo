// Run with `npx hardhat test test/revest-primary.js`

const chai = require("chai");
const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { solidity } =  require("ethereum-waffle");
const { BigNumber } = require("ethers");

require('dotenv').config();

chai.use(solidity);

// Run with SKIP=true npx hardhat test test/revest-primary.js to skip tests
const skip = process.env.SKIP || false;

const separator = "\t-----------------------------------------";

// 31337 is the default hardhat forking network
const PROVIDERS = {
    1:'0xD721A90dd7e010c8C5E022cc0100c55aC78E0FC4',
    31337: "0xe0741aE6a8A6D87A68B7b36973d8740704Fd62B9",
    4:"0x21744C9A65608645E1b39a4596C39848078C2865",
    137:"0xC03bB46b3BFD42e6a2bf20aD6Fa660e4Bd3736F8",
    250:"0xe0741aE6a8A6D87A68B7b36973d8740704Fd62B9",
    43114:"0x64e12fEA089e52A06A7A76028C809159ba4c1b1a"
};

const WETH ={
    1:"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    31337: "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83",
    4:"0xc778417e063141139fce010982780140aa0cd5ab",
    137:"0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    250:"0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83",
    43114:"0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"
};

const UNISWAP = {
    1: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    31337: "0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52",
    4: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    137: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", //QuickSwap
    250: "0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52", //SpiritSwap
    43114: "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"//Pangolin
}

const TEST_TOKEN = {
    1: "0x120a3879da835A5aF037bB2d1456beBd6B54d4bA", //RVST
    31337: "0x5cc61a78f164885776aa610fb0fe1257df78e59b",//SPIRIT
};

// Tooled for mainnet Ethereum
const REVEST = '0x951e7c0A50b70Cd7bB5C244A9bD7aF76e563485F';
const revestABI = ['function withdrawFNFT(uint tokenUID, uint quantity) external'];

const HOUR = 3600;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;


let owner;
let chainId;
let UniswapDemo;
let rvstTokenContract;
let fnftId;
const quantity = 1;

let whales = [
    "0x9EB52C04e420E40846f73D09bD47Ab5e25821445", //Holds a ton of RVST
];
let whaleSigners = [];



// The ERC-20 Contract ABI, which is a common contract interface
// for tokens (this is the Human-Readable ABI format)
const abi = [
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



describe("Revest", function () {
    before(async () => {
        return new Promise(async (resolve) => {
            // runs once before the first test in this block
            // Deploy needed contracts and set up necessary functions
            [owner] = await ethers.getSigners();
            const network = await ethers.provider.getNetwork();
            chainId = network.chainId;
            
            let PROVIDER_ADDRESS = PROVIDERS[chainId];
            let UNISWAP_ADDRESS = UNISWAP[chainId];
            
            console.log(separator);
            console.log("\tDeploying Uniswap Test System");
            const UniswapDemoFactory = await ethers.getContractFactory("UniswapDemo");
            UniswapDemo = await UniswapDemoFactory.deploy(PROVIDER_ADDRESS, UNISWAP_ADDRESS);
            await UniswapDemo.deployed();

            // The contract object
            rvstTokenContract = new ethers.Contract(WETH[chainId], abi, owner);

            for (const whale of whales) {
                let signer = await ethers.provider.getSigner(whale);
                whaleSigners.push(signer);
                setupImpersonator(whale);
                await approveAll(signer, UniswapDemo.address);
            }
            await approveAll(owner, UniswapDemo.address);

            resolve();
        });
    });

    
    it("Should test minting of an FNFT with this system", async function () {
        let recent = await ethers.provider.getBlockNumber();
        let block = await ethers.provider.getBlock(recent);
        let time = block.timestamp;

        // Outline the parameters that will govern the FNFT
        let expiration = time + 3600 * 24;
        let fee = ethers.utils.parseEther('3');//FTM fee
        let amountPer = ethers.utils.parseEther('0.0001'); //WFTM
        let asset1 = WETH[chainId]; 
        let asset2 = TEST_TOKEN[chainId];

        // Mint the FNFT
        fnftId = await UniswapDemo.connect(whaleSigners[0]).callStatic.mintTimeLockToUniswap(expiration,amountPer,quantity, [asset1, asset2], {value:fee});
        let txn = await UniswapDemo.connect(whaleSigners[0]).mintTimeLockToUniswap(expiration,amountPer,quantity, [asset1, asset2], {value:fee});
        await txn.wait();
    });

    it("Should test the metadata calls", async () => {
        let res = await UniswapDemo.getOutputDisplayValues(fnftId);
        console.log(res);
    });

    it("Should fast-forward time and attempt to unlock that FNFT", async () => {
        await timeTravel(3*DAY);
        // Instantiate the Revest and WETH contracts
        let wethContract = new ethers.Contract(TEST_TOKEN[chainId], abi, whaleSigners[0]);
        let Revest = new ethers.Contract(REVEST, revestABI, whaleSigners[0]);

        // Check our current balance of WETH
        let orginalBal = await wethContract.balanceOf(whales[0]);

        // Withdraw from the FNFT and execute the swap
        let txn = await Revest.withdrawFNFT(fnftId, quantity);
        await txn.wait();

        // If the swap was correctly executed, we have a greater balance of WETH than when we started
        let newBal = await wethContract.balanceOf(whales[0]);
        assert(newBal.gt(orginalBal));
    });

    
});

async function setupImpersonator(addr) {
    const impersonateTx = await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [addr],
    });
}

async function timeTravel(time) {
    await network.provider.send("evm_increaseTime", [time]);
    await network.provider.send("evm_mine");
}

async function approveAll(signer, address) {
    let approval = await rvstTokenContract
        .connect(signer)
        .approve(address, ethers.constants.MaxInt256);
    let out = await approval.wait();
    
}

function getDefaultConfig(address, amount) {
    let config = {
        asset: address, // The token being stored
        depositAmount: amount, // How many tokens
        depositMul: ethers.BigNumber.from(0),// Deposit multiplier
        split: ethers.BigNumber.from(0),// Number of splits remaining
        maturityExtension: ethers.BigNumber.from(0),// Maturity extensions remaining
        pipeToContract: "0x0000000000000000000000000000000000000000", // Indicates if FNFT will pipe to another contract
        isStaking: false,
        isMulti: false,
        depositStopTime: ethers.BigNumber.from(0),
        whitelist: false
    };
    return config;
}

function encodeArguments(abi, args) {
    let abiCoder = ethers.utils.defaultAbiCoder;
    return abiCoder.encode(abi, args);
}


