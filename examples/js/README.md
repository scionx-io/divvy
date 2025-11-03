# PaymentSplitter JavaScript Examples

This directory contains JavaScript examples demonstrating how to interact with the PaymentSplitter smart contract on TRON Shasta testnet.

## Prerequisites

1. **Node.js and npm** installed on your system
2. **TronWeb** and **ethers.js** packages (install via npm)
3. **TRON accounts** with testnet TRX (get from [Shasta faucet](https://www.trongrid.io/shasta/#request))
4. **Environment variables** configured in `examples/.env`

## Installation

```bash
# Install dependencies (from project root)
cd /Users/bolo/Documents/Code/ScionX/Divvy
npm install

# Or install specific dependencies
npm install tronweb ethers dotenv
```

## Configuration

Make sure `examples/.env` is configured with your private keys and contract addresses:

```env
PRIVATE_KEY_SHASTA=your_operator_private_key
PAYMENT_SPLITTER_SHASTA_ADDRESS=TU5kasmGMFTGZTS9cYvyX5WvYDAQoKdsKj
TEST_TOKEN_ADDRESS=TFz4HPavWtb6LtEkpESUnMQ61JAN7HHexj
OPERATOR_PRIVATE_KEY=operator_private_key
SENDER_PRIVATE_KEY=payer_private_key
```

## Contract Addresses (Shasta Testnet)

- **PaymentSplitter**: `TU5kasmGMFTGZTS9cYvyX5WvYDAQoKdsKj`
  - [View on TronScan](https://shasta.tronscan.org/#/contract/TU5kasmGMFTGZTS9cYvyX5WvYDAQoKdsKj)

- **MockTRC20 Token**: `TFz4HPavWtb6LtEkpESUnMQ61JAN7HHexj`
  - [View on TronScan](https://shasta.tronscan.org/#/contract/TFz4HPavWtb6LtEkpESUnMQ61JAN7HHexj)

## Available Examples

### 1. Register Operator (`01_register_operator.js`)

Demonstrates how to register an operator with a fee destination.

```bash
cd examples/js
node 01_register_operator.js
```

**What it does:**
- Connects to Shasta testnet
- Registers the operator account
- Sets the fee destination address
- Verifies registration status

### 2. Query Operator (`02_query_operator.js`)

Shows how to query operator registration information.

```bash
node 02_query_operator.js
```

**What it does:**
- Checks if an operator is registered
- Retrieves fee destination address
- Displays operator information

### 3. Split Payment (`03_split_payment.js`)

Demonstrates executing a payment split transaction.

```bash
node 03_split_payment.js
```

**What it does:**
- Creates a signed payment intent
- Approves token spending
- Executes the split payment
- Verifies the transaction

**Requirements:**
- Operator must be registered
- Payer must have sufficient token balance
- Tokens must be approved for spending

### 4. Query Payment (`04_query_payment.js`)

Shows how to check if a payment has been processed.

```bash
node 04_query_payment.js
```

**What it does:**
- Queries payment status by ID
- Checks if a payment has been processed
- Displays payment information

### 5. Unregister Operator (`05_unregister_operator.js`)

Demonstrates how to unregister an operator.

```bash
node 05_unregister_operator.js
```

**What it does:**
- Checks current registration status
- Unregisters the operator
- Verifies unregistration

**Warning:** After unregistering, the operator cannot process payments until re-registered.

### Complete Workflow (`complete_workflow.js`)

A comprehensive example showing the entire PaymentSplitter workflow from start to finish.

```bash
node complete_workflow.js
```

**What it does:**
1. Setup accounts and contracts
2. Register operator
3. Setup token balances
4. Approve token spending
5. Create signed payment intent
6. Execute split payment
7. Verify payment status
8. Check final balances

## Utility Functions (`utils.js`)

The `utils.js` file provides helper functions used across all examples:

- `initTronWeb()` - Initialize TronWeb connection
- `getPaymentSplitterContract()` - Load contract instance
- `getMockTokenContract()` - Load token contract
- `generatePaymentId()` - Generate unique payment ID
- `createSignedIntent()` - Create TRON TIP-191 signed intent
- `waitForTransaction()` - Wait for transaction confirmation
- `toSun()` / `fromSun()` - Convert between TRX units

## Key Concepts

### Payment Intent Structure

Payment intents must be passed as an array in this exact order:

```javascript
const intentArray = [
  recipient,          // Address to receive payment
  tokenAddress,       // TRC20 token address
  recipientAmount,    // Amount for recipient
  operatorAddress,    // Operator authorizing payment
  feeAmount,         // Fee for operator
  paymentId,         // Unique bytes16 ID
  deadline,          // Expiration timestamp
  refundDestination, // Where refunds go
  signature          // Operator's signature
];
```

### TRON TIP-191 Signing

The contract uses TRON TIP-191 standard for message signing:

```javascript
const signature = await createSignedIntent({
  recipientAmount,
  deadline,
  recipient,
  tokenAddress,
  refundDestination,
  feeAmount,
  id: paymentId,
  operatorAddress,
  payerAddress,
  splitterAddress
}, operatorPrivateKey, chainId);
```

### Chain ID

Shasta testnet chain ID: `0x94a9059e` (2494104222)

## Troubleshooting

### "Insufficient balance" error
- Make sure the payer account has enough tokens
- Get test tokens from the MockTRC20 contract
- Check balance using `token.balanceOf(address)`

### "Operator not registered" error
- Run `01_register_operator.js` first
- Verify registration with `02_query_operator.js`

### "Transaction reverted" error
- Check that tokens are approved: `token.approve()`
- Verify payment ID is unique
- Ensure deadline hasn't passed
- Check signature is valid

### "Invalid signature" error
- Make sure operator private key is correct
- Verify all parameters match exactly
- Check that operator is registered

## Network Information

- **Network**: Shasta Testnet
- **Full Host**: https://api.shasta.trongrid.io
- **Chain ID**: 0x94a9059e (2494104222)
- **Faucet**: https://www.trongrid.io/shasta/#request
- **Explorer**: https://shasta.tronscan.org

## Support

For issues or questions:
- Check the main project README
- Review contract documentation
- Examine test files for additional examples

## License

UNLICENSED
