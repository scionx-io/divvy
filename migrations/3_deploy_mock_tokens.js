const MockTRC20 = artifacts.require("MockTRC20");

module.exports = function(deployer) {
  deployer.deploy(MockTRC20, "Mock Token", "MOCK", "1000000000000000000000"); // 1000 tokens with 18 decimals
};