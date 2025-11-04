#!/usr/bin/env ruby
# frozen_string_literal: true

# Example: Query payment status
#
# This example shows how to:
# 1. Check if a payment has been processed
# 2. Query payment status for different operators
#
# IMPORTANT: Run with bundle exec to avoid gem conflicts:
#   cd examples && bundle exec ruby ruby/04_query_payment.rb

require_relative 'utils'

def query_payment_status(client, operator_address, payment_id)
  contract_service = client.contract_service
  is_processed = contract_service.payment_processed?(
    PAYMENT_SPLITTER_ADDRESS,
    operator_address,
    payment_id
  )

  {
    'Operator' => operator_address,
    'Payment ID' => payment_id,
    'Is Processed' => is_processed
  }
end

def main
  puts '=== Query Payment Status Example ==='
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

  # Example payment ID (replace with actual payment ID from a previous transaction)
  example_payment_id = '0x00000000000000000000000000000000' # Replace with real payment ID

  puts 'Query Parameters:'
  puts "  Operator: #{operator_address}"
  puts "  Payment ID: #{example_payment_id}"
  puts

  begin
    # Query payment status
    puts 'Querying payment status...'
    payment_status = query_payment_status(client, operator_address, example_payment_id)

    print_result('Payment Status', payment_status)

    if payment_status['Is Processed']
      puts '✓ Payment has been processed'
    else
      puts '✗ Payment has not been processed yet'
    end
    puts

  rescue => e
    puts "❌ Error: #{e.message}"
    puts "Backtrace: #{e.backtrace.first(3).join("\n")}" if ENV['DEBUG']
    exit 1
  end
end

main if __FILE__ == $PROGRAM_NAME
