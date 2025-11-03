const { expect } = require('chai');
const { expectRevert, getZeroAddress } = require('./helpers');

const PaymentSplitter = artifacts.require('PaymentSplitter');

contract('PaymentSplitter - Operator Registration', function (accounts) {
  const [owner, operator1, operator2, operator3, feeDestination] = accounts;
  let splitter;

  before(async function () {
    splitter = await PaymentSplitter.deployed();
  });

  describe('registerOperatorWithFeeDestination', function () {
    
    it('registers operator with custom fee destination', async function () {
      await splitter.registerOperatorWithFeeDestination(feeDestination, { from: operator1 });

      const stored = await splitter.getFeeDestination(operator1);
      expect(tronWeb.address.fromHex(stored)).to.equal(feeDestination);

      const isRegistered = await splitter.isOperatorRegistered(operator1);
      expect(isRegistered).to.be.true;
    });

    it('registers operator with self as fee destination', async function () {
      await splitter.registerOperatorWithFeeDestination(operator1, { from: operator1 });

      const stored = await splitter.getFeeDestination(operator1);
      expect(tronWeb.address.fromHex(stored)).to.equal(operator1);
    });

    it('reverts when fee destination is zero address', async function () {
      const zeroAddress = getZeroAddress();

      await expectRevert(
        splitter.registerOperatorWithFeeDestination(zeroAddress, { from: operator2 }),
        'Invalid fee destination'
      );
    });

    it('updates fee destination for already registered operator', async function () {
      await splitter.registerOperatorWithFeeDestination(operator1, { from: operator1 });
      let stored = await splitter.getFeeDestination(operator1);
      expect(tronWeb.address.fromHex(stored)).to.equal(operator1);

      await splitter.registerOperatorWithFeeDestination(feeDestination, { from: operator1 });
      stored = await splitter.getFeeDestination(operator1);
      expect(tronWeb.address.fromHex(stored)).to.equal(feeDestination);
    });

    it('allows multiple operators to register independently', async function () {
      await splitter.registerOperatorWithFeeDestination(feeDestination, { from: operator1 });
      await splitter.registerOperatorWithFeeDestination(operator2, { from: operator2 });

      const dest1 = await splitter.getFeeDestination(operator1);
      const dest2 = await splitter.getFeeDestination(operator2);

      expect(tronWeb.address.fromHex(dest1)).to.equal(feeDestination);
      expect(tronWeb.address.fromHex(dest2)).to.equal(operator2);
    });
  });

  describe('unregisterOperator', function () {
    
    it('unregisters a registered operator', async function () {
      await splitter.registerOperatorWithFeeDestination(feeDestination, { from: operator1 });
      
      let isRegistered = await splitter.isOperatorRegistered(operator1);
      expect(isRegistered).to.be.true;

      await splitter.unregisterOperator({ from: operator1 });

      isRegistered = await splitter.isOperatorRegistered(operator1);
      expect(isRegistered).to.be.false;

      const stored = await splitter.getFeeDestination(operator1);
      expect(stored).to.equal(tronWeb.address.toHex('410000000000000000000000000000000000000000'));
    });

    it('reverts when operator is not registered', async function () {
      await expectRevert(
        splitter.unregisterOperator({ from: operator3 }),
        'Operator not registered'
      );
    });

    it('reverts when trying to unregister twice', async function () {
      await splitter.registerOperatorWithFeeDestination(feeDestination, { from: operator1 });
      await splitter.unregisterOperator({ from: operator1 });

      await expectRevert(
        splitter.unregisterOperator({ from: operator1 }),
        'Operator not registered'
      );
    });

    it('allows re-registration after unregistering', async function () {
      await splitter.registerOperatorWithFeeDestination(feeDestination, { from: operator1 });
      await splitter.unregisterOperator({ from: operator1 });
      
      let isRegistered = await splitter.isOperatorRegistered(operator1);
      expect(isRegistered).to.be.false;

      await splitter.registerOperatorWithFeeDestination(operator1, { from: operator1 });
      
      isRegistered = await splitter.isOperatorRegistered(operator1);
      expect(isRegistered).to.be.true;

      const stored = await splitter.getFeeDestination(operator1);
      expect(tronWeb.address.fromHex(stored)).to.equal(operator1);
    });

    it('does not affect other operators when one unregisters', async function () {
      await splitter.registerOperatorWithFeeDestination(feeDestination, { from: operator1 });
      await splitter.registerOperatorWithFeeDestination(operator2, { from: operator2 });

      await splitter.unregisterOperator({ from: operator1 });

      const isOp1Registered = await splitter.isOperatorRegistered(operator1);
      const isOp2Registered = await splitter.isOperatorRegistered(operator2);

      expect(isOp1Registered).to.be.false;
      expect(isOp2Registered).to.be.true;

      const dest2 = await splitter.getFeeDestination(operator2);
      expect(tronWeb.address.fromHex(dest2)).to.equal(operator2);
    });
  });
});