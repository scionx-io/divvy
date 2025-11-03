/**
 * Example: Query operator information
 *
 * This example shows how to:
 * 1. Check if an operator is registered
 * 2. Get operator's fee destination
 * 3. Query multiple operators
 */

import {
  initTronWeb,
  getPaymentSplitterContract,
  printResult
} from './utils.js';

async function queryOperator(splitter, tronWeb, operatorAddress) {
  const isRegistered = await splitter.isOperatorRegistered(operatorAddress).call();

  if (isRegistered) {
    const feeDestinationHex = await splitter.getFeeDestination(operatorAddress).call();
    const feeDestination = tronWeb.address.fromHex(feeDestinationHex);

    return {
      operator: operatorAddress,
      isRegistered: true,
      feeDestination
    };
  }

  return {
    operator: operatorAddress,
    isRegistered: false,
    feeDestination: 'N/A'
  };
}

async function main() {
  try {
    console.log('=== Query Operator Information Example ===\n');

    // Initialize TronWeb
    const tronWeb = initTronWeb();
    console.log('Connected to Shasta testnet\n');

    // Load PaymentSplitter contract
    const splitter = await getPaymentSplitterContract(tronWeb);
    console.log('PaymentSplitter contract loaded\n');

    // Query current account
    console.log('Querying current account...');
    const currentAccountInfo = await queryOperator(
      splitter,
      tronWeb,
      tronWeb.defaultAddress.base58
    );

    printResult('Current Account Information', currentAccountInfo);

    console.log('✓ Query completed successfully!\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
