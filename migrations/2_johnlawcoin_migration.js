// Copyright 2021 Google LLC
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
  let oracle = await deployProxy(
      Oracle, [],
      {deployer: deployer, unsafeAllowCustomTypes: true});
  let logging = await Logging.new();
  let acb = await deployProxy(
      ACB, [oracle.address, logging.address],
      {deployer: deployer, unsafeAllowCustomTypes: true});
  await oracle.transferOwnership(acb.address);
  await logging.transferOwnership(acb.address);
  console.log("ACB address: ", acb.address);
  console.log("Oracle address: ", oracle.address);
  console.log("Logging address: ", logging.address);
  console.log("JohnLawCoin address: ", await acb.coin_());
  console.log("JohnLawBond address: ", await acb.bond_());
};
