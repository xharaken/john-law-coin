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

const Logging = artifacts.require("Logging");
const common = require("./common.js");
const should_throw = common.should_throw;

contract("LoggingUnittest", function (accounts) {
  it("Logging", async function () {
    _logging = await Logging.new();
    common.print_contract_size(_logging, "Logging");

    assert.equal(await _logging.log_index_(), 0);
    let acb_log = await get_acb_logs(await _logging.log_index_());
    assert.equal(acb_log.current_phase_start, 0);
    assert.equal(acb_log.bond_budget, 0);
    assert.equal(acb_log.coin_supply_delta, 0);
    assert.equal(acb_log.oracle_level, 0);
    assert.equal(acb_log.minted_coins, 0);
    assert.equal(acb_log.burned_coins, 0);
    assert.equal(acb_log.coin_total_supply, 0);
    assert.equal(acb_log.bond_total_supply, 0);
    assert.equal(acb_log.purchased_bonds, 0);
    assert.equal(acb_log.redeemed_bonds, 0);
    let vote_log = await get_vote_logs(await _logging.log_index_());
    assert.equal(vote_log.commit_succeeded, 0);
    assert.equal(vote_log.deposited, 0);
    assert.equal(vote_log.commit_failed, 0);
    assert.equal(vote_log.reveal_succeeded, 0);
    assert.equal(vote_log.reveal_failed, 0);
    assert.equal(vote_log.reclaim_succeeded, 0);
    assert.equal(vote_log.reward_succeeded, 0);
    assert.equal(vote_log.reclaimed, 0);
    assert.equal(vote_log.rewarded, 0);

    const log_max = 1000;
    for (let i = 0; i < log_max + 10; i++) {
      await _logging.phaseUpdated(1, 2, 3, 4, 5, 6, 7, 8);
      if (i >= 5 && i < log_max - 5) {
        continue;
      }
      await _logging.purchasedBonds(1);
      await _logging.purchasedBonds(2);
      await _logging.purchasedBonds(3);
      await _logging.redeemedBonds(1);
      await _logging.redeemedBonds(2);
      await _logging.redeemedBonds(3);
      await _logging.redeemedBonds(4);
      assert.equal(await _logging.log_index_(), (i + 1) % log_max);
      acb_log = await get_acb_logs(await _logging.log_index_());
      assert.equal(acb_log.current_phase_start, 1);
      assert.equal(acb_log.bond_budget, 2);
      assert.equal(acb_log.coin_supply_delta, 3);
      assert.equal(acb_log.oracle_level, 4);
      assert.equal(acb_log.minted_coins, 5);
      assert.equal(acb_log.burned_coins, 6);
      assert.equal(acb_log.coin_total_supply, 7);
      assert.equal(acb_log.bond_total_supply, 8);
      assert.equal(acb_log.purchased_bonds, 6);
      assert.equal(acb_log.redeemed_bonds, 10);

      await _logging.voted(false, false, 0, 0, 0);
      vote_log = await get_vote_logs(await _logging.log_index_());
      assert.equal(vote_log.commit_succeeded, 0);
      assert.equal(vote_log.deposited, 0);
      assert.equal(vote_log.commit_failed, 1);
      assert.equal(vote_log.reveal_succeeded, 0);
      assert.equal(vote_log.reveal_failed, 1);
      assert.equal(vote_log.reclaim_succeeded, 0);
      assert.equal(vote_log.reward_succeeded, 0);
      assert.equal(vote_log.reclaimed, 0);
      assert.equal(vote_log.rewarded, 0);

      await _logging.voted(false, true, 0, 0, 0);
      vote_log = await get_vote_logs(await _logging.log_index_());
      assert.equal(vote_log.commit_succeeded, 0);
      assert.equal(vote_log.deposited, 0);
      assert.equal(vote_log.commit_failed, 2);
      assert.equal(vote_log.reveal_succeeded, 1);
      assert.equal(vote_log.reveal_failed, 1);
      assert.equal(vote_log.reclaim_succeeded, 0);
      assert.equal(vote_log.reward_succeeded, 0);
      assert.equal(vote_log.reclaimed, 0);
      assert.equal(vote_log.rewarded, 0);

      await _logging.voted(true, true, 10, 0, 0);
      vote_log = await get_vote_logs(await _logging.log_index_());
      assert.equal(vote_log.commit_succeeded, 1);
      assert.equal(vote_log.deposited, 10);
      assert.equal(vote_log.commit_failed, 2);
      assert.equal(vote_log.reveal_succeeded, 2);
      assert.equal(vote_log.reveal_failed, 1);
      assert.equal(vote_log.reclaim_succeeded, 0);
      assert.equal(vote_log.reward_succeeded, 0);
      assert.equal(vote_log.reclaimed, 0);
      assert.equal(vote_log.rewarded, 0);

      await _logging.voted(true, false, 10, 0, 0);
      vote_log = await get_vote_logs(await _logging.log_index_());
      assert.equal(vote_log.commit_succeeded, 2);
      assert.equal(vote_log.deposited, 20);
      assert.equal(vote_log.commit_failed, 2);
      assert.equal(vote_log.reveal_succeeded, 2);
      assert.equal(vote_log.reveal_failed, 2);
      assert.equal(vote_log.reclaim_succeeded, 0);
      assert.equal(vote_log.reward_succeeded, 0);
      assert.equal(vote_log.reclaimed, 0);
      assert.equal(vote_log.rewarded, 0);

      await _logging.voted(true, true, 10, 5, 6);
      vote_log = await get_vote_logs(await _logging.log_index_());
      assert.equal(vote_log.commit_succeeded, 3);
      assert.equal(vote_log.deposited, 30);
      assert.equal(vote_log.commit_failed, 2);
      assert.equal(vote_log.reveal_succeeded, 3);
      assert.equal(vote_log.reveal_failed, 2);
      assert.equal(vote_log.reclaim_succeeded, 1);
      assert.equal(vote_log.reward_succeeded, 1);
      assert.equal(vote_log.reclaimed, 5);
      assert.equal(vote_log.rewarded, 6);

      await _logging.voted(true, true, 10, 5, 6);
      vote_log = await get_vote_logs(await _logging.log_index_());
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
      await _logging.phaseUpdated(1, 2, 3, 4, 5, 6, 7, 8, {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _logging.voted(false, false, 0, 0, 0, {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _logging.purchasedBonds(1, {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _logging.redeemedBonds(1, {from: accounts[1]});
    }, "Ownable");
  });

  async function get_vote_logs(log_index) {
    const ret = await _logging.getVoteLog(log_index);
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

  async function get_acb_logs(log_index) {
    const ret = await _logging.getACBLog(log_index);
    let acb_log = {};
    acb_log.minted_coins = ret[0];
    acb_log.burned_coins = ret[1];
    acb_log.coin_supply_delta = ret[2];
    acb_log.bond_budget = ret[3];
    acb_log.purchased_bonds = ret[4];
    acb_log.redeemed_bonds = ret[5];
    acb_log.coin_total_supply = ret[6];
    acb_log.bond_total_supply = ret[7];
    acb_log.oracle_level = ret[8];
    acb_log.current_phase_start = ret[9];
    return acb_log;
  }
});
