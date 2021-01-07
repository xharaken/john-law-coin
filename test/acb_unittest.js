const TokenSupply = artifacts.require("TokenSupply");
const TokenHolder = artifacts.require("TokenHolder");
const Oracle = artifacts.require("Oracle");
const OracleForTesting = artifacts.require("OracleForTesting");
const ACB = artifacts.require("ACB");
const ACBForTesting = artifacts.require("ACBForTesting");

contract("ACBUnittest", function (accounts) {
  bond_redemption_price = 1000;
  bond_redemption_period = 10;
  phase_duration = 2;
  proportional_reward_rate = 80;
  deposit_rate = 10;
  dumping_factor = 30;
  reclaim_threshold = 1;
  level_to_exchange_rate = [1, 11, 20];
  level_to_bond_price = [990, 997, 997];

  parameterized_test(accounts,
                     bond_redemption_price,
                     bond_redemption_period,
                     phase_duration,
                     proportional_reward_rate,
                     deposit_rate,
                     dumping_factor,
                     level_to_exchange_rate,
                     level_to_bond_price,
                     reclaim_threshold);
});

function parameterized_test(accounts,
                            _bond_redemption_price,
                            _bond_redemption_period,
                            _phase_duration,
                            _proportional_reward_rate,
                            _deposit_rate,
                            _dumping_factor,
                            _level_to_exchange_rate,
                            _level_to_bond_price,
                            _reclaim_threshold) {
  let test_name = "ACB parameters:" +
      " bond_redemp_price=" + _bond_redemption_price +
      " bond_redemp_period=" + _bond_redemption_period +
      " phase_duration=" + _phase_duration +
      " reward_rate=" + _proportional_reward_rate +
      " deposit_rate=" + _deposit_rate +
      " dumping_factor=" + _dumping_factor +
      " level_to_exchange_rate=" + _level_to_exchange_rate +
      " level_to_bond_price=" + _level_to_bond_price +
      " reclaim=" + _reclaim_threshold;
  _coin_transfer_max = 100000000;
  _initial_coin_supply = 2100000;

  it(test_name, async function () {
    let _acb = await ACBForTesting.new(_bond_redemption_price,
                                       _bond_redemption_period,
                                       _phase_duration,
                                       _proportional_reward_rate,
                                       _deposit_rate,
                                       _dumping_factor,
                                       _reclaim_threshold,
                                       _level_to_exchange_rate,
                                       _level_to_bond_price,
                                       _coin_transfer_max,
                                       _initial_coin_supply,
                                       {from: accounts[1], gas: 30000000});
    let _level_max = _level_to_exchange_rate.length;
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

    if (_level_to_bond_price[_level_max - 1] >= 2 &&
        _bond_redemption_price >= 2 &&
        _bond_redemption_period >= 3 &&
        _phase_duration >= 2) {

      // create_account
      assert.equal(await _acb.create_account.call(
          {from: accounts[1]}), false);
      await check_create_account({from: accounts[2]});
      check_create_account({from: accounts[3]});
      assert.equal(await _acb.create_account.call({from: accounts[1]}), false);
      assert.equal(await _acb.create_account.call({from: accounts[2]}), false);
      assert.equal(await _acb.create_account.call({from: accounts[3]}), false);

      // initial coin supply
      current = await get_current(sub_accounts, []);
      assert.equal(current.balances[accounts[1]].amount, _initial_coin_supply);
      assert.equal(current.balances[accounts[2]].amount, 0);
      assert.equal(current.balances[accounts[3]].amount, 0);

      // transfer
      assert.equal(await _acb.transfer.call(
          accounts[1], 1, {from: accounts[4]}), 0);
      assert.equal(await _acb.transfer.call(
          accounts[4], 1, {from: accounts[1]}), 0);
      assert.equal(await _acb.transfer.call(
          accounts[2], 0, {from: accounts[1]}), 0);
      assert.equal(await _acb.transfer.call(
          accounts[2], _coin_transfer_max, {from: accounts[1]}), 0);
      assert.equal(await _acb.transfer.call(
          accounts[1], 1, {from: accounts[2]}), 0);
      assert.equal(await _acb.transfer.call(
          accounts[2], _initial_coin_supply + 1, {from: accounts[1]}), 0);
      await check_transfer(accounts[2], 1, {from: accounts[1]});
      await check_transfer(accounts[3], 10, {from: accounts[1]});
      await check_transfer(accounts[2], 5, {from: accounts[3]});
      current = await get_current(sub_accounts, []);
      assert.equal(current.balances[accounts[1]].amount,
                   _initial_coin_supply - 11);
      assert.equal(current.balances[accounts[2]].amount, 6);
      assert.equal(current.balances[accounts[3]].amount, 5);
      assert.equal(await _acb.transfer.call(
          accounts[2], 5, {from: accounts[2]}), 0);
      assert.equal(current.balances[accounts[1]].amount,
                   _initial_coin_supply - 11);
      assert.equal(current.balances[accounts[2]].amount, 6);
      assert.equal(current.balances[accounts[3]].amount, 5);
      assert.equal(await _acb.transfer.call(
          accounts[3], 0, {from: accounts[2]}), 0);
      assert.equal(await _acb.transfer.call(
          accounts[3], 7, {from: accounts[2]}), 0);
      await check_transfer(accounts[3], 6, {from: accounts[2]});
      current = await get_current(sub_accounts, []);
      assert.equal(current.balances[accounts[1]].amount,
                   _initial_coin_supply - 11);
      assert.equal(current.balances[accounts[2]].amount, 0);
      assert.equal(current.balances[accounts[3]].amount, 11);
      await check_transfer(accounts[1], 11, {from: accounts[3]});
      current = await get_current(sub_accounts, []);
      assert.equal(current.balances[accounts[1]].amount, _initial_coin_supply);
      assert.equal(current.balances[accounts[2]].amount, 0);
      assert.equal(current.balances[accounts[3]].amount, 0);
      assert.equal(current.coin_supply.amount, _initial_coin_supply);

      // control_supply
      let bond_price = _level_to_bond_price[_level_max - 1];
      await _acb.set_oracle_level(_level_max - 1);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 0);
      await check_control_supply(_bond_redemption_price - 1, 0, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, 0);
      await check_control_supply(_bond_redemption_price, 0,
                                 _bond_redemption_price);
      current = await get_current([], []);
      assert.equal(current.bond_budget, 0);
      await check_control_supply(_bond_redemption_price + 1, 0,
                                 _bond_redemption_price);
      current = await get_current([], []);
      assert.equal(current.bond_budget, 0);
      await check_control_supply(_bond_redemption_price * 10, 0,
                                 _bond_redemption_price * 10);
      current = await get_current([], []);
      assert.equal(current.bond_budget, 0);

      await check_control_supply(-(bond_price - 1), 0, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 0);
      await check_control_supply(-bond_price, 1, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 0, 0);
      assert.equal(current.bond_budget, 1);
      await check_control_supply(0, 0, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 0);
      await check_control_supply(-bond_price * 99, 99, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 99);
      await check_control_supply(0, 0, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 0);
      await check_control_supply(-bond_price * 100, 100, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 100);

      await check_purchase_bonds(50, {from: accounts[1]},
                                 _bond_redemption_period);
      await check_purchase_bonds(50, {from: accounts[1]},
                                 _bond_redemption_period);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 100);
      assert.equal(current.bond_budget, 0);

      await check_control_supply(_bond_redemption_price - 1, 0, 0);
      current = await get_current([], []);
      await check_control_supply(_bond_redemption_price, -1, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -1);
      await check_control_supply(_bond_redemption_price + 1, -1, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -1);
      await check_control_supply(_bond_redemption_price * 68, -68, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -68);
      await check_control_supply(0, 0, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, 0);
      await check_control_supply(_bond_redemption_price * 30, -30, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -30);
      await check_control_supply(_bond_redemption_price - 1, 0, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, 0);
      await check_control_supply(_bond_redemption_price * 200,
                                 -100,
                                 _bond_redemption_price * 100);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -100);
      await check_control_supply(_bond_redemption_price * 100, -100, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -100);
      await check_control_supply(_bond_redemption_price * 100, -100, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -100);

      await check_control_supply(-bond_price * 100, 100, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 100);
      assert.equal(current.bond_budget, 100);

      await check_purchase_bonds(50, {from: accounts[1]},
                                 _bond_redemption_period);
      await check_purchase_bonds(50, {from: accounts[1]},
                                 _bond_redemption_period);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 200);
      assert.equal(current.bond_budget, 0);

      await check_control_supply(_bond_redemption_price * 30 - 1, -29, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -29);
      await check_control_supply(_bond_redemption_price * 30, -30, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -30);
      await check_control_supply(_bond_redemption_price * 30 + 1, -30, 0);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -30);
      await check_control_supply(_bond_redemption_price * 210,
                                 -200,
                                 _bond_redemption_price * 10);
      current = await get_current([], []);
      assert.equal(current.bond_budget, -200);

      await check_redeem_bonds([_bond_redemption_period],
                               {from: accounts[1]}, 200);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 0);

      // timestamp
      assert.equal(await _acb.get_timestamp(), 0);
      await _acb.set_timestamp(1);
      assert.equal(await _acb.get_timestamp(), 1);
      await _acb.set_timestamp(_phase_duration);
      assert.equal(await _acb.get_timestamp(), _phase_duration);

      await should_throw(async () => {
        await _acb.set_timestamp(_phase_duration - 1);
      }, "set_timestamp:");

      await should_throw(async () => {
        await _acb.set_timestamp(_phase_duration);
      }, "set_timestamp:");

      await should_throw(async () => {
        await _acb.set_timestamp(0);
      }, "set_timestamp:");

      // purchase_bonds
      await check_control_supply(-bond_price * 80, 80, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 80);

      let coin_supply = current.coin_supply.amount;

      await _acb.set_timestamp(
          (await _acb.get_timestamp()).toNumber() + _phase_duration);
      let t1 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
      redemptions = [t1];

      await check_transfer(accounts[2], bond_price * 30, {from: accounts[1]},
                           bond_price * 30);
      await check_transfer(accounts[3], bond_price * 50, {from: accounts[1]},
                           bond_price * 50);
      assert.equal(await _acb.purchase_bonds.call(1, {from: accounts[4]}), 0);
      assert.equal(await _acb.purchase_bonds.call(1, {from: accounts[5]}), 0);
      assert.equal(await _acb.purchase_bonds.call(0, {from: accounts[1]}), 0);
      assert.equal(await _acb.purchase_bonds.call(
          _coin_transfer_max / _bond_redemption_price + 1,
          {from: accounts[1]}), 0);
      assert.equal(await _acb.purchase_bonds.call(81, {from: accounts[1]}), 0);
      assert.equal(await _acb.purchase_bonds.call(0, {from: accounts[2]}), 0);
      assert.equal(await _acb.purchase_bonds.call(
          _coin_transfer_max / _bond_redemption_price + 1,
          {from: accounts[2]}), 0);
      assert.equal(await _acb.purchase_bonds.call(81, {from: accounts[2]}), 0);
      assert.equal(await _acb.purchase_bonds.call(31, {from: accounts[2]}), 0);
      assert.equal(await _acb.purchase_bonds.call(0, {from: accounts[3]}), 0);
      assert.equal(await _acb.purchase_bonds.call(
          _coin_transfer_max / _bond_redemption_price + 1,
          {from: accounts[3]}), 0);
      assert.equal(await _acb.purchase_bonds.call(81, {from: accounts[3]}), 0);
      assert.equal(await _acb.purchase_bonds.call(51, {from: accounts[3]}), 0);

      await check_purchase_bonds(1, {from: accounts[2]}, t1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply.amount, 1);
      assert.equal(current.bond_budget, 79);
      assert.equal(current.bonds[accounts[2]][t1].amount, 1);
      assert.equal(current.coin_supply.amount,
                   coin_supply - bond_price * 1);

      await check_purchase_bonds(10, {from: accounts[2]}, t1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply.amount, 11);
      assert.equal(current.bond_budget, 69);
      assert.equal(current.bonds[accounts[2]][t1].amount, 11);
      assert.equal(current.coin_supply.amount,
                   coin_supply - bond_price * 11);

      assert.equal(await _acb.purchase_bonds.call(
          70, {from: accounts[1]}), 0);
      assert.equal(await _acb.purchase_bonds.call(
          70, {from: accounts[3]}), 0);

      await _acb.set_timestamp(
          (await _acb.get_timestamp()).toNumber() + _phase_duration);
      let t2 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
      redemptions = [t2];

      await check_purchase_bonds(1, {from: accounts[2]}, t2);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply.amount, 12);
      assert.equal(current.bond_budget, 68);
      assert.equal(current.bonds[accounts[2]][t2].amount, 1);
      assert.equal(current.coin_supply.amount,
                   coin_supply - bond_price * 12);

      await check_purchase_bonds(10, {from: accounts[2]}, t2);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply.amount, 22);
      assert.equal(current.bond_budget, 58);
      assert.equal(current.bonds[accounts[2]][t2].amount, 11);
      assert.equal(current.coin_supply.amount,
                   coin_supply - bond_price * 22);

      assert.equal(await _acb.purchase_bonds.call(
          59, {from: accounts[1]}), 0);
      assert.equal(await _acb.purchase_bonds.call(
          59, {from: accounts[3]}), 0);

      await check_purchase_bonds(10, {from: accounts[1]}, t2);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply.amount, 32);
      assert.equal(current.bond_budget, 48);
      assert.equal(current.bonds[accounts[1]][t2].amount, 10);
      assert.equal(current.coin_supply.amount,
                   coin_supply - bond_price * 32);

      await _acb.set_timestamp(
          (await _acb.get_timestamp()).toNumber() + _phase_duration);
      let t3 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
      redemptions = [t3];

      assert.equal(await _acb.purchase_bonds.call(
          49, {from: accounts[3]}), 0);
      await check_purchase_bonds(48, {from: accounts[3]}, t3);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply.amount, 80);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bonds[accounts[3]][t3].amount, 48);
      assert.equal(current.coin_supply.amount,
                   coin_supply - bond_price * 80);

      await check_transfer(accounts[2], bond_price * 10, {from: accounts[1]},
                           bond_price * 10);
      await check_transfer(accounts[3], bond_price * 10, {from: accounts[1]},
                           bond_price * 10);
      assert.equal(await _acb.purchase_bonds.call(
          1, {from: accounts[2]}), 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply.amount, 80);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bonds[accounts[3]][t3].amount, 48);
      assert.equal(current.coin_supply.amount,
                   coin_supply - bond_price * 80);
      assert.equal(await _acb.purchase_bonds.call(
          1, {from: accounts[3]}), 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply.amount, 80);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bonds[accounts[3]][t3].amount, 48);
      assert.equal(current.coin_supply.amount,
                   coin_supply - bond_price * 80);

      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.balances[accounts[2]].amount,
                   (30 + 10 - 22) * bond_price);
      assert.equal(current.balances[accounts[3]].amount,
                   (50 + 10 - 48) * bond_price);

      // redeem_bonds
      redemptions = [t1, t2, t3];
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t1].amount, 11);
      assert.equal(current.bonds[accounts[1]][t2].amount, 10);
      assert.equal(current.bonds[accounts[2]][t2].amount, 11);
      assert.equal(current.bonds[accounts[3]][t3].amount, 48);

      await _acb.set_timestamp(
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period);
      let t4 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
      redemptions = [t2, t3, t4];

      assert.equal(await _acb.redeem_bonds.call(
          [t1], {from: accounts[4]}), 0);
      assert.equal(await _acb.redeem_bonds.call(
          [t1, t4], {from: accounts[2]}), 0);
      assert.equal(await _acb.redeem_bonds.call(
          [t1, t2, t3, t4], {from: accounts[2]}), 0);
      assert.equal(await _acb.redeem_bonds.call(
          [t1, t1], {from: accounts[2]}), 0);
      assert.equal(await _acb.redeem_bonds.call(
          [t1, t2, t2], {from: accounts[2]}), 0);
      assert.equal(await _acb.redeem_bonds.call(
          [], {from: accounts[2]}), 0);

      current = await get_current(sub_accounts, redemptions);
      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      balance = current.balances[accounts[2]].amount;
      assert.equal(current.bond_budget, 0);
      await check_redeem_bonds([t1], {from: accounts[2]}, 11);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t1 in current.bonds[accounts[2]], false);
      assert.equal(current.bonds[accounts[2]][t2].amount, 11);
      assert.equal(t3 in current.bonds[accounts[2]], false);
      assert.equal(current.balances[accounts[2]].amount,
                   balance + 11 * _bond_redemption_price);
      assert.equal(current.bond_budget, 11);
      assert.equal(current.bond_supply.amount, bond_supply - 11);
      assert.equal(current.coin_supply.amount, coin_supply +
                   11 * _bond_redemption_price);

      await check_redeem_bonds([t2], {from: accounts[2]}, 11);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t1 in current.bonds[accounts[2]], false);
      assert.equal(t2 in current.bonds[accounts[2]], false);
      assert.equal(current.balances[accounts[2]].amount,
                   balance + 22 * _bond_redemption_price);
      assert.equal(current.bond_budget, 22);
      assert.equal(current.bond_supply.amount, bond_supply - 22);
      assert.equal(current.coin_supply.amount, coin_supply +
                   22 * _bond_redemption_price);

      assert.equal(await _acb.redeem_bonds.call(
          [t3], {from: accounts[2]}), 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t1 in current.bonds[accounts[2]], 0);
      assert.equal(t2 in current.bonds[accounts[2]], 0);
      assert.equal(t3 in current.bonds[accounts[2]], 0);
      assert.equal(current.balances[accounts[2]].amount,
                   balance + 22 * _bond_redemption_price);
      assert.equal(current.bond_budget, 22);
      assert.equal(current.bond_supply.amount, bond_supply - 22);
      assert.equal(current.coin_supply.amount, coin_supply +
                   22 * _bond_redemption_price);

      balance = current.balances[accounts[3]].amount;
      assert.equal(await _acb.redeem_bonds.call(
          [t2], {from: accounts[3]}), 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t1 in current.bonds[accounts[3]], 0);
      assert.equal(t2 in current.bonds[accounts[3]], 0);
      assert.equal(current.bonds[accounts[3]][t3].amount, 48);
      assert.equal(current.balances[accounts[3]].amount, balance);
      assert.equal(current.bond_budget, 22);
      assert.equal(current.bond_supply.amount, bond_supply - 22);
      assert.equal(current.coin_supply.amount, coin_supply +
                   22 * _bond_redemption_price);

      await check_redeem_bonds([t3], {from: accounts[3]}, 48);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t1 in current.bonds[accounts[3]], 0);
      assert.equal(t2 in current.bonds[accounts[3]], 0);
      assert.equal(t3 in current.bonds[accounts[3]], 0);
      assert.equal(current.balances[accounts[3]].amount,
                   balance + 48 * _bond_redemption_price);
      assert.equal(current.bond_budget, 70);
      assert.equal(current.bond_supply.amount, bond_supply - 70);
      assert.equal(current.coin_supply.amount, coin_supply +
                   70 * _bond_redemption_price);

      balance = current.balances[accounts[1]].amount;
      await check_redeem_bonds([t2], {from: accounts[1]}, 10);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t2 in current.bonds[accounts[1]], false);
      assert.equal(current.balances[accounts[1]].amount,
                   balance + 10 * _bond_redemption_price);
      assert.equal(current.bond_budget, 80);
      assert.equal(current.bond_supply.amount, bond_supply - 80);
      assert.equal(current.coin_supply.amount, coin_supply +
                   80 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, 0);

      assert.equal(current.bond_budget, 80);
      await check_control_supply(-100 * bond_price, 100, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, 100);

      balance = current.balances[accounts[2]].amount;
      await check_transfer(accounts[1], current.balances[accounts[2]].amount,
                           {from: accounts[2]}, balance);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.balances[accounts[2]].amount, 0);
      await check_transfer(accounts[2], 100 * bond_price, {from: accounts[1]},
                           100 * bond_price);
      await check_purchase_bonds(20, {from: accounts[2]}, t4);
      await _acb.set_timestamp((await _acb.get_timestamp()).toNumber() + 1);
      let t5 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
      redemptions.push(t5);
      await check_purchase_bonds(20, {from: accounts[2]}, t5);
      await _acb.set_timestamp(
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period - 2);
      let t6 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
      redemptions.push(t6);
      await check_purchase_bonds(20, {from: accounts[2]}, t6);
      await _acb.set_timestamp((await _acb.get_timestamp()).toNumber() + 1);
      let t7 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
      redemptions.push(t7);
      await check_purchase_bonds(20, {from: accounts[2]}, t7);
      await _acb.set_timestamp((await _acb.get_timestamp()).toNumber() + 1);
      let t8 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
      redemptions.push(t8);
      await check_purchase_bonds(20, {from: accounts[2]}, t8);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.balances[accounts[2]].amount, 0);
      assert.equal(t7 - t4, _bond_redemption_period);

      assert.equal(current.bond_budget, 0);

      redemptions = [t5, t6, t7, t8];

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      await check_redeem_bonds([t4, t5, t6, t7, t8], {from: accounts[2]}, 40);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t4 in current.bonds[accounts[2]], false);
      assert.equal(t5 in current.bonds[accounts[2]], false);
      assert.equal(current.bonds[accounts[2]][t6].amount, 20);
      assert.equal(current.bonds[accounts[2]][t7].amount, 20);
      assert.equal(current.bonds[accounts[2]][t8].amount, 20);
      assert.equal(current.coin_supply.amount,
                   coin_supply + 40 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, bond_supply - 40);
      assert.equal(current.bond_budget, 40);

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      await check_redeem_bonds([t6, t7, t8], {from: accounts[2]}, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6].amount, 20);
      assert.equal(current.bonds[accounts[2]][t7].amount, 20);
      assert.equal(current.bonds[accounts[2]][t8].amount, 20);
      assert.equal(current.coin_supply.amount, coin_supply);
      assert.equal(current.bond_supply.amount, bond_supply);
      assert.equal(current.bond_budget, 40);

      await check_control_supply(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      await check_redeem_bonds([t6, t7, t8], {from: accounts[2]}, 5);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6].amount, 15);
      assert.equal(current.bonds[accounts[2]][t7].amount, 20);
      assert.equal(current.bonds[accounts[2]][t8].amount, 20);
      assert.equal(current.coin_supply.amount,
                   coin_supply + 5 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, bond_supply - 5);
      assert.equal(current.bond_budget, 0);

      assert.equal(current.bond_budget, 0);
      await check_control_supply(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      await check_redeem_bonds([t8, t7, t6], {from: accounts[2]}, 5);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6].amount, 15);
      assert.equal(current.bonds[accounts[2]][t7].amount, 20);
      assert.equal(current.bonds[accounts[2]][t8].amount, 15);
      assert.equal(current.coin_supply.amount,
                   coin_supply + 5 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, bond_supply - 5);
      assert.equal(current.bond_budget, 0);

      assert.equal(current.bond_budget, 0);
      await check_control_supply(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      await check_redeem_bonds([t7], {from: accounts[2]}, 5);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6].amount, 15);
      assert.equal(current.bonds[accounts[2]][t7].amount, 15);
      assert.equal(current.bonds[accounts[2]][t8].amount, 15);
      assert.equal(current.coin_supply.amount,
                   coin_supply + 5 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, bond_supply - 5);
      assert.equal(current.bond_budget, 0);

      await _acb.set_timestamp(
          (await _acb.get_timestamp()).toNumber() +
            _bond_redemption_period - 2);
      let t9 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;

      assert.equal(current.bond_budget, 0);
      await check_control_supply(20 * _bond_redemption_price, -20, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -20);

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      assert.equal(t9 - t6, _bond_redemption_period);
      assert.equal(t6 <= (await _acb.get_timestamp()), true);
      await check_redeem_bonds([t6, t8, t7], {from: accounts[2]}, 20);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t6 in current.bonds[accounts[2]], false);
      assert.equal(current.bonds[accounts[2]][t7].amount, 15);
      assert.equal(current.bonds[accounts[2]][t8].amount, 10);
      assert.equal(current.coin_supply.amount,
                   coin_supply + 20 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, bond_supply - 20);
      assert.equal(current.bond_budget, 0);

      await check_control_supply(15 * _bond_redemption_price, -15, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -15);
      await check_control_supply(30 * _bond_redemption_price,
                                 -25,
                                 5 * _bond_redemption_price);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -25);
      await check_control_supply(1 * _bond_redemption_price, -1, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -1);

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      await check_redeem_bonds([t7, t8], {from: accounts[2]}, 1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t6 in current.bonds[accounts[2]], false);
      assert.equal(current.bonds[accounts[2]][t7].amount, 14);
      assert.equal(current.bonds[accounts[2]][t8].amount, 10);
      assert.equal(current.coin_supply.amount,
                   coin_supply + 1 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, bond_supply - 1);
      assert.equal(current.bond_budget, 0);

      await _acb.set_timestamp((await _acb.get_timestamp()).toNumber() + 1);
      let t10 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;

      await check_control_supply(2 * _bond_redemption_price, -2, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -2);

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      await check_redeem_bonds([t8, t7], {from: accounts[2]}, 16);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t6 in current.bonds[accounts[2]], false);
      assert.equal(t7 in current.bonds[accounts[2]], false);
      assert.equal(current.bonds[accounts[2]][t8].amount, 8);
      assert.equal(current.coin_supply.amount,
                   coin_supply + 16 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, bond_supply - 16);
      assert.equal(current.bond_budget, 14);

      await check_control_supply(1 * _bond_redemption_price, -1, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -1);

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      await check_redeem_bonds([t8], {from: accounts[2]}, 1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t6 in current.bonds[accounts[2]], false);
      assert.equal(t7 in current.bonds[accounts[2]], false);
      assert.equal(current.bonds[accounts[2]][t8].amount, 7);
      assert.equal(current.coin_supply.amount,
                   coin_supply + 1 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, bond_supply - 1);
      assert.equal(current.bond_budget, 0);

      await _acb.set_timestamp((await _acb.get_timestamp()).toNumber() + 1);
      let t11 =
          (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;

      coin_supply = current.coin_supply.amount;
      bond_supply = current.bond_supply.amount;
      await check_redeem_bonds([t8], {from: accounts[2]}, 7);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(t6 in current.bonds[accounts[2]], false);
      assert.equal(t7 in current.bonds[accounts[2]], false);
      assert.equal(t8 in current.bonds[accounts[2]], false);
      assert.equal(current.coin_supply.amount,
                   coin_supply + 7 * _bond_redemption_price);
      assert.equal(current.bond_supply.amount, bond_supply - 7);
      assert.equal(current.bond_budget, 7);

      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 7);
      await check_control_supply(5 * _bond_redemption_price,
                                 0,
                                 5 * _bond_redemption_price);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, 0);
    }

    await _acb.set_timestamp(
        (await _acb.get_timestamp()).toNumber() + _phase_duration);

    let remainder = [0, 0, 0];
    let deposit_4 = [0, 0, 0];
    let deposit_5 = [0, 0, 0];
    let deposit_6 = [0, 0, 0];
    let now = 0;
    sub_accounts = accounts.slice(4, 7);

    await check_create_account({from: accounts[4]});
    await check_create_account({from: accounts[5]});
    await check_create_account({from: accounts[6]});

    await check_transfer(accounts[4], 100, {from: accounts[1]}, 100);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, 100);

    let result = (await _acb.vote.call(
        await _acb.hash(_default_level, 7777, {from: accounts[7]}),
        _default_level, 7777, {from: accounts[7]}));
    assert.equal(result[0], false);
    assert.equal(result[1], false);
    assert.equal(result[2], 0);
    assert.equal(result[3], false);

    // 1 commit
    balance = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     true, false, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]].amount,
                 balance - deposit_4[mod(now, 3)]);
    balance = current.balances[accounts[4]].amount;
    await check_vote(await _acb.hash(_default_level, 1, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     false, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, balance);
    await check_vote(await _acb.hash(_default_level, 1, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     false, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, balance);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);

    balance = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 2, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     true, true, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]].amount,
                 balance - deposit_4[mod(now, 3)]);
    balance = current.balances[accounts[4]].amount;
    await check_vote(await _acb.hash(_default_level, 2, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     false, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, balance);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    let mint = await _mint_at_default_level();

    balance = current.balances[accounts[4]].amount;
    reward = Math.floor((100 - _proportional_reward_rate) *
                        mint / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.floor(_proportional_reward_rate *
                           mint / 100);
    }
    remainder[mod(now, 3)] = mint - reward;
    deposit_4[mod(now, 3)] = Math.floor(balance * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 3, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     true, false, deposit_4[mod(now - 2, 3)] + reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]].amount;
    await check_vote(await _acb.hash(_default_level, 3, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     false, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, balance);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = 0;

    balance = current.balances[accounts[4]].amount;
    coin_supply = current.coin_supply.amount;
    remainder[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + mint;
    deposit_4[mod(now, 3)] = Math.floor(balance * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 4, {from: accounts[4]}),
                     _default_level, 3, {from: accounts[4]},
                     true, true, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]].amount,
                 balance - deposit_4[mod(now, 3)]);
    balance = current.balances[accounts[4]].amount;
    await check_vote(await _acb.hash(_default_level, 4, {from: accounts[4]}),
                     _default_level, 2, {from: accounts[4]},
                     false, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, balance);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    balance = current.balances[accounts[4]].amount;
    coin_supply = current.coin_supply.amount;
    reward = Math.floor((100 - _proportional_reward_rate) *
                        mint / 100);
    if( deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.floor(_proportional_reward_rate *
                           mint / 100);
    }
    remainder[mod(now, 3)] = mint - reward;
    deposit_4[mod(now, 3)] = Math.floor(balance * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 5, {from: accounts[4]}),
                     _default_level, 4, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] + reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]].amount;
    await check_vote(await _acb.hash(_default_level, 5, {from: accounts[4]}),
                     _default_level, 4, {from: accounts[4]},
                     false, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, balance);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    balance = current.balances[accounts[4]].amount;
    coin_supply = current.coin_supply.amount;
    reward = Math.floor((100 - _proportional_reward_rate) *
                        mint / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.floor(_proportional_reward_rate *
                           await _mint_at_default_level() / 100);
    }
    remainder[mod(now, 3)] = mint - reward;
    deposit_4[mod(now, 3)] = Math.floor(balance * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 6, {from: accounts[4]}),
                     _default_level, 5, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] + reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]].amount;
    await check_vote(await _acb.hash(_default_level, 6, {from: accounts[4]}),
                     _default_level, 5, {from: accounts[4]},
                     false, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, balance);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    balance = current.balances[accounts[4]].amount;
    coin_supply = current.coin_supply.amount;
    reward = Math.floor((100 - _proportional_reward_rate) *
                        mint / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.floor(_proportional_reward_rate *
                           mint / 100);
    }
    remainder[mod(now, 3)] = mint - reward;
    deposit_4[mod(now, 3)] = Math.floor(balance * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 7, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] + reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]].amount;
    await check_vote(await _acb.hash(_default_level, 7, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     false, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, balance);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    balance = current.balances[accounts[4]].amount;
    coin_supply = current.coin_supply.amount;
    reward = Math.floor((100 - _proportional_reward_rate) *
                        mint / 100);
    if (deposit_4[mod(now - 2, 3)] > 0) {
      reward += Math.floor(_proportional_reward_rate *
                           mint / 100);
    }
    remainder[mod(now, 3)] = mint - reward;
    deposit_4[mod(now, 3)] = Math.floor(balance * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 8, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, false, deposit_4[mod(now - 2, 3)] + reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] + reward);
    balance = current.balances[accounts[4]].amount;
    await check_vote(await _acb.hash(_default_level, 8, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     false, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[4]].amount, balance);
    assert.equal(current.coin_supply.amount,
                 coin_supply  + mint -
                 remainder[mod(now - 1, 3)]);

    // 3 commits on the stable level.
    await _acb.reset_balances(
        accounts[1], [accounts[4], accounts[5], accounts[6]]);

    await check_transfer(accounts[4], 100, {from: accounts[1]}, 100);
    await check_transfer(accounts[5], 100, {from: accounts[1]}, 100);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount, 100);
    assert.equal(current.balances[accounts[6]].amount, 0);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = 0;

    coin_supply = current.coin_supply.amount;
    remainder[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + mint;
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1000, {from: accounts[4]}),
                     _default_level, 1000, {from: accounts[4]},
                     true, false, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1000, {from: accounts[5]}),
                     _default_level, 1000, {from: accounts[5]},
                     true, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1000, {from: accounts[6]}),
                     _default_level, 1000, {from: accounts[6]},
                     true, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = 0;

    coin_supply = current.coin_supply.amount;
    remainder[mod(now, 3)] = deposit_4[mod(now - 2, 3)] + mint;
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1, {from: accounts[4]}),
                     _default_level, 0, {from: accounts[4]},
                     true, false, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1, {from: accounts[5]}),
                     _default_level, 0, {from: accounts[5]},
                     true, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1, {from: accounts[6]}),
                     _default_level, 0, {from: accounts[6]},
                     true, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = 0;

    coin_supply = current.coin_supply.amount;
    remainder[mod(now, 3)] = (deposit_4[mod(now - 2, 3)] +
                              deposit_5[mod(now - 2, 3)] +
                              deposit_6[mod(now - 2, 3)] + mint);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 2, {from: accounts[4]}),
                     _default_level, 1, {from: accounts[4]},
                     true, true, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 2, {from: accounts[5]}),
                     _default_level, 1, {from: accounts[5]},
                     true, true, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 2, {from: accounts[6]}),
                     _default_level, 1, {from: accounts[6]},
                     true, true, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 3, {from: accounts[4]}),
                     _default_level, 2, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] + reward_4 +
                      constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 3, {from: accounts[5]}),
                     _default_level, 2, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 3, {from: accounts[6]}),
                     _default_level, 2, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 4, {from: accounts[4]}),
                     _default_level, 3, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 4, {from: accounts[5]}),
                     _default_level, 3, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 4, {from: accounts[6]}),
                     _default_level, 3, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);

    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    await _acb.reset_balances(
        accounts[1], [accounts[4], accounts[5], accounts[6]]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 5, {from: accounts[4]}),
                     _default_level, 4, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 5, {from: accounts[5]}),
                     _default_level, 4, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 5, {from: accounts[6]}),
                     _default_level, 4, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(deposit_4[mod(now, 3)], 0);
    assert.equal(deposit_5[mod(now, 3)], 0);
    assert.equal(deposit_6[mod(now, 3)], 0);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 6, {from: accounts[4]}),
                     _default_level, 5, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 6, {from: accounts[5]}),
                     _default_level, 5, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 6, {from: accounts[6]}),
                     _default_level, 5, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 7, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 7, {from: accounts[5]}),
                     _default_level, 6, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 7, {from: accounts[6]}),
                     _default_level, 5, {from: accounts[6]},
                     true, false, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = deposit_6[mod(now - 2, 3)] + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 8, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, false, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 8, {from: accounts[5]}),
                     _default_level, 6, {from: accounts[5]},
                     true, false, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 8, {from: accounts[6]}),
                     _default_level, 7, {from: accounts[6]},
                     true, true, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 reward_6);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                    mint);
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    if (deposit_6[mod(now - 2, 3)] > 0) {
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total / 100);
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 9, {from: accounts[4]}),
                     _default_level, 0, {from: accounts[4]},
                     true, false, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 9, {from: accounts[5]}),
                     _default_level, 0, {from: accounts[5]},
                     true, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 9, {from: accounts[6]}),
                     _default_level, 0, {from: accounts[6]},
                     true, false, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = 0;

    coin_supply = current.coin_supply.amount;
    reward_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                    deposit_6[mod(now - 2, 3)] + mint);
    constant_reward = 0;
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    remainder[mod(now, 3)] = reward_total;
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 10, {from: accounts[4]}),
                     _default_level, 9, {from: accounts[4]},
                     true, true, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 10, {from: accounts[5]}),
                     _default_level, 9, {from: accounts[5]},
                     true, true, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 10, {from: accounts[6]}),
                     _default_level, 9, {from: accounts[6]},
                     true, true, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2 + deposit_4[mod(now - 2, 3)]);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 11, {from: accounts[5]}),
                     _default_level, 10, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 11, {from: accounts[6]}),
                     _default_level, 10, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = deposit_4[mod(now - 2, 3)] + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_5[mod(now - 2, 3)] + deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward + deposit_5[mod(now - 2, 3)]);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 12, {from: accounts[6]}),
                     _default_level, 11, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    current = await get_current([accounts[1]], []);
    coin_supply = current.coin_supply.amount;
    reward_total = deposit_5[mod(now - 2, 3)] + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 0 + deposit_6[mod(now - 2, 3)]);
    deposit13 = Math.floor(
        current.balances[accounts[1]].amount * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1000, {from: accounts[1]}),
                     _default_level, 1000, {from: accounts[1]},
                     true, false, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = 0;

    current = await get_current([accounts[1]], []);
    coin_supply = current.coin_supply.amount;
    remainder[mod(now, 3)] = deposit_6[mod(now - 2, 3)] + mint;
    deposit14 = Math.floor(
        current.balances[accounts[1]].amount * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1000, {from: accounts[1]}),
                     _default_level, 1000, {from: accounts[1]},
                     true, true, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    // 3 commits on the stable level and another level.

    // 0, stable, stable
    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    await _acb.reset_balances(
        accounts[1], [accounts[4], accounts[5], accounts[6]]);
    mint = await _mint_at_default_level();

    await check_transfer(accounts[4], 10000, {from: accounts[1]}, 10000);
    await check_transfer(accounts[5], 2000, {from: accounts[1]}, 2000);
    await check_transfer(accounts[5], 8100, {from: accounts[1]}, 8100);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply.amount;
    reward_total = deposit13 + mint;
    constant_reward = 0;
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    remainder[mod(now, 3)] = reward_total;
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(0, 1, {from: accounts[4]}),
                     _default_level, 0, {from: accounts[4]},
                     true, false, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1, {from: accounts[5]}),
                     _default_level, 0, {from: accounts[5]},
                     true, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 1, {from: accounts[6]}),
                     _default_level, 0, {from: accounts[6]},
                     true, false, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = 0;

    coin_supply = current.coin_supply.amount;
    reward_total = deposit14 + mint;
    constant_reward = 0;
    reward_4 = 0;
    reward_5 = 0;
    reward_6 = 0;
    remainder[mod(now, 3)] = reward_total;
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 2, {from: accounts[4]}),
                     0, 1, {from: accounts[4]},
                     true, true, 0, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _level_max);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)]);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 2, {from: accounts[5]}),
                     _default_level, 1, {from: accounts[5]},
                     true, true, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)]);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 2, {from: accounts[6]}),
                     _default_level, 1, {from: accounts[6]},
                     true, true, 0, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)]);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reclaim_4 = 0;
    in_threshold = false;
    if (_default_level - 0 <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_4 = deposit_4[mod(now - 2, 3)];
    }
    reward_total = (deposit_4[mod(now - 2, 3)] - reclaim_4 +
                    mint);
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_5[mod(now - 2, 3)] + deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 3, {from: accounts[4]}),
                     _default_level, 2, {from: accounts[4]},
                     true, true, reclaim_4, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] + reclaim_4);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 3, {from: accounts[5]}),
                     _default_level, 2, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 3, {from: accounts[6]}),
                     _default_level, 2, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    // 0, 0, stable
    tmp_deposit_rate = _deposit_rate;
    if (_deposit_rate == 0) {
      _deposit_rate = 1;
    }

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    await _acb.reset_balances(
        accounts[1], [accounts[4], accounts[5], accounts[6]]);
    mint = await _mint_at_default_level();

    await check_transfer(accounts[4], 2900, {from: accounts[1]}, 2900);
    await check_transfer(accounts[5], 7000, {from: accounts[1]}, 7000);
    await check_transfer(accounts[6], 10000, {from: accounts[1]}, 10000);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(0, 4, {from: accounts[4]}),
                     _default_level, 3, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(0, 4, {from: accounts[5]}),
                     _default_level, 3, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 4, {from: accounts[6]}),
                     _default_level, 3, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    _deposit_rate = tmp_deposit_rate;

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 5, {from: accounts[4]}),
                     0, 4, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash( _default_level, 5, {from: accounts[5]}),
                     0, 4, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 5, {from: accounts[6]}),
                     _default_level, 4, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reclaim_4 = reclaim_5 = 0;
    in_threshold = false;
    if (_default_level - 0 <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_4 = deposit_4[mod(now - 2, 3)];
      reclaim_5 = deposit_5[mod(now - 2, 3)];
    }
    reward_total = (deposit_4[mod(now - 2, 3)] - reclaim_4 +
                    deposit_5[mod(now - 2, 3)] - reclaim_5 +
                    mint);
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total =  deposit_6[mod(now - 2, 3)];
    if (deposit_total > 0) {
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 6, {from: accounts[4]}),
                     _default_level, 5, {from: accounts[4]},
                     true, true, reclaim_4, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] + reclaim_4);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 6, {from: accounts[5]}),
                     _default_level, 5, {from: accounts[5]},
                     true, true, reclaim_5, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] + reclaim_5);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 6, {from: accounts[6]}),
                     _default_level, 5, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    // stable, stable, level_max - 1
    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    await _acb.reset_balances(
        accounts[1], [accounts[4], accounts[5], accounts[6]]);
    mint = await _mint_at_default_level();

    await check_transfer(accounts[4], 3100, {from: accounts[1]}, 3100);
    await check_transfer(accounts[5], 7000, {from: accounts[1]}, 7000);
    await check_transfer(accounts[6], 10000, {from: accounts[1]}, 10000);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 7, {from: accounts[4]}),
                     _default_level, 6, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 7, {from: accounts[5]}),
                     _default_level, 6, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_level_max - 1, 7, {from: accounts[6]}),
                     _default_level, 6, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 8, {from: accounts[4]}),
                     _default_level, 7, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 8, {from: accounts[5]}),
                     _default_level, 7, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 8, {from: accounts[6]}),
                     _level_max - 1, 7, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reclaim_6 = 0;
    in_threshold = false;
    if (_level_max - 1 - _default_level <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_6 = deposit_6[mod(now - 2, 3)];
    }
    reward_total = (deposit_6[mod(now - 2, 3)] - reclaim_6 +
                    mint);
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)];
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 9, {from: accounts[4]}),
                     _default_level, 8, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 9, {from: accounts[5]}),
                     _default_level, 8, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 9, {from: accounts[6]}),
                     _default_level, 8, {from: accounts[6]},
                     true, true, reclaim_6, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] + reclaim_6);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    // stable, level_max - 1, level_max - 1
    tmp_deposit_rate = _deposit_rate;
    if (_deposit_rate == 0) {
      _deposit_rate = 1;
    }

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    await _acb.reset_balances(
        accounts[1], [accounts[4], accounts[5], accounts[6]]);
    mint = await _mint_at_default_level();

    await check_transfer(accounts[4], 10000, {from: accounts[1]}, 10000);
    await check_transfer(accounts[5], 7000, {from: accounts[1]}, 7000);
    await check_transfer(accounts[6], 2900, {from: accounts[1]}, 2900);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 10, {from: accounts[4]}),
                     _default_level, 9, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_level_max - 1, 10, {from: accounts[5]}),
                     _default_level, 9, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_level_max - 1, 10, {from: accounts[6]}),
                     _default_level, 9, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    _deposit_rate = tmp_deposit_rate;

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 11, {from: accounts[4]}),
                     _default_level, 10, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 11, {from: accounts[5]}),
                     _level_max - 1, 10, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 11, {from: accounts[6]}),
                     _level_max - 1, 10, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reclaim_5 = reclaim_6 = 0;
    in_threshold = false;
    if (_level_max - 1 - _default_level <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_5 = deposit_5[mod(now - 2, 3)];
      reclaim_6 = deposit_6[mod(now - 2, 3)];
    }
    reward_total = (deposit_5[mod(now - 2, 3)] - reclaim_5 +
                    deposit_6[mod(now - 2, 3)] - reclaim_6 +
                    mint);
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = deposit_4[mod(now - 2, 3)];
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 12, {from: accounts[4]}),
                     _default_level, 11, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 12, {from: accounts[5]}),
                     _default_level, 11, {from: accounts[5]},
                     true, true, reclaim_5, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] + reclaim_5);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 12, {from: accounts[6]}),
                     _default_level, 11, {from: accounts[6]},
                     true, true, reclaim_6, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] + reclaim_6);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    // stable, stable, level_max - 1; deposit is the same
    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    await _acb.reset_balances(
        accounts[1], [accounts[4], accounts[5], accounts[6]]);
    mint = await _mint_at_default_level();

    await check_transfer(accounts[4], 10000, {from: accounts[1]}, 10000);
    await check_transfer(accounts[5], 7000, {from: accounts[1]}, 7000);
    await check_transfer(accounts[6], 3000, {from: accounts[1]}, 3000);
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_level_max - 1, 13, {from: accounts[4]}),
                     _default_level, 12, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 13, {from: accounts[5]}),
                     _default_level, 12, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 13, {from: accounts[6]}),
                     _default_level, 12, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 3);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 14, {from: accounts[4]}),
                     _level_max - 1, 13, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100)
    await check_vote(await _acb.hash(_default_level, 14, {from: accounts[5]}),
                     _default_level, 13, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 14, {from: accounts[6]}),
                     _default_level, 13, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reclaim_4 = 0;
    in_threshold = false;
    if (_level_max - 1 - _default_level <= _reclaim_threshold) {
      in_threshold = true;
      reclaim_4 = deposit_4[mod(now - 2, 3)];
    }
    reward_total = (deposit_4[mod(now - 2, 3)] - reclaim_4 +
                    mint);
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (2 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_5[mod(now - 2, 3)] + deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_5 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_5[mod(now - 2, 3)] /
                            (deposit_total * 100));
      reward_6 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_6[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 2);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 15, {from: accounts[4]}),
                     _default_level, 14, {from: accounts[4]},
                     true, true, reclaim_4, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] + reclaim_4);
    balance_5 = current.balances[accounts[5]].amount;
    deposit_5[mod(now, 3)] = Math.floor(balance_5 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 15, {from: accounts[5]}),
                     _default_level, 14, {from: accounts[5]},
                     true, true, deposit_5[mod(now - 2, 3)] +
                      reward_5 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[5]].amount,
                 balance_5 - deposit_5[mod(now, 3)] +
                 deposit_5[mod(now - 2, 3)] +
                 reward_5 + constant_reward);
    balance_6 = current.balances[accounts[6]].amount;
    deposit_6[mod(now, 3)] = Math.floor(balance_6 * _deposit_rate / 100);
    await check_vote(await _acb.hash(_default_level, 15, {from: accounts[6]}),
                     _default_level, 14, {from: accounts[6]},
                     true, true, deposit_6[mod(now - 2, 3)] +
                      reward_6 + constant_reward, false);
    current = await get_current(sub_accounts, []);
    assert.equal(current.balances[accounts[6]].amount,
                 balance_6 - deposit_6[mod(now, 3)] +
                 deposit_6[mod(now - 2, 3)] +
                 reward_6 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    // all levels
    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    await _acb.reset_balances(
        accounts[1], [accounts[4], accounts[5], accounts[6]]);
    mint = await _mint_at_default_level();
    current = await get_current(sub_accounts, []);

    coin_supply = current.coin_supply.amount;
    reward_total = 0 + mint;
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (3 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = (deposit_4[mod(now - 2, 3)] + deposit_5[mod(now - 2, 3)] +
                     deposit_6[mod(now - 2, 3)]);
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1 + deposit_5[mod(now - 2, 3)] +
                              deposit_6[mod(now - 2, 3)]);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(0, 4444, {from: accounts[4]}),
                     _default_level, 15, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _phase_duration);
    mint = await _mint_at_default_level();

    coin_supply = current.coin_supply.amount;
    reward_total = (deposit_5[mod(now - 2, 3)] + deposit_6[mod(now - 2, 3)] +
                    mint);
    constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                 reward_total / (1 * 100));
    reward_4 = reward_5 = reward_6 = 0;
    deposit_total = deposit_4[mod(now - 2, 3)];
    if (deposit_total > 0) {
      reward_4 = Math.floor(_proportional_reward_rate *
                            reward_total * deposit_4[mod(now - 2, 3)] /
                            (deposit_total * 100));
    }
    remainder[mod(now, 3)] = (reward_total - reward_4 - reward_5 - reward_6 -
                              constant_reward * 1);
    balance_4 = current.balances[accounts[4]].amount;
    deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
    await check_vote(await _acb.hash(1, 4444, {from: accounts[4]}),
                     0, 4444, {from: accounts[4]},
                     true, true, deposit_4[mod(now - 2, 3)] +
                      reward_4 + constant_reward, true);
    current = await get_current(sub_accounts, []);
    assert.equal(current.oracle_level, _default_level);
    assert.equal(current.balances[accounts[4]].amount,
                 balance_4 - deposit_4[mod(now, 3)] +
                 deposit_4[mod(now - 2, 3)] +
                 reward_4 + constant_reward);
    assert.equal(current.coin_supply.amount,
                 coin_supply + mint -
                 remainder[mod(now - 1, 3)]);

    assert.equal(current.bond_supply.amount, 0);
    assert.equal(current.bond_budget, 0);
    await check_control_supply(
        -level_to_bond_price[current.oracle_level] * 2, 2, 0);
    current = await get_current(sub_accounts, []);
    assert.equal(current.bond_supply.amount, 0);
    assert.equal(current.bond_budget, 2);
    let t12 = (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
    await check_purchase_bonds(2, {from: accounts[1]}, t12);
    current = await get_current(sub_accounts, []);
    assert.equal(current.bond_supply.amount, 2);

    for (let level = 2; level < _level_max + 2; level++) {
      now = mod(now + 1, 3);
      await _acb.set_timestamp((
          await _acb.get_timestamp()).toNumber() + _phase_duration);

      current = await get_current(sub_accounts, []);
      assert.equal(current.bond_supply.amount, 2);
      mint = 0;
      bond_budget = 0;
      delta = Math.floor(current.coin_supply.amount *
                         (_level_to_exchange_rate[level - 2] - 10) / 10);
      delta = Math.floor(delta * _dumping_factor / 100);
      if (delta == 0) {
        mint = 0;
        issued_bonds = 0;
        redeemable_bonds = 0;
      } else if (delta > 0) {
        necessary_bonds = Math.floor(delta / _bond_redemption_price);
        if (necessary_bonds >= 2) {
          mint = (necessary_bonds - 2) * _bond_redemption_price;
          bond_budget = -2;
        } else {
          mint = 0;
          bond_budget = -necessary_bonds;
        }
      } else {
        mint = 0;
        bond_budget = Math.floor(-delta / _level_to_bond_price[level - 2]);
      }

      coin_supply = current.coin_supply.amount;
      reward_total = mint;
      constant_reward = Math.floor((100 - _proportional_reward_rate) *
                                   reward_total / (1 * 100));
      reward_4 = 0;
      deposit_total = deposit_4[mod(now - 2, 3)];
      if (deposit_total > 0) {
        reward_4 = Math.floor(_proportional_reward_rate *
                              reward_total * deposit_4[mod(now - 2, 3)] /
                              (deposit_total * 100));
      }
      remainder[mod(now, 3)] = (reward_total - reward_4 - constant_reward * 1);
      balance_4 = current.balances[accounts[4]].amount;
      deposit_4[mod(now, 3)] = Math.floor(balance_4 * _deposit_rate / 100);
      await check_vote(await _acb.hash(level, 4444, {from: accounts[4]}),
                       level - 1, 4444, {from: accounts[4]},
                       true,
                       (level < _level_max + 1) ? true : false,
                       deposit_4[mod(now - 2, 3)] + reward_4 + constant_reward,
                       true);
      current = await get_current(sub_accounts, []);
      assert.equal(current.oracle_level, level - 2);
      assert.equal(current.balances[accounts[4]].amount,
                   balance_4 - deposit_4[mod(now, 3)] +
                   deposit_4[mod(now - 2, 3)] +
                   reward_4 + constant_reward);
      assert.equal(current.coin_supply.amount,
                   coin_supply + mint -
                   remainder[mod(now - 1, 3)]);
      assert.equal(current.bond_supply.amount, 2);
      assert.equal(current.bond_budget, bond_budget);
    }

    now = mod(now + 1, 3);
    await _acb.set_timestamp((
        await _acb.get_timestamp()).toNumber() + _bond_redemption_period);

    await check_redeem_bonds([t12], {from: accounts[1]}, 2);
    await _acb.reset_balances(
        accounts[1], [accounts[2], accounts[3], accounts[4],
                      accounts[5], accounts[6]]);

    current = await get_current(sub_accounts, []);
    assert.equal(current.bond_supply.amount, 0);
    assert.equal(current.coin_supply.amount,
                 _initial_coin_supply + deposit_4[mod(now - 2, 3)] +
                 deposit_4[mod(now - 1, 3)] + remainder[mod(now - 1, 3)]);

    // Ownable
    await should_throw(async () => {
      await _acb._control_supply(0, {from: accounts[1]});
    }, "not a function");

    await should_throw(async () => {
      await _acb._control_supply(0);
    }, "not a function");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _acb.coin_supply_address());
      let holder = await TokenHolder.new(supply.address);
      await supply.mint(holder, 1);
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _acb.coin_supply_address());
      await supply.set_delegated_owner(accounts[1]);
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _acb.coin_supply_address());
      let holder = await TokenHolder.new(supply.address);
      await supply.mint(holder, 1, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _acb.coin_supply_address());
      await supply.set_delegated_owner(accounts[1], {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _acb.bond_supply_address());
      let holder = await TokenHolder.new(supply.address);
      await supply.mint(holder, 1);
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _acb.bond_supply_address());
      await supply.set_delegated_owner(accounts[1]);
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _acb.bond_supply_address());
      let holder = await TokenHolder.new(supply.address);
      await supply.mint(holder, 1, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _acb.bond_supply_address());
      await supply.set_delegated_owner(accounts[1], {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      let holder = await TokenHolder.at(
          await _acb.balance_holder_address(accounts[1]));
      await holder.set_amount(1);
    }, "Ownable");

    await should_throw(async () => {
      let holder = await TokenHolder.at(
          await _acb.balance_holder_address(accounts[1]));
      await holder.set_amount(1, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      let oracle = await Oracle.at(await _acb.oracle_address());
      await oracle.get_mode_level();
    }, "Ownable");

    await should_throw(async () => {
      let oracle = await Oracle.at(await _acb.oracle_address());
      await oracle.get_mode_level({from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      let oracle = await Oracle.at(await _acb.oracle_address());
      await oracle.advance_phase(0);
    }, "Ownable");

    await should_throw(async () => {
      let oracle = await Oracle.at(await _acb.oracle_address());
      await oracle.advance_phase(0, {from: accounts[1]});
    }, "Ownable");

    await _acb.set_oracle_level(_level_max - 1);
    await check_control_supply(-_level_to_bond_price[_level_max - 1] * 1, 1, 0);
    let t13 = (await _acb.get_timestamp()).toNumber() + _bond_redemption_period;
    await check_purchase_bonds(1, {from: accounts[1]}, t13);

    await should_throw(async () => {
      let holder = await TokenHolder.at(
          await _acb.bond_holder_address(accounts[1], t13));
      await holder.set_amount(1);
    }, "Ownable");

    await should_throw(async () => {
      let holder = await TokenHolder.at(
          await _acb.bond_holder_address(accounts[1], t13));
      await holder.set_amount(1, {from: accounts[1]});
    }, "Ownable");


    async function _mint_at_default_level() {
      let current = await get_current([], []);
      let delta = Math.floor(current.coin_supply.amount * (11 - 10) / 10);
      delta = Math.floor(delta * _dumping_factor / 100);
      let mint = (Math.floor(delta / _bond_redemption_price) *
                  _bond_redemption_price);
      assert(delta > 0);
      assert.equal(current.bond_supply.amount, 0);
      assert.equal(current.bond_budget, 0);
      return mint;
    }

    async function check_create_account(option) {
      let receipt = await _acb.create_account(option);
      let args =
          receipt.logs.filter(e => e.event == 'CreateAccountEvent')[0].args;
      assert.equal(args[0], option.from);

    }

    async function check_vote(
        committed_hash, revealed_level, revealed_salt, option,
        commit_result, reveal_result, reclaim_amount, phase_updated) {
      let receipt = await _acb.vote(
          committed_hash, revealed_level, revealed_salt, option);
      let args = receipt.logs.filter(e => e.event == 'VoteEvent')[0].args;
      assert.equal(args[0], option.from);
      assert.equal(args[1], committed_hash);
      assert.equal(args[2], revealed_level);
      assert.equal(args[3], revealed_salt);
      assert.equal(args[4], commit_result);
      assert.equal(args[5], reveal_result);
      assert.equal(args[6], reclaim_amount);
      assert.equal(args[7], phase_updated);
    }

    async function check_transfer(receiver, amount, option) {
      let receipt = await _acb.transfer(receiver, amount, option);
      let args = receipt.logs.filter(e => e.event == 'TransferEvent')[0].args;
      assert.equal(args[0], option.from);
      assert.equal(args[1], receiver);
      assert.equal(args[2], amount);
    }

    async function check_purchase_bonds(count, option, redemption) {
      let receipt = await _acb.purchase_bonds(count, option);
      let args =
          receipt.logs.filter(e => e.event == 'PurchaseBondsEvent')[0].args;
      assert.equal(args[0], option.from);
      assert.equal(args[1], count);
      assert.equal(args[2], redemption);
    }

    async function check_redeem_bonds(redemptions, option, count_total) {
      let receipt = await _acb.redeem_bonds(redemptions, option);
      let args =
          receipt.logs.filter(e => e.event == 'RedeemBondsEvent')[0].args;
      assert.equal(args[0], option.from);
      for (let i = 0; i < redemptions.length; i++) {
        assert.equal(args[1][i], redemptions[i]);
      }
      assert.equal(args[2], count_total);
    }

    async function check_control_supply(delta, bond_budget, mint) {
      let receipt = await _acb.control_supply(delta);
      let args =
          receipt.logs.filter(e => e.event == 'ControlSupplyEvent')[0].args;
      assert.equal(args[0], delta);
      assert.equal(args[1], bond_budget);
      assert.equal(args[2], mint);
    }

    async function get_current(accounts, redemptions) {
      let acb = {};
      acb.bond_budget = (await _acb.get_bond_budget()).toNumber();
      acb.oracle_level = (await _acb.get_oracle_level()).toNumber();
      acb.coin_supply = {};
      acb.coin_supply.amount = (await _acb.get_coin_supply()).toNumber();
      acb.bond_supply = {};
      acb.bond_supply.amount = (await _acb.get_bond_supply()).toNumber();
      acb.balances = {};
      acb.bonds = {};
      let coin_amounts = await _acb.get_balances(accounts);
      for (let i = 0; i < accounts.length; i++) {
        if (coin_amounts[i] >= 0) {
          acb.balances[accounts[i]] = {};
          acb.balances[accounts[i]].amount = coin_amounts[i].toNumber();
        }
        acb.bonds[accounts[i]] = {};
        let bond_amounts = await _acb.get_bonds(accounts[i], redemptions);
        for (let j = 0; j < redemptions.length; j++) {
          if (bond_amounts[j] >= 0) {
            acb.bonds[accounts[i]][redemptions[j]] = {};
            acb.bonds[accounts[i]][redemptions[j]].amount =
                bond_amounts[j].toNumber();
          }
        }
      }
      return acb;
    }

    async function should_throw(callback, match) {
      let threw = false;
      try {
        await callback();
      } catch (e) {
        if (e.toString().indexOf(match) == -1) {
          console.log(e);
        } else {
          threw = true;
        }
      } finally {
        assert.equal(threw, true);
      }
    }

  });
}

function mod(i, j) {
  return (i % j) < 0 ? (i % j) + 0 + (j < 0 ? -j : j) : (i % j + 0);
}
