// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@cryptovarna/tron-contracts/contracts/token/TRC20/TRC20.sol";

/**
 * @title MockWTRX
 * @notice Mock implementation of WTRX for testing purposes
 */
contract MockWTRX is TRC20 {
    constructor() TRC20("Wrapped TRX", "WTRX") {
        // Mint a large supply to allow testing
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return 6; // WTRX typically uses 6 decimals like USDT
    }
}