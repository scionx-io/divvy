/**
 * Check if operator is registered in the contract
 */

import { initTronWeb, getPaymentSplitterContract, CONTRACT_ADDRESS } from './utils.js';

async function main() {
  console.log('=== Checking Operator Registration ===\n');

  // Initialize TronWeb
  const tronWeb = initTronWeb();

  const operatorAddress = 'TCPh7Qd7DwHvphmfJGCQQgCGRP7aY4drEV';

  console.log('Contract Address:', CONTRACT_ADDRESS);
  console.log('Operator Address:', operatorAddress);
  console.log('');

  try {
    // Get contract instance
    const contract = await getPaymentSplitterContract(tronWeb);

    // Check if operator is registered by calling the view function
    // The contract has a mapping: mapping(address => address) public feeDestinations;
    const feeDestination = await contract.feeDestinations(operatorAddress).call();

    console.log('Fee Destination:', feeDestination);

    const isRegistered = feeDestination !== 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'; // Zero address in TRON base58

    if (isRegistered) {
      console.log('✅ Operator is registered!');
      console.log('Fee destination address:', feeDestination);
    } else {
      console.log('❌ Operator is NOT registered!');
      console.log('You need to register the operator first using 01_register_operator.js');
    }

  } catch (error) {
    console.error('❌ Error checking operator registration:', error.message);
  }
}

main().catch(console.error);
