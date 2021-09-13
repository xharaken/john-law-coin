// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const common = require("./common.js");
const sleep = common.sleep;

const Oracle_v3 = artifacts.require("Oracle_v3");
const ACB_v2 = artifacts.require("ACB_v2");
const ACB_v3 = artifacts.require("ACB_v3");

const ACB_ADDRESS = ACB_v2.address; // Update the value before testing.

module.exports = async function (deployer) {
  const old_acb = await ACB_v2.at(ACB_ADDRESS);
  await old_acb.pause();
  
  await sleep(10000); console.log("a");
  const oracle = await upgradeProxy(await old_acb.oracle_v2_(), Oracle_v3);
  await sleep(10000); console.log("b");
  const acb = await upgradeProxy(old_acb.address, ACB_v3);
  await sleep(10000); console.log("c");
  await acb.upgrade(oracle.address);
  await sleep(10000); console.log("d");
  await acb.unpause();
  
  console.log("Oracle_v3 address: ", oracle.address);
  console.log("ACB_v3 address: ", acb.address);
};
