// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./IPaymentSplitter.sol";

/**
 * @title IPaymentSplitterWithSwap
 * @dev Interface for PaymentSplitter contract with token swap functionality
 */
interface IPaymentSplitterWithSwap {
    /// @dev Structure for base swap request parameters
    struct BaseRequest {
        uint256 fromToken;              // Source token address as uint256
        uint256 toToken;                // Target token address as uint256 
        uint256 fromTokenAmount;        // Amount of source token to swap
        uint256 minReturnAmount;        // Minimum amount of target token to receive
        uint256 deadLine;               // Deadline timestamp for the swap
    }

    /// @dev Structure for router path in swap operations
    struct RouterPath {
        address[] mixAdapters;          // Array of adapter addresses to use for the swap
        address[] assetTo;              // Array of destination addresses for assets
        uint256[] rawData;              // Raw data for adapter-specific parameters
        bytes[] extraData;              // Extra data for adapter-specific parameters
        uint256 fromToken;              // Source token for this path
    }

    /// @notice Payment intent structure containing all parameters for a split payment with swap
    struct SplitPaymentWithSwapIntent {
        address recipient;               // Address to receive the payment (in target token)
        address sourceToken;             // TRC20 token address being paid with
        address targetToken;             // TRC20 token address merchant wants to receive
        uint256 sourceAmount;            // Amount of source token being sent by payer
        uint256 expectedTargetAmount;    // Expected amount of target token to be received by recipient
        uint256 operatorFeeAmount;       // Fee amount for the operator (in source token)
        address operator;                // Operator authorizing the payment
        bytes16 id;                      // Unique payment identifier
        uint256 deadline;                // Expiration timestamp
        address refundDestination;       // Where to send refunds (optional, defaults to sender)
        bytes signature;                 // Operator's signature
        uint256 minAmountOut;            // Minimum amount of target token to receive (for slippage protection)
        address swapRouter;              // Address of the DEX router to use for swapping (OKX DEX Router)
        
        // OKX DEX specific parameters
        uint256 orderId;                 // Order ID for the swap (0 for single swaps)
        BaseRequest baseRequest;         // Base request parameters for the swap
        uint256[] batchesAmount;         // Amounts for each batch
        RouterPath[][] batches;          // Array of routing paths for the swap
        bytes[] extraData;               // Extra data for swap operations
    }

    /// @notice Emitted when a payment with swap is successfully processed
    event PaymentProcessedWithSwap(
        address indexed operator,
        bytes16 indexed id,
        address indexed recipient,
        address sender,
        uint256 sourceAmount,
        uint256 targetAmountReceived,
        uint256 operatorFeeAmount,
        address sourceToken,
        address targetToken
    );

    /**
     * @notice Split TRC20 token payment with swap conversion
     * @param intent SplitPaymentWithSwapIntent struct containing all payment parameters
     */
    function splitPaymentWithSwap(SplitPaymentWithSwapIntent calldata intent) external;

    /**
     * @notice Check if a payment with swap has been processed
     * @param operator Operator address
     * @param id Payment identifier
     * @return True if payment has been processed
     */
    function isPaymentProcessedWithSwap(address operator, bytes16 id) external view returns (bool);
}