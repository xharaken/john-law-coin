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

const { deployProxy, upgradeProxy } =
      require('@openzeppelin/truffle-upgrades');

const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");
const common = require("./common.js");
const should_throw = common.should_throw;
const mod = common.mod;

contract("CoinBondUnittest", function (accounts) {
  it("JohnLawCoin", async function () {
    let coin = await deployProxy(JohnLawCoin, []);
    common.print_contract_size(coin, "JohnLawCoin");
    assert.isTrue((await coin.totalSupply()) > 0);
    assert.equal((await coin.balanceOf(accounts[0])).toNumber(),
                 (await coin.totalSupply()).toNumber());
    await coin.burn(accounts[0], (await coin.totalSupply()).toNumber());
    assert.equal(await coin.totalSupply(), 0);

    // balanceOf
    assert.equal(await coin.balanceOf(accounts[1]), 0);

    // mint
    await coin.mint(accounts[1], 1);
    assert.equal(await coin.totalSupply(), 1);
    assert.equal(await coin.balanceOf(accounts[1]), 1);

    await coin.mint(accounts[1], 1);
    assert.equal(await coin.totalSupply(), 2);
    assert.equal(await coin.balanceOf(accounts[1]), 2);

    await coin.mint(accounts[1], 0);
    assert.equal(await coin.totalSupply(), 2);
    assert.equal(await coin.balanceOf(accounts[1]), 2);

    await coin.mint(accounts[2], 0);
    assert.equal(await coin.totalSupply(), 2);
    assert.equal(await coin.balanceOf(accounts[1]), 2);
    assert.equal(await coin.balanceOf(accounts[2]), 0);

    await coin.mint(accounts[2], 100);
    assert.equal(await coin.totalSupply(), 102);
    assert.equal(await coin.balanceOf(accounts[1]), 2);
    assert.equal(await coin.balanceOf(accounts[2]), 100);

    // burn
    await coin.burn(accounts[1], 1);
    assert.equal(await coin.totalSupply(), 101);
    assert.equal(await coin.balanceOf(accounts[1]), 1);
    assert.equal(await coin.balanceOf(accounts[2]), 100);

    await coin.burn(accounts[1], 0);
    assert.equal(await coin.totalSupply(), 101);
    assert.equal(await coin.balanceOf(accounts[1]), 1);
    assert.equal(await coin.balanceOf(accounts[2]), 100);

    await should_throw(async () => {
      await coin.burn(accounts[3], 1);
    }, "ERC20");

    await should_throw(async () => {
      await coin.burn(accounts[1], 2);
    }, "ERC20");

    await should_throw(async () => {
      await coin.burn(accounts[2], 101);
    }, "ERC20");

    await coin.burn(accounts[1], 1);
    assert.equal(await coin.totalSupply(), 100);
    assert.equal(await coin.balanceOf(accounts[1]), 0);
    assert.equal(await coin.balanceOf(accounts[2]), 100);

    await coin.burn(accounts[2], 100);
    assert.equal(await coin.totalSupply(), 0);
    assert.equal(await coin.balanceOf(accounts[1]), 0);
    assert.equal(await coin.balanceOf(accounts[2]), 0);

    await coin.burn(accounts[2], 0);
    assert.equal(await coin.totalSupply(), 0);
    assert.equal(await coin.balanceOf(accounts[1]), 0);
    assert.equal(await coin.balanceOf(accounts[2]), 0);

    // move
    await coin.mint(accounts[1], 100);
    await coin.mint(accounts[2], 200);
    assert.equal(await coin.totalSupply(), 300);
    assert.equal(await coin.balanceOf(accounts[1]), 100);
    assert.equal(await coin.balanceOf(accounts[2]), 200);

    await coin.move(accounts[1], accounts[2], 10);
    assert.equal(await coin.totalSupply(), 300);
    assert.equal(await coin.balanceOf(accounts[1]), 90);
    assert.equal(await coin.balanceOf(accounts[2]), 210);

    await coin.move(accounts[2], accounts[1], 200);
    assert.equal(await coin.totalSupply(), 300);
    assert.equal(await coin.balanceOf(accounts[1]), 290);
    assert.equal(await coin.balanceOf(accounts[2]), 10);

    await coin.move(accounts[2], accounts[1], 0);
    assert.equal(await coin.totalSupply(), 300);
    assert.equal(await coin.balanceOf(accounts[1]), 290);
    assert.equal(await coin.balanceOf(accounts[2]), 10);

    await coin.move(accounts[4], accounts[2], 0);
    assert.equal(await coin.totalSupply(), 300);
    assert.equal(await coin.balanceOf(accounts[1]), 290);
    assert.equal(await coin.balanceOf(accounts[2]), 10);

    await should_throw(async () => {
      await coin.move(accounts[1], accounts[2], 291);
    }, "ERC20");

    await should_throw(async () => {
      await coin.move(accounts[5], accounts[2], 1);
    }, "ERC20");

    await coin.move(accounts[2], accounts[3], 1);
    assert.equal(await coin.totalSupply(), 300);
    assert.equal(await coin.balanceOf(accounts[1]), 290);
    assert.equal(await coin.balanceOf(accounts[2]), 9);
    assert.equal(await coin.balanceOf(accounts[3]), 1);

    await coin.move(accounts[2], accounts[5], 1);
    assert.equal(await coin.totalSupply(), 300);
    assert.equal(await coin.balanceOf(accounts[1]), 290);
    assert.equal(await coin.balanceOf(accounts[2]), 8);
    assert.equal(await coin.balanceOf(accounts[3]), 1);
    assert.equal(await coin.balanceOf(accounts[5]), 1);

    // tax
    await coin.setTaxRate(0);
    await coin.transfer(accounts[2], 10, {from: accounts[1]});
    assert.equal(await coin.balanceOf(accounts[1]), 280);
    assert.equal(await coin.balanceOf(accounts[2]), 18);
    assert.equal(await coin.balanceOf(await coin.tax_account_()), 0);
    await coin.setTaxRate(10);
    await coin.transfer(accounts[2], 10, {from: accounts[1]});
    assert.equal(await coin.balanceOf(accounts[1]), 270);
    assert.equal(await coin.balanceOf(accounts[2]), 27);
    assert.equal(await coin.balanceOf(await coin.tax_account_()), 1);
    await coin.transfer(accounts[2], 1, {from: accounts[1]});
    assert.equal(await coin.balanceOf(accounts[1]), 269);
    assert.equal(await coin.balanceOf(accounts[2]), 28);
    assert.equal(await coin.balanceOf(await coin.tax_account_()), 1);
    await coin.transfer(accounts[2], 19, {from: accounts[1]});
    assert.equal(await coin.balanceOf(accounts[1]), 250);
    assert.equal(await coin.balanceOf(accounts[2]), 46);
    assert.equal(await coin.balanceOf(await coin.tax_account_()), 2);
    await coin.transfer(accounts[1], 20, {from: accounts[1]});
    assert.equal(await coin.balanceOf(accounts[1]), 248);
    assert.equal(await coin.balanceOf(accounts[2]), 46);
    assert.equal(await coin.balanceOf(await coin.tax_account_()), 4);
  });

  it("JohnLawBond", async function () {
    let bond = await deployProxy(JohnLawBond, []);
    common.print_contract_size(bond, "JohnLawBond");
    assert.equal(await bond.totalSupply(), 0);

    // balanceOf
    assert.equal(await bond.balanceOf(accounts[1], 1111), 0);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 0);
    await check_redemption_timestamps(bond, accounts[1], []);

    // mint
    await bond.mint(accounts[1], 1111, 1);
    assert.equal(await bond.totalSupply(), 1);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 1);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 1);
    await check_redemption_timestamps(bond, accounts[1], [1111]);

    await bond.mint(accounts[1], 1111, 2);
    assert.equal(await bond.totalSupply(), 3);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 3);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 3);
    await check_redemption_timestamps(bond, accounts[1], [1111]);

    await bond.mint(accounts[1], 2222, 2);
    assert.equal(await bond.totalSupply(), 5)
    assert.equal(await bond.balanceOf(accounts[1], 1111), 3);
    assert.equal(await bond.balanceOf(accounts[1], 2222), 2);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 5);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[2]), 0);
    await check_redemption_timestamps(bond, accounts[1], [1111, 2222]);

    await bond.mint(accounts[2], 2222, 5);
    assert.equal(await bond.totalSupply(), 10);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 3);
    assert.equal(await bond.balanceOf(accounts[1], 2222), 2);
    assert.equal(await bond.balanceOf(accounts[2], 2222), 5);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 5);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[2]), 5);
    await check_redemption_timestamps(bond, accounts[1], [1111, 2222]);
    await check_redemption_timestamps(bond, accounts[2], [2222]);

    await bond.burn(accounts[3], 1111, 0);
    assert.equal(await bond.totalSupply(), 10);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 3);
    assert.equal(await bond.balanceOf(accounts[1], 2222), 2);
    assert.equal(await bond.balanceOf(accounts[2], 2222), 5);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 5);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[2]), 5);
    await check_redemption_timestamps(bond, accounts[1], [1111, 2222]);
    await check_redemption_timestamps(bond, accounts[2], [2222]);

    await bond.burn(accounts[2], 1111, 0);
    assert.equal(await bond.totalSupply(), 10);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 3);
    assert.equal(await bond.balanceOf(accounts[1], 2222), 2);
    assert.equal(await bond.balanceOf(accounts[2], 2222), 5);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 5);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[2]), 5);
    await check_redemption_timestamps(bond, accounts[1], [1111, 2222]);
    await check_redemption_timestamps(bond, accounts[2], [2222]);

    // burn
    await should_throw(async () => {
      await bond.burn(accounts[3], 1111, 1);
    }, "revert");

    await should_throw(async () => {
      await bond.burn(accounts[2], 1111, 1);
    }, "revert");

    await should_throw(async () => {
      await bond.burn(accounts[2], 2222, 6);
    }, "revert");

    await should_throw(async () => {
      await bond.burn(accounts[1], 2222, 3);
    }, "revert");

    await bond.burn(accounts[2], 2222, 5);
    assert.equal(await bond.totalSupply(), 5);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 3);
    assert.equal(await bond.balanceOf(accounts[1], 2222), 2);
    assert.equal(await bond.balanceOf(accounts[2], 2222), 0);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 5);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[2]), 0);
    await check_redemption_timestamps(bond, accounts[1], [1111, 2222]);
    await check_redemption_timestamps(bond, accounts[2], []);

    await bond.burn(accounts[1], 2222, 1);
    assert.equal(await bond.totalSupply(), 4);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 3);
    assert.equal(await bond.balanceOf(accounts[1], 2222), 1);
    assert.equal(await bond.balanceOf(accounts[2], 2222), 0);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 4);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[2]), 0);
    await check_redemption_timestamps(bond, accounts[1], [1111, 2222]);
    await check_redemption_timestamps(bond, accounts[2], []);

    await bond.burn(accounts[1], 2222, 1);
    assert.equal(await bond.totalSupply(), 3);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 3);
    assert.equal(await bond.balanceOf(accounts[1], 2222), 0);
    assert.equal(await bond.balanceOf(accounts[2], 2222), 0);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 3);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[2]), 0);
    await check_redemption_timestamps(bond, accounts[1], [1111]);
    await check_redemption_timestamps(bond, accounts[2], []);

    await bond.burn(accounts[1], 1111, 3);
    assert.equal(await bond.totalSupply(), 0);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 0);
    assert.equal(await bond.balanceOf(accounts[1], 2222), 0);
    assert.equal(await bond.balanceOf(accounts[2], 2222), 0);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 0);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[2]), 0);
    await check_redemption_timestamps(bond, accounts[1], []);
    await check_redemption_timestamps(bond, accounts[2], []);

    await bond.burn(accounts[1], 1111, 0);
    assert.equal(await bond.totalSupply(), 0);
    assert.equal(await bond.balanceOf(accounts[1], 1111), 0);
    assert.equal(await bond.balanceOf(accounts[1], 2222), 0);
    assert.equal(await bond.balanceOf(accounts[2], 2222), 0);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[1]), 0);
    assert.equal(await bond.numberOfBondsOwnedBy(accounts[2]), 0);
    await check_redemption_timestamps(bond, accounts[1], []);
    await check_redemption_timestamps(bond, accounts[2], []);
  });

  it("Ownable", async function () {
    let coin = await JohnLawCoin.new({from: accounts[1]});
    await coin.initialize({from: accounts[1]});
    let initial_coin_supply = (await coin.totalSupply()).toNumber();
    await coin.mint(accounts[1], 10, {from: accounts[1]});
    assert.equal(await coin.balanceOf(accounts[1]), 10 + initial_coin_supply);

    await should_throw(async () => {
      await coin.mint(accounts[1], 1);
    }, "Ownable");

    await should_throw(async () => {
      await coin.burn(accounts[1], 0);
    }, "Ownable");

    await should_throw(async () => {
      await coin.move(accounts[1], accounts[2], 0);
    }, "Ownable");

    await should_throw(async () => {
      await coin.setTaxRate(10);
    }, "Ownable");

    await should_throw(async () => {
      await coin.pause();
    }, "Ownable");

    await should_throw(async () => {
      await coin.unpause();
    }, "Ownable");

    await should_throw(async () => {
      await coin.mint(accounts[1], 1, {from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await coin.burn(accounts[1], 0, {from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await coin.move(accounts[1], accounts[2], 0, {from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await coin.setTaxRate(10, {from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await coin.pause({from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await coin.unpause({from: accounts[2]});
    }, "Ownable");

    await coin.transfer(accounts[2], 1, {from: accounts[1]});
    assert.equal(await coin.balanceOf(accounts[1]), 9 + initial_coin_supply);
    assert.equal(await coin.balanceOf(accounts[2]), 1);

    let bond = await JohnLawBond.new({from: accounts[1]});
    await bond.initialize({from: accounts[1]});

    await should_throw(async () => {
      await bond.mint(accounts[1], 1111, 1);
    }, "Ownable");

    await should_throw(async () => {
      await bond.burn(accounts[1], 1111, 0);
    }, "Ownable");

    await should_throw(async () => {
      await bond.mint(accounts[1], 1111, 1, {from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      await bond.burn(accounts[1], 1111, 0, {from: accounts[2]});
    }, "Ownable");
  });

  it("Pausable", async function () {
    let coin = await deployProxy(JohnLawCoin, []);
    let initial_coin_supply = (await coin.totalSupply()).toNumber();
    await coin.mint(accounts[1], 10);
    assert.equal(await coin.balanceOf(accounts[1]), 10);

    await coin.pause();

    await should_throw(async () => {
      await coin.mint(accounts[1], 1);
    }, "Pausable");

    await should_throw(async () => {
      await coin.burn(accounts[1], 0);
    }, "Pausable");

    await should_throw(async () => {
      await coin.move(accounts[1], accounts[2], 0);
    }, "Pausable");

    await should_throw(async () => {
      await coin.transfer(accounts[2], 1, {from: accounts[1]});
    }, "Pausable");

    await should_throw(async () => {
      await coin.pause();
    }, "Pausable");

    assert.equal(await coin.totalSupply(), 10 + initial_coin_supply);
    assert.equal(await coin.balanceOf(accounts[1]), 10);

    await coin.unpause();

    await coin.mint(accounts[1], 10);
    await coin.burn(accounts[1], 1);
    await coin.move(accounts[1], accounts[2], 10);
    await coin.transfer(accounts[2], 1, {from: accounts[1]});
    assert.equal(await coin.totalSupply(), 19 + initial_coin_supply);
    assert.equal(await coin.balanceOf(accounts[1]), 8);
    assert.equal(await coin.balanceOf(accounts[2]), 11);
  });

  it("ERC20", async function () {
    let coin = await deployProxy(JohnLawCoin, []);
    let initial_coin_supply = (await coin.totalSupply()).toNumber();
    assert.equal(await coin.name(), "JohnLawCoin");
    assert.equal(await coin.symbol(), "JLC");
    assert.equal(await coin.decimals(), 0);
    assert.equal(await coin.totalSupply(), initial_coin_supply);

    await coin.mint(accounts[1], 100);
    assert.equal(await coin.totalSupply(), 100 + initial_coin_supply);
    await coin.transfer(accounts[2], 10, {from: accounts[1]});
    assert.equal(await coin.balanceOf(accounts[1]), 90);
    assert.equal(await coin.balanceOf(accounts[2]), 10);
    await coin.transfer(accounts[3], 10, {from: accounts[2]});
    assert.equal(await coin.balanceOf(accounts[1]), 90);
    assert.equal(await coin.balanceOf(accounts[2]), 0);
    assert.equal(await coin.balanceOf(accounts[3]), 10);
    await coin.transfer(accounts[3], 0, {from: accounts[2]});
    assert.equal(await coin.balanceOf(accounts[1]), 90);
    assert.equal(await coin.balanceOf(accounts[2]), 0);
    assert.equal(await coin.balanceOf(accounts[3]), 10);

    await should_throw(async () => {
      await coin.transfer(accounts[3], 1, {from: accounts[2]});
    }, "ERC20");

    await should_throw(async () => {
      await coin.transfer(accounts[4], 11, {from: accounts[3]});
    }, "ERC20");

    await coin.approve(accounts[7], 10, {from: accounts[1]});
    assert.equal(await coin.allowance(accounts[1], accounts[7]), 10);
    await coin.approve(accounts[7], 15, {from: accounts[1]});
    assert.equal(await coin.allowance(accounts[1], accounts[7]), 15);
    await coin.transferFrom(accounts[1], accounts[2], 10, {from: accounts[7]});
    await coin.transferFrom(accounts[1], accounts[2], 2, {from: accounts[7]});
    assert.equal(await coin.balanceOf(accounts[1]), 78);
    assert.equal(await coin.balanceOf(accounts[2]), 12);
    assert.equal(await coin.balanceOf(accounts[3]), 10);
    assert.equal(await coin.allowance(accounts[1], accounts[7]), 3);

    await should_throw(async () => {
      await coin.transferFrom(accounts[1], accounts[2], 4, {from: accounts[7]});
    }, "ERC20");

    await should_throw(async () => {
      await coin.transferFrom(accounts[3], accounts[2], 1, {from: accounts[7]});
    }, "ERC20");

    await should_throw(async () => {
      await coin.transferFrom(accounts[1], accounts[2], 1, {from: accounts[1]});
    }, "ERC20");

    await coin.increaseAllowance(accounts[7], 10, {from: accounts[1]});
    assert.equal(await coin.allowance(accounts[1], accounts[7]), 13);
    await coin.increaseAllowance(accounts[7], 1000, {from: accounts[1]});
    assert.equal(await coin.allowance(accounts[1], accounts[7]), 1013);
    await coin.decreaseAllowance(accounts[7], 100, {from: accounts[1]});
    assert.equal(await coin.allowance(accounts[1], accounts[7]), 913);

    await should_throw(async () => {
      await coin.transferFrom(accounts[1], accounts[2], 100,
                              {from: accounts[7]});
    }, "ERC20");

    await coin.transferFrom(accounts[1], accounts[2], 78,
                            {from: accounts[7]});
    assert.equal(await coin.balanceOf(accounts[1]), 0);
    assert.equal(await coin.balanceOf(accounts[2]), 90);
    assert.equal(await coin.balanceOf(accounts[3]), 10);
    assert.equal(await coin.allowance(accounts[1], accounts[7]), 913 - 78);
  });

  async function check_redemption_timestamps(bond, account, expected) {
    let count = await bond.numberOfRedemptionTimestampsOwnedBy(account);
    assert.equal(count, expected.length);

    await should_throw(async () => {
      await bond.getRedemptionTimestampOwnedBy(account, count);
    }, "EnumerableSet");

    for (let index = 0; index < count; index++) {
      let value = await bond.getRedemptionTimestampOwnedBy(account, index);
      assert.isTrue(expected.includes(value.toNumber()));
    }
  }

});
