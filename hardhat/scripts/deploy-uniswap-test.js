const hre = require("hardhat");
const ethers = hre.ethers;
const fs = require('fs');

const seperator = "\t-----------------------------------------"

async function main() {

    const PROVIDERS = {
        1:'0xD721A90dd7e010c8C5E022cc0100c55aC78E0FC4',
        4:"0x21744C9A65608645E1b39a4596C39848078C2865",
        137:"0xC03bB46b3BFD42e6a2bf20aD6Fa660e4Bd3736F8",
        250:"0xe0741aE6a8A6D87A68B7b36973d8740704Fd62B9",
        43114:"0x64e12fEA089e52A06A7A76028C809159ba4c1b1a"
    };

    const WETH ={
        1:"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        4:"0xc778417e063141139fce010982780140aa0cd5ab",
        137:"0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
        250:"0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83",
        43114:"0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"
    };

    const signers = await ethers.getSigners();
    const owner = signers[0];
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    let PROVIDER_ADDRESS = PROVIDERS[chainId];
    
    console.log(seperator);
    console.log("\tDeploying Uniswap Test System");
    const UniswapDemoFactory = await ethers.getContractFactory("UniswapDemo");
    const UniswapDemo = await UniswapDemoFactory.deploy(PROVIDER_ADDRESS);
    await UniswapDemo.deployed();
    console.log("UniswapDemo Deployed at: " + UniswapDemo.address);

}



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log("Deployment Error.\n\n----------------------------------------------\n");
        console.error(error);
        process.exit(1);
    })
