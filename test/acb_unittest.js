// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");
const OracleForTesting = artifacts.require("OracleForTesting");
const BondOperationForTesting = artifacts.require("BondOperationForTesting");
const OpenMarketOperationForTesting =
      artifacts.require("OpenMarketOperationForTesting");
const Logging = artifacts.require("Logging");
const ACBForTesting = artifacts.require("ACBForTesting");
const common = require("./common.js");
const should_throw = common.should_throw;
const mod = common.mod;

contract("ACBUnittest", function (accounts) {
  let args = common.custom_arguments();
  assert.isTrue(args.length == 14);
  parameterized_test(accounts,
                     args[0],
                     args[1],
                     args[2],
                     args[3],
                     args[4],
                     args[5],
                     args[6],
                     args[7],
                     args[8],
                     args[9],
                     args[10],
                     args[11],
                     args[12],
                     args[13]);
});

function parameterized_test(accounts,
                            _bond_price,
                            _bond_redemption_price,
                            _bond_redemption_period,
                            _bond_redeemable_period,
                            _epoch_duration,
                            _proportional_reward_rate,
                            _deposit_rate,
                            _damping_factor,
                            _level_to_exchange_rate,
                            _reclaim_threshold,
                            _tax,
                            _price_change_interval,
                            _price_change_percentage,
                            _start_price_multiplier) {
  let test_name = "ACB parameters:" +
      " bond_price=" + _bond_price +
      " bond_redemp_price=" + _bond_redemption_price +
      " bond_redemp_period=" + _bond_redemption_period +
      " bond_redeemable_period=" + _bond_redeemable_period +
      " epoch_duration=" + _epoch_duration +
      " reward_rate=" + _proportional_reward_rate +
      " deposit_rate=" + _deposit_rate +
      " damping_factor=" + _damping_factor +
      " level_to_exchange_rate=" + _level_to_exchange_rate +
      " reclaim=" + _reclaim_threshold +
      " tax=" + _tax +
      " price_interval=" + _price_change_interval +
      " price_percent=" + _price_change_percentage +
      " price_multiplier=" + _start_price_multiplier;
  console.log(test_name);

  it(test_name, async function () {
    let _level_max = _level_to_exchange_rate.length;

    // Cannot use deployProxy because {from: ...} is not supported.
    let _coin = await JohnLawCoin.new({from: accounts[1]});
    common.print_contract_size(_coin, "JohnLawCoin");
    await _coin.initialize({from: accounts[1]});
    let _bond = await JohnLawBond.new({from: accounts[1]});
    common.print_contract_size(_bond, "JohnLawBond");
    await _bond.initialize({from: accounts[1]});
    let _oracle = await OracleForTesting.new({from: accounts[1]});
    common.print_contract_size(_oracle, "OracleForTesting");
    await _oracle.initialize({from: accounts[1]});
    let _bond_operation =
        await BondOperationForTesting.new({from: accounts[1]});
    common.print_contract_size(_bond_operation, "BondOperationForTesting");
    await _bond_operation.initialize(_bond.address, {from: accounts[1]});
    let _open_market_operation =
        await OpenMarketOperationForTesting.new({from: accounts[1]});
    common.print_contract_size(
      _open_market_operation, "OpenMarketOperationForTesting");
    await _open_market_operation.initialize({from: accounts[1]});
    let _logging = await Logging.new({from: accounts[1]});
    await _logging.initialize({from: accounts[1]});
    common.print_contract_size(_logging, "Logging");
    let _acb = await ACBForTesting.new({from: accounts[1]});
    common.print_contract_size(_acb, "ACBForTesting");
    await _acb.initialize(_coin.address, _oracle.address,
                          _bond_operation.address,
                          _open_market_operation.address,
                          _logging.address,
                          {from: accounts[1]});

    await _oracle.overrideConstants(
        _level_max, _reclaim_threshold, _proportional_reward_rate,
        {from: accounts[1]});
    await _bond_operation.overrideConstants(_bond_price,
                                            _bond_redemption_price,
                                            _bond_redemption_period,
                                            _bond_redeemable_period,
                                            {from: accounts[1]});
    await _open_market_operation.overrideConstants(
      _price_change_interval, _price_change_percentage,
      _start_price_multiplier, {from: accounts[1]});
    await _acb.overrideConstants(_epoch_duration,
                                 _deposit_rate,
                                 _damping_factor,
                                 _level_to_exchange_rate,
                                 {from: accounts[1]});
    
    await _bond.transferOwnership(_bond_operation.address, {from: accounts[1]});
    await _coin.transferOwnership(_acb.address, {from: accounts[1]});
    await _bond_operation.transferOwnership(_acb.address, {from: accounts[1]});
    await _open_market_operation.transferOwnership(
      _acb.address, {from: accounts[1]});
    await _logging.transferOwnership(_acb.address, {from: accounts[1]});
    await _oracle.transferOwnership(_acb.address, {from: accounts[1]});

    let _initial_coin_supply = (await _coin.totalSupply()).toNumber();
    let _tax_rate = await _coin.TAX_RATE();
    assert.equal(await _acb.paused(), false);

    let _default_level;
    for(let level = 0; level < _level_max; level++) {
      if (_level_to_exchange_rate[level] == 11) {
        _default_level = level;
      }
    }
    assert.isTrue(0 < _default_level && _default_level < _level_max - 1);

    let current;
    let redemptions = [];
    let sub_accounts = accounts.slice(1, 4);

    // initial coin supply
    current = await get_current(sub_accounts, []);
    assert.isTrue(_initial_coin_supply > 10000);
    assert.equal(current.balances[accounts[2]], 0);
    assert.equal(current.balances[accounts[3]], 0);

    // transfer
    await should_throw(async () => {
      await _coin.transfer.call(
        accounts[1], 1, {from: accounts[4]});
    }, "ERC20");
    await _coin.transfer(accounts[2], 0, {from: accounts[1]});
    await should_throw(async () => {
      await _coin.transfer.call(
        accounts[1], 1, {from: accounts[2]});
    }, "ERC20");
    await should_throw(async () => {
      await _coin.transfer.call(
        accounts[2], _initial_coin_supply + 1, {from: accounts[1]});
    }, "ERC20");
    await _coin.transfer(accounts[2], 1, {from: accounts[1]});
    await _coin.transfer(accounts[3], 10, {from: accounts[1]});
    await _coin.transfer(accounts[2], 5, {from: accounts[3]});
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[1]],
                 _initial_coin_supply - 11);
    assert.equal(current.balances[accounts[2]], 6);
    assert.equal(current.balances[accounts[3]], 5);
    await _coin.transfer(accounts[2], 0, {from: accounts[2]});
    assert.equal(current.balances[accounts[1]],
                 _initial_coin_supply - 11);
    assert.equal(current.balances[accounts[2]], 6);
    assert.equal(current.balances[accounts[3]], 5);
    await _coin.transfer(accounts[3], 0, {from: accounts[2]});
    await should_throw(async () => {
      await _coin.transfer.call(
        accounts[3], 7, {from: accounts[2]});
    }, "ERC20");
    await _coin.transfer(accounts[3], 6, {from: accounts[2]});
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[1]],
                 _initial_coin_supply - 11);
    assert.equal(current.balances[accounts[2]], 0);
    assert.equal(current.balances[accounts[3]], 11);
    await _coin.transfer(accounts[1], 11, {from: accounts[3]});
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[1]], _initial_coin_supply);
    assert.equal(current.balances[accounts[2]], 0);
    assert.equal(current.balances[accounts[3]], 0);
    assert.equal(current.coin_supply, _initial_coin_supply);
    await _coin.transfer(accounts[2], 1000, {from: accounts[1]});
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[1]], _initial_coin_supply - 1000);
    assert.equal(current.balances[accounts[2]], 990);
    assert.equal(await _coin.balanceOf(await _coin.tax_account_()), 10);
    await _coin.transfer(accounts[1], 990, {from: accounts[2]});
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[1]], _initial_coin_supply - 19);
    assert.equal(current.balances[accounts[2]], 0);
    assert.equal(await _coin.balanceOf(await _coin.tax_account_()), 19);
    await _acb.moveCoin(await _coin.tax_account_(), accounts[1], 19,
                        {from: accounts[1]});
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[1]], _initial_coin_supply);
    assert.equal(current.balances[accounts[2]], 0);
    assert.equal(current.balances[accounts[3]], 0);
    assert.equal(current.coin_supply, _initial_coin_supply);

    // timestamp
    assert.equal(await _acb.getTimestamp(), 0);
    await _acb.setTimestamp(_epoch_duration, {from: accounts[1]});
    assert.equal(await _acb.getTimestamp(), _epoch_duration);

    await _acb.setTimestamp(
      (await _acb.getTimestamp()).toNumber() + _epoch_duration,
      {from: accounts[1]});

    let burned = [0, 0, 0];
    let deposit_4 = [0, 0, 0];
    let deposit_5 = [0, 0, 0];
    let deposit_6 = [0, 0, 0];
    let now = 0;
    await set_tax();
    sub_accounts = accounts.slice(4, 7);

    await move_coins(accounts[1], accounts[4], 100);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]], 100);

    await check_vote(await _acb.encrypt(_default_level, 7777,
                                        {from: accounts[7]}),
                     _default_level, 7777, {from: accounts[7]},
                     true, false, 0, 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.current_epoch_start, await _acb.getTimestamp());

    // 1 commit
    let balance = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 1, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     true, false, deposit_4[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.current_epoch_start, await _acb.getTimestamp());
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]],
                 balance - deposit_4[mod(now, 3)]);
    balance = current.balances[accounts[4]];
    await check_vote(await _acb.encrypt(_default_level, 1, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.current_epoch_start, await _acb.getTimestamp());
    assert.equal(current.balances[accounts[4]], balance);
    await check_vote(await _acb.encrypt(_default_level, 1, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.current_epoch_start, await _acb.getTimestamp());
    assert.equal(current.balances[accounts[4]], balance);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance * _deposit_rate / 100);
    assert.equal(current.current_epoch_start,
                 await _acb.getTimestamp() - _epoch_duration);
    await check_vote(await _acb.encrypt(_default_level, 2, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)], 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.current_epoch_start, await _acb.getTimestamp());
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]],
                 balance - deposit_4[mod(now, 3)]);
    balance = current.balances[accounts[4]];
    await check_vote(await _acb.encrypt(_default_level, 2, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.current_epoch_start, await _acb.getTimestamp());
    assert.equal(current.balances[accounts[4]], balance);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    burned[mod(now, 3)] = _tax - reward;
    deposit_4[mod(now, 3)] = Math.trunc(balance * _deposit_rate / 100);
    assert.equal(current.current_epoch_start,
                 await _acb.getTimestamp() - _epoch_duration);
    await check_vote(await _acb.encrypt(_default_level, 3, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     true, false, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)], reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.current_epoch_start, await _acb.getTimestamp());
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]];
    await check_vote(await _acb.encrypt(_default_level, 3, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.current_epoch_start, await _acb.getTimestamp());
    assert.equal(current.balances[accounts[4]], balance);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    burned[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + _tax;
    deposit_4[mod(now, 3)] = Math.trunc(balance * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 4, {from: accounts[4]}),
                     _default_level, 3, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)], 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]],
                 balance - deposit_4[mod(now, 3)]);
    balance = current.balances[accounts[4]];
    await check_vote(await _acb.encrypt(_default_level, 4, {from: accounts[4]}),
                     _default_level, 2, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]], balance);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 0);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if( deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    burned[mod(now, 3)] = _tax - reward;
    deposit_4[mod(now, 3)] = Math.trunc(balance * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 5, {from: accounts[4]}),
                     _default_level, 4, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)], reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]];
    await check_vote(await _acb.encrypt(_default_level, 5, {from: accounts[4]}),
                     _default_level, 4, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]], balance);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    burned[mod(now, 3)] = _tax - reward;
    deposit_4[mod(now, 3)] = Math.trunc(balance * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 6, {from: accounts[4]}),
                     _default_level, 5, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)], reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]];
    await check_vote(await _acb.encrypt(_default_level, 6, {from: accounts[4]}),
                     _default_level, 5, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]], balance);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    burned[mod(now, 3)] = _tax - reward;
    deposit_4[mod(now, 3)] = Math.trunc(balance * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 7, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)], reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]];
    await check_vote(await _acb.encrypt(_default_level, 7, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]], balance);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    burned[mod(now, 3)] = _tax - reward;
    deposit_4[mod(now, 3)] = Math.trunc(balance * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 8, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, false, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)], reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]];
    await check_vote(await _acb.encrypt(_default_level, 8, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]], balance);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = 0;
    burned[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + _tax - reward;
    deposit_4[mod(now, 3)] = 0;
    await check_vote(await _acb.NULL_HASH(), _default_level,
                     7, {from: accounts[4]},
                     true, false, deposit_4[mod(now, 3)],
                     0, reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]],
                 balance - deposit_4[mod(now, 3)] + reward);
    balance = current.balances[accounts[4]];
    await check_vote(await _acb.encrypt(_default_level, 8, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     false, false, 0, 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]], balance);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 0);

    // 3 commits on the stable level.
    await reset_balances(accounts);

    await move_coins(accounts[1], accounts[4], 100);
    await move_coins(accounts[1], accounts[5], 100);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]], 100);
    assert.equal(current.balances[accounts[6]], 0);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    burned[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + _tax;
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 1000, {from: accounts[4]}),
      _default_level, 1000, {from: accounts[4]},
      true, false, deposit_4[mod(now, 3)], 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 1000, {from: accounts[5]}),
      _default_level, 1000, {from: accounts[5]},
      true, false, deposit_5[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 1000, {from: accounts[6]}),
      _default_level, 1000, {from: accounts[6]},
      true, false, deposit_6[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 0);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    burned[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + _tax;
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 1, {from: accounts[4]}),
                     _default_level, 0, {from: accounts[4]},
                     true, false, deposit_4[mod(now, 3)], 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 1, {from: accounts[5]}),
                     _default_level, 0, {from: accounts[5]},
                     true, false, deposit_5[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 1, {from: accounts[6]}),
                     _default_level, 0, {from: accounts[6]},
                     true, false, deposit_6[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 0);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    burned[mod(now, 3)] = (deposit_4[mod(now - 2, 3)] +
                              deposit_5[mod(now - 2, 3)] +
                              deposit_6[mod(now - 2, 3)] + _tax);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 2, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)], 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 2, {from: accounts[5]}),
                     _default_level, 1, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 2, {from: accounts[6]}),
                     _default_level, 1, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 0);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 3, {from: accounts[4]}),
                     _default_level, 2, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 3, {from: accounts[5]}),
                     _default_level, 2, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 3, {from: accounts[6]}),
                     _default_level, 2, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 4, {from: accounts[4]}),
                     _default_level, 3, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 4, {from: accounts[5]}),
                     _default_level, 3, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 4, {from: accounts[6]}),
                     _default_level, 3, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);

    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    await reset_balances(accounts);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    
    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 5, {from: accounts[4]}),
                     _default_level, 4, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 5, {from: accounts[5]}),
                     _default_level, 4, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 5, {from: accounts[6]}),
                     _default_level, 4, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(deposit_4[mod(now, 3)], 0);
    assert.equal(deposit_5[mod(now, 3)], 0);
    assert.equal(deposit_6[mod(now, 3)], 0);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 6, {from: accounts[4]}),
                     _default_level, 5, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 6, {from: accounts[5]}),
                     _default_level, 5, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 6, {from: accounts[6]}),
                     _default_level, 5, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 7, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 7, {from: accounts[5]}),
                     _default_level, 6, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 7, {from: accounts[6]}),
                     _default_level, 5, {from: accounts[6]},
                     true, false, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = deposit_6[mod(now - 2, 3)] + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 8, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, false, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 8, {from: accounts[5]}),
                     _default_level, 6, {from: accounts[5]},
                     true, false, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 8, {from: accounts[6]}),
                     _default_level, 7, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 reward_6);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                    _tax);
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    if (deposit_6[mod(now - 2, 3)] > 0) {
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total / 100);
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 9, {from: accounts[4]}),
                     _default_level, 0, {from: accounts[4]},
                     true, false, deposit_4[mod(now, 3)], 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 9, {from: accounts[5]}),
                     _default_level, 0, {from: accounts[5]},
                     true, false, deposit_5[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 9, {from: accounts[6]}),
                     _default_level, 0, {from: accounts[6]},
                     true, false, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                    deposit_6[mod(now - 2, 3)] + _tax);
    constant_reward = 0;
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    burned[mod(now, 3)] = reward_total;
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 10, {from: accounts[4]}),
      _default_level, 9, {from: accounts[4]},
      true, true, deposit_4[mod(now, 3)], 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 10, {from: accounts[5]}),
      _default_level, 9, {from: accounts[5]},
      true, true, deposit_5[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 10, {from: accounts[6]}),
      _default_level, 9, {from: accounts[6]},
      true, true, deposit_6[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 0);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2 + deposit_4[mod(now - 2, 3)]);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 11, {from: accounts[5]}),
      _default_level, 10, {from: accounts[5]},
      true, true, deposit_5[mod(now, 3)],
      deposit_5[mod(now - 2, 3)],
      reward_5 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 11, {from: accounts[6]}),
      _default_level, 10, {from: accounts[6]},
      true, true, deposit_6[mod(now, 3)],
      deposit_6[mod(now - 2, 3)],
      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = deposit_4[mod(now - 2, 3)] + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_5[mod(now - 2, 3)] + deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward + deposit_5[mod(now - 2, 3)]);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 12, {from: accounts[6]}),
      _default_level, 11, {from: accounts[6]},
      true, true, deposit_6[mod(now, 3)],
      deposit_6[mod(now - 2, 3)],
      reward_6 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current([accounts[1]], []);
    coin_supply = current.coin_supply;
    reward_total = deposit_5[mod(now - 2, 3)] + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 0 + deposit_6[mod(now - 2, 3)]);
    deposit13 = Math.trunc(
        current.balances[accounts[1]] * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 1000, {from: accounts[1]}),
      _default_level, 1000, {from: accounts[1]},
      true, false, deposit13, 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current([accounts[1]], []);
    coin_supply = current.coin_supply;
    burned[mod(now, 3)] = deposit_6[mod(now - 2, 3)] + _tax;
    deposit14 = Math.trunc(
        current.balances[accounts[1]] * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 1000, {from: accounts[1]}),
      _default_level, 1000, {from: accounts[1]},
      true, true, deposit14, 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 0);

    // 3 commits on the stable level and another level.

    // 0, stable, stable
    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);

    await move_coins(accounts[1], accounts[4], 10000);
    await move_coins(accounts[1], accounts[5], 2000);
    await move_coins(accounts[1], accounts[5], 8100);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply;
    reward_total = deposit13 + _tax;
    constant_reward = 0;
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    burned[mod(now, 3)] = reward_total;
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(0, 1, {from: accounts[4]}),
                     _default_level, 0, {from: accounts[4]},
                     true, false, deposit_4[mod(now, 3)], 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 1, {from: accounts[5]}),
                     _default_level, 0, {from: accounts[5]},
                     true, false, deposit_5[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 1, {from: accounts[6]}),
                     _default_level, 0, {from: accounts[6]},
                     true, false, deposit_6[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = deposit14 + _tax;
    constant_reward = 0;
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    burned[mod(now, 3)] = reward_total;
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 2, {from: accounts[4]}),
                     0, 1, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)], 0, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 2, {from: accounts[5]}),
                     _default_level, 1, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 2, {from: accounts[6]}),
                     _default_level, 1, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)], 0, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 0);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reclaim_4 = 0;
    in_threshold = false;
    if (_default_level - 0 <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_4 = deposit_4[mod(now - 2, 3)];
    }
    reward_total = (deposit_4[mod(now - 2, 3)] - reclaim_4 +
                    _tax);
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_5[mod(now - 2, 3)] + deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 3, {from: accounts[4]}),
                     _default_level, 2, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)], reclaim_4, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] + reclaim_4);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 3, {from: accounts[5]}),
                     _default_level, 2, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 3, {from: accounts[6]}),
                     _default_level, 2, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    // 0, 0, stable
    tmp_deposit_rate = _deposit_rate;
    if (_deposit_rate == 0) {
      _deposit_rate = 1;
      _acb.setDepositRate(_deposit_rate, {from: accounts[1]});
    }

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);

    await move_coins(accounts[1], accounts[4], 2900);
    await move_coins(accounts[1], accounts[5], 7000);
    await move_coins(accounts[1], accounts[6], 10000);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(0, 4, {from: accounts[4]}),
                     _default_level, 3, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(0, 4, {from: accounts[5]}),
                     _default_level, 3, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 4, {from: accounts[6]}),
                     _default_level, 3, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    _deposit_rate = tmp_deposit_rate;
    _acb.setDepositRate(_deposit_rate, {from: accounts[1]});

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 5, {from: accounts[4]}),
                     0, 4, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt( _default_level, 5, {from: accounts[5]}),
      0, 4, {from: accounts[5]},
      true, true, deposit_5[mod(now, 3)],
      deposit_5[mod(now - 2, 3)],
      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 5, {from: accounts[6]}),
                     _default_level, 4, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reclaim_4 = reclaim_5 = 0;
    in_threshold = false;
    if (_default_level - 0 <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_4 = deposit_4[mod(now - 2, 3)];
      reclaim_5 = deposit_5[mod(now - 2, 3)];
    }
    reward_total = (deposit_4[mod(now - 2, 3)] - reclaim_4 +
                    deposit_5[mod(now - 2, 3)] - reclaim_5 +
                    _tax);
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total =  deposit_6[mod(now - 2, 3)];
    if (deposit_total > 0) {
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 6, {from: accounts[4]}),
                     _default_level, 5, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)], reclaim_4, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] + reclaim_4);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 6, {from: accounts[5]}),
                     _default_level, 5, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)], reclaim_5, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] + reclaim_5);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 6, {from: accounts[6]}),
                     _default_level, 5, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    // stable, stable, level_max - 1
    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);

    await move_coins(accounts[1], accounts[4], 3100);
    await move_coins(accounts[1], accounts[5], 7000);
    await move_coins(accounts[1], accounts[6], 10000);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 7, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 7, {from: accounts[5]}),
                     _default_level, 6, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_level_max - 1, 7, {from: accounts[6]}),
                     _default_level, 6, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 8, {from: accounts[4]}),
                     _default_level, 7, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 8, {from: accounts[5]}),
                     _default_level, 7, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 8, {from: accounts[6]}),
                     _level_max - 1, 7, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)],
                     deposit_6[mod(now - 2, 3)],
                     reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reclaim_6 = 0;
    in_threshold = false;
    if (_level_max - 1 - _default_level <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_6 = deposit_6[mod(now - 2, 3)];
    }
    reward_total = (deposit_6[mod(now - 2, 3)] - reclaim_6 +
                    _tax);
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)];
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 9, {from: accounts[4]}),
                     _default_level, 8, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 9, {from: accounts[5]}),
                     _default_level, 8, {from: accounts[5]},
                     true, true, deposit_5[mod(now, 3)],
                     deposit_5[mod(now - 2, 3)],
                     reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(_default_level, 9, {from: accounts[6]}),
                     _default_level, 8, {from: accounts[6]},
                     true, true, deposit_6[mod(now, 3)], reclaim_6, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] + reclaim_6);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    // stable, level_max - 1, level_max - 1
    tmp_deposit_rate = _deposit_rate;
    if (_deposit_rate == 0) {
      _deposit_rate = 1;
      _acb.setDepositRate(_deposit_rate, {from: accounts[1]});
    }

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);

    await move_coins(accounts[1], accounts[4], 10000);
    await move_coins(accounts[1], accounts[5], 7000);
    await move_coins(accounts[1], accounts[6], 2900);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 10, {from: accounts[4]}),
      _default_level, 9, {from: accounts[4]},
      true, true, deposit_4[mod(now, 3)],
      deposit_4[mod(now - 2, 3)],
      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_level_max - 1, 10, {from: accounts[5]}),
      _default_level, 9, {from: accounts[5]},
      true, true, deposit_5[mod(now, 3)],
      deposit_5[mod(now - 2, 3)],
      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_level_max - 1, 10, {from: accounts[6]}),
      _default_level, 9, {from: accounts[6]},
      true, true, deposit_6[mod(now, 3)],
      deposit_6[mod(now - 2, 3)],
      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    _deposit_rate = tmp_deposit_rate;
    _acb.setDepositRate(_deposit_rate, {from: accounts[1]});

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 11, {from: accounts[4]}),
      _default_level, 10, {from: accounts[4]},
      true, true, deposit_4[mod(now, 3)],
      deposit_4[mod(now - 2, 3)],
      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 11, {from: accounts[5]}),
      _level_max - 1, 10, {from: accounts[5]},
      true, true, deposit_5[mod(now, 3)],
      deposit_5[mod(now - 2, 3)],
      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 11, {from: accounts[6]}),
      _level_max - 1, 10, {from: accounts[6]},
      true, true, deposit_6[mod(now, 3)],
      deposit_6[mod(now - 2, 3)],
      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reclaim_5 = reclaim_6 = 0;
    in_threshold = false;
    if (_level_max - 1 - _default_level <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_5 = deposit_5[mod(now - 2, 3)];
      reclaim_6 = deposit_6[mod(now - 2, 3)];
    }
    reward_total = (deposit_5[mod(now - 2, 3)] - reclaim_5 +
                    deposit_6[mod(now - 2, 3)] - reclaim_6 +
                    _tax);
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = deposit_4[mod(now - 2, 3)];
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 12, {from: accounts[4]}),
      _default_level, 11, {from: accounts[4]},
      true, true, deposit_4[mod(now, 3)],
      deposit_4[mod(now - 2, 3)],
      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 12, {from: accounts[5]}),
      _default_level, 11, {from: accounts[5]},
      true, true, deposit_5[mod(now, 3)], reclaim_5, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] + reclaim_5);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 12, {from: accounts[6]}),
      _default_level, 11, {from: accounts[6]},
      true, true, deposit_6[mod(now, 3)], reclaim_6, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] + reclaim_6);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    // stable, stable, level_max - 1; deposit is the same
    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);

    await move_coins(accounts[1], accounts[4], 10000);
    await move_coins(accounts[1], accounts[5], 7000);
    await move_coins(accounts[1], accounts[6], 3000);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_level_max - 1, 13, {from: accounts[4]}),
      _default_level, 12, {from: accounts[4]},
      true, true, deposit_4[mod(now, 3)],
      deposit_4[mod(now - 2, 3)],
      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 13, {from: accounts[5]}),
      _default_level, 12, {from: accounts[5]},
      true, true, deposit_5[mod(now, 3)],
      deposit_5[mod(now - 2, 3)],
      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 13, {from: accounts[6]}),
      _default_level, 12, {from: accounts[6]},
      true, true, deposit_6[mod(now, 3)],
      deposit_6[mod(now - 2, 3)],
      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 14, {from: accounts[4]}),
      _level_max - 1, 13, {from: accounts[4]},
      true, true, deposit_4[mod(now, 3)],
      deposit_4[mod(now - 2, 3)],
      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100)
    await check_vote(
      await _acb.encrypt(_default_level, 14, {from: accounts[5]}),
      _default_level, 13, {from: accounts[5]},
      true, true, deposit_5[mod(now, 3)],
      deposit_5[mod(now - 2, 3)],
      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 14, {from: accounts[6]}),
      _default_level, 13, {from: accounts[6]},
      true, true, deposit_6[mod(now, 3)],
      deposit_6[mod(now - 2, 3)],
      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reclaim_4 = 0;
    in_threshold = false;
    if (_level_max - 1 - _default_level <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_4 = deposit_4[mod(now - 2, 3)];
    }
    reward_total = (deposit_4[mod(now - 2, 3)] - reclaim_4 +
                    _tax);
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_5[mod(now - 2, 3)] + deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_5 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 15, {from: accounts[4]}),
      _default_level, 14, {from: accounts[4]},
      true, true, deposit_4[mod(now, 3)], reclaim_4, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] + reclaim_4);
    balance_5 = current.balances[accounts[5]];
    deposit_5[mod(now, 3)] = Math.trunc(balance_5 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 15, {from: accounts[5]}),
      _default_level, 14, {from: accounts[5]},
      true, true, deposit_5[mod(now, 3)],
      deposit_5[mod(now - 2, 3)],
      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]],
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]];
    deposit_6[mod(now, 3)] = Math.trunc(balance_6 * _deposit_rate / 100);
    await check_vote(
      await _acb.encrypt(_default_level, 15, {from: accounts[6]}),
      _default_level, 14, {from: accounts[6]},
      true, true, deposit_6[mod(now, 3)],
      deposit_6[mod(now - 2, 3)],
      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]],
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    // all levels
    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);
    
    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1 + deposit_5[mod(now - 2, 3)] +
                              deposit_6[mod(now - 2, 3)]);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(0, 4444, {from: accounts[4]}),
                     _default_level, 15, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = (deposit_5[mod(now - 2, 3)] + deposit_6[mod(now - 2, 3)] +
                    _tax);
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = deposit_4[mod(now - 2, 3)];
    if (deposit_total > 0) {
      reward_4 = Math.trunc(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    burned[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1);
    balance_4 = current.balances[accounts[4]];
    deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.encrypt(1, 4444, {from: accounts[4]}),
                     0, 4444, {from: accounts[4]},
                     true, true, deposit_4[mod(now, 3)],
                     deposit_4[mod(now - 2, 3)],
                     reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]],
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    assert.equal(current.coin_supply,
                 coin_supply -
                 burned[mod(now - 1, 3)]);
    assert.equal(await _open_market_operation.coin_budget_(),
                 await mint_at_default_level());

    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(-_bond_price * 2, 2, 0);
    current = await get_current(sub_accounts, []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 2);
    let t0 = (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
    await check_purchase_bonds(2, {from: accounts[1]}, t0);
    current = await get_current(sub_accounts, []);
    assert.equal(current.bond_supply, 2);

    let tax_total = 0;
    let period = 1;
    let valid_bond_supply = 0;
    for (let level = 2; level < _level_max + 2; level++) {
      now = mod(now + 1, 3);
      await _acb.setTimestamp((
          await _acb.getTimestamp()).toNumber() + _epoch_duration,
                              {from: accounts[1]});

      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 2);
      valid_bond_supply =
        period < _bond_redemption_period + _bond_redeemable_period ? 2 : 0;

      coin_supply = current.coin_supply;
      reward_total = tax_total;
      constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                   reward_total / (1 * 100));
      reward_4 = 0;
      deposit_total = deposit_4[mod(now - 2, 3)];
      if (deposit_total > 0) {
        reward_4 = Math.trunc(_proportional_reward_rate *
                              reward_total * deposit_4[mod(now - 2, 3)] /
                              (deposit_total * 100));
      }
      burned[mod(now, 3)] = (reward_total - reward_4 - constant_reward * 1);
      balance_4 = current.balances[accounts[4]];
      deposit_4[mod(now, 3)] = Math.trunc(balance_4 * _deposit_rate / 100);
      await check_vote(await _acb.encrypt(level, 4444, {from: accounts[4]}),
                       level - 1, 4444, {from: accounts[4]},
                       true,
                       (level < _level_max + 1) ? true : false,
                       deposit_4[mod(now, 3)],
                       deposit_4[mod(now - 2, 3)],
                       reward_4 + constant_reward,
                       true);

      current = await get_current(sub_accounts, []);
      coin_budget = 0;
      bond_budget = 0;
      delta = Math.trunc(current.coin_supply *
                         (_level_to_exchange_rate[level - 2] - 10) / 10);
      delta = Math.trunc(delta * _damping_factor / 100);
      if (delta == 0) {
        coin_budget = 0;
        issued_bonds = 0;
      } else if (delta > 0) {
        necessary_bonds = Math.trunc(delta / _bond_redemption_price);
        if (necessary_bonds >= valid_bond_supply) {
          coin_budget = (necessary_bonds - valid_bond_supply) *
            _bond_redemption_price;
          bond_budget = -valid_bond_supply;
        } else {
          coin_budget = 0;
          bond_budget = -necessary_bonds;
        }
      } else {
        coin_budget = level == 2 ? delta : 0;
        bond_budget = Math.trunc(-delta / _bond_price);
      }
      period += 1;
      
      assert.equal(current.oracle_level, level - 2);
      assert.equal(current.balances[accounts[4]],
                   balance_4 - deposit_4[mod(now, 3)] +
                   deposit_4[mod(now - 2, 3)] +
                   reward_4 + constant_reward);
      assert.equal(current.coin_supply,
                   coin_supply -
                   burned[mod(now - 1, 3)]);
      assert.equal(current.bond_supply, 2);
      assert.equal(current.bond_budget, bond_budget);
      assert.equal(current.valid_bond_supply, valid_bond_supply);
      assert.equal(await _open_market_operation.coin_budget_(),
                   coin_budget);

      tax_total = 0
      assert.equal(await _coin.balanceOf(await _coin.tax_account_()), 0);
      for (let transfer of [0, 1234, 1111]) {
        let tax = Math.trunc(transfer * _tax_rate / 100);
        let balance_1 = (await _coin.balanceOf(accounts[1])).toNumber();
        let balance_2 = (await _coin.balanceOf(accounts[2])).toNumber();
        let balance_tax =
            (await _coin.balanceOf(await _coin.tax_account_())).toNumber();
        await _coin.transfer(accounts[2], transfer, {from: accounts[1]});
        assert.equal(await _coin.balanceOf(accounts[1]), balance_1 - transfer);
        assert.equal(await _coin.balanceOf(accounts[2]),
                     balance_2 + transfer - tax);
        assert.equal(await _coin.balanceOf(await _coin.tax_account_()),
                     balance_tax + tax);
        tax_total += tax;
      }
    }

    now = mod(now + 1, 3);
    await check_redeem_bonds([t0], {from: accounts[1]}, valid_bond_supply,
                             2 - valid_bond_supply);
    await reset_balances(accounts);

    current = await get_current(sub_accounts, []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.coin_supply,
                 _initial_coin_supply + deposit_4[mod(now - 2, 3)] +
                 deposit_4[mod(now - 1, 3)] + burned[mod(now - 1, 3)] +
                 tax_total);

    {
      // bond operation
      await reset_balances(accounts);
      await move_coins(accounts[1], accounts[2], _bond_price * 60);
      await check_update_bond_budget(-_bond_price * 100, 100, 0);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 0);
      assert.equal(current.bond_budget, 100);
      let t1 = (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      await should_throw(async () => {
        await _acb.purchaseBonds.call(0, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(101, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(61, {from: accounts[2]});
      }, "BondOperation");
      await check_purchase_bonds(10, {from: accounts[1]}, t1);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 10);
      assert.equal(current.bond_budget, 90);
      await check_purchase_bonds(20, {from: accounts[2]}, t1);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 30);
      assert.equal(current.bond_budget, 70);
      
      await advance_epoch(1);
      await check_update_bond_budget(-_bond_price * 70, 70, 0);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 30);
      assert.equal(current.bond_budget, 70);
      let t2 = (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      await check_purchase_bonds(30, {from: accounts[1]}, t2);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 60);
      assert.equal(current.bond_budget, 40);
      await check_purchase_bonds(40, {from: accounts[2]}, t2);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 100);
      assert.equal(current.bond_budget, 0);
      await should_throw(async () => {
        await _acb.purchaseBonds.call(1, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(1, {from: accounts[2]});
      }, "BondOperation");
      await advance_epoch(_bond_redemption_period - 1);
      
      await check_update_bond_budget(_bond_redemption_price * 1, -1, 0);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_budget, -1);
      await check_update_bond_budget(_bond_redemption_price * 100, -100, 0);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_budget, -100);
      await check_update_bond_budget(_bond_redemption_price * 101, -100,
                                     _bond_redemption_price);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_budget, -100);
      await check_update_bond_budget(_bond_redemption_price * 40, -40, 0);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_budget, -40);
      
      await check_redeem_bonds([t1, t2], {from: accounts[1]}, 40, 0);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 60);
      assert.equal(current.bond_budget, -10);
      await check_redeem_bonds([t1, t2], {from: accounts[2]}, 30, 0);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 30);
      assert.equal(current.bond_budget, 0);
      
      await advance_epoch(1);
      await check_redeem_bonds([t1, t2], {from: accounts[1]}, 0, 0);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 30);
      assert.equal(current.bond_budget, 0);
      await check_redeem_bonds([t1, t2], {from: accounts[2]}, 30, 0);
      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply, 0);
      assert.equal(current.bond_budget, 0);
      await check_redeem_bonds([t1, t2], {from: accounts[2]}, 0, 0);
    }

    {
      // open market operation
      await reset_balances(accounts);
      await _acb.updateCoinBudget(0, {from: accounts[1]});
      await should_throw(async () => {
        await _acb.purchaseCoins.call({value: 0, from: accounts[1]});
      }, "OpenMarketOperation");
      await should_throw(async () => {
        await _acb.sellCoins.call(0, {from: accounts[1]});
      }, "OpenMarketOperation");
      
      let price, balance, eth_balance;
      await _acb.updateCoinBudget(100, {from: accounts[1]});
      price = (await _open_market_operation.start_price_()).toNumber();
      await should_throw(async () => {
        await _acb.sellCoins.call(0, {from: accounts[1]});
      }, "OpenMarketOperation");
      balance = (await _coin.balanceOf(accounts[1])).toNumber();
      eth_balance =
        Math.trunc(await web3.eth.getBalance(_open_market_operation.address));
      await check_purchase_coins(
        {value: 100 * price, from: accounts[1]}, 100 * price, 100);
      assert.equal(await _coin.balanceOf(accounts[1]), balance + 100);
      assert.equal(await web3.eth.getBalance(_open_market_operation.address),
                   eth_balance + 100 * price);
      
      await _acb.updateCoinBudget(100, {from: accounts[1]});
      price = (await _open_market_operation.start_price_()).toNumber();
      await should_throw(async () => {
        await _acb.sellCoins.call(0, {from: accounts[1]});
      }, "OpenMarketOperation");
      balance = (await _coin.balanceOf(accounts[1])).toNumber();
      eth_balance =
        Math.trunc(await web3.eth.getBalance(_open_market_operation.address));
      await check_purchase_coins(
        {value: 40 * price, from: accounts[1]}, 40 * price, 40);
      assert.equal(await _coin.balanceOf(accounts[1]), balance + 40);
      assert.equal(await web3.eth.getBalance(_open_market_operation.address),
                   eth_balance + 40 * price);
      await check_purchase_coins(
        {value: 70 * price, from: accounts[1]}, 60 * price, 60);
      assert.equal(await _coin.balanceOf(accounts[1]), balance + 100);
      assert.equal(await web3.eth.getBalance(_open_market_operation.address),
                   eth_balance + 100 * price);
      await should_throw(async () => {
        await _acb.purchaseCoins.call({value: 10, from: accounts[1]});
      }, "OpenMarketOperation");
      
      await _acb.updateCoinBudget(-100, {from: accounts[1]});
      price = (await _open_market_operation.start_price_()).toNumber();
      await should_throw(async () => {
        await _acb.purchaseCoins.call({value: 0, from: accounts[1]});
      }, "OpenMarketOperation");
      balance = (await _coin.balanceOf(accounts[1])).toNumber();
      eth_balance =
        Math.trunc(await web3.eth.getBalance(_open_market_operation.address));
      await check_sell_coins(100, {from: accounts[1]}, 100 * price, 100);
      assert.equal(await _coin.balanceOf(accounts[1]), balance - 100);
      assert.equal(await web3.eth.getBalance(_open_market_operation.address),
                   eth_balance - 100 * price);
      
      await _acb.updateCoinBudget(-100, {from: accounts[1]});
      price = (await _open_market_operation.start_price_()).toNumber();
      await should_throw(async () => {
        await _acb.purchaseCoins.call({value: 0, from: accounts[1]});
      }, "OpenMarketOperation");
      balance = (await _coin.balanceOf(accounts[1])).toNumber();
      eth_balance =
        Math.trunc(await web3.eth.getBalance(_open_market_operation.address));
      await check_sell_coins(40, {from: accounts[1]}, 40 * price, 40);
      assert.equal(await _coin.balanceOf(accounts[1]), balance - 40);
      assert.equal(await web3.eth.getBalance(_open_market_operation.address),
                   eth_balance - 40 * price);
      await check_sell_coins(70, {from: accounts[1]}, 60 * price, 60);
      assert.equal(await _coin.balanceOf(accounts[1]), balance - 100);
      assert.equal(await web3.eth.getBalance(_open_market_operation.address),
                   eth_balance - 100 * price);
      await should_throw(async () => {
        await _acb.sellCoins.call(10, {from: accounts[1]});
      }, "OpenMarketOperation");
    }
      
    // Payable functions
    assert.equal(await web3.eth.getBalance(_acb.address), 0);
    await check_send_transaction(
        {value: 100, from: accounts[0]}, accounts[0], 100);
    assert.equal(await web3.eth.getBalance(_acb.address), 100);
    await check_send_transaction(
        {value: 100, from: accounts[1]}, accounts[1], 100);
    assert.equal(await web3.eth.getBalance(_acb.address), 200);
    await check_send_transaction(
        {value: 100, from: accounts[0]}, accounts[0], 100);
    assert.equal(await web3.eth.getBalance(_acb.address), 300);
    eth_balance =
      Math.trunc((await web3.eth.getBalance(accounts[1])).substring(14));
    await _acb.withdrawTips({from: accounts[1]});
    assert.equal(await web3.eth.getBalance(_acb.address), 0);
    assert.equal(
      Math.trunc((
        await web3.eth.getBalance(accounts[1])).substring(14)) % 1000,
      (eth_balance + 300) % 1000);

    // Initializable
    await should_throw(async () => {
      await _acb.initialize(_coin.address, _oracle.address,
                            _bond_operation.address,
                            _open_market_operation.address,
                            _logging.address,
                            {from: accounts[1]});
    }, "Initializable");

    // Ownable
    await should_throw(async () => {
      await _acb.pause();
    }, "Ownable");

    await should_throw(async () => {
      await _acb.pause({from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await _acb.unpause();
    }, "Ownable");

    await should_throw(async () => {
      await _acb.unpause({from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await _acb.deprecate();
    }, "Ownable");

    await should_throw(async () => {
      await _acb.deprecate({from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await _acb.withdrawTips();
    }, "Ownable");

    await should_throw(async () => {
      await _acb.withdrawTips({from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await _coin.mint(accounts[1], 1, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _coin.mint(accounts[1], 1);
    }, "Ownable");

    await should_throw(async () => {
      await _coin.move(accounts[1], accounts[2], 1, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _coin.move(accounts[1], accounts[2], 1);
    }, "Ownable");

    await should_throw(async () => {
      await _coin.burn(accounts[2], 1, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _coin.burn(accounts[2], 1);
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.deprecate();
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.deprecate({from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.updateBondBudget(0, 0);
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.updateBondBudget(0, 0, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.purchaseBonds(accounts[1], 0, 0, _coin.address);
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.purchaseBonds(accounts[1], 0, 0, _coin.address,
                                          {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.redeemBonds(accounts[1], [], 0, _coin.address);
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.redeemBonds(accounts[1], [], 0, _coin.address,
                                        {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.transferOwnership(_acb.address);
    }, "Ownable");

    await should_throw(async () => {
      await _bond_operation.transferOwnership(_acb.address,
                                              {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _open_market_operation.increaseCoinSupply(0, 0);
    }, "Ownable");

    await should_throw(async () => {
      await _open_market_operation.increaseCoinSupply(
        0, 0, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _open_market_operation.decreaseCoinSupply(0, 0);
    }, "Ownable");

    await should_throw(async () => {
      await _open_market_operation.decreaseCoinSupply(
        0, 0, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _open_market_operation.updateCoinBudget(0);
    }, "Ownable");

    await should_throw(async () => {
      await _open_market_operation.updateCoinBudget(0, {from: accounts[1]});
    }, "Ownable");

    let bond = await JohnLawBond.at(await _bond_operation.bond_());
    await should_throw(async () => {
      await bond.mint(accounts[1], 1111, 1, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await bond.mint(accounts[1], 1111, 1);
    }, "Ownable");

    await should_throw(async () => {
      await bond.burn(accounts[1], 1111, 1, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await bond.burn(accounts[1], 1111, 1);
    }, "Ownable");

    let oracle = await OracleForTesting.at(await _acb.oracle_());
    await should_throw(async () => {
      await oracle.getModeLevel();
    }, "Ownable");

    await should_throw(async () => {
      await oracle.getModeLevel({from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await oracle.advance(_coin.address);
    }, "Ownable");

    await should_throw(async () => {
      await oracle.advance(_coin.address, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await oracle.revokeOwnership(_coin.address);
    }, "Ownable");

    await should_throw(async () => {
      await oracle.revokeOwnership(_coin.address, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _logging.transferOwnership(_acb.address);
    }, "Ownable");

    await should_throw(async () => {
      await _logging.transferOwnership(_acb.address,
                                       {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _logging.vote(0, false, false, 0, 0, 0);
    }, "Ownable");

    await should_throw(async () => {
      await _logging.vote(0, false, false, 0, 0, 0, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _logging.purchaseBonds(0, 0);
    }, "Ownable");

    await should_throw(async () => {
      await _logging.purchaseBonds(0, 0, {from: accounts[1]});
    }, "Ownable");

    // Pausable
    await _acb.pause({from: accounts[1]});
    await _acb.pause({from: accounts[1]});

    await should_throw(async () => {
      await _acb.vote(await _acb.encrypt(0, 0, {from: accounts[1]}),
                      0, 0, {from: accounts[1]});
    }, "Pausable");

    await should_throw(async () => {
      await _coin.transfer(accounts[2], 1, {from: accounts[1]});
    }, "Pausable");

    await should_throw(async () => {
      await _acb.withdrawTips({from: accounts[1]});
    }, "Pausable");

    await should_throw(async () => {
      await _acb.purchaseBonds(1, {from: accounts[1]});
    }, "Pausable");

    await should_throw(async () => {
      await _acb.redeemBonds([t0], {from: accounts[1]});
    }, "Pausable");

    await _acb.unpause({from: accounts[1]});
    await _acb.unpause({from: accounts[1]});

    // deprecate
    await _acb.deprecate({from: accounts[1]});

    await should_throw(async () => {
      await _acb.vote(await _acb.encrypt(0, 0, {from: accounts[1]}),
                      0, 0, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _acb.deprecate({from: accounts[1]});
    }, "Ownable");

    await _coin.transferOwnership(_acb.address, {from: accounts[1]});
    await _bond_operation.transferOwnership(_acb.address, {from: accounts[1]});
    await _open_market_operation.transferOwnership(
      _acb.address, {from: accounts[1]});
    await _logging.transferOwnership(_acb.address, {from: accounts[1]});
    await _oracle.transferOwnership(_acb.address, {from: accounts[1]});

    await _acb.deprecate({from: accounts[1]});

    async function advance_epoch(advance) {
      for (let i = 0; i < advance; i++) {
        await _acb.setTimestamp((
          await _acb.getTimestamp()).toNumber() + _epoch_duration,
                                {from: accounts[1]});
        await _acb.vote(await _acb.encrypt(
           _level_max, 7777, {from: accounts[7]}),
                        _level_max, 7777, {from: accounts[7]});
      }
    }

    function check_redemption_epochs(current, account, expected) {
      let actual = current.redemption_epochs[account];
      assert.equal(actual.length, expected.length);
      for (let index = 0; index < actual.length; index++) {
        assert.isTrue(expected.includes(actual[index]));
      }
    }

    async function set_tax() {
      assert.equal(await _coin.balanceOf(await _coin.tax_account_()), 0);
      await _acb.setCoin(await _coin.tax_account_(), _tax, {from: accounts[1]});
    }

    async function mint_at_default_level() {
      let current = await get_current([], []);
      let delta = Math.trunc(current.coin_supply * (11 - 10) / 10);
      delta = Math.trunc(delta * _damping_factor / 100);
      let mint = (Math.trunc(delta / _bond_redemption_price) *
                  _bond_redemption_price);
      assert(delta > 0);
      assert.equal(current.bond_supply, 0);
      assert.equal(current.bond_budget, 0);
      return mint;
    }

    async function check_send_transaction(option, sender, value) {
      let receipt = await _acb.sendTransaction(option);
      let args = receipt.logs.filter(
          e => e.event == 'PayableEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.value, value);
    }

    async function check_vote(
        hash, oracle_level, salt, option,
        commit_result, reveal_result, deposited, reclaimed, rewarded,
        epoch_updated) {
      let receipt = await _acb.vote(
          hash, oracle_level, salt, option);
      let args = receipt.logs.filter(e => e.event == 'VoteEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.hash, hash);
      assert.equal(args.oracle_level, oracle_level);
      assert.equal(args.salt, salt);
      assert.equal(args.commit_result, commit_result);
      assert.equal(args.reveal_result, reveal_result);
      assert.equal(args.deposited, deposited);
      assert.equal(args.reclaimed, reclaimed);
      assert.equal(args.rewarded, rewarded);
      assert.equal(args.epoch_updated, epoch_updated);
    }

    async function check_purchase_bonds(purchased_bonds, option, redemption) {
      let receipt = await _acb.purchaseBonds(purchased_bonds, option);
      let args =
          receipt.logs.filter(e => e.event == 'PurchaseBondsEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.purchased_bonds, purchased_bonds);
      assert.equal(args.redemption_epoch, redemption);
    }

    async function check_redeem_bonds(redemptions, option, redeemed_bonds,
                                      expired_bonds) {
      let receipt = await _acb.redeemBonds(redemptions, option);
      let args =
          receipt.logs.filter(e => e.event == 'RedeemBondsEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.redeemed_bonds, redeemed_bonds);
      assert.equal(args.expired_bonds, expired_bonds);
    }

    async function check_purchase_coins(option, eth_amount, coin_amount) {
      let receipt = await _acb.purchaseCoins(option);
      let args =
          receipt.logs.filter(e => e.event == 'PurchaseCoinsEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.eth_amount, eth_amount);
      assert.equal(args.coin_amount, coin_amount);
    }

    async function check_sell_coins(
      requested_coin_amount, option, eth_amount, coin_amount) {
      let receipt = await _acb.sellCoins(requested_coin_amount, option);
      let args =
          receipt.logs.filter(e => e.event == 'SellCoinsEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.eth_amount, eth_amount);
      assert.equal(args.coin_amount, coin_amount);
    }

    async function check_update_bond_budget(delta, bond_budget, mint) {
      await _acb.updateBondBudget(
        delta, (await _oracle.epoch_id_()), {from: accounts[1]});
    }

    async function get_current(accounts, redemptions) {
      let acb = {};
      acb.bond_budget = (await _bond_operation.bond_budget_()).toNumber();
      acb.oracle_level = (await _acb.oracle_level_()).toNumber();
      acb.current_epoch_start = (await _acb.current_epoch_start_()).toNumber();
      let coin = await JohnLawCoin.at(await _acb.coin_());
      let bond = await JohnLawBond.at(await _bond_operation.bond_());
      acb.coin_supply =(await coin.totalSupply()).toNumber();
      acb.bond_supply = (await bond.totalSupply()).toNumber();
      acb.valid_bond_supply =
        (await _bond_operation.validBondSupply(
          await _oracle.epoch_id_())).toNumber();
      acb.balances = {};
      acb.bonds = {};
      acb.redemption_epochs = {};
      for (let i = 0; i < accounts.length; i++) {
        acb.balances[accounts[i]] =
            (await coin.balanceOf(accounts[i])).toNumber();
        acb.bonds[accounts[i]] = {};
        for (let j = 0; j < redemptions.length; j++) {
          acb.bonds[accounts[i]][redemptions[j]] =
              (await bond.balanceOf(accounts[i], redemptions[j])).toNumber();
        }
        acb.redemption_epochs[accounts[i]] = [];
        let bond_count =
            (await bond.numberOfRedemptionEpochsOwnedBy(
                accounts[i])).toNumber();
        for (let index = 0; index < bond_count; index++) {
          let redemption = (
              await bond.getRedemptionEpochOwnedBy(
                  accounts[i], index)).toNumber();
          acb.redemption_epochs[accounts[i]].push(redemption);
        }
      }
      return acb;
    }

    async function move_coins(sender, receiver, amount) {
      await _acb.moveCoin(sender, receiver, amount, {from: accounts[1]});
    }

    async function reset_balances(account) {
      for (let account of accounts) {
        await _acb.setCoin(account, 0, {from: accounts[1]});
      }
      await _acb.setCoin(accounts[1], _initial_coin_supply,
                         {from: accounts[1]});
    }
  });
}
