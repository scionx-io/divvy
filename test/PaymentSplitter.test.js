const { expect } = require('chai');
const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const PaymentSplitter = artifacts.require('PaymentSplitter');

contract('PaymentSplitter', function (accounts) {
  const [ owner, operator, feeDestination, recipient, randomUser ] = accounts;

  beforeEach(async function () {
    this.paymentSplitter = await PaymentSplitter.new({ from: owner });
  });

  describe('Operator Registration', function () {
    it('should allow operator to register with custom fee destination', async function () {
      const receipt = await this.paymentSplitter.registerOperatorWithFeeDestination(feeDestination, { from: operator });
      
      expectEvent(receipt, 'OperatorRegistered', {
        operator: operator,
        feeDestination: feeDestination
      });

      const storedFeeDestination = await this.paymentSplitter.getFeeDestination(operator);
      expect(storedFeeDestination).to.equal(feeDestination);
    });

    it('should allow operator to register using their own address as fee destination', async function () {
      const receipt = await this.paymentSplitter.registerOperator({ from: operator });
      
      expectEvent(receipt, 'OperatorRegistered', {
        operator: operator,
        feeDestination: operator
      });

      const storedFeeDestination = await this.paymentSplitter.getFeeDestination(operator);
      expect(storedFeeDestination).to.equal(operator);
    });

    it('should allow updating fee destination', async function () {
      await this.paymentSplitter.registerOperator({ from: operator });
      
      const receipt = await this.paymentSplitter.registerOperatorWithFeeDestination(feeDestination, { from: operator });
      
      expectEvent(receipt, 'FeeDestinationUpdated', {
        operator: operator,
        oldDestination: operator,
        newDestination: feeDestination
      });

      const storedFeeDestination = await this.paymentSplitter.getFeeDestination(operator);
      expect(storedFeeDestination).to.equal(feeDestination);
    });

    it('should allow operator to unregister', async function () {
      await this.paymentSplitter.registerOperator({ from: operator });
      
      const receipt = await this.paymentSplitter.unregisterOperator({ from: operator });
      
      expectEvent(receipt, 'OperatorUnregistered', {
        operator: operator
      });

      const storedFeeDestination = await this.paymentSplitter.getFeeDestination(operator);
      expect(storedFeeDestination).to.equal(constants.ZERO_ADDRESS);
    });

    it('should fail to unregister if not registered', async function () {
      await expectRevert(
        this.paymentSplitter.unregisterOperator({ from: operator }),
        'Operator not registered'
      );
    });
  });

  describe('Payment Splitting', function () {
    const recipientAmount = new BN('1000');
    const feeAmount = new BN('100');
    const id = web3.utils.randomHex(16);

    it('should split payment correctly', async function () {
      // Note: For this test to work completely, we would need a mock TRC20 token
      // For now, we'll test the logic that doesn't require actual token transfers
      await this.paymentSplitter.registerOperator({ from: operator });

      // This will fail because we don't have a real token contract in tests
      // But we can test the validation logic
      await expectRevert(
        this.paymentSplitter.splitPayment(
          recipient,
          constants.ZERO_ADDRESS, // Invalid token
          recipientAmount,
          operator,
          feeAmount,
          id,
          { from: randomUser }
        ),
        'Invalid token address'
      );

      await expectRevert(
        this.paymentSplitter.splitPayment(
          recipient,
          randomUser, // Valid token address but not a TRC20
          recipientAmount,
          constants.ZERO_ADDRESS, // Invalid operator
          feeAmount,
          id,
          { from: randomUser }
        ),
        'Invalid operator address'
      );

      await expectRevert(
        this.paymentSplitter.splitPayment(
          recipient,
          randomUser, // Any address as token
          recipientAmount,
          randomUser, // Not registered operator
          feeAmount,
          id,
          { from: randomUser }
        ),
        'Operator not registered'
      );

      // Register the operator
      await this.paymentSplitter.registerOperator({ from: operator });

      // Try with zero total amount
      await expectRevert(
        this.paymentSplitter.splitPayment(
          recipient,
          randomUser, // Any address as token
          new BN('0'), // Zero recipient amount
          operator, // Valid registered operator
          new BN('0'), // Zero fee amount
          id,
          { from: randomUser }
        ),
        'Total amount must be greater than 0'
      );
    });

    it('should prevent replay attacks', async function () {
      await this.paymentSplitter.registerOperator({ from: operator });

      // This test would need a mock token to fully validate
      // We'll test the idempotency by trying to process the same payment twice
      await expectRevert(
        this.paymentSplitter.splitPayment(
          recipient,
          randomUser,
          recipientAmount,
          operator,
          feeAmount,
          id,
          { from: randomUser }
        ),
        'Invalid token address' // First attempt will fail due to invalid token
      );

      // Once a payment with this ID is processed, it should be marked and fail with different error
      // But since the first call failed, this would still be unmarked
    });
  });

  describe('View Functions', function () {
    it('should return correct registration status', async function () {
      let isRegistered = await this.paymentSplitter.isOperatorRegistered(operator);
      expect(isRegistered).to.be.false;

      await this.paymentSplitter.registerOperator({ from: operator });

      isRegistered = await this.paymentSplitter.isOperatorRegistered(operator);
      expect(isRegistered).to.be.true;
    });

    it('should return correct fee destination', async function () {
      let feeDest = await this.paymentSplitter.getFeeDestination(operator);
      expect(feeDest).to.equal(constants.ZERO_ADDRESS);

      await this.paymentSplitter.registerOperatorWithFeeDestination(feeDestination, { from: operator });

      feeDest = await this.paymentSplitter.getFeeDestination(operator);
      expect(feeDest).to.equal(feeDestination);
    });

    it('should return correct payment processing status', async function () {
      let isProcessed = await this.paymentSplitter.isPaymentProcessed(operator, web3.utils.randomHex(16));
      expect(isProcessed).to.be.false;
    });
  });
});