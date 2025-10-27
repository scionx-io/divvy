/**
 * Deploy TestUSDT Mock Contract to Shasta
 * Creates a test USDT token for testing PaymentSplitter
 *
 * Usage: node scripts/deploy-test-usdt.js
 */

require('dotenv').config();
const { TronWeb } = require('tronweb');
const fs = require('fs');

async function waitForConfirmation(tronWeb, txId, maxAttempts = 20) {
  console.log(`⏳ Waiting for transaction confirmation...`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const txInfo = await tronWeb.trx.getTransactionInfo(txId);

      if (txInfo && txInfo.id) {
        console.log(`✅ Transaction confirmed after ${i + 1} attempts`);

        if (txInfo.receipt && txInfo.receipt.result === 'SUCCESS') {
          return txInfo;
        } else if (txInfo.receipt && txInfo.receipt.result) {
          throw new Error(`Transaction failed: ${txInfo.receipt.result}`);
        } else {
          return txInfo;
        }
      }
    } catch (error) {
      // Not yet confirmed
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error('Transaction confirmation timeout');
}

async function deployTestUSDT() {
  console.log('🚀 Deploying TestUSDT Mock Contract to Shasta...\n');

  const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    privateKey: process.env.PRIVATE_KEY_SHASTA
  });

  const account = tronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY_SHASTA);
  console.log(`📍 Deploying from: ${account}`);

  const balance = await tronWeb.trx.getBalance(account);
  console.log(`💰 Balance: ${balance / 1e6} TRX\n`);

  if (balance < 50 * 1e6) {
    console.error('❌ Insufficient balance! Need at least 50 TRX.');
    process.exit(1);
  }

  try {
    const contractJson = require('../build/contracts/TestUSDT.json');

    console.log('📝 Contract Info:');
    console.log(`   - Name: ${contractJson.contractName}`);
    console.log(`   - Bytecode Length: ${contractJson.bytecode?.length || 0}`);
    console.log(`   - ABI Entries: ${contractJson.abi?.length || 0}\n`);

    console.log('📝 Deploying TestUSDT contract...');

    let contractInstance;
    let deployTxId;

    try {
      contractInstance = await tronWeb.contract().new({
        abi: contractJson.abi,
        bytecode: contractJson.bytecode,
        feeLimit: 1_000_000_000, // 1000 TRX
        callValue: 0,
        userFeePercentage: 100,
        originEnergyLimit: 10_000_000,
        parameters: [] // No constructor parameters
      });

      deployTxId = contractInstance.transaction?.txID || contractInstance.txID;

      if (deployTxId) {
        console.log(`📝 Transaction ID: ${deployTxId}`);
        await waitForConfirmation(tronWeb, deployTxId);
      } else {
        console.warn('⚠️  No transaction ID. Waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

    } catch (deployError) {
      console.error('❌ Deployment failed:', deployError.message);
      throw deployError;
    }

    const contractAddress = contractInstance.address;
    let base58Address = contractAddress;

    if (contractAddress.startsWith('41')) {
      base58Address = tronWeb.address.fromHex(contractAddress);
    }

    console.log(`\n📍 TestUSDT Address: ${base58Address}`);

    // Wait for indexing
    console.log('\n⏳ Waiting 5 seconds for contract indexing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify deployment
    console.log('\n🔍 Verifying contract...');
    const contractInfo = await tronWeb.trx.getContract(base58Address);

    if (contractInfo && contractInfo.bytecode) {
      console.log('✅ Contract verified on-chain!');

      // Test the contract
      console.log('\n📝 Testing contract functions...');
      const testUSDT = await tronWeb.contract(contractJson.abi, base58Address);

      const name = await testUSDT.name().call();
      const symbol = await testUSDT.symbol().call();
      const decimals = await testUSDT.decimals().call();
      const totalSupply = await testUSDT.totalSupply().call();
      const balance = await testUSDT.balanceOf(account).call();

      console.log(`   - Name: ${name}`);
      console.log(`   - Symbol: ${symbol}`);
      console.log(`   - Decimals: ${decimals}`);
      console.log(`   - Total Supply: ${tronWeb.BigNumber(totalSupply._hex).div(1e6)} USDT`);
      console.log(`   - Deployer Balance: ${tronWeb.BigNumber(balance._hex).div(1e6)} USDT`);

    } else {
      console.warn('⚠️  Contract not yet indexed');
    }

    console.log(`\n🔗 TronScan: https://shasta.tronscan.org/#/contract/${base58Address}`);

    // Save deployment info
    const deploymentInfo = {
      network: 'shasta',
      contract: 'TestUSDT',
      address: contractAddress,
      base58Address: base58Address,
      deployer: account,
      timestamp: new Date().toISOString(),
      txId: deployTxId || 'unknown'
    };

    fs.writeFileSync(
      '../deployment-test-usdt-shasta.json',
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log('\n💾 Deployment info saved');
    console.log('\n🎉 TestUSDT Deployment complete!');
    console.log(`\n📝 Update your .env or test script with:`);
    console.log(`   TEST_USDT_SHASTA_ADDRESS=${base58Address}`);

    return {
      address: contractAddress,
      base58Address: base58Address,
      txId: deployTxId
    };

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  deployTestUSDT()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployTestUSDT };
