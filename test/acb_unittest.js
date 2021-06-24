// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");
const Oracle = artifacts.require("Oracle");
const OracleForTesting = artifacts.require("OracleForTesting");
const Logging = artifacts.require("Logging");
const ACB = artifacts.require("ACB");
const ACBForTesting = artifacts.require("ACBForTesting");
const common = require("./common.js");
const should_throw = common.should_throw;
const mod = common.mod;

contract("ACBUnittest", function (accounts) {
  let args = common.custom_arguments();
  assert.isTrue(args.length == 11);
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
                     args[10]);
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
                            _tax) {
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
      " tax=" + _tax;
  console.log(test_name);

  it(test_name, async function () {
    let _level_max = _level_to_exchange_rate.length;

    // Cannot use deployProxy because {from: ...} is not supported.
    let _oracle = await OracleForTesting.new({from: accounts[1]});
    common.print_contract_size(_oracle, "OracleForTesting");
    await _oracle.initialize({from: accounts[1]});

    // Cannot use deployProxy because {from: ...} is not supported.
    let _coin = await JohnLawCoin.new({from: accounts[1]});
    common.print_contract_size(_coin, "JohnLawCoin");
    await _coin.initialize({from: accounts[1]});
    let _bond = await JohnLawBond.new({from: accounts[1]});
    common.print_contract_size(_bond, "JohnLawBond");
    await _bond.initialize({from: accounts[1]});
    let _logging = await Logging.new({from: accounts[1]});
    await _logging.initialize({from: accounts[1]});
    common.print_contract_size(_logging, "Logging");
    let _acb = await ACBForTesting.new({from: accounts[1]});
    common.print_contract_size(_acb, "ACBForTesting");
    await _acb.initialize(_coin.address, _bond.address,
                          _oracle.address, _logging.address,
                          {from: accounts[1]});

    await _oracle.overrideConstants(
        _level_max, _reclaim_threshold, _proportional_reward_rate,
        {from: accounts[1]});
    await _coin.transferOwnership(_acb.address, {from: accounts[1]});
    await _bond.transferOwnership(_acb.address, {from: accounts[1]});
    await _logging.transferOwnership(_acb.address, {from: accounts[1]});
    await _oracle.transferOwnership(_acb.address, {from: accounts[1]});
    await _acb.overrideConstants(_bond_price,
                                 _bond_redemption_price,
                                 _bond_redemption_period,
                                 _bond_redeemable_period,
                                 _epoch_duration,
                                 _deposit_rate,
                                 _damping_factor,
                                 _level_to_exchange_rate,
                                 {from: accounts[1]});

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

    // controlSupply
    await _acb.setOracleLevel(_level_max - 1, {from: accounts[1]});
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(_bond_redemption_price - 1, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(_bond_redemption_price, 0,
                              _bond_redemption_price);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(_bond_redemption_price + 1, 0,
                              _bond_redemption_price);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(_bond_redemption_price * 10, 0,
                              _bond_redemption_price * 10);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);

    await check_controlSupply(-(_bond_price - 1), 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(-_bond_price, 1, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0, 0);
    assert.equal(current.bond_budget, 1);
    await check_controlSupply(0, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(-_bond_price * 99, 99, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 99);
    await check_controlSupply(0, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(-_bond_price * 100, 100, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 100);

    await check_purchase_bonds(50, {from: accounts[1]},
                               (await _oracle.epoch_id_()).toNumber() +
                               _bond_redemption_period);
    await check_purchase_bonds(50, {from: accounts[1]},
                               (await _oracle.epoch_id_()).toNumber() +
                               _bond_redemption_period);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 100);
    assert.equal(current.bond_budget, 0);

    await check_controlSupply(_bond_redemption_price - 1, 0, 0);
    current = await get_current([], []);
    await check_controlSupply(_bond_redemption_price, -1, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -1);
    await check_controlSupply(_bond_redemption_price + 1, -1, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -1);
    await check_controlSupply(_bond_redemption_price * 68, -68, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -68);
    await check_controlSupply(0, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(_bond_redemption_price * 30, -30, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -30);
    await check_controlSupply(_bond_redemption_price - 1, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(_bond_redemption_price * 200,
                              -100,
                              _bond_redemption_price * 100);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -100);
    await check_controlSupply(_bond_redemption_price * 100, -100, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -100);
    await check_controlSupply(_bond_redemption_price * 100, -100, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -100);

    await check_controlSupply(-_bond_price * 100, 100, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 100);
    assert.equal(current.bond_budget, 100);

    await check_purchase_bonds(50, {from: accounts[1]},
                               (await _oracle.epoch_id_()).toNumber() +
                               _bond_redemption_period);
    await check_purchase_bonds(50, {from: accounts[1]},
                               (await _oracle.epoch_id_()).toNumber() +
                               _bond_redemption_period);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 200);
    assert.equal(current.bond_budget, 0);

    await check_controlSupply(_bond_redemption_price * 30 - 1, -29, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -29);
    await check_controlSupply(_bond_redemption_price * 30, -30, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -30);
    await check_controlSupply(_bond_redemption_price * 30 + 1, -30, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -30);
    await check_controlSupply(_bond_redemption_price * 210,
                              -200,
                              _bond_redemption_price * 10);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -200);

    await check_redeem_bonds(
      [(await _oracle.epoch_id_()).toNumber() + _bond_redemption_period],
      {from: accounts[1]}, 200);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);

    // timestamp
    assert.equal(await _acb.getTimestamp(), 0);
    await _acb.setTimestamp(_epoch_duration, {from: accounts[1]});
    assert.equal(await _acb.getTimestamp(), _epoch_duration);

    await should_throw(async () => {
      await _acb.setTimestamp(_epoch_duration - 1, {from: accounts[1]});
    }, "st1");

    await should_throw(async () => {
      await _acb.setTimestamp(_epoch_duration, {from: accounts[1]});
    }, "st1");

    await should_throw(async () => {
      await _acb.setTimestamp(0, {from: accounts[1]});
    }, "st1");

    if (_bond_price >= 2 &&
        _bond_redemption_price >= 2 &&
        _bond_redemption_period >= 3 &&
        _bond_redeemable_period >= 3 &&
        _epoch_duration >= 2) {

      // purchase_bonds
      await check_controlSupply(-_bond_price * 80, 80, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply, 0);
      assert.equal(current.bond_budget, 80);

      coin_supply = current.coin_supply;

      await advance_epoch(_epoch_duration);
      let t1 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      redemptions = [t1];

      await _acb.moveCoin(
        accounts[1], accounts[2], _bond_price * 30, {from: accounts[1]});
      await _acb.moveCoin(
        accounts[1], accounts[3], _bond_price * 50, {from: accounts[1]});
      await should_throw(async () => {
        await _acb.purchaseBonds.call(1, {from: accounts[4]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(1, {from: accounts[5]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(0, {from: accounts[1]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(81, {from: accounts[1]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(0, {from: accounts[2]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(81, {from: accounts[2]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(31, {from: accounts[2]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(0, {from: accounts[3]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(81, {from: accounts[3]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(51, {from: accounts[3]});
      }, "PurchaseBonds");

      await check_purchase_bonds(1, {from: accounts[2]}, t1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 1);
      assert.equal(current.bond_budget, 79);
      assert.equal(current.bonds[accounts[2]][t1], 1);
      check_redemption_epochs(current, accounts[2], [t1]);
      assert.equal(current.coin_supply,
                   coin_supply - _bond_price * 1);

      await check_purchase_bonds(10, {from: accounts[2]}, t1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 11);
      assert.equal(current.bond_budget, 69);
      assert.equal(current.bonds[accounts[2]][t1], 11);
      check_redemption_epochs(current, accounts[2], [t1]);
      assert.equal(current.coin_supply,
                   coin_supply - _bond_price * 11);

      await should_throw(async () => {
        await _acb.purchaseBonds.call(70, {from: accounts[1]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(70, {from: accounts[3]});
      }, "PurchaseBonds");

      await advance_epoch(_epoch_duration);
      let t2 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      redemptions = [t2];

      await check_purchase_bonds(1, {from: accounts[2]}, t2);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 12);
      assert.equal(current.bond_budget, 68);
      assert.equal(current.bonds[accounts[2]][t2], 1);
      check_redemption_epochs(current, accounts[2], [t1, t2]);
      assert.equal(current.coin_supply,
                   coin_supply - _bond_price * 12);

      await check_purchase_bonds(10, {from: accounts[2]}, t2);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 22);
      assert.equal(current.bond_budget, 58);
      assert.equal(current.bonds[accounts[2]][t2], 11);
      check_redemption_epochs(current, accounts[2], [t1, t2]);
      assert.equal(current.coin_supply,
                   coin_supply - _bond_price * 22);

      await should_throw(async () => {
        await _acb.purchaseBonds.call(59, {from: accounts[1]});
      }, "PurchaseBonds");
      await should_throw(async () => {
        await _acb.purchaseBonds.call(59, {from: accounts[3]});
      }, "PurchaseBonds");

      await check_purchase_bonds(10, {from: accounts[1]}, t2);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 32);
      assert.equal(current.bond_budget, 48);
      assert.equal(current.bonds[accounts[1]][t2], 10);
      check_redemption_epochs(current, accounts[1], [t2]);
      assert.equal(current.coin_supply,
                   coin_supply - _bond_price * 32);

      await advance_epoch(_epoch_duration);
      let t3 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      redemptions = [t3];

      await should_throw(async () => {
        await _acb.purchaseBonds.call(49, {from: accounts[3]});
      }, "PurchaseBonds");
      await check_purchase_bonds(48, {from: accounts[3]}, t3);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 80);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bonds[accounts[3]][t3], 48);
      check_redemption_epochs(current, accounts[3], [t3]);
      assert.equal(current.coin_supply,
                   coin_supply - _bond_price * 80);

      await _acb.moveCoin(accounts[1], accounts[2],
                          _bond_price * 10, {from: accounts[1]});
      await _acb.moveCoin(accounts[1], accounts[3],
                          _bond_price * 10, {from: accounts[1]});
      await should_throw(async () => {
        await _acb.purchaseBonds.call(1, {from: accounts[2]});
      }, "PurchaseBonds");
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 80);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bonds[accounts[3]][t3], 48);
      check_redemption_epochs(current, accounts[3], [t3]);
      assert.equal(current.coin_supply,
                   coin_supply - _bond_price * 80);
      await should_throw(async () => {
        await _acb.purchaseBonds.call(1, {from: accounts[3]});
      }, "PurchaseBonds");
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 80);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bonds[accounts[3]][t3], 48);
      check_redemption_epochs(current, accounts[3], [t3]);
      assert.equal(current.coin_supply,
                   coin_supply - _bond_price * 80);

      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.balances[accounts[2]],
                   (30 + 10 - 22) * _bond_price);
      assert.equal(current.balances[accounts[3]],
                   (50 + 10 - 48) * _bond_price);

      // redeem_bonds
      redemptions = [t1, t2, t3];
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t1], 11);
      assert.equal(current.bonds[accounts[1]][t2], 10);
      assert.equal(current.bonds[accounts[2]][t2], 11);
      assert.equal(current.bonds[accounts[3]][t3], 48);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[1]), 10);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[2]), 22);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[3]), 48);
      check_redemption_epochs(current, accounts[1], [t2]);
      check_redemption_epochs(current, accounts[2], [t1, t2]);
      check_redemption_epochs(current, accounts[3], [t3]);

      await advance_epoch(_epoch_duration * _bond_redemption_period);
      let t4 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      redemptions = [t1, t2, t3, t4];

      assert.equal(await _acb.redeemBonds.call(
          [t1], {from: accounts[4]}), 0);
      assert.equal(await _acb.redeemBonds.call(
          [], {from: accounts[2]}), 0);

      current = await get_current(sub_accounts, redemptions);
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      balance = current.balances[accounts[2]];
      assert.equal(current.bond_budget, 0);
      await check_redeem_bonds([t1], {from: accounts[2]}, 11);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t1], 0);
      assert.equal(current.bonds[accounts[2]][t2], 11);
      assert.equal(current.bonds[accounts[2]][t3], 0);
      check_redemption_epochs(current, accounts[2], [t2]);
      assert.equal(current.balances[accounts[2]],
                   balance + 11 * _bond_redemption_price);
      assert.equal(current.bond_budget, 11);
      assert.equal(current.bond_supply, bond_supply - 11);
      assert.equal(current.coin_supply, coin_supply +
                   11 * _bond_redemption_price);

      await check_redeem_bonds([t2, 123456], {from: accounts[2]}, 11);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t1], 0);
      assert.equal(current.bonds[accounts[2]][t2], 0);
      check_redemption_epochs(current, accounts[2], []);
      assert.equal(current.balances[accounts[2]],
                   balance + 22 * _bond_redemption_price);
      assert.equal(current.bond_budget, 22);
      assert.equal(current.bond_supply, bond_supply - 22);
      assert.equal(current.coin_supply, coin_supply +
                   22 * _bond_redemption_price);

      assert.equal(await _acb.redeemBonds.call(
          [t3], {from: accounts[2]}), 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t1], 0);
      assert.equal(current.bonds[accounts[2]][t2], 0);
      assert.equal(current.bonds[accounts[2]][t3], 0);
      check_redemption_epochs(current, accounts[2], []);
      assert.equal(current.balances[accounts[2]],
                   balance + 22 * _bond_redemption_price);
      assert.equal(current.bond_budget, 22);
      assert.equal(current.bond_supply, bond_supply - 22);
      assert.equal(current.coin_supply, coin_supply +
                   22 * _bond_redemption_price);

      balance = current.balances[accounts[3]];
      assert.equal(await _acb.redeemBonds.call(
          [t2, t2, t1], {from: accounts[3]}), 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[3]][t1], 0);
      assert.equal(current.bonds[accounts[3]][t2], 0);
      assert.equal(current.bonds[accounts[3]][t3], 48);
      check_redemption_epochs(current, accounts[3], [t3]);
      assert.equal(current.balances[accounts[3]], balance);
      assert.equal(current.bond_budget, 22);
      assert.equal(current.bond_supply, bond_supply - 22);
      assert.equal(current.coin_supply, coin_supply +
                   22 * _bond_redemption_price);

      await check_redeem_bonds([t3, t3, t3], {from: accounts[3]}, 48);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[3]][t1], 0);
      assert.equal(current.bonds[accounts[3]][t2], 0);
      assert.equal(current.bonds[accounts[3]][t3], 0);
      check_redemption_epochs(current, accounts[3], []);
      assert.equal(current.balances[accounts[3]],
                   balance + 48 * _bond_redemption_price);
      assert.equal(current.bond_budget, 70);
      assert.equal(current.bond_supply, bond_supply - 70);
      assert.equal(current.coin_supply, coin_supply +
                   70 * _bond_redemption_price);

      balance = current.balances[accounts[1]];
      await check_redeem_bonds([t2], {from: accounts[1]}, 10);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[1]][t2], 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[1]), 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[2]), 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[3]), 0);
      check_redemption_epochs(current, accounts[1], []);
      assert.equal(current.balances[accounts[1]],
                   balance + 10 * _bond_redemption_price);
      assert.equal(current.bond_budget, 80);
      assert.equal(current.bond_supply, bond_supply - 80);
      assert.equal(current.coin_supply, coin_supply +
                   80 * _bond_redemption_price);
      assert.equal(current.bond_supply, 0);

      assert.equal(current.bond_budget, 80);
      await check_controlSupply(-100 * _bond_price, 100, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, 100);

      balance = current.balances[accounts[2]];
      await _acb.moveCoin(accounts[2], accounts[1],
                          balance, {from: accounts[1]});
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.balances[accounts[2]], 0);
      await _acb.moveCoin(accounts[1], accounts[2],
                          100 * _bond_price, {from: accounts[1]});
      await check_purchase_bonds(20, {from: accounts[2]}, t4);
      await advance_epoch(1);
      let t5 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      redemptions.push(t5);
      await check_purchase_bonds(20, {from: accounts[2]}, t5);
      await advance_epoch(_epoch_duration * _bond_redemption_period - 2);
      let t6 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      redemptions.push(t6);
      await check_purchase_bonds(20, {from: accounts[2]}, t6);
      await advance_epoch(1);
      let t7 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      redemptions.push(t7);
      await check_purchase_bonds(20, {from: accounts[2]}, t7);
      await advance_epoch(_epoch_duration);
      let t8 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
      redemptions.push(t8);
      await check_purchase_bonds(20, {from: accounts[2]}, t8);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.balances[accounts[2]], 0);
      assert.equal(t4, t5);
      assert.notEqual(t4, t6);
      assert.equal(t7 - t4, _bond_redemption_period);
      assert.equal(t8 - t7, 1);

      assert.equal(current.bond_budget, 0);

      redemptions = [t4, t5, t6, t7, t8];

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_redeem_bonds([t4, t5, t6, t7, t8], {from: accounts[2]}, 40);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t4], 0);
      assert.equal(current.bonds[accounts[2]][t5], 0);
      assert.equal(current.bonds[accounts[2]][t6], 20);
      assert.equal(current.bonds[accounts[2]][t7], 20);
      assert.equal(current.bonds[accounts[2]][t8], 20);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[1]), 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[2]), 60);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[3]), 0);
      check_redemption_epochs(current, accounts[2], [t6, t7, t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 40 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 40);
      assert.equal(current.bond_budget, 40);

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_redeem_bonds([t6, t7, t8], {from: accounts[2]}, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 20);
      assert.equal(current.bonds[accounts[2]][t7], 20);
      assert.equal(current.bonds[accounts[2]][t8], 20);
      check_redemption_epochs(current, accounts[2], [t6, t7, t8]);
      assert.equal(current.coin_supply, coin_supply);
      assert.equal(current.bond_supply, bond_supply);
      assert.equal(current.bond_budget, 40);

      await check_controlSupply(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_redeem_bonds([t6, t7, t8], {from: accounts[2]}, 5);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 15);
      assert.equal(current.bonds[accounts[2]][t7], 20);
      assert.equal(current.bonds[accounts[2]][t8], 20);
      check_redemption_epochs(current, accounts[2], [t6, t7, t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 5 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 5);
      assert.equal(current.bond_budget, 0);

      assert.equal(current.bond_budget, 0);
      await check_controlSupply(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_redeem_bonds([t8, t7, t6], {from: accounts[2]}, 5);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 15);
      assert.equal(current.bonds[accounts[2]][t7], 20);
      assert.equal(current.bonds[accounts[2]][t8], 15);
      check_redemption_epochs(current, accounts[2], [t6, t7, t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 5 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 5);
      assert.equal(current.bond_budget, 0);

      assert.equal(current.bond_budget, 0);
      await check_controlSupply(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_redeem_bonds([t7], {from: accounts[2]}, 5);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 15);
      assert.equal(current.bonds[accounts[2]][t7], 15);
      assert.equal(current.bonds[accounts[2]][t8], 15);
      check_redemption_epochs(current, accounts[2], [t6, t7, t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 5 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 5);
      assert.equal(current.bond_budget, 0);

      await advance_epoch(_epoch_duration * _bond_redemption_period -
                          _epoch_duration - 1);
      let t9 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;

      assert.equal(current.bond_budget, 0);
      await check_controlSupply(20 * _bond_redemption_price, -20, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -20);

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      assert.equal(t9 - t6, _bond_redemption_period);
      assert.equal(t6 <= (await _oracle.epoch_id_()), true);
      await check_redeem_bonds([t6, t8, t7], {from: accounts[2]}, 20);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 0);
      assert.equal(current.bonds[accounts[2]][t7], 15);
      assert.equal(current.bonds[accounts[2]][t8], 10);
      check_redemption_epochs(current, accounts[2], [t7, t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 20 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 20);
      assert.equal(current.bond_budget, 0);

      await check_controlSupply(15 * _bond_redemption_price, -15, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -15);
      await check_controlSupply(30 * _bond_redemption_price,
                                 -25,
                                 5 * _bond_redemption_price);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -25);
      await check_controlSupply(1 * _bond_redemption_price, -1, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -1);

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_redeem_bonds([t7, t8], {from: accounts[2]}, 1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 0);
      assert.equal(current.bonds[accounts[2]][t7], 14);
      assert.equal(current.bonds[accounts[2]][t8], 10);
      check_redemption_epochs(current, accounts[2], [t7, t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 1 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 1);
      assert.equal(current.bond_budget, 0);

      await advance_epoch(1);
      let t10 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;

      await check_controlSupply(2 * _bond_redemption_price, -2, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -2);

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_redeem_bonds([t8, t7], {from: accounts[2]}, 16);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 0);
      assert.equal(current.bonds[accounts[2]][t7], 0);
      assert.equal(current.bonds[accounts[2]][t8], 8);
      check_redemption_epochs(current, accounts[2], [t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 16 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 16);
      assert.equal(current.bond_budget, 14);

      await check_controlSupply(1 * _bond_redemption_price, -1, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -1);

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_redeem_bonds([t8], {from: accounts[2]}, 1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 0);
      assert.equal(current.bonds[accounts[2]][t7], 0);
      assert.equal(current.bonds[accounts[2]][t8], 7);
      check_redemption_epochs(current, accounts[2], [t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 1 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 1);
      assert.equal(current.bond_budget, 0);

      await advance_epoch(_epoch_duration);
      let t11 =
          (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;

      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_redeem_bonds([t8], {from: accounts[2]}, 7);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 0);
      assert.equal(current.bonds[accounts[2]][t7], 0);
      assert.equal(current.bonds[accounts[2]][t8], 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[1]), 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[2]), 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[3]), 0);
      check_redemption_epochs(current, accounts[2], []);
      assert.equal(current.coin_supply,
                   coin_supply + 7 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 7);
      assert.equal(current.bond_budget, 7);

      assert.equal(current.bond_supply, 0);
      assert.equal(current.bond_budget, 7);
      await check_controlSupply(5 * _bond_redemption_price,
                                 0,
                                 5 * _bond_redemption_price);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, 0);
    }

    // bond expire
    await check_controlSupply(-_bond_price * 80, 80, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 80);
        
    await _acb.moveCoin(
      accounts[1], accounts[2], _bond_price * 30, {from: accounts[1]});
        
    await advance_epoch(_epoch_duration);
    t1 = (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
    redemptions = [t1]

    await check_purchase_bonds(10, {from: accounts[2]}, t1);
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 10);
    assert.equal(current.valid_bond_supply, 10);
    assert.equal(current.bonds[accounts[2]][t1], 10);
    check_redemption_epochs(current, accounts[2], [t1]);

    await advance_epoch(_epoch_duration);
    t2 = (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
    redemptions = [t1, t2]

    await check_purchase_bonds(20, {from: accounts[2]}, t2);
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 30);
    assert.equal(current.valid_bond_supply, 30);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t1, t2]);

    await advance_epoch(_epoch_duration *
                        (_bond_redemption_period +
                         _bond_redeemable_period - 2));
        
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 30);
    assert.equal(current.valid_bond_supply, 30);
    assert.equal(current.bonds[accounts[2]][t1], 10);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t1, t2]);

    await check_redeem_bonds([t1], {from: accounts[2]}, 10);
    await check_redeem_bonds([t1], {from: accounts[2]}, 0);

    await advance_epoch(_epoch_duration);
        
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 20);
    assert.equal(current.valid_bond_supply, 20);
    assert.equal(current.bonds[accounts[2]][t1], 0);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t2]);

    await check_redeem_bonds([t2], {from: accounts[2]}, 20);
    await check_redeem_bonds([t2], {from: accounts[2]}, 0);

    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.valid_bond_supply, 0);
    assert.equal(current.bonds[accounts[2]][t1], 0);
    assert.equal(current.bonds[accounts[2]][t2], 0);
    check_redemption_epochs(current, accounts[2], []);

    await _acb.moveCoin(
      accounts[1], accounts[2], _bond_price * 30, {from: accounts[1]});
        
    await advance_epoch(_epoch_duration);
    t1 = (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
    redemptions = [t1];

    await check_purchase_bonds(10, {from: accounts[2]}, t1);
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 10);
    assert.equal(current.valid_bond_supply, 10);
    assert.equal(current.bonds[accounts[2]][t1], 10);
    check_redemption_epochs(current, accounts[2], [t1]);

    await advance_epoch(_epoch_duration);
    t2 = (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
    redemptions = [t1, t2];

    await check_purchase_bonds(20, {from: accounts[2]}, t2);
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 30);
    assert.equal(current.valid_bond_supply, 30);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t1, t2]);

    await advance_epoch(_epoch_duration *
                        (_bond_redemption_period +
                         _bond_redeemable_period - 1));
        
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 30);
    assert.equal(current.valid_bond_supply, 20);
    assert.equal(current.bonds[accounts[2]][t1], 10);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t1, t2]);

    await check_redeem_bonds([t1], {from: accounts[2]}, 0);

    await advance_epoch(_epoch_duration);
        
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 20);
    assert.equal(current.valid_bond_supply, 0);
    assert.equal(current.bonds[accounts[2]][t1], 0);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t2]);

    await check_redeem_bonds([t2], {from: accounts[2]}, 0);

    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.valid_bond_supply, 0);
    assert.equal(current.bonds[accounts[2]][t1], 0);
    assert.equal(current.bonds[accounts[2]][t2], 0);
    check_redemption_epochs(current, accounts[2], []);

    await _acb.setTimestamp(
      (await _acb.getTimestamp()).toNumber() + _epoch_duration,
      {from: accounts[1]});

    let remainder = [0, 0, 0];
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
    balance = current.balances[accounts[4]];
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
    let mint = await mint_at_default_level();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    remainder[mod(now, 3)] = _tax - reward;
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

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = 0;

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    remainder[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + _tax;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if( deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    remainder[mod(now, 3)] = _tax - reward;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    remainder[mod(now, 3)] = _tax - reward;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    remainder[mod(now, 3)] = _tax - reward;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = Math.trunc((100 - _proportional_reward_rate) *
                        _tax / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.trunc(_proportional_reward_rate *
                           _tax / 100);
    }
    remainder[mod(now, 3)] = _tax - reward;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = 0;

    current = await get_current(sub_accounts, []);
    balance = current.balances[accounts[4]];
    coin_supply = current.coin_supply;
    reward = 0;
    remainder[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + _tax - reward;
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
                 remainder[mod(now - 1, 3)]);

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
    mint = 0;

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    remainder[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + _tax;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = 0;

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    remainder[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + _tax;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = 0;

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    remainder[mod(now, 3)] = (deposit_4[mod(now - 2, 3)] +
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    await reset_balances(accounts);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();
    
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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = 0 + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = 0;

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                    deposit_6[mod(now - 2, 3)] + _tax);
    constant_reward = 0;
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    remainder[mod(now, 3)] = reward_total;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

    current = await get_current([accounts[1]], []);
    coin_supply = current.coin_supply;
    reward_total = deposit_5[mod(now - 2, 3)] + _tax;
    constant_reward = Math.trunc((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = 0;

    current = await get_current([accounts[1]], []);
    coin_supply = current.coin_supply;
    remainder[mod(now, 3)] = deposit_6[mod(now - 2, 3)] + _tax;
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
                 remainder[mod(now - 1, 3)]);

    // 3 commits on the stable level and another level.

    // 0, stable, stable
    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = reward_total;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = 0;

    current = await get_current(sub_accounts, []);
    coin_supply = current.coin_supply;
    reward_total = deposit14 + _tax;
    constant_reward = 0;
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    remainder[mod(now, 3)] = reward_total;
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

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
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    _deposit_rate = tmp_deposit_rate;
    _acb.setDepositRate(_deposit_rate, {from: accounts[1]});

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    // stable, stable, level_max - 1
    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

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
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    _deposit_rate = tmp_deposit_rate;
    _acb.setDepositRate(_deposit_rate, {from: accounts[1]});

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    // stable, stable, level_max - 1; deposit is the same
    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    // all levels
    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    await reset_balances(accounts);
    mint = await mint_at_default_level();
    
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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.setTimestamp((
        await _acb.getTimestamp()).toNumber() + _epoch_duration,
                            {from: accounts[1]});
    await set_tax();
    mint = await mint_at_default_level();

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
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
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
                 remainder[mod(now - 1, 3)]);

    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_controlSupply(-_bond_price * 2, 2, 0);
    current = await get_current(sub_accounts, []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 2);
    let t12 = (await _oracle.epoch_id_()).toNumber() + _bond_redemption_period;
    await check_purchase_bonds(2, {from: accounts[1]}, t12);
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
      mint = 0;
      bond_budget = 0;
      delta = Math.trunc(current.coin_supply *
                         (_level_to_exchange_rate[level - 2] - 10) / 10);
      delta = Math.trunc(delta * _damping_factor / 100);
      if (delta == 0) {
        mint = 0;
        issued_bonds = 0;
      } else if (delta > 0) {
        necessary_bonds = Math.trunc(delta / _bond_redemption_price);
        if (necessary_bonds >= valid_bond_supply) {
          mint = (necessary_bonds - valid_bond_supply) * _bond_redemption_price;
          bond_budget = -valid_bond_supply;
        } else {
          mint = 0;
          bond_budget = -necessary_bonds;
        }
      } else {
        mint = 0;
        bond_budget = Math.trunc(-delta / _bond_price);
      }
      period += 1;

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
      remainder[mod(now, 3)] = (reward_total - reward_4 - constant_reward * 1);
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
      assert.equal(current.oracle_level, level - 2);
      assert.equal(current.balances[accounts[4]],
                   balance_4 - deposit_4[mod(now, 3)] +
                   deposit_4[mod(now - 2, 3)] +
                   reward_4 + constant_reward);
      assert.equal(current.coin_supply,
                   coin_supply -
                   remainder[mod(now - 1, 3)]);
      assert.equal(current.bond_supply, 2);
      assert.equal(current.bond_budget, bond_budget);
      assert.equal(current.valid_bond_supply, valid_bond_supply);

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
    await check_redeem_bonds([t12], {from: accounts[1]}, valid_bond_supply);
    await reset_balances(accounts);

    current = await get_current(sub_accounts, []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.coin_supply,
                 _initial_coin_supply + deposit_4[mod(now - 2, 3)] +
                 deposit_4[mod(now - 1, 3)] + remainder[mod(now - 1, 3)] +
                 tax_total);

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
    let eth_balance =
        Math.trunc((await web3.eth.getBalance(accounts[1])).substring(14));
    await _acb.withdrawTips({from: accounts[1]});
    assert.equal(await web3.eth.getBalance(_acb.address), 0);
    assert.equal(
      Math.trunc((
        await web3.eth.getBalance(accounts[1])).substring(14)) % 1000,
      (eth_balance + 300) % 1000);

    // Initializable
    await should_throw(async () => {
      await _acb.initialize(_coin.address, _bond.address,
                            _oracle.address, _logging.address,
                            {from: accounts[1]});
    }, "Initializable");

    // Ownable
    await should_throw(async () => {
      await _acb._controlSupply(0, {from: accounts[1]});
    }, "not a function");

    await should_throw(async () => {
      await _acb._controlSupply(0);
    }, "not a function");

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

    let bond = await JohnLawBond.at(await _acb.bond_());
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

    let oracle = await Oracle.at(await _acb.oracle_());
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
      await _acb.purchaseBonds(1, {from: accounts[1]});
    }, "Pausable");

    await should_throw(async () => {
      await _acb.redeemBonds([t12], {from: accounts[1]});
    }, "Pausable");

    await should_throw(async () => {
      await _acb.controlSupply(0, {from: accounts[1]});
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
    await _bond.transferOwnership(_acb.address, {from: accounts[1]});
    await _logging.transferOwnership(_acb.address, {from: accounts[1]});
    await _oracle.transferOwnership(_acb.address, {from: accounts[1]});

    await _acb.deprecate({from: accounts[1]});

    async function advance_epoch(amount) {
      let bond_budget = (await _acb.bond_budget_()).toNumber();
      let remaining = amount;
      while (remaining > 0) {
        let time_to_next_epoch = (
          _epoch_duration -
            (await _acb.getTimestamp()).toNumber() +
            (await _acb.current_epoch_start_()).toNumber());
        let advance = Math.min(time_to_next_epoch, remaining);
        if (advance > 0) {
          await _acb.setTimestamp(
            (await _acb.getTimestamp()).toNumber() + advance,
            {from: accounts[1]});
        }
        await _acb.vote(
          await _acb.encrypt(_level_max, 1, {from: accounts[7]}),
          _level_max, 1, {from: accounts[7]});
        remaining -= advance;
      }
      assert.equal(await check_controlSupply(
        -_bond_price * bond_budget, bond_budget, 0));
      assert.equal(await _acb.bond_budget_(), bond_budget);
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

    async function check_purchase_bonds(count, option, redemption) {
      let receipt = await _acb.purchaseBonds(count, option);
      let args =
          receipt.logs.filter(e => e.event == 'PurchaseBondsEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.count, count);
      assert.equal(args.redemption_epoch, redemption);
    }

    async function check_redeem_bonds(redemptions, option, count_total) {
      let receipt = await _acb.redeemBonds(redemptions, option);
      let args =
          receipt.logs.filter(e => e.event == 'RedeemBondsEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.count, count_total);
    }

    async function check_controlSupply(delta, bond_budget, mint) {
      let receipt = await _acb.controlSupply(delta, {from: accounts[1]});
      let args =
          receipt.logs.filter(e => e.event == 'ControlSupplyEvent')[0].args;
      assert.equal(args.delta, delta);
      assert.equal(args.bond_budget, bond_budget);
      assert.equal(args.mint, mint);
    }

    async function get_current(accounts, redemptions) {
      let acb = {};
      acb.bond_budget = (await _acb.bond_budget_()).toNumber();
      acb.oracle_level = (await _acb.oracle_level_()).toNumber();
      acb.current_epoch_start = (await _acb.current_epoch_start_()).toNumber();
      let coin = await JohnLawCoin.at(await _acb.coin_());
      let bond = await JohnLawBond.at(await _acb.bond_());
      acb.coin_supply =(await coin.totalSupply()).toNumber();
      acb.bond_supply = (await bond.totalSupply()).toNumber();
      acb.valid_bond_supply = (await _acb.validBondSupply()).toNumber();
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
