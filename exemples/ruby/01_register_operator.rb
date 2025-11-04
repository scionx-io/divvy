#!/usr/bin/env ruby
# frozen_string_literal: true

# Example: Register an operator with a fee destination
#
# This example shows how to:
# 1. Initialize Tron client connection
# 2. Load the PaymentSplitter contract
# 3. Register an operator with a custom fee destination
# 4. Verify the registration
#
# IMPORTANT: Run with bundle exec to avoid gem conflicts:
#   cd examples && bundle exec ruby ruby/01_register_operator.rb

require_relative 'utils'

def main
  puts '=== Register Operator Example ==='
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

  # Set fee destination (where operator fees will be sent)
  # In this example, we use the same address as operator, but it can be different
  fee_destination = operator_address

  puts 'Registering operator...'
  puts "Fee destination: #{fee_destination}"
  puts

  begin
    # Register operator
    contract_service = client.contract_service
    tx = contract_service.trigger_contract(
      contract_address: PAYMENT_SPLITTER_ADDRESS,
      function: 'registerOperatorWithFeeDestination(address)',
      parameters: [fee_destination],
      private_key: operator_private_key
    )

    tx_id = tx['txid'] || tx['txID']
    wait_for_transaction(client, tx_id)

    # Verify registration
    puts
    puts 'Verifying registration...'
    is_registered = contract_service.operator_registered?(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address
    )

    registered_fee_destination = contract_service.get_fee_destination(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address
    )

    print_result('Registration Result', {
      'Operator' => operator_address,
      'Is Registered' => is_registered,
      'Fee Destination' => registered_fee_destination,
      'Transaction' => tx_id
    })

    puts '✓ Operator registered successfully!'
    puts

  rescue => e
    puts "❌ Error: #{e.message}"
    puts "Backtrace: #{e.backtrace.first(3).join("\n")}" if ENV['DEBUG']
    exit 1
  end
end

main if __FILE__ == $PROGRAM_NAME
