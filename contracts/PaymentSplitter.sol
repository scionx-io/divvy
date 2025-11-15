// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@cryptovarna/tron-contracts/contracts/token/TRC20/ITRC20.sol";
import "@cryptovarna/tron-contracts/contracts/token/TRC20/utils/SafeTRC20.sol";
import "@cryptovarna/tron-contracts/contracts/utils/cryptography/ECDSA.sol";
import "@cryptovarna/tron-contracts/contracts/security/ReentrancyGuard.sol";
import "@cryptovarna/tron-contracts/contracts/access/Ownable.sol";
import "@cryptovarna/tron-contracts/contracts/utils/Address.sol";
import "@cryptovarna/tron-contracts/contracts/utils/Context.sol";
import "@cryptovarna/tron-contracts/contracts/security/Pausable.sol";
import "./utils/Sweepable.sol";
import "./interfaces/IPaymentSplitter.sol";
import "./interfaces/ISmartExchangeRouter.sol";
import "./libraries/TransferHelper.sol";

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
    // Note: Using TransferHelper instead of SafeTRC20 for TRON USDT compatibility
    // TransferHelper has special handling for USDT which doesn't return standard boolean values
    using ECDSA for bytes32;

    /// @dev SmartExchangeRouter that supports multiple swap protocols (V1, V2, V3)
    ISmartExchangeRouter public immutable swapRouter;

    /// @dev Wrapped TRX (WTRX) contract address - retrieved from the router
    address public immutable WTRX;

    /// @dev Represents native TRX
    address public constant NATIVE_CURRENCY = address(0);

    /// @dev Mapping from operator address to their fee destination
    mapping(address => address) private feeDestinations;

    /// @dev Mapping to track processed payments: operator => payment ID => processed
    mapping(address => mapping(bytes16 => bool)) private processedPayments;

    /// @dev Maximum deadline duration (30 days in seconds)
    uint256 public constant MAX_DEADLINE_DURATION = 30 days;

    /// @dev Minimum payment amount to prevent economically unviable transactions
    uint256 public constant MIN_PAYMENT_AMOUNT = 1000; // Minimum 1000 units (0.001 with 6 decimals)

    /**
     * @notice Initialize PaymentSplitter with SmartExchangeRouter
     * @param _swapRouter SmartExchangeRouter address for this network
     * @dev WTRX address is retrieved from the router automatically
     */
    constructor(address _swapRouter) {
        require(_swapRouter != address(0), "Invalid swap router");
        swapRouter = ISmartExchangeRouter(_swapRouter);
        WTRX = ISmartExchangeRouter(_swapRouter).WTRX();
        require(WTRX != address(0), "Invalid WTRX address from router");
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
        
        // Prevent economically unviable transactions with very small amounts
        if (intent.recipientAmount > 0) {
            require(intent.recipientAmount >= MIN_PAYMENT_AMOUNT, "Recipient amount too small");
        }
        if (intent.feeAmount > 0) {
            require(intent.feeAmount >= MIN_PAYMENT_AMOUNT, "Fee amount too small");
        }

        // Validate token is a contract
        require(Address.isContract(intent.token), "Token not a contract");
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

        // Transfer to recipient using TransferHelper for USDT compatibility
        if (intent.recipientAmount > 0) {
            TransferHelper.safeTransferFrom(address(paymentToken), msg.sender, intent.recipient, intent.recipientAmount);
        }

        // Transfer fee to operator's destination
        if (intent.feeAmount > 0) {
            TransferHelper.safeTransferFrom(address(paymentToken), msg.sender, feeDestination, intent.feeAmount);
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
     * @param exactAmountToPay Exact input tokens to spend (from quoter)
     * @param fees Array of pool fees for each hop (for multi-hop swaps)
     * @dev Uses SmartExchangeRouter for guaranteed exact output amounts across multiple protocols
     * @dev User must provide exact quote from quoter - no slippage buffer needed
     */
    function swapAndSplitPayment(
        SplitPaymentIntent calldata intent,
        address tokenIn,
        uint256 exactAmountToPay,
        uint24[] calldata fees  // Note: Changed from single poolFee to array for multi-hop support
    ) external payable nonReentrant whenNotPaused {
        // === VALIDATION PHASE ===

        // Validate intent (includes operator, signature, timing, addresses, amounts, token contract check)
        _validateIntent(intent);

        // Validate we're actually swapping different tokens
        require(tokenIn != intent.token, "No swap needed");

        // Calculate exact output needed
        uint256 neededAmount = intent.recipientAmount + intent.feeAmount;

        // === EFFECTS PHASE ===

        // Mark as processed BEFORE any external calls (Checks-Effects-Interactions)
        processedPayments[intent.operator][intent.id] = true;

        // === INTERACTIONS PHASE ===

        uint256 amountSpent;

        if (tokenIn == NATIVE_CURRENCY) {
            // Native TRX swap - user sends exact amount from quoter
            require(msg.value == exactAmountToPay, "Incorrect TRX amount");

            // Prepare path for SmartExchangeRouter (reversed for exact output: [tokenOut, tokenIn])
            address[] memory path = new address[](2);
            path[0] = intent.token;  // Output token first for exactOutput
            path[1] = WTRX;          // Input token is WTRX (TRX will be wrapped)

            // Store parameters in local variables to avoid stack too deep error
            address[] memory _path = path;
            uint24[] memory _fees = fees;
            uint256 _neededAmount = neededAmount;
            uint256 _exactAmountToPay = exactAmountToPay;
            address _recipient = address(this);
            uint256 _deadline = intent.deadline;

            // Execute swap: TRX -> exact output token
            amountSpent = swapRouter.swapExactOutput{
                value: msg.value
            }(
                _path,
                _fees,
                _neededAmount,
                _exactAmountToPay,
                _recipient,
                _deadline
            );

            // Verify we used what we expected
            require(amountSpent <= exactAmountToPay, "Amount exceeded maximum");

            // Refund any unused TRX
            if (amountSpent < exactAmountToPay) {
                uint256 refund = exactAmountToPay - amountSpent;
                (bool refundSuccess, ) = payable(msg.sender).call{value: refund}("");
                require(refundSuccess, "TRX refund failed");
            }
        } else {
            // TRC20 swap - user sends exact amount from quoter
            require(msg.value == 0, "Don't send TRX for token swap");

            ITRC20 inputToken = ITRC20(tokenIn);
            require(inputToken.balanceOf(msg.sender) >= exactAmountToPay, "Insufficient balance");
            require(inputToken.allowance(msg.sender, address(this)) >= exactAmountToPay, "Insufficient allowance");
            // Validate tokenIn is a contract
            require(Address.isContract(tokenIn), "Input token not a contract");

            // Pull exact input tokens from user using TransferHelper
            TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), exactAmountToPay);

            // Approve SmartExchangeRouter to spend input tokens
            TransferHelper.safeApprove(tokenIn, address(swapRouter), exactAmountToPay);

            // Prepare path for SmartExchangeRouter (reversed for exact output: [tokenOut, tokenIn])
            address[] memory path = new address[](2);
            path[0] = intent.token;  // Output token first for exactOutput
            path[1] = tokenIn;       // Input token

            // Store parameters in local variables to avoid stack too deep error
            address[] memory _path = path;
            uint24[] memory _fees = fees;
            uint256 _neededAmount = neededAmount;
            uint256 _exactAmountToPay = exactAmountToPay;
            address _recipient = address(this);
            uint256 _deadline = intent.deadline;

            // Execute swap: tokenIn -> exact output token
            amountSpent = swapRouter.swapExactOutput(
                _path,
                _fees,
                _neededAmount,
                _exactAmountToPay,
                _recipient,
                _deadline
            );

            // Verify we used what we expected
            require(amountSpent <= exactAmountToPay, "Amount exceeded maximum");

            // Refund unused input tokens to sender
            if (amountSpent < exactAmountToPay) {
                uint256 refund = exactAmountToPay - amountSpent;
                TransferHelper.safeTransfer(tokenIn, msg.sender, refund);
            }

            // Reset approval to zero for security
            TransferHelper.safeApprove(tokenIn, address(swapRouter), 0);
        }

        // Distribute output tokens to recipients
        ITRC20 outputToken = ITRC20(intent.token);
        address feeDestination = feeDestinations[intent.operator];

        // Verify that the contract has sufficient balance to cover both transfers
        uint256 outputBalance = outputToken.balanceOf(address(this));
        uint256 totalAmount = intent.recipientAmount + intent.feeAmount;
        require(outputBalance >= totalAmount, "Insufficient output token balance after swap");

        // Use TransferHelper for TRON USDT compatibility
        // TransferHelper has special handling for USDT which doesn't return standard boolean values
        if (intent.recipientAmount > 0) {
            TransferHelper.safeTransfer(intent.token, intent.recipient, intent.recipientAmount);
        }

        if (intent.feeAmount > 0) {
            TransferHelper.safeTransfer(intent.token, feeDestination, intent.feeAmount);
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
