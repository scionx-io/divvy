const { expect } = require('chai');
const {
  expectRevert,
  getZeroAddress,
  getFutureTimestamp,
  generatePaymentId
} = require('./helpers');
const { createIntent, createIntentArray } = require('./fixtures');
const TronTestHelper = require('./TronTestHelper');
const { getSharedToken, setupTokenForPayer } = require('./setup');

const PaymentSplitter = artifacts.require('PaymentSplitter');

contract('PaymentSplitter - Validation', function (accounts) {
  const [owner, operator, recipient, feeDestination, payer, other] = accounts;
  let splitter, token, helper;
  let operatorPrivateKey, chainId;

  before(async function () {
    this.timeout(60000);

    splitter = await PaymentSplitter.deployed();
    helper = new TronTestHelper(splitter);

    // Get shared mock token and setup for payer
    token = await getSharedToken(accounts);
    await setupTokenForPayer(token, payer, splitter.address, tronWeb.toSun(100000), owner);

    // Setup test constants
    chainId = 0x94a9059e;
    
    
    operatorPrivateKey =  process.env.OPERATOR_PRIVATE_KEY;

    // Register operator
    await helper.executeAndWait(
      splitter.registerOperatorWithFeeDestination(feeDestination, { from: operator })
    );
  });

  beforeEach(async function() {
    this.timeout(30000);
    await helper.waitBlock();
  });

  describe('Address Validation', function () {
    const amount = tronWeb.toSun(100);
    const fee = tronWeb.toSun(10);

    it('reverts when operator is zero address', async function () {
      this.timeout(30000);

      const intent = createIntentArray({
        recipient,
        token: token.address,
        amount,
        operator: getZeroAddress(),
        feeAmount: fee,
        id: generatePaymentId(),
        deadline: getFutureTimestamp(),
        refundDestination: payer
      });

      await expectRevert(
        splitter.splitPayment(intent, { from: payer }),
        'Operator cannot be zero address'
      );
    });

    it('reverts when operator is not registered', async function () {
      this.timeout(30000);

      const { intentArray } = await createIntent({
        recipientAmount: amount,
        feeAmount: fee,
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: other,
        payerAddress: payer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'Operator not registered'
      );
    });

    it('reverts when recipient is zero address', async function () {
      this.timeout(30000);

      const { intentArray } = await createIntent({
        recipientAmount: amount,
        feeAmount: fee,
        recipient: getZeroAddress(),
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'Invalid recipient address'
      );
    });

    it('reverts when token is zero address', async function () {
      this.timeout(45000);

      const { intentArray } = await createIntent({
        recipientAmount: amount,
        feeAmount: fee,
        recipient,
        tokenAddress: getZeroAddress(),
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      await helper.retryWithBackoff(async () => {
        await expectRevert(
          splitter.splitPayment(intentArray, { from: payer }),
          'Invalid token address'
        );
      });
    });


  });

  describe('Amount Validation', function () {

    it('reverts when both amounts are zero', async function () {
      this.timeout(45000);

      const { intentArray } = await createIntent({
        recipientAmount: 0,
        feeAmount: 0,
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      await helper.retryWithBackoff(async () => {
        await expectRevert(
          splitter.splitPayment(intentArray, { from: payer }),
          'No amounts to transfer'
        );
      });
    });

    it('reverts when payer has insufficient balance', async function () {
      this.timeout(30000);

      const { intentArray } = await createIntent({
        recipientAmount: tronWeb.toSun(1000000),  // More than payer has
        feeAmount: tronWeb.toSun(10),
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'transfer amount exceeds balance'
      );
    });

    it('reverts when payer has insufficient allowance', async function () {
      this.timeout(30000);

      const newPayer = accounts[6];
      await token.transfer(newPayer, tronWeb.toSun(1000), { from: owner });
      await helper.waitBlock();

      const { intentArray } = await createIntent({
        recipientAmount: tronWeb.toSun(100),
        feeAmount: tronWeb.toSun(10),
        recipient,
        tokenAddress: token.address,
        refundDestination: newPayer,
        operatorAddress: operator,
        payerAddress: newPayer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: newPayer })
      );
    });
  });

  describe('Time Validation', function () {

    it('rejects expired payment intents', async function () {
      this.timeout(30000);

      const { intentArray } = await createIntent({
        recipientAmount: tronWeb.toSun(100),
        feeAmount: tronWeb.toSun(10),
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address,
        deadline: Math.floor(Date.now() / 1000) - 60
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'Payment expired'
      );
    });

    it('accepts payment intent with valid deadline within 30 days', async function () {
      this.timeout(60000);

      const validDeadline = Math.floor(Date.now() / 1000) + (15 * 24 * 60 * 60);

      const { intentArray } = await createIntent({
        recipientAmount: tronWeb.toSun(100),
        feeAmount: tronWeb.toSun(10),
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address,
        deadline: validDeadline
      }, operatorPrivateKey, chainId);

      await helper.executeWithConfirmation(
        splitter.splitPayment(intentArray, { from: payer })
      );
    });
  });

  describe('Edge Cases', function () {

    it('reverts when payment amounts are below minimum', async function () {
      this.timeout(90000);

      // Test with amounts below the minimum threshold (1000 units)
      const { intentArray } = await createIntent({
        recipientAmount: 1,  // Below minimum
        feeAmount: 1,        // Below minimum
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'Recipient amount too small'
      );
    });


  });
});
