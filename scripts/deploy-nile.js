/**
 * Nile Testnet Deployment Script
 * Deploy PaymentSplitter with proper transaction confirmation and error handling
 *
 * Usage: node scripts/deploy-nile.js
 */

require('dotenv').config();
const { TronWeb } = require('tronweb');
const fs = require('fs');

async function waitForConfirmation(tronWeb, txId, maxAttempts = 20) {
  console.log(`⏳ Waiting for transaction confirmation: ${txId}`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const txInfo = await tronWeb.trx.getTransactionInfo(txId);

      if (txInfo && txInfo.id) {
        console.log(`✅ Transaction confirmed after ${i + 1} attempts`);
        console.log(`   - Block Number: ${txInfo.blockNumber}`);
        console.log(`   - Energy Used: ${txInfo.receipt?.energy_usage_total || 0}`);
        console.log(`   - Net Used: ${txInfo.receipt?.net_usage || 0}`);

        if (txInfo.receipt && txInfo.receipt.result === 'SUCCESS') {
          console.log(`   - Result: SUCCESS`);
          return txInfo;
        } else if (txInfo.receipt && txInfo.receipt.result) {
          console.error(`   - Result: ${txInfo.receipt.result}`);
          throw new Error(`Transaction failed with result: ${txInfo.receipt.result}`);
        } else {
          return txInfo;
        }
      }
    } catch (error) {
      // Transaction not yet confirmed, continue waiting
    }

    console.log(`   Attempt ${i + 1}/${maxAttempts} - waiting 3 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error('Transaction confirmation timeout');
}

async function deployToNile() {
  console.log('🚀 Starting PaymentSplitter Nile Testnet Deployment...\n');

  // Initialize TronWeb for Nile
  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.PRIVATE_KEY_NILE
  });

  // Validate private key is set
  if (!process.env.PRIVATE_KEY_NILE) {
    console.error('❌ PRIVATE_KEY_NILE environment variable not set');
    console.error('Please set it in your .env file');
    process.exit(1);
  }

  const account = tronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY_NILE);
  console.log(`📍 Deploying from: ${account}`);

  // Check balance
  let balance;
  try {
    balance = await tronWeb.trx.getBalance(account);
    console.log(`💰 Balance: ${balance / 1e6} TRX\n`);
  } catch (error) {
    console.error('❌ Failed to get balance:', error.message);
    console.error('   This might be due to network issues or incorrect API endpoint.');
    console.error('   Please verify that the Nile endpoint is correct and accessible.');
    process.exit(1);
  }

  if (balance < 100 * 1e6) {
    console.error('❌ Insufficient balance! Need at least 100 TRX for deployment.');
    console.log('💡 Get TRX from Nile faucet: https://nileex.io/join/getJoinPage');
    process.exit(1);
  }

  try {
    // Read compiled contract
    const contractJson = require('../build/contracts/PaymentSplitter.json');

    console.log('📝 Contract Info:');
    console.log(`   - Name: ${contractJson.contractName}`);
    console.log(`   - Bytecode Length: ${contractJson.bytecode?.length || 0}`);
    console.log(`   - ABI Entries: ${contractJson.abi?.length || 0}\n`);

    console.log('📝 Deploying PaymentSplitter contract...');
    console.log('   This may take 30-60 seconds...\n');

    // Deploy contract using TronWeb
    let contractInstance;
    let deployTxId;

    try {
      contractInstance = await tronWeb.contract().new({
        abi: contractJson.abi,
        bytecode: contractJson.bytecode,
        feeLimit: 1_000_000_000, // Increase to 1000 TRX
        callValue: 0,
        userFeePercentage: 100,
        originEnergyLimit: 10_000_000,
        parameters: [] // No constructor parameters for PaymentSplitter
      });

      // Get transaction ID if available
      deployTxId = contractInstance.transaction?.txID || contractInstance.txID;

      if (deployTxId) {
        console.log(`📝 Deployment Transaction ID: ${deployTxId}`);

        // Wait for confirmation
        await waitForConfirmation(tronWeb, deployTxId);
      } else {
        console.warn('⚠️  Warning: No transaction ID available. Waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

    } catch (deployError) {
      console.error('❌ Deployment failed:', deployError.message);
      console.error('   Full error:', deployError);
      throw deployError;
    }

    const contractAddress = contractInstance.address;
    console.log(`\n📍 Contract Address (from deployment): ${contractAddress}`);

    // Convert to base58 if needed
    let base58Address = contractAddress;
    if (contractAddress.startsWith('41')) {
      base58Address = tronWeb.address.fromHex(contractAddress);
      console.log(`📍 Contract Address (Base58): ${base58Address}`);
    }

    // Wait a bit more for contract to be indexed
    console.log('\n⏳ Waiting 5 seconds for contract indexing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify deployment on-chain
    console.log('\n🔍 Verifying contract on blockchain...');
    const contractInfo = await tronWeb.trx.getContract(base58Address);

    if (contractInfo && contractInfo.bytecode) {
      console.log('✅ Contract verified on-chain!');
      console.log(`   - Has Bytecode: true`);
      console.log(`   - Has ABI: ${!!contractInfo.abi}`);
    } else {
      console.warn('⚠️  Warning: Contract not yet indexed or deployment failed');
      console.warn('   Contract Info:', contractInfo);

      // Try to get account info
      const accountInfo = await tronWeb.trx.getAccount(base58Address);
      console.log('   Account Info:', {
        exists: !!accountInfo.address,
        type: accountInfo.type,
        balance: accountInfo.balance || 0
      });

      if (accountInfo.type !== 2) {
        throw new Error('Contract deployment failed - account type is not contract (type 2)');
      }
    }

    console.log(`\n🔗 TronScan: https://nile.tronscan.org/#/contract/${base58Address}`);
    if (deployTxId) {
      console.log(`🔗 Transaction: https://nile.tronscan.org/#/transaction/${deployTxId}`);
    }

    // Save deployment info
    const deploymentInfo = {
      network: 'nile',
      contract: 'PaymentSplitter',
      address: contractAddress,
      base58Address: base58Address,
      deployer: account,
      timestamp: new Date().toISOString(),
      txId: deployTxId || 'unknown'
    };

    const deploymentPath = './deployment-nile.json';
    fs.writeFileSync(
      deploymentPath,
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log(`\n💾 Deployment info saved to ${deploymentPath}`);

    console.log('\n🎉 Nile Deployment complete!');
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Update .env with: PAYMENT_SPLITTER_NILE_ADDRESS=${base58Address}`);
    console.log(`   2. Test the contract functionality on Nile testnet`);

    return {
      address: contractAddress,
      base58Address: base58Address,
      txId: deployTxId
    };

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deployToNile()
    .then((result) => {
      console.log('\n✅ Deployment script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Deployment script failed:', error);
      process.exit(1);
    });
}

module.exports = { deployToNile };