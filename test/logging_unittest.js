// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy, upgradeProxy } =
      require('@openzeppelin/truffle-upgrades');

const Logging = artifacts.require("Logging");
const common = require("./common.js");
const should_throw = common.should_throw;

contract("LoggingUnittest", function (accounts) {
  it("Logging", async function () {
    _logging = await deployProxy(Logging, []);
    common.print_contract_size(_logging, "Logging");

    for (let epoch_id = 0; epoch_id < 30; epoch_id++) {
      await _logging.updateEpoch(epoch_id, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
      let epoch_log = await get_epoch_logs(epoch_id);
      assert.equal(epoch_log.minted_coins, 1);
      assert.equal(epoch_log.burned_coins, 2);
      assert.equal(epoch_log.coin_supply_delta, 3);
      assert.equal(epoch_log.bond_budget, 4);
      assert.equal(epoch_log.total_coin_supply, 5);
      assert.equal(epoch_log.total_bond_supply, 6);
      assert.equal(epoch_log.valid_bond_supply, 7);
      assert.equal(epoch_log.oracle_level, 8);
      assert.equal(epoch_log.current_epoch_start, 9);
      assert.equal(epoch_log.tax, 10);

      await _logging.purchaseBonds(epoch_id, 1);
      await _logging.purchaseBonds(epoch_id, 2);
      await _logging.purchaseBonds(epoch_id, 3);
      await _logging.redeemBonds(epoch_id, 1, 10);
      await _logging.redeemBonds(epoch_id, 2, 20);
      await _logging.redeemBonds(epoch_id, 3, 30);
      await _logging.redeemBonds(epoch_id, 4, 40);
      let bond_log = await get_bond_logs(epoch_id);
      assert.equal(bond_log.purchased_bonds, 6);
      assert.equal(bond_log.redeemed_bonds, 10);
      assert.equal(bond_log.expired_bonds, 100);
      
      await _logging.vote(epoch_id, false, false, 0, 0, 0);
      let vote_log = await get_vote_logs(epoch_id);
      assert.equal(vote_log.commit_succeeded, 0);
      assert.equal(vote_log.deposited, 0);
      assert.equal(vote_log.commit_failed, 1);
      assert.equal(vote_log.reveal_succeeded, 0);
      assert.equal(vote_log.reveal_failed, 1);
      assert.equal(vote_log.reclaim_succeeded, 0);
      assert.equal(vote_log.reward_succeeded, 0);
      assert.equal(vote_log.reclaimed, 0);
      assert.equal(vote_log.rewarded, 0);

      await _logging.vote(epoch_id, false, true, 0, 0, 0);
      vote_log = await get_vote_logs(epoch_id);
      assert.equal(vote_log.commit_succeeded, 0);
      assert.equal(vote_log.deposited, 0);
      assert.equal(vote_log.commit_failed, 2);
      assert.equal(vote_log.reveal_succeeded, 1);
      assert.equal(vote_log.reveal_failed, 1);
      assert.equal(vote_log.reclaim_succeeded, 0);
      assert.equal(vote_log.reward_succeeded, 0);
      assert.equal(vote_log.reclaimed, 0);
      assert.equal(vote_log.rewarded, 0);

      await _logging.vote(epoch_id, true, true, 10, 0, 0);
      vote_log = await get_vote_logs(epoch_id);
      assert.equal(vote_log.commit_succeeded, 1);
      assert.equal(vote_log.deposited, 10);
      assert.equal(vote_log.commit_failed, 2);
      assert.equal(vote_log.reveal_succeeded, 2);
      assert.equal(vote_log.reveal_failed, 1);
      assert.equal(vote_log.reclaim_succeeded, 0);
      assert.equal(vote_log.reward_succeeded, 0);
      assert.equal(vote_log.reclaimed, 0);
      assert.equal(vote_log.rewarded, 0);

      await _logging.vote(epoch_id, true, false, 10, 0, 0);
      vote_log = await get_vote_logs(epoch_id);
      assert.equal(vote_log.commit_succeeded, 2);
      assert.equal(vote_log.deposited, 20);
      assert.equal(vote_log.commit_failed, 2);
      assert.equal(vote_log.reveal_succeeded, 2);
      assert.equal(vote_log.reveal_failed, 2);
      assert.equal(vote_log.reclaim_succeeded, 0);
      assert.equal(vote_log.reward_succeeded, 0);
      assert.equal(vote_log.reclaimed, 0);
      assert.equal(vote_log.rewarded, 0);

      await _logging.vote(epoch_id, true, true, 10, 5, 6);
      vote_log = await get_vote_logs(epoch_id);
      assert.equal(vote_log.commit_succeeded, 3);
      assert.equal(vote_log.deposited, 30);
      assert.equal(vote_log.commit_failed, 2);
      assert.equal(vote_log.reveal_succeeded, 3);
      assert.equal(vote_log.reveal_failed, 2);
      assert.equal(vote_log.reclaim_succeeded, 1);
      assert.equal(vote_log.reward_succeeded, 1);
      assert.equal(vote_log.reclaimed, 5);
      assert.equal(vote_log.rewarded, 6);

      await _logging.vote(epoch_id, true, true, 10, 5, 6);
      vote_log = await get_vote_logs(epoch_id);
      assert.equal(vote_log.commit_succeeded, 4);
      assert.equal(vote_log.deposited, 40);
      assert.equal(vote_log.commit_failed, 2);
      assert.equal(vote_log.reveal_succeeded, 4);
      assert.equal(vote_log.reveal_failed, 2);
      assert.equal(vote_log.reclaim_succeeded, 2);
      assert.equal(vote_log.reward_succeeded, 2);
      assert.equal(vote_log.reclaimed, 10);
      assert.equal(vote_log.rewarded, 12);
    }
  });

  it("Ownable", async function () {
    await should_throw(async () => {
      await _logging.initialize({from: accounts[1]});
    }, "Initializable");
    await should_throw(async () => {
      await _logging.updateEpoch(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
                                 {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _logging.vote(0, false, false, 0, 0, 0,
                          {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _logging.purchaseBonds(0, 1, {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _logging.redeemBonds(0, 1, 2, {from: accounts[1]});
    }, "Ownable");
  });

  async function get_vote_logs(epoch_id) {
    const ret = await _logging.getVoteLog(epoch_id);
    let vote_log = {};
    vote_log.commit_succeeded = ret[0];
    vote_log.commit_failed = ret[1];
    vote_log.reveal_succeeded = ret[2];
    vote_log.reveal_failed = ret[3];
    vote_log.reclaim_succeeded = ret[4];
    vote_log.reward_succeeded = ret[5];
    vote_log.deposited = ret[6];
    vote_log.reclaimed = ret[7];
    vote_log.rewarded = ret[8];
    return vote_log;
  }

  async function get_epoch_logs(epoch_id) {
    const ret = await _logging.getEpochLog(epoch_id);
    let epoch_log = {};
    epoch_log.minted_coins = ret[0];
    epoch_log.burned_coins = ret[1];
    epoch_log.coin_supply_delta = ret[2];
    epoch_log.bond_budget = ret[3];
    epoch_log.total_coin_supply = ret[4];
    epoch_log.total_bond_supply = ret[5];
    epoch_log.valid_bond_supply = ret[6];
    epoch_log.oracle_level = ret[7];
    epoch_log.current_epoch_start = ret[8];
    epoch_log.tax = ret[9];
    return epoch_log;
  }

  async function get_bond_logs(epoch_id) {
    const ret = await _logging.getBondLog(epoch_id);
    let bond_log = {};
    bond_log.purchased_bonds = ret[0];
    bond_log.redeemed_bonds = ret[1];
    bond_log.expired_bonds = ret[2];
    return bond_log;
  }
});
