/**
 * Script to register an operator on the PaymentSplitter contract
 * 
 * Usage: node scripts/register-operator-standalone.js <operator_address> [fee_destination]
 * Example: node scripts/register-operator-standalone.js TCPh7Qd7DwHvphmfJGCQQgCGRP7aY4drEV
 */

require('dotenv').config();
const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

async function registerOperator(operatorAddress, feeDestination = null) {
  console.log('🚀 Starting operator registration...\n');

  // Validate operator address
  if (!operatorAddress) {
    console.error('❌ Error: Operator address is required');
    console.log('Usage: node scripts/register-operator-standalone.js <operator_address> [fee_destination]');
    console.log('Example: node scripts/register-operator-standalone.js TCPh7Qd7DwHvphmfJGCQQgCGRP7aY4drEV');
    process.exit(1);
  }

  // Validate address format
  if (!operatorAddress.startsWith('T') || operatorAddress.length !== 34) {
    console.error(`❌ Error: Invalid TRON address format for operator: ${operatorAddress}`);
    process.exit(1);
  }

  // Initialize TronWeb for Shasta (or mainnet based on your environment)
  const tronWeb = new TronWeb({
    fullHost: process.env.TRON_NETWORK_URL || 'https://api.shasta.trongrid.io', // Use Shasta for testing
    privateKey: process.env.PRIVATE_KEY_SHASTA || process.env.PRIVATE_KEY // Use appropriate private key
  });

  const account = tronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY_SHASTA || process.env.PRIVATE_KEY);
  console.log(`📍 Registering from account: ${account}`);
  console.log(`📍 Operator address to register: ${operatorAddress}`);
  
  // If fee destination is not provided, use the operator address itself
  if (!feeDestination) {
    feeDestination = operatorAddress;
  }
  
  // Validate fee destination format
  if (!feeDestination.startsWith('T') || feeDestination.length !== 34) {
    console.error(`❌ Error: Invalid TRON address format for fee destination: ${feeDestination}`);
    process.exit(1);
  }
  
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
    // First, let's load the ABI from the compiled contract file
    const fs = require('fs');
    const path = require('path');
    
    // Try to read the ABI from the compiled contract
    let contractAbi;
    try {
      const contractPath = path.join(__dirname, '../build/contracts/PaymentSplitter.json');
      const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      contractAbi = contractData.abi;
    } catch (error) {
      console.log('⚠️  Could not load ABI from build directory, attempting to load with address only...');
      console.log('This might cause the "unknown function" error');
    }
    
    // If ABI is available, use it to create the contract instance
    let contract;
    if (contractAbi) {
      contract = await tronWeb.contract(contractAbi, contractAddress);
    } else {
      // If ABI is not available, try to create contract instance with just address
      contract = await tronWeb.contract().at(contractAddress);
    }

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

// Parse command line arguments
const args = process.argv.slice(2);
const operatorAddress = args[0];
const feeDestination = args[1] || null;

// Run the registration
if (require.main === module) {
  registerOperator(operatorAddress, feeDestination)
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