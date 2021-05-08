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
const JohnLawCoin_v2 = artifacts.require("JohnLawCoin_v2");
const JohnLawBond_v2 = artifacts.require("JohnLawBond_v2");
const Logging = artifacts.require("Logging");
const ACB_v3 = artifacts.require("ACB_v3");
const ACB_v4 = artifacts.require("ACB_v4");

module.exports = async function (deployer) {
  const old_acb = await ACB_v3.at(ACB_v3.address);
  const coin = await JohnLawCoin_v2.at(await old_acb.coin_());
  const bond = await JohnLawBond_v2.at(await old_acb.bond_());
  const oracle = await Oracle_v2.at(await old_acb.oracle_());
  const logging = await Logging.at(await old_acb.logging_());
  const acb = await deployProxy(
      ACB_v4, [coin.address, bond.address, oracle.address, logging.address,
               await old_acb.bond_budget_(),
               await old_acb.oracle_level_(),
               await old_acb.current_phase_start_()]);
  await old_acb.deprecate();

  await coin.transferOwnership(acb.address);
  await bond.transferOwnership(acb.address);
  await oracle.transferOwnership(acb.address);
  await logging.transferOwnership(acb.address);
  console.log("ACB_v4 address: ", acb.address);
};
