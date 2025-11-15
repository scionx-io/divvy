/**
 * Example: Swap TRX to USDT and Split Payment
 *
 * This example shows how to:
 * 1. Get quote from SunSwap V3 Quoter for exact USDT output
 * 2. Create a signed payment intent
 * 3. Execute swapAndSplitPayment (TRX → USDT swap + split)
 * 4. Verify the payment was processed
 */

import {
  initTronWeb,
  getPaymentSplitterContract,
  generatePaymentId,
  getFutureTimestamp,
  createSignedIntent,
  waitForTransaction,
  toSun,
  fromSun,
  printResult,
  PAYMENT_SPLITTER_ADDRESS
} from './utils.js';

// SunSwap V3 Quoter and token addresses on Nile
const QUOTER_ADDRESS = 'TUcM2gkpWEJxBpkweLdVoRp6DAUsw2vWR6';
const WTRX_ADDRESS = 'TYsbWxNnyTgsZaTFaue9hqpxkU3Fkco94a';
const USDT_ADDRESS = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const NATIVE_TRX = '0x0000000000000000000000000000000000000000'; // address(0) for native TRX

// Quoter ABI for getting swap quotes
const QUOTER_ABI = [{
  constant: true,
  inputs: [
    { name: "tokenIn", type: "address" },
    { name: "tokenOut", type: "address" },
    { name: "fee", type: "uint24" },
    { name: "amountOut", type: "uint256" },
    { name: "sqrtPriceLimitX96", type: "uint160" }
  ],
  name: "quoteExactOutputSingle",
  outputs: [{ name: "amountIn", type: "uint256" }],
  stateMutability: "view",
  type: "function"
}];

async function main() {
  try {
    console.log('=== Swap TRX to USDT and Split Payment ===\n');

    // Initialize TronWeb for operator
    const operatorTronWeb = initTronWeb(process.env.NILE_OPERATOR_PRIVATE_KEY);
    const operatorAddress = operatorTronWeb.defaultAddress.base58;
    console.log(`Operator address: ${operatorAddress}`);

    // Initialize TronWeb for payer (sender)
    const payerTronWeb = initTronWeb(process.env.SENDER_PRIVATE_KEY);
    const payerAddress = payerTronWeb.defaultAddress.base58;
    console.log(`Payer address: ${payerAddress}\n`);

    // Load contracts
    const splitter = await getPaymentSplitterContract(payerTronWeb);
    const usdtContract = await payerTronWeb.contract().at(USDT_ADDRESS);
    console.log('Contracts loaded\n');

    // Check initial balances
    const initialTrxBalance = await payerTronWeb.trx.getBalance(payerAddress);
    const initialUsdtBalance = await usdtContract.balanceOf(payerAddress).call();
    const usdtDecimals = await usdtContract.decimals().call();

    console.log('Initial Balances:');
    console.log(`  Payer TRX: ${fromSun(initialTrxBalance)} TRX`);
    console.log(`  Payer USDT: ${Number(initialUsdtBalance) / (10 ** Number(usdtDecimals))} USDT\n`);

    // Define payment parameters (in USDT)
    const recipientAddress = operatorAddress; // Operator receives USDT
    const recipientAmount = 5 * (10 ** Number(usdtDecimals)); // 5 USDT to recipient
    const feeAmount = 0.5 * (10 ** Number(usdtDecimals)); // 0.5 USDT as operator fee
    const totalUsdtNeeded = recipientAmount + feeAmount; // 5.5 USDT total
    const paymentId = generatePaymentId();
    const deadline = getFutureTimestamp(3600); // 1 hour from now

    console.log('Payment Parameters:');
    console.log(`  Recipient: ${recipientAddress}`);
    console.log(`  Recipient Amount: ${recipientAmount / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`  Fee Amount: ${feeAmount / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`  Total USDT needed: ${totalUsdtNeeded / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`  Payment ID: ${paymentId}`);
    console.log(`  Deadline: ${new Date(deadline * 1000).toISOString()}\n`);

    // Get swap quote from SunSwap V3 Quoter
    console.log('Getting swap quote from SunSwap V3 Quoter...');
    const quoter = await payerTronWeb.contract(QUOTER_ABI, QUOTER_ADDRESS);
    const poolFee = 3000; // 0.3% fee tier (same as MinimalTRXToUSDTSwap)

    const quoteResult = await quoter.quoteExactOutputSingle(
      WTRX_ADDRESS,
      USDT_ADDRESS,
      poolFee,
      totalUsdtNeeded,
      0
    ).call();

    // Extract the actual value from the result
    const exactTrxNeeded = typeof quoteResult === 'object'
      ? (quoteResult.amountIn || quoteResult[0] || quoteResult)
      : quoteResult;
    const trxNeeded = Number(exactTrxNeeded);

    console.log(`✓ Exact TRX needed: ${fromSun(trxNeeded)} TRX (from quoter)\n`);

    // Verify operator is registered
    const isRegistered = await splitter.isOperatorRegistered(operatorAddress).call();
    if (!isRegistered) {
      console.log('Registering operator...');
      const operatorSplitter = await getPaymentSplitterContract(operatorTronWeb);
      const registerTx = await operatorSplitter.registerOperatorWithFeeDestination(operatorAddress).send({
        feeLimit: 100_000_000,
        callValue: 0
      });
      await waitForTransaction(operatorTronWeb, registerTx);
      console.log('✓ Operator registered\n');
    } else {
      console.log('✓ Operator already registered\n');
    }

    // Create signed intent
    console.log('Creating signed payment intent...');
    const signature = await createSignedIntent({
      recipientAmount: recipientAmount.toString(),
      deadline,
      recipient: recipientAddress,
      tokenAddress: USDT_ADDRESS, // Output token is USDT
      refundDestination: payerAddress,
      feeAmount: feeAmount.toString(),
      id: paymentId,
      operatorAddress,
      payerAddress,
      splitterAddress: PAYMENT_SPLITTER_ADDRESS
    }, process.env.NILE_OPERATOR_PRIVATE_KEY, 0xcd8690dc); // Nile testnet chain ID

    console.log(`Signature created: ${signature.substring(0, 20)}...\n`);

    // Build intent array (must match contract struct order)
    const intentArray = [
      recipientAddress,
      USDT_ADDRESS, // Output token
      recipientAmount.toString(),
      operatorAddress,
      feeAmount.toString(),
      paymentId,
      deadline.toString(),
      payerAddress,
      signature
    ];

    // Execute swap and split payment
    console.log('Executing swapAndSplitPayment...');
    console.log(`  Swapping: ${fromSun(trxNeeded)} TRX → ${totalUsdtNeeded / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`  Pool fee: ${poolFee / 100}% (${poolFee} basis points)\n`);

    const swapTx = await splitter.swapAndSplitPayment(
      intentArray,
      NATIVE_TRX,              // tokenIn = address(0) for native TRX
      trxNeeded.toString(),    // exactAmountToPay from quoter
      poolFee
    ).send({
      feeLimit: toSun(1000),   // 1000 TRX fee limit
      callValue: trxNeeded,    // Send exact TRX amount
      shouldPollResponse: true
    });

    await waitForTransaction(payerTronWeb, swapTx);
    console.log('✓ Swap and split payment executed successfully');
    console.log(`  Transaction: ${swapTx}\n`);

    // Verify payment was processed
    console.log('Verifying payment...');
    const isProcessed = await splitter.isPaymentProcessed(operatorAddress, paymentId).call();

    // Check final balances
    const finalTrxBalance = await payerTronWeb.trx.getBalance(payerAddress);
    const finalUsdtBalance = await usdtContract.balanceOf(payerAddress).call();
    const recipientUsdtBalance = await usdtContract.balanceOf(recipientAddress).call();

    console.log('\nFinal Balances:');
    console.log(`  Payer TRX: ${fromSun(initialTrxBalance)} → ${fromSun(finalTrxBalance)} TRX`);
    console.log(`  Payer USDT: ${Number(initialUsdtBalance) / (10 ** Number(usdtDecimals))} → ${Number(finalUsdtBalance) / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`  Recipient USDT: ${Number(recipientUsdtBalance) / (10 ** Number(usdtDecimals))} USDT`);

    const trxSpent = fromSun(initialTrxBalance - finalTrxBalance);
    const usdtReceived = totalUsdtNeeded / (10 ** Number(usdtDecimals));

    printResult('Swap Result', {
      'Payment ID': paymentId,
      'Is Processed': isProcessed,
      'TRX Spent': `${trxSpent.toFixed(6)} TRX`,
      'USDT Received': `${usdtReceived} USDT`,
      'Recipient': recipientAddress,
      'Recipient Amount': `${recipientAmount / (10 ** Number(usdtDecimals))} USDT`,
      'Fee Amount': `${feeAmount / (10 ** Number(usdtDecimals))} USDT`,
      'Effective Price': `${(trxSpent / usdtReceived).toFixed(6)} TRX per USDT`,
      'Transaction': swapTx,
      'View on NileScan': `https://nile.tronscan.org/#/transaction/${swapTx}`
    });

    console.log('✓ Swap and payment executed successfully!\n');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.transaction) {
      console.error('Transaction:', error.transaction);
    }
    if (error.error) {
      console.error('Error details:', error.error);
    }
    process.exit(1);
  }
}

// Run the example
main();
