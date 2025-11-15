// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISmartExchangeRouter
 * @dev Interface for SmartExchangeRouter, which supports multiple swap protocols
 */
interface ISmartExchangeRouter {
    struct ExactOutputParams {
        address[] path;
        uint24[] fees;
        uint256 amountOut;
        uint256 amountInMaximum;
        address to;
        uint256 deadline;
    }
    
    /// @notice Swaps as little as possible of one token for `amountOut` of another along the specified path (reversed)
    /// @param path Token addresses in reverse order (output token first, input token last)
    /// @param fees Pool fees for each hop (must match path length - 1)
    /// @param amountOut Exact amount of output token desired
    /// @param amountInMaximum Maximum amount of input token willing to spend
    /// @param to Address where output token transfers to
    /// @param deadline Time after which this transaction can no longer be executed
    /// @return amountIn Actual amount of input token spent
    function swapExactOutput(
        address[] calldata path,
        uint24[] calldata fees,
        uint256 amountOut,
        uint256 amountInMaximum,
        address to,
        uint256 deadline
    ) external payable returns(uint256 amountIn);

    /// @notice Returns the address of WTRX (Wrapped TRX)
    function WTRX() external view returns (address);
}