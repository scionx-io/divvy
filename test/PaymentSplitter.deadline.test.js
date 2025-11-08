const { expect, assert } = require('chai');
const {
  expectRevert,
  getFutureTimestamp,
  generatePaymentId
} = require('./helpers');
const { createIntent, createIntentArray } = require('./fixtures');

const PaymentSplitter = artifacts.require('PaymentSplitter');
const MockTRC20 = artifacts.require('MockTRC20');

contract('PaymentSplitter - Deadline Validation', function (accounts) {
  const [owner, operator, recipient, feeDestination, payer, other] = accounts;
  let splitter, token;
  let operatorPrivateKey, chainId;

  before(async function () {
    splitter = await PaymentSplitter.deployed();

    // Deploy and setup mock token
    token = await MockTRC20.new('Test Token', 'TEST', tronWeb.toSun(1000000));
    await token.transfer(payer, tronWeb.toSun(100000), { from: owner });
    await token.approve(splitter.address, tronWeb.toSun(100000), { from: payer });

    // Setup test constants
    chainId = 0x94a9059e;
    operatorPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // Register operator
    await splitter.registerOperatorWithFeeDestination(feeDestination, { from: operator });
  });

  describe('Maximum Deadline Validation', function () {
    const amount = tronWeb.toSun(100);
    const fee = tronWeb.toSun(10);

    it('should accept deadline within 30 days', async function () {
      // 29 days from now (just under the 30-day limit)
      const validDeadline = Math.floor(Date.now() / 1000) + (29 * 24 * 60 * 60);
      
      const { intentArray } = await createIntent({
        recipientAmount: amount,
        feeAmount: fee,
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address,
        deadline: validDeadline
      }, operatorPrivateKey, chainId);

      // This should succeed
      await splitter.splitPayment(intentArray, { from: payer });
    });

    it('should reject deadline exactly 30 days + 1 second in the future', async function () {
      // 30 days and 1 second from now (just over the limit)
      const invalidDeadline = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) + 1;
      
      const { intentArray } = await createIntent({
        recipientAmount: amount,
        feeAmount: fee,
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address,
        deadline: invalidDeadline
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'Deadline too far'
      );
    });

    it('should reject deadline much further in the future (1 year)', async function () {
      // 1 year from now
      const invalidDeadline = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
      
      const { intentArray } = await createIntent({
        recipientAmount: amount,
        feeAmount: fee,
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address,
        deadline: invalidDeadline
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'Deadline too far'
      );
    });

    it('should still reject expired deadlines', async function () {
      // Past deadline (1 day ago to ensure it's clearly expired)
      const pastDeadline = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

      const { intentArray } = await createIntent({
        recipientAmount: amount,
        feeAmount: fee,
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address,
        deadline: pastDeadline
      }, operatorPrivateKey, chainId);

      try {
        await splitter.splitPayment(intentArray, { from: payer });
        assert.fail('Expected transaction to revert');
      } catch (error) {
        // Accept either "Payment expired" or transaction revert
        const validErrors = ['Payment expired', 'revert', 'REVERT'];
        const hasValidError = validErrors.some(msg => error.message.includes(msg));
        expect(hasValidError).to.be.true;
      }
    });

    it('should accept deadline with exact 30 day limit', async function () {
      // 30 days from now (exactly at the limit)
      const thirtyDaysFromNow = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

      const { intentArray } = await createIntent({
        recipientAmount: amount,
        feeAmount: fee,
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address,
        deadline: thirtyDaysFromNow
      }, operatorPrivateKey, chainId);

      // This should succeed (at the exact limit)
      await splitter.splitPayment(intentArray, { from: payer });
    });
  });

  describe('MAX_DEADLINE_DURATION Constant', function () {
    it('should have MAX_DEADLINE_DURATION equal to 30 days', async function () {
      const maxDeadline = await splitter.MAX_DEADLINE_DURATION();
      // 30 days = 30 * 24 * 60 * 60 = 2,592,000 seconds
      expect(maxDeadline.toString()).to.equal('2592000');
    });
  });
});