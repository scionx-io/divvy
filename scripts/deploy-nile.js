// Deployment script for Nile testnet
// Run with: tronbox migrate --network nile

// SunSwap V3 Router address on Nile testnet
const SUNSWAP_ROUTER_NILE = "TFkswj6rUfK3cQtFGzungCkNXxD2UCpEVD"; // Actual Nile testnet router address
// USDT address on Nile testnet  
const USDT_NILE = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"; // Actual Nile testnet USDT address

async function deployToNile() {
    try {
        console.log("Deploying MinimalTRXToUSDTSwap to Nile testnet...");
        
        // Get the contract
        const MinimalTRXToUSDTSwap = artifacts.require("MinimalTRXToUSDTSwap");
        
        // Deploy the contract
        const swapContract = await MinimalTRXToUSDTSwap.new(SUNSWAP_ROUTER_NILE, USDT_NILE, {
            from: accounts[0],
            gas: 5000000
        });
        
        console.log("Contract deployed at address:", swapContract.address);
        
        return swapContract.address;
    } catch (error) {
        console.error("Deployment failed:", error);
        throw error;
    }
}

// For direct execution
// deployToNile();

module.exports = function(deployer) {
    deployer.then(async () => {
        await deployToNile();
    });
};