#!/usr/bin/env ruby
# frozen_string_literal: true

# Verify signature creation matches JavaScript implementation

require_relative 'utils'

def main
  puts '=== Signature Verification Script ==='
  puts

  # Initialize Tron client
  client = init_tron_client

  operator_private_key = ENV['OPERATOR_PRIVATE_KEY']
  payer_address = 'TDxCruLFdzFWc9NE1w8Z2uWL7FYkbDmjun'
  recipient_address = 'TJKweYPR4ZZofigWHg9Nsk4b1cQkPTrVKN'
  operator_address = get_address_from_private_key(operator_private_key)

  # Use same values from the failing transaction
  recipient_amount = 45000000
  fee_amount = 5000000
  payment_id = '0x9a7b2e7f829a17ec46694c3e1ddca70d'
  deadline = 1762490624

  puts 'Creating signature with parameters:'
  puts "  recipient_amount: #{recipient_amount}"
  puts "  deadline: #{deadline}"
  puts "  recipient: #{recipient_address}"
  puts "  token: #{TOKEN_ADDRESS}"
  puts "  refund_destination: #{payer_address}"
  puts "  fee_amount: #{fee_amount}"
  puts "  payment_id: #{payment_id}"
  puts "  operator: #{operator_address}"
  puts "  payer: #{payer_address}"
  puts "  contract: #{CONTRACT_ADDRESS}"
  puts

  signature_result = create_signed_intent(
    {
      recipient_amount: recipient_amount,
      deadline: deadline,
      recipient: recipient_address,
      token_address: TOKEN_ADDRESS,
      refund_destination: payer_address,
      fee_amount: fee_amount,
      payment_id: payment_id,
      operator_address: operator_address,
      payer_address: payer_address,
      splitter_address: CONTRACT_ADDRESS
    },
    operator_private_key,
    client
  )

  puts 'Signature created:'
  puts "  Signature: #{signature_result[:signature]}"
  puts "  Hash: #{signature_result[:hash]}"
  puts

  puts 'Expected signature from Rails:'
  puts '  0xc243f2676e476ddf805e6c83428b897c4c6ecd487038edcef9caad7ceb0ae6ac5e04bdc04f75b88b3366e2308e3fe88b04b0042a79bd4dd58bb5b2b3f6cc73781c'
  puts

  if signature_result[:signature] == '0xc243f2676e476ddf805e6c83428b897c4c6ecd487038edcef9caad7ceb0ae6ac5e04bdc04f75b88b3366e2308e3fe88b04b0042a79bd4dd58bb5b2b3f6cc73781c'
    puts '✅ Signatures MATCH!'
  else
    puts '❌ Signatures DO NOT match!'
    puts 'This indicates a difference in signature creation between Ruby example and Rails app'
  end
end

main if __FILE__ == $PROGRAM_NAME
