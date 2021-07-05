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

        coin = JohnLawCoin(0)
        self.bond = JohnLawBond()
        self.oracle = Oracle()
        self.logging = Logging()
        self.bond_operation = BondOperation(self.bond)
        self.acb = ACB(coin, self.oracle, self.bond_operation, self.logging)
        level_max = len(level_to_exchange_rate)
        self.oracle.override_constants_for_testing(
            level_max, reclaim_threshold, proportional_reward_rate)
        self.bond_operation.override_constants_for_testing(
            bond_price, bond_redemption_price, bond_redemption_period,
            bond_redeemable_period)
        self.acb.override_constants_for_testing(
            epoch_duration, deposit_rate, damping_factor,
            level_to_exchange_rate)

        self.tax_rate = JohnLawCoin.TAX_RATE
        self.burned = [0] * 3
        self.iteration = iteration

        self.voter_count = voter_count
        self.voters = []
        for i in range(self.voter_count):
            self.voters.append(Voter(i + 1))

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
                self.oracle_level = 0
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
        acb = self.acb
        logging = self.logging

        for i in range(self.voter_count):
            amount = random.randint(0, BondOperation.BOND_PRICE * 100)
            if random.randint(0, 9) >= 9:
                amount = 0
            self.voters[i].balance = amount
            acb.coin.mint(self.voters[i].address, self.voters[i].balance)
        initial_coin_supply = acb.coin.total_supply

        tax = 0
        for i in range(self.iteration):
            if acb.coin.total_supply >= initial_coin_supply * 100:
                break

            self.metrics.reset_local()

            coin_supply1 = acb.coin.total_supply

            acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
            commit_observed = self.vote(tax)
            if not commit_observed:
                continue

            epoch_id = acb.oracle.epoch_id
            coin_supply2 = acb.coin.total_supply
            bond_supply = self.bond.total_supply
            valid_bond_supply = self.bond_operation.valid_bond_supply(epoch_id)
            bond_budget = self.bond_operation.bond_budget
            current_epoch_start = acb.current_epoch_start

            self.redeem_bonds()
            self.purchase_bonds()

            epoch_log = logging.epoch_logs[epoch_id]
            self.assertEqual(epoch_log.minted_coins, self.metrics.mint)
            self.assertEqual(epoch_log.burned_coins, self.metrics.lost)
            self.assertEqual(epoch_log.coin_supply_delta, self.metrics.delta)
            self.assertEqual(epoch_log.bond_budget, bond_budget)
            self.assertEqual(epoch_log.total_coin_supply, coin_supply2)
            self.assertEqual(epoch_log.total_bond_supply, bond_supply)
            self.assertEqual(epoch_log.valid_bond_supply, valid_bond_supply)
            self.assertEqual(epoch_log.oracle_level, self.metrics.oracle_level)
            self.assertEqual(epoch_log.current_epoch_start, acb.get_timestamp())
            self.assertEqual(epoch_log.tax, tax)
            bond_log = logging.bond_logs[epoch_id]
            self.assertEqual(bond_log.purchased_bonds,
                             self.metrics.purchase_count)
            self.assertEqual(bond_log.redeemed_bonds,
                             self.metrics.redeemed_bonds)
            self.assertEqual(bond_log.expired_bonds,
                             self.metrics.expired_bonds)
            vote_log = logging.vote_logs[epoch_id]
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
                      (self.oracle.epoch_id,
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
                       self.voter_count,
                       divide_or_zero(100 * self.metrics.purchase_hit,
                                      self.voter_count),
                       self.metrics.redeem_hit,
                       self.voter_count,
                       divide_or_zero(100 * self.metrics.redeem_hit,
                                      self.voter_count),
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
                       acb.coin.total_supply,
                       acb.coin.total_supply - coin_supply1,
                       bond_supply,
                       self.bond.total_supply,
                       valid_bond_supply,
                       self.bond_operation.valid_bond_supply(epoch_id),
                       bond_budget,
                       self.bond_operation.bond_budget,
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
              (self.oracle.epoch_id,
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
               self.voter_count * self.iteration,
               divide_or_zero(100 * self.metrics.total_purchase_hit,
                              self.voter_count * self.iteration),
               self.metrics.total_redeem_hit,
               self.voter_count * self.iteration,
               divide_or_zero(100 * self.metrics.total_redeem_hit,
                              self.voter_count * self.iteration),
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
               acb.coin.total_supply / initial_coin_supply * 100,
               self.metrics.total_mint,
               self.metrics.total_lost,
               self.bond.total_supply,
               self.bond_operation.valid_bond_supply(acb.oracle.epoch_id),
               self.metrics.total_tax
               ))
        print("================")
        print()

    def transfer_coins(self):
        acb = self.acb

        start_index = random.randint(0, self.voter_count - 1)
        tax_total = 0
        for index in range(min(self.voter_count, 10)):
            sender = self.voters[(start_index + index) % self.voter_count]
            receiver = self.voters[(start_index + index + 1) % self.voter_count]
            transfer = random.randint(
                0, min(acb.coin.balance_of(sender.address), 10000))
            tax = int(transfer * self.tax_rate / 100)
            balance_sender = acb.coin.balance_of(sender.address)
            balance_receiver = acb.coin.balance_of(receiver.address)
            balance_tax = acb.coin.balance_of(acb.coin.tax_account)
            acb.coin.transfer(sender.address, receiver.address, transfer)
            if sender != receiver:
                self.assertEqual(acb.coin.balance_of(sender.address),
                                 balance_sender - transfer)
                self.assertEqual(acb.coin.balance_of(receiver.address),
                                 balance_receiver + transfer - tax)
            else:
                self.assertEqual(acb.coin.balance_of(sender.address),
                                 balance_receiver - tax)
            self.assertEqual(acb.coin.balance_of(acb.coin.tax_account),
                             balance_tax + tax)
            sender.balance -= transfer
            receiver.balance += transfer - tax
            tax_total += tax
        self.metrics.tax = tax_total
        return tax_total

    def purchase_bonds(self):
        acb = self.acb

        epoch_id = acb.oracle.epoch_id
        start_index = random.randint(0, self.voter_count - 1)
        for index in range(self.voter_count):
            bond_budget = self.bond_operation.bond_budget
            if bond_budget <= 0:
                continue

            bond_price = BondOperation.BOND_PRICE
            voter = self.voters[(start_index + index) % self.voter_count]
            count = min(self.bond_operation.bond_budget,
                        int(0.3 * voter.balance / bond_price))
            if count <= 0:
                continue

            with self.assertRaises(Exception):
                acb.purchase_bonds(voter.address, 0)
            with self.assertRaises(Exception):
                acb.purchase_bonds(voter.address,
                                   self.bond_operation.bond_budget + 1)

            coin_supply = acb.coin.total_supply
            bond_supply = self.bond.total_supply
            valid_bond_supply = self.bond_operation.valid_bond_supply(epoch_id)
            redemption = (epoch_id + BondOperation.BOND_REDEMPTION_PERIOD)
            if redemption in voter.bonds:
                voter.bonds[redemption] += count
            else:
                voter.bonds[redemption] = count
            voter.balance -= bond_price * count

            self.assertEqual(acb.purchase_bonds(voter.address, count),
                             redemption)
            self.assertEqual(acb.coin.balance_of(voter.address), voter.balance)
            self.assertEqual(acb.coin.total_supply,
                             coin_supply - bond_price * count)
            self.assertEqual(self.bond.total_supply,
                             bond_supply + count)
            self.assertEqual(self.bond_operation.valid_bond_supply(epoch_id),
                             valid_bond_supply + count)
            self.assertEqual(self.bond_operation.bond_budget,
                             bond_budget - count)
            self.assertEqual(self.bond.balance_of(voter.address, redemption),
                             voter.bonds[redemption])

            self.metrics.purchase_hit += 1
            self.metrics.purchase_count += count

    def redeem_bonds(self):
        acb = self.acb

        epoch_id = acb.oracle.epoch_id
        start_index = random.randint(0, self.voter_count - 1)
        for index in range(self.voter_count):
            if random.randint(0, 9) >= 9:
                continue

            voter = self.voters[(start_index + index) % self.voter_count]

            redemptions = list(voter.bonds.keys())
            if len(redemptions) == 0:
                continue

            fast_redeemed_bonds = 0
            redeemed_bonds = 0
            expired_bonds = 0
            bond_budget = self.bond_operation.bond_budget
            for redemption in redemptions:
                count = voter.bonds[redemption]
                if epoch_id < redemption:
                    if bond_budget >= 0:
                        continue
                    count = min(count, -bond_budget)
                    fast_redeemed_bonds += count
                if (epoch_id <
                    redemption + BondOperation.BOND_REDEEMABLE_PERIOD):
                    redeemed_bonds += count
                    bond_budget += count
                else:
                    expired_bonds += count
                voter.bonds[redemption] -= count
                assert(voter.bonds[redemption] >= 0)
                if voter.bonds[redemption] == 0:
                    del voter.bonds[redemption]
            voter.balance += (
                BondOperation.BOND_REDEMPTION_PRICE * redeemed_bonds)

            coin_supply = acb.coin.total_supply
            bond_supply = self.bond.total_supply
            valid_bond_supply = self.bond_operation.valid_bond_supply(epoch_id)
            self.assertEqual(
                acb.redeem_bonds(voter.address, redemptions), redeemed_bonds)
            self.assertEqual(self.bond_operation.bond_budget, bond_budget)
            self.assertEqual(acb.coin.balance_of(voter.address), voter.balance)

            bond_count = self.bond.number_of_redemption_epochs_owned_by(
                voter.address)
            self.assertEqual(len(voter.bonds), bond_count)
            for index in range(bond_count):
                redemption = self.bond.get_redemption_epoch_owned_by(
                    voter.address, index)
                self.assertTrue(redemption in voter.bonds)
                self.assertEqual(
                    self.bond.balance_of(voter.address, redemption),
                    voter.bonds[redemption])

            self.assertEqual(self.bond.total_supply,
                             bond_supply - redeemed_bonds - expired_bonds)
            self.assertEqual(self.bond_operation.valid_bond_supply(epoch_id),
                             valid_bond_supply - redeemed_bonds)
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + BondOperation.BOND_REDEMPTION_PRICE *
                             redeemed_bonds)

            self.metrics.fast_redeemed_bonds += fast_redeemed_bonds
            self.metrics.expired_bonds += expired_bonds
            self.metrics.redeemed_bonds += redeemed_bonds
            self.metrics.redemption_count += len(redemptions)
            self.metrics.redeem_hit += 1


    def vote(self, tax):
        acb = self.acb
        voters = self.voters
        epoch_id = self.oracle.epoch_id
        current = epoch_id % 3
        prev = (epoch_id - 1) % 3
        prev_prev = (epoch_id - 2) % 3

        revealed_deposits = [0] * Oracle.LEVEL_MAX
        revealed_counts = [0] * Oracle.LEVEL_MAX
        for i in range(len(voters)):
            if (voters[i].committed[prev_prev] and
                voters[i].revealed[prev_prev] and
                voters[i].oracle_level[prev_prev] ==
                voters[i].committed_level[prev_prev] and
                0 <= voters[i].oracle_level[prev_prev] and
                voters[i].oracle_level[prev_prev] < Oracle.LEVEL_MAX and
                voters[i].salt[prev_prev] ==
                voters[i].committed_salt[prev_prev]):
                level = voters[i].oracle_level[prev_prev]
                revealed_deposits[level] += voters[i].deposit[prev_prev]
                revealed_counts[level] += 1

        mode_level = Oracle.LEVEL_MAX
        max_deposit = 0
        max_count = 0
        for level in range(Oracle.LEVEL_MAX):
            if (revealed_counts[level] > 0 and
                (mode_level == Oracle.LEVEL_MAX or
                 max_deposit < revealed_deposits[level] or
                 (max_deposit == revealed_deposits[level] and
                  max_count < revealed_counts[level]))):
                max_deposit = revealed_deposits[level]
                max_count = revealed_counts[level]
                mode_level = level

        deposit_total = 0
        deposit_to_be_reclaimed = 0
        for i in range(len(voters)):
            if voters[i].committed[prev_prev]:
                deposit_total += voters[i].deposit[prev_prev]
            if (voters[i].committed[prev_prev] and
                voters[i].revealed[prev_prev] and
                voters[i].oracle_level[prev_prev] ==
                voters[i].committed_level[prev_prev] and
                0 <= voters[i].oracle_level[prev_prev] and
                voters[i].oracle_level[prev_prev] < Oracle.LEVEL_MAX and
                voters[i].salt[prev_prev] ==
                voters[i].committed_salt[prev_prev] and
                (abs(voters[i].oracle_level[prev_prev] - mode_level) <=
                 Oracle.RECLAIM_THRESHOLD)):
                deposit_to_be_reclaimed += voters[i].deposit[prev_prev]
        assert(deposit_to_be_reclaimed <= deposit_total)
        if mode_level == Oracle.LEVEL_MAX:
            assert(deposit_to_be_reclaimed == 0)

        target_level = random.randint(0, Oracle.LEVEL_MAX - 1)
        #target_level = int(epoch_id / 6) % 3
        #target_level = epoch_id % 3

        reward_total = deposit_total - deposit_to_be_reclaimed + tax
        reclaimed_total = 0
        commit_observed = False
        for i in range(len(voters)):
            voters[i].committed[current] = False
            voters[i].committed_level[current] = 0
            voters[i].committed_salt[current] = 0
            voters[i].deposit[current] = 0
            voters[i].revealed[current] = False
            voters[i].oracle_level[current] = 0
            voters[i].salt[current] = 0
            voters[i].reclaimed[current] = False

            voters[i].committed[current] = (random.randint(0, 99) < 99)
            if not voters[i].committed[current]:
                continue

            rand = random.randint(0, 9)
            if rand < 5:
                voters[i].committed_level[current] = target_level
            elif rand < 7:
                voters[i].committed_level[current] = (
                    (target_level - 1) % Oracle.LEVEL_MAX)
            elif rand < 9:
                voters[i].committed_level[current] = (
                    (target_level + 1) % Oracle.LEVEL_MAX)
            else:
                voters[i].committed_level[current] = random.randint(
                    0, Oracle.LEVEL_MAX)

            voters[i].committed_salt[current] = random.randint(0, 10)
            hash = Oracle.encrypt(
                voters[i].address,
                voters[i].committed_level[current],
                voters[i].committed_salt[current])
            voters[i].deposit[current] = int(
                voters[i].balance * ACB.DEPOSIT_RATE / 100)

            voters[i].revealed[prev] = True
            if random.randint(0, 99) < 97:
                voters[i].oracle_level[prev] = voters[i].committed_level[prev]
            else:
                voters[i].oracle_level[prev] = random.randint(
                    0, Oracle.LEVEL_MAX)
            if random.randint(0, 99) < 97:
                voters[i].salt[prev] = voters[i].committed_salt[prev]
            else:
                voters[i].salt[prev] = random.randint(0, 10)

            voters[i].reclaimed[prev_prev] = True

            reveal_result = (
                voters[i].committed[prev] and
                voters[i].oracle_level[prev] ==
                voters[i].committed_level[prev] and
                0 <= voters[i].oracle_level[prev] and
                voters[i].oracle_level[prev] < Oracle.LEVEL_MAX and
                voters[i].salt[prev] ==
                voters[i].committed_salt[prev])

            reclaim_result = (
                voters[i].committed[prev_prev] and
                voters[i].revealed[prev_prev] and
                voters[i].oracle_level[prev_prev] ==
                voters[i].committed_level[prev_prev] and
                0 <= voters[i].oracle_level[prev_prev] and
                voters[i].oracle_level[prev_prev] < Oracle.LEVEL_MAX and
                voters[i].salt[prev_prev] ==
                voters[i].committed_salt[prev_prev] and
                (abs(voters[i].oracle_level[prev_prev] - mode_level) <=
                 Oracle.RECLAIM_THRESHOLD))

            coin_supply = acb.coin.total_supply
            bond_supply = self.bond.total_supply
            bond_budget = self.bond_operation.bond_budget

            reclaimed = 0
            if reclaim_result:
                reclaimed = voters[i].deposit[prev_prev]

            reward = 0
            if (reclaim_result and
                mode_level == voters[i].oracle_level[prev_prev]):
                proportional_reward = 0
                if revealed_deposits[mode_level] > 0:
                    proportional_reward = int(
                        Oracle.PROPORTIONAL_REWARD_RATE * reward_total *
                        voters[i].deposit[prev_prev] /
                        (100 * revealed_deposits[mode_level]))
                constant_reward = int(
                    (100 - Oracle.PROPORTIONAL_REWARD_RATE) * reward_total /
                    (100 * revealed_counts[mode_level]))
                reward = proportional_reward + constant_reward

            voters[i].balance = (voters[i].balance -
                                 voters[i].deposit[current] +
                                 reclaimed + reward)
            reclaimed_total += reclaimed + reward

            self.assertEqual(acb.vote(voters[i].address,
                                      hash,
                                      voters[i].oracle_level[prev],
                                      voters[i].salt[prev]),
                             (True, reveal_result, voters[i].deposit[current],
                              reclaimed, reward, not commit_observed))

            self.assertEqual(acb.coin.balance_of(voters[i].address),
                             voters[i].balance)
            self.assertEqual(acb.current_epoch_start, acb.get_timestamp())

            self.metrics.deposited += voters[i].deposit[current]
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
                if mode_level != Oracle.LEVEL_MAX:
                    delta = int(acb.coin.total_supply *
                                (ACB.LEVEL_TO_EXCHANGE_RATE[mode_level] -
                                 1 * ACB.EXCHANGE_RATE_DIVISOR) /
                                ACB.EXCHANGE_RATE_DIVISOR)
                    delta = int(delta * ACB.DAMPING_FACTOR / 100)

                new_epoch_id = acb.oracle.epoch_id
                mint = 0
                redeemable_bonds = 0
                issued_bonds = 0
                if delta >= 0:
                    necessary_bonds = int(
                        delta / BondOperation.BOND_REDEMPTION_PRICE)
                    valid_bond_supply = self.bond_operation.valid_bond_supply(
                        new_epoch_id)
                    if necessary_bonds <= valid_bond_supply:
                        redeemable_bonds = necessary_bonds
                    else:
                        redeemable_bonds = valid_bond_supply
                        mint = ((necessary_bonds - redeemable_bonds) *
                                BondOperation.BOND_REDEMPTION_PRICE)
                else:
                    issued_bonds = int(-delta / BondOperation.BOND_PRICE)

                self.assertEqual(self.bond.total_supply, bond_supply)
                if mode_level == Oracle.LEVEL_MAX:
                    self.assertEqual(self.bond_operation.bond_budget, 0)
                elif delta >= 0:
                    self.assertEqual(
                        self.bond_operation.bond_budget, -redeemable_bonds)
                else:
                    self.assertEqual(
                        self.bond_operation.bond_budget, issued_bonds)
                self.assertEqual(
                    acb.coin.total_supply,
                    coin_supply - self.burned[(new_epoch_id - 2) % 3])
                self.assertEqual(acb.oracle_level, mode_level)
                commit_observed = True

                self.metrics.delta = delta
                self.metrics.mint = mint
                self.metrics.lost = self.burned[(new_epoch_id - 2) % 3]
                self.metrics.oracle_level = mode_level
            else:
                self.assertEqual(acb.oracle_level, mode_level)
                self.assertEqual(self.bond.total_supply, bond_supply)
                self.assertEqual(self.bond_operation.bond_budget, bond_budget)

        self.burned[epoch_id % 3] = deposit_total + tax - reclaimed_total
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
