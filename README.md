# Divvy - PaymentSplitter for TRON

A smart contract system for splitting TRC20 token payments between recipients and operators with fee management on the TRON blockchain.

## New: Universal Router Integration

This version introduces a new `PaymentSplitterWithUniversalRouter` contract that leverages a Universal Router for atomic execution of swaps and transfers, following the Uniswap Universal Router pattern.

### Key Features of the Universal Router Implementation

1. **Atomic Execution**: All operations (swap, transfers, refunds) happen atomically in a single transaction
2. **Command-Based Operations**: Uses a command pattern similar to Uniswap's Universal Router:
   - `V3_SWAP_EXACT_OUT` (0x00): Performs the token swap with exact output
   - `TRANSFER` (0x01): Distributes tokens to recipients and fee destinations
   - `SWEEP` (0x02): Returns unused input tokens to the payer
3. **Direct Distribution**: Output tokens go directly to intended recipients without intermediate holding
4. **Gas Efficiency**: Minimized number of external calls through batched operations

### How It Works

The Universal Router pattern executes the following sequence atomically:

1. **V3_SWAP_EXACT_OUT**: Swaps input tokens for exact output amounts, with output going to the router
2. **TRANSFER**: Distributes output tokens to recipient
3. **TRANSFER**: Distributes output tokens to fee destination
4. **SWEEP**: Returns any unused input tokens back to the payer

This eliminates the need for intermediate holding contracts and provides better security and efficiency.

## Quick Start

### Scripts

- **Deployment**: `scripts/deploy-shasta.js`, `scripts/deploy-mainnet.js`
- **Testing**: `scripts/verify-shasta-contract.js`, `scripts/test-shasta-usdt.js`
- **New Feature**: `scripts/deploy-nile.js` for deploying minimal TRX to USDT swap contract

### Setup

```bash
# Create .env file with your private key
cp .env.example .env  # Add your private key securely

# Deploy to Shasta testnet
node scripts/deploy-shasta.js
```

## New Feature: Minimal TRX to USDT Swap Contract

The repository now includes `MinimalTRXToUSDTSwap.sol`, a minimal contract that swaps TRX to USDT via SunSwap V3's exactOutputSingle function. This contract allows for simple TRX to USDT swaps with a straightforward interface.

### Deploying the Minimal Swap Contract to Nile Testnet

To deploy the MinimalTRXToUSDTSwap contract to the Nile testnet:

1. Ensure you have a private key for the Nile testnet in your `.env` file as `PRIVATE_KEY_NILE`
2. Update the contract addresses in the migration file with actual Nile testnet addresses
3. Run:

```bash
tronbox migrate --network nile
```

## Security

⚠️ **Important**: Never commit private keys or sensitive credentials. Use environment variables.

