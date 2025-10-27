/**
 * Production Mainnet Deployment Script
 * Deploy PaymentSplitter without Migrations.sol overhead
 *
 * Usage: node deploy-mainnet.js
 */

const { TronWeb } = require('tronweb');
require('dotenv').config();

async function deployToMainnet() {
  console.log('🚀 Starting PaymentSplitter Mainnet Deployment...\n');

  // Initialize TronWeb
  const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: process.env.PRIVATE_KEY_MAINNET
  });

  const account = tronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY_MAINNET);
  console.log(`📍 Deploying from: ${account}`);

  // Check balance
  const balance = await tronWeb.trx.getBalance(account);
  console.log(`💰 Balance: ${balance / 1e6} TRX\n`);

  if (balance < 1000 * 1e6) {
    console.error('❌ Insufficient balance! Need at least 1000 TRX for deployment.');
    process.exit(1);
  }

  try {
    // Read compiled contract
    const contractJson = require('../build/contracts/PaymentSplitter.json');

    console.log('📝 Deploying PaymentSplitter contract...');

    // Deploy contract
    const contract = await tronWeb.contract().new({
      abi: contractJson.abi,
      bytecode: contractJson.bytecode,
      feeLimit: 200_000_000, // 200 TRX
      callValue: 0,
      userFeePercentage: 100,
      originEnergyLimit: 10_000_000
    });

    const contractAddress = contract.address;
    console.log(`\n✅ PaymentSplitter deployed successfully!`);
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔗 TronScan: https://tronscan.org/#/contract/${contractAddress}\n`);

    // Verify deployment
    const code = await tronWeb.trx.getContract(contractAddress);
    if (code && code.bytecode) {
      console.log('✅ Contract verified on-chain');
    }

    // Save deployment info
    const fs = require('fs');
    const deploymentInfo = {
      network: 'mainnet',
      contract: 'PaymentSplitter',
      address: contractAddress,
      deployer: account,
      timestamp: new Date().toISOString(),
      txId: contract.transaction?.txID
    };

    fs.writeFileSync(
      '../deployment-mainnet.json',
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log('💾 Deployment info saved to deployment-mainnet.json\n');

    console.log('🎉 Deployment complete!');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deployToMainnet()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployToMainnet };
