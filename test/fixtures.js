const { generatePaymentId, createSignedIntent, getFutureTimestamp } = require('./helpers');

/**
 * Common test fixtures and helper functions
 */

/**
 * Create a payment intent with defaults
 */
async function createIntent(options, operatorPrivateKey, chainId) {
  const {
    recipientAmount,
    feeAmount,
    recipient,
    tokenAddress,
    refundDestination,
    operatorAddress,
    payerAddress,
    splitterAddress,
    deadline = getFutureTimestamp(),
    id = generatePaymentId()
  } = options;

  const signature = await createSignedIntent({
    recipientAmount,
    deadline,
    recipient,
    tokenAddress,
    refundDestination,
    feeAmount,
    id,
    operatorAddress,
    payerAddress,
    splitterAddress
  }, operatorPrivateKey, chainId);

  return {
    intentArray: [
      recipient,
      tokenAddress,
      recipientAmount,
      operatorAddress,
      feeAmount,
      id,
      deadline,
      refundDestination,
      signature
    ],
    id,
    signature,
    deadline
  };
}

/**
 * Create intent array without signature (for tests using dummy signatures)
 */
function createIntentArray(params) {
  const {
    recipient,
    token,
    recipientAmount,
    operator,
    feeAmount,
    id,
    deadline,
    refundDestination,
    signature = '0x' + '00'.repeat(65)
  } = params;

  return [
    recipient,
    token,
    recipientAmount,
    operator,
    feeAmount,
    id,
    deadline,
    refundDestination,
    signature
  ];
}

module.exports = {
  createIntent,
  createIntentArray
};
