// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@cryptovarna/tron-contracts/contracts/utils/Context.sol";
import "@cryptovarna/tron-contracts/contracts/access/Ownable.sol";
import "@cryptovarna/tron-contracts/contracts/token/TRC20/ITRC20.sol";
import "@cryptovarna/tron-contracts/contracts/token/TRC20/utils/SafeTRC20.sol";

/**
 * @title Sweepable (TRON version)
 * @notice Provides a `sweeper` role that can recover stuck TRX or TRC20 tokens
 * @dev Intended for use in upgradeable or user-facing contracts to rescue funds
 */
abstract contract Sweepable is Context, Ownable {
    using SafeTRC20 for ITRC20;

    /// @dev Address of the current sweeper
    address private _sweeper;

    /// @notice Emitted when the sweeper role is changed
    event SweeperUpdated(address indexed previousSweeper, address indexed newSweeper);

    /// @notice Error when address is zero
    error CannotBeZeroAddress();

    /// @notice Error when caller is not sweeper
    error CallerNotSweeper();

    /// @notice Error when transfer fails
    error TransferError();

    /// @notice Error when contract has zero balance
    error ZeroBalance();

    /// @notice Error when contract doesn't have enough balance
    error InsufficientBalance(uint256 deficit);

    /// @dev Restricts call to current sweeper
    modifier onlySweeper() {
        if (_msgSender() != _sweeper) {
            revert CallerNotSweeper();
        }
        _;
    }

    modifier notZero(address a) {
        if (a == address(0)) revert CannotBeZeroAddress();
        _;
    }

    /// @notice Returns current sweeper address
    function sweeper() public view returns (address) {
        return _sweeper;
    }

    /// @notice Sets or updates sweeper
    /// @dev Only owner can call
    function setSweeper(address newSweeper) public onlyOwner notZero(newSweeper) {
        address old = _sweeper;
        _sweeper = newSweeper;
        emit SweeperUpdated(old, newSweeper);
    }

    /// @notice Sweep entire TRX balance to a destination
    function sweepTRX(address payable destination) public onlySweeper notZero(destination) {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroBalance();

        (bool success, ) = destination.call{value: balance}("");
        if (!success) revert TransferError();
    }

    /// @notice Sweep a specific TRX amount to a destination
    function sweepTRXAmount(address payable destination, uint256 amount)
        public
        onlySweeper
        notZero(destination)
    {
        uint256 balance = address(this).balance;
        if (balance < amount) revert InsufficientBalance(amount - balance);

        (bool success, ) = destination.call{value: amount}("");
        if (!success) revert TransferError();
    }

    /// @notice Sweep entire TRC20 token balance to a destination
    function sweepToken(address token, address destination)
        public
        onlySweeper
        notZero(destination)
    {
        ITRC20 t = ITRC20(token);
        uint256 balance = t.balanceOf(address(this));
        if (balance == 0) revert ZeroBalance();
        t.safeTransfer(destination, balance);
    }

    /// @notice Sweep a specific TRC20 amount to a destination
    function sweepTokenAmount(address token, address destination, uint256 amount)
        public
        onlySweeper
        notZero(destination)
    {
        ITRC20 t = ITRC20(token);
        uint256 balance = t.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance(amount - balance);
        t.safeTransfer(destination, amount);
    }

    /// @notice Allow contract to receive TRX
    receive() external payable {}
}