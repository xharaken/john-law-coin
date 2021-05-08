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
const Logging_v2 = artifacts.require("Logging_v2");
const ACB = artifacts.require("ACB");
const ACB_v2 = artifacts.require("ACB_v2");
const JohnLawCoin_v2 = artifacts.require("JohnLawCoin_v2");
const JohnLawBond_v2 = artifacts.require("JohnLawBond_v2");

module.exports = async function (deployer) {
  const old_acb = await ACB.at(ACB.address);
  const coin = await upgradeProxy(await old_acb.coin_(), JohnLawCoin_v2);
  const bond = await upgradeProxy(await old_acb.bond_(), JohnLawBond_v2);
  const oracle = await upgradeProxy(await old_acb.oracle_(), Oracle_v2);
  const logging = await upgradeProxy(await old_acb.logging_(), Logging_v2);
  const acb = await upgradeProxy(old_acb.address, ACB_v2);
  await acb.upgrade(
      coin.address, bond.address, oracle.address, logging.address);
  console.log("JohnLawCoin_v2 address: ", coin.address);
  console.log("JohnLawBond_v2 address: ", bond.address);
  console.log("Oracle_v2 address: ", oracle.address);
  console.log("Logging_v2 address: ", logging.address);
  console.log("ACB_v2 address: ", acb.address);
};
