#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

from johnlawcoin import *
import unittest, random

class OracleSimulator(unittest.TestCase):
    def __init__(self, level_max, reclaim_threshold,
                 proportional_reward_rate, voter_count, iteration):
        super().__init__()
        print("level_max=%d reclaim=%d prop=%d voter_count=%d iter=%d" %
              (level_max, reclaim_threshold,
               proportional_reward_rate, voter_count, iteration))
        self._level_max = level_max
        self._reclaim_threshold = reclaim_threshold
        self._proportional_reward_rate = proportional_reward_rate
        self._voter_count = voter_count
        self._iteration = iteration

        self._coin = JohnLawCoin(0)
        self._oracle = Oracle()
        self._oracle.override_constants_for_testing(
            self._level_max, self._reclaim_threshold,
            self._proportional_reward_rate)

        self._prev_tax = 0

    def teardown(self):
        pass

    def run(self):
        initial_coin_supply = self._coin.total_supply
        for i in range(self._iteration):
            self.run_cycle()
            self.assertEqual(self._coin.total_supply,
                             self._prev_tax + initial_coin_supply)

    def run_cycle(self):

        class Voter:
            def __init__(self, address):
                self.address = address
                self.committed = False
                self.deposit = 0
                self.committed_level = 0
                self.committed_salt = 0
                self.committed_correctly = False
                self.revealed = False
                self.revealed_correctly = False
                self._oracle_level = 0
                self.salt = 0
                self.reclaimed = False

        voters = []
        for i in range(self._voter_count):
            voters.append(Voter(i + 1))

        for i in range(len(voters)):
            self.assertEqual(voters[i].address, i + 1)
            voters[i].committed = (random.randint(0, 99) < 95)
            if voters[i].committed:
                voters[i].deposit = random.randint(0, 10)
                voters[i].committed_level = random.randint(0, self._level_max)
                voters[i].committed_salt = random.randint(0, 10)
                self._coin.mint(voters[i].address, voters[i].deposit)
                result = self._oracle.commit(
                    self._coin, voters[i].address,
                    Oracle.encrypt(voters[i].address,
                                   voters[i].committed_level,
                                   voters[i].committed_salt),
                    voters[i].deposit)

                self.assertEqual(result, True)
                self.assertEqual(self._coin.balance_of(voters[i].address), 0)
                voters[i].committed_correctly = True

                self.assertEqual(self._oracle.commit(
                    self._coin, voters[i].address,
                    Oracle.encrypt(voters[i].address,
                                   voters[i].committed_level,
                                   voters[i].committed_salt), 0), False)

        tax = random.randint(0, 200)
        self._coin.mint(self._coin.tax_account, tax)
        burned = self._oracle.advance(self._coin)
        self.assertEqual(burned, self._prev_tax)
        self._prev_tax = tax

        for i in range(len(voters)):
            self.assertEqual(voters[i].address, i + 1)
            voters[i].revealed = (random.randint(0, 99) < 95)
            if voters[i].revealed:
                if random.randint(0, 99) < 95:
                    voters[i].oracle_level = voters[i].committed_level
                else:
                    voters[i].oracle_level = random.randint(
                        0, self._level_max)
                if random.randint(0, 99) < 95:
                    voters[i].salt = voters[i].committed_salt
                else:
                    voters[i].salt = random.randint(0, 10)
                voters[i].revealed_correctly = (
                    voters[i].committed_correctly and
                    voters[i].oracle_level == voters[i].committed_level and
                    0 <= voters[i].oracle_level and
                    voters[i].oracle_level < self._level_max and
                    voters[i].salt == voters[i].committed_salt)
                result = self._oracle.reveal(
                    voters[i].address,
                    voters[i].oracle_level,
                    voters[i].salt)
                self.assertEqual(result, voters[i].revealed_correctly)
                self.assertEqual(
                    self._oracle.reveal(voters[i].address,
                                       voters[i].oracle_level,
                                       voters[i].salt), False)
                self.assertEqual(
                    self._oracle.reveal(-voters[i].address,
                                       voters[i].oracle_level,
                                       voters[i].salt), False)

        deposits = [0] * self._level_max
        counts = [0] * self._level_max
        deposit_total = 0
        for i in range(len(voters)):
            if voters[i].committed_correctly:
                deposit_total += voters[i].deposit
                assert(voters[i].deposit >= 0)
            if voters[i].revealed_correctly:
                deposits[voters[i].oracle_level] += voters[i].deposit
                counts[voters[i].oracle_level] += 1

        max_deposit = 0
        max_count = 0
        mode_level = self._level_max
        for level in range(self._level_max):
            if (counts[level] > 0 and
                (mode_level == self._level_max or
                 max_deposit < deposits[level] or
                 (max_deposit == deposits[level] and
                  max_count < counts[level]))):
                max_deposit = deposits[level]
                max_count = counts[level]
                mode_level = level

        tax = random.randint(0, 200)
        deposit_to_reclaim = 0
        if mode_level == self._level_max:
            reward_total = deposit_total + tax
        else:
            for level in range(self._level_max):
                if (mode_level - self._reclaim_threshold <= level and
                    level <= mode_level + self._reclaim_threshold):
                    deposit_to_reclaim += deposits[level]
            reward_total = deposit_total - deposit_to_reclaim + tax
        self.assertEqual(deposit_to_reclaim + reward_total,
                         deposit_total + tax)

        self._coin.mint(self._coin.tax_account, tax)
        burned = self._oracle.advance(self._coin)
        self.assertEqual(self._oracle.get_mode_level(), mode_level)
        self.assertEqual(burned, self._prev_tax)
        self._prev_tax = tax

        reclaim_total = 0
        for i in range(len(voters)):
            self.assertEqual(voters[i].address, i + 1)
            voters[i].reclaimed = (random.randint(0, 99) < 95)
            if voters[i].reclaimed:
                self.assertEqual(self._coin.balance_of(voters[i].address), 0)
                reward = 0
                reclaimed = 0
                if (voters[i].revealed_correctly and
                    voters[i].oracle_level == mode_level):
                    self.assertNotEqual(mode_level, self._level_max)
                    if deposits[mode_level] > 0:
                        reward += int(
                            (self._proportional_reward_rate * reward_total *
                             voters[i].deposit) /
                            (100 * deposits[mode_level]))
                    reward += int(
                        ((100 - self._proportional_reward_rate)
                         * reward_total) /
                        (100 * counts[mode_level]))
                    reclaimed = voters[i].deposit
                elif (voters[i].revealed_correctly and
                      mode_level - self._reclaim_threshold <=
                      voters[i].oracle_level and
                      voters[i].oracle_level <=
                      mode_level + self._reclaim_threshold):
                    self.assertNotEqual(mode_level, self._level_max)
                    reclaimed = voters[i].deposit
                self.assertEqual(self._oracle.reclaim(
                    self._coin, voters[i].address), (reclaimed, reward))
                reclaim_total += reclaimed + reward
                self.assertEqual(self._coin.balance_of(voters[i].address),
                                 reclaimed + reward)
                self._coin.burn(voters[i].address, reclaimed + reward)

                self.assertEqual(
                    self._oracle.reclaim(self._coin, voters[i].address), (0, 0))
                self.assertEqual(self._oracle.reclaim(
                    self._coin, -voters[i].address), (0, 0))

        self.assertEqual(deposit_to_reclaim + reward_total,
                         deposit_total + tax)
        burned = deposit_total + tax - reclaim_total
        tax = random.randint(0, 200)
        self._coin.mint(self._coin.tax_account, tax)
        self.assertEqual(self._oracle.advance(self._coin), burned)
        self._prev_tax = tax


def main():
    iteration = 1000
    for level_max in [2, 3, 4, 9]:
        for reclaim_threshold in range(0, level_max):
            for proportional_reward_rate in [0, 1, 90, 100]:
                for voter_count in [0, 1, 100]:
                    test = OracleSimulator(level_max,
                                           reclaim_threshold,
                                           proportional_reward_rate,
                                           voter_count,
                                           iteration)
                    test.run()
                    test.teardown()


if __name__ == "__main__":
    main()
