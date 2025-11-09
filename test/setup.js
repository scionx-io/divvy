/**
 * Shared test setup and fixtures
 * This file deploys shared contracts once and makes them available to all test suites
 */

const MockTRC20 = artifacts.require('MockTRC20');

// Global shared state
let sharedToken = null;
let deploymentInProgress = false;
let deploymentPromise = null;

/**
 * Get or create shared MockTRC20 token
 * This ensures we only deploy the token once across all test suites
 */
async function getSharedToken(accounts) {
  // If token already deployed, return it
  if (sharedToken) {
    return sharedToken;
  }

  // If deployment is in progress, wait for it
  if (deploymentInProgress && deploymentPromise) {
    return await deploymentPromise;
  }

  // Start deployment
  deploymentInProgress = true;
  deploymentPromise = (async () => {
    try {
      const owner = accounts[0];

      // Deploy with a large initial supply to avoid running out
      console.log('  📝 Deploying shared MockTRC20...');
      const token = await MockTRC20.new('Test Token', 'TEST', tronWeb.toSun(10000000), { from: owner });

      // Wait a bit for the transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 3000));

      sharedToken = token;
      console.log('  ✅ Shared MockTRC20 deployed at:', token.address);

      return token;
    } catch (error) {
      console.error('  ❌ Failed to deploy shared MockTRC20:', error.message);
      deploymentInProgress = false;
      deploymentPromise = null;
      throw error;
    } finally {
      deploymentInProgress = false;
    }
  })();

  return await deploymentPromise;
}

/**
 * Setup token for a specific payer account
 * Transfers tokens and sets up approval for the splitter
 */
async function setupTokenForPayer(token, payer, splitterAddress, amount, fromAccount) {
  // Transfer tokens to payer
  await token.transfer(payer, amount, { from: fromAccount });

  // Approve splitter to spend payer's tokens
  await token.approve(splitterAddress, amount, { from: payer });
}

/**
 * Reset token allowances and balances for clean test state
 */
async function resetTokenState(token, accounts) {
  // This is a helper for future use if needed
  // Currently, each test should manage its own state
}

module.exports = {
  getSharedToken,
  setupTokenForPayer,
  resetTokenState
};
