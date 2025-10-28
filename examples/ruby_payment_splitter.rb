#!/usr/bin/env ruby
# frozen_string_literal: true

# Example: Using PaymentSplitter contract with tron.rb gem
#
# This example demonstrates how to interact with the PaymentSplitter contract
# using the tron.rb gem with full contract interaction support.
#
# IMPORTANT: This script must be run with bundle exec to avoid gem conflicts:
#   bundle exec ruby ruby_payment_splitter.rb
#
# Running without bundle exec may cause "Base58 is not a module" errors due to
# conflicts between base58 and base58-alphabets gems in the system environment.

require 'tron'
require 'tron/key'
require 'securerandom'
require 'dotenv/load'


class PaymentSplitterExample
  # PaymentSplitter contract address from environment
  PAYMENT_SPLITTER_ADDRESS = ENV['PAYMENT_SPLITTER_SHASTA_ADDRESS']

  # Test USDT contract address on Shasta testnet
  # Note: For Shasta, you'll need to use a testnet USDT or TRX
  USDT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

  def initialize
    # Initialize tron.rb client for Shasta testnet
    @client = Tron::Client.new(
      api_key: ENV['TRONGRID_API_KEY'],
      network: :shasta,  # Using Shasta testnet
      timeout: 30
    )

    puts "Initialized client for Shasta testnet"
    puts "Contract Address: #{PAYMENT_SPLITTER_ADDRESS}"
  end

  # Example 1: Register an operator with custom fee destination
  def register_operator_with_fee_destination(operator_private_key, fee_destination_address)
    puts "=" * 60
    puts "Example 1: Register Operator with Custom Fee Destination"
    puts "=" * 60

    begin
      contract_service = @client.contract_service
      tx = contract_service.trigger_contract(
        contract_address: PAYMENT_SPLITTER_ADDRESS,
        function: 'registerOperatorWithFeeDestination(address)',
        parameters: [fee_destination_address],
        private_key: operator_private_key
      )

      puts "✅ Operator registered with fee destination: #{fee_destination_address}"
      puts "Contract: #{PAYMENT_SPLITTER_ADDRESS}"
      puts "Function: registerOperatorWithFeeDestination(address)"
      puts "Transaction ID: #{tx['txid'] || tx['txID']}"
    rescue => e
      puts "❌ Error: #{e.message}"
      puts "Error class: #{e.class}"
      puts "Backtrace: #{e.backtrace.first(3).join("\n")}" if ENV['DEBUG']
    end
  end

  # Example 2: Register an operator using their own address
  def register_operator(operator_private_key)
    puts "\n" + "=" * 60
    puts "Example 2: Register Operator with Own Address"
    puts "=" * 60

    begin
      contract_service = @client.contract_service
      tx = contract_service.trigger_contract(
        contract_address: PAYMENT_SPLITTER_ADDRESS,
        function: 'registerOperator()',
        parameters: [],
        private_key: operator_private_key
      )

      puts "✅ Operator registered using their own address"
      puts "Contract: #{PAYMENT_SPLITTER_ADDRESS}"
      puts "Function: registerOperator()"
      puts "Transaction ID: #{tx['txid'] || tx['txID']}"
    rescue => e
      puts "❌ Error: #{e.message}"
      puts "Error class: #{e.class}"
      puts "Backtrace: #{e.backtrace.first(3).join("\n")}" if ENV['DEBUG']
    end
  end

  # Example 3: Check if an operator is registered
  def check_operator_registration(operator_address)
    puts "\n" + "=" * 60
    puts "Example 3: Check Operator Registration Status"
    puts "=" * 60

    begin
      contract_service = @client.contract_service
      is_registered = contract_service.operator_registered?(
        PAYMENT_SPLITTER_ADDRESS,
        operator_address
      )

      puts "Operator: #{operator_address}"
      puts "Contract: #{PAYMENT_SPLITTER_ADDRESS}"
      puts "Function: isOperatorRegistered(address)"
      puts "Result: #{is_registered ? '✅ Registered' : '❌ Not Registered'}"
    rescue => e
      puts "❌ Error: #{e.message}"
    end
  end

  # Example 4: Get operator's fee destination
  def get_fee_destination(operator_address)
    puts "\n" + "=" * 60
    puts "Example 4: Get Operator Fee Destination"
    puts "=" * 60

    begin
      contract_service = @client.contract_service
      fee_destination = contract_service.get_fee_destination(
        PAYMENT_SPLITTER_ADDRESS,
        operator_address
      )

      puts "Operator: #{operator_address}"
      puts "Contract: #{PAYMENT_SPLITTER_ADDRESS}"
      puts "Function: getFeeDestination(address)"
      puts "Fee Destination: #{fee_destination}"
    rescue => e
      puts "❌ Error: #{e.message}"
    end
  end

  # Example 5: Split payment between recipient and operator
  def split_payment(
    sender_private_key:,
    recipient_address:,
    token_address: USDT_ADDRESS,
    recipient_amount:,
    operator_address:,
    fee_amount:
  )
    puts "\n" + "=" * 60
    puts "Example 5: Split Payment"
    puts "=" * 60

    # Generate unique payment ID
    payment_id = SecureRandom.hex(8) # 16-byte hex string

    begin
      contract_service = @client.contract_service
      
      # For TRX (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t is actually TRX on Shasta, not USDT),
      # we should not need approval, but for USDT we would.
      # First, try to approve if it's not TRX
      if token_address != 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'  # If not TRX
        # First, approve the PaymentSplitter to spend tokens
        total_amount = recipient_amount + fee_amount

        puts "Step 1: Approve token spending"
        puts "Token: #{token_address}"
        puts "Spender: #{PAYMENT_SPLITTER_ADDRESS}"
        puts "Amount: #{total_amount}"

        approve_tx = contract_service.trigger_contract(
          contract_address: token_address,
          function: 'approve(address,uint256)',
          parameters: [PAYMENT_SPLITTER_ADDRESS, total_amount],
          private_key: sender_private_key
        )

        # Check if approve_tx is nil before accessing its properties
        if approve_tx.nil?
          puts "❌ Approval transaction failed - received nil response"
          return
        end

        puts "✅ Approval successful"
        puts "Transaction ID: #{approve_tx['txid'] || approve_tx['txID']}"
      else
        puts "ℹ️  Skipping approval step for TRX (not needed)"
      end

      # Then, call splitPayment
      puts "\nStep 2: Split payment"
      puts "Recipient: #{recipient_address}"
      puts "Recipient Amount: #{recipient_amount}"
      puts "Operator: #{operator_address}"
      puts "Fee Amount: #{fee_amount}"
      puts "Payment ID: #{payment_id}"

      split_tx = contract_service.trigger_contract(
        contract_address: PAYMENT_SPLITTER_ADDRESS,
        function: 'splitPayment(address,address,uint256,address,uint256,bytes16)',
        parameters: [
          recipient_address,
          token_address,
          recipient_amount,
          operator_address,
          fee_amount,
          payment_id
        ],
        private_key: sender_private_key
      )

      # Check if split_tx is nil before accessing its properties
      if split_tx.nil?
        puts "❌ Split payment transaction failed - received nil response"
        return
      end

      puts "✅ Payment split successful"
      puts "Transaction ID: #{split_tx['txid'] || split_tx['txID']}"
    rescue => e
      puts "❌ Error: #{e.message}"
      puts "Backtrace: #{e.backtrace.first(5).join("\n")}" if ENV['DEBUG']
    end
  end

  # Example 6: Check if payment was processed
  def check_payment_processed(operator_address, payment_id)
    puts "\n" + "=" * 60
    puts "Example 6: Check Payment Processing Status"
    puts "=" * 60

    begin
      contract_service = @client.contract_service
      is_processed = contract_service.payment_processed?(
        PAYMENT_SPLITTER_ADDRESS,
        operator_address,
        payment_id
      )

      puts "Operator: #{operator_address}"
      puts "Payment ID: #{payment_id}"
      puts "Contract: #{PAYMENT_SPLITTER_ADDRESS}"
      puts "Function: isPaymentProcessed(address,bytes16)"
      puts "Result: #{is_processed ? '✅ Processed' : '❌ Not Processed'}"
    rescue => e
      puts "❌ Error: #{e.message}"
    end
  end

  # Example 7: Unregister an operator
  def unregister_operator(operator_private_key)
    puts "\n" + "=" * 60
    puts "Example 7: Unregister Operator"
    puts "=" * 60

    begin
      contract_service = @client.contract_service
      tx = contract_service.trigger_contract(
        contract_address: PAYMENT_SPLITTER_ADDRESS,
        function: 'unregisterOperator()',
        parameters: [],
        private_key: operator_private_key
      )

      puts "✅ Operator unregistered successfully"
      puts "Contract: #{PAYMENT_SPLITTER_ADDRESS}"
      puts "Function: unregisterOperator()"
      puts "Transaction ID: #{tx['txid'] || tx['txID']}"
    rescue => e
      puts "❌ Error: #{e.message}"
      puts "Error class: #{e.class}"
      puts "Backtrace: #{e.backtrace.first(3).join("\n")}" if ENV['DEBUG']
    end
  end

  # Example 8: Use existing tron.rb functionality - Check wallet balances
  def check_wallet_balance(address)
    puts "\n" + "=" * 60
    puts "Example 8: Check Wallet Balance (Working with current tron.rb)"
    puts "=" * 60

    begin
      portfolio = @client.get_wallet_portfolio(address, include_zero_balances: false)

      puts "Wallet: #{address}"
      puts "\nTotal Portfolio Value: $#{format('%.2f', portfolio[:total_value_usd])}"
      puts "\nTokens:"

      portfolio[:tokens].each do |token|
        value = token[:usd_value] ? format('%.2f', token[:usd_value]) : 'N/A'
        puts "  #{token[:symbol]}: #{token[:token_balance]} ($#{value})"
      end
    rescue => e
      puts "Error getting wallet balance: #{e.message}"
    end
  end
end

# Demo execution
if __FILE__ == $0
  puts "PaymentSplitter Contract Example with tron.rb v1.1.3"
  puts "Network: Shasta Testnet"
  puts "=" * 60

  example = PaymentSplitterExample.new

  # Get private keys from environment
  operator_private_key = ENV['OPERATOR_PRIVATE_KEY']
  sender_private_key = ENV['SENDER_PRIVATE_KEY']

  unless operator_private_key && sender_private_key
    puts "\n❌ Error: Private keys not found in .env file"
    puts "Please set OPERATOR_PRIVATE_KEY and SENDER_PRIVATE_KEY in your .env file"
    exit 1
  end

  # Derive addresses from private keys
  begin
    operator_key = Tron::Key.new(priv: operator_private_key)
    operator_address = operator_key.address

    sender_key = Tron::Key.new(priv: sender_private_key)
    sender_address = sender_key.address

    puts "\nOperator Address: #{operator_address}"
    puts "Sender Address: #{sender_address}"

    # For testing, use sender as recipient and operator addresses
    recipient_address = sender_address
    fee_destination = operator_address
  rescue => e
    puts "\n❌ Error deriving addresses: #{e.message}"
    exit 1
  end

  puts "\n" + "=" * 60
  puts "Running Contract Interaction Examples"
  puts "=" * 60

  # Run all examples with the deployed Shasta contract
  example.register_operator_with_fee_destination(operator_private_key, fee_destination)
  example.register_operator(operator_private_key)
  example.check_operator_registration(operator_address)
  example.get_fee_destination(operator_address)

  # Example split payment: 100 USDT to recipient, 5 USDT fee
  # (amounts in smallest unit - USDT has 6 decimals)
  example.split_payment(
    sender_private_key: sender_private_key,
    recipient_address: recipient_address,
    recipient_amount: 100_000_000, # 100 USDT
    operator_address: operator_address,
    fee_amount: 5_000_000 # 5 USDT
  )

  example.check_payment_processed(operator_address, '1234567890abcdef')
  example.unregister_operator(operator_private_key)

  # Check wallet balance
  puts "\n"
  example.check_wallet_balance(sender_address)

  puts "\n" + "=" * 60
  puts "Summary: Contract Interaction Methods in tron.rb v1.1.3"
  puts "=" * 60
  puts "
✅ PaymentSplitter contract interaction fully supported!

Available methods:

1. contract_service.trigger_contract() - For state-changing operations
   ✅ Parameters: contract_address, function, parameters, private_key
   ✅ Use cases: registerOperator, splitPayment, unregisterOperator

2. contract_service.call_contract() - For read-only operations
   ✅ Parameters: contract_address, function, parameters
   ✅ Use cases: isOperatorRegistered, getFeeDestination, isPaymentProcessed

3. Helper methods:
   ✅ operator_registered?(contract_address, operator_address)
   ✅ get_fee_destination(contract_address, operator_address)
   ✅ payment_processed?(contract_address, operator_address, payment_id)

4. ABI support:
   ✅ Full ABI encoding/decoding with Tron::Abi module
   ✅ Support for dynamic types, arrays, tuples, events
   ✅ Binary refactor for performance

5. Security features:
   ✅ Local transaction signing with secp256k1
   ✅ Private keys never sent to API
   ✅ SHA256 transaction hashing

Documentation:
- TronGrid API: https://developers.tron.network/reference/triggerconstantcontract
- TronWeb Contract: https://developers.tron.network/docs/tronweb-contract
"
end
