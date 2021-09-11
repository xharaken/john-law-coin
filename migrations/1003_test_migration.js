// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const JohnLawCoin_v2 = artifacts.require("JohnLawCoin_v2");
const JohnLawBond_v2 = artifacts.require("JohnLawBond_v2");
const Oracle_v3 = artifacts.require("Oracle_v3");
const Oracle_v5 = artifacts.require("Oracle_v5");
const BondOperation_v2 = artifacts.require("BondOperation_v2");
const BondOperation_v5 = artifacts.require("BondOperation_v5");
const OpenMarketOperation_v2 = artifacts.require("OpenMarketOperation_v2");
const OpenMarketOperation_v5 = artifacts.require("OpenMarketOperation_v5");
const EthPool_v2 = artifacts.require("EthPool_v2");
const Logging_v2 = artifacts.require("Logging_v2");
const ACB_v4 = artifacts.require("ACB_v4");
const ACB_v5 = artifacts.require("ACB_v5");

const ACB_ADDRESS = ACB_v4.address; // Update the value before testing.

module.exports = async function (deployer) {
  console.log("a");
  const old_acb = await ACB_v4.at(ACB_ADDRESS);
  await old_acb.pause();
  
  const coin = await JohnLawCoin_v2.at(await old_acb.coin_());
  const old_bond_operation = await BondOperation_v2.at(
    await old_acb.bond_operation_());
  const bond = await JohnLawBond_v2.at(await old_bond_operation.bond_());
  const old_open_market_operation = await OpenMarketOperation_v2.at(
    await old_acb.open_market_operation_());
  const eth_pool = await EthPool_v2.at(await old_acb.eth_pool_());
  const old_oracle = await Oracle_v3.at(await old_acb.oracle_());
  const logging = await Logging_v2.at(await old_acb.logging_());
  console.log("b");
  const bond_operation = await deployProxy(
    BondOperation_v5,
    [bond.address,
     await old_bond_operation.bond_budget_()]);
  console.log("c");
  const open_market_operation = await deployProxy(
    OpenMarketOperation_v5,
    [await old_open_market_operation.latest_price_(),
     await old_open_market_operation.start_price_(),
     await old_open_market_operation.eth_balance_(),
     await old_open_market_operation.coin_budget_()]);
  console.log("d");
  const oracle = await deployProxy(
    Oracle_v5, [await old_oracle.epoch_id_()]);
  console.log("e");
  const acb = await deployProxy(
    ACB_v5, [coin.address, old_oracle.address, oracle.address,
             bond_operation.address, open_market_operation.address,
             eth_pool.address, logging.address,
             await old_acb.oracle_level_(),
             await old_acb.current_epoch_start_()]);
  console.log("f");
  await old_acb.deprecate();
  await old_bond_operation.deprecate();
  console.log("g");

  await bond.transferOwnership(bond_operation.address);
  await coin.transferOwnership(acb.address);
  await old_oracle.transferOwnership(acb.address);
  await oracle.transferOwnership(acb.address);
  await bond_operation.transferOwnership(acb.address);
  await open_market_operation.transferOwnership(acb.address);
  await eth_pool.transferOwnership(acb.address);
  await logging.transferOwnership(acb.address);
  console.log("h");
  
  await acb.unpause();
  
  console.log("Oracle_v3 address: ", old_oracle.address);
  console.log("Oracle_v5 address: ", oracle.address);
  console.log("ACB_v5 address: ", acb.address);
};
