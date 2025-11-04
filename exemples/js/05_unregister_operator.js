/**
 * Example: Unregister an operator
 *
 * This example shows how to:
 * 1. Check current operator registration status
 * 2. Unregister an operator
 * 3. Verify the unregistration
 *
 * WARNING: After unregistering, the operator cannot process new payments
 * until they register again.
 */

import {
  initTronWeb,
  getPaymentSplitterContract,
  waitForTransaction,
  printResult
} from './utils.js';

async function main() {
  try {
    console.log('=== Unregister Operator Example ===\n');

    // Initialize TronWeb (using default account from .env)
    const tronWeb = initTronWeb();
    console.log('Connected to Shasta testnet');
    console.log(`Operator address: ${tronWeb.defaultAddress.base58}\n`);

    // Load PaymentSplitter contract
    const splitter = await getPaymentSplitterContract(tronWeb);
    console.log('PaymentSplitter contract loaded\n');

    // Check current registration status
    console.log('Checking current registration status...');
    const isRegisteredBefore = await splitter.isOperatorRegistered(tronWeb.defaultAddress.base58).call();

    if (!isRegisteredBefore) {
      console.log('✗ Operator is not registered. Nothing to unregister.\n');
      return;
    }

    const feeDestinationBefore = await splitter.getFeeDestination(tronWeb.defaultAddress.base58).call();
    console.log(`Current status: Registered`);
    console.log(`Fee destination: ${tronWeb.address.fromHex(feeDestinationBefore)}\n`);

    // Unregister operator
    console.log('Unregistering operator...');
    const tx = await splitter.unregisterOperator().send({
      feeLimit: 100_000_000,
      callValue: 0
    });

    // Wait for confirmation
    await waitForTransaction(tronWeb, tx);

    // Verify unregistration
    console.log('\nVerifying unregistration...');
    const isRegisteredAfter = await splitter.isOperatorRegistered(tronWeb.defaultAddress.base58).call();
    const feeDestinationAfter = await splitter.getFeeDestination(tronWeb.defaultAddress.base58).call();

    printResult('Unregistration Result', {
      'Operator': tronWeb.defaultAddress.base58,
      'Was Registered': isRegisteredBefore,
      'Is Registered Now': isRegisteredAfter,
      'Fee Destination': tronWeb.address.fromHex(feeDestinationAfter),
      'Transaction': tx
    });

    console.log('✓ Operator unregistered successfully!\n');
    console.log('⚠️  Note: The operator can no longer process payments until re-registered.\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
