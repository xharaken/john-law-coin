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
const Oracle_v3 = artifacts.require("Oracle_v3");
const ACB_v2 = artifacts.require("ACB_v2");
const ACB_v3 = artifacts.require("ACB_v3");

module.exports = async function (deployer) {
  const old_acb = await ACB_v2.at(ACB_v2.address);
  const oracle = await upgradeProxy(await old_acb.oracle_(), Oracle_v3);
  const acb = await upgradeProxy(old_acb.address, ACB_v3);
  await acb.upgrade(oracle.address);
  console.log("Oracle_v3 address: ", oracle.address);
  console.log("ACB_v3 address: ", acb.address);
};
