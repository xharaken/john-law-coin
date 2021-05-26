// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

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
