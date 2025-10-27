/**
 * Shasta Testnet USDT Test Script
 * Test PaymentSplitter contract with real USDT on Shasta testnet
 *
 * Usage: node test-shasta-usdt.js
 */

require('dotenv').config();
const { TronWeb } = require('tronweb');

// TestUSDT mock contract address on Shasta (deployed for testing)
const USDT_CONTRACT_ADDRESS = 'TGSM2p5FJzrmo2QeoJH1MVMQAQH6bMbmaJ';
// PaymentSplitter contract address
const PAYMENT_SPLITTER_ADDRESS = process.env.PAYMENT_SPLITTER_SHASTA_ADDRESS;

async function testShastaUSDT() {
  console.log('🧪 Starting PaymentSplitter USDT Test on Shasta Testnet...\n');

  // Initialize TronWeb for Shasta
  const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    privateKey: process.env.PRIVATE_KEY_SHASTA
  });

  const account = tronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY_SHASTA);
  console.log(`📍 Testing from: ${account}`);

  // Check balance
  const balance = await tronWeb.trx.getBalance(account);
  console.log(`💰 Balance: ${balance / 1e6} TRX\n`);

  if (balance < 10 * 1e6) {
    console.error('❌ Insufficient TRX balance! Need at least 10 TRX for testing.');
    process.exit(1);
  }

  try {
    // Load contract ABIs
    const testUSDTJson = require('../build/contracts/TestUSDT.json');
    const paymentSplitterJson = require('../build/contracts/PaymentSplitter.json');

    // Get USDT contract instance with explicit ABI
    const usdtContract = await tronWeb.contract(testUSDTJson.abi, USDT_CONTRACT_ADDRESS);
    console.log(`🔗 USDT Contract: ${USDT_CONTRACT_ADDRESS}`);
    console.log(`🔗 PaymentSplitter Contract: ${PAYMENT_SPLITTER_ADDRESS || 'NOT SET'}`);

    if (!PAYMENT_SPLITTER_ADDRESS) {
      console.error('❌ PaymentSplitter contract address not set in environment variable PAYMENT_SPLITTER_SHASTA_ADDRESS');
      console.log('Please deploy the contract first using: node deploy-shasta-improved.js');
      process.exit(1);
    }

    // If the address is in hex format (starting with 41), try to convert it
    let formattedAddress = PAYMENT_SPLITTER_ADDRESS;
    if (PAYMENT_SPLITTER_ADDRESS.startsWith('41') && PAYMENT_SPLITTER_ADDRESS.length === 42) {
      // Convert hex to base58
      formattedAddress = tronWeb.address.fromHex(PAYMENT_SPLITTER_ADDRESS);
      console.log(`Converted hex address to base58: ${formattedAddress}`);
    }

    // Get PaymentSplitter contract instance with explicit ABI
    const paymentSplitterContract = await tronWeb.contract(paymentSplitterJson.abi, formattedAddress);

    // Check USDT balance
    const usdtBalance = await usdtContract.balanceOf(account).call();
    const balanceBN = tronWeb.BigNumber(usdtBalance.toString());
    console.log(`💰 USDT Balance: ${balanceBN.div(1e6).toFixed(2)} USDT\n`);

    if (balanceBN.lte(0)) {
      console.log('⚠️  No USDT found in your account. Minting test USDT...');
      // Mint some test USDT (1000 USDT)
      const mintTx = await usdtContract.mintTokens(1000).send({
        from: account,
        feeLimit: 100_000_000
      });
      console.log(`✅ Minted 1000 USDT! Transaction: ${mintTx}\n`);

      // Wait a bit for transaction to confirm
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check balance again
      const newBalance = await usdtContract.balanceOf(account).call();
      const newBalanceBN = tronWeb.BigNumber(newBalance.toString());
      console.log(`💰 New USDT Balance: ${newBalanceBN.div(1e6).toFixed(2)} USDT\n`);
    }

    // Test parameters (USDT has 6 decimals)
    const recipient = account; // For testing, recipient is same as sender
    const operator = account; // For testing, operator is same as sender
    const recipientAmount = tronWeb.BigNumber(1 * 1e6); // 1 USDT to recipient
    const feeAmount = tronWeb.BigNumber(0.1 * 1e6); // 0.1 USDT as fee
    const totalAmount = recipientAmount.plus(feeAmount); // 1.1 USDT total
    const id = '0x' + Buffer.from('test_payment_001').toString('hex').padEnd(32, '0').substring(0, 32);
    
    console.log('📝 Testing PaymentSplitter with USDT...\n');
    
    // Step 1: Register operator
    console.log('1️⃣  Registering operator...');
    const registerResult = await paymentSplitterContract
      .registerOperator()
      .send({
        from: account,
        feeLimit: 100_000_000
      });
    console.log(`✅ Operator registered! Transaction: ${registerResult}\n`);

    // Step 2: Approve USDT spending
    console.log('2️⃣  Approving USDT spending for PaymentSplitter contract...');
    const approveResult = await usdtContract
      .approve(formattedAddress, totalAmount.toString())
      .send({
        from: account,
        feeLimit: 100_000_000
      });
    console.log(`✅ USDT approved! Transaction: ${approveResult}\n`);

    // Wait a bit for the approval to propagate
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Perform payment split
    console.log('3️⃣  Splitting USDT payment...');
    console.log(`   - Recipient: ${recipient}`);
    console.log(`   - USDT Amount to Recipient: ${recipientAmount.div(1e6)} USDT`);
    console.log(`   - USDT Fee Amount: ${feeAmount.div(1e6)} USDT`);
    console.log(`   - Total USDT Amount: ${totalAmount.div(1e6)} USDT`);
    console.log(`   - Operator: ${operator}`);
    console.log(`   - Payment ID: ${id}\n`);
    
    const splitResult = await paymentSplitterContract
      .splitPayment(
        recipient,
        USDT_CONTRACT_ADDRESS,
        recipientAmount.toString(),
        operator,
        feeAmount.toString(),
        id
      )
      .send({
        from: account,
        feeLimit: 100_000_000
      });
    
    console.log(`✅ Payment split executed! Transaction: ${splitResult}\n`);

    // Step 4: Verify the transaction
    console.log('4️⃣  Verifying transaction details...');

    // Check if payment is marked as processed
    const isProcessed = await paymentSplitterContract
      .isPaymentProcessed(operator, id)
      .call();
    console.log(`✅ Payment processed status: ${isProcessed}`);
    console.log(`✅ Transaction: https://shasta.tronscan.org/#/transaction/${splitResult}\n`);

    // Step 5: Test replay protection
    console.log('5️⃣  Testing replay protection (attempting same payment ID again)...');
    try {
      await paymentSplitterContract
        .splitPayment(
          recipient,
          USDT_CONTRACT_ADDRESS,
          recipientAmount.toString(),
          operator,
          feeAmount.toString(),
          id
        )
        .send({
          from: account,
          feeLimit: 100_000_000
        });
      console.log('❌ Replayed transaction should have failed!');
    } catch (error) {
      console.log(`✅ Replayed transaction correctly failed: ${error.message}\n`);
    }

    console.log('🎉 USDT test completed successfully!');
    console.log(`🔗 Transaction on TronScan: https://shasta.tronscan.org/#/transaction/${splitResult}`);

  } catch (error) {
    console.error('❌ USDT Test failed:', error.message);
    if (error.data && error.data.message) {
      console.error('Detailed error:', error.data.message);
    }
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testShastaUSDT()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { testShastaUSDT };