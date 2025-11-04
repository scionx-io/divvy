/**
 * Example: Query payment status
 *
 * This example shows how to:
 * 1. Check if a payment has been processed
 * 2. Query payment status for different operators
 */

import {
  initTronWeb,
  getPaymentSplitterContract,
  printResult
} from './utils.js';

async function queryPaymentStatus(splitter, operatorAddress, paymentId) {
  const isProcessed = await splitter.isPaymentProcessed(operatorAddress, paymentId).call();

  return {
    operator: operatorAddress,
    paymentId,
    isProcessed
  };
}

async function main() {
  try {
    console.log('=== Query Payment Status Example ===\n');

    // Initialize TronWeb
    const tronWeb = initTronWeb();
    console.log('Connected to Shasta testnet\n');

    // Load PaymentSplitter contract
    const splitter = await getPaymentSplitterContract(tronWeb);
    console.log('PaymentSplitter contract loaded\n');

    // Example payment ID (replace with actual payment ID from a previous transaction)
    const operatorAddress = tronWeb.defaultAddress.base58;
    const examplePaymentId = '0x00000000000000000000000000000000'; // Replace with real payment ID

    console.log('Query Parameters:');
    console.log(`  Operator: ${operatorAddress}`);
    console.log(`  Payment ID: ${examplePaymentId}\n`);

    // Query payment status
    console.log('Querying payment status...');
    const paymentStatus = await queryPaymentStatus(splitter, operatorAddress, examplePaymentId);

    printResult('Payment Status', paymentStatus);

    if (paymentStatus.isProcessed) {
      console.log('✓ Payment has been processed\n');
    } else {
      console.log('✗ Payment has not been processed yet\n');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
