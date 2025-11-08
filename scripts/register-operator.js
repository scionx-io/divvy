/**
 * Script to register an operator on the PaymentSplitter contract
 * 
 * Usage: node scripts/register-operator.js
 */

require('dotenv').config();
const { TronWeb } = require('tronweb');

async function registerOperator() {
  console.log('🚀 Starting operator registration...\n');

  // Initialize TronWeb for Shasta (or mainnet based on your environment)
  const tronWeb = new TronWeb({
    fullHost: process.env.TRON_NETWORK_URL || 'https://api.shasta.trongrid.io', // Use Shasta for testing
    privateKey: process.env.PRIVATE_KEY_SHASTA || process.env.PRIVATE_KEY // Use appropriate private key
  });

  const account = tronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY_SHASTA || process.env.PRIVATE_KEY);
  console.log(`📍 Registering from account: ${account}`);

  // The operator address to register
  const operatorAddress = 'TCPh7Qd7DwHvphmfJGCQQgCGRP7aY4drEV';
  console.log(`📍 Operator address to register: ${operatorAddress}`);
  
  // Fee destination - where the operator's fees will be sent
  // For this registration, we'll use the operator address itself as the fee destination
  const feeDestination = operatorAddress;
  console.log(`📍 Fee destination: ${feeDestination}\n`);

  try {
    // Get the deployed contract address
    const contractAddress = process.env.PAYMENT_SPLITTER_SHASTA_ADDRESS || process.env.PAYMENT_SPLITTER_ADDRESS;
    
    if (!contractAddress) {
      console.error('❌ Error: PAYMENT_SPLITTER_SHASTA_ADDRESS or PAYMENT_SPLITTER_ADDRESS not found in .env file');
      console.log('Please set the appropriate environment variable with the contract address');
      process.exit(1);
    }
    
    console.log(`📍 PaymentSplitter contract address: ${contractAddress}`);

    // Load the deployed contract
    const contract = await tronWeb.contract().at(contractAddress);

    console.log(`\n📝 Registering operator ${operatorAddress} with fee destination ${feeDestination}...`);
    
    // Prepare the transaction
    const tx = await contract.registerOperatorWithFeeDestination(feeDestination).send({
      from: account,
      feeLimit: 100_000_000, // 100 TRX fee limit
      callValue: 0
    });

    console.log(`📝 Transaction ID: ${tx}`);
    console.log('⏳ Waiting for transaction confirmation...');

    // Wait for transaction confirmation
    let attempt = 0;
    const maxAttempts = 30;
    let txInfo = null;
    
    while (attempt < maxAttempts) {
      try {
        txInfo = await tronWeb.trx.getTransactionInfo(tx);
        
        if (txInfo && txInfo.id) {
          console.log(`✅ Transaction confirmed after ${attempt + 1} attempts`);
          console.log(`   - Block Number: ${txInfo.blockNumber}`);
          console.log(`   - Energy Used: ${txInfo.receipt?.energy_usage_total || 0}`);
          
          if (txInfo.receipt && txInfo.receipt.result === 'SUCCESS') {
            console.log(`   - Result: SUCCESS`);
            
            // Verify that the operator is now registered
            console.log('\n🔍 Verifying operator registration...');
            const isRegistered = await contract.isOperatorRegistered(operatorAddress).call();
            const registeredFeeDestination = await contract.getFeeDestination(operatorAddress).call();
            
            console.log(`✅ Verification Results:`);
            console.log(`   - Operator Address: ${operatorAddress}`);
            console.log(`   - Is Registered: ${isRegistered}`);
            console.log(`   - Fee Destination: ${tronWeb.address.fromHex(registeredFeeDestination)}`);
            
            if (isRegistered) {
              console.log(`\n🎉 Operator ${operatorAddress} has been successfully registered!`);
            } else {
              console.log(`\n❌ Operator registration verification failed!`);
            }
            
            console.log(`\n🔗 Transaction on TronScan: https://shasta.tronscan.org/#/transaction/${tx}`);
            console.log(`🔗 Contract: https://shasta.tronscan.org/#/contract/${contractAddress}`);
            
            break; // Exit the loop since we've confirmed the transaction
          } else if (txInfo.receipt && txInfo.receipt.result) {
            console.error(`❌ Transaction failed with result: ${txInfo.receipt.result}`);
            throw new Error(`Transaction failed with result: ${txInfo.receipt.result}`);
          }
        }
      } catch (error) {
        // Transaction not confirmed yet, continue waiting
      }

      attempt++;
      console.log(`   Attempt ${attempt}/${maxAttempts} - waiting 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (!txInfo || !txInfo.id) {
      console.error(`❌ Transaction confirmation timeout after ${maxAttempts} attempts`);
      console.log(`   - Transaction ID: ${tx}`);
      console.log(`   - You can check the status manually on TronScan`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Registration failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the registration
if (require.main === module) {
  registerOperator()
    .then(() => {
      console.log('\n✅ Operator registration script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Operator registration script failed:', error);
      process.exit(1);
    });
}

module.exports = { registerOperator };