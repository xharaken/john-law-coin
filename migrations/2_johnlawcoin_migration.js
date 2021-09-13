// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const common = require("./common.js");
const sleep = common.sleep;

const Oracle = artifacts.require("Oracle");
const BondOperation = artifacts.require("BondOperation");
const OpenMarketOperation = artifacts.require("OpenMarketOperation");
const EthPool = artifacts.require("EthPool");
const Logging = artifacts.require("Logging");
const ACB = artifacts.require("ACB");
const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");

module.exports = async function (deployer) {
  const coin = await deployProxy(JohnLawCoin, []);
  await sleep(10000); console.log("a");
  const bond = await deployProxy(JohnLawBond, []);
  await sleep(10000); console.log("b");
  const oracle = await deployProxy(Oracle, []);
  await sleep(10000); console.log("c");
  const bond_operation = await deployProxy(BondOperation, [bond.address]);
  await sleep(10000); console.log("d");
  const open_market_operation = await deployProxy(OpenMarketOperation, []);
  await sleep(10000); console.log("e");
  const eth_pool = await deployProxy(EthPool, []);
  await sleep(10000); console.log("f");
  const logging = await deployProxy(Logging, []);
  await sleep(10000); console.log("g");
  const acb = await deployProxy(
    ACB, [coin.address, oracle.address, bond_operation.address,
          open_market_operation.address, eth_pool.address, logging.address]);
  await sleep(10000); console.log("h");
  
  console.log("JohnLawCoin address: ", coin.address);
  console.log("JohnLawBond address: ", bond.address);
  console.log("Oracle address: ", oracle.address);
  console.log("BondOperation address: ", bond_operation.address);
  console.log("OpenMarketOperation address: ", open_market_operation.address);
  console.log("EthPool address: ", eth_pool.address);
  console.log("Logging address: ", logging.address);
  console.log("ACB address: ", acb.address);
  
  await bond.transferOwnership(bond_operation.address);
  await coin.transferOwnership(acb.address);
  await oracle.transferOwnership(acb.address);
  await bond_operation.transferOwnership(acb.address);
  await open_market_operation.transferOwnership(acb.address);
  await eth_pool.transferOwnership(acb.address);
  await logging.transferOwnership(acb.address);
  console.log("i");
};
