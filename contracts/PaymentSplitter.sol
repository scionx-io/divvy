// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@cryptovarna/tron-contracts/contracts/token/TRC20/ITRC20.sol";
import "@cryptovarna/tron-contracts/contracts/token/TRC20/utils/SafeTRC20.sol";
import "@cryptovarna/tron-contracts/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IPaymentSplitter.sol";

/**
 * @title PaymentSplitter
 * @dev Splits TRC20 token payments between recipients and operators with fees
 * @notice Only supports standard TRC20 tokens (no fee-on-transfer or rebasing tokens)
 * @notice Uses direct transfers (no reentrancy risk, no need for ReentrancyGuard)
 */
contract PaymentSplitter is IPaymentSplitter {
    using SafeTRC20 for ITRC20;
    using ECDSA for bytes32;

    /// @dev Mapping from operator address to their fee destination
    mapping(address => address) private feeDestinations;

    /// @dev Mapping to track processed payments: operator => payment ID => processed
    mapping(address => mapping(bytes16 => bool)) private processedPayments;
    
    event OperatorRegistered(address indexed operator, address indexed feeDestination);
    event OperatorUnregistered(address indexed operator);
    event FeeDestinationUpdated(address indexed operator, address indexed oldDestination, address indexed newDestination);
    event PaymentProcessed(
        address indexed operator, 
        bytes16 indexed id, 
        address indexed recipient, 
        address sender, 
        uint256 recipientAmount,
        uint256 feeAmount,
        address token
    );

    /**
     * @notice Register operator with custom fee destination
     * @param _feeDestination Address where fees will be sent (cannot be zero address)
     * @dev Operator can change fee destination at any time
     */
    function registerOperatorWithFeeDestination(address _feeDestination) external {
        require(_feeDestination != address(0), "Invalid fee destination");

        address oldDestination = feeDestinations[msg.sender];
        feeDestinations[msg.sender] = _feeDestination;

        if (oldDestination == address(0)) {
            emit OperatorRegistered(msg.sender, _feeDestination);
        } else {
            emit FeeDestinationUpdated(msg.sender, oldDestination, _feeDestination);
        }
    }

    /**
     * @notice Register operator using operator's address as fee destination
     */
    function registerOperator() external {
        address oldDestination = feeDestinations[msg.sender];
        feeDestinations[msg.sender] = msg.sender;

        if (oldDestination == address(0)) {
            emit OperatorRegistered(msg.sender, msg.sender);
        } else {
            emit FeeDestinationUpdated(msg.sender, oldDestination, msg.sender);
        }
    }

    /**
     * @notice Unregister operator
     * @dev WARNING: Operator can front-run splitPayment() calls by unregistering,
     *      causing user transactions to revert. This is acceptable behavior as
     *      operators control their own service availability.
     */
    function unregisterOperator() external {
        require(feeDestinations[msg.sender] != address(0), "Operator not registered");
        delete feeDestinations[msg.sender];
        emit OperatorUnregistered(msg.sender);
    }

    /**
     * @notice Split TRC20 token payment between recipient and operator
     * @param intent SplitPaymentIntent struct containing all payment parameters
     */
    function splitPayment(SplitPaymentIntent calldata intent) external {
        // Validate operator registration
        require(feeDestinations[intent.operator] != address(0), "Operator not registered");

        // Validate signature
        _validateSignature(intent, msg.sender);

        // Validate payment parameters
        require(block.timestamp <= intent.deadline, "Payment expired");
        require(intent.recipient != address(0), "Invalid recipient address");
        require(intent.token != address(0), "Invalid token address");
        require(!processedPayments[intent.operator][intent.id], "Payment already processed");

        uint256 totalAmount = intent.recipientAmount + intent.feeAmount;
        require(totalAmount > 0, "Total amount must be greater than 0");

        // Determine refund destination: if not provided, use msg.sender
        address actualRefundDestination = intent.refundDestination == address(0)
            ? msg.sender
            : intent.refundDestination;

        // CRITICAL: Mark as processed BEFORE any external calls (Checks-Effects-Interactions)
        processedPayments[intent.operator][intent.id] = true;

        // Execute transfers
        ITRC20 paymentToken = ITRC20(intent.token);
        address feeDestination = feeDestinations[intent.operator];

        // Transfer to recipient
        if (intent.recipientAmount > 0) {
            paymentToken.safeTransferFrom(msg.sender, intent.recipient, intent.recipientAmount);
        }

        // Transfer fee to operator's destination
        if (intent.feeAmount > 0) {
            paymentToken.safeTransferFrom(msg.sender, feeDestination, intent.feeAmount);
        }

        emit PaymentProcessed(
            intent.operator,
            intent.id,
            intent.recipient,
            msg.sender,
            intent.recipientAmount,
            intent.feeAmount,
            intent.token
        );
    }

    /**
     * @dev Validates the operator's signature on the payment intent
     * @param intent The payment intent to validate
     * @param sender The address initiating the payment
     */
    function _validateSignature(
        SplitPaymentIntent calldata intent,
        address sender
    ) private view {
        bytes32 hash = keccak256(
            abi.encodePacked(
                intent.recipientAmount,
                intent.deadline,
                intent.recipient,
                intent.token,
                intent.refundDestination,
                intent.feeAmount,
                intent.id,
                intent.operator,
                sender,
                address(this)
            )
        );

        bytes32 signedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        address signer = signedMessageHash.recover(intent.signature);

        require(signer == intent.operator, "Invalid signature");
    }

    /**
     * @notice Check if a payment has been processed
     * @param operator Operator address
     * @param id Payment identifier
     * @return True if payment has been processed
     */
    function isPaymentProcessed(address operator, bytes16 id) external view returns (bool) {
        return processedPayments[operator][id];
    }

    /**
     * @notice Get fee destination for an operator
     * @param operator Operator address
     * @return Fee destination address (zero address if not registered)
     */
    function getFeeDestination(address operator) external view returns (address) {
        return feeDestinations[operator];
    }

    /**
     * @notice Check if an operator is registered
     * @param operator Operator address
     * @return True if operator is registered
     */
    function isOperatorRegistered(address operator) external view returns (bool) {
        return feeDestinations[operator] != address(0);
    }
}