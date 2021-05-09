// Copyright 2021 Kentaro Hara
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const Oracle_v2 = artifacts.require("Oracle_v2");
const Oracle_v5 = artifacts.require("Oracle_v5");
const JohnLawCoin_v2 = artifacts.require("JohnLawCoin_v2");
const JohnLawBond_v2 = artifacts.require("JohnLawBond_v2");
const Logging = artifacts.require("Logging");
const ACB_v4 = artifacts.require("ACB_v4");
const ACB_v5 = artifacts.require("ACB_v5");

module.exports = async function (deployer) {
  const old_acb = await ACB_v4.at(ACB_v4.address);
  const coin = await JohnLawCoin_v2.at(await old_acb.coin_());
  const bond = await JohnLawBond_v2.at(await old_acb.bond_());
  const old_oracle = await Oracle_v2.at(await old_acb.oracle_());
  const logging = await Logging.at(await old_acb.logging_());
  const oracle = await deployProxy(
      Oracle_v5,
      [(await old_oracle.phase_id_()).toNumber() + 1]);
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
  console.log("Oracle_v5 address: ", oracle.address);
  console.log("ACB_v5 address: ", acb.address);
};
