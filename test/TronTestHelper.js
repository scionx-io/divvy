/**
 * TronTestHelper - Utilities for reliable blockchain testing
 */
class TronTestHelper {
  constructor(contract, blockTime = 3000) {
    this.contract = contract;
    this.blockTime = blockTime;
    this.maxRetries = 15;
  }

  async executeAndWait(txPromise) {
    const tx = await txPromise;
    if (typeof tx === 'string') {
      return await this.waitForTransaction(tx);
    }
    return tx;
  }

  async waitForTransaction(txHash, maxAttempts = this.maxRetries) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const txInfo = await tronWeb.trx.getTransaction(txHash);
        if (txInfo && txInfo.ret && txInfo.ret[0]) {
          await this.waitBlock();
          return txInfo;
        }
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Transaction ${txHash} not confirmed after ${maxAttempts} attempts`);
  }

  async waitForEvent(eventName, filter = {}, timeout = 30000) {
    const startTime = Date.now();
    const startBlock = await tronWeb.trx.getCurrentBlock();
    const fromBlock = startBlock.block_header.raw_data.number;
    
    while (Date.now() - startTime < timeout) {
      try {
        const events = await this.contract.getPastEvents(eventName, {
          fromBlock: fromBlock,
          toBlock: 'latest'
        });
        
        const matching = events.filter(e => 
          Object.entries(filter).every(([key, val]) => {
            const eventVal = e.result[key] || e.returnValues[key];
            return eventVal === val || eventVal?.toString() === val?.toString();
          })
        );
        
        if (matching.length > 0) return matching[0];
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, this.blockTime));
    }
    throw new Error(`Event ${eventName} not found within ${timeout}ms`);
  }

  async verifyState(stateCheckFn, expectedValue, maxAttempts = 10) {
    await this.waitBlock();
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const actualValue = await stateCheckFn();
        if (this.valuesMatch(actualValue, expectedValue)) {
          return actualValue;
        }
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, this.blockTime * 1.5));
    }
    throw new Error(`State verification failed after ${maxAttempts} attempts`);
  }

  valuesMatch(actual, expected) {
    if (actual === expected) return true;
    if (actual?.toString() === expected?.toString()) return true;
    if (Boolean(actual) === Boolean(expected) && typeof expected === 'boolean') return true;
    return false;
  }

  async waitBlock(count = 1) {
    await new Promise(resolve => setTimeout(resolve, this.blockTime * count));
  }

  async mineBlock() {
    try {
      await tronWeb.trx.sendTransaction(tronWeb.defaultAddress.base58, 1);
    } catch (e) {}
    await this.waitBlock();
  }

  async retryWithBackoff(fn, maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn();
      } catch (e) {
        if (i === maxAttempts - 1) throw e;
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async executeWithConfirmation(txPromise, stateCheckFn = null, expectedState = null) {
    const tx = await this.executeAndWait(txPromise);
    await this.waitBlock();
    if (stateCheckFn && expectedState !== null) {
      await this.verifyState(stateCheckFn, expectedState);
    }
    return tx;
  }
}

module.exports = TronTestHelper;