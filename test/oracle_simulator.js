// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");
const Oracle = artifacts.require("Oracle");
const OracleForTesting = artifacts.require("OracleForTesting");
const common = require("./common.js");
const should_throw = common.should_throw;
const mod = common.mod;
const randint = common.randint;

contract("OracleSimulator", function (accounts) {
  let args = common.custom_arguments();
  assert.isTrue(args.length == 5);
  parameterized_test(accounts,
                     args[0],
                     args[1],
                     args[2],
                     args[3],
                     args[4]);
});

function parameterized_test(accounts,
                            _level_max,
                            _reclaim_threshold,
                            _proportional_reward_rate,
                            _voter_count,
                            _iteration) {
  let test_name = "Oracle parameters: " + "level_max=" + _level_max +
      " reclaim=" + _reclaim_threshold +
      " prop=" + _proportional_reward_rate +
      " voter_count=" + _voter_count +
      " iteration=" + _iteration;
  console.log(test_name);
  assert.isTrue(_voter_count <= accounts.length - 1);

  it(test_name, async function () {
    let _prev_tax = 0;
    let _coin = await deployProxy(JohnLawCoin, []);
    let _oracle = await deployProxy(OracleForTesting, []);
    await _oracle.overrideConstants(_level_max, _reclaim_threshold,
                                    _proportional_reward_rate);
    common.print_contract_size(_oracle, "OracleForTesting");

    let initial_coin_supply = (await _coin.totalSupply()).toNumber();

    for (let iter = 0; iter < _iteration; iter++) {
      console.log(iter);
      let voters = [];
      for (let i = 0; i < _voter_count; i++) {
        let voter = {
          address: accounts[i + 1],
          committed: false,
          deposit: 0,
          committed_level: 0,
          committed_salt: 0,
          committed_correctly: false,
          revealed: false,
          revealed_correctly: false,
          oracle_level: 0,
          salt: 0,
          reclaimed: false
        };
        voters.push(voter);
      }

      for (let i = 0; i < voters.length; i++) {
        assert.equal(voters[i].address, accounts[i + 1]);
        voters[i].committed = (randint(0, 99) < 95);
        if (voters[i].committed) {
          voters[i].deposit = randint(0, 10);
          voters[i].committed_level = randint(0, _level_max);
          voters[i].committed_salt = randint(0, 10);
          await _coin.mint(voters[i].address, voters[i].deposit);
          await check_commit(
              voters[i].address,
              await _oracle.encrypt(voters[i].address,
                                 voters[i].committed_level,
                                 voters[i].committed_salt),
              voters[i].deposit);

          assert.equal(await _coin.balanceOf(voters[i].address), 0);
          voters[i].committed_correctly = true;

          assert.equal(await _oracle.commit.call(
              _coin.address, voters[i].address,
              await _oracle.encrypt(voters[i].address,
                                 voters[i].committed_level,
                                 voters[i].committed_salt),
              0), false);
        }
      }

      let tax = randint(0, 200);
      await _coin.mint(await _coin.tax_account_(), tax);
      await check_advance(tax, _prev_tax);
      _prev_tax = tax;

      for (let i = 0; i < voters.length; i++) {
        assert.equal(voters[i].address, accounts[i + 1]);
        voters[i].revealed = (randint(0, 99) < 95);
        if (voters[i].revealed) {
          if (randint(0, 99) < 95) {
            voters[i].oracle_level = voters[i].committed_level;
          } else {
            voters[i].oracle_level = randint(0, _level_max);
          }
          if (randint(0, 99) < 95) {
            voters[i].salt = voters[i].committed_salt;
          } else {
            voters[i].salt = randint(0, 10);
          }
          voters[i].revealed_correctly = (
              voters[i].committed_correctly &&
                voters[i].oracle_level == voters[i].committed_level &&
                0 <= voters[i].oracle_level &&
                voters[i].oracle_level < _level_max &&
                voters[i].salt == voters[i].committed_salt);
          if (voters[i].revealed_correctly) {
            await check_reveal(voters[i].address,
                               voters[i].oracle_level,
                               voters[i].salt);
          }
          assert.equal(await _oracle.reveal.call(
              voters[i].address, voters[i].oracle_level,
              voters[i].salt), false);
        }
      }

      let deposits = [];
      let counts = [];
      for (let level = 0; level < _level_max; level++) {
        deposits.push(0);
        counts.push(0);
      }
      let deposit_total = 0;
      for (let i = 0; i < voters.length; i++) {
        if (voters[i].committed_correctly) {
          deposit_total += voters[i].deposit;
        }
        if (voters[i].revealed_correctly) {
          deposits[voters[i].oracle_level] += voters[i].deposit;
          counts[voters[i].oracle_level] += 1;
        }
      }

      let max_deposit = 0;
      let max_count = 0;
      let mode_level = _level_max;
      for (let level = 0; level < _level_max; level++) {
        if (counts[level] > 0 &&
            (mode_level == _level_max ||
             max_deposit < deposits[level] ||
             (max_deposit == deposits[level] &&
              max_count < counts[level]))) {
          max_deposit = deposits[level];
          max_count = counts[level];
          mode_level = level;
        }
      }

      tax = randint(0, 200);
      let deposit_to_reclaim = 0;
      if (mode_level == _level_max) {
        reward_total = deposit_total + tax;
      } else {
        for (let level = 0; level < _level_max; level++) {
          if (mode_level - _reclaim_threshold <= level &&
              level <= mode_level + _reclaim_threshold) {
            deposit_to_reclaim += deposits[level];
          }
        }
        reward_total = deposit_total - deposit_to_reclaim + tax;
      }
      assert.equal(deposit_to_reclaim + reward_total,
                   deposit_total + tax);

      await _coin.mint(await _coin.tax_account_(), tax);
      await check_advance(tax, _prev_tax);
      assert.equal(await _oracle.getModeLevel(), mode_level);
      _prev_tax = tax;

      let reclaim_total = 0;
      for (let i = 0; i < voters.length; i++) {
        assert.equal(voters[i].address, accounts[i + 1]);
        voters[i].reclaimed = (randint(0, 99) < 95);
        if (voters[i].reclaimed) {
          assert.equal(await _coin.balanceOf(voters[i].address), 0);
          let reclaimed = 0;
          let reward = 0;
          let should_reclaim = false;
          if ((voters[i].revealed_correctly &&
               voters[i].oracle_level == mode_level)) {
            assert.notEqual(mode_level, _level_max);
            if (deposits[mode_level] > 0) {
              reward += Math.trunc(
                  (_proportional_reward_rate * reward_total *
                   voters[i].deposit) / (100 * deposits[mode_level]));
            }
            reward += Math.trunc(
                ((100 - _proportional_reward_rate) * reward_total) /
                  (100 * counts[mode_level]));
            reclaimed = voters[i].deposit
            should_reclaim = true;
          } else if (voters[i].revealed_correctly &&
                     mode_level - _reclaim_threshold <=
                     voters[i].oracle_level &&
                     voters[i].oracle_level <=
                     mode_level + _reclaim_threshold) {
            assert.notEqual(mode_level, _level_max);
            reclaimed = voters[i].deposit;
            should_reclaim = true;
          }
          if (should_reclaim) {
            await check_reclaim(voters[i].address, reclaimed, reward);
          }
          common.array_equal(await _oracle.reclaim.call(
              _coin.address, voters[i].address), [0, 0]);
          reclaim_total += reclaimed + reward;
          assert.equal(await _coin.balanceOf(voters[i].address),
                       reclaimed + reward);
          await _coin.burn(voters[i].address, reclaimed + reward);
        }
      }

      assert.equal(deposit_to_reclaim + reward_total, deposit_total + tax);
      let remainder = deposit_total + tax - reclaim_total;
      tax = randint(0, 200);
      await _coin.mint(await _coin.tax_account_(), tax);
      await check_advance(tax, remainder);
      _prev_tax = tax;

      assert.equal(await _coin.totalSupply(), _prev_tax + initial_coin_supply);
    }

    async function check_commit(account, hash, deposit) {
      await _coin.transferOwnership(_oracle.address);
      let receipt =
          await _oracle.commit(_coin.address, account, hash, deposit);
      await _oracle.revokeOwnership(_coin.address);
      let args = receipt.logs.filter(e => e.event == 'CommitEvent')[0].args;
      assert.equal(args.sender, account);
      assert.equal(args.hash, hash);
      assert.equal(args.deposited, deposit);
    }

    async function check_reveal(account, level, salt) {
      let receipt = await _oracle.reveal(account, level, salt);
      let args = receipt.logs.filter(e => e.event == 'RevealEvent')[0].args;
      assert.equal(args.sender, account);
      assert.equal(args.oracle_level, level);
      assert.equal(args.salt, salt);
    }

    async function check_reclaim(account, reclaimed, reward) {
      await _coin.transferOwnership(_oracle.address);
      let receipt = await _oracle.reclaim(_coin.address, account);
      await _oracle.revokeOwnership(_coin.address);
      let args = receipt.logs.filter(e => e.event == 'ReclaimEvent')[0].args;
      assert.equal(args.sender, account);
      assert.equal(args.reclaimed, reclaimed);
      assert.equal(args.rewarded, reward);
    }

    async function check_advance(tax, burned) {
      await _coin.transferOwnership(_oracle.address);
      let receipt = await _oracle.advance(_coin.address);
      await _oracle.revokeOwnership(_coin.address);
      let args = receipt.logs.filter(
          e => e.event == 'AdvancePhaseEvent')[0].args;
      assert.isTrue(args.epoch_id >= 3);
      assert.equal(args.tax, tax);
      assert.equal(args.burned, burned);
    }

  });

}
