const { expect } = require('chai');
const { solidityPacked, keccak256 } = require('ethers');

/**
 * Helper function to expect transaction revert on TRON
 */
async function expectRevert(promise, expectedError) {
  try {
    const txHash = await promise;

    // TRON may return transaction hash instead of throwing
    if (typeof txHash === 'string') {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const txInfo = await tronWeb.trx.getTransaction(txHash);
      if (txInfo?.ret?.[0]?.contractRet === 'REVERT') {
        return;
      }
    }

    throw new Error('Expected transaction to revert, but it succeeded');
  } catch (error) {
    const errorMessage = error.message || error.toString();

    if (errorMessage.includes('Expected transaction to revert')) {
      throw error;
    }

    if (expectedError && !errorMessage.toLowerCase().includes(expectedError.toLowerCase())) {
      if (errorMessage.toLowerCase().includes('revert')) {
        return;
      }
      throw new Error(`Expected error "${expectedError}", but got "${errorMessage}"`);
    }
  }
}

/**
 * Generate unique payment ID (bytes16 = 32 hex characters)
 */
function generatePaymentId() {
  // Generate 16 random bytes (32 hex characters)
  const bytes = [];
  for (let i = 0; i < 16; i++) {
    bytes.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
  }
  return '0x' + bytes.join('');
}

/**
 * Get TRON zero address in base58 format
 */
function getZeroAddress() {
  return tronWeb.address.fromHex('410000000000000000000000000000000000000000');
}

/**
 * Create a signed payment intent
 * @param {Object} params - Payment parameters
 * @param {string} privateKey - Operator's private key for signing
 * @param {number} chainId - Network chain ID
 */
async function createSignedIntent(params, privateKey, chainId) {
  const {
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
  } = params;

  // Convert TRON base58 addresses to hex format and strip '41' prefix for ethers.js
  // TRON addresses: 41 + 40 hex chars (21 bytes total)
  // EVM addresses: 0x + 40 hex chars (20 bytes)
  // We need to remove the '41' prefix to get the 20-byte address
  const recipientHex = '0x' + tronWeb.address.toHex(recipient).replace(/^(0x)?41/, '');
  const tokenHex = '0x' + tronWeb.address.toHex(tokenAddress).replace(/^(0x)?41/, '');
  const refundHex = '0x' + tronWeb.address.toHex(refundDestination).replace(/^(0x)?41/, '');
  const operatorHex = '0x' + tronWeb.address.toHex(operatorAddress).replace(/^(0x)?41/, '');
  const payerHex = '0x' + tronWeb.address.toHex(payerAddress).replace(/^(0x)?41/, '');
  const splitterHex = '0x' + tronWeb.address.toHex(splitterAddress).replace(/^(0x)?41/, '');

  // Pack parameters in same order as contract
  const types = [
    'uint256', 'uint256', 'address', 'address', 'address',
    'uint256', 'bytes16', 'address', 'uint256', 'address', 'address'
  ];

  const values = [
    recipientAmount,
    deadline,
    recipientHex,
    tokenHex,
    refundHex,
    feeAmount,
    id,
    operatorHex,
    chainId,
    payerHex,
    splitterHex
  ];

  // Create hash of packed parameters using ethers.js
  const encoded = solidityPacked(types, values);
  const hash = keccak256(encoded);

  // Add TRON TIP-191 signed message prefix (using imported ethers functions)
  const prefixedHash = keccak256(
    solidityPacked(['string', 'bytes32'], ['\x19Tron Signed Message:\n32', hash])
  );

  // Use TRON's ethers SigningKey to sign the digest (this is the key fix)
  const ethers = tronWeb.utils.ethersUtils;
  // Ensure private key has 0x prefix for ethers (only for parsing, doesn't affect TRON compatibility)
  const privateKeyWithPrefix = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
  const signingKey = new ethers.SigningKey(privateKeyWithPrefix);
  const signature = signingKey.sign(prefixedHash);

  // Extract r, s, v - check if v already includes the 27 offset
  const r = signature.r;
  const s = signature.s;
  // ethers.SigningKey.sign() returns v as 27/28, not 0/1, so don't add 27 again
  const v = signature.v >= 27 ? signature.v : signature.v + 27;

  // Return properly formatted signature (r + s + v in hex)
  return r + s.slice(2) + v.toString(16).padStart(2, '0');
}

/**
 * Get current timestamp plus offset in seconds
 */
function getFutureTimestamp(offsetSeconds = 3600) {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

/**
 * Get past timestamp
 */
function getPastTimestamp(offsetSeconds = 3600) {
  return Math.floor(Date.now() / 1000) - offsetSeconds;
}

module.exports = {
  expectRevert,
  generatePaymentId,
  getZeroAddress,
  createSignedIntent,
  getFutureTimestamp,
  getPastTimestamp
};