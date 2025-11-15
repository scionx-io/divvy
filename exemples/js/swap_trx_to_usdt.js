/**
 * Swap TRX to USDT and Split Payment Example
 *
 * This example demonstrates:
 * 1. Get quote from SunSwap V3 Quoter for exact USDT output
 * 2. Create signed payment intent
 * 3. Execute swapAndSplitPayment (TRX → USDT → split to recipient + operator)
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
  sleep,
  PAYMENT_SPLITTER_ADDRESS
} from './utils.js';

// SunSwap V3 Quoter contract on Nile
const QUOTER_ADDRESS = 'TUcM2gkpWEJxBpkweLdVoRp6DAUsw2vWR6';
const WTRX_ADDRESS = 'TYsbWxNnyTgsZaTFaue9hqpxkU3Fkco94a';
const USDT_ADDRESS = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const NATIVE_TRX = '0x0000000000000000000000000000000000000000'; // address(0) for native TRX

// Quoter ABI
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
    console.log('='.repeat(80));
    console.log('SWAP TRX TO USDT AND SPLIT PAYMENT');
    console.log('='.repeat(80));
    console.log('\n');

    // ==========================================
    // STEP 1: SETUP
    // ==========================================
    console.log('STEP 1: Setup Accounts and Contracts');
    console.log('-'.repeat(80));

    // Initialize TronWeb instances
    const operatorTronWeb = initTronWeb(process.env.NILE_OPERATOR_PRIVATE_KEY);
    const operatorAddress = operatorTronWeb.defaultAddress.base58;
    console.log(`✓ Operator address: ${operatorAddress}`);

    const payerTronWeb = initTronWeb(process.env.SENDER_PRIVATE_KEY);
    const payerAddress = payerTronWeb.defaultAddress.base58;
    console.log(`✓ Payer address: ${payerAddress}`);

    const recipientAddress = operatorAddress; // For demo, operator is also recipient
    console.log(`✓ Recipient address: ${recipientAddress}`);

    const feeDestination = operatorAddress;
    console.log(`✓ Fee destination: ${feeDestination}\n`);

    // Load contracts
    const splitter = await getPaymentSplitterContract(payerTronWeb);
    console.log(`✓ PaymentSplitter: ${PAYMENT_SPLITTER_ADDRESS}`);

    await sleep(2000);

    // ==========================================
    // STEP 2: CHECK BALANCES
    // ==========================================
    console.log('\nSTEP 2: Check Initial Balances');
    console.log('-'.repeat(80));

    const initialTrxBalance = await payerTronWeb.trx.getBalance(payerAddress);
    console.log(`Payer TRX balance: ${fromSun(initialTrxBalance)} TRX`);

    const usdtContract = await payerTronWeb.contract().at(USDT_ADDRESS);
    const payerUsdtBalance = await usdtContract.balanceOf(payerAddress).call();
    const recipientUsdtBalance = await usdtContract.balanceOf(recipientAddress).call();
    const usdtDecimals = await usdtContract.decimals().call();

    console.log(`Payer USDT balance: ${Number(payerUsdtBalance) / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`Recipient USDT balance: ${Number(recipientUsdtBalance) / (10 ** Number(usdtDecimals))} USDT\n`);

    await sleep(2000);

    // ==========================================
    // STEP 3: GET SWAP QUOTE
    // ==========================================
    console.log('STEP 3: Get Swap Quote from SunSwap V3 Quoter');
    console.log('-'.repeat(80));

    // Define exact USDT amounts we want
    const recipientAmount = 5 * (10 ** Number(usdtDecimals)); // 5 USDT for recipient
    const feeAmount = 0.5 * (10 ** Number(usdtDecimals));     // 0.5 USDT for operator
    const totalUsdtNeeded = recipientAmount + feeAmount;      // 5.5 USDT total

    console.log(`Recipient amount: ${recipientAmount / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`Operator fee: ${feeAmount / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`Total USDT needed: ${totalUsdtNeeded / (10 ** Number(usdtDecimals))} USDT`);

    // Get quote from Quoter
    const quoter = await payerTronWeb.contract(QUOTER_ABI, QUOTER_ADDRESS);
    const poolFee = 10000; // 1% fee tier

    console.log('\nGetting quote from Quoter...');
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

    await sleep(2000);

    // ==========================================
    // STEP 4: VERIFY OPERATOR IS REGISTERED
    // ==========================================
    console.log('STEP 4: Verify Operator Registration');
    console.log('-'.repeat(80));

    const isRegistered = await splitter.isOperatorRegistered(operatorAddress).call();
    console.log(`Operator registered: ${isRegistered ? '✓ Yes' : '✗ No'}`);

    if (!isRegistered) {
      console.log('\nRegistering operator...');
      const operatorSplitter = await getPaymentSplitterContract(operatorTronWeb);
      const registerTx = await operatorSplitter.registerOperatorWithFeeDestination(feeDestination).send({
        feeLimit: 100_000_000,
        callValue: 0
      });
      await waitForTransaction(operatorTronWeb, registerTx);
      console.log('✓ Operator registered successfully\n');
    } else {
      console.log('✓ Operator already registered\n');
    }

    await sleep(2000);

    // ==========================================
    // STEP 5: CREATE SIGNED PAYMENT INTENT
    // ==========================================
    console.log('STEP 5: Create Signed Payment Intent');
    console.log('-'.repeat(80));

    const paymentId = generatePaymentId();
    const deadline = getFutureTimestamp(3600);
    const chainId = 0xcd8690dc; // Nile testnet chain ID

    console.log(`Payment ID: ${paymentId}`);
    console.log(`Recipient: ${recipientAddress}`);
    console.log(`Token (output): ${USDT_ADDRESS}`);
    console.log(`Recipient Amount: ${recipientAmount / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`Fee Amount: ${feeAmount / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`Deadline: ${new Date(deadline * 1000).toISOString()}`);

    const signature = await createSignedIntent({
      recipientAmount: recipientAmount.toString(),
      deadline,
      recipient: recipientAddress,
      tokenAddress: USDT_ADDRESS, // Output token
      refundDestination: payerAddress,
      feeAmount: feeAmount.toString(),
      id: paymentId,
      operatorAddress,
      payerAddress,
      splitterAddress: PAYMENT_SPLITTER_ADDRESS
    }, process.env.NILE_OPERATOR_PRIVATE_KEY, chainId);

    console.log(`✓ Signature created: ${signature.substring(0, 20)}...\n`);

    await sleep(2000);

    // ==========================================
    // STEP 6: EXECUTE SWAP AND SPLIT PAYMENT
    // ==========================================
    console.log('STEP 6: Execute Swap and Split Payment');
    console.log('-'.repeat(80));

    const intentArray = [
      recipientAddress,
      USDT_ADDRESS,                    // Output token
      recipientAmount.toString(),
      operatorAddress,
      feeAmount.toString(),
      paymentId,
      deadline.toString(),
      payerAddress,
      signature
    ];

    console.log('Swap parameters:');
    console.log(`  Input token: TRX (native)`);
    console.log(`  Output token: USDT`);
    console.log(`  Exact TRX to pay: ${fromSun(trxNeeded)} TRX`);
    console.log(`  Pool fee tier: ${poolFee / 10000}%`);

    console.log('\nExecuting swapAndSplitPayment...');
    const swapTx = await splitter.swapAndSplitPayment(
      intentArray,
      NATIVE_TRX,          // tokenIn = address(0) for native TRX
      trxNeeded.toString(), // exactAmountToPay from quoter
      poolFee
    ).send({
      feeLimit: toSun(1000),
      callValue: trxNeeded, // Send exact TRX amount
      shouldPollResponse: true
    });

    await waitForTransaction(payerTronWeb, swapTx);
    console.log('✓ Swap and split payment executed successfully');
    console.log(`  Transaction: ${swapTx}`);
    console.log(`  View on NileScan: https://nile.tronscan.org/#/transaction/${swapTx}\n`);

    await sleep(3000);

    // ==========================================
    // STEP 7: VERIFY RESULTS
    // ==========================================
    console.log('STEP 7: Verify Results');
    console.log('-'.repeat(80));

    // Check payment is processed
    const isProcessed = await splitter.isPaymentProcessed(operatorAddress, paymentId).call();
    console.log(`Payment processed: ${isProcessed ? '✓ Yes' : '✗ No'}`);

    // Check final balances
    const finalTrxBalance = await payerTronWeb.trx.getBalance(payerAddress);
    const finalPayerUsdtBalance = await usdtContract.balanceOf(payerAddress).call();
    const finalRecipientUsdtBalance = await usdtContract.balanceOf(recipientAddress).call();

    console.log('\nFinal Balances:');
    console.log(`Payer TRX: ${fromSun(initialTrxBalance)} → ${fromSun(finalTrxBalance)} TRX`);
    console.log(`Payer USDT: ${Number(payerUsdtBalance) / (10 ** Number(usdtDecimals))} → ${Number(finalPayerUsdtBalance) / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`Recipient USDT: ${Number(recipientUsdtBalance) / (10 ** Number(usdtDecimals))} → ${Number(finalRecipientUsdtBalance) / (10 ** Number(usdtDecimals))} USDT`);

    // Calculate changes
    const trxSpent = fromSun(initialTrxBalance - finalTrxBalance);
    const usdtReceived = (Number(finalRecipientUsdtBalance) - Number(recipientUsdtBalance)) / (10 ** Number(usdtDecimals));

    console.log('\nSwap Summary:');
    console.log(`  TRX spent: ${trxSpent.toFixed(6)} TRX`);
    console.log(`  USDT received: ${usdtReceived.toFixed(6)} USDT`);
    console.log(`  Effective price: ${(trxSpent / usdtReceived).toFixed(6)} TRX per USDT`);

    // Get transaction info
    const txInfo = await payerTronWeb.trx.getTransactionInfo(swapTx);
    console.log('\nGas Usage:');
    console.log(`  Energy used: ${txInfo.receipt.energy_usage_total || 0}`);
    console.log(`  Net used: ${txInfo.receipt.net_usage || 0}`);

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(80));
    console.log('SWAP COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nSummary:');
    console.log(`  • Swapped: ${trxSpent.toFixed(6)} TRX → ${usdtReceived.toFixed(6)} USDT`);
    console.log(`  • Recipient received: ${recipientAmount / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`  • Operator fee: ${feeAmount / (10 ** Number(usdtDecimals))} USDT`);
    console.log(`  • Payment ID: ${paymentId}`);
    console.log(`  • Transaction: ${swapTx}`);
    console.log('\n✓ All steps completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(error.message);
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
