# PaymentSplitter Ruby Examples

This directory contains Ruby examples demonstrating how to interact with the PaymentSplitter smart contract on TRON Shasta testnet using the `tron.rb` gem.

## Prerequisites

1. **Ruby** 2.7 or higher installed on your system
2. **Bundler** for dependency management
3. **TRON accounts** with testnet TRX (get from [Shasta faucet](https://www.trongrid.io/shasta/#request))
4. **Environment variables** configured in `examples/.env`

## Installation

```bash
# Navigate to examples directory
cd examples

# Install dependencies
bundle install
```

## Configuration

Make sure `examples/.env` is configured with your private keys and contract addresses:

```env
OPERATOR_PRIVATE_KEY=your_operator_private_key
SENDER_PRIVATE_KEY=payer_private_key
PAYMENT_SPLITTER_SHASTA_ADDRESS=TU5kasmGMFTGZTS9cYvyX5WvYDAQoKdsKj
TEST_TOKEN_ADDRESS=TFz4HPavWtb6LtEkpESUnMQ61JAN7HHexj
TRONGRID_API_KEY=your_api_key_optional
```

## Contract Addresses (Shasta Testnet)

- **PaymentSplitter**: `TU5kasmGMFTGZTS9cYvyX5WvYDAQoKdsKj`
  - [View on TronScan](https://shasta.tronscan.org/#/contract/TU5kasmGMFTGZTS9cYvyX5WvYDAQoKdsKj)

- **MockTRC20 Token**: `TFz4HPavWtb6LtEkpESUnMQ61JAN7HHexj`
  - [View on TronScan](https://shasta.tronscan.org/#/contract/TFz4HPavWtb6LtEkpESUnMQ61JAN7HHexj)

## Available Examples

### 1. Register Operator (`01_register_operator.rb`)

Demonstrates how to register an operator with a fee destination.

```bash
cd examples
bundle exec ruby ruby/01_register_operator.rb
```

**What it does:**
- Connects to Shasta testnet
- Registers the operator account
- Sets the fee destination address
- Verifies registration status

### 2. Query Operator (`02_query_operator.rb`)

Shows how to query operator registration information.

```bash
bundle exec ruby ruby/02_query_operator.rb
```

**What it does:**
- Checks if an operator is registered
- Retrieves fee destination address
- Displays operator information

### 3. Split Payment (`03_split_payment.rb`)

Demonstrates executing a payment split transaction.

```bash
bundle exec ruby ruby/03_split_payment.rb
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

### 4. Query Payment (`04_query_payment.rb`)

Shows how to check if a payment has been processed.

```bash
bundle exec ruby ruby/04_query_payment.rb
```

**What it does:**
- Queries payment status by ID
- Checks if a payment has been processed
- Displays payment information

### 5. Unregister Operator (`05_unregister_operator.rb`)

Demonstrates how to unregister an operator.

```bash
bundle exec ruby ruby/05_unregister_operator.rb
```

**What it does:**
- Checks current registration status
- Unregisters the operator
- Verifies unregistration

**Warning:** After unregistering, the operator cannot process payments until re-registered.

### Complete Workflow (`complete_workflow.rb`)

A comprehensive example showing the entire PaymentSplitter workflow from start to finish.

```bash
bundle exec ruby ruby/complete_workflow.rb
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

## Utility Functions (`utils.rb`)

The `utils.rb` file provides helper functions used across all examples:

- `init_tron_client()` - Initialize Tron client connection
- `get_address_from_private_key(private_key)` - Get address from private key
- `generate_payment_id()` - Generate unique payment ID
- `get_future_timestamp(offset_seconds)` - Get future timestamp
- `to_sun(amount)` / `from_sun(amount)` - Convert between TRX units
- `wait_for_transaction(client, tx_id)` - Wait for transaction confirmation
- `print_result(title, result)` - Pretty print results

## Key Concepts

### Payment Intent Structure

Payment intents must be passed as an array in this exact order:

```ruby
intent_params = [
  recipient,          # Address to receive payment
  tokenAddress,       # TRC20 token address
  recipientAmount,    # Amount for recipient
  operatorAddress,    # Operator authorizing payment
  feeAmount,         # Fee for operator
  paymentId,         # Unique bytes16 ID
  deadline,          # Expiration timestamp
  refundDestination, # Where refunds go
  signature          # Operator's signature
]
```

### Using tron.rb Contract Service

The contract service provides methods for interacting with smart contracts:

```ruby
# State-changing operations (write)
contract_service.trigger_contract(
  contract_address: PAYMENT_SPLITTER_ADDRESS,
  function: 'registerOperator()',
  parameters: [],
  private_key: operator_private_key
)

# Read-only operations
contract_service.operator_registered?(
  PAYMENT_SPLITTER_ADDRESS,
  operator_address
)
```

## Important Notes

### Bundle Exec

**ALWAYS** run Ruby scripts with `bundle exec` to avoid gem conflicts:

```bash
# ✓ Correct
bundle exec ruby ruby/01_register_operator.rb

# ✗ Wrong (may cause "Base58 is not a module" errors)
ruby ruby/01_register_operator.rb
```

Running without `bundle exec` may cause conflicts between `base58` and `base58-alphabets` gems in your system environment.

### Private Key Format

The `tron.rb` gem accepts private keys in hex format (with or without `0x` prefix):

```ruby
# Both formats work
private_key = 'eff6377291c1ae1cf7b2e8e5f3f585eac2e8bf2fee45b7d057496822555cdad9'
private_key = '0xeff6377291c1ae1cf7b2e8e5f3f585eac2e8bf2fee45b7d057496822555cdad9'
```

## Troubleshooting

### "Base58 is not a module" error
- Make sure you're running scripts with `bundle exec`
- Run `bundle install` to ensure correct gem versions

### "Insufficient balance" error
- Ensure the payer account has enough tokens
- Get test tokens from the MockTRC20 contract
- Check balance using `contract_service.call_contract()`

### "Operator not registered" error
- Run `01_register_operator.rb` first
- Verify registration with `02_query_operator.rb`

### "Transaction reverted" error
- Check that tokens are approved
- Verify payment ID is unique
- Ensure deadline hasn't passed
- Check signature is valid

## Network Information

- **Network**: Shasta Testnet
- **API Endpoint**: https://api.shasta.trongrid.io
- **Faucet**: https://www.trongrid.io/shasta/#request
- **Explorer**: https://shasta.tronscan.org

## tron.rb Features

The examples use `tron.rb` v1.1.3 which includes:

- Full ABI encoding/decoding support
- Local transaction signing with secp256k1
- Contract interaction (trigger_contract, call_contract)
- Helper methods for common operations
- Security features (private keys never sent to API)

## Support

For issues or questions:
- Check the main project README
- Review contract documentation
- Examine test files for additional examples
- Visit [tron.rb documentation](https://github.com/your-repo/tron.rb)

## License

UNLICENSED
