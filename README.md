# Setup

1. cd into hardhat
2. Run npm install
3. Create a .env file under /hardhat according to .envtemplate
4. Use "npx hardhat run scripts/deploy-uniswap-test.js --network YOURNETWORKHERE" to deploy the contract
5. Use 'npx hardhat run scripts/verify-uniswap-test.js --network YOURNETWORKHERE" to verify the contract after pasting its address in

# Notes
The contract uses the JSON file found at uniswapTest.json to render its information on the frontend

Locking tokens in an FNFT through the endpoint present in UniswapDemo.sol "mintTimeLockToUniswap" will create an FNFT that sends the tokens inside of it to Uniswap upon withdrawal, swaps them for the tokens specified by the "path" variable during creation (sourced via normal Uniswap frontend methods), and sends the resulting output to the user making the withdrawal from the FNFT

Things not discussed in detail for this tech demo:

1. FNFTs need not contain actual assets: address(0) casting is perfectly acceptable, and "output receivers" will display their asset based on the "getAsset" call in their interface, rather than the actual asset stored in Revest's vaults
2. FNFTs can contain zero amounts of an actual asset (allowing for deposits of that asset later in time) and they can also contain non-zero amounts of a null asset (address(0)). This makes storing an "amount" variable in the default system more straightforward even when assets are being stored in other locations

# Deployment

This demo is currently deployed on Fantom Opera at 0x06ee1030AF860441bAeA4a2811843Ad312f9F766

# Contracts

Public Revest Contracts are available at https://github.com/Revest-Finance/RevestContracts
