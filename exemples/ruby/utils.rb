# frozen_string_literal: true

# Utility functions for PaymentSplitter contract interaction
# IMPORTANT: Run scripts with bundle exec to avoid gem conflicts

require 'tron'
require 'tron/key'
require 'securerandom'
require 'dotenv'

# Load .env from the ruby directory
Dotenv.load(File.expand_path('.env', __dir__))

# Contract addresses from .env
CONTRACT_ADDRESS = ENV['CONTRACT_ADDRESS'] || 'TBHRkgDhbraCfYkuaRTmVzhiVakcjEPTtj'
TOKEN_ADDRESS = ENV['TOKEN_ADDRESS'] || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'

# Initialize Tron client for Nile testnet
def init_tron_client
  network = ENV['TRON_NETWORK'] || 'nile'

  Tron::Client.new(
    api_key: ENV['TRONGRID_API_KEY'],
    network: network.to_sym,
    timeout: 30
  )
end

# Get address from private key
def get_address_from_private_key(private_key)
  key = Tron::Key.new(priv: private_key)
  key.address
end

# Generate unique payment ID (bytes16 = 32 hex characters)
def generate_payment_id
  '0x' + SecureRandom.hex(16)
end

# Get future timestamp (default 1 hour from now)
def get_future_timestamp(offset_seconds = 3600)
  Time.now.to_i + offset_seconds
end

# Convert to sun (smallest unit)
def to_sun(amount)
  (amount * 1_000_000).to_i
end

# Convert from sun
def from_sun(amount)
  amount.to_f / 1_000_000
end



# Create a signed payment intent using TRON TIP-191 standard
# @param params [Hash] Payment parameters
# @param operator_private_key [String] Operator's private key for signing
# @param chain_id [Integer] Network chain ID (Shasta = 0x94a9059e)
# @return [Hash] containing signature and hash information
def create_signed_intent(params, operator_private_key, chain_id = 0x94a9059e)
  recipient_amount = params[:recipient_amount]
  deadline = params[:deadline]
  recipient = params[:recipient]
  token_address = params[:token_address]
  refund_destination = params[:refund_destination]
  fee_amount = params[:fee_amount]
  payment_id = params[:payment_id]
  operator_address = params[:operator_address]
  payer_address = params[:payer_address]
  splitter_address = params[:splitter_address]

  # Convert TRON base58 addresses to hex (strip '41' prefix and add '0x')
  recipient_hex = '0x' + Tron::Utils::Address.to_hex(recipient).sub(/^41/, '')
  token_hex = '0x' + Tron::Utils::Address.to_hex(token_address).sub(/^41/, '')
  refund_hex = '0x' + Tron::Utils::Address.to_hex(refund_destination).sub(/^41/, '')
  operator_hex = '0x' + Tron::Utils::Address.to_hex(operator_address).sub(/^41/, '')
  payer_hex = '0x' + Tron::Utils::Address.to_hex(payer_address).sub(/^41/, '')
  splitter_hex = '0x' + Tron::Utils::Address.to_hex(splitter_address).sub(/^41/, '')

  # Pack parameters using tron.rb ABI encoder (same order as contract signature verification)
  # Order in contract: recipientAmount, deadline, recipient, token, refundDest, feeAmount, paymentId, operator, chainId, msg.sender, address(this)
  types = [
    'uint256', 'uint256', 'address', 'address', 'address',
    'uint256', 'bytes16', 'address', 'uint256', 'address', 'address'
  ]

  # Use the original hex string for payment_id (like in JavaScript version)
  values = [
    recipient_amount,
    deadline,
    recipient_hex,
    token_hex,
    refund_hex,
    fee_amount,
    payment_id,  # Use original hex string with 0x prefix
    operator_hex,
    chain_id,
    payer_hex,  # msg.sender in the contract (the payer who calls splitPayment)
    splitter_hex  # address(this) in the contract (the PaymentSplitter contract address)
  ]

  # Encode using packed encoding (like Solidity's abi.encodePacked)
  packed = Tron::Abi.solidity_packed(types, values)
  hash = Tron::Utils::Crypto.keccak256(packed)

  # Sign using TIP-191 typed data signing
  key = Tron::Key.new(priv: operator_private_key)
  signature_hex = key.sign_typed_data(hash)

  # Return signature and hash information
  {
    signature: '0x' + signature_hex,
    hash: '0x' + hash.unpack1('H*')
  }
end

# Print result nicely
def print_result(title, result)
  puts "\n" + '=' * 60
  puts title
  puts '=' * 60

  if result.is_a?(Hash)
    result.each do |key, value|
      puts "#{key}: #{value}"
    end
  else
    puts result
  end

  puts '=' * 60 + "\n"
end

# Sleep helper
def sleep_with_message(seconds, message = nil)
  puts message if message
  sleep seconds
end
