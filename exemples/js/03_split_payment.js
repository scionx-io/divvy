/**
 * Example: Execute a split payment
 *
 * This example shows how to:
 * 1. Create a signed payment intent
 * 2. Approve token spending
 * 3. Execute splitPayment transaction
 * 4. Verify the payment was processed
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
  printResult,
  PAYMENT_SPLITTER_ADDRESS
} from './utils.js';

async function main() {
  try {
    console.log('=== Split Payment Example ===\n');

    // Initialize TronWeb for operator
    const operatorTronWeb = initTronWeb(process.env.OPERATOR_PRIVATE_KEY);
    const operatorAddress = operatorTronWeb.defaultAddress.base58;
    console.log(`Operator address: ${operatorAddress}`);

    // Initialize TronWeb for payer (sender)
    const payerTronWeb = initTronWeb(process.env.SENDER_PRIVATE_KEY);
    const payerAddress = payerTronWeb.defaultAddress.base58;
    console.log(`Payer address: ${payerAddress}\n`);

    // Load contracts
    const splitter = await getPaymentSplitterContract(payerTronWeb);
    const token = await getMockTokenContract(payerTronWeb);
    console.log('Contracts loaded\n');

    // Define payment parameters
    const recipientAddress = payerAddress; // For demo, sending back to payer
    const recipientAmount = toSun(100); // 100 tokens to recipient
    const feeAmount = toSun(10); // 10 tokens as operator fee
    const paymentId = generatePaymentId();
    const deadline = getFutureTimestamp(3600); // 1 hour from now

    console.log('Payment Parameters:');
    console.log(`  Recipient: ${recipientAddress}`);
    console.log(`  Recipient Amount: ${fromSun(recipientAmount)} tokens`);
    console.log(`  Fee Amount: ${fromSun(feeAmount)} tokens`);
    console.log(`  Payment ID: ${paymentId}`);
    console.log(`  Deadline: ${new Date(deadline * 1000).toISOString()}\n`);

    // Check token balance
    const balance = await token.balanceOf(payerAddress).call();
    console.log(`Payer token balance: ${fromSun(balance)} tokens\n`);

    // Approve token spending
    const totalAmount = BigInt(recipientAmount) + BigInt(feeAmount);
    console.log(`Approving ${fromSun(totalAmount.toString())} tokens...`);
    const approveTx = await token.approve(PAYMENT_SPLITTER_ADDRESS, totalAmount.toString()).send({
      feeLimit: 100_000_000
    });
    await waitForTransaction(payerTronWeb, approveTx);

    // Create signed intent
    console.log('\nCreating signed payment intent...');
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
    }, process.env.OPERATOR_PRIVATE_KEY, 0x94a9059e); // Updated Shasta testnet chain ID (from debug script)

    console.log(`Signature created: ${signature.substring(0, 20)}...\n`);

    // Build intent array (must match contract struct order)
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

    // Execute split payment
    console.log('Executing split payment...');
    const splitTx = await splitter.splitPayment(intentArray).send({
      feeLimit: 200_000_000,
      callValue: 0
    });

    await waitForTransaction(payerTronWeb, splitTx);

    // Verify payment was processed
    console.log('\nVerifying payment...');
    const isProcessed = await splitter.isPaymentProcessed(operatorAddress, paymentId).call();

    printResult('Payment Result', {
      'Payment ID': paymentId,
      'Is Processed': isProcessed,
      'Recipient': recipientAddress,
      'Recipient Amount': `${fromSun(recipientAmount)} tokens`,
      'Fee Amount': `${fromSun(feeAmount)} tokens`,
      'Transaction': splitTx
    });

    console.log('✓ Payment executed successfully!\n');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.transaction) {
      console.error('Transaction:', error.transaction);
    }
    process.exit(1);
  }
}

// Run the example
main();
