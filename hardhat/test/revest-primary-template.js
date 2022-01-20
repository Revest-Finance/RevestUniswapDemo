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

let owner;
let rewardsHandler;
let nftHandler;
let lockManager;
let metadataHandler;
let revest;
let registry;
let token;
let vault;
let staking;
let chainlinkOracleDispatchAddress;
let snapshot;
let fakeERC20Token;
let revestOptions;
let splitPrincipal;
let mockAAVE;
let mockERC20Yearn;
let comboLock;
let uniswap;


const HOUR = 3600;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;
const link = "0x514910771af9ca656af840dff83e8264ecf986ca"; //Chainlink
const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; //Wrapped ETH
const usdt = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //Tether
const aLINK = "0xa06bC25B5805d5F8d82847D191Cb4Af5A3e873E0"; //AAVE Link
const yUSDT = "0x7Da96a3891Add058AdA2E826306D812C638D87a7"; //yearn USDT
let UNISWAP_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const bn = ethers.BigNumber.from(42);

let whales = [
    "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", // Holds 5 million LINK (with 18 decimals)
    "0x988dc52bfbdcb76067519aa56f4b86f4ecd16476",
    "0x28c6c06298d514db089934071355e5743bf21d60",
];
let whaleSigners = [];

let randomAdd = [
    "0xdd7B0d9d288e2F958c958BCd328b64812989259c",
    "0xa1E41F1C2F4c30e9738973D7B8E723578578dC36",
];
let randomSigners = [];

let chainlinkContract;
let wETHCon;
let usdtCon;
let aLINKCon;
let yUSDTCon;

let uniswapFactory;

let overrides = {
    // To convert Ether to Wei:
    value: ethers.utils.parseEther("1.0"), // ether in this case MUST be a string

    // Or you can use Wei directly if you have that:
    // value: someBigNumber
    // value: 1234   // Note that using JavaScript numbers requires they are less than Number.MAX_SAFE_INTEGER
    // value: "1234567890"
    // value: "0x1234"

    // Or, promises are also supported:
    // value: provider.getBalance(addr)
};

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

const uniABI = ["function getPair(address tokenA, address tokenB) external view returns (address pair)"];

const uniPairABI = [
    "function getReserves() external view returns (uint, uint, uint)",
    "function price0CumulativeLast() external view returns (uint)",
    "function sync() external"
];

function eth(val) {
    return ethers.utils.formatEther(val);
}

describe("Revest", function () {
    before(async () => {
        return new Promise(async (resolve) => {
            // runs once before the first test in this block
            [owner] = await ethers.getSigners();

            await main();

            // The Contract object
            chainlinkContract = new ethers.Contract(link, abi, ethers.provider);
            wETHCon = new ethers.Contract(weth, abi, ethers.provider);
            usdtCon = new ethers.Contract(usdt, abi, ethers.provider);
            aLINKCon = new ethers.Contract(aLINK, abi, ethers.provider);
            yUSDTCon = new ethers.Contract(yUSDT, abi, ethers.provider);
            uniswapFactory = new ethers.Contract(UNISWAP_FACTORY, uniABI, ethers.provider);

            for (const whale of whales) {
                let signer = await ethers.provider.getSigner(whale);
                whaleSigners.push(signer);
                setupImpersonator(whale);
                await approveAll(signer);
            }
            for (randomAddr of randomAdd) {
                let signer = await ethers.provider.getSigner(randomAddr);
                randomSigners.push(signer);
                setupImpersonator(randomAddr);
                await approveAll(signer);
            }

            //Add a liquidity pair to Uniswap with the Revest token
            let revest_quantity = ethers.utils.parseUnits("100", 18);
            let weth_quantity = ethers.utils.parseUnits("1", 18);
            //We use whale[0] as our performer
            await token.connect(owner).transfer(whales[0], revest_quantity.mul("200"));
            await wETHCon.connect(whaleSigners[0]).approve(uniswap.address, ethers.constants.MaxInt256);
            await token.connect(whaleSigners[0]).approve(uniswap.address, ethers.constants.MaxInt256);
            const rawTx = {
                value: weth_quantity,
                from: whales[0]
            };
            try{
            let result = await uniswap.connect(whaleSigners[0]).addLiquidityETH(token.address, revest_quantity, revest_quantity, weth_quantity, whales[0], 2031474850, rawTx);
            } catch (e) {
                console.log(e);
                assert(false);
            }

            resolve();
        });
    });

    ///THESE TESTS NEED TO COME FIRST
    it("Should travel into the future", async function () {
        if (skip) {
            return;
        }
        let present = await ethers.provider.getBlockNumber();
        let presentBlock = await ethers.provider.getBlock(present);

        await timeTravel(YEAR);
        let future = await ethers.provider.getBlockNumber();
        let futureBlock = await ethers.provider.getBlock(future);

        assert(presentBlock.timestamp + YEAR == futureBlock.timestamp);
    });

    it("Should test rebasing Chainlink", async function () {
        if (skip) {
            return;
        }
        const depositAmount = ethers.utils.parseUnits("2", 0);
        let quantity = ethers.BigNumber.from("10");
        let transferQuantity = ethers.BigNumber.from("4");
        let remainingQuantity = ethers.BigNumber.from("6");

        let originalERC20Bal = await chainlinkContract.balanceOf(whales[0]);
        let expectedBalAfterMint = originalERC20Bal.sub(depositAmount.mul(10));


        let recent = await ethers.provider.getBlockNumber();
        let block = await ethers.provider.getBlock(recent);
        let time = block.timestamp + 3600 * 24;
        let weiFee = await revest.getFlatWeiFee();

        const rawTx = {
            gasLimit: 999999,
            value: weiFee,
        };

        let config = getDefaultConfig(link, depositAmount);

        //Fake a read-only to get number
        let id = await revest
            .connect(whaleSigners[0])
            .callStatic.mintTimeLock(
                time,
                [whales[0]],
                [quantity],
                config,
                rawTx
            );
        console.log("Real transaction breakpoint \n");
        // Create timelock with quantity 10, supply 1e18 (per FNFT)
        let transaction = await revest
            .connect(whaleSigners[0])
            .mintTimeLock(time, [whales[0]], [ethers.BigNumber.from(10)], config, rawTx);


        // Check that supply is 10e18 after deposit
        let newBal = await chainlinkContract.balanceOf(whales[0]);
        assert(newBal.eq(expectedBalAfterMint));
        let supply = await nftHandler.connect(whales[0]).getSupply(id);
        assert(supply.eq(quantity));

        // Attempt and fail to withdraw because not enough time has passed
        let threwError = false;
        try {
            let transaction = await revest.connect(whaleSigners[0]).withdrawFNFT(id, remainingQuantity);
        } catch {
            threwError = true;
        }
        assert(threwError, "Didn't throw error");

        // Check that supply remains the same after failed withdrawal
        supply = await nftHandler.connect(whales[0]).getSupply(id);
        console.log(`Supply after failed withdrawal is: ${supply}, should be ${quantity}`);

        // Fast forward to a time when the vault will be unlocked
        await timeTravel(DAY + HOUR);

        let origVal = await vault.connect(whales[0]).getFNFTCurrentValue(id);
        let vaultBalOrig = await chainlinkContract.connect(whales[0]).balanceOf(vault.address);

        console.log(`Original value is: ${origVal}`);
        console.log(`Original balance is: ${vaultBalOrig}`);

        let transaction2 = await chainlinkContract
            .connect(whaleSigners[0])
            .transfer(vault.address, depositAmount.mul(quantity));

        let newVal = await vault.connect(whales[0]).getFNFTCurrentValue(id);
        let vaultBalNew = await chainlinkContract.connect(whales[0]).balanceOf(vault.address);
        console.log(`New value is: ${newVal}`);
        console.log(`New balance is: ${vaultBalNew}`);


        assert(origVal.mul(2).eq(newVal));

        // Withdraw quantity
        let cashIn = await revest.connect(whaleSigners[0]).withdrawFNFT(id, quantity);


        let curBal = await chainlinkContract.balanceOf(whales[0]);
        assert(curBal.eq(originalERC20Bal));

    });

    it("Should mint a time lock, transfer some, withdraw what is left", async function () {
        if (skip) {
            return;
        }
        const depositAmount = ethers.utils.parseUnits("2", 0);
        let quantity = ethers.BigNumber.from("10");
        let transferQuantity = ethers.BigNumber.from("4");
        let remainingQuantity = ethers.BigNumber.from("6");

        let originalERC20Bal = await chainlinkContract.balanceOf(whales[0]);
        let expectedBalAfterMint = originalERC20Bal.sub(depositAmount.mul(10));


        let recent = await ethers.provider.getBlockNumber();
        let block = await ethers.provider.getBlock(recent);
        let time = block.timestamp + 3600 * 24;
        let weiFee = await revest.getFlatWeiFee();

        const rawTx = {
            gasLimit: 999999,
            value: weiFee,
        };

        let config = getDefaultConfig(link, depositAmount);

        //Fake a read-only to get number
        let id = await revest
            .connect(whaleSigners[0])
            .callStatic.mintTimeLock(
                time,
                [whales[0]],
                [quantity],
                config,
                rawTx
            );

            console.log("\n BREAKPOINT \n")
        // Create timelock with quantity 10, supply 1e18 (per FNFT)
        let transaction = await revest
            .connect(whaleSigners[0])
            .mintTimeLock(time, [whales[0]], [ethers.BigNumber.from(10)], config, rawTx);


        // Check that supply is 10e18 after deposit
        let newBal = await chainlinkContract.balanceOf(whales[0]);
        assert(newBal.eq(expectedBalAfterMint));
        let supply = await nftHandler.connect(whales[0]).getSupply(id);
        assert(supply.eq(quantity));

        // Transfer 5 to a second address
        transaction = await nftHandler
            .connect(whaleSigners[0])
            .safeTransferFrom(whales[0], whales[1], id, transferQuantity, "0x");

        // Check that the first address only has 5e18 now
        let balance1 = await nftHandler.connect(whales[0]).balanceOf(whales[0], id);
        assert(balance1.eq(remainingQuantity));

        // Check that total supply remains 10 after transferring
        supply = await nftHandler.connect(whales[0]).getSupply(id);
        assert(supply.eq(quantity));
        console.log(`Supply is: ${supply}, should be ${quantity}`);

        // Attempt and fail to withdraw because not enough time has passed
        let threwError = false;
        try {
            let transaction = await revest.connect(whaleSigners[0]).withdrawFNFT(id, remainingQuantity);
        } catch {
            threwError = true;
        }
        assert(threwError, "Didn't throw error");

        // Check that supply remains the same after failed withdrawal
        supply = await nftHandler.connect(whales[0]).getSupply(id);
        console.log(`Supply after failed withdrawal is: ${supply}, should be ${quantity}`);

        // Fast forward to a time when the vault will be unlocked
        await timeTravel(DAY + HOUR);

        // Withdraw 6 quantity
        let cashIn = await revest.connect(whaleSigners[0]).withdrawFNFT(id, remainingQuantity);

        // Check that totalSupply is now 4
        supply = await nftHandler.connect(whales[0]).getSupply(id);
        console.log(`Supply after withdrawal is: ${supply}, should be ${transferQuantity}`);
        assert(supply.eq(transferQuantity));


        let curBal = await chainlinkContract.balanceOf(whales[0]);
        console.log(`curBal is ${curBal}`);
        console.log(`expectedBalAfterMint is ${expectedBalAfterMint}`);
        console.log(`depositAmount is ${depositAmount}`);
        console.log(`originalERC20Bal is ${originalERC20Bal}`);
        assert(curBal.eq(expectedBalAfterMint.add(depositAmount.mul(remainingQuantity))));

        let curVal = await vault.connect(whales[0]).getFNFTCurrentValue(id);
        console.log(`current value of a single FNFT of this series is ${curVal}`);
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

async function approveAll(signer) {
    let approval = await chainlinkContract
        .connect(signer)
        .approve(revest.address, ethers.constants.MaxInt256);
    let approval2 = await wETHCon
        .connect(signer)
        .approve(revest.address, ethers.constants.MaxInt256);
    let approval3 = await usdtCon
        .connect(signer)
        .approve(revest.address, ethers.constants.MaxInt256);
    let approval4 = await aLINKCon
        .connect(signer)
        .approve(revest.address, ethers.constants.MaxInt256);
    let approval5 = await yUSDTCon
        .connect(signer)
        .approve(revest.address, ethers.constants.MaxInt256);
    let approval6 = await token
        .connect(signer)
        .approve(revest.address, ethers.constants.MaxInt256);
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


const separator = "\t-----------------------------------------";

async function main() {
    const signers = await ethers.getSigners();
    const owner = signers[0];
    const MIGRATION_FEE = 0;
    const URI = "https://api.revest.finance/getMetadata?id={id}";
    let PROVIDER_ADDRESS;
    const TOKEN_NAME = "Revest";
    const TOKEN_SYMBOL = "RVST";
    const TOKEN_SUPPLY = ethers.utils.parseEther("100000000");
    const TOKEN_OWNER = await signers[0].getAddress();
    const TOKEN_PROVIDER = await signers[0].getAddress();
    const UNICRYPT_ADDRESS = "0x663A5C229c09b049E36dCc11a9B0d4a8Eb9db214";
    const AAVE_POOL_ADDRESS = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9";
    const LP_ADDRESS = "0x663A5C229c09b049E36dCc11a9B0d4a8Eb9db214";
    const UNISWAP_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

    const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const USDC_ADDRESS = "0xeb8f08a975ab53e34d8a0330e0d34de942c95926";

    console.log(separator);
    console.log("\Cloning Uniswap Router");
    uniswap = new ethers.Contract(UNISWAP_ROUTER, uniswapABI, ethers.provider);

    console.log(separator);
    console.log("\tDeploying RevestAddressRegistry");
    const RevestAddressRegistryFactory = await ethers.getContractFactory(
        "RevestAddressRegistry"
    );
    const RevestAddressRegistry = await RevestAddressRegistryFactory.deploy();
    await RevestAddressRegistry.deployed();
    PROVIDER_ADDRESS = RevestAddressRegistry.address;
    console.log("Deploying Revest Contracts\n\n\tProvider Address: ", PROVIDER_ADDRESS);



    console.log(separator);
    console.log("\tDeploying FNFTHandler\n");
    const FNFTHandlerFactory = await ethers.getContractFactory("FNFTHandler");
    const FNFTHandler = await FNFTHandlerFactory.deploy(PROVIDER_ADDRESS);
    await FNFTHandler.deployed();

    console.log(separator);
    console.log("\tDeploying LockManager\n");
    const LockManagerFactory = await ethers.getContractFactory("LockManager");
    const LockManager = await LockManagerFactory.deploy(PROVIDER_ADDRESS);
    await LockManager.deployed();

    console.log(separator);
    console.log("\tDeploying MetadataHandler\n\t\tURI: ", URI);
    const MetadataHandlerFactory = await ethers.getContractFactory("MetadataHandler");
    const MetadataHandler = await MetadataHandlerFactory.deploy(URI);
    await MetadataHandler.deployed();

    console.log(separator);
    console.log("\tDeploying RevestToken");
    console.log("\t\tTOKEN_NAME:     ", TOKEN_NAME);
    console.log("\t\tTOKEN_SYMBOL:   ", TOKEN_SYMBOL);
    console.log("\t\tTOKEN_SUPPLY:   ", ethers.utils.formatEther(TOKEN_SUPPLY));
    console.log("\t\tTOKEN_OWNER:    ", TOKEN_OWNER);
    console.log("\t\tTOKEN_PROVIDER: ", TOKEN_PROVIDER);

    const RevestTokenFactory = await ethers.getContractFactory("RevestToken");
    const RevestToken = await RevestTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        TOKEN_SUPPLY,
        TOKEN_OWNER,
        TOKEN_PROVIDER
    );
    await RevestToken.deployed();

    console.log(separator);
    console.log("\tDeploying RewardsHandler\n\t\tWETH ADDRESS: ", WETH_ADDRESS);
    const RewardsHandlerFactory = await ethers.getContractFactory("RewardsHandler");
    const RewardsHandler = await RewardsHandlerFactory.deploy(
        PROVIDER_ADDRESS,
        WETH_ADDRESS,
        RevestToken.address
    );
    await RewardsHandler.deployed();

    console.log(separator);
    console.log("\tDeploying TokenVault");
    const TokenVaultFactory = await ethers.getContractFactory("TokenVault");
    const TokenVault = await TokenVaultFactory.deploy(PROVIDER_ADDRESS);
    await TokenVault.deployed();

    console.log(separator);
    console.log("\tDeploying Revest");
    const RevestFactory = await ethers.getContractFactory("Revest");
    const Revest = await RevestFactory.deploy(PROVIDER_ADDRESS, WETH_ADDRESS);
    await Revest.deployed();
    

    console.log(separator);
    console.log("\tDeploying FakeERC20");
    const FakeERC20Factory = await ethers.getContractFactory("FakeERC20");
    const FakeERC20 = await FakeERC20Factory.deploy();
    await FakeERC20.deployed();


    await RevestAddressRegistry.initialize(
        LockManager.address,
        LP_ADDRESS,
        RevestToken.address,
        TokenVault.address,
        Revest.address,
        FNFTHandler.address,
        MetadataHandler.address,
        owner.address,
        RewardsHandler.address
    );

    lockManager = LockManager;
    token = RevestToken;
    vault = TokenVault;
    revest = Revest;
    nftHandler = FNFTHandler;
    metadataHandler = MetadataHandler;
    registry = RevestAddressRegistry;
    rewardsHandler = RewardsHandler;

    fakeERC20Token = FakeERC20;
    console.log(separator);
    console.log("\tDeployment Completed.\n");
    console.log("Lock Manager:             ", LockManager.address);
    console.log("RevestToken:              ", RevestToken.address);
    console.log("TokenVault:               ", TokenVault.address);
    console.log("Revest:                   ", Revest.address);
    console.log("RewardsHandler:           ", RewardsHandler.address);
    console.log("FNFTHandler:              ", FNFTHandler.address);
    console.log("MetadataHandler:          ", MetadataHandler.address);
    console.log("FakeERC20:                ", FakeERC20.address);
}

const uniswapABI = [
    {
      "inputs": [],
      "name": "WETH",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "tokenA",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenB",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amountADesired",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountBDesired",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountAMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountBMin",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "addLiquidity",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountA",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountB",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "liquidity",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amountTokenDesired",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountTokenMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountETHMin",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "addLiquidityETH",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountToken",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountETH",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "liquidity",
          "type": "uint256"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "factory",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "reserveIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "reserveOut",
          "type": "uint256"
        }
      ],
      "name": "getAmountIn",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "reserveIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "reserveOut",
          "type": "uint256"
        }
      ],
      "name": "getAmountOut",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        }
      ],
      "name": "getAmountsIn",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        }
      ],
      "name": "getAmountsOut",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountA",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "reserveA",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "reserveB",
          "type": "uint256"
        }
      ],
      "name": "quote",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountB",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "tokenA",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenB",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "liquidity",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountAMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountBMin",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "removeLiquidity",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountA",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountB",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "liquidity",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountTokenMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountETHMin",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "removeLiquidityETH",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountToken",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountETH",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "liquidity",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountTokenMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountETHMin",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "removeLiquidityETHSupportingFeeOnTransferTokens",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountETH",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "liquidity",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountTokenMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountETHMin",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "approveMax",
          "type": "bool"
        },
        {
          "internalType": "uint8",
          "name": "v",
          "type": "uint8"
        },
        {
          "internalType": "bytes32",
          "name": "r",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "s",
          "type": "bytes32"
        }
      ],
      "name": "removeLiquidityETHWithPermit",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountToken",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountETH",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "liquidity",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountTokenMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountETHMin",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "approveMax",
          "type": "bool"
        },
        {
          "internalType": "uint8",
          "name": "v",
          "type": "uint8"
        },
        {
          "internalType": "bytes32",
          "name": "r",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "s",
          "type": "bytes32"
        }
      ],
      "name": "removeLiquidityETHWithPermitSupportingFeeOnTransferTokens",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountETH",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "tokenA",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenB",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "liquidity",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountAMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountBMin",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "approveMax",
          "type": "bool"
        },
        {
          "internalType": "uint8",
          "name": "v",
          "type": "uint8"
        },
        {
          "internalType": "bytes32",
          "name": "r",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "s",
          "type": "bytes32"
        }
      ],
      "name": "removeLiquidityWithPermit",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountA",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountB",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapETHForExactTokens",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapExactETHForTokens",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapExactETHForTokensSupportingFeeOnTransferTokens",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapExactTokensForETH",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapExactTokensForETHSupportingFeeOnTransferTokens",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapExactTokensForTokens",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountInMax",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapTokensForExactETH",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountInMax",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapTokensForExactTokens",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];
