#!/usr/bin/env ruby
# frozen_string_literal: true

# Debug script to compare Ruby signature generation with expected JavaScript output

require_relative 'utils'

puts '=' * 80
puts 'SIGNATURE GENERATION DEBUG'
puts '=' * 80
puts

client = init_tron_client
operator_private_key = ENV['OPERATOR_PRIVATE_KEY']
sender_private_key = ENV['SENDER_PRIVATE_KEY']

operator_address = get_address_from_private_key(operator_private_key)
payer_address = get_address_from_private_key(sender_private_key)

# Use fixed test data for reproducibility
recipient_amount = to_sun(100)
fee_amount = to_sun(10)
payment_id = '0x0123456789abcdef0123456789abcdef'  # Fixed payment ID
deadline = 1762264860  # Fixed deadline
recipient_address = operator_address

puts "Test Parameters:"
puts "  Recipient Amount: #{recipient_amount}"
puts "  Fee Amount: #{fee_amount}"
puts "  Payment ID: #{payment_id}"
puts "  Deadline: #{deadline}"
puts "  Recipient: #{recipient_address}"
puts "  Token: #{MOCK_TOKEN_ADDRESS}"
puts "  Payer: #{payer_address}"
puts "  Operator: #{operator_address}"
puts "  Splitter: #{PAYMENT_SPLITTER_ADDRESS}"
puts

# Convert addresses to hex and show
recipient_hex = '0x' + Tron::Utils::Address.to_hex(recipient_address).sub(/^41/, '')
token_hex = '0x' + Tron::Utils::Address.to_hex(MOCK_TOKEN_ADDRESS).sub(/^41/, '')
refund_hex = '0x' + Tron::Utils::Address.to_hex(payer_address).sub(/^41/, '')
operator_hex = '0x' + Tron::Utils::Address.to_hex(operator_address).sub(/^41/, '')
payer_hex = '0x' + Tron::Utils::Address.to_hex(payer_address).sub(/^41/, '')
splitter_hex = '0x' + Tron::Utils::Address.to_hex(PAYMENT_SPLITTER_ADDRESS).sub(/^41/, '')

puts "Hex Addresses (without 41 prefix, with 0x):"
puts "  Recipient: #{recipient_hex}"
puts "  Token: #{token_hex}"
puts "  Refund: #{refund_hex}"
puts "  Operator: #{operator_hex}"
puts "  Payer: #{payer_hex}"
puts "  Splitter: #{splitter_hex}"
puts

# Encode parameters
types = [
  'uint256', 'uint256', 'address', 'address', 'address',
  'uint256', 'bytes16', 'address', 'uint256', 'address', 'address'
]

values = [
  recipient_amount,
  deadline,
  recipient_hex,
  token_hex,
  refund_hex,
  fee_amount,
  payment_id,
  operator_hex,
  0x94a9059e,  # Shasta chain ID
  payer_hex,
  splitter_hex
]

puts "Encoding parameters..."
encoded = Tron::Abi.encode(types, values)
puts "Encoded (full): 0x#{encoded}"
puts "Encoded length: #{encoded.length} hex chars"
puts

# Hash the encoded data
hash = Tron::Utils::Crypto.keccak256(Tron::Abi::Util.hex_to_bin(encoded))
hash_hex = Tron::Utils::Crypto.bin_to_hex(hash)
puts "Hash: 0x#{hash_hex}"
puts

# Add TIP-191 prefix
prefix = "\x19Tron Signed Message:\n32"
prefixed_data = prefix.b + hash
prefixed_hash = Tron::Utils::Crypto.keccak256(prefixed_data)
prefixed_hash_hex = Tron::Utils::Crypto.bin_to_hex(prefixed_hash)
puts "Prefixed Hash: 0x#{prefixed_hash_hex}"
puts

# Sign
key = Tron::Key.new(priv: operator_private_key)
signature_hex = key.sign(prefixed_hash)
puts "Raw Signature (r+s+recovery_id): 0x#{signature_hex}"
puts

# Adjust v
signature_bytes = [signature_hex].pack('H*').unpack('C*')
r = signature_bytes[0...32]
s = signature_bytes[32...64]
recovery_id = signature_bytes[64]
v = recovery_id + 27

adjusted_signature = (r + s + [v]).pack('C*').unpack1('H*')
puts "Adjusted Signature (r+s+v): 0x#{adjusted_signature}"
puts "  recovery_id: #{recovery_id}"
puts "  v: #{v}"
puts

puts '=' * 80
