// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@cryptovarna/tron-contracts/contracts/token/TRC20/TRC20.sol";

/**
 * @title MockTRC20
 * @notice Mock TRC20 token for testing purposes
 */
contract MockTRC20 is TRC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint256 initialSupply) TRC20(name, symbol) {
        _decimals = 6; // Standard for TRON tokens (like USDT)
        _mint(msg.sender, initialSupply);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
