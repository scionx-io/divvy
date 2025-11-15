const ethUtil = require('ethereumjs-util');
const abi = require('ethereumjs-abi');

// Function to sign payment intent following TRON TIP-191 standard
async function signPaymentIntent(intent, privateKey) {
    // Create the hash of the intent data
    const encodedData = abi.solidityPack(
        ['uint256', 'uint256', 'address', 'address', 'address', 'uint256', 'bytes16', 'address', 'uint256', 'address', 'address'],
        [
            intent.recipientAmount,
            intent.deadline,
            intent.recipient,
            intent.token,
            intent.refundDestination,
            intent.feeAmount,
            intent.id,
            intent.operator,
            web3.eth.getChainId(), // Use current chain ID
            intent.refundDestination, // msg.sender would be the payer
            intent.token // contract address
        ]
    );

    const messageHash = ethUtil.keccak256(encodedData);
    
    // Create TRON TIP-191 compliant message
    const tronMessage = `\x19Tron Signed Message:\n32${messageHash.toString('hex')}`;
    const tronMessageHash = ethUtil.keccak256(Buffer.from(tronMessage));
    
    // Sign the hash
    const privateKeyBuffer = Buffer.from(privateKey.replace('0x', ''), 'hex');
    const signature = ethUtil.ecsign(tronMessageHash, privateKeyBuffer);
    
    // Convert to Solidity-compatible format
    const r = '0x' + signature.r.toString('hex');
    const s = '0x' + signature.s.toString('hex');
    const v = signature.v; // v is already normalized to 27/28
    
    return { r, s, v };
}

// Function to convert the signature object to compact bytes format
async function createSignedIntent(intentData, privateKey, chainId) {
    const intent = {
        recipientAmount: intentData.recipientAmount,
        deadline: intentData.deadline,
        recipient: intentData.recipient,
        token: intentData.tokenAddress,
        refundDestination: intentData.refundDestination,
        feeAmount: intentData.feeAmount,
        id: intentData.id,
        operator: intentData.operatorAddress
    };

    const sig = await signPaymentIntent(intent, privateKey, chainId);
    
    // Combine r, s, v into a single bytes signature (65 bytes total)
    const r = sig.r.slice(2); // Remove '0x' prefix
    const s = sig.s.slice(2); // Remove '0x' prefix
    const v = sig.v.toString(16).padStart(2, '0'); // Convert v to hex string
    
    // Combine into one signature string
    const signature = '0x' + r + s + v;
    
    return signature;
}

module.exports = {
    signPaymentIntent,
    createSignedIntent
};