#!/usr/bin/env ruby
# frozen_string_literal: true

# Test script for operator lifecycle management
# IMPORTANT: Run with bundle exec to avoid gem conflicts:
#   bundle exec ruby test_operator_lifecycle.rb

require 'tron'
require 'tron/key'
require 'dotenv/load'

# Configuration
PAYMENT_SPLITTER_ADDRESS = ENV['PAYMENT_SPLITTER_SHASTA_ADDRESS']
operator_private_key = ENV['OPERATOR_PRIVATE_KEY']

unless PAYMENT_SPLITTER_ADDRESS && operator_private_key
  puts "❌ Error: Missing environment variables"
  puts "Required: PAYMENT_SPLITTER_SHASTA_ADDRESS, OPERATOR_PRIVATE_KEY"
  exit 1
end

# Initialize client
client = Tron::Client.new(
  api_key: ENV['TRONGRID_API_KEY'],
  network: :shasta,
  timeout: 30
)

# Get operator address
operator_key = Tron::Key.new(priv: operator_private_key)
operator_address = operator_key.address

puts "=" * 60
puts "Operator Lifecycle Test"
puts "=" * 60
puts "Contract: #{PAYMENT_SPLITTER_ADDRESS}"
puts "Operator: #{operator_address}"
puts "=" * 60

# Step 1: Check current registration status
puts "\n[Step 1] Checking registration status..."
contract_service = client.contract_service
is_registered = contract_service.operator_registered?(
  PAYMENT_SPLITTER_ADDRESS,
  operator_address
)

puts "Status: #{is_registered ? '✅ Registered' : '❌ Not Registered'}"

# Step 2: If registered, try to unregister
if is_registered
  puts "\n[Step 2] Attempting to unregister..."
  begin
    # First, create the transaction without broadcasting to see what we get
    puts "Creating transaction..."
    tx_service = client.transaction_service

    # Create unsigned transaction
    tx_params = {
      owner_address: operator_address,
      contract_address: PAYMENT_SPLITTER_ADDRESS,
      function_selector: 'unregisterOperator()',
      parameter: '',
      call_value: 0,
      fee_limit: 100_000_000
    }

    puts "Triggering contract with params: #{tx_params.inspect}"

    tx = contract_service.trigger_contract(
      contract_address: PAYMENT_SPLITTER_ADDRESS,
      function: 'unregisterOperator()',
      parameters: [],
      private_key: operator_private_key
    )

    if tx.nil?
      puts "❌ Unregister failed - received nil response"
    else
      puts "✅ Unregister transaction broadcast"
      puts "TX ID: #{tx['txid'] || tx['txID']}"
      puts "Full response: #{tx.inspect}" if ENV['DEBUG']

      # Wait a bit and check status
      puts "Waiting 5 seconds for confirmation..."
      sleep 5

      is_registered = contract_service.operator_registered?(
        PAYMENT_SPLITTER_ADDRESS,
        operator_address
      )
      puts "New status: #{is_registered ? '⚠️  Still Registered' : '✅ Unregistered'}"
    end
  rescue => e
    puts "❌ Unregister error: #{e.message}"
    puts "Error class: #{e.class}"
    puts "Full error: #{e.inspect}"
    puts "Backtrace:"
    puts e.backtrace.first(10).join("\n")
  end
else
  puts "\n[Step 2] Skipping unregister (not currently registered)"
end

# Step 3: Register operator
puts "\n[Step 3] Attempting to register..."
begin
  tx = contract_service.trigger_contract(
    contract_address: PAYMENT_SPLITTER_ADDRESS,
    function: 'registerOperator()',
    parameters: [],
    private_key: operator_private_key
  )

  if tx.nil?
    puts "❌ Register failed - received nil response"
  else
    puts "✅ Register transaction broadcast"
    puts "TX ID: #{tx['txid'] || tx['txID']}"

    # Wait and verify
    puts "Waiting 5 seconds for confirmation..."
    sleep 5

    is_registered = contract_service.operator_registered?(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address
    )
    puts "New status: #{is_registered ? '✅ Registered' : '❌ Still Not Registered'}"
  end
rescue => e
  puts "❌ Register error: #{e.message}"
  puts "Error class: #{e.class}"
  if ENV['DEBUG']
    puts "Full error:"
    puts e.inspect
    puts "Backtrace:"
    puts e.backtrace.first(10).join("\n")
  end
end

puts "\n" + "=" * 60
puts "Test Complete"
puts "=" * 60
