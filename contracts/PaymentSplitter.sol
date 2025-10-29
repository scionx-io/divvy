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
    function splitPayment(SplitPaymentIntent calldata intent)
        external
        operatorIsRegistered(intent.operator)
        validPayment(intent, msg.sender)
    {
        // Validate timing
        require(block.timestamp <= intent.deadline, "Payment expired");

        // Validate addresses
        require(intent.recipient != address(0), "Invalid recipient address");
        require(intent.token != address(0), "Invalid token address");

        // Check if already processed
        require(!processedPayments[intent.operator][intent.id], "Payment already processed");

        // Validate amounts
        require(intent.recipientAmount > 0 || intent.feeAmount > 0, "No amounts to transfer");
        uint256 totalAmount = intent.recipientAmount + intent.feeAmount;

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
     * @dev Validates that the operator is registered
     */
    modifier operatorIsRegistered(address operator) {
        require(feeDestinations[operator] != address(0), "Operator not registered");
        _;
    }

    /**
     * @dev Validates the payment intent signature and structure
     * @param _intent The payment intent to validate
     * @param sender The address initiating the payment
     * @notice TRON note: Uses block.chainid for replay protection
     * @notice Tron Mainnet chainId: 728126428, Nile Testnet: 3448148188, Shasta Testnet: 2494104990
     */
    modifier validPayment(SplitPaymentIntent calldata _intent, address sender) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                _intent.recipientAmount,
                _intent.deadline,
                _intent.recipient,
                _intent.token,
                _intent.refundDestination,
                _intent.feeAmount,
                _intent.id,
                _intent.operator,
                block.chainid,  // Prevents replay attacks (TRON supports this since v4.1.0)
                sender,
                address(this)
            )
        );

        // TRON uses "\x19TRON Signed Message:\n32" prefix for compatibility
        // but "\x19Ethereum Signed Message:\n32" also works and is more standard
        bytes32 signedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        address signer = signedMessageHash.recover(_intent.signature);

        require(signer == _intent.operator, "Invalid signature");
        _;
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
