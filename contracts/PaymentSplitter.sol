// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@cryptovarna/tron-contracts/contracts/token/TRC20/ITRC20.sol";
import "@cryptovarna/tron-contracts/contracts/token/TRC20/utils/SafeTRC20.sol";

/**
 * @title PaymentSplitter
 * @dev Splits TRC20 token payments between recipients and operators with fees
 * @notice Only supports standard TRC20 tokens (no fee-on-transfer or rebasing tokens)
 * @notice Uses direct transfers (no reentrancy risk, no need for ReentrancyGuard)
 */
contract PaymentSplitter {
    using SafeTRC20 for ITRC20;
    
    mapping(address => address) private feeDestinations;
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
     * @param recipient Address to receive the payment (cannot be zero address)
     * @param token TRC20 token contract address (cannot be zero address)
     * @param recipientAmount Amount to send to recipient
     * @param operator Registered operator address (cannot be zero address)
     * @param feeAmount Fee amount to send to operator
     * @param id Unique payment identifier to prevent replay attacks
     */
    function splitPayment(
        address recipient,
        address token,
        uint256 recipientAmount,
        address operator,
        uint256 feeAmount,
        bytes16 id
    ) external {
        // Input validation
        require(operator != address(0), "Invalid operator address");
        require(feeDestinations[operator] != address(0), "Operator not registered");
        require(recipient != address(0), "Invalid recipient address");
        require(token != address(0), "Invalid token address");
        require(!processedPayments[operator][id], "Payment already processed");
        
        uint256 totalAmount = recipientAmount + feeAmount;
        require(totalAmount > 0, "Total amount must be greater than 0");
        
        // CRITICAL: Mark as processed BEFORE any external calls (Checks-Effects-Interactions)
        processedPayments[operator][id] = true;
        
        // External interactions - Direct transfers (no intermediate contract storage)
        ITRC20 paymentToken = ITRC20(token);
        address feeDestination = feeDestinations[operator];

        // Transfer directly to recipient (more efficient and secure)
        if (recipientAmount > 0) {
            paymentToken.safeTransferFrom(msg.sender, recipient, recipientAmount);
        }

        // Transfer fee directly to operator's destination
        if (feeAmount > 0) {
            paymentToken.safeTransferFrom(msg.sender, feeDestination, feeAmount);
        }
        
        emit PaymentProcessed(operator, id, recipient, msg.sender, recipientAmount, feeAmount, token);
    }

    /**
     * @notice Check if a payment has been processed
     * @param operator Operator address
     * @param id Payment identifier
     * @return bool True if payment has been processed
     */
    function isPaymentProcessed(address operator, bytes16 id) external view returns (bool) {
        return processedPayments[operator][id];
    }

    /**
     * @notice Get fee destination for an operator
     * @param operator Operator address
     * @return address Fee destination address (zero address if not registered)
     */
    function getFeeDestination(address operator) external view returns (address) {
        return feeDestinations[operator];
    }
    
    /**
     * @notice Check if an operator is registered
     * @param operator Operator address
     * @return bool True if operator is registered
     */
    function isOperatorRegistered(address operator) external view returns (bool) {
        return feeDestinations[operator] != address(0);
    }
}