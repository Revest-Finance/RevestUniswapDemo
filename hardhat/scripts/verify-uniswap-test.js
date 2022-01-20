const hre = require("hardhat");
const ethers = hre.ethers;

const PROVIDERS = {
    1:'0xD721A90dd7e010c8C5E022cc0100c55aC78E0FC4',
    4:"0x21744C9A65608645E1b39a4596C39848078C2865",
    137:"0xC03bB46b3BFD42e6a2bf20aD6Fa660e4Bd3736F8",
    250:"0xe0741aE6a8A6D87A68B7b36973d8740704Fd62B9",
    43114:"0x64e12fEA089e52A06A7A76028C809159ba4c1b1a"
};

// Current is Fantom Opera deployment



async function main() {

    let DEPLOYED_CONTRACT = "0x777d4069b6a4BDf5a33aa5Ec015258c1bb46c013"

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    await run("verify:verify", {
        address: DEPLOYED_CONTRACT,
        constructorArguments: [
            "0xe0741aE6a8A6D87A68B7b36973d8740704Fd62B9"
        ],
    });


}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
