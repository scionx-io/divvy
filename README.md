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

# Get wallet address from private key
node get_address.js  # Requires PRIVATE_KEY_SHASTA in .env
```

### Current Deployed Contracts (Shasta Testnet)

- **PaymentSplitter**: `TSgJ2CobZa9u7SkRKb9dPb9vn2Ht4WdMAG`
  - [View on TronScan](https://shasta.tronscan.org/#/contract/TSgJ2CobZa9u7SkRKb9dPb9vn2Ht4WdMAG)

- **TestUSDT**: `TGSM2p5FJzrmo2QeoJH1MVMQAQH6bMbmaJ`
  - [View on TronScan](https://shasta.tronscan.org/#/contract/TGSM2p5FJzrmo2QeoJH1MVMQAQH6bMbmaJ)

## Security Notice

⚠️ **Important**: Never commit private keys or sensitive credentials to the repository. Always use environment variables or secure vaults to manage sensitive information.

