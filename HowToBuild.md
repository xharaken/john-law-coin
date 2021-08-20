# How to build and deploy locally

## Installation

This project uses [Truffle](https://www.trufflesuite.com/truffle) and [Openzeppelin](https://openzeppelin.com/). You can install necessary packages as follows:

```
$ git clone git@github.com:xharaken/john-law-coin.git
$ cd john-law-coin
$ sudo apt-get install nodejs npm
$ npm install -g truffle
$ npm install @openzeppelin/contracts
$ npm install @openzeppelin/contracts-upgradeable
$ npm install @truffle/hdwallet-provider
$ npm install dotenv --save
$ npm install -g ganache-cli
$ npm init -y
```

## Directory structure

```
john-law-coin/
|
|---- contracts/        # Smart contracts.
|     |---- JohnLawCoin.sol     # Smart contracts of JohnLawCoin.
|     |---- Migrations.sol      # A smart contract to deploy JohnLawCoin.sol.
|     |---- test/               # Smart contracts for testing.
|
|---- wallet/           # The wallet implementation.
|---- docs/             # The whitepaper, documentation and logo images.
|---- migrations/       # Migration scripts to deploy the smart contracts.
|---- test/             # Tests and simulators for JohnLawCoin.sol.
|---- python/           # Tests and simulators for the JohnLawCoin algorithm written in Python (much faster than Truffle).
|---- truffle-config.js # Truffle configuration file.
```

## Running tests

```
$ ./test/run_coin_bond_unittest.py  # Run unittests for the JohnLawCoin contract and the JohnLawBond contract.
$ ./test/run_logging_unittest.py  # Run unittests for the Logging contract.
$ ./test/run_bond_operation_unittest.py  # Run unittests for the BondOperation contract.
$ ./test/run_open_market_operation_unittest.py  # Run unittests for the OpenMarketOperation contract.
$ ./test/run_oracle_unittest.py  # Run unittests for the Oracle contract.
$ ./test/run_acb_unittest.py  # Run unittests for the ACB contract.
$ ./test/run_oracle_simulator.py  # Run a simulator for the Oracle contract.
$ ./test/run_acb_simulator.py  # Run a simulator for the ACB contract.
$ ./test/run_acb_upgrade.py  # Run tests to upgrade contracts.
```

## Deploying smart contracts on a private network

Launch a private network in one console.

```
$ ganache-cli -l 1200000000
```

Deploy the smart contracts.

```
$ truffle migrate
```

Then you can interact with the contracts using `truffle console`. See [this page](./HowToUseConsole.md) to learn more.

