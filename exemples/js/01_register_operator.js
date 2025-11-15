/**
 * Example: Register an operator with a fee destination
 *
 * This example shows how to:
 * 1. Initialize TronWeb connection
 * 2. Load the PaymentSplitter contract
 * 3. Register an operator with a custom fee destination
 * 4. Verify the registration
 */

import {
  initTronWeb,
  getPaymentSplitterContract,
  waitForTransaction,
  printResult
} from './utils.js';

async function main() {
  try {
    console.log('=== Register Operator Example ===\n');

    // Initialize TronWeb (using default account from .env)
    const tronWeb = initTronWeb();
    const network = process.env.TRON_NETWORK || 'shasta';
    console.log(`Connected to ${network} testnet`);
    console.log(`Operator address: ${tronWeb.defaultAddress.base58}\n`);

    // Load PaymentSplitter contract
    const splitter = await getPaymentSplitterContract(tronWeb);
    console.log('PaymentSplitter contract loaded\n');

    // Set fee destination (where operator fees will be sent)
    // In this example, we use the same address as operator, but it can be different
    const feeDestination = tronWeb.defaultAddress.base58;

    console.log(`Registering operator...`);
    console.log(`Fee destination: ${feeDestination}\n`);

    // Register operator
    const tx = await splitter.registerOperatorWithFeeDestination(feeDestination).send({
      feeLimit: 100_000_000,
      callValue: 0
    });

    // Wait for confirmation
    await waitForTransaction(tronWeb, tx);

    // Verify registration
    console.log('\nVerifying registration...');
    const isRegistered = await splitter.isOperatorRegistered(tronWeb.defaultAddress.base58).call();
    const registeredFeeDestination = await splitter.getFeeDestination(tronWeb.defaultAddress.base58).call();

    printResult('Registration Result', {
      'Operator': tronWeb.defaultAddress.base58,
      'Is Registered': isRegistered,
      'Fee Destination': tronWeb.address.fromHex(registeredFeeDestination),
      'Transaction': tx
    });

    console.log('✓ Operator registered successfully!\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
