/**
 * Utility functions for PaymentSplitter contract interaction
 */

import { TronWeb } from 'tronweb';
import { solidityPacked, keccak256, concat, hexlify, toUtf8Bytes, getBytes } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES6 module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from js directory
dotenv.config({ path: join(__dirname, '.env') });

// Contract addresses from .env
export const PAYMENT_SPLITTER_ADDRESS = process.env.CONTRACT_ADDRESS ;
export const MOCK_TOKEN_ADDRESS = process.env.TOKEN_ADDRESS ;

/**
 * Initialize TronWeb instance for Shasta testnet
 */
export function initTronWeb(privateKey = null) {
  // Check if we should use testing network
  const network = process.env.TRON_NETWORK || 'shasta'; // Default to shasta
  let fullHost;
  
  if (network === 'testing' || network === 'development') {
    fullHost = process.env.TESTING_NETWORK_URL || 'http://127.0.0.1:9090';
  } else if (network === 'nile') {
    fullHost = 'https://nile.trongrid.io';
  } else {
    fullHost = 'https://api.shasta.trongrid.io';
  }

  if (privateKey) {
    return new TronWeb({
      fullHost,
      privateKey
    });
  }

  if (network === 'testing' || network === 'development') {
    return new TronWeb({
      fullHost,
      privateKey: process.env.PRIVATE_KEY_DEV || '0000000000000000000000000000000000000000000000000000000000000001'
    });
  } else if (network === 'nile') {
    return new TronWeb({
      fullHost,
      privateKey: process.env.PRIVATE_KEY_NILE
    });
  } else {
    return new TronWeb({
      fullHost,
      privateKey: process.env.PRIVATE_KEY_SHASTA
    });
  }
}

/**
 * Load PaymentSplitter contract instance
 */
export async function getPaymentSplitterContract(tronWeb) {
  // Use dynamic import for JSON files in ES6 modules
  const { default: contractJson } = await import('../../build/contracts/PaymentSplitter.json', {
    with: { type: 'json' }
  });
  return await tronWeb.contract(contractJson.abi, PAYMENT_SPLITTER_ADDRESS);
}

/**
 * Load MockTRC20 token contract instance
 */
export async function getMockTokenContract(tronWeb) {
  const { default: contractJson } = await import('../../build/contracts/MockTRC20.json', {
    with: { type: 'json' }
  });
  return await tronWeb.contract(contractJson.abi, MOCK_TOKEN_ADDRESS);
}

/**
 * Generate unique payment ID (bytes16 = 32 hex characters)
 */
export function generatePaymentId() {
  const bytes = [];
  for (let i = 0; i < 16; i++) {
    bytes.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
  }
  return '0x' + bytes.join('');
}

/**
 * Get future timestamp (default 1 hour from now)
 */
export function getFutureTimestamp(offsetSeconds = 3600) {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

/**
 * Create a signed payment intent using TRON TIP-191 standard
 * @param {Object} params - Payment parameters
 * @param {string} operatorPrivateKey - Operator's private key for signing
 * @param {number} chainId - Network chain ID (Shasta = 0x94a9059c)
 */
export async function createSignedIntent(params, operatorPrivateKey, chainId = 0x94a9059e) {
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

  const tronWeb = initTronWeb();

  // Convert TRON base58 addresses to hex format and strip '41' prefix for ethers.js
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
  const privateKeyWithPrefix = operatorPrivateKey.startsWith('0x') ? operatorPrivateKey : '0x' + operatorPrivateKey;
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
 * Wait for transaction confirmation
 */
export async function waitForTransaction(tronWeb, txHash) {
  console.log(`Waiting for transaction: ${txHash}`);

  for (let i = 0; i < 30; i++) {
    await sleep(2000);

    try {
      // Use getTransactionInfo to get the actual execution receipt
      const txInfo = await tronWeb.trx.getTransactionInfo(txHash);

      if (txInfo && txInfo.id) {
        // Transaction has been confirmed and executed
        if (txInfo.receipt) {
          if (txInfo.receipt.result === 'SUCCESS') {
            console.log('✓ Transaction confirmed');
            return txInfo;
          } else if (txInfo.receipt.result === 'REVERT') {
            // Get revert reason if available
            const revertReason = txInfo.contractResult && txInfo.contractResult[0]
              ? tronWeb.toUtf8(txInfo.contractResult[0])
              : 'Unknown reason';
            throw new Error(`Transaction reverted: ${revertReason}`);
          } else if (txInfo.receipt.result === 'OUT_OF_ENERGY') {
            throw new Error('Transaction failed: Out of energy');
          } else {
            throw new Error(`Transaction failed: ${txInfo.receipt.result}`);
          }
        }
      }
    } catch (error) {
      // If error is thrown above, re-throw it
      if (error.message.includes('Transaction')) {
        throw error;
      }
      // Otherwise, transaction not found yet, continue waiting
    }
  }

  throw new Error('Transaction timeout - transaction not confirmed after 60 seconds');
}

/**
 * Sleep helper
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format TRX amount to sun
 */
export function toSun(amount) {
  return TronWeb.toSun(amount);
}

/**
 * Format sun to TRX
 */
export function fromSun(amount) {
  return TronWeb.fromSun(amount);
}

/**
 * Print contract call result nicely
 */
export function printResult(title, result) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
  console.log(result);
  console.log('='.repeat(60) + '\n');
}
