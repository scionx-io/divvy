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
 * @notice Deployed on TRON network
 */
contract PaymentSplitter is IPaymentSplitter {
    using SafeTRC20 for ITRC20;
    using ECDSA for bytes32;

    /// @dev Mapping from operator address to their fee destination
    mapping(address => address) private feeDestinations;

    /// @dev Mapping to track processed payments: operator => payment ID => processed
    mapping(address => mapping(bytes16 => bool)) private processedPayments;

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
    function splitPayment(SplitPaymentIntent calldata intent)
        external
    {
        // CRITICAL: Check for zero address BEFORE accessing mapping to avoid TRON Shasta issue
        require(intent.operator != address(0), "Operator cannot be zero address");
        
        // Validate operator is registered
        require(feeDestinations[intent.operator] != address(0), "Operator not registered");
        
        // Perform signature validation manually (inlined from validPayment modifier)
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
                block.chainid,  // Prevents replay attacks (TRON supports this since v4.1.0)
                msg.sender,
                address(this)
            )
        );

        // TRON TIP-191 standard message signing prefix
        bytes32 signedMessageHash = keccak256(
            abi.encodePacked("\x19Tron Signed Message:\n32", hash)
        );
        address signer = signedMessageHash.recover(intent.signature);

        require(signer == intent.operator, "Invalid signature");
        
        // Validate timing
        require(block.timestamp <= intent.deadline, "Payment expired");

        // Validate addresses
        require(intent.recipient != address(0), "Invalid recipient address");
        require(intent.token != address(0), "Invalid token address");

        // Check if already processed
        require(!processedPayments[intent.operator][intent.id], "Payment already processed");

        // Validate amounts
        require(intent.recipientAmount > 0 || intent.feeAmount > 0, "No amounts to transfer");

        // Validate token is a contract
        require(intent.token.code.length > 0, "Token not a contract");

        // CRITICAL: Mark as processed BEFORE any external calls (Checks-Effects-Interactions)
        processedPayments[intent.operator][intent.id] = true;

        // Execute transfers
        ITRC20 paymentToken = ITRC20(intent.token);
        address feeDestination = feeDestinations[intent.operator];

        // Transfer to recipient (direct transfer - more gas efficient on TRON)
        if (intent.recipientAmount > 0) {
            paymentToken.safeTransferFrom(msg.sender, intent.recipient, intent.recipientAmount);
        }

        // Transfer fee to operator's destination
        if (intent.feeAmount > 0) {
            paymentToken.safeTransferFrom(msg.sender, feeDestination, intent.feeAmount);
        }

        // Store values in local variables to avoid stack too deep error
        address _operator = intent.operator;
        bytes16 _id = intent.id;
        address _recipient = intent.recipient;
        uint256 _recipientAmount = intent.recipientAmount;
        uint256 _feeAmount = intent.feeAmount;
        address _token = intent.token;

        emit PaymentProcessed(
            _operator,
            _id,
            _recipient,
            msg.sender,
            _recipientAmount,
            _feeAmount,
            _token
        );
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
