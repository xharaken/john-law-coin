// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");
const BondOperationForTesting = artifacts.require("BondOperationForTesting");
const common = require("./common.js");
const should_throw = common.should_throw;
const mod = common.mod;

contract("BondOperationUnittest", function (accounts) {
  let args = common.custom_arguments();
  assert.isTrue(args.length == 4);
  parameterized_test(accounts,
                     args[0],
                     args[1],
                     args[2],
                     args[3]);
});

function parameterized_test(accounts,
                            _bond_price,
                            _bond_redemption_price,
                            _bond_redemption_period,
                            _bond_redeemable_period) {
  let test_name = "BondOperation parameters:" +
      " bond_price=" + _bond_price +
      " bond_redemp_price=" + _bond_redemption_price +
      " bond_redemp_period=" + _bond_redemption_period +
      " bond_redeemable_period=" + _bond_redeemable_period;
  console.log(test_name);
  
  it(test_name, async function () {
    // Cannot use deployProxy because {from: ...} is not supported.
    let _coin = await JohnLawCoin.new({from: accounts[1]});
    common.print_contract_size(_coin, "JohnLawCoin");
    await _coin.initialize({from: accounts[1]});
    let _bond = await JohnLawBond.new({from: accounts[1]});
    common.print_contract_size(_bond, "JohnLawBond");
    await _bond.initialize({from: accounts[1]});
    let _bond_operation =
        await BondOperationForTesting.new({from: accounts[1]});
    common.print_contract_size(_bond_operation, "BondOperationForTesting");
    await _bond_operation.initialize(_bond.address, {from: accounts[1]});
    
    await _bond_operation.overrideConstants(_bond_price,
                                            _bond_redemption_price,
                                            _bond_redemption_period,
                                            _bond_redeemable_period,
                                            {from: accounts[1]});
    
    await _bond.transferOwnership(_bond_operation.address, {from: accounts[1]});
    
    let _epoch_id = 3;
    
    let current;
    let redemptions = [];
    let sub_accounts = accounts.slice(1, 4);
    
    // update_bond_budget
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(_bond_redemption_price - 1, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(_bond_redemption_price, 0,
                                   _bond_redemption_price);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(_bond_redemption_price + 1, 0,
                                   _bond_redemption_price);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(_bond_redemption_price * 10, 0,
                                   _bond_redemption_price * 10);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    
    await check_update_bond_budget(-(_bond_price - 1), 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(-_bond_price, 1, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0, 0);
    assert.equal(current.bond_budget, 1);
    await check_update_bond_budget(0, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(-_bond_price * 99, 99, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 99);
    await check_update_bond_budget(0, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(-_bond_price * 100, 100, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 100);
    
    await check_increase_bond_supply(accounts[1], 50,
                                     _epoch_id + _bond_redemption_period);
    await check_increase_bond_supply(accounts[1], 50,
                                     _epoch_id + _bond_redemption_period);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 100);
    assert.equal(current.bond_budget, 0);
    
    await check_update_bond_budget(_bond_redemption_price - 1, 0, 0);
    current = await get_current([], []);
    await check_update_bond_budget(_bond_redemption_price, -1, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -1);
    await check_update_bond_budget(_bond_redemption_price + 1, -1, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -1);
    await check_update_bond_budget(_bond_redemption_price * 68, -68, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -68);
    await check_update_bond_budget(0, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(_bond_redemption_price * 30, -30, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -30);
    await check_update_bond_budget(_bond_redemption_price - 1, 0, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, 0);
    await check_update_bond_budget(_bond_redemption_price * 200,
                                   -100,
                                   _bond_redemption_price * 100);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -100);
    await check_update_bond_budget(_bond_redemption_price * 100, -100, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -100);
    await check_update_bond_budget(_bond_redemption_price * 100, -100, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -100);
    
    await check_update_bond_budget(-_bond_price * 100, 100, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 100);
    assert.equal(current.bond_budget, 100);
    
    await check_increase_bond_supply(accounts[1], 50,
                                     _epoch_id + _bond_redemption_period);
    await check_increase_bond_supply(accounts[1], 50,
                                     _epoch_id + _bond_redemption_period);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 200);
    assert.equal(current.bond_budget, 0);
    
    await check_update_bond_budget(_bond_redemption_price * 30 - 1, -29, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -29);
    await check_update_bond_budget(_bond_redemption_price * 30, -30, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -30);
    await check_update_bond_budget(_bond_redemption_price * 30 + 1, -30, 0);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -30);
    await check_update_bond_budget(_bond_redemption_price * 210,
                                   -200,
                                   _bond_redemption_price * 10);
    current = await get_current([], []);
    assert.equal(current.bond_budget, -200);
    
    await check_decrease_bond_supply(
      accounts[1], [_epoch_id + _bond_redemption_period], 200, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 0);
    
    if (_bond_price >= 2 &&
        _bond_redemption_price >= 2 &&
        _bond_redemption_period >= 3 &&
        _bond_redeemable_period >= 3) {
      
      // increase_bond_supply
      await check_update_bond_budget(-_bond_price * 80, 80, 0);
      current = await get_current([], []);
      assert.equal(current.bond_supply, 0);
      assert.equal(current.bond_budget, 80);
      
      coin_supply = current.coin_supply;
      
      _epoch_id += 1;
      let t1 = _epoch_id + _bond_redemption_period;
      redemptions = [t1];
      
      _coin.move(
        accounts[1], accounts[2], _bond_price * 30, {from: accounts[1]});
      _coin.move(
        accounts[1], accounts[3], _bond_price * 50, {from: accounts[1]});
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[4], 1, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[5], 1, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[1], 0, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[1], 81, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[2], 0, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[2], 81, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[2], 31, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[3], 0, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[3], 81, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[3], 51, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      
      await check_increase_bond_supply(accounts[2], 1, t1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 1);
      assert.equal(current.bond_budget, 79);
      assert.equal(current.bonds[accounts[2]][t1], 1);
      check_redemption_epochs(current, accounts[2], [t1]);
      assert.equal(current.coin_supply, coin_supply - _bond_price * 1);
      
      await check_increase_bond_supply(accounts[2], 10, t1);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 11);
      assert.equal(current.bond_budget, 69);
      assert.equal(current.bonds[accounts[2]][t1], 11);
      check_redemption_epochs(current, accounts[2], [t1]);
      assert.equal(current.coin_supply, coin_supply - _bond_price * 11);
      
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[1], 70, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[3], 70, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      
      _epoch_id += 1;
      let t2 = _epoch_id + _bond_redemption_period;
      redemptions = [t2];
      
      await check_increase_bond_supply(accounts[2], 1, t2);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 12);
      assert.equal(current.bond_budget, 68);
      assert.equal(current.bonds[accounts[2]][t2], 1);
      check_redemption_epochs(current, accounts[2], [t1, t2]);
      assert.equal(current.coin_supply, coin_supply - _bond_price * 12);
      
      await check_increase_bond_supply(accounts[2], 10, t2);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 22);
      assert.equal(current.bond_budget, 58);
      assert.equal(current.bonds[accounts[2]][t2], 11);
      check_redemption_epochs(current, accounts[2], [t1, t2]);
      assert.equal(current.coin_supply, coin_supply - _bond_price * 22);
      
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[1], 59, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[3], 59, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      
      await check_increase_bond_supply(accounts[1], 10, t2);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 32);
      assert.equal(current.bond_budget, 48);
      assert.equal(current.bonds[accounts[1]][t2], 10);
      check_redemption_epochs(current, accounts[1], [t2]);
      assert.equal(current.coin_supply, coin_supply - _bond_price * 32);
      
      _epoch_id += 1;
      let t3 = _epoch_id + _bond_redemption_period;
      redemptions = [t3];
      
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[3], 49, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      await check_increase_bond_supply(accounts[3], 48, t3);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 80);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bonds[accounts[3]][t3], 48);
      check_redemption_epochs(current, accounts[3], [t3]);
      assert.equal(current.coin_supply, coin_supply - _bond_price * 80);
      
      _coin.move(accounts[1], accounts[2],
                 _bond_price * 10, {from: accounts[1]});
      _coin.move(accounts[1], accounts[3],
                 _bond_price * 10, {from: accounts[1]});
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[2], 1, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 80);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bonds[accounts[3]][t3], 48);
      check_redemption_epochs(current, accounts[3], [t3]);
      assert.equal(current.coin_supply, coin_supply - _bond_price * 80);
      await should_throw(async () => {
        await _bond_operation.increaseBondSupply.call(
          accounts[3], 1, _epoch_id, _coin.address, {from: accounts[1]});
      }, "BondOperation");
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_supply, 80);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bonds[accounts[3]][t3], 48);
      check_redemption_epochs(current, accounts[3], [t3]);
      assert.equal(current.coin_supply, coin_supply - _bond_price * 80);
      
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.balances[accounts[2]], (30 + 10 - 22) * _bond_price);
      assert.equal(current.balances[accounts[3]], (50 + 10 - 48) * _bond_price);
      
      // decrease_bond_supply
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
      
      _epoch_id += _bond_redemption_period;
      let t4 = _epoch_id + _bond_redemption_period;
      redemptions = [t1, t2, t3, t4];
      
      await check_decrease_bond_supply(accounts[4], [t1], 0, 0);
      await check_decrease_bond_supply(accounts[2], [], 0, 0);
      
      current = await get_current(sub_accounts, redemptions);
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      balance = current.balances[accounts[2]];
      assert.equal(current.bond_budget, 0);
      await check_decrease_bond_supply(accounts[2], [t1], 11, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t1], 0);
      assert.equal(current.bonds[accounts[2]][t2], 11);
      assert.equal(current.bonds[accounts[2]][t3], 0);
      check_redemption_epochs(current, accounts[2], [t2]);
      assert.equal(current.balances[accounts[2]],
                   balance + 11 * _bond_redemption_price);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bond_supply, bond_supply - 11);
      assert.equal(current.coin_supply,
                   coin_supply + 11 * _bond_redemption_price);
      
      await check_decrease_bond_supply(accounts[2], [t2, 123456], 11, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t1], 0);
      assert.equal(current.bonds[accounts[2]][t2], 0);
      check_redemption_epochs(current, accounts[2], []);
      assert.equal(current.balances[accounts[2]],
                   balance + 22 * _bond_redemption_price);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bond_supply, bond_supply - 22);
      assert.equal(current.coin_supply,
                   coin_supply + 22 * _bond_redemption_price);
      
      await check_decrease_bond_supply(accounts[2], [t3], 0, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t1], 0);
      assert.equal(current.bonds[accounts[2]][t2], 0);
      assert.equal(current.bonds[accounts[2]][t3], 0);
      check_redemption_epochs(current, accounts[2], []);
      assert.equal(current.balances[accounts[2]],
                   balance + 22 * _bond_redemption_price);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bond_supply, bond_supply - 22);
      assert.equal(current.coin_supply,
                   coin_supply + 22 * _bond_redemption_price);
      
      balance = current.balances[accounts[3]];
      await check_decrease_bond_supply(accounts[3], [t2, t2, t1], 0, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[3]][t1], 0);
      assert.equal(current.bonds[accounts[3]][t2], 0);
      assert.equal(current.bonds[accounts[3]][t3], 48);
      check_redemption_epochs(current, accounts[3], [t3]);
      assert.equal(current.balances[accounts[3]], balance);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bond_supply, bond_supply - 22);
      assert.equal(current.coin_supply,
                   coin_supply + 22 * _bond_redemption_price);
      
      await check_decrease_bond_supply(accounts[3], [t3, t3, t3], 48, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[3]][t1], 0);
      assert.equal(current.bonds[accounts[3]][t2], 0);
      assert.equal(current.bonds[accounts[3]][t3], 0);
      check_redemption_epochs(current, accounts[3], []);
      assert.equal(current.balances[accounts[3]],
                   balance + 48 * _bond_redemption_price);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bond_supply, bond_supply - 70);
      assert.equal(current.coin_supply,
                   coin_supply + 70 * _bond_redemption_price);
      
      balance = current.balances[accounts[1]];
      await check_decrease_bond_supply(accounts[1], [t2], 10, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[1]][t2], 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[1]), 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[2]), 0);
      assert.equal(await _bond.numberOfBondsOwnedBy(accounts[3]), 0);
      check_redemption_epochs(current, accounts[1], []);
      assert.equal(current.balances[accounts[1]],
                   balance + 10 * _bond_redemption_price);
      assert.equal(current.bond_budget, 0);
      assert.equal(current.bond_supply, bond_supply - 80);
      assert.equal(current.coin_supply, coin_supply +
                   80 * _bond_redemption_price);
      assert.equal(current.bond_supply, 0);
      
      assert.equal(current.bond_budget, 0);
      await check_update_bond_budget(-100 * _bond_price, 100, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, 100);
      
      balance = current.balances[accounts[2]];
      _coin.move(accounts[2], accounts[1],
                 balance, {from: accounts[1]});
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.balances[accounts[2]], 0);
      _coin.move(accounts[1], accounts[2],
                 100 * _bond_price, {from: accounts[1]});
      await check_increase_bond_supply(accounts[2], 20, t4);
      let t5 = _epoch_id + _bond_redemption_period;
      redemptions.push(t5);
      await check_increase_bond_supply(accounts[2], 20, t5);
      _epoch_id += _bond_redemption_period - 1;
      let t6 = _epoch_id + _bond_redemption_period;
      redemptions.push(t6);
      await check_increase_bond_supply(accounts[2], 20, t6);
      _epoch_id += 1;
      let t7 = _epoch_id + _bond_redemption_period;
      redemptions.push(t7);
      await check_increase_bond_supply(accounts[2], 20, t7);
      _epoch_id += 1;
      let t8 = _epoch_id + _bond_redemption_period;
      redemptions.push(t8);
      await check_increase_bond_supply(accounts[2], 20, t8);
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
      await check_decrease_bond_supply(
        accounts[2], [t4, t5, t6, t7, t8], 40, 0);
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
      assert.equal(current.bond_budget, 0);
      
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_decrease_bond_supply(accounts[2], [t6, t7, t8], 0, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 20);
      assert.equal(current.bonds[accounts[2]][t7], 20);
      assert.equal(current.bonds[accounts[2]][t8], 20);
      check_redemption_epochs(current, accounts[2], [t6, t7, t8]);
      assert.equal(current.coin_supply, coin_supply);
      assert.equal(current.bond_supply, bond_supply);
      assert.equal(current.bond_budget, 0);
      
      await check_update_bond_budget(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);
      
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_decrease_bond_supply(accounts[2], [t6, t7, t8], 5, 0);
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
      await check_update_bond_budget(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);
      
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_decrease_bond_supply(accounts[2], [t8, t7, t6], 5, 0);
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
      await check_update_bond_budget(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);
      
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_decrease_bond_supply(accounts[2], [t7], 5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 15);
      assert.equal(current.bonds[accounts[2]][t7], 15);
      assert.equal(current.bonds[accounts[2]][t8], 15);
      check_redemption_epochs(current, accounts[2], [t6, t7, t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 5 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 5);
      assert.equal(current.bond_budget, 0);
      
      _epoch_id += _bond_redemption_period - 2;
      let t9 = _epoch_id + _bond_redemption_period;
      
      assert.equal(current.bond_budget, 0);
      await check_update_bond_budget(5 * _bond_redemption_price, -5, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -5);
      
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      assert.equal(t9 - t6, _bond_redemption_period);
      assert.equal(t6 <= _epoch_id, true);
      await check_decrease_bond_supply(accounts[2], [t6, t8, t7], 20, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 0);
      assert.equal(current.bonds[accounts[2]][t7], 15);
      assert.equal(current.bonds[accounts[2]][t8], 10);
      check_redemption_epochs(current, accounts[2], [t7, t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 20 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 20);
      assert.equal(current.bond_budget, 0);
      
      await check_update_bond_budget(15 * _bond_redemption_price, -15, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -15);
      await check_update_bond_budget(30 * _bond_redemption_price,
                                     -25, 5 * _bond_redemption_price);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -25);
      await check_update_bond_budget(1 * _bond_redemption_price, -1, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -1);
      
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_decrease_bond_supply(accounts[2], [t7, t8], 1, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 0);
      assert.equal(current.bonds[accounts[2]][t7], 14);
      assert.equal(current.bonds[accounts[2]][t8], 10);
      check_redemption_epochs(current, accounts[2], [t7, t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 1 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 1);
      assert.equal(current.bond_budget, 0);
      
      _epoch_id += 1;
      let t10 = _epoch_id + _bond_redemption_period;
      
      await check_update_bond_budget(2 * _bond_redemption_price, -2, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -2);
      
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_decrease_bond_supply(accounts[2], [t8, t7], 16, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 0);
      assert.equal(current.bonds[accounts[2]][t7], 0);
      assert.equal(current.bonds[accounts[2]][t8], 8);
      check_redemption_epochs(current, accounts[2], [t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 16 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 16);
      assert.equal(current.bond_budget, 0);
      
      await check_update_bond_budget(1 * _bond_redemption_price, -1, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, -1);
      
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_decrease_bond_supply(accounts[2], [t8], 1, 0);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bonds[accounts[2]][t6], 0);
      assert.equal(current.bonds[accounts[2]][t7], 0);
      assert.equal(current.bonds[accounts[2]][t8], 7);
      check_redemption_epochs(current, accounts[2], [t8]);
      assert.equal(current.coin_supply,
                   coin_supply + 1 * _bond_redemption_price);
      assert.equal(current.bond_supply, bond_supply - 1);
      assert.equal(current.bond_budget, 0);
      
      _epoch_id += 1;
      let t11 = _epoch_id + _bond_redemption_period;
      
      coin_supply = current.coin_supply;
      bond_supply = current.bond_supply;
      await check_decrease_bond_supply(accounts[2], [t8], 7, 0);
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
      assert.equal(current.bond_budget, 0);
      
      assert.equal(current.bond_supply, 0);
      assert.equal(current.bond_budget, 0);
      await check_update_bond_budget(5 * _bond_redemption_price,
                                     0, 5 * _bond_redemption_price);
      current = await get_current(sub_accounts, redemptions);
      assert.equal(current.bond_budget, 0);
    }
    
    // bond expire
    await check_update_bond_budget(-_bond_price * 80, 80, 0);
    current = await get_current([], []);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.bond_budget, 80);
    
    _coin.move(
      accounts[1], accounts[2], _bond_price * 30, {from: accounts[1]});
    
    _epoch_id += 1;
    t1 = _epoch_id + _bond_redemption_period;
    redemptions = [t1]
    
    await check_increase_bond_supply(accounts[2], 10, t1);
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 10);
    assert.equal(current.valid_bond_supply, 10);
    assert.equal(current.bonds[accounts[2]][t1], 10);
    check_redemption_epochs(current, accounts[2], [t1]);
    
    _epoch_id += 1;
    t2 = _epoch_id + _bond_redemption_period;
    redemptions = [t1, t2]
    
    await check_increase_bond_supply(accounts[2], 20, t2);
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 30);
    assert.equal(current.valid_bond_supply, 30);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t1, t2]);
    
    _epoch_id += _bond_redemption_period + _bond_redeemable_period - 2
    
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 30);
    assert.equal(current.valid_bond_supply, 30);
    assert.equal(current.bonds[accounts[2]][t1], 10);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t1, t2]);
    
    await check_decrease_bond_supply(accounts[2], [t1], 10, 0);
    await check_decrease_bond_supply(accounts[2], [t1], 0, 0);
    
    _epoch_id += 1;
    
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 20);
    assert.equal(current.valid_bond_supply, 20);
    assert.equal(current.bonds[accounts[2]][t1], 0);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t2]);
    
    await check_decrease_bond_supply(accounts[2], [t2], 20, 0);
    await check_decrease_bond_supply(accounts[2], [t2], 0, 0);
    
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.valid_bond_supply, 0);
    assert.equal(current.bonds[accounts[2]][t1], 0);
    assert.equal(current.bonds[accounts[2]][t2], 0);
    check_redemption_epochs(current, accounts[2], []);
    
    _coin.move(
      accounts[1], accounts[2], _bond_price * 30, {from: accounts[1]});
    
    _epoch_id += 1;
    t1 = _epoch_id + _bond_redemption_period;
    redemptions = [t1];
    
    await check_increase_bond_supply(accounts[2], 10, t1);
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 10);
    assert.equal(current.valid_bond_supply, 10);
    assert.equal(current.bonds[accounts[2]][t1], 10);
    check_redemption_epochs(current, accounts[2], [t1]);
    
    _epoch_id += 1;
    t2 = _epoch_id + _bond_redemption_period;
    redemptions = [t1, t2];
    
    await check_increase_bond_supply(accounts[2], 20, t2);
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 30);
    assert.equal(current.valid_bond_supply, 30);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t1, t2]);
    
    _epoch_id += _bond_redemption_period + _bond_redeemable_period - 1
    
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 30);
    assert.equal(current.valid_bond_supply, 20);
    assert.equal(current.bonds[accounts[2]][t1], 10);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t1, t2]);
    
    await check_decrease_bond_supply(accounts[2], [t1], 0, 10);
    
    _epoch_id += 1;
    
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 20);
    assert.equal(current.valid_bond_supply, 0);
    assert.equal(current.bonds[accounts[2]][t1], 0);
    assert.equal(current.bonds[accounts[2]][t2], 20);
    check_redemption_epochs(current, accounts[2], [t2]);
    
    await check_decrease_bond_supply(accounts[2], [t2], 0, 20);
    
    current = await get_current(sub_accounts, redemptions);
    assert.equal(current.bond_supply, 0);
    assert.equal(current.valid_bond_supply, 0);
    assert.equal(current.bonds[accounts[2]][t1], 0);
    assert.equal(current.bonds[accounts[2]][t2], 0);
    check_redemption_epochs(current, accounts[2], []);
    
    // Initializable
    await should_throw(async () => {
      await _bond_operation.initialize(_bond.address, {from: accounts[1]});
    }, "Initializable");
    
    // Ownable
    await should_throw(async () => {
      await _bond_operation.increaseBondSupply(
        accounts[1], 1, _epoch_id, _coin.address);
    }, "Ownable");
    
    await should_throw(async () => {
      await _bond_operation.increaseBondSupply(
        accounts[1], 1, _epoch_id, _coin.address, {from: accounts[2]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _bond_operation.decreaseBondSupply(
        accounts[1], [1], _epoch_id, _coin.address);
    }, "Ownable");
    
    await should_throw(async () => {
      await _bond_operation.increaseBondSupply(
        accounts[1], [1], _epoch_id, _coin.address, {from: accounts[2]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _bond_operation.updateBondBudget(0, _epoch_id);
    }, "Ownable");
    
    await should_throw(async () => {
      await _bond_operation.updateBondBudget(0, _epoch_id, {from: accounts[2]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _bond_operation.revokeOwnership(_coin.address);
    }, "Ownable");
    
    await should_throw(async () => {
      await _bond_operation.revokeOwnership(_coin.address, {from: accounts[2]});
    }, "Ownable");
    
    // deprecate
    await _bond_operation.deprecate({from: accounts[1]});
    
    await should_throw(async () => {
      await _bond_operation.increaseBondSupply(
        accounts[1], 1, _epoch_id, _coin.address, {from: accounts[1]});
    }, "Ownable");
    
    await should_throw(async () => {
      await _bond_operation.deprecate({from: accounts[1]});
    }, "Ownable");
    
    await _bond.transferOwnership(_bond_operation.address, {from: accounts[1]});
    await _bond_operation.deprecate({from: accounts[1]});
    
    async function check_update_bond_budget(delta, bond_budget, mint) {
      let receipt = await _bond_operation.updateBondBudget(
        delta, _epoch_id, {from: accounts[1]});
      let args =
          receipt.logs.filter(e => e.event == 'UpdateBondBudgetEvent')[0].args;
      assert.equal(args.delta, delta);
      assert.equal(args.bond_budget, bond_budget);
      assert.equal(args.mint, mint);
    }
    
    async function check_increase_bond_supply(
      sender, issued_bonds, redemption) {
      await _coin.transferOwnership(
        _bond_operation.address, {from: accounts[1]});
      let receipt = await _bond_operation.increaseBondSupply(
        sender, issued_bonds, _epoch_id, _coin.address, {from: accounts[1]});
      await _bond_operation.revokeOwnership(_coin.address, {from: accounts[1]});
      let args =
          receipt.logs.filter(
            e => e.event == 'IncreaseBondSupplyEvent')[0].args;
      assert.equal(args.sender, sender);
      assert.equal(args.issued_bonds, issued_bonds);
      assert.equal(args.redemption_epoch, redemption);
    }
    
    async function check_decrease_bond_supply(
      sender, redemptions, redeemed_bonds, expired_bonds) {
      await _coin.transferOwnership(
        _bond_operation.address, {from: accounts[1]});
      let receipt = await _bond_operation.decreaseBondSupply(
        sender, redemptions, _epoch_id, _coin.address, {from: accounts[1]});
      await _bond_operation.revokeOwnership(_coin.address, {from: accounts[1]});
      let args =
          receipt.logs.filter(
            e => e.event == 'DecreaseBondSupplyEvent')[0].args;
      assert.equal(args.sender, sender);
      assert.equal(args.redeemed_bonds, redeemed_bonds);
      assert.equal(args.expired_bonds, expired_bonds);
    }
    
    function check_redemption_epochs(current, account, expected) {
      let actual = current.redemption_epochs[account];
      assert.equal(actual.length, expected.length);
      for (let index = 0; index < actual.length; index++) {
        assert.isTrue(expected.includes(actual[index]));
      }
    }
    
    async function get_current(accounts, redemptions) {
      let bond_operation = {};
      bond_operation.bond_budget =
        (await _bond_operation.bond_budget_()).toNumber();
      bond_operation.coin_supply =(await _coin.totalSupply()).toNumber();
      bond_operation.bond_supply = (await _bond.totalSupply()).toNumber();
      bond_operation.valid_bond_supply =
        (await _bond_operation.validBondSupply(_epoch_id)).toNumber();
      bond_operation.balances = {};
      bond_operation.bonds = {};
      bond_operation.redemption_epochs = {};
      for (let i = 0; i < accounts.length; i++) {
        bond_operation.balances[accounts[i]] =
          (await _coin.balanceOf(accounts[i])).toNumber();
        bond_operation.bonds[accounts[i]] = {};
        for (let j = 0; j < redemptions.length; j++) {
          bond_operation.bonds[accounts[i]][redemptions[j]] =
            (await _bond.balanceOf(accounts[i], redemptions[j])).toNumber();
        }
        bond_operation.redemption_epochs[accounts[i]] = [];
        let bond_count =
            (await _bond.numberOfRedemptionEpochsOwnedBy(
              accounts[i])).toNumber();
        for (let index = 0; index < bond_count; index++) {
          let redemption = (
            await _bond.getRedemptionEpochOwnedBy(
              accounts[i], index)).toNumber();
          bond_operation.redemption_epochs[accounts[i]].push(redemption);
        }
      }
      return bond_operation;
    }
  });
}
