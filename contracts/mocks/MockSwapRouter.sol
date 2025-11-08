// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "../interfaces/ISwapRouter.sol";

/**
 * @title MockSwapRouter
 * @notice Mock implementation of ISwapRouter for testing purposes
 */
contract MockSwapRouter is ISwapRouter {
    // Mock implementation that simply returns the maximum amounts without performing real swaps
    // This allows us to test the PaymentSplitter functionality without actual swap logic
    
    function exactInputSingle(ExactInputSingleParams calldata params) 
        external 
        payable 
        returns (uint256 amountOut) 
    {
        // For testing, return the minimum expected amount
        return params.amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) 
        external 
        payable 
        returns (uint256 amountOut) 
    {
        return params.amountOutMinimum;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params) 
        external 
        payable 
        returns (uint256 amountIn) 
    {
        // For testing, return the maximum allowed input amount
        // In a real implementation, this would be calculated based on the swap
        return params.amountInMaximum;
    }

    function exactOutput(ExactOutputParams calldata params) 
        external 
        payable 
        returns (uint256 amountIn) 
    {
        return params.amountInMaximum;
    }
}