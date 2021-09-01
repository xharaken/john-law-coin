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
const array_equal = common.array_equal;
const mod = common.mod;

contract("OracleUnittest", function (accounts) {
  let args = common.custom_arguments();
  assert.isTrue(args.length == 7);
  parameterized_test(accounts,
                     args[0],
                     args[1],
                     args[2],
                     args[3],
                     args[4],
                     args[5],
                     args[6]);
});

function parameterized_test(accounts,
                            _level_max,
                            _reclaim_threshold,
                            _proportional_reward_rate,
                            _tax,
                            _deposit,
                            _mode_level,
                            _other_level) {
  let test_name = "Oracle parameters: " + "level_max=" + _level_max +
      " reclaim=" + _reclaim_threshold +
      " prop=" + _proportional_reward_rate +
      " tax=" + _tax + " deposit=" + _deposit +
      " mode_level=" + _mode_level + " other_level=" + _other_level;
  console.log(test_name);
  
  it(test_name, async function () {
    assert.isTrue(_tax >= 0);
    assert.isTrue(_deposit >= 0);
    assert.isTrue(0 <= _mode_level && _mode_level < _level_max);
    assert.isTrue(0 <= _other_level && _other_level < _level_max);
    assert.isTrue(_mode_level != _other_level);
    
    let _coin = await deployProxy(JohnLawCoin, []);
    let _oracle = await deployProxy(OracleForTesting, []);
    await _oracle.overrideConstants(_level_max, _reclaim_threshold,
                                    _proportional_reward_rate);
    common.print_contract_size(_oracle, "OracleForTesting");
    
    let current = await get_current([accounts[2]]);
    for (let i = 0; i < 3; i++) {
      assert.isTrue(current.epochs[i].votes.length >= _level_max);
    }
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epoch_id % 3, 0);
    
    await should_throw(async () => {
      await _oracle.advance(-1);
    }, "invalid");
    
    // no commit -> no reveal -> no reclaim
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(0);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply + _tax);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, 0);
    assert.equal(current.epochs[1].deposit_balance, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, _tax);
    assert.equal(current.epochs[2].deposit_balance, 0);
    assert.equal(current.epochs[2].reward_total, _tax);
    
    await should_throw(async () => {
      await _oracle.reveal.call(accounts[1], -1, 1111);
    }, "out-of-bounds");
    
    assert.equal((await _oracle.reveal.call(accounts[1], 0, 1111)), false);
    assert.equal((await _oracle.reveal.call(accounts[1], 0, 1111)), false);
    assert.equal((await _oracle.reveal.call(
      accounts[1], _level_max, 1111)), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, _tax);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, _tax);
    assert.equal(current.epochs[1].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, 0);
    assert.equal(current.epochs[1].deposit_balance, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, 0);
    assert.equal(current.epochs[2].deposit_balance, 0);
    assert.equal(current.epochs[2].reward_total, 0);
    
    array_equal(await _oracle.reclaim.call(accounts[1], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[1], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, _tax);
    assert.equal(current.epochs[1].deposit_balance, 0);
    assert.equal(current.epochs[1].reward_total, _tax);
    assert.equal(current.epochs[2].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, 0);
    assert.equal(current.epochs[2].deposit_balance, 0);
    assert.equal(current.epochs[2].reward_total, 0);
    
    // 1 commit -> 1 reveal -> 1 reclaim
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    assert.equal(
      await _oracle.commit.call(
        accounts[1],
        await _oracle.encrypt(accounts[1], _mode_level, 1111),
        _deposit + 1, _coin.address), false);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    assert.equal(
      await _oracle.commit.call(
        accounts[1],
        await _oracle.encrypt(accounts[1], _mode_level, 1111),
        _deposit, _coin.address), false);
    assert.equal(
      await _oracle.commit.call(
        accounts[1],
        await _oracle.encrypt(accounts[1], 0, 1111),
        _deposit, _coin.address), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, 0);
    assert.equal(current.epochs[1].deposit_balance, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, _tax);
    assert.equal(current.epochs[2].deposit_balance, 0);
    assert.equal(current.epochs[2].reward_total, _tax);
    
    assert.equal(await _oracle.reveal.call(
      accounts[1], _level_max, 1111), false);
    assert.equal(await _oracle.reveal.call(accounts[2], 0, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(accounts[1], 0, 1111), false);
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level, 1111), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 1);
    assert.equal(current.epochs[0].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit);
        assert.equal(vote.should_reward, true);
        assert.equal(vote.should_reclaim, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[0].reward_balance, _tax);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit);
    assert.equal(current.epochs[0].reward_total, _tax);
    assert.equal(current.epochs[1].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, 0);
    assert.equal(current.epochs[1].deposit_balance, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, 0);
    assert.equal(current.epochs[2].deposit_balance, 0);
    assert.equal(current.epochs[2].reward_total, 0);
    
    reclaim_amount = _deposit + get_reward(_tax, 1);
    balance = await balance_of(accounts[1]);
    await check_reclaim(accounts[1], _deposit, get_reward(_tax, 1));
    assert.equal(await balance_of(accounts[1]), balance + reclaim_amount);
    array_equal(await _oracle.reclaim.call(accounts[1], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[2], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax - get_reward(_tax, 1) * 1);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply + get_reward(_tax, 1) * 1);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, _tax);
    assert.equal(current.epochs[1].deposit_balance, 0);
    assert.equal(current.epochs[1].reward_total, _tax);
    assert.equal(current.epochs[2].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, 0);
    assert.equal(current.epochs[2].deposit_balance, 0);
    assert.equal(current.epochs[2].reward_total, 0);
    
    // 1 commit -> 1 reveal -> 1 reclaim
    //             1 commit -> 1 reveal -> 1 reclaim
    //                         1 commit -> 1 reveal -> 1 reclaim
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, 0);
    assert.equal(current.epochs[1].deposit_balance, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, _tax);
    assert.equal(current.epochs[2].deposit_balance, 0);
    assert.equal(current.epochs[2].reward_total, _tax);
    
    await check_reveal(accounts[1], _mode_level, 1111);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 1);
    assert.equal(current.epochs[0].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit);
        assert.equal(vote.should_reward, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[0].reward_balance, _tax);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit);
    assert.equal(current.epochs[0].reward_total, _tax);
    assert.equal(current.epochs[1].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[1].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[1].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[1].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, 0);
    assert.equal(current.epochs[1].deposit_balance,
                 _deposit);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, 0);
    assert.equal(current.epochs[2].deposit_balance, 0);
    assert.equal(current.epochs[2].reward_total, 0);
    
    reclaim_amount = _deposit + get_reward(_tax, 1);
    balance = await balance_of(accounts[1]);
    await check_reclaim(accounts[1], _deposit, get_reward(_tax, 1));
    assert.equal(await balance_of(accounts[1]), balance + reclaim_amount);
    
    await check_reveal(accounts[1], _mode_level, 1111);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax - get_reward(_tax, 1) * 1);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply + get_reward(_tax, 1) * 1);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[1].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111))
    assert.equal(current.epochs[1].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[1].commits[accounts[1]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].votes[_mode_level].count, 1);
    assert.equal(current.epochs[1].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[1].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit);
        assert.equal(vote.should_reward, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[1].reward_balance, _tax);
    assert.equal(current.epochs[1].deposit_balance,
                 _deposit);
    assert.equal(current.epochs[1].reward_total, _tax);
    assert.equal(current.epochs[2].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[2].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[2].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[2].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, 0);
    assert.equal(current.epochs[2].deposit_balance,
                 _deposit);
    assert.equal(current.epochs[2].reward_total, 0);
    
    reclaim_amount = _deposit + get_reward(_tax, 1);
    balance = await balance_of(accounts[1]);
    await check_reclaim(accounts[1], _deposit, get_reward(_tax, 1));
    assert.equal(await balance_of(accounts[1]), balance + reclaim_amount);
    
    await check_reveal(accounts[1], _mode_level, 1111);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax - get_reward(_tax, 1) * 1);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply + get_reward(_tax, 1) * 1);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, 0);
    assert.equal(current.epochs[1].deposit_balance, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[2].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[2].commits[accounts[1]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].votes[_mode_level].count, 1);
    assert.equal(current.epochs[2].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[2].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit);
        assert.equal(vote.should_reward, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[2].reward_balance, _tax);
    assert.equal(current.epochs[2].deposit_balance,
                 _deposit);
    assert.equal(current.epochs[2].reward_total, _tax);
    
    reclaim_amount = _deposit + get_reward(_tax, 1);
    balance = await balance_of(accounts[1]);
    await check_reclaim(accounts[1], _deposit, get_reward(_tax, 1));
    assert.equal(await balance_of(accounts[1]), balance + reclaim_amount);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax - get_reward(_tax, 1) * 1);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply + get_reward(_tax, 1) * 1);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, _tax);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, _tax);
    assert.equal(current.epochs[1].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_balance, 0);
    assert.equal(current.epochs[1].deposit_balance, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_balance, 0);
    assert.equal(current.epochs[2].deposit_balance, 0);
    assert.equal(current.epochs[2].reward_total, 0);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    
    // 6 commits on the mode ->
    // 6 reveals on the mode ->
    // full reclaim
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    await _coin.mint(accounts[2], _deposit);
    balance = await balance_of(accounts[2]);
    await check_commit(accounts[2],
                       await _oracle.encrypt(accounts[2], _mode_level, 2222),
                       _deposit);
    assert.equal(await balance_of(accounts[2]), balance - _deposit);
    await _coin.mint(accounts[3], _deposit);
    balance = await balance_of(accounts[3]);
    await check_commit(accounts[3],
                       await _oracle.encrypt(accounts[3], _mode_level, 3333),
                       _deposit);
    assert.equal(await balance_of(accounts[3]), balance - _deposit);
    await _coin.mint(accounts[4], _deposit);
    balance = await balance_of(accounts[4]);
    await check_commit(accounts[4],
                       await _oracle.encrypt(accounts[4], _mode_level, 4444),
                       _deposit);
    assert.equal(await balance_of(accounts[4]), balance - _deposit);
    await _coin.mint(accounts[5], _deposit);
    balance = await balance_of(accounts[5]);
    await check_commit(accounts[5],
                       await _oracle.encrypt(accounts[5], _mode_level, 5555),
                       _deposit);
    assert.equal(await balance_of(accounts[5]), balance - _deposit);
    await _coin.mint(accounts[6], _deposit);
    balance = await balance_of(accounts[6]);
    await check_commit(accounts[6],
                       await _oracle.encrypt(accounts[6], _mode_level, 6666),
                       _deposit);
    assert.equal(await balance_of(accounts[6]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].hash,
                 await _oracle.encrypt(accounts[2], _mode_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].hash,
                 await _oracle.encrypt(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].hash,
                 await _oracle.encrypt(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].hash,
                 await _oracle.encrypt(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].hash,
                 await _oracle.encrypt(accounts[6], _mode_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);
    
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _mode_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _mode_level, 6666);
    assert.equal(await _oracle.reveal.call(
      accounts[7], _mode_level, 7777), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 6);
    assert.equal(current.epochs[0].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 6);
        assert.equal(vote.should_reward, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false)
      }
    }
    assert.equal(current.epochs[0].reward_balance,
                 _tax);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, _tax);
    
    
    reclaim_amount = _deposit + get_reward(_tax, 6);
    balance = await balance_of(accounts[6]);
    await check_reclaim(accounts[6], _deposit, get_reward(_tax, 6));
    assert.equal(await balance_of(accounts[6]), balance + reclaim_amount);
    balance = await balance_of(accounts[5]);
    await check_reclaim(accounts[5], _deposit, get_reward(_tax, 6));
    assert.equal(await balance_of(accounts[5]), balance + reclaim_amount);
    balance = await balance_of(accounts[4]);
    await check_reclaim(accounts[4], _deposit, get_reward(_tax, 6));
    assert.equal(await balance_of(accounts[4]), balance + reclaim_amount);
    balance = await balance_of(accounts[3]);
    await check_reclaim(accounts[3], _deposit, get_reward(_tax, 6));
    assert.equal(await balance_of(accounts[3]), balance + reclaim_amount);
    balance = await balance_of(accounts[2]);
    await check_reclaim(accounts[2], _deposit, get_reward(_tax, 6));
    assert.equal(await balance_of(accounts[2]), balance + reclaim_amount);
    balance = await balance_of(accounts[1]);
    await check_reclaim(accounts[1], _deposit, get_reward(_tax, 6));
    assert.equal(await balance_of(accounts[1]), balance + reclaim_amount);
    array_equal(await _oracle.reclaim.call(accounts[6], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[7], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax - get_reward(_tax, 6) * 6);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply + get_reward(_tax, 6) * 6);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    
    // 6 commits on the mode ->
    // 6 reveals on the mode ->
    // no reclaim
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    await _coin.mint(accounts[2], _deposit);
    balance = await balance_of(accounts[2]);
    await check_commit(accounts[2],
                       await _oracle.encrypt(accounts[2], _mode_level, 2222),
                       _deposit);
    assert.equal(await balance_of(accounts[2]), balance - _deposit);
    await _coin.mint(accounts[3], _deposit);
    balance = await balance_of(accounts[3]);
    await check_commit(accounts[3],
                       await _oracle.encrypt(accounts[3], _mode_level, 3333),
                       _deposit);
    assert.equal(await balance_of(accounts[3]), balance - _deposit);
    await _coin.mint(accounts[4], _deposit);
    balance = await balance_of(accounts[4]);
    await check_commit(accounts[4],
                       await _oracle.encrypt(accounts[4], _mode_level, 4444),
                       _deposit);
    assert.equal(await balance_of(accounts[4]), balance - _deposit);
    await _coin.mint(accounts[5], _deposit);
    balance = await balance_of(accounts[5]);
    await check_commit(accounts[5],
                       await _oracle.encrypt(accounts[5], _mode_level, 5555),
                       _deposit);
    assert.equal(await balance_of(accounts[5]), balance - _deposit);
    await _coin.mint(accounts[6], _deposit);
    balance = await balance_of(accounts[6]);
    await check_commit(accounts[6],
                       await _oracle.encrypt(accounts[6], _mode_level, 6666),
                       _deposit);
    assert.equal(await balance_of(accounts[6]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].hash,
                 await _oracle.encrypt(accounts[2], _mode_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].hash,
                 await _oracle.encrypt(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].hash,
                 await _oracle.encrypt(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].hash,
                 await _oracle.encrypt(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].hash,
                 await _oracle.encrypt(accounts[6], _mode_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);
    
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _mode_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _mode_level, 6666);
    assert.equal(await _oracle.reveal.call(
      accounts[7], _mode_level, 7777), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 6);
    assert.equal(current.epochs[0].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 6);
        assert.equal(vote.should_reward, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[0].reward_balance,
                 _tax);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, _tax);
    
    array_equal(await _oracle.reclaim.call(accounts[7], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax + _deposit * 6);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply - _deposit * 6);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    
    // 4 commits on the mode + 2 commits on the other level ->
    // 4 reveals on the mode + 2 reveals on the other level ->
    // full reclaim
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    await _coin.mint(accounts[2], _deposit);
    balance = await balance_of(accounts[2]);
    await check_commit(accounts[2],
                       await _oracle.encrypt(accounts[2], _other_level, 2222),
                       _deposit);
    assert.equal(await balance_of(accounts[2]), balance - _deposit);
    await _coin.mint(accounts[3], _deposit);
    balance = await balance_of(accounts[3]);
    await check_commit(accounts[3],
                       await _oracle.encrypt(accounts[3], _mode_level, 3333),
                       _deposit);
    assert.equal(await balance_of(accounts[3]), balance - _deposit);
    await _coin.mint(accounts[4], _deposit);
    balance = await balance_of(accounts[4]);
    await check_commit(accounts[4],
                       await _oracle.encrypt(accounts[4], _mode_level, 4444),
                       _deposit);
    assert.equal(await balance_of(accounts[4]), balance - _deposit);
    await _coin.mint(accounts[5], _deposit);
    balance = await balance_of(accounts[5]);
    await check_commit(accounts[5],
                       await _oracle.encrypt(accounts[5], _mode_level, 5555),
                       _deposit);
    assert.equal(await balance_of(accounts[5]), balance - _deposit);
    await _coin.mint(accounts[6], _deposit);
    balance = await balance_of(accounts[6]);
    await check_commit(accounts[6],
                       await _oracle.encrypt(accounts[6], _other_level, 6666),
                       _deposit);
    assert.equal(await balance_of(accounts[6]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].hash,
                 await _oracle.encrypt(accounts[2], _other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].hash,
                 await _oracle.encrypt(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].hash,
                 await _oracle.encrypt(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].hash,
                 await _oracle.encrypt(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].hash,
                 await _oracle.encrypt(accounts[6], _other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);
    
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _other_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _other_level, 6666);
    assert.equal(await _oracle.reveal.call(
      accounts[7], _mode_level, 7777), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 4);
    assert.equal(current.epochs[0].votes[_other_level].count, 2);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 4);
        assert.equal(vote.should_reward, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    
    reward_total = 0;
    deposit_total = 0;
    if (is_in_reclaim_threshold(_other_level)) {
      reward_total = _tax;
      deposit_total = _deposit * 6;
    } else {
      reward_total = _tax + _deposit * 2;
      deposit_total = _deposit * 4;
      assert.equal(current.epochs[0].reward_balance,
                   reward_total);
      assert.equal(current.epochs[0].deposit_balance,
                   deposit_total);
    }
    if (is_in_reclaim_threshold(_other_level)) {
      balance = await balance_of(accounts[2]);
      await check_reclaim(  accounts[2], _deposit, 0);
      assert.equal(await balance_of(accounts[2]), balance + _deposit);
      balance = await balance_of(accounts[6]);
      await check_reclaim(  accounts[6], _deposit, 0);
      assert.equal(await balance_of(accounts[6]), balance + _deposit);
    } else {
      array_equal(await _oracle.reclaim.call(
        accounts[2], _coin.address), [0, 0]);
      array_equal(await _oracle.reclaim.call(
        accounts[6], _coin.address), [0, 0]);
    }
    
    reclaim_amount = _deposit + get_reward(reward_total, 4);
    balance = await balance_of(accounts[5]);
    await check_reclaim(accounts[5], _deposit, get_reward(reward_total, 4));
    assert.equal(await balance_of(accounts[5]), balance + reclaim_amount);
    balance = await balance_of(accounts[4]);
    await check_reclaim(accounts[4], _deposit, get_reward(reward_total, 4));
    assert.equal(await balance_of(accounts[4]), balance + reclaim_amount);
    balance = await balance_of(accounts[3]);
    await check_reclaim(accounts[3], _deposit, get_reward(reward_total, 4));
    assert.equal(await balance_of(accounts[3]), balance + reclaim_amount);
    balance = await balance_of(accounts[1]);
    await check_reclaim(accounts[1], _deposit, get_reward(reward_total, 4));
    assert.equal(await balance_of(accounts[1]), balance + reclaim_amount);
    array_equal(await _oracle.reclaim.call(accounts[6], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[7], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(reward_total - get_reward(reward_total, 4) * 4);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply + _tax - reward_total +
                 get_reward(reward_total, 4) * 4);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    
    // 4 commits on the mode + 2 commits on the other level ->
    // 4 reveals on the mode + 2 reveals on the other level ->
    // no reclaim
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    await _coin.mint(accounts[2], _deposit);
    balance = await balance_of(accounts[2]);
    await check_commit(accounts[2],
                       await _oracle.encrypt(accounts[2], _other_level, 2222),
                       _deposit);
    assert.equal(await balance_of(accounts[2]), balance - _deposit);
    await _coin.mint(accounts[3], _deposit);
    balance = await balance_of(accounts[3]);
    await check_commit(accounts[3],
                       await _oracle.encrypt(accounts[3], _mode_level, 3333),
                       _deposit);
    assert.equal(await balance_of(accounts[3]), balance - _deposit);
    await _coin.mint(accounts[4], _deposit);
    balance = await balance_of(accounts[4]);
    await check_commit(accounts[4],
                       await _oracle.encrypt(accounts[4], _mode_level, 4444),
                       _deposit);
    assert.equal(await balance_of(accounts[4]), balance - _deposit);
    await _coin.mint(accounts[5], _deposit);
    balance = await balance_of(accounts[5]);
    await check_commit(accounts[5],
                       await _oracle.encrypt(accounts[5], _mode_level, 5555),
                       _deposit);
    assert.equal(await balance_of(accounts[5]), balance - _deposit);
    await _coin.mint(accounts[6], _deposit);
    balance = await balance_of(accounts[6]);
    await check_commit(accounts[6],
                       await _oracle.encrypt(accounts[6], _other_level, 6666),
                       _deposit);
    assert.equal(await balance_of(accounts[6]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].hash,
                 await _oracle.encrypt(accounts[2], _other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].hash,
                 await _oracle.encrypt(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].hash,
                 await _oracle.encrypt(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].hash,
                 await _oracle.encrypt(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].hash,
                 await _oracle.encrypt(accounts[6], _other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);
    
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _other_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _other_level, 6666);
    assert.equal(await _oracle.reveal.call(
      accounts[7], _mode_level, 7777), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 4);
    assert.equal(current.epochs[0].votes[_other_level].count, 2);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 4);
        assert.equal(vote.should_reward, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    
    reward_total = 0;
    deposit_total = 0;
    if (is_in_reclaim_threshold(_other_level)) {
      reward_total = _tax;
      deposit_total = _deposit * 6;
    } else {
      reward_total = _tax + _deposit * 2;
      deposit_total = _deposit * 4;
      assert.equal(current.epochs[0].reward_balance,
                   reward_total);
      assert.equal(current.epochs[0].deposit_balance,
                   deposit_total);
    }
    
    array_equal(await _oracle.reclaim.call(accounts[7], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax + _deposit * 6);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply - _deposit * 6);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    
    // 3 commits on the two modes ->
    // 3 reveals on the two modes ->
    // full reclaim
    real_mode_level = Math.min(_mode_level, _other_level);
    real_other_level = Math.max(_mode_level, _other_level);
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(
                         accounts[1], real_mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    await _coin.mint(accounts[2], _deposit);
    balance = await balance_of(accounts[2]);
    await check_commit(accounts[2],
                       await _oracle.encrypt(
                         accounts[2], real_other_level, 2222),
                       _deposit);
    assert.equal(await balance_of(accounts[2]), balance - _deposit);
    await _coin.mint(accounts[3], _deposit);
    balance = await balance_of(accounts[3]);
    await check_commit(accounts[3],
                       await _oracle.encrypt(
                         accounts[3], real_mode_level, 3333),
                       _deposit);
    assert.equal(await balance_of(accounts[3]), balance - _deposit);
    await _coin.mint(accounts[4], _deposit);
    balance = await balance_of(accounts[4]);
    await check_commit(accounts[4],
                       await _oracle.encrypt(
                         accounts[4], real_other_level, 4444),
                       _deposit);
    assert.equal(await balance_of(accounts[4]), balance - _deposit);
    await _coin.mint(accounts[5], _deposit);
    balance = await balance_of(accounts[5]);
    await check_commit(accounts[5],
                       await _oracle.encrypt(
                         accounts[5], real_mode_level, 5555),
                       _deposit);
    assert.equal(await balance_of(accounts[5]), balance - _deposit);
    await _coin.mint(accounts[6], _deposit);
    balance = await balance_of(accounts[6]);
    await check_commit(accounts[6],
                       await _oracle.encrypt(
                         accounts[6], real_other_level, 6666),
                       _deposit);
    assert.equal(await balance_of(accounts[6]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(
                   accounts[1], real_mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].hash,
                 await _oracle.encrypt(
                   accounts[2], real_other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].hash,
                 await _oracle.encrypt(
                   accounts[3], real_mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].hash,
                 await _oracle.encrypt(
                   accounts[4], real_other_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].hash,
                 await _oracle.encrypt(
                   accounts[5], real_mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].hash,
                 await _oracle.encrypt(
                   accounts[6], real_other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);
    
    assert.equal(await _oracle.reveal.call(
      accounts[1], real_mode_level + 100, 1111), false);
    await check_reveal(accounts[1], real_mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
      accounts[1], real_mode_level, 1111), false);
    await check_reveal(accounts[2], real_other_level, 2222);
    await check_reveal(accounts[3], real_mode_level, 3333);
    await check_reveal(accounts[4], real_other_level, 4444);
    await check_reveal(accounts[5], real_mode_level, 5555);
    await check_reveal(accounts[6], real_other_level, 6666);
    assert.equal(await _oracle.reveal.call(
      accounts[7], real_mode_level, 7777), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, real_mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 real_other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 real_other_level);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 real_other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 3);
    assert.equal(current.epochs[0].votes[_other_level].count, 3);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == real_mode_level) {
        assert.equal(vote.deposit, _deposit * 3);
        assert.equal(vote.should_reward, true);
      } else if (real_mode_level - _reclaim_threshold <= level &&
                 level <= real_mode_level + _reclaim_threshold) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    
    reward_total = 0;
    deposit_total = 0;
    if (real_mode_level - _reclaim_threshold <= real_other_level &&
        real_other_level <= real_mode_level + _reclaim_threshold) {
      reward_total = _tax;
      deposit_total = _deposit * 6;
    } else {
      reward_total = _tax + _deposit * 3;
      deposit_total = _deposit * 3;
      assert.equal(current.epochs[0].reward_balance,
                   reward_total);
      assert.equal(current.epochs[0].deposit_balance,
                   deposit_total);
    }
    
    if (real_mode_level - _reclaim_threshold <= real_other_level &&
        real_other_level <= real_mode_level + _reclaim_threshold) {
      balance = await balance_of(accounts[2]);
      await check_reclaim(  accounts[2], _deposit, 0);
      assert.equal(await balance_of(accounts[2]), balance + _deposit);
      balance = await balance_of(accounts[4]);
      await check_reclaim(  accounts[4], _deposit, 0);
      assert.equal(await balance_of(accounts[4]), balance + _deposit);
      balance = await balance_of(accounts[6]);
      await check_reclaim(  accounts[6], _deposit, 0);
      assert.equal(await balance_of(accounts[6]), balance + _deposit);
    } else {
      array_equal(await _oracle.reclaim.call(accounts[2], _coin.address),
                  [0, 0]);
      array_equal(await _oracle.reclaim.call(accounts[4], _coin.address),
                  [0, 0]);
      array_equal(await _oracle.reclaim.call(accounts[6], _coin.address),
                  [0, 0]);
    }
    reclaim_amount = _deposit + get_reward(reward_total, 3);
    balance = await balance_of(accounts[5]);
    await check_reclaim(accounts[5], _deposit, get_reward(reward_total, 3));
    assert.equal(await balance_of(accounts[5]), balance + reclaim_amount);
    balance = await balance_of(accounts[3]);
    await check_reclaim(accounts[3], _deposit, get_reward(reward_total, 3));
    assert.equal(await balance_of(accounts[3]), balance + reclaim_amount);
    balance = await balance_of(accounts[1]);
    await check_reclaim(accounts[1], _deposit, get_reward(reward_total, 3));
    assert.equal(await balance_of(accounts[1]), balance + reclaim_amount);
    array_equal(await _oracle.reclaim.call(accounts[6], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[7], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(reward_total - get_reward(reward_total, 3) * 3);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply + _tax -
                 reward_total + get_reward(reward_total, 3) * 3);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    
    // 3 commits on the two modes ->
    // 3 reveals on the two modes ->
    // no reclaim
    real_mode_level = Math.min(_mode_level, _other_level);
    real_other_level = Math.max(_mode_level, _other_level);
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(
                         accounts[1], real_mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    await _coin.mint(accounts[2], _deposit);
    balance = await balance_of(accounts[2]);
    await check_commit(accounts[2],
                       await _oracle.encrypt(
                         accounts[2], real_other_level, 2222),
                       _deposit);
    assert.equal(await balance_of(accounts[2]), balance - _deposit);
    await _coin.mint(accounts[3], _deposit);
    balance = await balance_of(accounts[3]);
    await check_commit(accounts[3],
                       await _oracle.encrypt(
                         accounts[3], real_mode_level, 3333),
                       _deposit);
    assert.equal(await balance_of(accounts[3]), balance - _deposit);
    await _coin.mint(accounts[4], _deposit);
    balance = await balance_of(accounts[4]);
    await check_commit(accounts[4],
                       await _oracle.encrypt(
                         accounts[4], real_other_level, 4444),
                       _deposit);
    assert.equal(await balance_of(accounts[4]), balance - _deposit);
    await _coin.mint(accounts[5], _deposit);
    balance = await balance_of(accounts[5]);
    await check_commit(accounts[5],
                       await _oracle.encrypt(
                         accounts[5], real_mode_level, 5555),
                       _deposit);
    assert.equal(await balance_of(accounts[5]), balance - _deposit);
    await _coin.mint(accounts[6], _deposit);
    balance = await balance_of(accounts[6]);
    await check_commit(accounts[6],
                       await _oracle.encrypt(
                         accounts[6], real_other_level, 6666),
                       _deposit);
    assert.equal(await balance_of(accounts[6]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(
                   accounts[1], real_mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].hash,
                 await _oracle.encrypt(
                   accounts[2], real_other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].hash,
                 await _oracle.encrypt(
                   accounts[3], real_mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].hash,
                 await _oracle.encrypt(
                   accounts[4], real_other_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].hash,
                 await _oracle.encrypt(
                   accounts[5], real_mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].hash,
                 await _oracle.encrypt(
                   accounts[6], real_other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);
    
    assert.equal(await _oracle.reveal.call(
      accounts[1], real_mode_level + 100, 1111), false);
    await check_reveal(accounts[1], real_mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
      accounts[1], real_mode_level, 1111), false);
    await check_reveal(accounts[2], real_other_level, 2222);
    await check_reveal(accounts[3], real_mode_level, 3333);
    await check_reveal(accounts[4], real_other_level, 4444);
    await check_reveal(accounts[5], real_mode_level, 5555);
    await check_reveal(accounts[6], real_other_level, 6666);
    assert.equal(await _oracle.reveal.call(
      accounts[7], real_mode_level, 7777), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level,
                 Math.min(real_mode_level, real_other_level));
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 real_other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 real_other_level);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 real_other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 3);
    assert.equal(current.epochs[0].votes[_other_level].count, 3);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == real_mode_level) {
        assert.equal(vote.deposit, _deposit * 3);
        assert.equal(vote.should_reward, true);
      } else if (real_mode_level - _reclaim_threshold <= level &&
                 level <= real_mode_level + _reclaim_threshold) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false)
      }
    }
    
    reward_total = 0;
    deposit_total = 0;
    if (real_mode_level - _reclaim_threshold <= real_other_level &&
        real_other_level <= real_mode_level + _reclaim_threshold) {
      reward_total = _tax;
      deposit_total = _deposit * 6;
    } else {
      reward_total = _tax + _deposit * 3;
      deposit_total = _deposit * 3;
      assert.equal(current.epochs[0].reward_balance,
                   reward_total);
      assert.equal(current.epochs[0].deposit_balance,
                   deposit_total);
    }
    
    array_equal(await _oracle.reclaim.call(accounts[7], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax + _deposit * 6);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply - _deposit * 6);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    
    // 4 commits on the mode + 2 commits on the other level ->
    // 2 reveals on the mode + 1 reveals on the other level ->
    // full reclaim
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    await _coin.mint(accounts[2], _deposit);
    balance = await balance_of(accounts[2]);
    await check_commit(accounts[2],
                       await _oracle.encrypt(accounts[2], _other_level, 2222),
                       _deposit);
    assert.equal(await balance_of(accounts[2]), balance - _deposit);
    await _coin.mint(accounts[3], _deposit);
    balance = await balance_of(accounts[3]);
    await check_commit(accounts[3],
                       await _oracle.encrypt(accounts[3], _mode_level, 3333),
                       _deposit);
    assert.equal(await balance_of(accounts[3]), balance - _deposit);
    await _coin.mint(accounts[4], _deposit);
    balance = await balance_of(accounts[4]);
    await check_commit(accounts[4],
                       await _oracle.encrypt(accounts[4], _mode_level, 4444),
                       _deposit);
    assert.equal(await balance_of(accounts[4]), balance - _deposit);
    await _coin.mint(accounts[5], _deposit);
    balance = await balance_of(accounts[5]);
    await check_commit(accounts[5],
                       await _oracle.encrypt(accounts[5], _mode_level, 5555),
                       _deposit);
    assert.equal(await balance_of(accounts[5]), balance - _deposit);
    await _coin.mint(accounts[6], _deposit);
    balance = await balance_of(accounts[6]);
    await check_commit(accounts[6],
                       await _oracle.encrypt(accounts[6], _other_level, 6666),
                       _deposit);
    assert.equal(await balance_of(accounts[6]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].hash,
                 await _oracle.encrypt(accounts[2], _other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].hash,
                 await _oracle.encrypt(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].hash,
                 await _oracle.encrypt(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].hash,
                 await _oracle.encrypt(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].hash,
                 await _oracle.encrypt(accounts[6], _other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);
    
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _other_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    // Incorrect reveal_level
    assert.equal(await _oracle.reveal.call(
      accounts[4], _other_level, 4444), false);
    await _oracle.reveal(accounts[4], _other_level, 4444);
    assert.equal(await _oracle.reveal.call(
      accounts[4], _mode_level, 4444), false);
    // Incorrect salt
    assert.equal(await _oracle.reveal.call(
      accounts[5], _mode_level, 6666), false);
    await _oracle.reveal(accounts[5], _mode_level, 6666);
    assert.equal(await _oracle.reveal.call(
      accounts[5], _mode_level, 5555), false);
    assert.equal(await _oracle.reveal.call(
      accounts[7], _mode_level, 7777), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 2);
    assert.equal(current.epochs[0].votes[_other_level].count, 1);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 2);
        assert.equal(vote.should_reward, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    
    reward_total = 0;
    deposit_total = 0;
    if (is_in_reclaim_threshold(_other_level)) {
      reward_total = _tax + _deposit * 3;
      deposit_total = _deposit * 3;
    } else {
      reward_total = _tax + _deposit * 4;
      deposit_total = _deposit * 2;
      assert.equal(current.epochs[0].reward_balance,
                   reward_total);
      assert.equal(current.epochs[0].deposit_balance,
                   deposit_total);
    }
    
    if (is_in_reclaim_threshold(_other_level)) {
      balance = await balance_of(accounts[2]);
      await check_reclaim(  accounts[2], _deposit, 0);
      assert.equal(await balance_of(accounts[2]), balance + _deposit);
      array_equal(await _oracle.reclaim.call(accounts[6], _coin.address),
                  [0, 0]);
    } else {
      array_equal(await _oracle.reclaim.call(accounts[2], _coin.address),
                  [0, 0]);
      array_equal(await _oracle.reclaim.call(accounts[6], _coin.address),
                  [0, 0]);
    }
    
    reclaim_amount = _deposit + get_reward(reward_total, 2);
    array_equal(await _oracle.reclaim.call(accounts[5], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[4], _coin.address), [0, 0]);
    balance = await balance_of(accounts[3]);
    await check_reclaim(accounts[3], _deposit, get_reward(reward_total, 2));
    assert.equal(await balance_of(accounts[3]), balance + reclaim_amount);
    balance = await balance_of(accounts[1]);
    await check_reclaim(accounts[1], _deposit, get_reward(reward_total, 2));
    assert.equal(await balance_of(accounts[1]), balance + reclaim_amount);
    array_equal(await _oracle.reclaim.call(accounts[6], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[7], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(reward_total - get_reward(reward_total, 2) * 2);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply + _tax -
                 reward_total + get_reward(reward_total, 2) * 2);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    
    // 4 commits on the mode + 2 commits on the other level ->
    // 2 reveals on the mode + 1 reveals on the other level ->
    // no reclaim
    
    assert.equal(await _oracle.getModeLevel(), _level_max);
    
    await _coin.mint(accounts[1], _deposit);
    balance = await balance_of(accounts[1]);
    await check_commit(accounts[1],
                       await _oracle.encrypt(accounts[1], _mode_level, 1111),
                       _deposit);
    assert.equal(await balance_of(accounts[1]), balance - _deposit);
    await _coin.mint(accounts[2], _deposit);
    balance = await balance_of(accounts[2]);
    await check_commit(accounts[2],
                       await _oracle.encrypt(accounts[2], _other_level, 2222),
                       _deposit);
    assert.equal(await balance_of(accounts[2]), balance - _deposit);
    await _coin.mint(accounts[3], _deposit);
    balance = await balance_of(accounts[3]);
    await check_commit(accounts[3],
                       await _oracle.encrypt(accounts[3], _mode_level, 3333),
                       _deposit);
    assert.equal(await balance_of(accounts[3]), balance - _deposit);
    await _coin.mint(accounts[4], _deposit);
    balance = await balance_of(accounts[4]);
    await check_commit(accounts[4],
                       await _oracle.encrypt(accounts[4], _mode_level, 4444),
                       _deposit);
    assert.equal(await balance_of(accounts[4]), balance - _deposit);
    await _coin.mint(accounts[5], _deposit);
    balance = await balance_of(accounts[5]);
    await check_commit(accounts[5],
                       await _oracle.encrypt(accounts[5], _mode_level, 5555),
                       _deposit);
    assert.equal(await balance_of(accounts[5]), balance - _deposit);
    await _coin.mint(accounts[6], _deposit);
    balance = await balance_of(accounts[6]);
    await check_commit(accounts[6],
                       await _oracle.encrypt(accounts[6], _other_level, 6666),
                       _deposit);
    assert.equal(await balance_of(accounts[6]), balance - _deposit);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].hash,
                 await _oracle.encrypt(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].hash,
                 await _oracle.encrypt(accounts[2], _other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].hash,
                 await _oracle.encrypt(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].hash,
                 await _oracle.encrypt(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].hash,
                 await _oracle.encrypt(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].hash,
                 await _oracle.encrypt(accounts[6], _other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);
    
    assert.equal(await _oracle.reveal.call(
      accounts[1], _mode_level + 100, 1111), false);
    // Incorrect revealed level
    assert.equal(await _oracle.reveal.call(
      accounts[2], _mode_level, 2222), false);
    // Incorrect salt
    assert.equal(await _oracle.reveal.call(
      accounts[3], _mode_level, 4444), false);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _other_level, 6666);
    assert.equal(await _oracle.reveal.call(
      accounts[7], _mode_level, 7777), false);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(), coin_supply);
    assert.equal(current.epoch_id % 3, 2);
    assert.equal(current.mode_level, _mode_level);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].oracle_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].oracle_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].oracle_level,
                 _other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 2);
    assert.equal(current.epochs[0].votes[_other_level].count, 1);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 2);
        assert.equal(vote.should_reward, true);
      } else if (is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    
    reward_total = 0;
    deposit_total = 0;
    if (is_in_reclaim_threshold(_other_level)) {
      reward_total = _tax + _deposit * 3;
      deposit_total = _deposit * 3;
    } else {
      reward_total = _tax + _deposit * 4;
      deposit_total = _deposit * 2;
      assert.equal(current.epochs[0].reward_balance,
                   reward_total);
      assert.equal(current.epochs[0].deposit_balance,
                   deposit_total);
    }
    
    array_equal(await _oracle.reclaim.call(accounts[1], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[2], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[3], _coin.address), [0, 0]);
    array_equal(await _oracle.reclaim.call(accounts[7], _coin.address), [0, 0]);
    
    coin_supply = (await _coin.totalSupply()).toNumber();
    await _coin.mint(await _coin.tax_account_(), _tax);
    await check_advance(_tax + _deposit * 6);
    current = await get_current(accounts);
    assert.equal(await _coin.totalSupply(),
                 coin_supply - _deposit * 6);
    assert.equal(current.epoch_id % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_balance, 0);
    assert.equal(current.epochs[0].deposit_balance, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    
    await check_advance(_tax);
    await check_advance(0);
    
    let balance_total = (await balance_of(accounts[0]) +
                         await balance_of(accounts[1]) +
                         await balance_of(accounts[2]) +
                         await balance_of(accounts[3]) +
                         await balance_of(accounts[4]) +
                         await balance_of(accounts[5]) +
                         await balance_of(accounts[6]));
    assert.equal(await _coin.totalSupply(), balance_total);
    
    // hash function
    assert.notEqual(await _oracle.encrypt(accounts[1], 10, 1111), 0);
    assert.notEqual(await _oracle.encrypt(accounts[1], 11, 111),
                    await _oracle.encrypt(accounts[1], 111, 11));
    assert.notEqual(await _oracle.encrypt(accounts[1], 11, 111),
                    await _oracle.encrypt(accounts[1], 1, 1111));
    
    // Initializable
    await should_throw(async () => {
      await _oracle.initialize({from: accounts[1]});
    }, "Initializable");
    
    // Ownable
    await should_throw(async () => {
      await _oracle.commit(accounts[1],
                           await _oracle.encrypt(
                             accounts[1], _mode_level, 1111),
                           _deposit, _coin.address,
                           {from: accounts[1]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _oracle.reveal(accounts[1], _mode_level, 1111,
                           {from: accounts[1]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _oracle.reclaim(accounts[1], _coin.address, {from: accounts[1]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _oracle.getModeLevel({from: accounts[1]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _oracle.advance(_coin.address, {from: accounts[1]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _oracle.revokeOwnership(_coin.address, {from: accounts[1]});
    }, "Ownable");
    
    _coin = await JohnLawCoin.new({from: accounts[2]});
    await _coin.initialize({from: accounts[2]});
    // Cannot use deployProxy because {from: ...} is not supported.
    _oracle = await OracleForTesting.new({from: accounts[2]});
    await _oracle.initialize({from: accounts[2]});
    await _oracle.overrideConstants(_level_max, _reclaim_threshold,
                                    _proportional_reward_rate,
                                    {from: accounts[2]});
    
    await should_throw(async () => {
      await _oracle.commit(accounts[2],
                           await _oracle.encrypt(
                             accounts[2], _mode_level, 1111),
                           0, _coin.address,
                           {from: accounts[2]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _oracle.advance(_coin.address, {from: accounts[2]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _oracle.revokeOwnership(_coin.address, {from: accounts[2]});
    }, "Ownable");
    
    await _coin.transferOwnership(_oracle.address, {from: accounts[2]});
    
    await _oracle.commit(accounts[2],
                         await _oracle.encrypt(accounts[2], _mode_level, 1111),
                         0, _coin.address,
                         {from: accounts[2]});
    await should_throw(async () => {
      await _oracle.commit(accounts[3],
                           await _oracle.encrypt(
                             accounts[3], _mode_level, 1111),
                           0, _coin.address,
                           {from: accounts[3]});
    }, "Ownable");
    
    await _oracle.reveal(accounts[2], _mode_level, 1111, {from: accounts[2]});
    await should_throw(async () => {
      await _oracle.reveal(accounts[2], _mode_level, 1111, {from: accounts[3]});
    }, "Ownable");
    
    await _oracle.reclaim(accounts[2], _coin.address, {from: accounts[2]});
    await should_throw(async () => {
      await _oracle.reclaim(accounts[2], _coin.address,
                            {from: accounts[3]});
    }, "Ownable");
    
    await _oracle.getModeLevel({from: accounts[2]});
    await should_throw(async () => {
      await _oracle.getModeLevel({from: accounts[3]});
    }, "Ownable");
    
    await _oracle.advance(_coin.address, {from: accounts[2]});
    await should_throw(async () => {
      await _oracle.advance(_coin.address, {from: accounts[3]});
    }, "Ownable");
    
    await _oracle.revokeOwnership(_coin.address, {from: accounts[2]});
    await should_throw(async () => {
      await _oracle.revokeOwnership(_coin.address, {from: accounts[3]});
    }, "Ownable");
    
    await _coin.mint(accounts[2], 1, {from: accounts[2]});
    await should_throw(async () => {
      await _coin.mint(accounts[1], 1, {from: accounts[1]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _coin.mint(accounts[3], 3, {from: accounts[3]});
    }, "Ownable");
    
    await _coin.burn(accounts[2], 0, {from: accounts[2]});
    await should_throw(async () => {
      await _coin.burn(accounts[1], 0, {from: accounts[1]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _coin.burn(accounts[3], 0, {from: accounts[3]});
    }, "Ownable");
    
    
    function is_in_reclaim_threshold(level) {
      return (_mode_level - _reclaim_threshold <= level &&
              level <= _mode_level + _reclaim_threshold);
    }
    
    function get_reward(reward_total, count) {
      let proportional_reward = 0;
      if (_deposit > 0) {
        proportional_reward = Math.trunc(
          (_proportional_reward_rate * reward_total) / (100 * count));
      }
      constant_reward = Math.trunc(
        ((100 - _proportional_reward_rate) * reward_total) /
          (100 * count));
      return proportional_reward + constant_reward;
    }
    
    async function check_commit(account, hash, deposit) {
      await _coin.transferOwnership(_oracle.address);
      let receipt =
          await _oracle.commit(account, hash, deposit, _coin.address);
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
      let receipt = await _oracle.reclaim(account, _coin.address);
      await _oracle.revokeOwnership(_coin.address);
      let args = receipt.logs.filter(e => e.event == 'ReclaimEvent')[0].args;
      assert.equal(args.sender, account);
      assert.equal(args.reclaimed, reclaimed);
      assert.equal(args.rewarded, reward);
    }
    
    async function check_advance(burned) {
      await _coin.transferOwnership(_oracle.address);
      let receipt = await _oracle.advance(_coin.address);
      await _oracle.revokeOwnership(_coin.address);
      let args = receipt.logs.filter(
        e => e.event == 'AdvancePhaseEvent')[0].args;
      assert.isTrue(args.epoch_id >= 3);
      assert.equal(args.burned, burned);
    }
    
    async function balance_of(account) {
      return (await _coin.balanceOf(account)).toNumber();
    }
    
    async function get_current(accounts) {
      let oracle = {};
      oracle.level_max = _level_max;
      oracle.reclaim_threshold = _reclaim_threshold;
      oracle.proportional_reward_rate = _proportional_reward_rate;
      oracle.epoch_id = (await _oracle.epoch_id_()).toNumber();
      oracle.epochs = [];
      for (let epoch_index = 0; epoch_index < 3; epoch_index++) {
        let ret = await _oracle.getEpoch(epoch_index);
        let epoch = {};
        epoch.deposit_balance = await balance_of(ret[0]);
        epoch.reward_balance = await balance_of(ret[1]);
        epoch.reward_total = ret[2];
        epoch.phase = ret[3];
        epoch.votes = [];
        for (let level = 0; level < oracle.level_max; level++) {
          let ret = await _oracle.getVote(epoch_index, level);
          let vote = {deposit: ret[0], count: ret[1],
                      should_reclaim: ret[2], should_reward: ret[3]};
          epoch.votes.push(vote);
        }
        epoch.commits = {};
        for (let account of accounts) {
          let ret = await _oracle.getCommit(epoch_index, account);
          let commit = {hash: ret[0], deposit: ret[1],
                        oracle_level: ret[2], phase: ret[3],
                        epoch_id: ret[4]};
          epoch.commits[account] = commit;
        }
        oracle.epochs.push(epoch);
      }
      oracle.mode_level = await _oracle.getModeLevel();
      return oracle;
    }
  });
  
}
