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
const Logging_v2 = artifacts.require("Logging_v2");
const ACB_v4 = artifacts.require("ACB_v4");
const ACB_v5 = artifacts.require("ACB_v5");

const ACB_ADDRESS = ACB_v4.address; // Update the value before testing.

module.exports = async function (deployer) {
  const old_acb = await ACB_v4.at(ACB_ADDRESS);
  await old_acb.pause();
  
  const coin = await JohnLawCoin_v2.at(await old_acb.coin_());
  const bond = await JohnLawBond_v2.at(await old_acb.bond_());
  const old_oracle = await Oracle_v3.at(await old_acb.oracle_());
  const logging = await Logging_v2.at(await old_acb.logging_());
  const oracle = await deployProxy(
      Oracle_v5,
      [(await old_oracle.phase_id_()).toNumber()]);
  const acb = await deployProxy(
      ACB_v5, [coin.address, bond.address, old_oracle.address,
               oracle.address, logging.address,
               await old_acb.bond_budget_(),
               await old_acb.oracle_level_(),
               await old_acb.current_phase_start_()]);
  await old_acb.deprecate();

  await coin.transferOwnership(acb.address);
  await bond.transferOwnership(acb.address);
  await old_oracle.transferOwnership(acb.address);
  await oracle.transferOwnership(acb.address);
  await logging.transferOwnership(acb.address);
  await acb.unpause();
  
  console.log("Oracle_v5 address: ", oracle.address);
  console.log("ACB_v5 address: ", acb.address);
};