// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const OpenMarketOperation = artifacts.require("OpenMarketOperation");
const OpenMarketOperationForTesting =
      artifacts.require("OpenMarketOperationForTesting");
const common = require("./common.js");
const should_throw = common.should_throw;
const array_equal = common.array_equal;

contract("OpenMarketOperationUnittest", function (accounts) {
  let args = common.custom_arguments();
  assert.isTrue(args.length == 3);
  parameterized_test(accounts,
                     args[0],
                     args[1],
                     args[2]);
});

function parameterized_test(accounts,
                            _price_change_interval,
                            _price_change_percentage,
                            _start_price_multiplier) {
  let test_name = "OpenMarketOperation parameters: " +
      "price_change_interval=" + _price_change_interval +
      " price_change_percentage=" + _price_change_percentage +
      " start_price_multiplier=" + _start_price_multiplier;
  console.log(test_name);

  it(test_name, async function () {
    _operation = await deployProxy(OpenMarketOperationForTesting, []);
    await _operation.overrideConstants(_price_change_interval,
                                       _price_change_percentage,
                                       _start_price_multiplier);
    common.print_contract_size(_operation, "OpenMarketOperationForTesting");

    let latest_price = (await _operation.latest_price_()).toNumber();
        
    await should_throw(async () => {
      await _operation.increaseCoinSupply(-1, 0);
    }, "bounds");
    await should_throw(async () => {
      await _operation.increaseCoinSupply(0, -1);
    }, "bounds");
    
    assert.equal(await _operation.start_price_(), 0);
    assert.equal(await _operation.latest_price_(), latest_price);
    assert.equal(await _operation.coin_budget_(), 0);
    assert.equal(await _operation.eth_balance_(), 0);

    await should_throw(async () => {
      await _operation.increaseCoinSupply.call(0, 0);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.increaseCoinSupply.call(10, 10);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.decreaseCoinSupply.call(0, 0);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.decreaseCoinSupply.call(10, 10);
    }, "OpenMarketOperation");

    await _operation.updateCoinBudget(0);
    assert.equal(await _operation.start_price_(), 0);
    assert.equal(await _operation.latest_price_(), latest_price);
    assert.equal(await _operation.coin_budget_(), 0);
    assert.equal(await _operation.eth_balance_(), 0);
        
    await should_throw(async () => {
      await _operation.increaseCoinSupply.call(0, 0);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.increaseCoinSupply.call(10, 10);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.decreaseCoinSupply.call(0, 0);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.decreaseCoinSupply.call(10, 10);
    }, "OpenMarketOperation");

    let eth_balance = 0;
    for (let updated_coin_budget of [
      1000, 2000, -1000, -2000, 0, 10000, 0, -10000, -100000000]) {
      await _operation.updateCoinBudget(updated_coin_budget);
      let start_price = 0;
      if (updated_coin_budget > 0) {
        start_price = latest_price * _start_price_multiplier;
      } else if (updated_coin_budget < 0) {
        start_price = Math.trunc(latest_price / _start_price_multiplier);
      }
      assert.equal(await _operation.start_price_(), start_price);
      assert.equal(await _operation.latest_price_(), latest_price);
      assert.equal(await _operation.coin_budget_(), updated_coin_budget);
      assert.equal(await _operation.eth_balance_(), eth_balance);

      if (updated_coin_budget >= 0) {
        await should_throw(async () => {
          await _operation.decreaseCoinSupply.call(0, 0);
        }, "OpenMarketOperation");
        await should_throw(async () => {
          await _operation.decreaseCoinSupply.call(10, 10);
        }, "OpenMarketOperation");
      }
      if (updated_coin_budget <= 0) {
        await should_throw(async () => {
          await _operation.increaseCoinSupply.call(0, 0);
        }, "OpenMarketOperation");
        await should_throw(async () => {
          await _operation.increaseCoinSupply.call(10, 10);
        }, "OpenMarketOperation");
      }

      let coin_budget = updated_coin_budget;
      if (updated_coin_budget > 0) {
        for (let elapsed_time of [
          0, 1, _price_change_interval + 1,
          _price_change_interval,
          _price_change_interval - 1,
          _price_change_interval * 2,
          _price_change_interval * 2 - 1,
          _price_change_interval * 22]) {
          for (let requested_eth_amount of [
            0, 1, Math.trunc(updated_coin_budget * start_price / 4),
            Math.trunc(updated_coin_budget * start_price / 8),
            updated_coin_budget * start_price + 1]) {
            if (coin_budget == 0) {
              await should_throw(async () => {
                await _operation.increaseCoinSupply.call(
                  requested_eth_amount, elapsed_time);
              }, "OpenMarketOperation");
              continue;
            }
            let price = start_price;
            for (let i = 0;
                 i < Math.trunc(elapsed_time / _price_change_interval); i++) {
              price = Math.trunc(
                price * (100 - _price_change_percentage) / 100);
            }
            let eth_amount = 0;
            let coin_amount = 0;
            if (price == 0) {
              await should_throw(async () => {
                await _operation.increaseCoinSupply.call(
                  requested_eth_amount, elapsed_time);
              }, "OpenMarketOperation");
              continue;
            }
            coin_amount = Math.trunc(requested_eth_amount / price);
            if (coin_amount > coin_budget) {
              coin_amount = coin_budget;
            }
            eth_amount = coin_amount * price;
            if (coin_amount > 0) {
              latest_price = price;
            }
            coin_budget -= coin_amount;
            eth_balance += eth_amount;
            await check_increase_coin_supply(
              requested_eth_amount, elapsed_time, eth_amount, coin_amount);
            assert.equal(await _operation.start_price_(), start_price);
            assert.equal(await _operation.latest_price_(), latest_price);
            assert.equal(await _operation.coin_budget_(), coin_budget);
            assert.equal(await _operation.eth_balance_(), eth_balance);
          }
        }
      } else if (updated_coin_budget < 0) {
        for (let elapsed_time of [
          0, 1, _price_change_interval + 1,
          _price_change_interval,
          _price_change_interval - 1,
          _price_change_interval * 2,
          _price_change_interval * 2 - 1,
          _price_change_interval * 22]) {
          for (let requested_coin_amount of [
            0, 1, Math.trunc(-updated_coin_budget / 4),
            Math.trunc(-updated_coin_budget / 8),
            -updated_coin_budget + 1]) {
            if (coin_budget == 0) {
              await should_throw(async () => {
                await _operation.decreaseCoinSupply.call(
                  requested_coin_amount, elapsed_time);
              }, "OpenMarketOperation");
              continue;
            }
            let price = start_price;
            for (let i = 0;
                 i < Math.trunc(elapsed_time / _price_change_interval); i++) {
              price = Math.trunc(
                price * (100 + _price_change_percentage) / 100);
            }
            let eth_amount = 0;
            let coin_amount = 0;
            if (price == 0) {
              await should_throw(async () => {
                await _operation.decreaseCoinSupply.call(
                  requested_coin_amount, elapsed_time);
              }, "OpenMarketOperation");
              continue;
            }
            coin_amount = requested_coin_amount;
            if (coin_amount >= -coin_budget) {
              coin_amount = -coin_budget;
            }
            eth_amount = Math.trunc(coin_amount * price);
            if (eth_amount >= eth_balance) {
              eth_amount = eth_balance;
              }
            coin_amount = Math.trunc(eth_amount / price);
            if (coin_amount > 0) {
              latest_price = price;
            }
            coin_budget += coin_amount;
            eth_balance -= eth_amount;
            await check_decrease_coin_supply(
              requested_coin_amount, elapsed_time, eth_amount, coin_amount);
            assert.equal(await _operation.start_price_(), start_price);
            assert.equal(await _operation.latest_price_(), latest_price);
            assert.equal(await _operation.coin_budget_(), coin_budget);
            assert.equal(await _operation.eth_balance_(), eth_balance);
          }
        }
      }
    }

    async function check_increase_coin_supply(
      requested_eth_amount, elapsed_time, eth_amount, coin_amount) {
      let receipt = await _operation.increaseCoinSupply(
        requested_eth_amount, elapsed_time);
      let args = receipt.logs.filter(
        e => e.event == 'IncreaseCoinSupplyEvent')[0].args;
      assert.equal(args.requested_eth_amount, requested_eth_amount);
      assert.equal(args.elapsed_time, elapsed_time);
      assert.equal(args.eth_amount, eth_amount);
      assert.equal(args.coin_amount, coin_amount);
    }

    async function check_decrease_coin_supply(
      requested_coin_amount, elapsed_time, eth_amount, coin_amount) {
      let receipt = await _operation.decreaseCoinSupply(
        requested_coin_amount, elapsed_time);
      let args = receipt.logs.filter(
        e => e.event == 'DecreaseCoinSupplyEvent')[0].args;
      assert.equal(args.requested_coin_amount, requested_coin_amount);
      assert.equal(args.elapsed_time, elapsed_time);
      assert.equal(args.eth_amount, eth_amount);
      assert.equal(args.coin_amount, coin_amount);
    }     
  });

  it("Ownable", async function () {
    await should_throw(async () => {
      await _operation.initialize({from: accounts[1]});
    }, "Initializable");
    await should_throw(async () => {
      await _operation.increaseCoinSupply(1, 1, {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _operation.decreaseCoinSupply(1, 1, {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _operation.updateCoinBudget(1, {from: accounts[1]});
    }, "Ownable");
  });
}
