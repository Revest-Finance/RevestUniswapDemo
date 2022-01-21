const hre = require("hardhat");
const ethers = hre.ethers;

const PROVIDERS = {
    1:'0xD721A90dd7e010c8C5E022cc0100c55aC78E0FC4',
    4:"0x21744C9A65608645E1b39a4596C39848078C2865",
    137:"0xC03bB46b3BFD42e6a2bf20aD6Fa660e4Bd3736F8",
    250:"0xe0741aE6a8A6D87A68B7b36973d8740704Fd62B9",
    43114:"0x64e12fEA089e52A06A7A76028C809159ba4c1b1a"
};

const UNISWAP = {
    1: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    4: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    137: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", //QuickSwap
    250: "0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52", //SpiritSwap
    43114: "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"//Pangolin
}


// Current is Fantom Opera deployment



async function main() {

    let DEPLOYED_CONTRACT = "0x9A04847dd18161DC3699CACa5d108622d011b81a"

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    await run("verify:verify", {
        address: DEPLOYED_CONTRACT,
        constructorArguments: [
            PROVIDERS[chainId],
            UNISWAP[chainId]
        ],
    });


}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
