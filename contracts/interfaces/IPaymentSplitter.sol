// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title IPaymentSplitter
 * @dev Interface for PaymentSplitter contract
 */
interface IPaymentSplitter {
    /// @notice Payment intent structure containing all parameters for a split payment
    struct SplitPaymentIntent {
        address recipient;           // Address to receive the payment
        address token;               // TRC20 token address
        uint256 recipientAmount;     // Amount to send to recipient
        address operator;            // Operator authorizing the payment
        uint256 feeAmount;           // Fee amount for the operator
        bytes16 id;                  // Unique payment identifier
        uint256 deadline;            // Expiration timestamp
        address refundDestination;   // Where to send refunds (optional, defaults to sender)
        bytes signature;             // Operator's signature
    }

    /// @notice Emitted when an operator registers
    event OperatorRegistered(address indexed operator, address indexed feeDestination);

    /// @notice Emitted when an operator unregisters
    event OperatorUnregistered(address indexed operator);

    /// @notice Emitted when an operator updates their fee destination
    event FeeDestinationUpdated(
        address indexed operator,
        address indexed oldDestination,
        address indexed newDestination
    );

    /// @notice Emitted when a payment is successfully processed
    event PaymentProcessed(
        address indexed operator,
        bytes16 indexed id,
        address indexed recipient,
        address sender,
        uint256 recipientAmount,
        uint256 feeAmount,
        address token
    );

    /// @notice Emitted when a swap payment is successfully processed
    /// @param operator Operator who signed the payment intent
    /// @param id Unique payment identifier
    /// @param recipient Address receiving the payment
    /// @param sender Address who initiated the payment
    /// @param spentAmount Amount of input token actually spent by user
    /// @param spentCurrency Address of input token spent (address(0) for TRX)
    event SwapPaymentProcessed(
        address indexed operator,
        bytes16 indexed id,
        address indexed recipient,
        address sender,
        uint256 spentAmount,
        address spentCurrency
    );

    /// @notice Thrown when tokenIn equals intent.token (no swap needed)
    error NoSwapNeeded();

    /// @notice Thrown when Smart Router swap fails
    /// @param reason The error reason from the router
    error SwapFailed(string reason);

    /**
     * @notice Register operator with custom fee destination
     * @param _feeDestination Address where fees will be sent (cannot be zero address)
     * @dev Operator can change fee destination at any time
     */
    function registerOperatorWithFeeDestination(address _feeDestination) external;

    /**
     * @notice Unregister operator
     * @dev WARNING: Operator can front-run splitPayment() calls by unregistering,
     *      causing user transactions to revert. This is acceptable behavior as
     *      operators control their own service availability.
     */
    function unregisterOperator() external;

    /**
     * @notice Split TRC20 token payment between recipient and operator
     * @param intent SplitPaymentIntent struct containing all payment parameters
     */
    function splitPayment(SplitPaymentIntent calldata intent) external;

    /**
     * @notice Check if a payment has been processed
     * @param operator Operator address
     * @param id Payment identifier
     * @return True if payment has been processed
     */
    function isPaymentProcessed(address operator, bytes16 id) external view returns (bool);

    /**
     * @notice Get fee destination for an operator
     * @param operator Operator address
     * @return Fee destination address (zero address if not registered)
     */
    function getFeeDestination(address operator) external view returns (address);

    /**
     * @notice Check if an operator is registered
     * @param operator Operator address
     * @return True if operator is registered
     */
    function isOperatorRegistered(address operator) external view returns (bool);

    /// @notice Swap input token via SunSwap V3 and split output between recipient and operator
    /// @param intent Payment intent specifying output token and exact amounts
    /// @param tokenIn Input token address (address(0) for native TRX)
    /// @param exactAmountToPay Exact input tokens to spend (from quoter)
    /// @param fees Array of pool fees for each hop (for multi-hop swaps)
    function swapAndSplitPayment(
        SplitPaymentIntent calldata intent,
        address tokenIn,
        uint256 exactAmountToPay,
        uint24[] calldata fees
    ) external payable;
}