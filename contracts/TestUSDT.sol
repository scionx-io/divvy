// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@cryptovarna/tron-contracts/contracts/token/TRC20/TRC20.sol";

/**
 * @title TestUSDT
 * @dev Simple USDT mock for Shasta testnet testing
 * Allows anyone to mint tokens for testing purposes
 */
contract TestUSDT is TRC20 {
    uint8 private _decimals;

    constructor() TRC20("Test USDT", "USDT") {
        _decimals = 6; // USDT uses 6 decimals
        // Mint 1,000,000 USDT to deployer for testing
        _mint(msg.sender, 1000000 * 10**6);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Allows anyone to mint tokens for testing
     */
    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    /**
     * @dev Convenience function to mint with 6 decimal places
     * Example: mintTokens(100) mints 100 USDT
     */
    function mintTokens(uint256 amountInTokens) public {
        _mint(msg.sender, amountInTokens * 10**6);
    }
}
