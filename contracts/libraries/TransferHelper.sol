// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

// Helper methods for interacting with TRC20 tokens that do not consistently return true/false
// Based on Uniswap V2 TransferHelper, adapted for TRON USDT compatibility
library TransferHelper {
    // USDT addresses on different networks
    // Nile testnet: 0xECa9bC828A3005B9a3b909f2cc5c2a54794DE05F (TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf)
    // Mainnet: 0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C

    // Using Nile testnet USDT address for development/testing
    address constant USDT_ADDR = 0xECa9bC828A3005B9a3b909f2cc5c2a54794DE05F;

    function safeApprove(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));

        // Special handling for USDT - only check success
        if (token == USDT_ADDR) {
            require(success, 'TransferHelper: APPROVE_FAILED');
            return;
        }

        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: APPROVE_FAILED');
    }

    function safeTransfer(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));

        // Special handling for USDT - only check success
        if (token == USDT_ADDR) {
            require(success, 'TransferHelper: TRANSFER_FAILED');
            return;
        }

        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
    }

    function safeTransferFrom(address token, address from, address to, uint value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));

        // Special handling for USDT - only check success
        if (token == USDT_ADDR) {
            require(success, 'TransferHelper: TRANSFER_FROM_FAILED');
            return;
        }

        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
    }

    function safeTransferETH(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: ETH_TRANSFER_FAILED');
    }
}
