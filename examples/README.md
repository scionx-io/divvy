# PaymentSplitter Ruby Examples

This directory contains Ruby examples for interacting with the PaymentSplitter smart contract using the `tron.rb` gem.

## Prerequisites

- Ruby 3.0 or higher
- `tron.rb` gem (version 1.0+)
- TronGrid API key (optional, but recommended)
- Deployed PaymentSplitter contract address

## Installation

```bash
cd examples
bundle install
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your configuration:
```bash
# Get TronGrid API keys from https://www.trongrid.io/
TRONGRID_API_KEY=your_trongrid_api_key_here
TRONSCAN_API_KEY=your_tronscan_api_key_here

# Add your private keys (NEVER commit these!)
OPERATOR_PRIVATE_KEY=your_operator_private_key_here
SENDER_PRIVATE_KEY=your_sender_private_key_here

# Your deployed contract address
PAYMENT_SPLITTER_ADDRESS=your_deployed_contract_address_here
```

## Running the Examples

```bash
ruby ruby_payment_splitter.rb
```

## Contract Interaction Methods

The examples demonstrate all PaymentSplitter contract functions:

### 1. Operator Registration

```ruby
# Register with custom fee destination
example.register_operator_with_fee_destination(
  operator_private_key,
  fee_destination_address
)

# Register using operator's own address
example.register_operator(operator_private_key)
```

### 2. Check Registration Status

```ruby
# Check if operator is registered
is_registered = example.check_operator_registration(operator_address)

# Get operator's fee destination
fee_destination = example.get_fee_destination(operator_address)
```

### 3. Split Payment

```ruby
# Split payment between recipient and operator
example.split_payment(
  sender_private_key: sender_private_key,
  recipient_address: recipient_address,
  token_address: USDT_ADDRESS,
  recipient_amount: 100_000_000,  # 100 USDT (6 decimals)
  operator_address: operator_address,
  fee_amount: 5_000_000           # 5 USDT (6 decimals)
)
```

### 4. Check Payment Status

```ruby
# Check if payment ID was processed
is_processed = example.check_payment_processed(
  operator_address,
  payment_id
)
```

### 5. Unregister Operator

```ruby
example.unregister_operator(operator_private_key)
```

### 6. Check Wallet Balance (Working Example)

```ruby
# This works with current tron.rb gem
example.check_wallet_balance(address)
```

## Current Status

⚠️ **Important**: The `tron.rb` gem currently supports reading wallet balances and token information, but **contract interaction methods are not yet implemented**.

### What Works Now

- ✅ Check wallet TRX balance
- ✅ Check TRC20 token balances
- ✅ Get wallet portfolio with USD values
- ✅ Get account resources (bandwidth/energy)
- ✅ Get token prices

### What Needs Implementation

To fully support the PaymentSplitter contract, the `tron.rb` gem needs these contract interaction methods:

#### 1. `trigger_contract()` - For State-Changing Operations

```ruby
contract_service.trigger_contract(
  contract_address: 'TContractAddress',
  function: 'functionName(type1,type2)',
  parameters: [param1, param2],
  private_key: 'your_private_key'
)
```

**Use Cases:**
- `registerOperator()`
- `registerOperatorWithFeeDestination(address)`
- `unregisterOperator()`
- `splitPayment(address,address,uint256,address,uint256,bytes16)`

#### 2. `call_contract()` - For Read-Only Operations

```ruby
result = contract_service.call_contract(
  contract_address: 'TContractAddress',
  function: 'functionName(type)',
  parameters: [param]
)
```

**Use Cases:**
- `isOperatorRegistered(address) returns (bool)`
- `getFeeDestination(address) returns (address)`
- `isPaymentProcessed(address,bytes16) returns (bool)`

#### 3. Helper Methods

```ruby
# ABI encoding
encoded = contract_service.encode_parameters(['address', 'uint256'], [address, amount])

# ABI decoding
decoded = contract_service.decode_output('bool', output)
```

## Implementation Guide for tron.rb

If you're implementing contract interaction in `tron.rb`, here's what you need:

### 1. Create Contract Service

Create a new file: `lib/tron/services/contract.rb`

```ruby
module Tron
  module Services
    class Contract
      def initialize(configuration)
        @configuration = configuration
      end

      def trigger_contract(contract_address:, function:, parameters:, private_key:, fee_limit: 100_000_000)
        # Implementation using TronGrid API
        # POST /wallet/triggersmartcontract
      end

      def call_contract(contract_address:, function:, parameters:)
        # Implementation using TronGrid API
        # POST /wallet/triggerconstantcontract
      end

      # Additional helper methods...
    end
  end
end
```

### 2. Add to Client

In `lib/tron/client.rb`:

```ruby
require_relative 'services/contract'

def contract_service
  @contract_service ||= Services::Contract.new(@configuration)
end
```

### 3. API Endpoints to Use

**TronGrid API endpoints:**

- Trigger Contract (State-Changing):
  ```
  POST https://api.trongrid.io/wallet/triggersmartcontract
  ```

- Constant Contract (Read-Only):
  ```
  POST https://api.trongrid.io/wallet/triggerconstantcontract
  ```

**Documentation:**
- [TronGrid API Reference](https://developers.tron.network/reference/triggerconstantcontract)
- [TronWeb Contract Documentation](https://developers.tron.network/docs/tronweb-contract)

## Token Decimal Reference

Common TRC20 tokens and their decimals:

| Token | Address | Decimals |
|-------|---------|----------|
| USDT | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | 6 |
| USDC | `TEkxiTehnzSmAaVPYYJNTY7v1KHVqCvRdx` | 6 |
| USDD | `TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn` | 18 |

**Example:** To send 100 USDT (6 decimals): `100 * 10^6 = 100_000_000`

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use environment variables** for sensitive data
3. **Validate all addresses** before transactions
4. **Test on Shasta testnet** before mainnet
5. **Start with small amounts** when testing
6. **Monitor transaction status** before considering complete

## Testing on Shasta Testnet

To test on Shasta testnet:

1. Get testnet TRX from faucet: https://www.trongrid.io/faucet
2. Configure network in your code:
   ```ruby
   client = Tron::Client.new(
     network: :shasta,
     api_key: ENV['TRONGRID_API_KEY']
   )
   ```
3. Deploy contract to Shasta using deployment scripts in `../scripts/`

## Troubleshooting

### API Rate Limits

If you encounter rate limit errors:
- Get a TronGrid API key
- Enable caching in `tron.rb`
- Add delays between requests

### Transaction Failures

Common reasons for transaction failures:
- Insufficient TRX for energy/bandwidth
- Operator not registered
- Invalid token address
- Payment ID already processed
- Insufficient token allowance

### Contract Not Found

Verify your contract address:
```ruby
# Check on TronScan
puts "https://tronscan.org/#/contract/#{PAYMENT_SPLITTER_ADDRESS}"
```

## Support

For issues with:
- **PaymentSplitter contract**: See main README.md
- **tron.rb gem**: https://github.com/scionx-io/tron.rb (or your repo)
- **TronGrid API**: https://developers.tron.network

## License

MIT License - See LICENSE file for details
