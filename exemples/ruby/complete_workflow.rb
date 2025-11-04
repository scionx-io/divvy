#!/usr/bin/env ruby
# frozen_string_literal: true

# Complete End-to-End Workflow Example
#
# This example demonstrates the complete PaymentSplitter workflow:
# 1. Register an operator
# 2. Setup test token and balances
# 3. Execute a split payment
# 4. Query payment status
# 5. Query operator information
#
# IMPORTANT: Run with bundle exec to avoid gem conflicts:
#   cd examples && bundle exec ruby ruby/complete_workflow.rb

require_relative 'utils'

def main
  puts '=' * 80
  puts 'COMPLETE PAYMENT SPLITTER WORKFLOW'
  puts '=' * 80
  puts "\n\n"

  # ==========================================
  # STEP 1: SETUP
  # ==========================================
  puts 'STEP 1: Setup Accounts and Contracts'
  puts '-' * 80

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

  puts "✓ Operator address: #{operator_address}"
  puts "✓ Payer address: #{payer_address}"

  # Create a recipient address (for demo, we'll use operator as recipient)
  recipient_address = operator_address
  puts "✓ Recipient address: #{recipient_address}"

  # Fee destination (where operator fees go)
  fee_destination = operator_address
  puts "✓ Fee destination: #{fee_destination}"
  puts

  puts '✓ Contracts loaded'
  puts

  sleep_with_message(2)

  # ==========================================
  # STEP 2: REGISTER OPERATOR
  # ==========================================
  puts 'STEP 2: Register Operator'
  puts '-' * 80

  begin
    contract_service = client.contract_service

    # Check if already registered
    is_registered = contract_service.operator_registered?(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address
    )

    if is_registered
      puts '✓ Operator already registered'
    else
      puts 'Registering operator...'
      register_tx = contract_service.trigger_contract(
        contract_address: PAYMENT_SPLITTER_ADDRESS,
        function: 'registerOperatorWithFeeDestination(address)',
        parameters: [fee_destination],
        private_key: operator_private_key
      )

      register_tx_id = register_tx['txid'] || register_tx['txID']
      client.transaction_service.wait_for_transaction(register_tx_id)
      puts '✓ Operator registered successfully'
    end
    puts

    sleep_with_message(2)

    # ==========================================
    # STEP 3: SETUP TOKEN BALANCES
    # ==========================================
    puts 'STEP 3: Setup Token Balances'
    puts '-' * 80

    balance_result = contract_service.call_contract(
      contract_address: MOCK_TOKEN_ADDRESS,
      function: 'balanceOf(address)',
      parameters: [payer_address]
    )

    if balance_result && balance_result['constant_result'] && balance_result['constant_result'][0]
      balance = balance_result['constant_result'][0].to_i(16)
      puts "Payer token balance: #{from_sun(balance)} tokens"

      if balance < to_sun(200)
        puts '⚠️  Warning: Payer has insufficient balance for demo'
        puts '   Please ensure the payer has at least 200 tokens'
      else
        puts '✓ Payer has sufficient balance'
      end
    end
    puts

    sleep_with_message(2)

    # ==========================================
    # STEP 4: APPROVE TOKEN SPENDING
    # ==========================================
    puts 'STEP 4: Approve Token Spending'
    puts '-' * 80

    recipient_amount = to_sun(100)
    fee_amount = to_sun(10)
    total_amount = recipient_amount + fee_amount

    puts "Approving #{from_sun(total_amount)} tokens..."
    approve_tx = contract_service.trigger_contract(
      contract_address: MOCK_TOKEN_ADDRESS,
      function: 'approve(address,uint256)',
      parameters: [PAYMENT_SPLITTER_ADDRESS, total_amount],
      private_key: sender_private_key
    )

    if approve_tx.nil?
      raise 'Approval transaction failed - received nil response'
    end

    puts "Debug - Approve TX response: #{approve_tx.inspect}" if ENV['DEBUG']
    approve_tx_id = approve_tx['txid'] || approve_tx['txID']

    unless approve_tx_id
      raise "No transaction ID in response: #{approve_tx.inspect}"
    end

    client.transaction_service.wait_for_transaction(approve_tx_id)
    puts '✓ Token spending approved'
    puts

    sleep_with_message(2)

    # ==========================================
    # STEP 5: CREATE SIGNED PAYMENT INTENT
    # ==========================================
    puts 'STEP 5: Create Signed Payment Intent'
    puts '-' * 80

    payment_id = generate_payment_id
    deadline = get_future_timestamp(3600)

    puts "Payment ID: #{payment_id}"
    puts "Recipient: #{recipient_address}"
    puts "Recipient Amount: #{from_sun(recipient_amount)} tokens"
    puts "Fee Amount: #{from_sun(fee_amount)} tokens"
    puts "Deadline: #{Time.at(deadline).utc}"

    # Create proper TIP-191 signature
    signature_result = create_signed_intent(
      {
        recipient_amount: recipient_amount,
        deadline: deadline,
        recipient: recipient_address,
        token_address: MOCK_TOKEN_ADDRESS,
        refund_destination: payer_address,
        fee_amount: fee_amount,
        payment_id: payment_id,
        operator_address: operator_address,
        payer_address: payer_address,
        splitter_address: PAYMENT_SPLITTER_ADDRESS
      },
      operator_private_key,
      0x94a9059e  # Shasta testnet chain ID
    )

    signature = signature_result[:signature]
    hash = signature_result[:hash]

    puts "✓ Signature created: #{signature[0..19]}..."
    puts "✓ Hash: #{hash[0..39]}..."
    puts

    sleep_with_message(2)

    # ==========================================
    # STEP 6: EXECUTE SPLIT PAYMENT
    # ==========================================
    puts 'STEP 6: Execute Split Payment'
    puts '-' * 80

    intent_params = [
      recipient_address,
      MOCK_TOKEN_ADDRESS,
      recipient_amount,
      operator_address,
      fee_amount,
      payment_id,
      deadline,
      payer_address,
      signature
    ]

    puts 'Intent array:'
    puts "  [0] recipient: #{intent_params[0]}"
    puts "  [1] token: #{intent_params[1]}"
    puts "  [2] recipientAmount: #{intent_params[2]}"
    puts "  [3] operator: #{intent_params[3]}"
    puts "  [4] feeAmount: #{intent_params[4]}"
    puts "  [5] paymentId: #{intent_params[5]}"
    puts "  [6] deadline: #{intent_params[6]}"
    puts "  [7] refundDest: #{intent_params[7]}"
    puts "  [8] signature: #{intent_params[8][0..19]}..."
    puts

    puts 'Executing split payment...'
    # Note: For tuple types, wrap the array in another array (tuple is 1 parameter)
    split_tx = contract_service.trigger_contract(
      contract_address: PAYMENT_SPLITTER_ADDRESS,
      function: 'splitPayment((address,address,uint256,address,uint256,bytes16,uint256,address,bytes))',
      parameters: [intent_params],  # Wrap in array - tuple is 1 parameter
      private_key: sender_private_key
    )

    split_tx_id = split_tx['txid'] || split_tx['txID']
    client.transaction_service.wait_for_transaction(split_tx_id)
    puts '✓ Payment executed successfully'
    puts "  Transaction: #{split_tx_id}"
    puts

    sleep_with_message(2)

    # ==========================================
    # STEP 7: VERIFY PAYMENT
    # ==========================================
    puts 'STEP 7: Verify Payment Status'
    puts '-' * 80

    is_processed = contract_service.payment_processed?(
      PAYMENT_SPLITTER_ADDRESS,
      operator_address,
      payment_id
    )

    puts "Payment processed: #{is_processed ? '✓ Yes' : '✗ No'}"
    puts "✓ Payment ID #{payment_id} has been successfully processed" if is_processed
    puts

    sleep_with_message(2)

    # ==========================================
    # STEP 8: CHECK FINAL BALANCES
    # ==========================================
    puts 'STEP 8: Check Final Balances'
    puts '-' * 80

    payer_balance_after_result = contract_service.call_contract(
      contract_address: MOCK_TOKEN_ADDRESS,
      function: 'balanceOf(address)',
      parameters: [payer_address]
    )

    if payer_balance_after_result && payer_balance_after_result['constant_result'] && payer_balance_after_result['constant_result'][0]
      payer_balance_after = payer_balance_after_result['constant_result'][0].to_i(16)
      puts "Payer balance after: #{from_sun(payer_balance_after)} tokens"
    end

    recipient_balance_after_result = contract_service.call_contract(
      contract_address: MOCK_TOKEN_ADDRESS,
      function: 'balanceOf(address)',
      parameters: [recipient_address]
    )

    if recipient_balance_after_result && recipient_balance_after_result['constant_result'] && recipient_balance_after_result['constant_result'][0]
      recipient_balance_after = recipient_balance_after_result['constant_result'][0].to_i(16)
      puts "Recipient balance: #{from_sun(recipient_balance_after)} tokens (received: #{from_sun(recipient_amount)})"
    end

    puts

    # ==========================================
    # SUMMARY
    # ==========================================
    puts '=' * 80
    puts 'WORKFLOW COMPLETED SUCCESSFULLY'
    puts '=' * 80
    puts
    puts 'Summary:'
    puts '  • Operator registered: ✓'
    puts '  • Payment executed: ✓'
    puts "  • Payment ID: #{payment_id}"
    puts "  • Transaction: #{split_tx_id}"
    puts "  • Recipient received: #{from_sun(recipient_amount)} tokens"
    puts "  • Operator earned: #{from_sun(fee_amount)} tokens"
    puts
    puts '✓ All steps completed successfully!'
    puts

  rescue => e
    puts
    puts '=' * 80
    puts '❌ ERROR'
    puts '=' * 80
    puts e.message

    if ENV['DEBUG']
      puts "\n📋 Debug Information:"
      puts e.backtrace.first(10).join("\n")
    end

    puts '=' * 80
    exit 1
  end
end

main if __FILE__ == $PROGRAM_NAME
