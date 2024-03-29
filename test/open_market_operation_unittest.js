// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const OpenMarketOperation = artifacts.require("OpenMarketOperation");
const OpenMarketOperationForTesting =
      artifacts.require("OpenMarketOperationForTesting");
const EthPool = artifacts.require("EthPool");
const common = require("./common.js");
const should_throw = common.should_throw;
const array_equal = common.array_equal;
const BN = web3.utils.BN;

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
                            _price_multiplier) {
  let test_name = "OpenMarketOperation parameters: " +
      "price_change_interval=" + _price_change_interval +
      " price_change_percentage=" + _price_change_percentage +
      " price_multiplier=" + _price_multiplier;
  console.log(test_name);

  it(test_name, async function () {
    _operation = await deployProxy(OpenMarketOperationForTesting, []);
    await _operation.overrideConstants(_price_change_interval,
                                       _price_change_percentage,
                                       _price_multiplier);
    common.print_contract_size(_operation, "OpenMarketOperationForTesting");
    _eth_pool = await deployProxy(EthPool, []);
    common.print_contract_size(_operation, "EthPool");

    _price_change_max = (await _operation.PRICE_CHANGE_MAX()).toNumber();
    let latest_price = await _operation.latest_price_();
    
    await should_throw(async () => {
      await _operation.increaseCoinSupply(-1, 0);
    }, "bounds");
    await should_throw(async () => {
      await _operation.increaseCoinSupply(0, -1);
    }, "bounds");
    
    assert.equal(await _operation.start_price_(), 0);
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.coin_budget_(), 0);
    
    await should_throw(async () => {
      await _operation.increaseCoinSupply.call(0, 0);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.increaseCoinSupply.call(10, 10);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.decreaseCoinSupply.call(0, 0, 0);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.decreaseCoinSupply.call(10, 10, 0);
    }, "OpenMarketOperation");
    
    await _operation.updateCoinBudget(0);
    assert.equal(await _operation.start_price_(), 0);
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.coin_budget_(), 0);
    
    await should_throw(async () => {
      await _operation.increaseCoinSupply.call(0, 0);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.increaseCoinSupply.call(10, 10);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.decreaseCoinSupply.call(0, 0, 0);
    }, "OpenMarketOperation");
    await should_throw(async () => {
      await _operation.decreaseCoinSupply.call(10, 10, 0);
    }, "OpenMarketOperation");
    
    assert.equal(await _operation.latest_price_updated_(), false);
    await _operation.updateCoinBudget(100);
    assert.equal(await _operation.latest_price_updated_(), false);
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.start_price_(),
                 (latest_price.mul(new BN(_price_multiplier))).
                 toString());
    assert.equal(await _operation.latest_price_updated_(), false);
    await _operation.updateCoinBudget(100);
    assert.equal(await _operation.latest_price_updated_(), false);
    latest_price = latest_price.div(new BN(_price_multiplier)).
      add(new BN(1));
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.start_price_(),
                 (latest_price.mul(new BN(_price_multiplier))).
                 toString());
    assert.equal(await _operation.latest_price_updated_(), false);
    await _operation.updateCoinBudget(0);
    assert.equal(await _operation.latest_price_updated_(), false);
    latest_price = latest_price.div(new BN(_price_multiplier)).
      add(new BN(1));
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.start_price_(), 0);
    assert.equal(await _operation.latest_price_updated_(), false);
    await _operation.updateCoinBudget(0);
    assert.equal(await _operation.latest_price_updated_(), false);
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.start_price_(), 0);
    assert.equal(await _operation.latest_price_updated_(), false);
    await _operation.updateCoinBudget(-100);
    assert.equal(await _operation.latest_price_updated_(), false);
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.start_price_(),
                 (latest_price.div(new BN(_price_multiplier)).
                  add(new BN(1))).toString());
    assert.equal(await _operation.latest_price_updated_(), false);
    await _operation.updateCoinBudget(-100);
    assert.equal(await _operation.latest_price_updated_(), false);
    latest_price = latest_price.mul(new BN(_price_multiplier));
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.start_price_(),
                 (latest_price.div(new BN(_price_multiplier)).
                  add(new BN(1))).toString());
    assert.equal(await _operation.latest_price_updated_(), false);
    await _operation.updateCoinBudget(100);
    assert.equal(await _operation.latest_price_updated_(), false);
    latest_price = latest_price.mul(new BN(_price_multiplier));
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.start_price_(),
                 (latest_price.mul(new BN(_price_multiplier)).
                  toString()));
    assert.equal(await _operation.latest_price_updated_(), false);
    await _operation.updateCoinBudget(0);
    latest_price = latest_price.div(new BN(_price_multiplier)).
      add(new BN(1));
    assert.equal(await _operation.latest_price_(), latest_price.toString());
    assert.equal(await _operation.start_price_(), 0);

    let eth_balance = new BN(0);
    let latest_price_updated = false;
    for (let updated_coin_budget of [
      1000, 2000, -1000, -2000, 0, 10000, 0,
      -10000, -100000000, -100, -100000000]) {
      if (latest_price_updated == false) {
        if ((await _operation.coin_budget_()) > 0) {
          latest_price = latest_price.div(new BN(_price_multiplier)).
            add(new BN(1));
        } else if ((await _operation.coin_budget_()) < 0) {
          latest_price = latest_price.mul(new BN(_price_multiplier));
        }
      }
      
      latest_price_updated = false;
      await _operation.updateCoinBudget(updated_coin_budget);
      let start_price = new BN(0);
      if (updated_coin_budget > 0) {
        start_price = latest_price.mul(new BN(_price_multiplier));
      } else if (updated_coin_budget < 0) {
        start_price = latest_price.div(new BN(_price_multiplier)).
          add(new BN(1));
      }
      assert.equal(await _operation.latest_price_updated_(), false);
      assert.equal(await _operation.start_price_(), start_price.toString());
      assert.equal(await _operation.latest_price_(), latest_price.toString());
      assert.equal(await _operation.coin_budget_(), updated_coin_budget);
      
      if (updated_coin_budget >= 0) {
        await should_throw(async () => {
          await _operation.decreaseCoinSupply.call(0, 0, 0);
        }, "OpenMarketOperation");
        await should_throw(async () => {
          await _operation.decreaseCoinSupply.call(10, 10, 0);
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
            new BN(0), new BN(1),
            (new BN(updated_coin_budget)).mul(new BN(start_price)).
              div(new BN(4)),
            (new BN(updated_coin_budget)).mul(new BN(start_price)).
              div(new BN(8)),
            (new BN(updated_coin_budget)).mul(new BN(start_price)).
              add(new BN(1))]) {
            if (coin_budget == 0) {
              await should_throw(async () => {
                await _operation.increaseCoinSupply.call(
                  requested_eth_amount.toString(), elapsed_time);
              }, "OpenMarketOperation");
              continue;
            }
            
            let price = start_price;
            for (let i = 0;
                 i < Math.trunc(elapsed_time / _price_change_interval) &&
                 i < _price_change_max; i++) {
              price = price.mul(new BN(100 - _price_change_percentage)).
                div(new BN(100));
            }
            if (price.eq(new BN(0))) {
              price = new BN(1);
            }
            assert.equal(await _operation.getCurrentPrice(elapsed_time),
                         price.toString());
            
            let coin_amount = requested_eth_amount.div(price).toNumber();
            if (coin_amount > coin_budget) {
              coin_amount = coin_budget;
            }
            let eth_amount = (new BN(coin_amount)).mul(price);
            if (coin_amount > 0) {
              latest_price = price;
              latest_price_updated = true;
            }
            coin_budget -= coin_amount;
            eth_balance = eth_balance.add(eth_amount);
            await check_increase_coin_supply(
              requested_eth_amount.toString(), elapsed_time,
              eth_amount.toString(), coin_amount);
            assert.equal(await _operation.start_price_(),
                         start_price.toString());
            assert.equal(await _operation.latest_price_(),
                         latest_price.toString());
            assert.equal(await _operation.coin_budget_(), coin_budget);
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
                  requested_coin_amount, elapsed_time, eth_balance.toString());
              }, "OpenMarketOperation");
              continue;
            }
            
            let price = start_price;
            for (let i = 0;
                 i < Math.trunc(elapsed_time / _price_change_interval) &&
                 i < _price_change_max; i++) {
              price = price.mul(new BN(100 + _price_change_percentage)).
                div(new BN(100));
            }
            assert.equal(await _operation.getCurrentPrice(elapsed_time),
                         price.toString());
            
            let coin_amount = requested_coin_amount;
            if (coin_amount >= -coin_budget) {
              coin_amount = -coin_budget;
            }
            let eth_amount = (new BN(coin_amount)).mul(price);
            if (eth_amount.gte(eth_balance)) {
              eth_amount = eth_balance;
            }
            coin_amount = eth_amount.div(price).toNumber();
            if (coin_amount > 0) {
              latest_price = price;
              latest_price_updated = true;
            }
            coin_budget += coin_amount;
            old_eth_balance = eth_balance;
            eth_balance = eth_balance.sub(eth_amount);
            await check_decrease_coin_supply(
              requested_coin_amount, elapsed_time, old_eth_balance.toString(),
              eth_amount.toString(), coin_amount);
            assert.equal(await _operation.start_price_(),
                         start_price.toString());
            assert.equal(await _operation.latest_price_(),
                         latest_price.toString());
            assert.equal(await _operation.coin_budget_(), coin_budget);
          }
        }
      }
    }
    
    assert.equal(await web3.eth.getBalance(_eth_pool.address), 0);
    await _eth_pool.increaseEth({value: 10});
    assert.equal(await web3.eth.getBalance(_eth_pool.address), 10);
    await _eth_pool.increaseEth({value: 100});
    assert.equal(await web3.eth.getBalance(_eth_pool.address), 110);
    await _eth_pool.decreaseEth(accounts[0], 20);
    assert.equal(await web3.eth.getBalance(_eth_pool.address), 90);
    await should_throw(async () => {
      await _eth_pool.decreaseEth(accounts[0], 91);
    }, "");
    await _eth_pool.decreaseEth(accounts[0], 90);
    assert.equal(await web3.eth.getBalance(_eth_pool.address), 0);
    await _eth_pool.decreaseEth(accounts[0], 0);
    assert.equal(await web3.eth.getBalance(_eth_pool.address), 0);
    
    await should_throw(async () => {
      await _eth_pool.sendTransaction({value: 0});
    }, "revert");
    await should_throw(async () => {
      await _eth_pool.sendTransaction({value: 1});
    }, "revert");
    
    async function check_increase_coin_supply(
      requested_eth_amount, elapsed_time, eth_amount, coin_amount) {
      assert.equal(typeof(requested_eth_amount), "string")
      assert.equal(typeof(eth_amount), "string")
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
      requested_coin_amount, elapsed_time, eth_balance,
      eth_amount, coin_amount) {
      assert.equal(typeof(eth_amount), "string")
      let receipt = await _operation.decreaseCoinSupply(
        requested_coin_amount, elapsed_time, eth_balance);
      let args = receipt.logs.filter(
        e => e.event == 'DecreaseCoinSupplyEvent')[0].args;
      assert.equal(args.requested_coin_amount, requested_coin_amount);
      assert.equal(args.elapsed_time, elapsed_time);
      assert.equal(args.eth_balance, eth_balance);
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
      await _operation.decreaseCoinSupply(1, 1, 0, {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _operation.updateCoinBudget(1, {from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _eth_pool.increaseEth({from: accounts[1]});
    }, "Ownable");
    await should_throw(async () => {
      await _eth_pool.decreaseEth(accounts[0], 1, {from: accounts[1]});
    }, "Ownable");
  });
}
