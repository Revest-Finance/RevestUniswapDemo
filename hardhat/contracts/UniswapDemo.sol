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

    address public addressRegistry;
    string public constant METADATA = "https://revest.mypinata.cloud/ipfs/QmQm9nkwvfevS9hwvJxebo2qWji8H6cjbw9ZRKacXMLRGw";

    uint public constant PRECISION = 10**27;
    uint private constant MAX_INT = 2 ** 256 - 1;
    address private constant UNISWAP_V2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    mapping (uint => address[]) public pendingTrades;

    // Gas saving measure
    mapping (uint => bool) private approvedTokens;

    constructor(address _provider) {
        addressRegistry = _provider;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IOutputReceiver).interfaceId
            || interfaceId == type(IOutputReceiverV2).interfaceId
            || super.supportsInterface(interfaceId);
    }

    function mintTimeLockToUniswap(
        uint endTime,
        uint amountPerFNFT,
        uint quantityFNFTs,
        address[] memory pathToSwaps
    ) external payable returns (uint fnftId) {        
        // We know our starting asset is the first one in the path array
        address asset = pathToSwaps[0];
        // While we could use O(n) for path validation, we will proceed under the assumption that 
        // the passed in path exists. You can expand on this naive assumption if you want
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amountPerFNFT * quantityFNFTs);

        IRevest.FNFTConfig memory fnftConfig;
        fnftConfig.asset = asset;
        fnftConfig.depositAmount = amountPerFNFT;

        // Will result in the asset being sent back to this contract upon withdrawal
        fnftConfig.pipeToContract = address(this);

        address[] memory recipients = new address[](1);
        recipients[0] = _msgSender();

        uint[] memory quantities = new uint[](1);
        quantities[0] = quantityFNFTs;

        // Gives us a unique ID we can use to store additional data
        fnftId = getRevest().mintTimeLock(endTime, recipients, quantities, fnftConfig);

        // Use that unique ID to store the path we want to take
        pendingTrades[fnftId] = pathToSwaps;
    }

    /// Function to allow for the withdrawal of the underlying NFT
    function receiveRevestOutput(
        uint fnftId,
        address asset,
        address payable owner,
        uint quantity
    ) external override  {
        address vault = IAddressRegistry(addressRegistry).getTokenVault();
        require(_msgSender() == vault, 'E016');

        IRevest.FNFTConfig memory config = ITokenVault(vault).getFNFT(fnftId);
        uint totalAmountToSwap = getValueCheapest(vault, config) * quantity;
        
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

        if(quantity == IFNFTHandler(IAddressRegistry(addressRegistry).getRevestFNFT()).getSupply(fnftId)) {
            // Then we have traded every FNFT in this series and we can perform garbage clean up
            delete pendingTrades[fnftId];
        }
    }

    // Not applicable, as these cannot be split
    // Why not? We don't enable it in IRevest.FNFTConfig
    function handleFNFTRemaps(uint, uint[] memory, bool) external pure override {
        require(false, 'Not applicable');
    }

    // Allows custom parameters to be passed during withdrawals
    function receiveSecondaryCallback(
        uint fnftId,
        address payable owner,
        uint quantity,
        IRevest.FNFTConfig memory config,
        bytes memory args
    ) external override {}

    // Not necessary for this system
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
