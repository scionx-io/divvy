// Script to get wallet address from private key in environment variable
require('dotenv').config();
const TronWeb = require('tronweb').default || require('tronweb');

const privateKey = process.env.PRIVATE_KEY_SHASTA;

if (!privateKey || privateKey === 'your_private_key_here') {
    console.error('Error: PRIVATE_KEY_SHASTA not set in environment or still has default value');
    console.error('Please set your private key in .env file');
    process.exit(1);
}

const tronWeb = new TronWeb({
  fullHost: 'https://api.shasta.trongrid.io'
});

try {
  const address = tronWeb.address.fromPrivateKey(privateKey);
  console.log('Wallet Address:', address);
} catch (error) {
  console.error('Error getting address from private key:', error.message);
  process.exit(1);
}