const { expect } = require('chai');
const {
  expectRevert,
  getZeroAddress,
  getFutureTimestamp,
  generatePaymentId
} = require('./helpers');
const { createIntent, createIntentArray } = require('./fixtures');

const PaymentSplitter = artifacts.require('PaymentSplitter');
const MockTRC20 = artifacts.require('MockTRC20');

contract('PaymentSplitter - Validation', function (accounts) {
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

  describe('Address Validation', function () {
    const amount = tronWeb.toSun(100);
    const fee = tronWeb.toSun(10);

    it('reverts when operator is zero address', async function () {
      const intent = createIntentArray({
        recipient,
        token: token.address,
        recipientAmount: amount,
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

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'Invalid token address'
      );
    });

    it('reverts when token is not a contract', async function () {
      const { intentArray } = await createIntent({
        recipientAmount: amount,
        feeAmount: fee,
        recipient,
        tokenAddress: other,  // EOA, not a contract
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'Token not a contract'
      );
    });
  });

  describe('Amount Validation', function () {

    it('reverts when both amounts are zero', async function () {
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

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'No amounts to transfer'
      );
    });

    it('reverts when payer has insufficient balance', async function () {
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
      // Create new payer with tokens but no allowance
      const newPayer = accounts[6];
      await token.transfer(newPayer, tronWeb.toSun(1000), { from: owner });

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
      const { intentArray } = await createIntent({
        recipientAmount: tronWeb.toSun(100),
        feeAmount: tronWeb.toSun(10),
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address,
        deadline: Math.floor(Date.now() / 1000) - 60  // 1 minute ago
      }, operatorPrivateKey, chainId);

      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer }),
        'Payment expired'
      );
    });

    it('accepts payment intent with valid deadline within 30 days', async function () {
      const validDeadline = Math.floor(Date.now() / 1000) + (15 * 24 * 60 * 60);  // 15 days from now
      
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

      // This should succeed
      await splitter.splitPayment(intentArray, { from: payer });
    });
  });

  describe('Edge Cases', function () {

    it('handles maximum uint256 amounts correctly', async function () {
      const maxUint256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const { intentArray } = await createIntent({
        recipientAmount: maxUint256,
        feeAmount: 0,
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      // Should revert due to insufficient balance, not encoding issues
      await expectRevert(
        splitter.splitPayment(intentArray, { from: payer })
      );
    });

    it('processes payment with very small amounts (1 unit)', async function () {
      const { intentArray, id } = await createIntent({
        recipientAmount: 1,
        feeAmount: 1,
        recipient,
        tokenAddress: token.address,
        refundDestination: payer,
        operatorAddress: operator,
        payerAddress: payer,
        splitterAddress: splitter.address
      }, operatorPrivateKey, chainId);

      await splitter.splitPayment(intentArray, { from: payer });

      const isProcessed = await splitter.isPaymentProcessed(operator, id);
      expect(isProcessed).to.be.true;
    });
  });
});
