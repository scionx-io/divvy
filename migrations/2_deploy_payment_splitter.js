const PaymentSplitter = artifacts.require("PaymentSplitter");

module.exports = function(deployer) {
  deployer.deploy(PaymentSplitter);
};