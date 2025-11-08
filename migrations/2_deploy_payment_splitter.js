const PaymentSplitter = artifacts.require("PaymentSplitter");
const MockSwapRouter = artifacts.require("MockSwapRouter");
const MockWTRX = artifacts.require("MockWTRX");

module.exports = async function(deployer) {
  // Deploy mock contracts first for testing
  await deployer.deploy(MockWTRX);
  const wtrx = await MockWTRX.deployed();

  await deployer.deploy(MockSwapRouter);
  const swapRouter = await MockSwapRouter.deployed();

  // Deploy PaymentSplitter with mock contract addresses
  await deployer.deploy(PaymentSplitter, swapRouter.address, wtrx.address);
};