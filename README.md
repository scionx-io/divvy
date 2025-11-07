# Divvy - PaymentSplitter for TRON

A smart contract system for splitting TRC20 token payments between recipients and operators with fee management on the TRON blockchain.

## Quick Start

### Scripts

- **Deployment**: `scripts/deploy-shasta.js`, `scripts/deploy-mainnet.js`
- **Testing**: `scripts/verify-shasta-contract.js`, `scripts/test-shasta-usdt.js`

### Setup

```bash
# Create .env file with your private key
cp .env.example .env  # Add your private key securely

# Deploy to Shasta testnet
node scripts/deploy-shasta.js
```

## Security

⚠️ **Important**: Never commit private keys or sensitive credentials. Use environment variables.

