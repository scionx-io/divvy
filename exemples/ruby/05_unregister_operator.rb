#!/usr/bin/env ruby
# frozen_string_literal: true

# Example: Unregister an operator
#
# This example shows how to:
# 1. Check current operator registration status
# 2. Unregister an operator
# 3. Verify the unregistration
#
# WARNING: After unregistering, the operator cannot process new payments
# until they register again.
#
# IMPORTANT: Run with bundle exec to avoid gem conflicts:
#   cd examples && bundle exec ruby ruby/05_unregister_operator.rb

require_relative 'utils'

def main
  puts '=== Unregister Operator Example ==='
  puts

  # Initialize Tron client (using default account from .env)
  client = init_tron_client
  puts 'Connected to Shasta testnet'

  operator_private_key = ENV['OPERATOR_PRIVATE_KEY']
  unless operator_private_key
    puts '❌ Error: OPERATOR_PRIVATE_KEY not found in .env file'
    exit 1
  end

  operator_address = get_address_from_private_key(operator_private_key)
  puts "Operator address: #{operator_address}"
  puts

  begin
    contract_service = client.contract_service

    # Check current registration status
    puts 'Checking current registration status...'
    is_registered_before = contract_service.operator_registered?(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address
    )

    unless is_registered_before
      puts '✗ Operator is not registered. Nothing to unregister.'
      puts
      return
    end

    fee_destination_before = contract_service.get_fee_destination(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address
    )

    puts 'Current status: Registered'
    puts "Fee destination: #{fee_destination_before}"
    puts

    # Unregister operator
    puts 'Unregistering operator...'
    tx = contract_service.trigger_contract(
      contract_address: PAYMENT_SPLITTER_ADDRESS,
      function: 'unregisterOperator()',
      parameters: [],
      private_key: operator_private_key
    )

    tx_id = tx['txid'] || tx['txID']
    wait_for_transaction(client, tx_id)

    # Verify unregistration
    puts
    puts 'Verifying unregistration...'
    is_registered_after = contract_service.operator_registered?(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address
    )

    fee_destination_after = contract_service.get_fee_destination(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address
    )

    print_result('Unregistration Result', {
      'Operator' => operator_address,
      'Was Registered' => is_registered_before,
      'Is Registered Now' => is_registered_after,
      'Fee Destination' => fee_destination_after,
      'Transaction' => tx_id
    })

    puts '✓ Operator unregistered successfully!'
    puts
    puts '⚠️  Note: The operator can no longer process payments until re-registered.'
    puts

  rescue => e
    puts "❌ Error: #{e.message}"
    puts "Backtrace: #{e.backtrace.first(3).join("\n")}" if ENV['DEBUG']
    exit 1
  end
end

main if __FILE__ == $PROGRAM_NAME
