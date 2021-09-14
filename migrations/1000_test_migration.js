// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const common = require("./common.js");
const sleep = common.sleep;

const Oracle_v2 = artifacts.require("Oracle_v2");
const BondOperation = artifacts.require("BondOperation");
const BondOperation_v2 = artifacts.require("BondOperation_v2");
const OpenMarketOperation = artifacts.require("OpenMarketOperation");
const OpenMarketOperation_v2 = artifacts.require("OpenMarketOperation_v2");
const EthPool = artifacts.require("EthPool");
const EthPool_v2 = artifacts.require("EthPool_v2");
const Logging_v2 = artifacts.require("Logging_v2");
const ACB = artifacts.require("ACB");
const ACB_v2 = artifacts.require("ACB_v2");
const JohnLawCoin_v2 = artifacts.require("JohnLawCoin_v2");
const JohnLawBond_v2 = artifacts.require("JohnLawBond_v2");

const ACB_ADDRESS = ACB.address; // Update the value before testing.

module.exports = async function (deployer) {
  const old_acb = await ACB.at(ACB_ADDRESS);
  await old_acb.pause();
  const old_bond_operation = await BondOperation.at(
    await old_acb.bond_operation_());
  const old_open_market_operation = await OpenMarketOperation.at(
    await old_acb.open_market_operation_());
  const old_eth_pool = await EthPool.at(await old_acb.eth_pool_());

  await sleep(10000); console.log("a");
  const coin = await upgradeProxy(await old_acb.coin_(), JohnLawCoin_v2);
  await sleep(10000); console.log("b");
  const bond = await upgradeProxy(
    await old_bond_operation.bond_(), JohnLawBond_v2);
  await sleep(10000); console.log("c");
  const oracle = await upgradeProxy(await old_acb.oracle_(), Oracle_v2);
  await sleep(10000); console.log("d");
  const bond_operation = await upgradeProxy(
    old_bond_operation.address, BondOperation_v2);
  await sleep(10000); console.log("e");
  const open_market_operation = await upgradeProxy(
    old_open_market_operation.address, OpenMarketOperation_v2);
  await sleep(10000); console.log("f");
  const eth_pool = await upgradeProxy(old_eth_pool.address, EthPool_v2);
  await sleep(10000); console.log("g");
  const logging = await upgradeProxy(await old_acb.logging_(), Logging_v2);
  await sleep(10000); console.log("h");
  const acb = await upgradeProxy(old_acb.address, ACB_v2);
  await sleep(10000); console.log("i");
  await acb.upgrade(
    coin.address, bond.address, oracle.address,
    bond_operation.address, open_market_operation.address,
    eth_pool.address, logging.address);
  await sleep(10000); console.log("j");
  await acb.unpause();
  
  console.log("JohnLawCoin_v2 address: ", coin.address);
  console.log("JohnLawBond_v2 address: ", bond.address);
  console.log("Oracle_v2 address: ", oracle.address);
  console.log("BondOperation_v2 address: ", bond_operation.address);
  console.log("OpenMarketOperation_v2 address: ",
              open_market_operation.address);
  console.log("EthPool_v2 address: ", eth_pool.address);
  console.log("Logging_v2 address: ", logging.address);
  console.log("ACB_v2 address: ", acb.address);
  await sleep(10000); console.log("k");
};
