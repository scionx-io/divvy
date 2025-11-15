# PaymentSplitter Deployment Info

## Network
- **Network:** TRON Nile Testnet
- **RPC:** https://nile.trongrid.io

## Contracts

### PaymentSplitter (Option C - TransferHelper)
- **Address:** `TAhPiz4igFT1pcpbFkMJApV25XLsdVChqo`
- **Status:** ✅ **PRODUCTION READY**
- **Solution:** Uses TransferHelper library for USDT compatibility
- **Tested:** Yes, 10 USDT transferred successfully
- **Date Deployed:** November 15, 2025

### SmartExchangeRouter
- **Address:** `TP8GMDwJZfU6AqGf8UKZrbPo1mTdomsnVD`
- **Status:** ✅ Working
- **Tested:** Yes, all swap types working

### Previous Deployments (Deprecated)
- `TPKqmD8bk4kiJdZ1BNSAJeqo7n64AAZHfg` - Option B (direct transfer) - Working but deprecated
- `TMhe5uPU3fX13KMipcU4u63u2bxfcpFdx5` - Original (SafeTRC20) - Failed, deprecated

## Configuration Files

### Update .env
```bash
CONTRACT_ADDRESS=TAhPiz4igFT1pcpbFkMJApV25XLsdVChqo
```

### Registered Operator
- **Address:** `TCPh7Qd7DwHvphmfJGCQQgCGRP7aY4drEV`
- **Fee Destination:** `TCPh7Qd7DwHvphmfJGCQQgCGRP7aY4drEV`
- **Status:** Registered

## Quick Test

```bash
cd exemples/js
node complete_workflow.js
```

Expected result: 10 USDT transferred successfully

## For Mainnet

**IMPORTANT:** Before mainnet deployment, update `TransferHelper.sol`:

```solidity
// Line 12 in TransferHelper.sol
// Change from:
address constant USDT_ADDR = 0xECa9bC828A3005B9a3b909f2cc5c2a54794DE05F; // Nile

// To:
address constant USDT_ADDR = 0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C; // Mainnet
```

## Contract Verification

View on NileScan:
https://nile.tronscan.org/#/contract/TAhPiz4igFT1pcpbFkMJApV25XLsdVChqo
