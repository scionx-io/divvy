/**
 * Complete End-to-End Workflow Example
 *
 * This example demonstrates the complete PaymentSplitter workflow:
 * 1. Register an operator
 * 2. Setup test token and balances
 * 3. Execute a split payment
 * 4. Query payment status
 * 5. Query operator information
 */

import {
  initTronWeb,
  getPaymentSplitterContract,
  getMockTokenContract,
  generatePaymentId,
  getFutureTimestamp,
  createSignedIntent,
  waitForTransaction,
  toSun,
  fromSun,
  sleep,
  PAYMENT_SPLITTER_ADDRESS
} from './utils.js';

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('COMPLETE PAYMENT SPLITTER WORKFLOW');
    console.log('='.repeat(80));
    console.log('\n');

    // ==========================================
    // STEP 1: SETUP
    // ==========================================
    console.log('STEP 1: Setup Accounts and Contracts');
    console.log('-'.repeat(80));

    // Initialize TronWeb for operator
    const operatorTronWeb = initTronWeb(process.env.OPERATOR_PRIVATE_KEY);
    const operatorAddress = operatorTronWeb.defaultAddress.base58;
    console.log(`✓ Operator address: ${operatorAddress}`);

    // Initialize TronWeb for payer
    const payerTronWeb = initTronWeb(process.env.SENDER_PRIVATE_KEY);
    const payerAddress = payerTronWeb.defaultAddress.base58;
    console.log(`✓ Payer address: ${payerAddress}`);

    // Create a recipient address (for demo, we'll use operator as recipient)
    const recipientAddress = operatorAddress;
    console.log(`✓ Recipient address: ${recipientAddress}`);

    // Fee destination (where operator fees go)
    const feeDestination = operatorAddress;
    console.log(`✓ Fee destination: ${feeDestination}\n`);

    // Load contracts (payer sends the splitPayment transaction)
    const splitter = await getPaymentSplitterContract(payerTronWeb);
    const token = await getMockTokenContract(payerTronWeb);
    console.log('✓ Contracts loaded\n');

    await sleep(2000);

    // ==========================================
    // STEP 2: REGISTER OPERATOR
    // ==========================================
    console.log('STEP 2: Register Operator');
    console.log('-'.repeat(80));

    // Check if already registered
    let isRegistered = await splitter.isOperatorRegistered(operatorAddress).call();

    if (!isRegistered) {
      console.log('Registering operator...');
      const registerTx = await splitter.registerOperatorWithFeeDestination(feeDestination).send({
        feeLimit: 100_000_000,
        callValue: 0
      });
      await waitForTransaction(operatorTronWeb, registerTx);
      console.log(`✓ Operator registered successfully\n`);
    } else {
      console.log('✓ Operator already registered\n');
    }

    await sleep(2000);

    // ==========================================
    // STEP 3: SETUP TOKEN BALANCES
    // ==========================================
    console.log('STEP 3: Setup Token Balances');
    console.log('-'.repeat(80));

    const payerBalance = await token.balanceOf(payerAddress).call();
    console.log(`Payer token balance: ${fromSun(payerBalance)} tokens`);

    if (BigInt(payerBalance) < toSun(200)) {
      console.log('⚠️  Warning: Payer has insufficient balance for demo');
      console.log('   Please ensure the payer has at least 200 tokens\n');
    } else {
      console.log('✓ Payer has sufficient balance\n');
    }

    await sleep(2000);

    // ==========================================
    // STEP 4: APPROVE TOKEN SPENDING
    // ==========================================
    console.log('STEP 4: Approve Token Spending');
    console.log('-'.repeat(80));

    const recipientAmount = toSun(100);
    const feeAmount = toSun(10);
    const totalAmount = BigInt(recipientAmount) + BigInt(feeAmount);

    console.log(`Approving ${fromSun(totalAmount.toString())} tokens...`);
    const approveTx = await token.approve(PAYMENT_SPLITTER_ADDRESS, totalAmount.toString()).send({
      feeLimit: 100_000_000
    });
    await waitForTransaction(payerTronWeb, approveTx);
    console.log('✓ Token spending approved\n');

    await sleep(2000);

    // ==========================================
    // STEP 5: CREATE SIGNED PAYMENT INTENT
    // ==========================================
    console.log('STEP 5: Create Signed Payment Intent');
    console.log('-'.repeat(80));

    const paymentId = generatePaymentId();
    const deadline = getFutureTimestamp(3600);

    console.log(`Payment ID: ${paymentId}`);
    console.log(`Recipient: ${recipientAddress}`);
    console.log(`Recipient Amount: ${fromSun(recipientAmount)} tokens`);
    console.log(`Fee Amount: ${fromSun(feeAmount)} tokens`);
    console.log(`Deadline: ${new Date(deadline * 1000).toISOString()}`);

    const chainId = 0x94a9059e; // Updated Shasta testnet chain ID (from debug script)
    console.log(`Using chain ID: ${chainId} (0x${chainId.toString(16)})`);

    const signature = await createSignedIntent({
      recipientAmount: recipientAmount.toString(),
      deadline,
      recipient: recipientAddress,
      tokenAddress: token.address,
      refundDestination: payerAddress,
      feeAmount: feeAmount.toString(),
      id: paymentId,
      operatorAddress,
      payerAddress,
      splitterAddress: PAYMENT_SPLITTER_ADDRESS
    }, process.env.OPERATOR_PRIVATE_KEY, chainId);

    console.log(`✓ Signature created: ${signature.substring(0, 20)}...\n`);

    await sleep(2000);

    // ==========================================
    // STEP 6: EXECUTE SPLIT PAYMENT
    // ==========================================
    console.log('STEP 6: Execute Split Payment');
    console.log('-'.repeat(80));

    const intentArray = [
      recipientAddress,
      token.address,
      recipientAmount.toString(),
      operatorAddress,
      feeAmount.toString(),
      paymentId,
      deadline.toString(),
      payerAddress,
      signature
    ];

    console.log('Intent array:');
    console.log(`  [0] recipient: ${intentArray[0]}`);
    console.log(`  [1] token: ${intentArray[1]}`);
    console.log(`  [2] recipientAmount: ${intentArray[2]}`);
    console.log(`  [3] operator: ${intentArray[3]}`);
    console.log(`  [4] feeAmount: ${intentArray[4]}`);
    console.log(`  [5] paymentId: ${intentArray[5]}`);
    console.log(`  [6] deadline: ${intentArray[6]}`);
    console.log(`  [7] refundDest: ${intentArray[7]}`);
    console.log(`  [8] signature: ${intentArray[8].substring(0, 20)}...`);

    console.log('\nExecuting split payment...');
    const splitTx = await splitter.splitPayment(intentArray).send({
      feeLimit: 200_000_000,
      callValue: 0
    });

    await waitForTransaction(payerTronWeb, splitTx);
    console.log('✓ Payment executed successfully');
    console.log(`  Transaction: ${splitTx}\n`);

    await sleep(2000);

    // ==========================================
    // STEP 7: VERIFY PAYMENT
    // ==========================================
    console.log('STEP 7: Verify Payment Status');
    console.log('-'.repeat(80));

    const isProcessed = await splitter.isPaymentProcessed(operatorAddress, paymentId).call();
    console.log(`Payment processed: ${isProcessed ? '✓ Yes' : '✗ No'}`);

    if (isProcessed) {
      console.log(`✓ Payment ID ${paymentId} has been successfully processed\n`);
    }

    await sleep(2000);

    // ==========================================
    // STEP 8: CHECK FINAL BALANCES
    // ==========================================
    console.log('STEP 8: Check Final Balances');
    console.log('-'.repeat(80));

    const payerBalanceAfter = await token.balanceOf(payerAddress).call();
    const recipientBalanceAfter = await token.balanceOf(recipientAddress).call();
    const feeDestBalanceAfter = await token.balanceOf(feeDestination).call();

    console.log(`Payer balance: ${fromSun(payerBalance)} → ${fromSun(payerBalanceAfter)} tokens`);
    console.log(`Recipient balance: ${fromSun(recipientBalanceAfter)} tokens (received: ${fromSun(recipientAmount)})`);
    console.log(`Fee destination balance: ${fromSun(feeDestBalanceAfter)} tokens (fee: ${fromSun(feeAmount)})\n`);

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('='.repeat(80));
    console.log('WORKFLOW COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nSummary:');
    console.log(`  • Operator registered: ✓`);
    console.log(`  • Payment executed: ✓`);
    console.log(`  • Payment ID: ${paymentId}`);
    console.log(`  • Transaction: ${splitTx}`);
    console.log(`  • Recipient received: ${fromSun(recipientAmount)} tokens`);
    console.log(`  • Operator earned: ${fromSun(feeAmount)} tokens`);
    console.log('\n✓ All steps completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(error.message);
    if (error.transaction) {
      console.error('Transaction:', error.transaction);
    }
    process.exit(1);
  }
}

// Run the example
main();
