# Divvy - PaymentSplitter for TRON

A smart contract system for splitting TRC20 token payments between recipients and operators with fee management on the TRON blockchain.

## Quick Start Scripts

The project includes ready-to-use scripts for deployment and testing:

### Deployment Scripts

- **`scripts/deploy-shasta.js`** - Deploy PaymentSplitter to Shasta testnet with proper confirmation and verification
- **`scripts/deploy-test-usdt.js`** - Deploy TestUSDT mock token to Shasta for testing
- **`scripts/deploy-mainnet.js`** - Deploy PaymentSplitter to TRON mainnet

### Testing Scripts

- **`scripts/verify-shasta-contract.js`** - Verify PaymentSplitter deployment and test basic functionality
- **`scripts/test-shasta-usdt.js`** - End-to-end test of USDT payment splitting on Shasta

### Environment Setup

Create a `.env` file in the project root:

```env
# Shasta Testnet
PRIVATE_KEY_SHASTA=your_private_key_here
PAYMENT_SPLITTER_SHASTA_ADDRESS=deployed_contract_address
```

### Running Scripts

```bash
# Deploy PaymentSplitter to Shasta
node scripts/deploy-shasta.js

# Deploy TestUSDT mock for testing
node scripts/deploy-test-usdt.js

# Verify contract deployment
node scripts/verify-shasta-contract.js

# Run full USDT payment test
node scripts/test-shasta-usdt.js
```

### Current Deployed Contracts (Shasta Testnet)

- **PaymentSplitter**: `TSgJ2CobZa9u7SkRKb9dPb9vn2Ht4WdMAG`
  - [View on TronScan](https://shasta.tronscan.org/#/contract/TSgJ2CobZa9u7SkRKb9dPb9vn2Ht4WdMAG)

- **TestUSDT**: `TGSM2p5FJzrmo2QeoJH1MVMQAQH6bMbmaJ`
  - [View on TronScan](https://shasta.tronscan.org/#/contract/TGSM2p5FJzrmo2QeoJH1MVMQAQH6bMbmaJ)

## Configuration

Your configuration file is called `tronbox-config.js` and is located at the root of your project directory.

## Compiling

To compile your contracts, use the following command:

```shell
tronbox compile
```

## Migration

The project comes pre-configured with four separate networks:

- Mainnet (https://api.trongrid.io)
- Shasta Testnet (https://api.shasta.trongrid.io)
- Nile Testnet (https://nile.trongrid.io).
- Localnet (http://127.0.0.1:9090)

### Mainnet

To deploy your contracts to Mainnet, you can run the following:

```shell
tronbox migrate --network mainnet
```

### Shasta Testnet

Obtain test coin at https://shasta.tronex.io/

To deploy your contracts to Shasta Testnet, you can run the following:

```shell
tronbox migrate --network shasta
```

### Nile Testnet

Obtain test coin at https://nileex.io/join/getJoinPage

To deploy your contracts to Nile Testnet, you can run the following:

```shell
tronbox migrate --network nile
```

### Localnet

The TronBox Runtime Environment provides a complete development framework for Tron, including a private network for testing.

Get tronbox/tre docker image at https://hub.docker.com/r/tronbox/tre

To deploy your contracts to Localnet, you can run the following:

```shell
tronbox migrate
```

## Testing

To test your contracts, you can run the following:

```shell
tronbox test --network <mainnet|shasta|nile|development>
```

## Work with EVM

TronBox supports deploying contracts on EVM-compatible blockchains.

For more information, please refer to: https://tronbox.io/docs/guides/work-with-evm

## Ruby Examples

The project includes comprehensive Ruby examples for interacting with the PaymentSplitter contract using the `tron.rb` gem.

### Quick Start

```bash
cd examples
bundle install
cp .env.example .env
# Edit .env with your configuration
ruby ruby_payment_splitter.rb
```

### What's Included

- Complete examples for all contract functions
- Documentation for implementing contract interaction in `tron.rb`
- Environment configuration examples
- Security best practices

See [examples/README.md](examples/README.md) for detailed documentation.

### Current Status

⚠️ The `tron.rb` gem currently supports wallet balance and token information queries. Contract interaction methods (trigger_contract, call_contract) need to be implemented to fully support the PaymentSplitter examples.

## Additional Resources

For further learning, visit the official TronBox site at https://tronbox.io
