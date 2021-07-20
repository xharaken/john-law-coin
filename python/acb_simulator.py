#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

from johnlawcoin import *
import unittest, random

def divide_or_zero(a, b):
    if b == 0:
        return 0
    return int(a / b)

class Voter:
    def __init__(self, address):
        self.address = address
        self.committed = [False] * 3
        self.committed_level = [0] * 3
        self.committed_salt = [0] * 3
        self.deposit = [0] * 3
        self.revealed = [False] * 3
        self.oracle_level = [0] * 3
        self.salt = [0] * 3
        self.reclaimed = [False] * 3
        self.bonds = {}
        self.balance = 0


class ACBSimulator(unittest.TestCase):

    def __init__(self,
                 bond_price,
                 bond_redemption_price,
                 bond_redemption_period,
                 bond_redeemable_period,
                 epoch_duration,
                 proportional_reward_rate,
                 deposit_rate,
                 damping_factor,
                 level_to_exchange_rate,
                 reclaim_threshold,
                 voter_count,
                 iteration):
        super().__init__()

        print('bond_price=%d redemp_price=%d redemp_period=%d '
              'redeem_period=%d epoch_dur=%d reward_rate=%d '
              'deposit_rate=%d damping=%d reclaim=%d voter=%d iter=%d' %
              (bond_price,
               bond_redemption_price,
               bond_redemption_period,
               bond_redeemable_period,
               epoch_duration,
               proportional_reward_rate,
               deposit_rate,
               damping_factor,
               reclaim_threshold,
               voter_count,
               iteration))
        print('exchange_rate=', end='')
        print(level_to_exchange_rate)
        self._bond_price = bond_price
        self._bond_redemption_price = bond_redemption_price
        self._bond_redemption_period = bond_redemption_period
        self._bond_redeemable_period = bond_redeemable_period
        self._epoch_duration = epoch_duration
        self._proportional_reward_rate = proportional_reward_rate
        self._deposit_rate = deposit_rate
        self._damping_factor = damping_factor
        self._reclaim_threshold = reclaim_threshold
        self._voter_count = voter_count
        self._iteration = iteration
        self._level_to_exchange_rate = level_to_exchange_rate
        self._level_max = len(level_to_exchange_rate)
               
        self._coin = JohnLawCoin(0)
        self._bond = JohnLawBond()
        self._oracle = Oracle()
        self._logging = Logging()
        self._bond_operation = BondOperation(self._bond)
        self._open_market_operation = OpenMarketOperation()
        self._acb = ACB(self._coin, self._oracle, self._bond_operation,
                       self._open_market_operation, self._logging)
        self._oracle.override_constants_for_testing(
            self._level_max, self._reclaim_threshold,
            self._proportional_reward_rate)
        self._bond_operation.override_constants_for_testing(
            self._bond_price, self._bond_redemption_price,
            self._bond_redemption_period,
            self._bond_redeemable_period)
        self._acb.override_constants_for_testing(
            self._epoch_duration, self._deposit_rate,
            self._damping_factor, self._level_to_exchange_rate)

        self._tax_rate = JohnLawCoin.TAX_RATE
        self._burned = [0] * 3

        self._voters = []
        for i in range(self._voter_count):
            self._voters.append(Voter(i + 1))

        class Metrics:
            def __init__(self):
                self.reset_total()
                self.reset_local()

            def reset_local(self):
                self.reveal_hit = 0
                self.reveal_miss = 0
                self.reclaim_hit = 0
                self.reclaim_miss = 0
                self.reward_hit = 0
                self.reward_miss = 0
                self.redeemed_bonds = 0
                self.fast_redeemed_bonds = 0
                self.expired_bonds = 0
                self.redemption_count = 0
                self.redeem_hit = 0
                self.purchase_hit = 0
                self.purchase_count = 0
                self.delta = 0
                self.mint = 0
                self.lost = 0
                self.tax = 0
                self._oracle_level = 0
                self.deposited = 0
                self.reclaimed = 0
                self.rewarded = 0

            def reset_total(self):
                self.total_reveal_hit = 0
                self.total_reveal_miss = 0
                self.total_reclaim_hit = 0
                self.total_reclaim_miss = 0
                self.total_reward_hit = 0
                self.total_reward_miss = 0
                self.supply_increased = 0
                self.supply_decreased = 0
                self.supply_nochange = 0
                self.total_redemption_count = 0
                self.total_redeemed_bonds = 0
                self.total_fast_redeemed_bonds = 0
                self.total_expired_bonds = 0
                self.total_redeem_hit = 0
                self.total_purchase_hit = 0
                self.total_purchase_count = 0
                self.total_mint = 0
                self.total_lost = 0
                self.total_tax = 0

            def update_total(self):
                self.total_reveal_hit += self.reveal_hit
                self.total_reveal_miss += self.reveal_miss
                self.total_reclaim_hit += self.reclaim_hit
                self.total_reclaim_miss += self.reclaim_miss
                self.total_reward_hit += self.reward_hit
                self.total_reward_miss += self.reward_miss
                if self.delta > 0:
                    self.supply_increased += 1
                elif self.delta < 0:
                    self.supply_decreased += 1
                else:
                    self.supply_nochange += 1
                self.total_redeemed_bonds += self.redeemed_bonds
                self.total_fast_redeemed_bonds += self.fast_redeemed_bonds
                self.total_expired_bonds += self.expired_bonds
                self.total_redemption_count += self.redemption_count
                self.total_redeem_hit += self.redeem_hit
                self.total_purchase_hit += self.purchase_hit
                self.total_purchase_count += self.purchase_count
                self.total_mint += self.mint
                self.total_lost += self.lost
                self.total_tax += self.tax

        self.metrics = Metrics()


    def teardown(self):
        pass

    def run(self):
        for i in range(self._voter_count):
            amount = random.randint(0, self._bond_price * 100)
            if random.randint(0, 9) >= 9:
                amount = 0
            self._voters[i].balance = amount
            self._coin.mint(self._voters[i].address, self._voters[i].balance)
        initial_coin_supply = self._coin.total_supply

        tax = 0
        for i in range(self._iteration):
            if self._coin.total_supply >= initial_coin_supply * 100:
                break

            self.metrics.reset_local()

            coin_supply1 = self._coin.total_supply

            self._acb.set_timestamp(
                self._acb.get_timestamp() + self._epoch_duration)
            commit_observed = self.vote(tax)
            if not commit_observed:
                continue

            epoch_id = self._oracle.epoch_id
            coin_supply2 = self._coin.total_supply
            bond_supply = self._bond.total_supply
            valid_bond_supply = self._bond_operation.valid_bond_supply(epoch_id)
            bond_budget = self._bond_operation.bond_budget
            current_epoch_start = self._acb.current_epoch_start

            self.redeem_bonds()
            self.purchase_bonds()

            epoch_log = self._logging.epoch_logs[epoch_id]
            self.assertEqual(epoch_log.minted_coins, self.metrics.mint)
            self.assertEqual(epoch_log.burned_coins, self.metrics.lost)
            self.assertEqual(epoch_log.coin_supply_delta, self.metrics.delta)
            self.assertEqual(epoch_log.bond_budget, bond_budget)
            self.assertEqual(epoch_log.total_coin_supply, coin_supply2)
            self.assertEqual(epoch_log.total_bond_supply, bond_supply)
            self.assertEqual(epoch_log.valid_bond_supply, valid_bond_supply)
            self.assertEqual(epoch_log.oracle_level, self.metrics.oracle_level)
            self.assertEqual(epoch_log.current_epoch_start,
                             self._acb.get_timestamp())
            self.assertEqual(epoch_log.tax, tax)
            bond_log = self._logging.bond_logs[epoch_id]
            self.assertEqual(bond_log.purchased_bonds,
                             self.metrics.purchase_count)
            self.assertEqual(bond_log.redeemed_bonds,
                             self.metrics.redeemed_bonds)
            self.assertEqual(bond_log.expired_bonds,
                             self.metrics.expired_bonds)
            vote_log = self._logging.vote_logs[epoch_id]
            self.assertEqual(vote_log.commit_succeeded,
                             self.metrics.reveal_hit + self.metrics.reveal_miss)
            self.assertEqual(vote_log.deposited, self.metrics.deposited)
            self.assertEqual(vote_log.commit_failed, 0)
            self.assertEqual(vote_log.reveal_succeeded, self.metrics.reveal_hit)
            self.assertEqual(vote_log.reveal_failed, self.metrics.reveal_miss)
            self.assertEqual(vote_log.reclaim_succeeded,
                             self.metrics.reclaim_hit)
            self.assertEqual(vote_log.reward_succeeded,
                             self.metrics.reward_hit)
            self.assertEqual(vote_log.reclaimed, self.metrics.reclaimed)
            self.assertEqual(vote_log.rewarded, self.metrics.rewarded)

            tax = self.transfer_coins()

            if False:
                print('epoch=%d reveal_hit=%d/%d=%d%% reclaim_hit=%d/%d=%d%% '
                      'reward_hit=%d/%d=%d%% purchase_hit=%d/%d=%d%% '
                      'redeem_hit=%d/%d=%d%% '
                      'redemptions=%d/%d=%d%% fast_redeem=%d/%d=%d%% '
                      'expired=%d '
                      'delta=%d mint=%d lost=%d coin_supply=%d->%d->%d=%d '
                      'bond_supply=%d->%d valid_bond_supply=%d->%d '
                      'bond_budget=%d->%d tax=%d' %
                      (self._oracle.epoch_id,
                       self.metrics.reveal_hit,
                       self.metrics.reveal_hit + self.metrics.reveal_miss,
                       divide_or_zero(100 * self.metrics.reveal_hit,
                                      self.metrics.reveal_hit +
                                      self.metrics.reveal_miss),
                       self.metrics.reclaim_hit,
                       self.metrics.reclaim_hit + self.metrics.reclaim_miss,
                       divide_or_zero(100 * self.metrics.reclaim_hit,
                                      self.metrics.reclaim_hit +
                                      self.metrics.reclaim_miss),
                       self.metrics.reward_hit,
                       self.metrics.reward_hit + self.metrics.reward_miss,
                       divide_or_zero(100 * self.metrics.reward_hit,
                                      self.metrics.reward_hit +
                                      self.metrics.reward_miss),
                       self.metrics.purchase_hit,
                       self._voter_count,
                       divide_or_zero(100 * self.metrics.purchase_hit,
                                      self._voter_count),
                       self.metrics.redeem_hit,
                       self._voter_count,
                       divide_or_zero(100 * self.metrics.redeem_hit,
                                      self._voter_count),
                       self.metrics.redemption_count,
                       self.metrics.redeem_hit,
                       divide_or_zero(100 * self.metrics.redemption_count,
                                      self.metrics.redeem_hit),
                       self.metrics.fast_redeemed_bonds,
                       self.metrics.redeemed_bonds,
                       divide_or_zero(100 * self.metrics.fast_redeemed_bonds,
                                      self.metrics.redeemed_bonds),
                       self.metrics.expired_bonds,
                       self.metrics.delta,
                       self.metrics.mint,
                       self.metrics.lost,
                       coin_supply1,
                       coin_supply2,
                       self._coin.total_supply,
                       self._coin.total_supply - coin_supply1,
                       bond_supply,
                       self._bond.total_supply,
                       valid_bond_supply,
                       self._bond_operation.valid_bond_supply(epoch_id),
                       bond_budget,
                       self._bond_operation.bond_budget,
                       self.metrics.tax
                       ))
            self.metrics.update_total()

        print("================")
        print('epoch=%d reveal_hit=%d/%d=%d%% reclaim_hit=%d/%d=%d%% '
              'reward_hit=%d/%d=%d%% '
              'purchase_hit=%d/%d=%d%% redeem_hit=%d/%d=%d%% '
              'redemptions=%d/%d=%d%% fast_redeem=%d/%d=%d%% expired=%d '
              'supply=%d/%d/%d coin_supply=%d%% mint=%d lost=%d '
              'bond_supply=%d valid_bond_supply=%d tax=%d' %
              (self._oracle.epoch_id,
               self.metrics.total_reveal_hit,
               self.metrics.total_reveal_hit + self.metrics.total_reveal_miss,
               divide_or_zero(100 * self.metrics.total_reveal_hit,
                              (self.metrics.total_reveal_hit +
                               self.metrics.total_reveal_miss)),
               self.metrics.total_reclaim_hit,
               self.metrics.total_reclaim_hit + self.metrics.total_reclaim_miss,
               divide_or_zero(100 * self.metrics.total_reclaim_hit,
                              (self.metrics.total_reclaim_hit +
                               self.metrics.total_reclaim_miss)),
               self.metrics.total_reward_hit,
               self.metrics.total_reward_hit + self.metrics.total_reward_miss,
               divide_or_zero(100 * self.metrics.total_reward_hit,
                              (self.metrics.total_reward_hit +
                               self.metrics.total_reward_miss)),
               self.metrics.total_purchase_hit,
               self._voter_count * self._iteration,
               divide_or_zero(100 * self.metrics.total_purchase_hit,
                              self._voter_count * self._iteration),
               self.metrics.total_redeem_hit,
               self._voter_count * self._iteration,
               divide_or_zero(100 * self.metrics.total_redeem_hit,
                              self._voter_count * self._iteration),
               self.metrics.total_redemption_count,
               self.metrics.total_redeem_hit,
               divide_or_zero(100 * self.metrics.total_redemption_count,
                              self.metrics.total_redeem_hit),
               self.metrics.total_fast_redeemed_bonds,
               self.metrics.total_redeemed_bonds,
               divide_or_zero(100 * self.metrics.total_fast_redeemed_bonds,
                              self.metrics.total_redeemed_bonds),
               self.metrics.total_expired_bonds,
               self.metrics.supply_increased,
               self.metrics.supply_nochange,
               self.metrics.supply_decreased,
               self._coin.total_supply / initial_coin_supply * 100,
               self.metrics.total_mint,
               self.metrics.total_lost,
               self._bond.total_supply,
               self._bond_operation.valid_bond_supply(self._oracle.epoch_id),
               self.metrics.total_tax
               ))
        print("================")
        print()

    def transfer_coins(self):
        start_index = random.randint(0, self._voter_count - 1)
        tax_total = 0
        for index in range(min(self._voter_count, 10)):
            sender = self._voters[(start_index + index) % self._voter_count]
            receiver = self._voters[
                (start_index + index + 1) % self._voter_count]
            transfer = random.randint(
                0, min(self._coin.balance_of(sender.address), 10000))
            tax = int(transfer * self._tax_rate / 100)
            balance_sender = self._coin.balance_of(sender.address)
            balance_receiver = self._coin.balance_of(receiver.address)
            balance_tax = self._coin.balance_of(self._coin.tax_account)
            self._coin.transfer(sender.address, receiver.address, transfer)
            if sender != receiver:
                self.assertEqual(self._coin.balance_of(sender.address),
                                 balance_sender - transfer)
                self.assertEqual(self._coin.balance_of(receiver.address),
                                 balance_receiver + transfer - tax)
            else:
                self.assertEqual(self._coin.balance_of(sender.address),
                                 balance_receiver - tax)
            self.assertEqual(self._coin.balance_of(self._coin.tax_account),
                             balance_tax + tax)
            sender.balance -= transfer
            receiver.balance += transfer - tax
            tax_total += tax
        self.metrics.tax = tax_total
        return tax_total

    def purchase_bonds(self):
        epoch_id = self._oracle.epoch_id
        start_index = random.randint(0, self._voter_count - 1)
        for index in range(self._voter_count):
            bond_budget = self._bond_operation.bond_budget
            if bond_budget <= 0:
                continue

            bond_price = self._bond_price
            voter = self._voters[(start_index + index) % self._voter_count]
            count = min(self._bond_operation.bond_budget,
                        int(0.3 * voter.balance / bond_price))
            if count <= 0:
                continue

            with self.assertRaises(Exception):
                self._acb.purchase_bonds(voter.address, 0)
            with self.assertRaises(Exception):
                self._acb.purchase_bonds(voter.address,
                                   self._bond_operation.bond_budget + 1)

            coin_supply = self._coin.total_supply
            bond_supply = self._bond.total_supply
            valid_bond_supply = self._bond_operation.valid_bond_supply(epoch_id)
            redemption = (epoch_id + self._bond_redemption_period)
            if redemption in voter.bonds:
                voter.bonds[redemption] += count
            else:
                voter.bonds[redemption] = count
            voter.balance -= bond_price * count

            self.assertEqual(self._acb.purchase_bonds(voter.address, count),
                             redemption)
            self.assertEqual(self._coin.balance_of(voter.address),
                             voter.balance)
            self.assertEqual(self._coin.total_supply,
                             coin_supply - bond_price * count)
            self.assertEqual(self._bond.total_supply,
                             bond_supply + count)
            self.assertEqual(self._bond_operation.valid_bond_supply(epoch_id),
                             valid_bond_supply + count)
            self.assertEqual(self._bond_operation.bond_budget,
                             bond_budget - count)
            self.assertEqual(self._bond.balance_of(voter.address, redemption),
                             voter.bonds[redemption])

            self.metrics.purchase_hit += 1
            self.metrics.purchase_count += count

    def redeem_bonds(self):
        epoch_id = self._oracle.epoch_id
        start_index = random.randint(0, self._voter_count - 1)
        for index in range(self._voter_count):
            if random.randint(0, 9) >= 9:
                continue

            voter = self._voters[(start_index + index) % self._voter_count]

            redemptions = list(voter.bonds.keys())
            if len(redemptions) == 0:
                continue

            fast_redeemed_bonds = 0
            redeemed_bonds = 0
            expired_bonds = 0
            bond_budget = self._bond_operation.bond_budget
            for redemption in redemptions:
                count = voter.bonds[redemption]
                if epoch_id < redemption:
                    if bond_budget >= 0:
                        continue
                    count = min(count, -bond_budget)
                    fast_redeemed_bonds += count
                if (epoch_id <
                    redemption + self._bond_redeemable_period):
                    redeemed_bonds += count
                    bond_budget += count
                else:
                    expired_bonds += count
                voter.bonds[redemption] -= count
                assert(voter.bonds[redemption] >= 0)
                if voter.bonds[redemption] == 0:
                    del voter.bonds[redemption]
            voter.balance += (
                self._bond_redemption_price * redeemed_bonds)

            coin_supply = self._coin.total_supply
            bond_supply = self._bond.total_supply
            valid_bond_supply = self._bond_operation.valid_bond_supply(epoch_id)
            self.assertEqual(
                self._acb.redeem_bonds(
                    voter.address, redemptions), redeemed_bonds)
            self.assertEqual(self._bond_operation.bond_budget, bond_budget)
            self.assertEqual(self._coin.balance_of(voter.address),
                             voter.balance)

            bond_count = self._bond.number_of_redemption_epochs_owned_by(
                voter.address)
            self.assertEqual(len(voter.bonds), bond_count)
            for index in range(bond_count):
                redemption = self._bond.get_redemption_epoch_owned_by(
                    voter.address, index)
                self.assertTrue(redemption in voter.bonds)
                self.assertEqual(
                    self._bond.balance_of(voter.address, redemption),
                    voter.bonds[redemption])

            self.assertEqual(self._bond.total_supply,
                             bond_supply - redeemed_bonds - expired_bonds)
            self.assertEqual(self._bond_operation.valid_bond_supply(epoch_id),
                             valid_bond_supply - redeemed_bonds)
            self.assertEqual(self._coin.total_supply,
                             coin_supply + self._bond_redemption_price *
                             redeemed_bonds)

            self.metrics.fast_redeemed_bonds += fast_redeemed_bonds
            self.metrics.expired_bonds += expired_bonds
            self.metrics.redeemed_bonds += redeemed_bonds
            self.metrics.redemption_count += len(redemptions)
            self.metrics.redeem_hit += 1


    def vote(self, tax):
        _voters = self._voters
        
        epoch_id = self._oracle.epoch_id
        current = epoch_id % 3
        prev = (epoch_id - 1) % 3
        prev_prev = (epoch_id - 2) % 3

        revealed_deposits = [0] * self._level_max
        revealed_counts = [0] * self._level_max
        for i in range(len(_voters)):
            if (_voters[i].committed[prev_prev] and
                _voters[i].revealed[prev_prev] and
                _voters[i].oracle_level[prev_prev] ==
                _voters[i].committed_level[prev_prev] and
                0 <= _voters[i].oracle_level[prev_prev] and
                _voters[i].oracle_level[prev_prev] < self._level_max and
                _voters[i].salt[prev_prev] ==
                _voters[i].committed_salt[prev_prev]):
                level = _voters[i].oracle_level[prev_prev]
                revealed_deposits[level] += _voters[i].deposit[prev_prev]
                revealed_counts[level] += 1

        mode_level = self._level_max
        max_deposit = 0
        max_count = 0
        for level in range(self._level_max):
            if (revealed_counts[level] > 0 and
                (mode_level == self._level_max or
                 max_deposit < revealed_deposits[level] or
                 (max_deposit == revealed_deposits[level] and
                  max_count < revealed_counts[level]))):
                max_deposit = revealed_deposits[level]
                max_count = revealed_counts[level]
                mode_level = level

        deposit_total = 0
        deposit_to_be_reclaimed = 0
        for i in range(len(_voters)):
            if _voters[i].committed[prev_prev]:
                deposit_total += _voters[i].deposit[prev_prev]
            if (_voters[i].committed[prev_prev] and
                _voters[i].revealed[prev_prev] and
                _voters[i].oracle_level[prev_prev] ==
                _voters[i].committed_level[prev_prev] and
                0 <= _voters[i].oracle_level[prev_prev] and
                _voters[i].oracle_level[prev_prev] < self._level_max and
                _voters[i].salt[prev_prev] ==
                _voters[i].committed_salt[prev_prev] and
                (abs(_voters[i].oracle_level[prev_prev] - mode_level) <=
                 self._reclaim_threshold)):
                deposit_to_be_reclaimed += _voters[i].deposit[prev_prev]
        assert(deposit_to_be_reclaimed <= deposit_total)
        if mode_level == self._level_max:
            assert(deposit_to_be_reclaimed == 0)

        target_level = random.randint(0, self._level_max - 1)
        #target_level = int(epoch_id / 6) % 3
        #target_level = epoch_id % 3

        reward_total = deposit_total - deposit_to_be_reclaimed + tax
        reclaimed_total = 0
        commit_observed = False
        for i in range(len(_voters)):
            _voters[i].committed[current] = False
            _voters[i].committed_level[current] = 0
            _voters[i].committed_salt[current] = 0
            _voters[i].deposit[current] = 0
            _voters[i].revealed[current] = False
            _voters[i].oracle_level[current] = 0
            _voters[i].salt[current] = 0
            _voters[i].reclaimed[current] = False

            _voters[i].committed[current] = (random.randint(0, 99) < 99)
            if not _voters[i].committed[current]:
                continue

            rand = random.randint(0, 9)
            if rand < 5:
                _voters[i].committed_level[current] = target_level
            elif rand < 7:
                _voters[i].committed_level[current] = (
                    (target_level - 1) % self._level_max)
            elif rand < 9:
                _voters[i].committed_level[current] = (
                    (target_level + 1) % self._level_max)
            else:
                _voters[i].committed_level[current] = random.randint(
                    0, self._level_max)

            _voters[i].committed_salt[current] = random.randint(0, 10)
            hash = Oracle.encrypt(
                _voters[i].address,
                _voters[i].committed_level[current],
                _voters[i].committed_salt[current])
            _voters[i].deposit[current] = int(
                _voters[i].balance * self._deposit_rate / 100)

            _voters[i].revealed[prev] = True
            if random.randint(0, 99) < 97:
                _voters[i].oracle_level[prev] = _voters[i].committed_level[prev]
            else:
                _voters[i].oracle_level[prev] = random.randint(
                    0, self._level_max)
            if random.randint(0, 99) < 97:
                _voters[i].salt[prev] = _voters[i].committed_salt[prev]
            else:
                _voters[i].salt[prev] = random.randint(0, 10)

            _voters[i].reclaimed[prev_prev] = True

            reveal_result = (
                _voters[i].committed[prev] and
                _voters[i].oracle_level[prev] ==
                _voters[i].committed_level[prev] and
                0 <= _voters[i].oracle_level[prev] and
                _voters[i].oracle_level[prev] < self._level_max and
                _voters[i].salt[prev] ==
                _voters[i].committed_salt[prev])

            reclaim_result = (
                _voters[i].committed[prev_prev] and
                _voters[i].revealed[prev_prev] and
                _voters[i].oracle_level[prev_prev] ==
                _voters[i].committed_level[prev_prev] and
                0 <= _voters[i].oracle_level[prev_prev] and
                _voters[i].oracle_level[prev_prev] < self._level_max and
                _voters[i].salt[prev_prev] ==
                _voters[i].committed_salt[prev_prev] and
                (abs(_voters[i].oracle_level[prev_prev] - mode_level) <=
                 self._reclaim_threshold))

            coin_supply = self._coin.total_supply
            bond_supply = self._bond.total_supply
            bond_budget = self._bond_operation.bond_budget

            reclaimed = 0
            if reclaim_result:
                reclaimed = _voters[i].deposit[prev_prev]

            reward = 0
            if (reclaim_result and
                mode_level == _voters[i].oracle_level[prev_prev]):
                proportional_reward = 0
                if revealed_deposits[mode_level] > 0:
                    proportional_reward = int(
                        self._proportional_reward_rate * reward_total *
                        _voters[i].deposit[prev_prev] /
                        (100 * revealed_deposits[mode_level]))
                constant_reward = int(
                    (100 - self._proportional_reward_rate) * reward_total /
                    (100 * revealed_counts[mode_level]))
                reward = proportional_reward + constant_reward

            _voters[i].balance = (_voters[i].balance -
                                 _voters[i].deposit[current] +
                                 reclaimed + reward)
            reclaimed_total += reclaimed + reward

            self.assertEqual(self._acb.vote(_voters[i].address,
                                      hash,
                                      _voters[i].oracle_level[prev],
                                      _voters[i].salt[prev]),
                             (True, reveal_result, _voters[i].deposit[current],
                              reclaimed, reward, not commit_observed))

            self.assertEqual(self._coin.balance_of(_voters[i].address),
                             _voters[i].balance)
            self.assertEqual(self._acb.current_epoch_start,
                             self._acb.get_timestamp())

            self.metrics.deposited += _voters[i].deposit[current]
            self.metrics.reclaimed += reclaimed
            self.metrics.rewarded += reward

            if reveal_result:
                self.metrics.reveal_hit += 1
            else:
                self.metrics.reveal_miss += 1
            if reclaimed > 0:
                self.metrics.reclaim_hit += 1
            else:
                self.metrics.reclaim_miss += 1
            if reward > 0:
                self.metrics.reward_hit += 1
            else:
                self.metrics.reward_miss += 1

            if not commit_observed:
                delta = 0
                if mode_level != self._level_max:
                    delta = int(
                        self._coin.total_supply *
                        (self._level_to_exchange_rate[mode_level] - 10) / 10)
                    delta = int(delta * self._damping_factor / 100)

                new_epoch_id = self._oracle.epoch_id
                mint = 0
                redeemable_bonds = 0
                issued_bonds = 0
                if delta >= 0:
                    necessary_bonds = int(
                        delta / self._bond_redemption_price)
                    valid_bond_supply = self._bond_operation.valid_bond_supply(
                        new_epoch_id)
                    if necessary_bonds <= valid_bond_supply:
                        redeemable_bonds = necessary_bonds
                    else:
                        redeemable_bonds = valid_bond_supply
                        mint = ((necessary_bonds - redeemable_bonds) *
                                self._bond_redemption_price)
                else:
                    issued_bonds = int(-delta / self._bond_price)

                self.assertEqual(self._bond.total_supply, bond_supply)
                if mode_level == self._level_max:
                    self.assertEqual(self._bond_operation.bond_budget, 0)
                elif delta >= 0:
                    self.assertEqual(
                        self._bond_operation.bond_budget, -redeemable_bonds)
                else:
                    self.assertEqual(
                        self._bond_operation.bond_budget, issued_bonds)
                self.assertEqual(
                    self._coin.total_supply,
                    coin_supply - self._burned[(new_epoch_id - 2) % 3])
                self.assertEqual(self._acb.oracle_level, mode_level)
                commit_observed = True

                self.metrics.delta = delta
                self.metrics.mint = mint
                self.metrics.lost = self._burned[(new_epoch_id - 2) % 3]
                self.metrics.oracle_level = mode_level
            else:
                self.assertEqual(self._acb.oracle_level, mode_level)
                self.assertEqual(self._bond.total_supply, bond_supply)
                self.assertEqual(self._bond_operation.bond_budget, bond_budget)

        self._burned[epoch_id % 3] = deposit_total + tax - reclaimed_total
        return commit_observed


def main():
    iteration = 1000

    test = ACBSimulator(
        996,
        1000,
        12,
        2,
        7,
        90,
        10,
        10,
        [6, 7, 8, 9, 10, 11, 12, 13, 14],
        1,
        200,
        iteration)
    test.run()
    test.teardown()

    for (bond_price, bond_redemption_price) in [
            (1, 3), (996, 1000), (1000, 1000)]:
        for bond_redemption_period in [1, 12]:
            for bond_redeemable_period in [1, 2, 12]:
                for epoch_duration in [1, 7 * 24 * 60 * 60]:
                    for proportional_reward_rate in [0, 90, 100]:
                        for deposit_rate in [0, 10, 100]:
                            for damping_factor in [10, 100]:
                                for level_to_exchange_rate in [
                                        [9, 11, 12],
                                        [0, 1, 10, 11, 12],
                                        [6, 7, 8, 9, 10, 11, 12, 13, 14]]:
                                    for reclaim_threshold in [0, 1, len(
                                            level_to_exchange_rate) - 1]:
                                        for voter_count in [1, 200]:
                                            test = ACBSimulator(
                                                bond_price,
                                                bond_redemption_price,
                                                bond_redemption_period,
                                                bond_redeemable_period,
                                                epoch_duration,
                                                proportional_reward_rate,
                                                deposit_rate,
                                                damping_factor,
                                                level_to_exchange_rate,
                                                reclaim_threshold,
                                                voter_count,
                                                iteration)
                                            test.run()
                                            test.teardown()


if __name__ == "__main__":
    main()
