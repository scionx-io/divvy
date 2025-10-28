#!/usr/bin/env ruby
# frozen_string_literal: true

require 'tron'
require 'tron/key'
require 'dotenv/load'

operator_private_key = ENV['OPERATOR_PRIVATE_KEY']
sender_private_key = ENV['SENDER_PRIVATE_KEY']

# Initialize tron.rb client
client = Tron::Client.new(
  api_key: ENV['TRONGRID_API_KEY'],
  network: :shasta,
  timeout: 30
)

[
  ['Operator', operator_private_key],
  ['Sender', sender_private_key]
].each do |label, private_key|
  next unless private_key

  key = Tron::Key.new(priv: private_key)
  address = key.address

  puts "=" * 60
  puts "#{label} Account: #{address}"
  puts "=" * 60

  begin
    # Use tron.rb gem's built-in balance service
    balance_service = client.balance_service
    trx_balance = balance_service.get_trx(address)

    puts "TRX Balance: #{trx_balance} TRX"

    # Get account resources using the client's resources service
    resources_service = client.resources_service
    resources = resources_service.get(address)

    puts "\nEnergy:"
    puts "  Available: #{resources[:energy]}"
    puts "  Limit: #{resources[:energyLimit]}"

    puts "\nBandwidth:"
    puts "  Available: #{resources[:bandwidth]}"
    puts "  Limit: #{resources[:bandwidthLimit]}"
    puts "  Total Free Bandwidth: #{resources[:totalFreeBandwidth]}"

    # Check TRX balance health
    trx_balance_float = trx_balance.to_f
    if trx_balance_float < 0.001
      puts "\n⚠️  WARNING: Very low TRX balance (< 0.001 TRX)"
      puts "   Get test TRX from: https://shasta.tronex.io/"
    end

    # Check energy health
    energy_available = resources[:energy]
    if energy_available < 100 && resources[:energyLimit] > 0
      puts "\n⚠️  WARNING: Low energy (< 100 available)"
    elsif resources[:energyLimit] == 0
      puts "\n⚠️  WARNING: No staked energy - transactions will burn TRX"
    end

  rescue => e
    puts "❌ Error checking account: #{e.message}"
    puts e.backtrace.first(5).join("\n") if ENV['DEBUG']
  end

  puts ""
end
