import { initTronWeb } from './utils.js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { keccak256, solidityPacked } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

// Contract addresses from .env
const PAYMENT_SPLITTER_ADDRESS = process.env.PAYMENT_SPLITTER_SHASTA_ADDRESS;
const MOCK_TOKEN_ADDRESS = process.env.TEST_TOKEN_ADDRESS;

async function debugSignature() {
  console.log('='.repeat(80));
  console.log('SIGNATURE GENERATION DEBUG (JavaScript)');
  console.log('='.repeat(80));
  console.log();

  const tronWeb = initTronWeb();
  const operator_private_key = process.env.OPERATOR_PRIVATE_KEY;
  const sender_private_key = process.env.SENDER_PRIVATE_KEY;

  const operatorAccount = tronWeb.address.fromPrivateKey(operator_private_key);
  const payerAccount = tronWeb.address.fromPrivateKey(sender_private_key);

  // Use same fixed test data as Ruby script
  const recipientAmount = BigInt(100 * 1000000); // 100 tokens in sun
  const feeAmount = BigInt(10 * 1000000); // 10 tokens in sun
  const paymentId = '0x0123456789abcdef0123456789abcdef'; // Fixed payment ID
  const deadline = 1762264860; // Fixed deadline
  const recipientAddress = operatorAccount;

  console.log('Test Parameters:');
  console.log(`  Recipient Amount: ${recipientAmount}`);
  console.log(`  Fee Amount: ${feeAmount}`);
  console.log(`  Payment ID: ${paymentId}`);
  console.log(`  Deadline: ${deadline}`);
  console.log(`  Recipient: ${recipientAddress}`);
  console.log(`  Token: ${MOCK_TOKEN_ADDRESS}`);
  console.log(`  Payer: ${payerAccount}`);
  console.log(`  Operator: ${operatorAccount}`);
  console.log(`  Splitter: ${PAYMENT_SPLITTER_ADDRESS}`);
  console.log();

  // Convert addresses to hex and show
  const recipientHex = '0x' + tronWeb.address.toHex(recipientAddress).replace(/^(0x)?41/, '');
  const tokenHex = '0x' + tronWeb.address.toHex(MOCK_TOKEN_ADDRESS).replace(/^(0x)?41/, '');
  const refundHex = '0x' + tronWeb.address.toHex(payerAccount).replace(/^(0x)?41/, '');
  const operatorHex = '0x' + tronWeb.address.toHex(operatorAccount).replace(/^(0x)?41/, '');
  const payerHex = '0x' + tronWeb.address.toHex(payerAccount).replace(/^(0x)?41/, '');
  const splitterHex = '0x' + tronWeb.address.toHex(PAYMENT_SPLITTER_ADDRESS).replace(/^(0x)?41/, '');

  console.log('Hex Addresses (without 41 prefix, with 0x):');
  console.log(`  Recipient: ${recipientHex}`);
  console.log(`  Token: ${tokenHex}`);
  console.log(`  Refund: ${refundHex}`);
  console.log(`  Operator: ${operatorHex}`);
  console.log(`  Payer: ${payerHex}`);
  console.log(`  Splitter: ${splitterHex}`);
  console.log();

  // Pack parameters
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
    paymentId,
    operatorHex,
    0x94a9059e, // Shasta chain ID
    payerHex,
    splitterHex
  ];

  console.log('Encoding parameters...');
  const encoded = solidityPacked(types, values);
  console.log(`Encoded (full): ${encoded}`);
  console.log(`Encoded length: ${encoded.length - 2} hex chars`);
  console.log();

  // Hash the encoded data
  const hash = keccak256(encoded);
  console.log(`Hash: ${hash}`);
  console.log();

  // Add TRON TIP-191 prefix
  const prefixedHash = keccak256(
    solidityPacked(['string', 'bytes32'], ['\x19Tron Signed Message:\n32', hash])
  );
  console.log(`Prefixed Hash: ${prefixedHash}`);
  console.log();

  // Sign
  const ethers = tronWeb.utils.ethersUtils;
  const privateKeyWithPrefix = operator_private_key.startsWith('0x') ? operator_private_key : '0x' + operator_private_key;
  const signingKey = new ethers.SigningKey(privateKeyWithPrefix);
  const signature = signingKey.sign(prefixedHash);

  console.log('Signature components:');
  console.log(`  r: ${signature.r}`);
  console.log(`  s: ${signature.s}`);
  console.log(`  v: ${signature.v}`);
  console.log();

  const v = signature.v >= 27 ? signature.v : signature.v + 27;
  const finalSignature = signature.r + signature.s.slice(2) + v.toString(16).padStart(2, '0');
  console.log(`Final Signature: 0x${finalSignature}`);
  console.log();

  console.log('='.repeat(80));
}

debugSignature().catch(console.error);
