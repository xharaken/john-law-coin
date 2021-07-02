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
const BondOperation_v2 = artifacts.require("BondOperation_v2");
const Logging_v2 = artifacts.require("Logging_v2");
const ACB_v3 = artifacts.require("ACB_v3");
const ACB_v4 = artifacts.require("ACB_v4");

const ACB_ADDRESS = ACB_v3.address; // Update the value before testing.

module.exports = async function (deployer) {
  const old_acb = await ACB_v3.at(ACB_ADDRESS);
  await old_acb.pause();
  
  const coin = await JohnLawCoin_v2.at(await old_acb.coin_v2_());
  const oracle = await Oracle_v3.at(await old_acb.oracle_v3_());
  const bond_operation = await BondOperation_v2.at(
    await old_acb.bond_operation_v2_());
  const logging = await Logging_v2.at(await old_acb.logging_v2_());
  const acb = await deployProxy(
    ACB_v4, [coin.address, oracle.address, bond_operation.address,
             logging.address, await old_acb.oracle_level_(),
             await old_acb.current_epoch_start_()]);
  await old_acb.deprecate();

  await coin.transferOwnership(acb.address);
  await oracle.transferOwnership(acb.address);
  await bond_operation.transferOwnership(acb.address);
  await logging.transferOwnership(acb.address);
  await acb.unpause();
  
  console.log("ACB_v4 address: ", acb.address);
};
