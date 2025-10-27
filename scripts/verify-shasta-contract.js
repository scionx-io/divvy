/**
 * Shasta Testnet Contract Verification Script
 * Verify PaymentSplitter contract deployment and basic functionality on Shasta testnet
 *
 * Usage: node verify-shasta-contract.js
 */

require('dotenv').config();
const { TronWeb } = require('tronweb');

async function verifyContract() {
  console.log('🔍 Starting PaymentSplitter Contract Verification on Shasta Testnet...\n');

  // Initialize TronWeb for Shasta
  const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    privateKey: process.env.PRIVATE_KEY_SHASTA
  });

  const account = tronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY_SHASTA);
  console.log(`📍 Verifying from: ${account}`);

  // Check balance
  const balance = await tronWeb.trx.getBalance(account);
  console.log(`💰 TRX Balance: ${balance / 1e6} TRX\n`);

  if (balance < 10 * 1e6) {
    console.error('❌ Insufficient TRX balance! Need at least 10 TRX for verification.');
    process.exit(1);
  }

  const contractAddress = process.env.PAYMENT_SPLITTER_SHASTA_ADDRESS;
  
  if (!contractAddress) {
    console.error('❌ PaymentSplitter contract address not set in environment variable PAYMENT_SPLITTER_SHASTA_ADDRESS');
    console.log('Please deploy the contract first using: node deploy-shasta.js');
    process.exit(1);
  }

  try {
    console.log(`Attempting to connect to contract: ${contractAddress}`);
    
    // If the address is in hex format (starting with 41), try to convert it
    let formattedAddress = contractAddress;
    if (contractAddress.startsWith('41') && contractAddress.length === 42) {
      // Convert hex to base58
      formattedAddress = tronWeb.address.fromHex(contractAddress);
      console.log(`Converted hex address to base58: ${formattedAddress}`);
    }
    
    // Get PaymentSplitter contract instance
    const paymentSplitterContract = await tronWeb.contract().at(formattedAddress);
    console.log(`🔗 PaymentSplitter Contract: ${contractAddress}`);
    console.log(`🔗 TronScan: https://shasta.tronscan.org/#/contract/${contractAddress}\n`);

    // Test basic functionality: register operator
    console.log('📝 Testing basic functionality...');
    
    // Check if account is already registered as operator
    const isRegisteredBefore = await paymentSplitterContract
      .isOperatorRegistered(account)
      .call();
    
    console.log(`📋 Account registered as operator before test: ${isRegisteredBefore}`);
    
    if (!isRegisteredBefore) {
      console.log('1️⃣  Registering operator...');
      const registerResult = await paymentSplitterContract
        .registerOperator()
        .send({
          from: account,
          feeLimit: 100_000_000
        });
      console.log(`✅ Operator registered! Transaction: ${registerResult}\n`);
    }
    
    // Verify registration
    const isRegisteredAfter = await paymentSplitterContract
      .isOperatorRegistered(account)
      .call();
    console.log(`✅ Account registered as operator after test: ${isRegisteredAfter}`);
    
    const feeDestination = await paymentSplitterContract
      .getFeeDestination(account)
      .call();
    console.log(`✅ Fee destination: ${feeDestination}\n`);
    
    // Generate a unique payment ID for testing
    const testId = '0x' + Buffer.from(`test_${Date.now()}`).toString('hex').padEnd(32, '0').substring(0, 32);
    
    // Check if this payment ID is processed
    const isProcessed = await paymentSplitterContract
      .isPaymentProcessed(account, testId)
      .call();
    console.log(`✅ Payment ID ${testId} processed status: ${isProcessed}\n`);
    
    // Test changing fee destination
    console.log('2️⃣  Updating fee destination...');
    const newFeeDestination = account; // Same address for test
    const updateResult = await paymentSplitterContract
      .registerOperatorWithFeeDestination(newFeeDestination)
      .send({
        from: account,
        feeLimit: 100_000_000
      });
    console.log(`✅ Fee destination updated! Transaction: ${updateResult}\n`);
    
    // Verify the update
    const updatedFeeDestination = await paymentSplitterContract
      .getFeeDestination(account)
      .call();
    console.log(`✅ Updated fee destination: ${updatedFeeDestination}\n`);
    
    console.log('🎉 Contract verification completed successfully!');
    console.log('The contract is working correctly on Shasta testnet.');
    console.log('Now you can proceed with USDT testing using: node test-shasta-usdt.js');

  } catch (error) {
    console.error('❌ Contract verification failed:', error.message);
    if (error.data && error.data.message) {
      console.error('Detailed error:', error.data.message);
    }
    process.exit(1);
  }
}

// Run verification
if (require.main === module) {
  verifyContract()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { verifyContract };