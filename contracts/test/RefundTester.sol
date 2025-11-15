// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title RefundTester
 * @notice Simple contract to test TRX refund mechanism
 */
contract RefundTester {
    event RefundAttempted(address to, uint256 amount, bool success);

    /**
     * @notice Accept payment and refund a portion
     * @param refundAmount Amount to refund back to sender
     */
    function testRefund(uint256 refundAmount) external payable {
        require(msg.value >= refundAmount, "Insufficient value sent");

        // Attempt refund
        (bool success,) = payable(msg.sender).call{value: refundAmount}("");

        emit RefundAttempted(msg.sender, refundAmount, success);
        require(success, "TRX refund failed");
    }

    /**
     * @notice Test refund with explicit gas limit
     */
    function testRefundWithGas(uint256 refundAmount, uint256 gasLimit) external payable {
        require(msg.value >= refundAmount, "Insufficient value sent");

        // Attempt refund with explicit gas
        (bool success,) = payable(msg.sender).call{value: refundAmount, gas: gasLimit}("");

        emit RefundAttempted(msg.sender, refundAmount, success);
        require(success, "TRX refund failed");
    }

    receive() external payable {}
}
