# How to contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Contributor License Agreement

Contributions to this project must be accompanied by a Contributor License
Agreement (CLA). You (or your employer) retain the copyright to your
contribution; this simply gives us permission to use and redistribute your
contributions as part of the project. Head over to
<https://cla.developers.google.com/> to see your current agreements on file or
to sign a new one.

You generally only need to submit a CLA once, so if you've already submitted one
(even if it was for a different project), you probably don't need to do it
again.

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Community guidelines

This project follows
[Google's Open Source Community Guidelines](https://opensource.google/conduct/).

# How to build and deploy locally

## Installation

This project uses [Truffle](https://www.trufflesuite.com/truffle) and [Openzeppelin](https://openzeppelin.com/). You can install necessary packages as follows:

```
$ git clone https://github.com/xharaken/john-law-coin/
$ cd john-law-coin
$ sudo apt-get install nodejs npm
$ sudo npm install -g truffle
$ sudo npm install  openzeppelin-solidity
$ sudo npm install @openzeppelin/contracts-upgradeable
$ sudo npm install -g ganache-cli
$ sudo npm init -y
```

## Directory structure

```
john-law-coin/
|
|---- contracts/        # Smart contracts.
|     |---- JohnLawCoin.sol     # The smart contract of JohnLawCoin.
|     |---- Migrations.sol      # A smart contract to deploy JohnLawCoin.sol.
|     |---- test/               # Smart contracts for testing.
|
|---- wallet/           # The wallet implementation.
|---- docs/             # The whitepaper and documentation.
|---- migrations/       # Migration scripts to deploy the smart contracts.
|---- test/             # Tests and simulators for JohnLawCoin.sol.
|---- python/           # Tests and simulators for the JohnLawCoin algorithm written in Python (much faster than Truffle).
|---- truffle-config.js # Truffle configuration file.
```

## Running tests

```
$ ./test/run_coin_bond_unittest.py  # Run unittests for the JohnLawCoin contract and the JohnLawBond contract.
$ ./test/run_oracle_unittest.py  # Run unittests for the Oracle contract.
$ ./test/run_acb_unittest.py  # Run unittests for the ACB contract.
$ ./test/run_oracle_simulator.py  # Run a simulator for the Oracle contract.
$ ./test/run_acb_simulator.py  # Run a simulator for the ACB contract.
$ ./test/run_acb_upgrade.py  # Run upgrade tests for the Oracle contract and the ACB contract.
```

## Deploying smart contracts on a private network.

Launch a private network in one console.

```
$ ganache-cli -l 1200000000
```

Deploy the smart contracts.

```
$ truffle migrate
```

Then you can interact with the contracts using `truffle console`. See [this page](./HowToUseConsole.md) to learn more.

