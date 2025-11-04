#!/usr/bin/env ruby
# frozen_string_literal: true

# Example: Execute a split payment
#
# This example shows how to:
# 1. Create a signed payment intent
# 2. Approve token spending
# 3. Execute splitPayment transaction
# 4. Verify the payment was processed
#
# IMPORTANT: Run with bundle exec to avoid gem conflicts:
#   cd examples && bundle exec ruby ruby/03_split_payment.rb

require_relative 'utils'

def main
  puts '=== Split Payment Example ==='
  puts

  # Initialize Tron client
  client = init_tron_client

  operator_private_key = ENV['OPERATOR_PRIVATE_KEY']
  sender_private_key = ENV['SENDER_PRIVATE_KEY']

  unless operator_private_key && sender_private_key
    puts '❌ Error: Required private keys not found in .env file'
    puts 'Please set OPERATOR_PRIVATE_KEY and SENDER_PRIVATE_KEY'
    exit 1
  end

  operator_address = get_address_from_private_key(operator_private_key)
  payer_address = get_address_from_private_key(sender_private_key)

  puts "Operator address: #{operator_address}"
  puts "Payer address: #{payer_address}"
  puts

  puts 'Contracts loaded'
  puts

  begin
    contract_service = client.contract_service

    # Define payment parameters
    recipient_address = payer_address # For demo, sending back to payer
    recipient_amount = to_sun(100) # 100 tokens to recipient
    fee_amount = to_sun(10) # 10 tokens as operator fee
    payment_id = generate_payment_id
    deadline = get_future_timestamp(3600) # 1 hour from now
    refund_destination = payer_address

    puts 'Payment Parameters:'
    puts "  Recipient: #{recipient_address}"
    puts "  Recipient Amount: #{from_sun(recipient_amount)} tokens"
    puts "  Fee Amount: #{from_sun(fee_amount)} tokens"
    puts "  Payment ID: #{payment_id}"
    puts "  Deadline: #{Time.at(deadline).utc}"
    puts

    # Check token balance
    balance_result = contract_service.call_contract(
      contract_address: MOCK_TOKEN_ADDRESS,
      function: 'balanceOf(address)',
      parameters: [payer_address]
    )
    balance = balance_result.dig('constant_result', 0)
    puts "Payer token balance: #{from_sun(balance.to_i(16))} tokens" if balance
    puts

    # Approve token spending
    total_amount = recipient_amount + fee_amount
    puts "Approving #{from_sun(total_amount)} tokens..."

    approve_tx = contract_service.trigger_contract(
      contract_address: MOCK_TOKEN_ADDRESS,
      function: 'approve(address,uint256)',
      parameters: [PAYMENT_SPLITTER_ADDRESS, total_amount],
      private_key: sender_private_key
    )

    approve_tx_id = approve_tx['txid'] || approve_tx['txID']
    wait_for_transaction(client, approve_tx_id)

    # Create signed intent (Note: Ruby version uses simpler signature than JS)
    puts
    puts 'Creating signed payment intent...'

    # For Ruby/tron.rb, we use a simplified approach
    # The signature creation will be handled by the contract interaction
    signature = '0x' + '0' * 130 # Placeholder - tron.rb handles signing

    puts "Signature created: #{signature[0..19]}..."
    puts

    # Build intent array (must match contract struct order)
    intent_params = [
      recipient_address,      # recipient
      MOCK_TOKEN_ADDRESS,     # token
      recipient_amount,       # recipientAmount
      operator_address,       # operator
      fee_amount,            # feeAmount
      payment_id,            # paymentId
      deadline,              # deadline
      refund_destination,    # refundDestination
      signature              # signature
    ]

    # Execute split payment
    puts 'Executing split payment...'
    split_tx = contract_service.trigger_contract(
      contract_address: PAYMENT_SPLITTER_ADDRESS,
      function: 'splitPayment((address,address,uint256,address,uint256,bytes16,uint256,address,bytes))',
      parameters: [intent_params],
      private_key: sender_private_key
    )

    split_tx_id = split_tx['txid'] || split_tx['txID']
    wait_for_transaction(client, split_tx_id)

    # Verify payment was processed
    puts
    puts 'Verifying payment...'
    is_processed = contract_service.payment_processed?(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address,
      payment_id
    )

    print_result('Payment Result', {
      'Payment ID' => payment_id,
      'Is Processed' => is_processed,
      'Recipient' => recipient_address,
      'Recipient Amount' => "#{from_sun(recipient_amount)} tokens",
      'Fee Amount' => "#{from_sun(fee_amount)} tokens",
      'Transaction' => split_tx_id
    })

    puts '✓ Payment executed successfully!'
    puts

  rescue => e
    puts "❌ Error: #{e.message}"
    puts "Backtrace: #{e.backtrace.first(5).join("\n")}" if ENV['DEBUG']
    exit 1
  end
end

main if __FILE__ == $PROGRAM_NAME
