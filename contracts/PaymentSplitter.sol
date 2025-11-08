// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@cryptovarna/tron-contracts/contracts/token/TRC20/ITRC20.sol";
import "@cryptovarna/tron-contracts/contracts/token/TRC20/utils/SafeTRC20.sol";
import "@cryptovarna/tron-contracts/contracts/utils/cryptography/ECDSA.sol";
import "@cryptovarna/tron-contracts/contracts/security/ReentrancyGuard.sol";
import "@cryptovarna/tron-contracts/contracts/access/Ownable.sol";
import "@cryptovarna/tron-contracts/contracts/utils/Context.sol";
import "@cryptovarna/tron-contracts/contracts/security/Pausable.sol";
import "./utils/Sweepable.sol";
import "./interfaces/IPaymentSplitter.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title PaymentSplitter
 * @dev Splits TRC20 token payments between recipients and operators with fees
 * @notice Only supports standard TRC20 tokens (no fee-on-transfer or rebasing tokens)
 * @notice Deployed on TRON network
 * @notice Uses ReentrancyGuard to prevent reentrant attacks during external calls
 * @notice Uses Ownable for access control of administrative functions
 * @notice Uses Pausable to allow pausing functionality in emergency situations
 * @notice Uses Sweepable to allow sweeping of stuck tokens by designated sweeper
 */
contract PaymentSplitter is IPaymentSplitter, ReentrancyGuard, Ownable, Pausable, Sweepable {
    using SafeTRC20 for ITRC20;
    using ECDSA for bytes32;

    /// @dev SunSwap V3 SwapRouter for exact output swaps
    ISwapRouter public immutable swapRouter;

    /// @dev Wrapped TRX (WTRX) contract address
    address public immutable WTRX;

    /// @dev Represents native TRX
    address public constant NATIVE_CURRENCY = address(0);

    /// @dev Mapping from operator address to their fee destination
    mapping(address => address) private feeDestinations;

    /// @dev Mapping to track processed payments: operator => payment ID => processed
    mapping(address => mapping(bytes16 => bool)) private processedPayments;

    /// @dev Maximum deadline duration (30 days in seconds)
    uint256 public constant MAX_DEADLINE_DURATION = 30 days;

    /**
     * @notice Initialize PaymentSplitter with SunSwap V3 SwapRouter and WTRX
     * @param _swapRouter SunSwap V3 SwapRouter address for this network
     * @param _wtrx Wrapped TRX (WTRX) address for this network
     * @dev Mainnet WTRX: TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR
     * @dev Nile WTRX: Check SunSwap docs for testnet address
     */
    constructor(address _swapRouter, address _wtrx) {
        require(_swapRouter != address(0), "Invalid swap router");
        require(_wtrx != address(0), "Invalid WTRX");
        swapRouter = ISwapRouter(_swapRouter);
        WTRX = _wtrx;
    }

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
     * @notice Validates payment intent signature and parameters
     * @param intent The payment intent to validate
     * @dev Internal function to avoid code duplication between splitPayment and swapAndSplitPayment
     */
    function _validateIntent(SplitPaymentIntent calldata intent) internal view {
        // CRITICAL: Check for zero address BEFORE accessing mapping to avoid TRON Shasta issue
        require(intent.operator != address(0), "Operator cannot be zero address");

        // Validate operator is registered
        require(feeDestinations[intent.operator] != address(0), "Operator not registered");

        // Perform signature validation (TRON TIP-191 standard)
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
        require(intent.deadline <= block.timestamp + MAX_DEADLINE_DURATION, "Deadline too far");

        // Validate addresses
        require(intent.recipient != address(0), "Invalid recipient address");
        require(intent.token != address(0), "Invalid token address");

        // Check if already processed
        require(!processedPayments[intent.operator][intent.id], "Payment already processed");

        // Validate amounts
        require(intent.recipientAmount > 0 || intent.feeAmount > 0, "No amounts to transfer");

        // Validate token is a contract
        require(intent.token.code.length > 0, "Token not a contract");
    }

    /**
     * @notice Split TRC20 token payment between recipient and operator
     * @param intent SplitPaymentIntent struct containing all payment parameters
     */
    function splitPayment(SplitPaymentIntent calldata intent)
        external
        nonReentrant
        whenNotPaused
    {
        // Validate intent
        _validateIntent(intent);

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

    /**
     * @notice Swap input token for exact output amount and split between recipient and operator
     * @param intent Payment intent (intent.token is output token, amounts are exact)
     * @param tokenIn Input token address (address(0) for native TRX)
     * @param maxWillingToPay Maximum input tokens user will spend
     * @param poolFee SunSwap V3 pool fee tier (500 = 0.05%, 3000 = 0.3%, 10000 = 1%)
     * @dev Uses SunSwap V3 exactOutputSingle for guaranteed exact output amounts
     * @dev Refunds unused input tokens to msg.sender
     */
    function swapAndSplitPayment(
        SplitPaymentIntent calldata intent,
        address tokenIn,
        uint256 maxWillingToPay,
        uint24 poolFee
    ) external payable nonReentrant whenNotPaused {
        // === VALIDATION PHASE ===

        // Validate intent (includes operator, signature, timing, addresses, amounts, token contract check)
        _validateIntent(intent);

        // Validate we're actually swapping different tokens
        require(tokenIn != intent.token, "No swap needed");

        // Calculate exact output needed
        uint256 neededAmount = intent.recipientAmount + intent.feeAmount;

        // === EFFECTS PHASE ===

        // Mark as processed BEFORE external calls (Checks-Effects-Interactions)
        processedPayments[intent.operator][intent.id] = true;

        // === INTERACTIONS PHASE ===

        uint256 amountSpent;

        if (tokenIn == NATIVE_CURRENCY) {
            // Native TRX swap
            require(msg.value == maxWillingToPay, "Incorrect TRX amount");

            // Execute swap: TRX -> exact output token
            // SwapRouter will automatically wrap TRX to WTRX internally
            amountSpent = swapRouter.exactOutputSingle{value: maxWillingToPay}(
                ISwapRouter.ExactOutputSingleParams({
                    tokenIn: WTRX,  // Use WTRX, router auto-wraps the TRX
                    tokenOut: intent.token,
                    fee: poolFee,
                    recipient: address(this),
                    deadline: intent.deadline,
                    amountOut: neededAmount,
                    amountInMaximum: maxWillingToPay,
                    sqrtPriceLimitX96: 0
                })
            );

            // Refund unused TRX to user
            if (amountSpent < maxWillingToPay) {
                uint256 refund = maxWillingToPay - amountSpent;
                (bool success,) = payable(msg.sender).call{value: refund}("");
                require(success, "TRX refund failed");
            }
        } else {
            // TRC20 swap
            require(msg.value == 0, "Don't send TRX for token swap");

            ITRC20 inputToken = ITRC20(tokenIn);
            require(inputToken.balanceOf(msg.sender) >= maxWillingToPay, "Insufficient balance");
            require(inputToken.allowance(msg.sender, address(this)) >= maxWillingToPay, "Insufficient allowance");
            require(tokenIn.code.length > 0, "Input token not a contract");

            // Pull input tokens from user
            inputToken.safeTransferFrom(msg.sender, address(this), maxWillingToPay);

            // Approve SwapRouter to spend input tokens
            inputToken.safeApprove(address(swapRouter), maxWillingToPay);

            // Execute swap: tokenIn -> exact output token
            amountSpent = swapRouter.exactOutputSingle(
                ISwapRouter.ExactOutputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: intent.token,
                    fee: poolFee,
                    recipient: address(this),
                    deadline: intent.deadline,
                    amountOut: neededAmount,
                    amountInMaximum: maxWillingToPay,
                    sqrtPriceLimitX96: 0
                })
            );

            // Refund unused input tokens to user
            if (amountSpent < maxWillingToPay) {
                uint256 refund = maxWillingToPay - amountSpent;
                inputToken.safeTransfer(msg.sender, refund);
            }
            
            // Reset approval to zero for security
            inputToken.safeApprove(address(swapRouter), 0);
        }

        // Distribute output tokens to recipients
        ITRC20 outputToken = ITRC20(intent.token);
        address feeDestination = feeDestinations[intent.operator];

        if (intent.recipientAmount > 0) {
            outputToken.safeTransfer(intent.recipient, intent.recipientAmount);
        }

        if (intent.feeAmount > 0) {
            outputToken.safeTransfer(feeDestination, intent.feeAmount);
        }

        // Emit event with what user actually spent
        // Note: tokenIn remains as passed (address(0) for native TRX) to show what user paid with
        emit SwapPaymentProcessed(
            intent.operator,
            intent.id,
            intent.recipient,
            msg.sender,
            amountSpent,
            tokenIn  // address(0) for TRX, token address for TRC20
        );
    }



    /**
     * @notice Pause the contract, preventing payment processing (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract, allowing payment processing to resume (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
