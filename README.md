Running deploy-uniswap-test.js will deploy the testing contract on your network of choice

The contract uses the JSON file found at uniswapTest.json to render its information on the frontend

Locking tokens in an FNFT through the endpoint present in UniswapDemo.sol "mintTimeLockToUniswap" will create an FNFT that sends the tokens inside of it to Uniswap upon withdrawal, swaps them for the tokens specified by the "path" variable during creation (sourced via normal Uniswap frontend methods), and sends the resulting output to the user making the withdrawal from the FNFT

Things not discussed in detail for this tech demo:

1. FNFTs need not contain actual assets: address(0) casting is perfectly acceptable, and "output receivers" will display their asset based on the "getAsset" call in their interface, rather than the actual asset stored in Revest's vaults
2. FNFTs can contain zero amounts of an actual asset (allowing for deposits of that asset later in time) and they can also contain non-zero amounts of a null asset (address(0)). This makes storing an "amount" variable in the default system more straightforward even when assets are being stored in other locations