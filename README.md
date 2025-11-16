# **Divvy Protocol**

Divvy is a lightweight on-chain payment coordinator built for the Tron network. It provides a simple, reliable way to distribute payments between a main recipient and an operator, ensuring predictable settlement and verifiable processing.

---

## **What Divvy Does**

* Sends the exact amount specified to the intended recipient
* Routes an operator fee in the same transaction
* Prevents the same payment from being processed more than once
* Ensures the entire transfer succeeds together or fails together
* Keeps the protocol open—anyone can act as an operator

---

## **Deployments**

| Network | Environment    | Address |
| ------- | -------------- | ------- |
| Tron    | Mainnet        | `TBD`   |
| Tron    | Nile Testnet   | `TBHRkgDhbraCfYkuaRTmVzhiVakcjEPTtj` |
| Tron    | Shasta Testnet | `TBD`   |

---

## **Examples**

Complete examples demonstrating Divvy protocol usage are available in both JavaScript and Ruby:

### JavaScript Examples

Located in the `examples/js/` directory, these examples demonstrate complete workflows:

- `complete_workflow.js` - Complete end-to-end workflow including registration, payment execution, and verification
- `swap_trx_to_usdt.js` - Swap TRX to USDT and split payment in a single transaction
- Other step-by-step examples for individual operations

To run the JavaScript examples:

```bash
cd examples/js
npm install
# Copy and update .env file with your private keys
cp .env.example .env
node complete_workflow.js
```

### Ruby Examples

Located in the `examples/ruby/` directory:

- `complete_workflow.rb` - Complete end-to-end workflow in Ruby

To run the Ruby examples:

```bash
cd examples/ruby
bundle install
# Copy and update .env file with your private keys
cp .env.example .env
bundle exec ruby ruby/complete_workflow.rb
```

---

## **How It Works**

### **Integration**

Divvy supports integration in multiple languages:

#### Ruby + tron.rb

Divvy can be used with Ruby through the tron.rb gem.

Required endpoints:

- /wallet/triggersmartcontract for write operations
- /wallet/triggerconstantcontract for read operations

#### JavaScript + TronWeb

Divvy can also be integrated using JavaScript with TronWeb library.

Required endpoints:

- tronWeb.transaction.triggerSmartContract() for write operations
- tronWeb.contract().at().methodName().call() for read operations

---

### **Operators**

Before facilitating payments, an operator must register with the contract.
Registration lets the operator:

* identify itself to the protocol
* choose where fees should be delivered

Operators are free to register or step away at any time.
Every payment includes the operator responsible for handling it.

---

### **Payment Structure**

A payment request in Divvy includes:

* who receives the main payout
* which TRC20 token is used
* how much goes to the recipient
* which operator is involved
* how much the operator earns
* the sender providing the funds
* a unique ID used to lock the payment to a single successful execution

This data is passed directly into the settlement function.

---

## **Settlement Rules**

Divvy enforces several conditions during settlement:

* recipient and operator amounts must match what was supplied
* the same payment ID cannot be handled twice
* all token movements occur in one atomic transaction
* if anything goes wrong, nothing is transferred

The goal is to keep payments simple, predictable, and tamper-resistant.

---

## **Testing**

Use the Tron Nile testnet for early integration.
A faucet is available via TronGrid.

---

## **Main Function**

### `splitPayment(...)`

This function:

1. pulls the specified token amount from the payer
2. transfers the recipient portion
3. transfers the operator’s fee
4. records the payment ID as completed

If any step is invalid, the transaction reverts.

---

## **Events**

Successful settlement emits an event containing:

* the payment ID
* the operator
* sender and recipient
* token address
* amounts paid

This allows external systems to track or index payouts.

---

## **Troubleshooting**

- Ensure operators are registered before calling splitPayment
- Verify token decimals and balances
- Validate unique payment IDs
- Confirm TRX balance for energy/bandwidth

