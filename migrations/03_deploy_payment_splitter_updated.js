const PaymentSplitter = artifacts.require("PaymentSplitter");

// SmartExchangeRouter address on Nile testnet (FIXED version with TRX refund support)
const SMART_EXCHANGE_ROUTER_NILE = "TP8GMDwJZfU6AqGf8UKZrbPo1mTdomsnVD"; // Fixed SmartExchangeRouter with proper exactOutput refund logic

module.exports = async function(deployer, network) {
  if (network === "nile" || network === "shasta" || network === "mainnet") {
    // For testnet and mainnet, use our SmartExchangeRouter
    // The updated contract gets WTRX from the router automatically
    await deployer.deploy(PaymentSplitter, SMART_EXCHANGE_ROUTER_NILE);
  } else {
    // For local development, we'll need to update this too
    // We can create a mock SmartExchangeRouter that mimics the real one
    const MockSmartExchangeRouter = artifacts.require("MockSmartExchangeRouter");

    // Deploy mock SmartExchangeRouter
    await deployer.deploy(MockSmartExchangeRouter);
    const mockRouter = await MockSmartExchangeRouter.deployed();

    // Deploy PaymentSplitter with SmartExchangeRouter (which provides WTRX)
    await deployer.deploy(PaymentSplitter, mockRouter.address);
  }
};