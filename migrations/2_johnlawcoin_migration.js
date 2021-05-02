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

const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const Oracle = artifacts.require("Oracle");
const Logging = artifacts.require("Logging");
const ACB = artifacts.require("ACB");
const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");

module.exports = async function (deployer) {
  const coin = await deployProxy(JohnLawCoin, []);
  const bond = await deployProxy(JohnLawBond, []);
  const oracle = await deployProxy(
      Oracle, [],
      {deployer: deployer, unsafeAllowCustomTypes: true});
  const logging = await deployProxy(Logging, []);
  const acb = await deployProxy(
      ACB, [coin.address, bond.address, oracle.address, logging.address],
      {deployer: deployer, unsafeAllowCustomTypes: true});
  await coin.transferOwnership(acb.address);
  await bond.transferOwnership(acb.address);
  await oracle.transferOwnership(acb.address);
  await logging.transferOwnership(acb.address);
  console.log("JohnLawCoin address: ", coin.address);
  console.log("JohnLawBond address: ", bond.address);
  console.log("Oracle address: ", oracle.address);
  console.log("Logging address: ", logging.address);
  console.log("ACB address: ", acb.address);
};
