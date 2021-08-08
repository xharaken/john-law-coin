// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy, upgradeProxy } =
      require('@openzeppelin/truffle-upgrades');

const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");
const OracleForTesting = artifacts.require("OracleForTesting");
const BondOperationForTesting = artifacts.require("BondOperationForTesting");
const OpenMarketOperationForTesting =
      artifacts.require("OpenMarketOperationForTesting");
const Logging = artifacts.require("Logging");
const ACBForTesting = artifacts.require("ACBForTesting");
const JohnLawCoin_v2 = artifacts.require("JohnLawCoin_v2");
const JohnLawBond_v2 = artifacts.require("JohnLawBond_v2");
const OracleForTesting_v2 = artifacts.require("OracleForTesting_v2");
const BondOperationForTesting_v2 =
      artifacts.require("BondOperationForTesting_v2");
const OpenMarketOperationForTesting_v2 =
      artifacts.require("OpenMarketOperationForTesting_v2");
const Logging_v2 = artifacts.require("Logging_v2");
const ACBForTesting_v2 = artifacts.require("ACBForTesting_v2");
const OracleForTesting_v3 = artifacts.require("OracleForTesting_v3");
const ACBForTesting_v3 = artifacts.require("ACBForTesting_v3");
const ACBForTesting_v4 = artifacts.require("ACBForTesting_v4");
const BondOperationForTesting_v5 =
      artifacts.require("BondOperationForTesting_v5");
const OpenMarketOperationForTesting_v5 =
      artifacts.require("OpenMarketOperationForTesting_v5");
const OracleForTesting_v5 = artifacts.require("OracleForTesting_v5");
const ACBForTesting_v5 = artifacts.require("ACBForTesting_v5");

const common = require("./common.js");
const should_throw = common.should_throw;
const mod = common.mod;
const randint = common.randint;

contract("ACBSimulator", function (accounts) {
  let args = common.custom_arguments();
  assert.isTrue(args.length == 16);
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
                     args[13],
                     args[14],
                     args[15]);
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
                            _price_change_interval,
                            _price_change_percentage,
                            _start_price_multiplier,
                            _voter_count,
                            _iteration,
                            _should_upgrade) {
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
      " price_interval=" + _price_change_interval +
      " price_percent=" + _price_change_percentage +
      " price_multiplier=" + _start_price_multiplier +
      " voter=" + _voter_count +
      " iter=" + _iteration +
      " should_upgrade=" + _should_upgrade;
  console.log(test_name);
  assert.isTrue(_voter_count <= accounts.length - 1);

  it(test_name, async function () {
    let _level_max = _level_to_exchange_rate.length;

    let _coin = await deployProxy(JohnLawCoin, []);
    common.print_contract_size(_coin, "JohnLawCoin");
    let _bond = await deployProxy(JohnLawBond, []);
    common.print_contract_size(_bond, "JohnLawBond");
    let _logging = await deployProxy(Logging, []);
    common.print_contract_size(_logging, "Logging");
    let _oracle = await deployProxy(OracleForTesting, []);
    common.print_contract_size(_oracle, "OracleForTesting");
    let _bond_operation =
        await deployProxy(BondOperationForTesting, [_bond.address]);
    common.print_contract_size(_bond, "BondOperationForTesting");
    let _open_market_operation =
        await deployProxy(OpenMarketOperationForTesting, []);
    common.print_contract_size(_open_market_operation,
                               "OpenMarketOperationForTesting");
    let _acb = await deployProxy(
      ACBForTesting, [_coin.address, _oracle.address,
                      _bond_operation.address,
                      _open_market_operation.address,
                      _logging.address]);
    common.print_contract_size(_acb, "ACBForTesting");

    await _oracle.overrideConstants(_level_max, _reclaim_threshold,
                                     _proportional_reward_rate);
    await _bond_operation.overrideConstants(_bond_price,
                                            _bond_redemption_price,
                                            _bond_redemption_period,
                                            _bond_redeemable_period);
    await _open_market_operation.overrideConstants(_price_change_interval,
                                                   _price_change_percentage,
                                                   _start_price_multiplier);
    await _acb.overrideConstants(_epoch_duration,
                                 _deposit_rate,
                                 _damping_factor,
                                 _level_to_exchange_rate);
    
    await _bond.transferOwnership(_bond_operation.address);
    await _coin.transferOwnership(_acb.address);
    await _bond_operation.transferOwnership(_acb.address);
    await _open_market_operation.transferOwnership(_acb.address);
    await _oracle.transferOwnership(_acb.address);
    await _logging.transferOwnership(_acb.address);

    let _tax_rate = await _coin.TAX_RATE();
    let _burned = [0, 0, 0];

    let _voters = [];
    for (let i = 0; i < _voter_count; i++) {
      _voters.push({
        address: accounts[i + 1],
        committed: [false, false, false],
        committed_level: [0, 0, 0],
        committed_salt: [0, 0, 0],
        deposit: [0, 0, 0],
        revealed: [false, false, false],
        oracle_level: [0, 0, 0],
        salt: [0, 0, 0],
        reclaimed: [false, false, false],
        bonds: {},
        balance: 0
      })
    }

    class Metrics {
      constructor() {
        this.reset_total();
        this.reset_local();
      }

      reset_local() {
        this.reveal_hit = 0;
        this.reveal_miss = 0;
        this.reclaim_hit = 0;
        this.reclaim_miss = 0;
        this.reward_hit = 0;
        this.reward_miss = 0;
        this.redeemed_bonds = 0;
        this.fast_redeemed_bonds = 0;
        this.expired_bonds = 0;
        this.redemption_count = 0;
        this.redeem_hit = 0;
        this.purchase_hit = 0;
        this.purchase_count = 0;
        this.increased_coin_supply = 0;
        this.decreased_coin_supply = 0;
        this.increased_eth = 0;
        this.decreased_eth = 0;
        this.delta = 0;
        this.mint = 0;
        this.lost = 0;
        this.tax = 0;
        this.oracle_level = 0;
        this.deposited = 0;
        this.reclaimed = 0;
        this.rewarded = 0;
      }

      reset_total() {
        this.total_reveal_hit = 0;
        this.total_reveal_miss = 0;
        this.total_reclaim_hit = 0;
        this.total_reclaim_miss = 0;
        this.total_reward_hit = 0;
        this.total_reward_miss = 0;
        this.supply_increased = 0;
        this.supply_decreased = 0;
        this.supply_nochange = 0;
        this.total_redemption_count = 0;
        this.total_redeemed_bonds = 0;
        this.total_fast_redeemed_bonds = 0;
        this.total_expired_bonds = 0;
        this.total_redeem_hit = 0;
        this.total_purchase_hit = 0;
        this.total_purchase_count = 0;
        this.total_increased_coin_supply = 0;
        this.total_decreased_coin_supply = 0;
        this.total_increased_eth = 0;
        this.total_decreased_eth = 0;
        this.total_mint = 0;
        this.total_lost = 0;
        this.total_tax = 0;
      }

      update_total() {
        this.total_reveal_hit += this.reveal_hit;
        this.total_reveal_miss += this.reveal_miss;
        this.total_reclaim_hit += this.reclaim_hit;
        this.total_reclaim_miss += this.reclaim_miss;
        this.total_reward_hit += this.reward_hit;
        this.total_reward_miss += this.reward_miss;
        if (this.delta > 0) {
          this.supply_increased += 1;
        } else if (this.delta < 0) {
          this.supply_decreased += 1;
        } else {
          this.supply_nochange += 1;
        }
        this.total_redeemed_bonds += this.redeemed_bonds;
        this.total_fast_redeemed_bonds += this.fast_redeemed_bonds;
        this.total_expired_bonds += this.expired_bonds;
        this.total_redemption_count += this.redemption_count;
        this.total_redeem_hit += this.redeem_hit;
        this.total_purchase_hit += this.purchase_hit;
        this.total_purchase_count += this.purchase_count;
        this.total_increased_coin_supply += this.increased_coin_supply;
        this.total_decreased_coin_supply += this.decreased_coin_supply;
        this.total_increased_eth += this.increased_eth;
        this.total_decreased_eth += this.decreased_eth;
        this.total_mint += this.mint;
        this.total_lost += this.lost;
        this.total_tax += this.tax;
      }
    }

    _metrics = new Metrics();

    for (let i = 0; i < _voter_count; i++) {
      let amount = randint(0, _bond_price * 100);
      if (randint(0, 9) >= 9) {
        amount = 0;
      }
      _voters[i].balance = amount;
      await _acb.setCoin(_voters[i].address, _voters[i].balance);
      assert.equal(await get_balance(_voters[i].address),
                   _voters[i].balance);
    }
    let initial_coin_supply = await get_coin_supply();

    let tax = 0;
    for (let iter = 0; iter < _iteration; iter++) {
      if ((await get_coin_supply()) >= initial_coin_supply * 100) {
        break;
      }

      await upgrade_contract_if_needed();

      _metrics.reset_local();

      let coin_supply1 = await get_coin_supply();

      await _acb.setTimestamp(
          (await _acb.getTimestamp()).toNumber() + _epoch_duration);
      let commit_observed = await vote(tax);
      if (commit_observed == false) {
        continue;
      }

      let epoch_id = (await _oracle.epoch_id_()).toNumber();
      let coin_supply2 = await get_coin_supply();
      let bond_supply = await get_bond_supply();
      let valid_bond_supply = (
        await _bond_operation.validBondSupply(epoch_id)).toNumber();
      let bond_budget = (await _bond_operation.bond_budget_()).toNumber();
      let coin_budget = (
        await _open_market_operation.coin_budget_()).toNumber();

      await purchase_coins();
      await sell_coins();

      await redeem_bonds();
      await purchase_bonds();

      let epoch_log = await get_epoch_logs(epoch_id);
      assert.equal(epoch_log.minted_coins, _metrics.mint);
      assert.equal(epoch_log.burned_coins, _metrics.lost);
      assert.equal(epoch_log.coin_supply_delta.toNumber(), _metrics.delta);
      assert.equal(epoch_log.total_coin_supply, coin_supply2);
      assert.equal(epoch_log.oracle_level, _metrics.oracle_level);
      assert.equal(epoch_log.current_epoch_start,
                   (await _acb.getTimestamp()).toNumber());
      assert.equal(epoch_log.tax, tax);
      let vote_log = await get_vote_logs(epoch_id);
      assert.equal(vote_log.commit_succeeded,
                   _metrics.reveal_hit + _metrics.reveal_miss);
      assert.equal(vote_log.deposited, _metrics.deposited);
      assert.equal(vote_log.commit_failed, 0);
      assert.equal(vote_log.reveal_succeeded, _metrics.reveal_hit);
      assert.equal(vote_log.reveal_failed, _metrics.reveal_miss);
      assert.equal(vote_log.reclaim_succeeded, _metrics.reclaim_hit);
      assert.equal(vote_log.reward_succeeded, _metrics.reward_hit);
      assert.equal(vote_log.reclaimed, _metrics.reclaimed);
      assert.equal(vote_log.rewarded, _metrics.rewarded);
      let bond_operation_log = await get_bond_operation_logs(epoch_id);
      assert.equal(bond_operation_log.bond_budget, bond_budget);
      assert.equal(bond_operation_log.total_bond_supply, bond_supply);
      assert.equal(bond_operation_log.valid_bond_supply, valid_bond_supply);
      assert.equal(bond_operation_log.purchased_bonds, _metrics.purchase_count);
      assert.equal(bond_operation_log.redeemed_bonds, _metrics.redeemed_bonds);
      assert.equal(bond_operation_log.expired_bonds, _metrics.expired_bonds);
      let open_market_operation_log =
          await get_open_market_operation_logs(epoch_id);
      assert.equal(open_market_operation_log.coin_budget, coin_budget);
      assert.equal(open_market_operation_log.increased_eth,
                   _metrics.increased_eth);
      assert.equal(open_market_operation_log.increased_coin_supply,
                   _metrics.increased_coin_supply);
      assert.equal(open_market_operation_log.decreased_eth,
                   _metrics.decreased_eth);
      assert.equal(open_market_operation_log.decreased_coin_supply,
                   _metrics.decreased_coin_supply);

      tax = await transfer_coins();

      if (true) {
        let coin_supply3 = await get_coin_supply();
        console.log("epoch=" + (await _oracle.epoch_id_()).toNumber() +
                    " reveal_hit=" + _metrics.reveal_hit +
                    "/" + (_metrics.reveal_hit + _metrics.reveal_miss) +
                    "=" + divide_or_zero(100 * _metrics.reveal_hit,
                                         _metrics.reveal_hit +
                                         _metrics.reveal_miss) +
                    "% reclaim_hit=" + _metrics.reclaim_hit +
                    "/" + (_metrics.reclaim_hit + _metrics.reclaim_miss) +
                    "=" + divide_or_zero(100 * _metrics.reclaim_hit,
                                         _metrics.reclaim_hit +
                                         _metrics.reclaim_miss) +
                    "% reward_hit=" + _metrics.reward_hit +
                    "/" + (_metrics.reward_hit + _metrics.reward_miss) +
                    "=" + divide_or_zero(100 * _metrics.reward_hit,
                                         _metrics.reward_hit +
                                         _metrics.reward_miss) +
                    "% purchase_hit=" + _metrics.purchase_hit +
                    "/" + _voter_count +
                    "=" + divide_or_zero(100 * _metrics.purchase_hit,
                                         _voter_count) +
                    "% redeem_hit=" + _metrics.redeem_hit +
                    "/" + _voter_count +
                    "=" + divide_or_zero(100 * _metrics.redeem_hit,
                                         _voter_count) +
                    "% redemptions=" + _metrics.redemption_count +
                    "/" + _metrics.redeem_hit +
                    "=" + divide_or_zero(100 * _metrics.redemption_count,
                                         _metrics.redeem_hit) +
                    "% fast_redeem=" + _metrics.fast_redeemed_bonds +
                    "/" + _metrics.redeemed_bonds +
                    "=" + divide_or_zero(100 * _metrics.fast_redeemed_bonds,
                                         _metrics.redeemed_bonds) +
                    "% expired=" + _metrics.expired_bonds +
                    " increased_supply=" + _metrics.increased_coin_supply +
                    " decreased_supply=" + _metrics.decreased_coin_supply +
                    " increased_eth=" + _metrics.increased_eth +
                    " decreased_eth=" + _metrics.decreased_eth +
                    " delta=" + _metrics.delta +
                    " mint=" + _metrics.mint +
                    " lost=" + _metrics.lost +
                    " coin_supply=" + coin_supply1 +
                    "->" + coin_supply2 +
                    "->" + coin_supply3 +
                    "=" + (coin_supply3 - coin_supply1) +
                    " bond_supply=" + bond_supply +
                    "->" + (await get_bond_supply()) +
                    " valid_bond_supply=" + valid_bond_supply +
                    "->" + (await _bond_operation.validBondSupply(epoch_id))
                    .toNumber() +
                    " bond_budget=" + bond_budget +
                    "->" + (await _bond_operation.bond_budget_()).toNumber() +
                    " tax=" + tax
                   );
      }
      _metrics.update_total();
    }
    console.log("================");
    console.log("epoch=" + (await _oracle.epoch_id_()).toNumber() +
                " reveal_hit=" + _metrics.total_reveal_hit +
                "/" + (_metrics.total_reveal_hit +
                       _metrics.total_reveal_miss) +
                "=" + divide_or_zero(100 * _metrics.total_reveal_hit,
                                     (_metrics.total_reveal_hit +
                                      _metrics.total_reveal_miss)) +
                "% reclaim_hit=" + _metrics.total_reclaim_hit +
                "/" + (_metrics.total_reclaim_hit +
                       _metrics.total_reclaim_miss) +
                "=" + divide_or_zero(100 * _metrics.total_reclaim_hit,
                                     (_metrics.total_reclaim_hit +
                                      _metrics.total_reclaim_miss)) +
                "% reward_hit=" + _metrics.total_reward_hit +
                "/" + (_metrics.total_reward_hit +
                       _metrics.total_reward_miss) +
                "=" + divide_or_zero(100 * _metrics.total_reward_hit,
                                     (_metrics.total_reward_hit +
                                      _metrics.total_reward_miss)) +
                "% purchase_hit=" + _metrics.total_purchase_hit +
                "/" + _voter_count * _iteration +
                "=" + divide_or_zero(100 * _metrics.total_purchase_hit,
                                     _voter_count * _iteration) +
                "% redeem_hit=" + _metrics.total_redeem_hit +
                "/" + _voter_count * _iteration +
                "=" + divide_or_zero(100 * _metrics.total_redeem_hit,
                                     _voter_count * _iteration) +
                "% redemptions=" + _metrics.total_redemption_count +
                "/" + _metrics.total_redeem_hit +
                "=" + divide_or_zero(100 * _metrics.total_redemption_count,
                                     _metrics.total_redeem_hit) +
                "% fast_redeem=" + _metrics.total_fast_redeemed_bonds +
                "/" + _metrics.total_redeemed_bonds +
                "=" + divide_or_zero(100 * _metrics.total_fast_redeemed_bonds,
                                     _metrics.total_redeemed_bonds) +
                "% expired=" + _metrics.total_expired_bonds +
                " increased_supply-decreased_supply=" +
                _metrics.total_increased_coin_supply + "-" +
                _metrics.total_decreased_coin_supply + "=" +
                (_metrics.total_increased_coin_supply -
                 _metrics.total_decreased_coin_supply) +
                _metrics.total_increased_eth + "-" +
                _metrics.total_decreased_eth + "=" +
                (_metrics.total_increased_eth -
                 _metrics.total_decreased_eth) +
                " supply=" + _metrics.supply_increased +
                "/" + _metrics.supply_nochange +
                "/" + _metrics.supply_decreased +
                " coin_supply=" +
                divide_or_zero((await get_coin_supply()) /
                               initial_coin_supply * 100) +
                "% mint=" + _metrics.total_mint +
                " lost=" + _metrics.total_lost +
                " bond_supply=" + (await get_bond_supply()) +
                " valid_bond_supply=" + (
                  await _bond_operation.validBondSupply(
                    await _oracle.epoch_id_())) +
                " tax=" + tax
               );
    console.log("================");
    console.log();

    async function transfer_coins() {
      let start_index = randint(0, _voter_count - 1);
      let tax_total = 0;
      for (let index = 0; index < Math.min(_voter_count, 10); index++) {
        let sender = _voters[(start_index + index) % _voter_count];
        let receiver = _voters[(start_index + index + 1) % _voter_count];
        let transfer = randint(
          0, Math.min(await get_balance(sender.address), 10000));
        let tax = Math.trunc(transfer * _tax_rate / 100);
        let balance_sender = await get_balance(sender.address);
        let balance_receiver = await get_balance(receiver.address);
        let tax_account = await _coin.tax_account_();
        let balance_tax = await get_balance(tax_account);
        await _coin.transfer(
          receiver.address, transfer, {from: sender.address});
        if (sender != receiver) {
          assert.equal(await get_balance(sender.address),
                       balance_sender - transfer);
          assert.equal(await get_balance(receiver.address),
                       balance_receiver + transfer - tax);
        } else {
          assert.equal(await get_balance(sender.address),
                       balance_receiver - tax);
        }
        assert.equal(await get_balance(tax_account),
                     balance_tax + tax);
        sender.balance -= transfer;
        receiver.balance += transfer - tax;
        tax_total += tax;
      }
      _metrics.tax += tax_total;
      return tax_total;
    }

    async function purchase_coins() {
      let epoch_id = (await _oracle.epoch_id_()).toNumber();
      let start_index = randint(0, _voter_count - 1);
      for (let index = 0; index < _voter_count; index++) {
        let coin_budget =
            (await _open_market_operation.coin_budget_()).toNumber();
        if (coin_budget <= 0) {
          break;
        }
        let intervals = randint(0, 6);
        let original_timestamp = (await _acb.getTimestamp()).toNumber();
        await _acb.setTimestamp(original_timestamp +
                                _price_change_interval * intervals);
        let price = await _open_market_operation.start_price_();
        for (let i = 0; i < intervals; i++) {
          price = Math.trunc(price * (100 - _price_change_percentage) / 100);
        }
        if (price == 0) {
          price = 1;
        }
        
        let voter = _voters[(start_index + index) % _voter_count];
        let requested_coin_amount = Math.trunc(coin_budget / _voter_count);

        let coin_supply = await get_coin_supply();
        voter.balance += requested_coin_amount;
        await check_purchase_coins(
          {value: requested_coin_amount * price, from: voter.address},
          requested_coin_amount * price, requested_coin_amount);
        await _acb.setTimestamp(original_timestamp);

        assert.equal(await _coin.balanceOf(voter.address), voter.balance);
        assert.equal(await get_coin_supply(),
                     coin_supply + requested_coin_amount);

        _metrics.increased_eth += requested_coin_amount * price;
        _metrics.increased_coin_supply += requested_coin_amount;
      }
    }

    async function sell_coins() {
      let epoch_id = (await _oracle.epoch_id_()).toNumber();
      let start_index = randint(0, _voter_count - 1);
      for (let index = 0; index < _voter_count; index++) {
        let coin_budget =
            (await _open_market_operation.coin_budget_()).toNumber();
        if (coin_budget >= 0) {
          break;
        }
        let intervals = randint(0, 6);
        let original_timestamp = (await _acb.getTimestamp()).toNumber();
        await _acb.setTimestamp(original_timestamp +
                                _price_change_interval * intervals);
        let price = await _open_market_operation.start_price_();
        for (let i = 0; i < intervals; i++) {
          price = Math.trunc(price * (100 + _price_change_percentage) / 100);
        }
        
        let voter = _voters[(start_index + index) % _voter_count];
        let requested_coin_amount =
            Math.min(Math.trunc(-coin_budget / _voter_count), voter.balance);
        let eth_balance = await web3.eth.getBalance(
          _open_market_operation.address);
        requested_coin_amount =
          Math.min(requested_coin_amount, Math.trunc(eth_balance / price));

        let coin_supply = await get_coin_supply();
        voter.balance -= requested_coin_amount;
        await check_sell_coins(
          requested_coin_amount, {from: voter.address},
          requested_coin_amount * price, requested_coin_amount);
        await _acb.setTimestamp(original_timestamp);

        assert.equal(await _coin.balanceOf(voter.address), voter.balance);
        assert.equal(await get_coin_supply(),
                     coin_supply - requested_coin_amount);

        _metrics.decreased_eth += requested_coin_amount * price;
        _metrics.decreased_coin_supply += requested_coin_amount;
      }
    }

    async function purchase_bonds() {
      let start_index = randint(0, _voter_count - 1);
      let epoch_id = (await _oracle.epoch_id_()).toNumber();
      for (let index = 0; index < _voter_count; index++) {
        let bond_budget = (await _bond_operation.bond_budget_()).toNumber();
        if (bond_budget <= 0) {
          continue;
        }

        let bond_price = _bond_price;
        let voter = _voters[(start_index + index) % _voter_count];
        let count = Math.min(
            bond_budget, Math.trunc(0.3 * voter.balance / _bond_price));
        if (count <= 0) {
          continue;
        }

        let coin_supply = await get_coin_supply();
        let bond_supply = await get_bond_supply();
        let valid_bond_supply = (
          await _bond_operation.validBondSupply(epoch_id)).toNumber();
        let redemption = epoch_id + _bond_redemption_period;
        if (redemption in voter.bonds) {
          voter.bonds[redemption] += count;
        } else {
          voter.bonds[redemption] = count;
        }
        voter.balance -= bond_price * count;

        await check_purchase_bonds(count, {from: voter.address}, redemption);
        assert.equal(await get_balance(voter.address),
                     voter.balance);
        assert.equal(await get_coin_supply(),
                     coin_supply - bond_price * count);
        assert.equal(await get_bond_supply(), bond_supply + count);
        assert.equal(await _bond_operation.validBondSupply(epoch_id),
                     valid_bond_supply + count);
        assert.equal(await _bond_operation.bond_budget_(),
                     bond_budget - count);
        assert.equal(await get_bond(voter.address, redemption),
                     voter.bonds[redemption]);

        _metrics.purchase_hit += 1;
        _metrics.purchase_count += count;
      }
    }

    async function redeem_bonds() {
      let epoch_id = (await _oracle.epoch_id_()).toNumber();
      let start_index = randint(0, _voter_count - 1);
      for (let index = 0; index < _voter_count; index++) {
        if (randint(0, 9) >= 9) {
          continue;
        }
        let voter = _voters[(start_index + index) % _voter_count];
        let redemptions = [];
        for (let redemption in voter.bonds) {
          redemptions.push(parseInt(redemption));
        }
        if (redemptions.length == 0) {
          continue;
        }

        let fast_redeemed_bonds = 0;
        let redeemed_bonds = 0;
        let expired_bonds = 0;
        let bond_budget = (await _bond_operation.bond_budget_()).toNumber();
        for (let redemption of redemptions) {
          assert.isTrue(redemption in voter.bonds);
          let count = voter.bonds[redemption];
          if (epoch_id < redemption) {
            if (bond_budget >= 0) {
              continue;
            }
            count = Math.min(count, -bond_budget);
            bond_budget += count;
            fast_redeemed_bonds += count;
          }
          if (epoch_id < redemption + _bond_redeemable_period) {
            redeemed_bonds += count;
          } else {
            expired_bonds += count;
          }
          voter.bonds[redemption] -= count;
          assert.isTrue(voter.bonds[redemption] >= 0);
          if (voter.bonds[redemption] == 0) {
            delete voter.bonds[redemption];
          }
        }
        voter.balance += _bond_redemption_price * redeemed_bonds;

        let coin_supply = await get_coin_supply();
        let bond_supply = await get_bond_supply();
        let valid_bond_supply = (
          await _bond_operation.validBondSupply(epoch_id)).toNumber();
        await check_redeem_bonds(redemptions,
                                 {from: voter.address}, redeemed_bonds,
                                 expired_bonds);
        assert.equal(await _bond_operation.bond_budget_(), bond_budget);
        assert.equal(await get_balance(voter.address),
                     voter.balance);

        let bond_count =
            await _bond.numberOfRedemptionEpochsOwnedBy(voter.address);
        assert.equal(Object.keys(voter.bonds).length, bond_count);
        for (let index = 0; index < bond_count; index++) {
          let redemption = (await _bond.getRedemptionEpochOwnedBy(
              voter.address, index)).toNumber();
          assert.isTrue(redemption in voter.bonds);
          assert.equal(await get_bond(voter.address, redemption),
                       voter.bonds[redemption])
        }

        assert.equal(await get_bond_supply(),
                     bond_supply - redeemed_bonds - expired_bonds);
        assert.equal(await _bond_operation.validBondSupply(epoch_id),
                     valid_bond_supply - redeemed_bonds);
        assert.equal(await get_coin_supply(),
                     coin_supply + _bond_redemption_price * redeemed_bonds);

        _metrics.fast_redeemed_bonds += fast_redeemed_bonds;
        _metrics.expired_bonds += expired_bonds;
        _metrics.redeemed_bonds += redeemed_bonds;
        _metrics.redemption_count += redemptions.length;
        _metrics.redeem_hit += 1;
      }
    }

    async function vote(tax) {
      let epoch_id = (await _oracle.epoch_id_()).toNumber();
      let current = mod(epoch_id, 3);
      let prev = mod(epoch_id - 1, 3);
      let prev_prev = mod(epoch_id - 2, 3);

      let revealed_deposits = new Array(_level_max).fill(0);
      let revealed_counts = new Array(_level_max).fill(0);
      for (let i = 0; i < _voter_count; i++) {
        if (_voters[i].committed[prev_prev] &&
            _voters[i].revealed[prev_prev] &&
            _voters[i].oracle_level[prev_prev] ==
            _voters[i].committed_level[prev_prev] &&
            0 <= _voters[i].oracle_level[prev_prev] &&
            _voters[i].oracle_level[prev_prev] < _level_max &&
            _voters[i].salt[prev_prev] ==
            _voters[i].committed_salt[prev_prev]) {
          level = _voters[i].oracle_level[prev_prev];
          revealed_deposits[level] += _voters[i].deposit[prev_prev];
          revealed_counts[level] += 1;
        }
      }

      let mode_level = _level_max;
      let max_deposit = 0;
      let max_count = 0;
      for (let level = 0; level < _level_max; level++) {
        if (revealed_counts[level] > 0 &&
            (mode_level == _level_max ||
             max_deposit < revealed_deposits[level] ||
             (max_deposit == revealed_deposits[level] &&
              max_count < revealed_counts[level]))) {
          max_deposit = revealed_deposits[level];
          max_count = revealed_counts[level];
          mode_level = level;
        }
      }

      let deposit_total = 0;
      let deposit_to_be_reclaimed = 0;
      for (let i = 0; i < _voter_count; i++) {
        if (_voters[i].committed[prev_prev]) {
          deposit_total += _voters[i].deposit[prev_prev];
        }
        if (_voters[i].committed[prev_prev] &&
            _voters[i].revealed[prev_prev] &&
            _voters[i].oracle_level[prev_prev] ==
            _voters[i].committed_level[prev_prev] &&
            0 <= _voters[i].oracle_level[prev_prev] &&
            _voters[i].oracle_level[prev_prev] < _level_max &&
            _voters[i].salt[prev_prev] ==
            _voters[i].committed_salt[prev_prev] &&
            (Math.abs(_voters[i].oracle_level[prev_prev] - mode_level) <=
             _reclaim_threshold)) {
          deposit_to_be_reclaimed += _voters[i].deposit[prev_prev];
        }
      }
      assert.isTrue(deposit_to_be_reclaimed <= deposit_total);
      if (mode_level == _level_max) {
        assert.equal(deposit_to_be_reclaimed, 0);
      }

      let target_level = randint(0, _level_max - 1);
      let reward_total = deposit_total - deposit_to_be_reclaimed + tax;
      let reclaimed_total = 0;
      let commit_observed = false;
      for (let i = 0; i < _voter_count; i++) {
        _voters[i].committed[current] = false;
        _voters[i].committed_level[current] = 0;
        _voters[i].committed_salt[current] = 0;
        _voters[i].deposit[current] = 0;
        _voters[i].revealed[current] = false;
        _voters[i].oracle_level[current] = 0;
        _voters[i].salt[current] = 0;
        _voters[i].reclaimed[current] = false;

        _voters[i].committed[current] = (randint(0, 99) < 99);
        if (_voters[i].committed[current] == false) {
          continue;
        }

        rand = randint(0, 9);
        if (rand < 5) {
          _voters[i].committed_level[current] = target_level;
        } else if (rand < 7) {
          _voters[i].committed_level[current] =
              mod(target_level - 1, _level_max);
        } else if (rand < 9) {
          _voters[i].committed_level[current] =
              mod(target_level + 1, _level_max);
        } else {
          _voters[i].committed_level[current] = randint(0, _level_max);
        }

        _voters[i].committed_salt[current] = randint(0, 10);
        let hash = await _acb.encrypt(
            _voters[i].committed_level[current],
            _voters[i].committed_salt[current], {from: _voters[i].address});
        _voters[i].deposit[current] = Math.trunc(
            _voters[i].balance * _deposit_rate / 100);

        _voters[i].revealed[prev] = true;
        if (randint(0, 99) < 97) {
          _voters[i].oracle_level[prev] = _voters[i].committed_level[prev];
        } else {
          _voters[i].oracle_level[prev] = randint(0, _level_max);
        }
        if (randint(0, 99) < 97) {
          _voters[i].salt[prev] = _voters[i].committed_salt[prev];
        } else {
          _voters[i].salt[prev] = randint(0, 10);
        }
        _voters[i].reclaimed[prev_prev] = true;

        let reveal_result = (
            _voters[i].committed[prev] &&
            _voters[i].oracle_level[prev] ==
              _voters[i].committed_level[prev] &&
            0 <= _voters[i].oracle_level[prev] &&
            _voters[i].oracle_level[prev] < _level_max &&
            _voters[i].salt[prev] ==
              _voters[i].committed_salt[prev]);

        let reclaim_result = (
            _voters[i].committed[prev_prev] &&
              _voters[i].revealed[prev_prev] &&
              _voters[i].oracle_level[prev_prev] ==
              _voters[i].committed_level[prev_prev] &&
              0 <= _voters[i].oracle_level[prev_prev] &&
              _voters[i].oracle_level[prev_prev] < _level_max &&
              _voters[i].salt[prev_prev] ==
              _voters[i].committed_salt[prev_prev] &&
              (Math.abs(_voters[i].oracle_level[prev_prev] - mode_level) <=
               _reclaim_threshold));

        let coin_supply = await get_coin_supply();
        let bond_supply = await get_bond_supply();
        let bond_budget = (await _bond_operation.bond_budget_()).toNumber();

        let reclaimed = 0;
        if (reclaim_result) {
          reclaimed = _voters[i].deposit[prev_prev];
        }

        let reward = 0;
        if (reclaim_result &&
            mode_level == _voters[i].oracle_level[prev_prev]) {
          let proportional_reward = 0;
          if (revealed_deposits[mode_level] > 0) {
            proportional_reward = Math.trunc(
                _proportional_reward_rate * reward_total *
                  _voters[i].deposit[prev_prev] /
                  (100 * revealed_deposits[mode_level]));
          }
          let constant_reward = Math.trunc(
              (100 - _proportional_reward_rate) * reward_total /
                (100 * revealed_counts[mode_level]));
          reward = proportional_reward + constant_reward;
        }

        _voters[i].balance = (_voters[i].balance -
                              _voters[i].deposit[current] +
                              reclaimed + reward);
        reclaimed_total += reclaimed + reward;

        let receipt = await check_vote(
          hash,
          _voters[i].oracle_level[prev],
          _voters[i].salt[prev],
          {from: _voters[i].address},
          true, reveal_result, _voters[i].deposit[current],
          reclaimed, reward, !commit_observed);

        assert.equal(await get_balance(_voters[i].address),
                     _voters[i].balance);
        assert.equal((await _acb.current_epoch_start_()).toNumber(),
                     (await _acb.getTimestamp()).toNumber())

        _metrics.deposited += _voters[i].deposit[current];
        _metrics.reclaimed += reclaimed;
        _metrics.rewarded += reward;

        if (reveal_result) {
          _metrics.reveal_hit += 1;
        } else {
          _metrics.reveal_miss += 1;
        }
        if (reclaimed > 0) {
          _metrics.reclaim_hit += 1;
        } else {
          _metrics.reclaim_miss += 1;
        }
        if (reward > 0) {
          _metrics.reward_hit += 1;
        } else {
          _metrics.reward_miss += 1;
        }

        if (commit_observed == false) {
          let delta = 0;
          if (mode_level != _level_max) {
            delta = Math.trunc(await get_coin_supply() *
                               (_level_to_exchange_rate[mode_level] - 10) / 10);
            delta = Math.trunc(delta * _damping_factor / 100);
          }

          let new_epoch_id = (await _oracle.epoch_id_()).toNumber();
          let mint = 0;
          let redeemable_bonds = 0;
          let issued_bonds = 0;
          let valid_bond_supply = (
            await _bond_operation.validBondSupply(new_epoch_id)).toNumber();
          if (delta >= 0) {
            let necessary_bonds = Math.trunc(delta / _bond_redemption_price);
            if (necessary_bonds <= valid_bond_supply) {
              redeemable_bonds = necessary_bonds;
            } else {
              redeemable_bonds = valid_bond_supply;
              mint = (necessary_bonds - valid_bond_supply) *
                _bond_redemption_price;
            }
          } else {
            assert.isTrue(mode_level != _level_max);
            issued_bonds = Math.trunc(-delta / _bond_price);
          }

          let args = receipt.logs.filter(
            e => e.event == 'UpdateEpochEvent')[0].args;
          assert.equal(args.epoch_id, new_epoch_id);
          assert.equal(args.current_epoch_start,
                       (await _acb.getTimestamp()).toNumber());
          assert.equal(args.tax, tax);
          assert.equal(args.burned, _burned[mod((new_epoch_id - 2), 3)]);
          assert.equal(args.delta, delta);
          assert.equal(args.mint, mint);

          assert.equal(await get_bond_supply(), bond_supply);
          if (mode_level == _level_max) {
            assert.equal(await _bond_operation.bond_budget_(), 0);
          } else if (delta >= 0) {
            assert.equal(await _bond_operation.bond_budget_(),
                         -redeemable_bonds);
          } else {
            assert.equal(await _bond_operation.bond_budget_(),
                         issued_bonds);
          }
          assert.equal(await get_coin_supply(),
                       coin_supply -
                       _burned[mod((new_epoch_id - 2), 3)]);
          assert.equal(await _acb.oracle_level_(), mode_level);
          commit_observed = true;

          _metrics.delta = delta;
          _metrics.mint = mint;
          _metrics.lost = _burned[mod((new_epoch_id - 2), 3)];
          _metrics.oracle_level = mode_level;
        } else {
          assert.equal(await _acb.oracle_level_(), mode_level);
          assert.equal(await get_bond_supply(), bond_supply);
          assert.equal(await _bond_operation.bond_budget_(), bond_budget);
        }
      }

      _burned[mod(epoch_id, 3)] =  deposit_total + tax - reclaimed_total;
      return commit_observed;
    }

    async function upgrade_contract_if_needed() {
      if (!_should_upgrade) {
        return;
      }

      let epoch_offset = (await _oracle.epoch_id_()).toNumber() - 3;
      let repeat = 1;
      if (epoch_offset == repeat * 1) {
        _tmp_bond_price = _bond_price;
        _tmp_bond_redemption_price = _bond_redemption_price;
        _tmp_bond_redemption_period = _bond_redemption_period;
        _tmp_bond_redeemable_period = _bond_redeemable_period;
        _tmp_epoch_duration = _epoch_duration;
        _tmp_proportional_reward_rate = _proportional_reward_rate;
        _tmp_deposit_rate = _deposit_rate;
        _tmp_damping_factor = _damping_factor;
        _tmp_level_to_exchange_rate = _level_to_exchange_rate.slice();
        _tmp_reclaim_threshold = _reclaim_threshold;
        _tmp_price_change_interval = _price_change_interval;
        _tmp_price_change_percentage = _price_change_percentage;
        _tmp_start_price_multiplier = _start_price_multiplier;

        _bond_price += 100;
        _bond_redemption_price += 100;
        _bond_redemption_period = 2;
        _bond_redeemable_period = 12;
        _epoch_duration = 10;
        _proportional_reward_rate = 50;
        _deposit_rate = 50;
        _damping_factor = 50;
        for (let level = 0; level < _level_max; level++) {
          _level_to_exchange_rate[level] += 1;
        }
        _reclaim_threshold = 0;
        _price_change_interval = Math.trunc(_epoch_duration / 8) + 1;
        _price_change_percentage = 1;
        _start_price_multiplier = 2;

        _coin = await upgradeProxy(_coin.address, JohnLawCoin_v2);
        common.print_contract_size(_coin, "JohnLawCoin_v2");
        _bond = await upgradeProxy(_bond.address, JohnLawBond_v2);
        common.print_contract_size(_bond, "JohnLawBond_v2");
        _oracle = await upgradeProxy(_oracle.address, OracleForTesting_v2);
        common.print_contract_size(_oracle, "OracleForTesting_v2");
        _bond_operation =
          await upgradeProxy(_bond_operation.address,
                             BondOperationForTesting_v2);
        common.print_contract_size(_bond_operation, "BondOperation_v2");
        _open_market_operation =
          await upgradeProxy(_open_market_operation.address,
                             OpenMarketOperationForTesting_v2);
        common.print_contract_size(_open_market_operation,
                                   "OpenMarketOperation_v2");
        _logging = await upgradeProxy(_logging.address, Logging_v2);
        common.print_contract_size(_logging, "Logging_v2");
        _acb = await upgradeProxy(_acb.address, ACBForTesting_v2);
        common.print_contract_size(_acb, "ACBForTesting_v2");
        
        await _oracle.overrideConstants(_reclaim_threshold,
                                        _proportional_reward_rate);
        await _bond_operation.overrideConstants(_bond_price,
                                                _bond_redemption_price,
                                                _bond_redemption_period,
                                                _bond_redeemable_period);
        await _open_market_operation.overrideConstants(_price_change_interval,
                                                       _price_change_percentage,
                                                       _start_price_multiplier);
        await _acb.overrideConstants(_epoch_duration,
                                     _deposit_rate,
                                     _damping_factor,
                                     _level_to_exchange_rate);

        await _acb.upgrade(_coin.address, _bond.address, _oracle.address,
                           _bond_operation.address,
                           _open_market_operation.address,
                           _logging.address);
      } else if (epoch_offset == repeat * 2) {
        _bond_price = _tmp_bond_price;
        _bond_redemption_price = _tmp_bond_redemption_price;
        _bond_redemption_period = _tmp_bond_redemption_period;
        _bond_redeemable_period = _tmp_bond_redeemable_period;
        _epoch_duration = _tmp_epoch_duration;
        _proportional_reward_rate = _tmp_proportional_reward_rate;
        _deposit_rate = _tmp_deposit_rate;
        _damping_factor = _tmp_damping_factor;
        _level_to_exchange_rate = _tmp_level_to_exchange_rate.slice();
        _reclaim_threshold = _tmp_reclaim_threshold;
        _price_change_interval = _tmp_price_change_interval;
        _price_change_percentage = _tmp_price_change_percentage;
        _start_price_multiplier = _tmp_start_price_multiplier;

        _oracle = await upgradeProxy(_oracle.address, OracleForTesting_v3);
        common.print_contract_size(_oracle, "OracleForTesting_v3");
        _acb = await upgradeProxy(_acb.address, ACBForTesting_v3);
        common.print_contract_size(_acb, "ACBForTesting_v3");
        
        await _oracle.overrideConstants(_reclaim_threshold,
                                        _proportional_reward_rate);
        await _bond_operation.overrideConstants(_bond_price,
                                                _bond_redemption_price,
                                                _bond_redemption_period,
                                                _bond_redeemable_period);
        await _open_market_operation.overrideConstants(_price_change_interval,
                                                       _price_change_percentage,
                                                       _start_price_multiplier);
        await _acb.overrideConstants(_epoch_duration,
                                     _deposit_rate,
                                     _damping_factor,
                                     _level_to_exchange_rate);
        
        await _acb.upgrade(_oracle.address);
      } else if (epoch_offset == repeat * 3) {
        _tmp_bond_price = _bond_price;
        _tmp_bond_redemption_price = _bond_redemption_price;
        _tmp_bond_redemption_period = _bond_redemption_period;
        _tmp_bond_redeemable_period = _bond_redeemable_period;
        _tmp_epoch_duration = _epoch_duration;
        _tmp_proportional_reward_rate = _proportional_reward_rate;
        _tmp_deposit_rate = _deposit_rate;
        _tmp_damping_factor = _damping_factor;
        _tmp_level_to_exchange_rate = _level_to_exchange_rate.slice();
        _tmp_reclaim_threshold = _reclaim_threshold;
        _tmp_price_change_interval = _price_change_interval;
        _tmp_price_change_percentage = _price_change_percentage;
        _tmp_start_price_multiplier = _start_price_multiplier;

        _bond_price += 100;
        _bond_redemption_price += 100;
        _bond_redemption_period = 2;
        _bond_redeemable_period = 12;
        _epoch_duration = 10;
        _proportional_reward_rate = 50;
        _deposit_rate = 50;
        _damping_factor = 50;
        for (let level = 0; level < _level_max; level++) {
          _level_to_exchange_rate[level] += 1;
        }
        _reclaim_threshold = 0;
        _price_change_interval = Math.trunc(_epoch_duration / 8) + 1;
        _price_change_percentage = 1;
        _start_price_multiplier = 2;

        let old_acb = _acb;
        _acb = await deployProxy(
          ACBForTesting_v4, [_coin.address, _oracle.address,
                             _bond_operation.address,
                             _open_market_operation.address,
                             _logging.address,
                             await old_acb.oracle_level_(),
                             await old_acb.current_epoch_start_()]);
        common.print_contract_size(_acb, "ACBForTesting_v4");
        await old_acb.deprecate();

        await _oracle.overrideConstants(_reclaim_threshold,
                                        _proportional_reward_rate);
        await _bond_operation.overrideConstants(_bond_price,
                                                _bond_redemption_price,
                                                _bond_redemption_period,
                                                _bond_redeemable_period);
        await _open_market_operation.overrideConstants(_price_change_interval,
                                                       _price_change_percentage,
                                                       _start_price_multiplier);
        await _acb.overrideConstants(_epoch_duration,
                                     _deposit_rate,
                                     _damping_factor,
                                     _level_to_exchange_rate);
        
        await _coin.transferOwnership(_acb.address);
        await _bond_operation.transferOwnership(_acb.address);
        await _open_market_operation.transferOwnership(_acb.address);
        await _oracle.transferOwnership(_acb.address);
        await _logging.transferOwnership(_acb.address);
        
        await _acb.setTimestamp((await old_acb.getTimestamp()).toNumber());
      } else if (epoch_offset == repeat * 4) {
        _bond_price = _tmp_bond_price;
        _bond_redemption_price = _tmp_bond_redemption_price;
        _bond_redemption_period = _tmp_bond_redemption_period;
        _bond_redeemable_period = _tmp_bond_redeemable_period;
        _epoch_duration = _tmp_epoch_duration;
        _proportional_reward_rate = _tmp_proportional_reward_rate;
        _deposit_rate = _tmp_deposit_rate;
        _damping_factor = _tmp_damping_factor;
        _level_to_exchange_rate = _tmp_level_to_exchange_rate.slice();
        _reclaim_threshold = _tmp_reclaim_threshold;
        _price_change_interval = _tmp_price_change_interval;
        _price_change_percentage = _tmp_price_change_percentage;
        _start_price_multiplier = _tmp_start_price_multiplier;

        let old_bond_operation = _bond_operation;
        _bond_operation = await deployProxy(
          BondOperationForTesting_v5,
          [_bond.address,
           (await old_bond_operation.bond_budget_()).toNumber()]);
        common.print_contract_size(_bond_operation, "BondOperation_v5");

        let old_open_market_operation = _open_market_operation;
        _open_market_operation = await deployProxy(
          OpenMarketOperationForTesting_v5,
          [(await old_open_market_operation.latest_price_()).toNumber(),
           (await old_open_market_operation.start_price_()).toNumber(),
           (await old_open_market_operation.eth_balance_()).toNumber(),
           (await old_open_market_operation.coin_budget_()).toNumber()]);
        common.print_contract_size(_open_market_operation,
                                   "OpenMarketOperation_v5");
        
        let old_oracle = _oracle;
        _oracle = await deployProxy(
            OracleForTesting_v5,
            [(await old_oracle.epoch_id_()).toNumber()]);
        common.print_contract_size(_oracle, "OracleForTesting_v5");

        let old_acb = _acb;
        _acb = await deployProxy(
          ACBForTesting_v5, [_coin.address, old_oracle.address,
                             _oracle.address, _bond_operation.address,
                             _open_market_operation.address,
                             _logging.address,
                             await old_acb.oracle_level_(),
                             await old_acb.current_epoch_start_()]);
        common.print_contract_size(_acb, "ACBForTesting_v5");

        await old_oracle.overrideConstants(_reclaim_threshold,
                                           _proportional_reward_rate);
        await _oracle.overrideConstants(_level_max, _reclaim_threshold,
                                        _proportional_reward_rate);
        await _bond_operation.overrideConstants(_bond_price,
                                                _bond_redemption_price,
                                                _bond_redemption_period,
                                                _bond_redeemable_period);
        await _open_market_operation.overrideConstants(_price_change_interval,
                                                       _price_change_percentage,
                                                       _start_price_multiplier);
        await _acb.overrideConstants(_epoch_duration,
                                     _deposit_rate,
                                     _damping_factor,
                                     _level_to_exchange_rate);
        
        await old_acb.deprecate();
        await old_bond_operation.deprecate();
        await _bond.transferOwnership(_bond_operation.address);
        await _coin.transferOwnership(_acb.address);
        await _bond_operation.transferOwnership(_acb.address);
        await _open_market_operation.transferOwnership(_acb.address);
        await old_oracle.transferOwnership(_acb.address);
        await _oracle.transferOwnership(_acb.address);
        await _logging.transferOwnership(_acb.address);
        
        await _acb.setTimestamp((await old_acb.getTimestamp()).toNumber());
      }
    }

    async function check_vote(
      hash, oracle_level, salt, option,
      commit_result, reveal_result, deposited, reclaimed, rewarded,
      epoch_updated) {
      let receipt = await _acb.vote(hash, oracle_level, salt, option);
      let args = receipt.logs.filter(e => e.event == 'VoteEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.hash, hash);
      assert.equal(args.oracle_level, oracle_level);
      assert.equal(args.salt, salt);
      assert.equal(args.commit_result, commit_result);
      assert.equal(args.reveal_result, reveal_result);
      assert.equal(args.deposited.toNumber(), deposited);
      assert.equal(args.reclaimed.toNumber(), reclaimed);
      assert.equal(args.rewarded.toNumber(), rewarded);
      assert.equal(args.epoch_updated, epoch_updated);
      return receipt;
    }

    async function check_transfer(receiver, amount, option) {
      let receipt = await _acb.transfer(receiver, amount, option);
      let args = receipt.logs.filter(e => e.event == 'TransferEvent')[0].args;
      assert.equal(args.from, option.from);
      assert.equal(args.to, receiver);
      assert.equal(args.value, amount);
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

    async function get_balance(address) {
      return (await _coin.balanceOf(address)).toNumber();
    }

    async function get_bond(address, redemption) {
      return (await _bond.balanceOf(address, redemption)).toNumber();
    }

    async function get_coin_supply() {
      return (await _coin.totalSupply()).toNumber();
    }

    async function get_bond_supply() {
      return (await _bond.totalSupply()).toNumber();
    }

    async function get_vote_logs(epoch_id) {
      const ret = await _logging.getVoteLog(epoch_id);
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

    async function get_epoch_logs(epoch_id) {
      const ret = await _logging.getEpochLog(epoch_id);
      let epoch_log = {};
      epoch_log.minted_coins = ret[0];
      epoch_log.burned_coins = ret[1];
      epoch_log.coin_supply_delta = ret[2];
      epoch_log.total_coin_supply = ret[3];
      epoch_log.oracle_level = ret[4];
      epoch_log.current_epoch_start = ret[5];
      epoch_log.tax = ret[6];
      return epoch_log;
    }

    async function get_bond_operation_logs(epoch_id) {
      const ret = await _logging.getBondOperationLog(epoch_id);
      let bond_operation_log = {};
      bond_operation_log.bond_budget = ret[0];
      bond_operation_log.total_bond_supply = ret[1];
      bond_operation_log.valid_bond_supply = ret[2];
      bond_operation_log.purchased_bonds = ret[3];
      bond_operation_log.redeemed_bonds = ret[4];
      bond_operation_log.expired_bonds = ret[5];
      return bond_operation_log;
    }
    
    async function get_open_market_operation_logs(epoch_id) {
      const ret = await _logging.getOpenMarketOperationLog(epoch_id);
      let open_market_operation_log = {};
      open_market_operation_log.coin_budget = ret[0];
      open_market_operation_log.increased_eth = ret[1];
      open_market_operation_log.increased_coin_supply = ret[2];
      open_market_operation_log.decreased_eth = ret[3];
      open_market_operation_log.decreased_coin_supply = ret[4];
      return open_market_operation_log;
    }
  });
}

function divide_or_zero(a, b) {
  if (b == 0) {
    return 0;
  }
  return Math.trunc(a / b);
}
