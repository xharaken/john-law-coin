// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

const { deployProxy, upgradeProxy } =
      require('@openzeppelin/truffle-upgrades');

const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");
const Oracle = artifacts.require("Oracle");
const OracleForTesting = artifacts.require("OracleForTesting");
const Logging = artifacts.require("Logging");
const ACB = artifacts.require("ACB");
const ACBForTesting = artifacts.require("ACBForTesting");
const JohnLawCoin_v2 = artifacts.require("JohnLawCoin_v2");
const JohnLawBond_v2 = artifacts.require("JohnLawBond_v2");
const Oracle_v2 = artifacts.require("Oracle_v2");
const OracleForTesting_v2 = artifacts.require("OracleForTesting_v2");
const Logging_v2 = artifacts.require("Logging_v2");
const ACB_v2 = artifacts.require("ACB_v2");
const ACBForTesting_v2 = artifacts.require("ACBForTesting_v2");
const Oracle_v3 = artifacts.require("Oracle_v3");
const OracleForTesting_v3 = artifacts.require("OracleForTesting_v3");
const ACB_v3 = artifacts.require("ACB_v3");
const ACBForTesting_v3 = artifacts.require("ACBForTesting_v3");
const ACB_v4 = artifacts.require("ACB_v4");
const ACBForTesting_v4 = artifacts.require("ACBForTesting_v4");
const Oracle_v5 = artifacts.require("Oracle_v5");
const OracleForTesting_v5 = artifacts.require("OracleForTesting_v5");
const ACB_v5 = artifacts.require("ACB_v5");
const ACBForTesting_v5 = artifacts.require("ACBForTesting_v5");

const common = require("./common.js");
const should_throw = common.should_throw;
const mod = common.mod;
const randint = common.randint;

contract("ACBSimulator", function (accounts) {
  let args = common.custom_arguments();
  assert.isTrue(args.length == 13);
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
                     args[12]);
});

function parameterized_test(accounts,
                            _bond_redemption_price,
                            _bond_redemption_period,
                            _phase_duration,
                            _proportional_reward_rate,
                            _deposit_rate,
                            _damping_factor,
                            _level_to_exchange_rate,
                            _level_to_bond_price,
                            _level_to_tax_rate,
                            _reclaim_threshold,
                            _voter_count,
                            _iteration,
                            _should_upgrade) {
  let test_name = "ACB parameters:" +
      " bond_redemp_price=" + _bond_redemption_price +
      " bond_redemp_period=" + _bond_redemption_period +
      " phase_duration=" + _phase_duration +
      " reward_rate=" + _proportional_reward_rate +
      " deposit_rate=" + _deposit_rate +
      " damping_factor=" + _damping_factor +
      " level_to_exchange_rate=" + _level_to_exchange_rate +
      " level_to_bond_price=" + _level_to_bond_price +
      " level_to_tax_rate=" + _level_to_tax_rate +
      " reclaim=" + _reclaim_threshold +
      " voter=" + _voter_count +
      " iter=" + _iteration +
      " should_upgrade=" + _should_upgrade;
  console.log(test_name);
  assert.isTrue(_voter_count <= accounts.length - 1);

  it(test_name, async function () {
    let _level_max = _level_to_exchange_rate.length;

    let _oracle = await deployProxy(OracleForTesting, []);
    common.print_contract_size(_oracle, "OracleForTesting");

    let _coin = await deployProxy(JohnLawCoin, []);
    common.print_contract_size(_coin, "JohnLawCoin");
    let _bond = await deployProxy(JohnLawBond, []);
    common.print_contract_size(_bond, "JohnLawBond");
    let _logging = await deployProxy(Logging, []);
    common.print_contract_size(_logging, "Logging");
    let _acb = await deployProxy(
        ACBForTesting, [_coin.address, _bond.address,
                        _oracle.address, _logging.address]);
    common.print_contract_size(_acb, "ACBForTesting");

    await _oracle.overrideConstants(_level_max, _reclaim_threshold,
                                     _proportional_reward_rate);
    await _coin.transferOwnership(_acb.address);
    await _bond.transferOwnership(_acb.address);
    await _oracle.transferOwnership(_acb.address);
    await _logging.transferOwnership(_acb.address);
    await _acb.overrideConstants(_bond_redemption_price,
                                 _bond_redemption_period,
                                 _phase_duration,
                                 _deposit_rate,
                                 _damping_factor,
                                 _level_to_exchange_rate,
                                 _level_to_bond_price,
                                 _level_to_tax_rate);

    let _lost_deposit = [0, 0, 0];

    let _voters = [];
    for (let i = 0; i < _voter_count; i++) {
      _voters.push({
        address: accounts[i + 1],
        committed: [false, false, false],
        committed_level: [0, 0, 0],
        committed_salt: [0, 0, 0],
        deposit: [0, 0, 0],
        revealed: [false, false, false],
        revealed_level: [0, 0, 0],
        revealed_salt: [0, 0, 0],
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
        this.redeem_count = 0;
        this.fast_redeem_count = 0;
        this.redemption_count = 0;
        this.redeem_hit = 0;
        this.purchase_hit = 0;
        this.purchase_count = 0;
        this.delta = 0;
        this.mint = 0;
        this.lost = 0;
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
        this.total_redeem_count = 0;
        this.total_fast_redeem_count = 0;
        this.total_redeem_hit = 0;
        this.total_purchase_hit = 0;
        this.total_purchase_count = 0;
        this.total_mint = 0;
        this.total_lost = 0;
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
        this.total_redeem_count += this.redeem_count;
        this.total_fast_redeem_count += this.fast_redeem_count;
        this.total_redemption_count += this.redemption_count;
        this.total_redeem_hit += this.redeem_hit;
        this.total_purchase_hit += this.purchase_hit;
        this.total_purchase_count += this.purchase_count;
        this.total_mint += this.mint;
        this.total_lost += this.lost;
      }
    }

    _metrics = new Metrics();

    for (let i = 0; i < _voter_count; i++) {
      let amount = randint(0, _level_to_bond_price[_level_max - 1] * 10);
      if (randint(0, 9) >= 9) {
        amount = 0;
      }
      _voters[i].balance = amount;
      await _acb.setCoin(_voters[i].address, _voters[i].balance);
      assert.equal(await get_balance(_voters[i].address),
                   _voters[i].balance);
    }
    let initial_coin_supply = await get_coin_supply();

    let epoch = 0;
    let burned_tax = 0;
    for (let iter = 0; iter < _iteration; iter++) {
      if ((await get_coin_supply()) >= initial_coin_supply * 100) {
        break;
      }

      await upgrade_contract_if_needed(epoch);

      _metrics.reset_local();

      let coin_supply1 = await get_coin_supply();

      await _acb.setTimestamp(
          (await _acb.getTimestamp()).toNumber() + _phase_duration);
      let commit_observed = await vote(epoch, burned_tax);
      if (commit_observed == false) {
        continue;
      }

      epoch += 1;

      let coin_supply2 = await get_coin_supply();
      let bond_supply = await get_bond_supply();
      let bond_budget = (await _acb.bond_budget_()).toNumber();

      await redeem_bonds();
      await purchase_bonds();

      let acb_log = await get_acb_logs(await _logging.log_index_());
      assert.equal(acb_log.minted_coins, _metrics.mint);
      assert.equal(acb_log.burned_coins, _metrics.lost);
      assert.equal(acb_log.coin_supply_delta.toNumber(), _metrics.delta);
      assert.equal(acb_log.bond_budget, bond_budget);
      assert.equal(acb_log.coin_total_supply, coin_supply2);
      assert.equal(acb_log.bond_total_supply, bond_supply);
      assert.equal(acb_log.oracle_level, _metrics.oracle_level);
      assert.equal(acb_log.current_phase_start,
                   (await _acb.getTimestamp()).toNumber());
      assert.equal(acb_log.burned_tax, burned_tax);
      assert.equal(acb_log.purchased_bonds,
                   _metrics.purchase_count);
      assert.equal(acb_log.redeemed_bonds, _metrics.redeem_count);
      let vote_log = await get_vote_logs(await _logging.log_index_());
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

      burned_tax = await transfer_coins();

      if (true) {
        let coin_supply3 = await get_coin_supply();
        console.log("epoch=" + epoch +
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
                    "% fast_redeem=" + _metrics.fast_redeem_count +
                    "/" + _metrics.redeem_count +
                    "=" + divide_or_zero(100 * _metrics.fast_redeem_count,
                                         _metrics.redeem_count) +
                    "% delta=" + _metrics.delta +
                    " mint=" + _metrics.mint +
                    " lost=" + _metrics.lost +
                    " coin_supply=" + coin_supply1 +
                    "->" + coin_supply2 +
                    "->" + coin_supply3 +
                    "=" + (coin_supply3 - coin_supply1) +
                    " bond_supply=" + bond_supply +
                    "->" + (await get_bond_supply()) +
                    " bond_budget=" + bond_budget +
                    "->" + (await _acb.bond_budget_()).toNumber()
                   );
      }
      _metrics.update_total();
    }
    console.log("================");
        console.log("epoch=" + epoch +
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
                    "/" + _voter_count * epoch +
                    "=" + divide_or_zero(100 * _metrics.total_purchase_hit,
                                         _voter_count * epoch) +
                    "% redeem_hit=" + _metrics.total_redeem_hit +
                    "/" + _voter_count * epoch +
                    "=" + divide_or_zero(100 * _metrics.total_redeem_hit,
                                         _voter_count * epoch) +
                    "% redemptions=" + _metrics.total_redemption_count +
                    "/" + _metrics.total_redeem_hit +
                    "=" + divide_or_zero(100 * _metrics.total_redemption_count,
                                         _metrics.total_redeem_hit) +
                    "% fast_redeem=" + _metrics.total_fast_redeem_count +
                    "/" + _metrics.total_redeem_count +
                    "=" + divide_or_zero(100 * _metrics.total_fast_redeem_count,
                                         _metrics.total_redeem_count) +
                    "% supply=" + _metrics.supply_increased +
                    "/" + _metrics.supply_nochange +
                    "/" + _metrics.supply_decreased +
                    " coin_supply=" +
                    divide_or_zero((await get_coin_supply()) /
                                   initial_coin_supply * 100) +
                    "% mint=" + _metrics.total_mint +
                    " lost=" + _metrics.total_lost +
                    " bond_supply=" + await get_bond_supply()
                   );
    console.log("================");
    console.log();

    async function transfer_coins() {
      let start_index = randint(0, _voter_count - 1);
      let burned_tax = 0;
      for (let index = 0; index < Math.min(_voter_count, 10); index++) {
        let sender = _voters[(start_index + index) % _voter_count];
        let receiver = _voters[(start_index + index + 1) % _voter_count];
        let transfer = randint(
            0, Math.min(await get_balance(sender.address), 100));
        let tax_rate = 0;
        let oracle_level = (await _acb.oracle_level_()).toNumber();
        if (0 <= oracle_level && oracle_level < _level_max) {
          tax_rate = _level_to_tax_rate[oracle_level];
        }
        let tax = Math.trunc(transfer * tax_rate / 100);
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
        burned_tax += tax;
      }
      return burned_tax;
    }

    async function purchase_bonds() {
      let start_index = randint(0, _voter_count - 1);
      for (let index = 0; index < _voter_count; index++) {
        let bond_budget = (await _acb.bond_budget_()).toNumber();
        if (bond_budget <= 0) {
          continue;
        }

        let voter = _voters[(start_index + index) % _voter_count];
        let bond_price = _level_to_bond_price[_level_max - 1];
        let oracle_level = (await _acb.oracle_level_()).toNumber();
        if (0 <= oracle_level && oracle_level < _level_max) {
          bond_price = _level_to_bond_price[oracle_level];
        }
        let count = Math.min(
            bond_budget, Math.trunc(0.3 * voter.balance / bond_price));
        if (count <= 0) {
          continue;
        }

        let coin_supply = await get_coin_supply();
        let bond_supply = await get_bond_supply();
        let redemption = (await _acb.getTimestamp()).toNumber() +
            _bond_redemption_period;
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
        assert.equal(await _acb.bond_budget_(), bond_budget - count);
        assert.equal(await get_bond(voter.address, redemption),
                     voter.bonds[redemption]);

        _metrics.purchase_hit += 1;
        _metrics.purchase_count += count;
      }
    }

    async function redeem_bonds() {
      let start_index = randint(0, _voter_count - 1);
      for (let index = 0; index < _voter_count; index++) {
        if (randint(0, 9) >= 9) {
          continue;
        }
        let voter = _voters[(start_index + index) % _voter_count];
        let redemptions = [];
        for (let redemption in voter.bonds) {
          redemptions.push(redemption);
        }
        if (redemptions.length == 0) {
          continue;
        }

        let fast_redeem_count = 0;
        let redeem_count = 0;
        let bond_budget = (await _acb.bond_budget_()).toNumber();
        let timestamp = (await _acb.getTimestamp()).toNumber();
        for (let redemption of redemptions) {
          assert.isTrue(redemption in voter.bonds);
          let count = voter.bonds[redemption];
          if (redemption > timestamp) {
            if (bond_budget >= 0) {
              continue;
            }
            count = Math.min(count, -bond_budget);
            fast_redeem_count += count;
          }
          redeem_count += count;
          bond_budget += count;
          voter.bonds[redemption] -= count;
          assert.isTrue(voter.bonds[redemption] >= 0);
          if (voter.bonds[redemption] == 0) {
            delete voter.bonds[redemption];
          }
        }
        voter.balance += _bond_redemption_price * redeem_count;

        let coin_supply = await get_coin_supply();
        let bond_supply = await get_bond_supply();
        await check_redeem_bonds(redemptions,
                                 {from: voter.address}, redeem_count);
        assert.equal(await _acb.bond_budget_(), bond_budget);
        assert.equal(await get_balance(voter.address),
                     voter.balance);

        let bond_count =
            await _bond.numberOfRedemptionTimestampsOwnedBy(voter.address);
        assert.equal(Object.keys(voter.bonds).length, bond_count);
        for (let index = 0; index < bond_count; index++) {
          let redemption = (await _bond.getRedemptionTimestampOwnedBy(
              voter.address, index)).toNumber();
          assert.isTrue(redemption in voter.bonds);
          assert.equal(await get_bond(voter.address, redemption),
                       voter.bonds[redemption])
        }

        assert.equal(await get_bond_supply(), bond_supply - redeem_count);
        assert.equal(await get_coin_supply(),
                     coin_supply + _bond_redemption_price * redeem_count);

        _metrics.fast_redeem_count += fast_redeem_count;
        _metrics.redeem_count += redeem_count;
        _metrics.redemption_count += redemptions.length;
        _metrics.redeem_hit += 1;
      }
    }

    async function vote(epoch, burned_tax) {
      let current = mod(epoch, 3);
      let prev = mod(epoch - 1, 3);
      let prev_prev = mod(epoch - 2, 3);

      let revealed_deposits = new Array(_level_max).fill(0);
      let revealed_counts = new Array(_level_max).fill(0);
      for (let i = 0; i < _voter_count; i++) {
        if (_voters[i].committed[prev_prev] &&
            _voters[i].revealed[prev_prev] &&
            _voters[i].revealed_level[prev_prev] ==
            _voters[i].committed_level[prev_prev] &&
            0 <= _voters[i].revealed_level[prev_prev] &&
            _voters[i].revealed_level[prev_prev] < _level_max &&
            _voters[i].revealed_salt[prev_prev] ==
            _voters[i].committed_salt[prev_prev]) {
          level = _voters[i].revealed_level[prev_prev];
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
            _voters[i].revealed_level[prev_prev] ==
            _voters[i].committed_level[prev_prev] &&
            0 <= _voters[i].revealed_level[prev_prev] &&
            _voters[i].revealed_level[prev_prev] < _level_max &&
            _voters[i].revealed_salt[prev_prev] ==
            _voters[i].committed_salt[prev_prev] &&
            (Math.abs(_voters[i].revealed_level[prev_prev] - mode_level) <=
             _reclaim_threshold)) {
          deposit_to_be_reclaimed += _voters[i].deposit[prev_prev];
        }
      }
      assert.isTrue(deposit_to_be_reclaimed <= deposit_total);
      if (mode_level == _level_max) {
        assert.equal(deposit_to_be_reclaimed, 0);
      }

      let coin_supply = await get_coin_supply();
      let bond_supply = await get_bond_supply();
      let delta = 0;
      if (mode_level != _level_max) {
        delta = Math.trunc(coin_supply *
                           (_level_to_exchange_rate[mode_level] - 10) / 10);
        delta = Math.trunc(delta * _damping_factor / 100);
      }

      let mint = 0;
      let redeemable_bonds = 0;
      let issued_bonds = 0;
      if (delta >= 0) {
        let necessary_bonds = Math.trunc(delta / _bond_redemption_price);
        if (necessary_bonds <= bond_supply) {
          redeemable_bonds = necessary_bonds;
        } else {
          redeemable_bonds = bond_supply;
          mint = (necessary_bonds - bond_supply) * _bond_redemption_price;
        }
      } else {
        assert.isTrue(mode_level != _level_max);
        issued_bonds = Math.trunc(-delta / _level_to_bond_price[mode_level]);
      }

      let target_level = randint(0, _level_max - 1);
      let reward_total = deposit_total - deposit_to_be_reclaimed + mint;
      let reclaimed_total = 0;
      let commit_observed = false;
      for (let i = 0; i < _voter_count; i++) {
        _voters[i].committed[current] = false;
        _voters[i].committed_level[current] = 0;
        _voters[i].committed_salt[current] = 0;
        _voters[i].deposit[current] = 0;
        _voters[i].revealed[current] = false;
        _voters[i].revealed_level[current] = 0;
        _voters[i].revealed_salt[current] = 0;
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
        let committed_hash = await _acb.hash(
            _voters[i].committed_level[current],
            _voters[i].committed_salt[current], {from: _voters[i].address});
        _voters[i].deposit[current] = Math.trunc(
            _voters[i].balance * _deposit_rate / 100);

        _voters[i].revealed[prev] = true;
        if (randint(0, 99) < 97) {
          _voters[i].revealed_level[prev] = _voters[i].committed_level[prev];
        } else {
          _voters[i].revealed_level[prev] = randint(0, _level_max);
        }
        if (randint(0, 99) < 97) {
          _voters[i].revealed_salt[prev] = _voters[i].committed_salt[prev];
        } else {
          _voters[i].revealed_salt[prev] = randint(0, 10);
        }
        _voters[i].reclaimed[prev_prev] = true;

        let reveal_result = (
            _voters[i].committed[prev] &&
            _voters[i].revealed_level[prev] ==
              _voters[i].committed_level[prev] &&
            0 <= _voters[i].revealed_level[prev] &&
            _voters[i].revealed_level[prev] < _level_max &&
            _voters[i].revealed_salt[prev] ==
              _voters[i].committed_salt[prev]);

        let reclaim_result = (
            _voters[i].committed[prev_prev] &&
              _voters[i].revealed[prev_prev] &&
              _voters[i].revealed_level[prev_prev] ==
              _voters[i].committed_level[prev_prev] &&
              0 <= _voters[i].revealed_level[prev_prev] &&
              _voters[i].revealed_level[prev_prev] < _level_max &&
              _voters[i].revealed_salt[prev_prev] ==
              _voters[i].committed_salt[prev_prev] &&
              (Math.abs(_voters[i].revealed_level[prev_prev] - mode_level) <=
               _reclaim_threshold));

        let coin_supply = await get_coin_supply();
        let bond_supply = await get_bond_supply();
        let bond_budget = (await _acb.bond_budget_()).toNumber();

        let reclaimed = 0;
        if (reclaim_result) {
          reclaimed = _voters[i].deposit[prev_prev];
        }

        let reward = 0;
        if (reclaim_result &&
            mode_level == _voters[i].revealed_level[prev_prev]) {
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

        await check_vote(committed_hash,
                         _voters[i].revealed_level[prev],
                         _voters[i].revealed_salt[prev],
                         {from: _voters[i].address},
                         true, reveal_result, _voters[i].deposit[current],
                         reclaimed, reward, !commit_observed);

        assert.equal(await get_balance(_voters[i].address),
                     _voters[i].balance);
        assert.equal((await _acb.current_phase_start_()).toNumber(),
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
          assert.equal(await get_bond_supply(), bond_supply);
          if (mode_level == _level_max) {
            assert.equal(await _acb.bond_budget_(), 0);
          } else if (delta >= 0) {
            assert.equal(await _acb.bond_budget_(), -redeemable_bonds);
          } else {
            assert.equal(await _acb.bond_budget_(), issued_bonds);
          }
          assert.equal(await get_coin_supply(),
                       coin_supply + mint -
                       _lost_deposit[mod(epoch - 1, 3)] - burned_tax);
          assert.equal(await _acb.oracle_level_(), mode_level);
          commit_observed = true;

          _metrics.delta = delta;
          _metrics.mint = mint;
          _metrics.lost = _lost_deposit[mod(epoch - 1, 3)];
          _metrics.oracle_level = mode_level;
        } else {
          assert.equal(await _acb.oracle_level_(), mode_level);
          assert.equal(await get_bond_supply(), bond_supply);
          assert.equal(await _acb.bond_budget_(), bond_budget);
        }
      }

      _lost_deposit[mod(epoch, 3)] =  deposit_total + mint - reclaimed_total;
      return commit_observed;
    }

    async function upgrade_contract_if_needed(epoch) {
      if (!_should_upgrade) {
        return;
      }

      if (epoch == 5) {
        _tmp_bond_redemption_price = _bond_redemption_price;
        _tmp_bond_redemption_period = _bond_redemption_period;
        _tmp_phase_duration = _phase_duration;
        _tmp_proportional_reward_rate = _proportional_reward_rate;
        _tmp_deposit_rate = _deposit_rate;
        _tmp_damping_factor = _damping_factor;
        _tmp_level_to_exchange_rate = _level_to_exchange_rate.slice();
        _tmp_level_to_bond_price = _level_to_bond_price.slice();
        _tmp_level_to_tax_rate = _level_to_tax_rate.slice();
        _tmp_reclaim_threshold = _reclaim_threshold;

        _bond_redemption_price += 100;
        _bond_redemption_period = 2;
        _phase_duration = 10;
        _proportional_reward_rate = 50;
        _deposit_rate = 50;
        _damping_factor = 50;
        for (let level = 0; level < _level_max; level++) {
          _level_to_exchange_rate[level] += 1;
          _level_to_bond_price[level] += 100;
          _level_to_tax_rate[level] = 5;
        }
        _reclaim_threshold = 0;

        _coin = await upgradeProxy(_coin.address, JohnLawCoin_v2);
        common.print_contract_size(_coin, "JohnLawCoin_v2");
        _bond = await upgradeProxy(_bond.address, JohnLawBond_v2);
        common.print_contract_size(_bond, "JohnLawBond_v2");
        _oracle = await upgradeProxy(_oracle.address, OracleForTesting_v2);
        common.print_contract_size(_oracle, "OracleForTesting_v2");
        await _oracle.overrideConstants(_reclaim_threshold,
                                        _proportional_reward_rate);
        _logging = await upgradeProxy(_logging.address, Logging_v2);
        common.print_contract_size(_logging, "Logging_v2");
        _acb = await upgradeProxy(_acb.address, ACBForTesting_v2);
        await _acb.overrideConstants(_bond_redemption_price,
                                     _bond_redemption_period,
                                     _phase_duration,
                                     _deposit_rate,
                                     _damping_factor,
                                     _level_to_exchange_rate,
                                     _level_to_bond_price,
                                     _level_to_tax_rate);
        common.print_contract_size(_acb, "ACBForTesting_v2");
        await _acb.upgrade(_coin.address, _bond.address,
                           _oracle.address, _logging.address);
      } else if (epoch == 10) {
        _bond_redemption_price = _tmp_bond_redemption_price;
        _bond_redemption_period = _tmp_bond_redemption_period;
        _phase_duration = _tmp_phase_duration;
        _proportional_reward_rate = _tmp_proportional_reward_rate;
        _deposit_rate = _tmp_deposit_rate;
        _damping_factor = _tmp_damping_factor;
        _level_to_exchange_rate = _tmp_level_to_exchange_rate.slice();
        _level_to_bond_price = _tmp_level_to_bond_price.slice();
        _level_to_tax_rate = _tmp_level_to_tax_rate.slice();
        _reclaim_threshold = _tmp_reclaim_threshold;

        _oracle = await upgradeProxy(_oracle.address, OracleForTesting_v3);
        common.print_contract_size(_oracle, "OracleForTesting_v3");
        await _oracle.overrideConstants(_reclaim_threshold,
                                        _proportional_reward_rate);
        _acb = await upgradeProxy(_acb.address, ACBForTesting_v3);
        common.print_contract_size(_acb, "ACBForTesting_v3");
        await _acb.overrideConstants(_bond_redemption_price,
                                     _bond_redemption_period,
                                     _phase_duration,
                                     _deposit_rate,
                                     _damping_factor,
                                     _level_to_exchange_rate,
                                     _level_to_bond_price,
                                     _level_to_tax_rate);
        await _acb.upgrade(_oracle.address);
      } else if (epoch == 15) {
        _tmp_bond_redemption_price = _bond_redemption_price;
        _tmp_bond_redemption_period = _bond_redemption_period;
        _tmp_phase_duration = _phase_duration;
        _tmp_proportional_reward_rate = _proportional_reward_rate;
        _tmp_deposit_rate = _deposit_rate;
        _tmp_damping_factor = _damping_factor;
        _tmp_level_to_exchange_rate = _level_to_exchange_rate.slice();
        _tmp_level_to_bond_price = _level_to_bond_price.slice();
        _tmp_level_to_tax_rate = _level_to_tax_rate.slice();
        _tmp_reclaim_threshold = _reclaim_threshold;

        _bond_redemption_price += 100;
        _bond_redemption_period = 2;
        _phase_duration = 10;
        _proportional_reward_rate = 50;
        _deposit_rate = 50;
        _damping_factor = 50;
        for (let level = 0; level < _level_max; level++) {
          _level_to_exchange_rate[level] += 1;
          _level_to_bond_price[level] += 100;
          _level_to_tax_rate[level] = 5;
        }
        _reclaim_threshold = 0;

        await _oracle.overrideConstants(_reclaim_threshold,
                                        _proportional_reward_rate);

        let old_acb = _acb;
        _acb = await deployProxy(
            ACBForTesting_v4, [_coin.address, _bond.address,
                               _oracle.address, _logging.address,
                               await old_acb.bond_budget_(),
                               await old_acb.oracle_level_(),
                               await old_acb.current_phase_start_()]);
        common.print_contract_size(_acb, "ACBForTesting_v4");
        await old_acb.deprecate();

        await _coin.transferOwnership(_acb.address);
        await _bond.transferOwnership(_acb.address);
        await _oracle.transferOwnership(_acb.address);
        await _logging.transferOwnership(_acb.address);
        await _acb.overrideConstants(_bond_redemption_price,
                                     _bond_redemption_period,
                                     _phase_duration,
                                     _deposit_rate,
                                     _damping_factor,
                                     _level_to_exchange_rate,
                                     _level_to_bond_price,
                                     _level_to_tax_rate);
        await _acb.setTimestamp((await old_acb.getTimestamp()).toNumber());
      } else if (epoch == 20) {
        _bond_redemption_price = _tmp_bond_redemption_price;
        _bond_redemption_period = _tmp_bond_redemption_period;
        _phase_duration = _tmp_phase_duration;
        _proportional_reward_rate = _tmp_proportional_reward_rate;
        _deposit_rate = _tmp_deposit_rate;
        _damping_factor = _tmp_damping_factor;
        _level_to_exchange_rate = _tmp_level_to_exchange_rate.slice();
        _level_to_bond_price = _tmp_level_to_bond_price.slice();
        _level_to_tax_rate = _tmp_level_to_tax_rate.slice();
        _reclaim_threshold = _tmp_reclaim_threshold;

        await _oracle.overrideConstants(_reclaim_threshold,
                                        _proportional_reward_rate);

        let old_oracle = _oracle;
        _oracle = await deployProxy(
            OracleForTesting_v5,
            [(await old_oracle.phase_id_()).toNumber() + 1]);
        common.print_contract_size(_oracle, "OracleForTesting_v5");
        await _oracle.overrideConstants(_level_max, _reclaim_threshold,
                                        _proportional_reward_rate);

        let old_acb = _acb;
        _acb = await deployProxy(
            ACBForTesting_v5, [_coin.address, _bond.address,
                               old_oracle.address, _oracle.address,
                               _logging.address,
                               await old_acb.bond_budget_(),
                               await old_acb.oracle_level_(),
                               await old_acb.current_phase_start_()]);
        common.print_contract_size(_acb, "ACBForTesting_v5");
        await old_acb.deprecate();

        await _coin.transferOwnership(_acb.address);
        await _bond.transferOwnership(_acb.address);
        await old_oracle.transferOwnership(_acb.address);
        await _oracle.transferOwnership(_acb.address);
        await _logging.transferOwnership(_acb.address);
        await _acb.overrideConstants(_bond_redemption_price,
                                     _bond_redemption_period,
                                     _phase_duration,
                                     _deposit_rate,
                                     _damping_factor,
                                     _level_to_exchange_rate,
                                     _level_to_bond_price,
                                     _level_to_tax_rate);
        await _acb.setTimestamp((await old_acb.getTimestamp()).toNumber());
      }
    }

    async function check_vote(
        committed_hash, revealed_level, revealed_salt, option,
        commit_result, reveal_result, deposited, reclaimed, rewarded,
        phase_updated) {
      let receipt = await _acb.vote(
          committed_hash, revealed_level, revealed_salt, option);
      let args = receipt.logs.filter(e => e.event == 'VoteEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.committed_hash, committed_hash);
      assert.equal(args.revealed_level, revealed_level);
      assert.equal(args.revealed_salt, revealed_salt);
      assert.equal(args.commit_result, commit_result);
      assert.equal(args.reveal_result, reveal_result);
      assert.equal(args.deposited, deposited);
      assert.equal(args.reclaimed, reclaimed);
      assert.equal(args.rewarded, rewarded);
      assert.equal(args.phase_updated, phase_updated);
    }

    async function check_transfer(receiver, amount, option) {
      let receipt = await _acb.transfer(receiver, amount, option);
      let args = receipt.logs.filter(e => e.event == 'TransferEvent')[0].args;
      assert.equal(args.from, option.from);
      assert.equal(args.to, receiver);
      assert.equal(args.value, amount);
    }

    async function check_purchase_bonds(count, option, redemption) {
      let receipt = await _acb.purchaseBonds(count, option);
      let args =
          receipt.logs.filter(e => e.event == 'PurchaseBondsEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.count, count);
      assert.equal(args.redemption_timestamp, redemption);
    }

    async function check_redeem_bonds(redemptions, option, count_total) {
      let receipt = await _acb.redeemBonds(redemptions, option);
      let args =
          receipt.logs.filter(e => e.event == 'RedeemBondsEvent')[0].args;
      assert.equal(args.sender, option.from);
      assert.equal(args.count, count_total);
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

    async function get_vote_logs(log_index) {
      const ret = await _logging.getVoteLog(log_index);
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

    async function get_acb_logs(log_index) {
      const ret = await _logging.getACBLog(log_index);
      let acb_log = {};
      acb_log.minted_coins = ret[0];
      acb_log.burned_coins = ret[1];
      acb_log.coin_supply_delta = ret[2];
      acb_log.bond_budget = ret[3];
      acb_log.coin_total_supply = ret[4];
      acb_log.bond_total_supply = ret[5];
      acb_log.oracle_level = ret[6];
      acb_log.current_phase_start = ret[7];
      acb_log.burned_tax = ret[8];
      acb_log.purchased_bonds = ret[9];
      acb_log.redeemed_bonds = ret[10];
      return acb_log;
    }
  });
}

function divide_or_zero(a, b) {
  if (b == 0) {
    return 0;
  }
  return Math.trunc(a / b);
}
