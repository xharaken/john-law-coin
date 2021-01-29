// Copyright 2021 Google LLC
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

const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");
const Oracle = artifacts.require("Oracle");
const OracleForTesting = artifacts.require("OracleForTesting");
const ACB = artifacts.require("ACB");
const ACBForTesting = artifacts.require("ACBForTesting");
const common = require("./common.js");
const should_throw = common.should_throw;
const mod = common.mod;
const randint = common.randint;

contract("ACBSimulator", function (accounts) {
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
                            _bond_redemption_price,
                            _bond_redemption_period,
                            _phase_duration,
                            _proportional_reward_rate,
                            _deposit_rate,
                            _damping_factor,
                            _level_to_exchange_rate,
                            _level_to_bond_price,
                            _reclaim_threshold,
                            _voter_count,
                            _iteration) {
  let test_name = "ACB parameters:" +
      " bond_redemp_price=" + _bond_redemption_price +
      " bond_redemp_period=" + _bond_redemption_period +
      " phase_duration=" + _phase_duration +
      " reward_rate=" + _proportional_reward_rate +
      " deposit_rate=" + _deposit_rate +
      " damping_factor=" + _damping_factor +
      " level_to_exchange_rate=" + _level_to_exchange_rate +
      " level_to_bond_price=" + _level_to_bond_price +
      " reclaim=" + _reclaim_threshold +
      " voter=" + _voter_count +
      " iter=" + _iteration;
  console.log(test_name);
  assert.isTrue(_voter_count <= accounts.length - 1);

  it(test_name, async function () {
    let _level_max = _level_to_exchange_rate.length;

    let _oracle = await OracleForTesting.new(
        {from: accounts[0]});
    common.print_contract_size(_oracle, "OracleForTesting");
    await _oracle.initialize({from: accounts[0]});
    let _acb = await ACBForTesting.new({from: accounts[0]});
    common.print_contract_size(_acb, "ACBForTesting");
    await _acb.initialize(_oracle.address, {from: accounts[0]});
    await _oracle.transferOwnership(_acb.address, {from: accounts[0]});
    await _oracle.overrideConstants(_level_max, _reclaim_threshold,
                                     _proportional_reward_rate);
    await _acb.overrideConstants(_bond_redemption_price,
                                  _bond_redemption_period,
                                  _phase_duration,
                                  _deposit_rate,
                                  _damping_factor,
                                  _level_to_exchange_rate,
                                  _level_to_bond_price,
                                 {from: accounts[0]});

    let _coin = await JohnLawCoin.at(await _acb.coin_());
    let _bond = await JohnLawBond.at(await _acb.bond_());

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

      reset_total() {
        this.total_reveal_hit = 0;
        this.total_reveal_miss = 0;
        this.total_reclaim_hit = 0;
        this.total_reclaim_miss = 0;
        this.supply_increased = 0;
        this.supply_decreased = 0;
        this.supply_nochange = 0;
        this.total_redemption_count = 0;
        this.total_redeem_count = 0;
        this.total_fast_redeem_count = 0;
        this.total_redeem_hit = 0;
        this.total_purchase_hit = 0;
        this.total_mint = 0;
        this.total_lost = 0;
      }

      reset_local() {
        this.reveal_hit = 0;
        this.reveal_miss = 0;
        this.reclaim_hit = 0;
        this.reclaim_miss = 0;
        this.redeem_count = 0;
        this.fast_redeem_count = 0;
        this.redemption_count = 0;
        this.redeem_hit = 0;
        this.purchase_hit = 0;
        this.delta = 0;
        this.mint = 0;
        this.lost = 0;
      }

      update_total() {
        this.total_reveal_hit += this.reveal_hit;
        this.total_reveal_miss += this.reveal_miss;
        this.total_reclaim_hit += this.reclaim_hit;
        this.total_reclaim_miss += this.reclaim_miss;
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
      await _acb.coinMint(_voters[i].address, _voters[i].balance);
      assert.equal(await get_balance(_voters[i].address),
                   _voters[i].balance);
    }
    let initial_coin_supply = await get_coin_supply();

    let epoch = 0;
    for (let iter = 0; iter < _iteration; iter++) {
      if ((await get_coin_supply()) >= initial_coin_supply * 100) {
        break;
      }

      _metrics.reset_local();

      let coin_supply1 = await get_coin_supply();

      await _acb.setTimestamp(
          (await _acb.getTimestamp()).toNumber() + _phase_duration);
      let commit_observed = await vote(epoch);
      if (commit_observed == false) {
        continue;
      }

      epoch += 1;
      let coin_supply2 = await get_coin_supply();
      let bond_supply = await get_bond_supply();
      let bond_budget = (await _acb.bond_budget_()).toNumber();

      await redeem_bonds();
      await purchase_bonds();

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
                    ((await get_coin_supply()) - initial_coin_supply) +
                    " mint=" + _metrics.total_mint +
                    " lost=" + _metrics.total_lost +
                    " bond_supply=" + await get_bond_supply()
                   );
    console.log("================");
    console.log();

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
            bond_budget, parseInt(0.3 * voter.balance / bond_price));
        if (count <= 0) {
          continue;
        }

        assert.equal(await _acb.purchaseBonds.call(
            0, {from: voter.address}), 0);
        assert.equal(await _acb.purchaseBonds.call(
            bond_budget + 1, {from: voter.address}), 0);

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
        for (let redemption in voter.bonds) {
          assert.equal(await get_bond(voter.address, redemption),
                       voter.bonds[redemption]);
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

    async function vote(epoch) {
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
        delta = parseInt(coin_supply *
                           (_level_to_exchange_rate[mode_level] - 10) / 10);
        delta = parseInt(delta * _damping_factor / 100);
      }

      let mint = 0;
      let redeemable_bonds = 0;
      let issued_bonds = 0;
      if (delta >= 0) {
        let necessary_bonds = parseInt(delta / _bond_redemption_price);
        if (necessary_bonds <= bond_supply) {
          redeemable_bonds = necessary_bonds;
        } else {
          redeemable_bonds = bond_supply;
          mint = (necessary_bonds - bond_supply) * _bond_redemption_price;
        }
      } else {
        assert.isTrue(mode_level != _level_max);
        issued_bonds = parseInt(-delta / _level_to_bond_price[mode_level]);
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
        _voters[i].deposit[current] = parseInt(
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

        let reclaimed_deposit = 0;
        if (reclaim_result) {
          reclaimed_deposit = _voters[i].deposit[prev_prev];
        }

        let reward = 0;
        if (reclaim_result &&
            mode_level == _voters[i].revealed_level[prev_prev]) {
          let proportional_reward = 0;
          if (revealed_deposits[mode_level] > 0) {
            proportional_reward = parseInt(
                _proportional_reward_rate * reward_total *
                  _voters[i].deposit[prev_prev] /
                  (100 * revealed_deposits[mode_level]));
          }
          let constant_reward = parseInt(
              (100 - _proportional_reward_rate) * reward_total /
                (100 * revealed_counts[mode_level]));
          reward = proportional_reward + constant_reward;
        }

        _voters[i].balance = (_voters[i].balance -
                              _voters[i].deposit[current] +
                              reclaimed_deposit + reward);
        reclaimed_total += reclaimed_deposit + reward;

        await check_vote(committed_hash,
                         _voters[i].revealed_level[prev],
                         _voters[i].revealed_salt[prev],
                         {from: _voters[i].address},
                         true, reveal_result,
                         reclaimed_deposit + reward, !commit_observed);

        let ret = await _acb.vote.call(committed_hash,
                                       _voters[i].revealed_level[prev],
                                       _voters[i].revealed_salt[prev],
                                       {from: _voters[i].address});
        assert.equal(ret[0], false);
        assert.equal(ret[1], false);
        assert.equal(ret[2], 0);
        assert.equal(ret[3], false);

        assert.equal(await get_balance(_voters[i].address),
                     _voters[i].balance);

        if (reveal_result) {
          _metrics.reveal_hit += 1;
        } else {
          _metrics.reveal_miss += 1;
        }
        if (reclaim_result > 0) {
          _metrics.reclaim_hit += 1;
        } else {
          _metrics.reclaim_miss += 1;
        }
        if (commit_observed == false) {
          assert.equal(await get_bond_supply(), bond_supply);
          if (mode_level == _level_max) {
            assert.equal(await _acb.bond_budget_(), bond_budget);
          } else if (delta >= 0) {
            assert.equal(await _acb.bond_budget_(), -redeemable_bonds);
          } else {
            assert.equal(await _acb.bond_budget_(), issued_bonds);
          }
          assert.equal(await get_coin_supply(),
                       coin_supply + mint -
                       _lost_deposit[mod(epoch - 1, 3)]);
          assert.equal(await _acb.oracle_level_(), mode_level);
          commit_observed = true;

          _metrics.delta = delta;
          _metrics.mint = mint;
          _metrics.lost = _lost_deposit[mod(epoch - 1, 3)];
        } else {
          assert.equal(await _acb.oracle_level_(), mode_level);
          assert.equal(await get_bond_supply(), bond_supply);
          assert.equal(await _acb.bond_budget_(), bond_budget);
        }
      }

      _lost_deposit[mod(epoch, 3)] =  deposit_total + mint - reclaimed_total;
      return commit_observed;
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
      let receipt = await _acb.purchaseBonds(count, option);
      let args =
          receipt.logs.filter(e => e.event == 'PurchaseBondsEvent')[0].args;
      assert.equal(args[0], option.from);
      assert.equal(args[1], count);
      assert.equal(args[2], redemption);
    }

    async function check_redeem_bonds(redemptions, option, count_total) {
      let receipt = await _acb.redeemBonds(redemptions, option);
      let args =
          receipt.logs.filter(e => e.event == 'RedeemBondsEvent')[0].args;
      assert.equal(args[0], option.from);
      for (let i = 0; i < redemptions.length; i++) {
        assert.equal(args[1][i], redemptions[i]);
      }
      assert.equal(args[2], count_total);
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
  });

}

function divide_or_zero(a, b) {
  if (b == 0) {
    return 0;
  }
  return parseInt(a / b);
}
