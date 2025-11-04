#!/usr/bin/env ruby
# frozen_string_literal: true

# Example: Query operator information
#
# This example shows how to:
# 1. Check if an operator is registered
# 2. Get operator's fee destination
# 3. Query multiple operators
#
# IMPORTANT: Run with bundle exec to avoid gem conflicts:
#   cd examples && bundle exec ruby ruby/02_query_operator.rb

require_relative 'utils'

def query_operator(client, operator_address)
  contract_service = client.contract_service
  is_registered = contract_service.operator_registered?(
    PAYMENT_SPLITTER_ADDRESS,
    operator_address
  )

  if is_registered
    fee_destination = contract_service.get_fee_destination(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address
    )

    {
      'Operator' => operator_address,
      'Is Registered' => true,
      'Fee Destination' => fee_destination
    }
  else
    {
      'Operator' => operator_address,
      'Is Registered' => false,
      'Fee Destination' => 'N/A'
    }
  end
end

def main
  puts '=== Query Operator Information Example ==='
  puts

  # Initialize Tron client
  client = init_tron_client
  puts 'Connected to Shasta testnet'
  puts

  operator_private_key = ENV['OPERATOR_PRIVATE_KEY']
  unless operator_private_key
    puts '❌ Error: OPERATOR_PRIVATE_KEY not found in .env file'
    exit 1
  end

  operator_address = get_address_from_private_key(operator_private_key)

  begin
    # Query current account
    puts 'Querying current account...'
    operator_info = query_operator(client, operator_address)

    print_result('Current Account Information', operator_info)

    puts '✓ Query completed successfully!'
    puts

  rescue => e
    puts "❌ Error: #{e.message}"
    puts "Backtrace: #{e.backtrace.first(3).join("\n")}" if ENV['DEBUG']
    exit 1
  end
end

main if __FILE__ == $PROGRAM_NAME
