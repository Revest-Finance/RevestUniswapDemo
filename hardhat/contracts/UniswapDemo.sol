// SPDX-License-Identifier: GNU-GPL v3.0 or later

pragma solidity ^0.8.0;

import "./interfaces/IAddressRegistry.sol";
import "./interfaces/IOutputReceiverV2.sol";
import "./interfaces/ITokenVault.sol";
import "./interfaces/IRevest.sol";
import "./interfaces/IFNFTHandler.sol";
import "./interfaces/ILockManager.sol";

// OZ imports
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Uniswap imports
import "./lib/uniswap/IUniswapV2Factory.sol";
import "./lib/uniswap/IUniswapV2Pair.sol";
import "./lib/uniswap/IUniswapV2Router02.sol";

interface ITokenVaultTracker {
    function tokenTrackers(address token) external view returns (IRevest.TokenTracker memory);
}

/**
 * @title
 * @dev could add ability to airdrop ERC1155s to this, make things even more interesting
 */

contract UniswapDemo is IOutputReceiverV2, Ownable, ERC165 {
    
    using SafeERC20 for IERC20;

    // Where to find the Revest address registry that contains info about what contracts live where
    address public addressRegistry;

    // The file which tells our frontend how to visually represent such an FNFT
    string public constant METADATA = "https://revest.mypinata.cloud/ipfs/QmQm9nkwvfevS9hwvJxebo2qWji8H6cjbw9ZRKacXMLRGw";

    // Constant used for approval
    uint private constant MAX_INT = 2 ** 256 - 1;

    // Set at deployment to allow for different AMMs on different chains
    // Any fork of Uniswap v2 will work
    address private immutable UNISWAP_V2_ROUTER;

    // Maps what path a given FNFT will need to take in its AMM
    mapping (uint => address[]) public pendingTrades;

    // For tracking if a given contract has approval for token
    mapping (address => mapping (address => bool)) private approvedContracts;

    // Initialize the contract with the needed valeus
    constructor(address _provider, address _router) {
        addressRegistry = _provider;
        UNISWAP_V2_ROUTER = _router;
    }

    // Allows core Revest contracts to make sure this contract can do what is needed
    // Mandatory method
    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IOutputReceiver).interfaceId
            || interfaceId == type(IOutputReceiverV2).interfaceId
            || super.supportsInterface(interfaceId);
    }


    
    /// This function creates a time-locked FNFT that upon withdrawal will swap its contents
    /// on Uniswap following the route prescribed in pathToSwaps
    /// If that route should fail, it will just return the tokens to the person who calls withdraw
    function mintTimeLockToUniswap(
        uint endTime,
        uint amountPerFNFT,
        uint quantityFNFTs,
        address[] memory pathToSwaps
    ) external payable returns (uint fnftId) {    
        // For this function, will need to send value equal to Revest fees
        // Can be discerned via IRevest.getERC20Fee and IRevest.getFlatWeiFee
        // On Fantom, flat rate of 3 FTM
        // On Matic, flat rate of 3 MATIC

        // We know our starting asset is the first one in the path array
        address asset = pathToSwaps[0];
        // While we could use O(n) for path validation, we will proceed under the assumption that 
        // the passed in path exists. You can expand on this naive assumption if you want

        // Transfer the tokens from the user to this contract
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amountPerFNFT * quantityFNFTs);

        // Initialize the Revest config object
        IRevest.FNFTConfig memory fnftConfig;

        // Assign what ERC20 asset the FNFT will hold
        fnftConfig.asset = asset;

        // Assign how much of that asset the FNFT will hold
        fnftConfig.depositAmount = amountPerFNFT;

        // Will result in the asset being sent back to this contract upon withdrawal
        fnftConfig.pipeToContract = address(this);  

        // Set these two arrays according to Revest specifications to say
        // Who gets these FNFTs and how many copies of them we should create
        address[] memory recipients = new address[](1);
        recipients[0] = _msgSender();

        uint[] memory quantities = new uint[](1);
        quantities[0] = quantityFNFTs;

        // We use an inline block here to save a little bit of gas + stack
        // Allows us to avoid keeping the "address revest" var in memory once
        // it has served its purpose
        {
            // Retrieve the Revest controller address from the address registry
            address revest = IAddressRegistry(addressRegistry).getRevest();
            // Here, check if the controller has approval to spend tokens out of this entry point contract
            if(!approvedContracts[revest][asset]) {
                // If it doesn't, approve it
                IERC20(asset).approve(revest, MAX_INT);
                approvedContracts[revest][asset] = true;
            }

            // Mint the FNFT
            // The return gives us a unique ID we can use to store additional data
            fnftId = IRevest(revest).mintTimeLock{value:msg.value}(endTime, recipients, quantities, fnftConfig);
        }

        // Use that unique ID to store the path we want to take
        pendingTrades[fnftId] = pathToSwaps;
    }

    /// This function is called upon withdrawal of any FNFT pointing to this contract as the output receiver
    /// It automatically swaps the funds that are sent to this contract by the Revest vault on withdrawal of the FNFT
    /// and sends the output to the user – failing that, the funds that were previously in the FNFT are sent to the user
    function receiveRevestOutput(
        uint fnftId,
        address asset,
        address payable owner,
        uint quantity
    ) external override  {
        
        // Security check to make sure the Revest vault is the only contract that can call this method
        address vault = IAddressRegistry(addressRegistry).getTokenVault();
        require(_msgSender() == vault, 'E016');

        // Retreive infomation about the FNFT from the Revest vault
        IRevest.FNFTConfig memory config = ITokenVault(vault).getFNFT(fnftId);
        // Calculate how many tokens we will be swapping
        uint totalAmountToSwap = getValueCheapest(vault, config) * quantity;

        // Similar approval to before
        // Methods such as these, which grant max_int approval are acceptable here
        // because this contract serves only as a passthrough.
        // You should never do this on a contract that will be storing value
        if(!approvedContracts[UNISWAP_V2_ROUTER][asset]) {
            IERC20(asset).approve(UNISWAP_V2_ROUTER, MAX_INT);
            approvedContracts[UNISWAP_V2_ROUTER][asset] = true;
        }

        // Swaps the tokens on whatever UniswapV2 fork we have specified
        // Allows 100% slippage, could be easily set to a different value
        try IUniswapV2Router02(UNISWAP_V2_ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                totalAmountToSwap, 
                0, 
                pendingTrades[fnftId], 
                owner, 
                block.timestamp
        ) {
            // Successful transaction, move on
        } catch {
            // Utilize fail-safe to avoid total reversion, transfer tokens to caller
            IERC20(asset).safeTransfer(owner, totalAmountToSwap);
        }
        // Perform garbage cleanup to use less on-chain storage
        if(quantity == IFNFTHandler(IAddressRegistry(addressRegistry).getRevestFNFT()).getSupply(fnftId)) {
            // Then we have traded every FNFT in this series and we can perform garbage clean up
            delete pendingTrades[fnftId];
        }
    }

    // Not applicable, as these cannot be split
    // Why not? We don't enable it in IRevest.FNFTConfig
    function handleFNFTRemaps(uint, uint[] memory, address, bool) external pure override {
        require(false, 'Not applicable');
    }

    function handleAdditionalDeposit(uint, uint, address) external {}

    // Allows custom parameters to be passed during withdrawals
    // This and the proceeding method are both parts of the V2 output receiver interface
    // and not typically necessary. For the sake of demonstration, they are included
    function receiveSecondaryCallback(
        uint fnftId,
        address payable owner,
        uint quantity,
        IRevest.FNFTConfig memory config,
        bytes memory args
    ) external payable override {}

    // Not necessary for this system
    // The aforementioned also applies to this functions
    function triggerOutputReceiverUpdate(
        uint fnftId,
        bytes memory args
    ) external override {}


    function getCustomMetadata(uint) external pure override returns (string memory) {
        return METADATA;
    }

    function getValue(uint fnftId) public view override returns (uint) {
        address vault = IAddressRegistry(addressRegistry).getTokenVault();
        return getValueCheaper(fnftId, vault);
    }

    function getValueCheaper(uint fnftId, address vault) internal view returns (uint) {
        IRevest.FNFTConfig memory config = ITokenVault(vault).getFNFT(fnftId);
        return getValueCheapest(vault, config);
    }

    function getValueCheapest(address vault, IRevest.FNFTConfig memory config) internal view returns (uint) {
        IRevest.TokenTracker memory tracker = ITokenVaultTracker(vault).tokenTrackers(config.asset);
        return config.depositAmount * tracker.lastMul / config.depositMul;
    }

    function getAsset(uint fnftId) external view override returns (address) {
        return ITokenVault(IAddressRegistry(addressRegistry).getTokenVault()).getFNFT(fnftId).asset;
    }

    function getOutputDisplayValues(uint fnftId) external view override returns (bytes memory) {
        string memory ticker;
        try IERC20Metadata(pendingTrades[fnftId][pendingTrades[fnftId].length - 1]).symbol() returns (string memory output) {
            ticker = output;
        } catch {
            ticker = "????";
        }
        uint[] memory amountsOut = IUniswapV2Router02(UNISWAP_V2_ROUTER).getAmountsOut(getValue(fnftId), pendingTrades[fnftId]);
        uint8 decimals;
        try IERC20Metadata(pendingTrades[fnftId][pendingTrades[fnftId].length - 1]).decimals() returns (uint8 dec) {
            decimals = dec;
        } catch {
            decimals = 18;
        }
        return abi.encode(amountsOut[amountsOut.length - 1], decimals, ticker);
    }

    function setAddressRegistry(address addressRegistry_) external override onlyOwner {
        addressRegistry = addressRegistry_;
    }

    function getAddressRegistry() external view override returns (address) {
        return addressRegistry;
    }

    function getRevest() internal view returns (IRevest) {
        return IRevest(IAddressRegistry(addressRegistry).getRevest());
    }

    
}
