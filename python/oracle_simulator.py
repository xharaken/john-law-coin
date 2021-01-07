#!/usr/bin/env python3
from jlc import *
import unittest, random

class OracleSimulator(unittest.TestCase):
    def __init__(self, level_max, reclaim_threshold,
                 proportional_reward_rate, voter_count, iteration):
        super().__init__()
        print("level_max=%d reclaim=%d prop=%d voter_count=%d iter=%d" %
              (level_max, reclaim_threshold,
               proportional_reward_rate, voter_count, iteration))
        self.level_max = level_max
        self.reclaim_threshold = reclaim_threshold
        self.proportional_reward_rate = proportional_reward_rate
        self.supply = TokenSupply()
        self.oracle = Oracle(level_max, reclaim_threshold,
                             proportional_reward_rate, self.supply)
        self.voter_count = voter_count
        self.iteration = iteration
        self.prev_mint = 0

    def teardown(self):
        pass

    def run(self):
        for i in range(self.iteration):
            self.run_cycle()
        self.assertEqual(self.supply.amount, self.prev_mint)

    def run_cycle(self):

        class Voter:
            def __init__(self, address):
                self.address = address
                self.balance_holder = TokenHolder();
                self.committed = False
                self.deposit = 0
                self.committed_level = 0
                self.committed_salt = 0
                self.committed_correctly = False
                self.revealed = False
                self.revealed_correctly = False
                self.revealed_level = 0
                self.revealed_salt = 0
                self.reclaimed = False

        voters = []
        for i in range(self.voter_count):
            voters.append(Voter(i))

        for i in range(len(voters)):
            self.assertEqual(voters[i].address, i)
            voters[i].committed = (random.randint(0, 99) < 95)
            if voters[i].committed:
                voters[i].deposit = random.randint(0, 10)
                voters[i].committed_level = random.randint(0, self.level_max)
                voters[i].committed_salt = random.randint(0, 10)
                self.supply.mint(voters[i].balance_holder, voters[i].deposit)
                result = self.oracle.commit(
                    voters[i].address,
                    Oracle.hash(voters[i].address,
                                voters[i].committed_level,
                                voters[i].committed_salt),
                    voters[i].deposit, voters[i].balance_holder)

                self.assertEqual(result, True)
                self.assertEqual(voters[i].balance_holder.amount, 0)
                voters[i].committed_correctly = True

                self.assertEqual(self.oracle.commit(
                    voters[i].address,
                    Oracle.hash(voters[i].address,
                                voters[i].committed_level,
                                voters[i].committed_salt),
                    0, voters[i].balance_holder), False)

        mint = random.randint(0, 20)
        burned = self.oracle.advance_phase(mint)
        self.assertEqual(burned, self.prev_mint)
        self.prev_mint = mint

        for i in range(len(voters)):
            self.assertEqual(voters[i].address, i)
            voters[i].revealed = (random.randint(0, 99) < 95)
            if voters[i].revealed:
                if random.randint(0, 99) < 95:
                    voters[i].revealed_level = voters[i].committed_level
                else:
                    voters[i].revealed_level = random.randint(0, self.level_max)
                if random.randint(0, 99) < 95:
                    voters[i].revealed_salt = voters[i].committed_salt
                else:
                    voters[i].revealed_salt = random.randint(0, 10)
                voters[i].revealed_correctly = (
                    voters[i].committed_correctly and
                    voters[i].revealed_level == voters[i].committed_level and
                    0 <= voters[i].revealed_level and
                    voters[i].revealed_level < self.level_max and
                    voters[i].revealed_salt == voters[i].committed_salt)
                result = self.oracle.reveal(
                    voters[i].address,
                    voters[i].revealed_level,
                    voters[i].revealed_salt)
                self.assertEqual(result, voters[i].revealed_correctly)
                self.assertEqual(
                    self.oracle.reveal(voters[i].address,
                                       voters[i].revealed_level,
                                       voters[i].revealed_salt), False)
                self.assertEqual(
                    self.oracle.reveal(-voters[i].address,
                                       voters[i].revealed_level,
                                       voters[i].revealed_salt), False)

        deposits = [0] * self.level_max
        counts = [0] * self.level_max
        deposit_total = 0
        for i in range(len(voters)):
            if voters[i].committed_correctly:
                deposit_total += voters[i].deposit
                assert(voters[i].deposit >= 0)
            if voters[i].revealed_correctly:
                deposits[voters[i].revealed_level] += voters[i].deposit
                counts[voters[i].revealed_level] += 1

        max_deposit = 0
        max_count = 0
        mode_level = self.level_max
        for level in range(self.level_max):
            if (counts[level] > 0 and
                (mode_level == self.level_max or
                 max_deposit < deposits[level] or
                 (max_deposit == deposits[level] and
                  max_count < counts[level]))):
                max_deposit = deposits[level]
                max_count = counts[level]
                mode_level = level

        self.assertEqual(self.oracle.get_mode_level(), mode_level)

        mint = random.randint(0, 20)
        deposit_to_reclaim = 0
        if mode_level == self.level_max:
            reward_total = deposit_total + mint
        else:
            for level in range(self.level_max):
                if (mode_level - self.reclaim_threshold <= level and
                    level <= mode_level + self.reclaim_threshold):
                    deposit_to_reclaim += deposits[level]
            reward_total = deposit_total - deposit_to_reclaim + mint
        self.assertEqual(deposit_to_reclaim + reward_total,
                         deposit_total + mint)

        burned = self.oracle.advance_phase(mint)
        self.assertEqual(burned, self.prev_mint)
        self.prev_mint = mint

        reclaim_total = 0
        for i in range(len(voters)):
            self.assertEqual(voters[i].address, i)
            voters[i].reclaimed = (random.randint(0, 99) < 95)
            if voters[i].reclaimed:
                self.assertEqual(voters[i].balance_holder.amount, 0)
                reclaim_amount = 0
                if (voters[i].revealed_correctly and
                    voters[i].revealed_level == mode_level):
                    self.assertNotEqual(mode_level, self.level_max)
                    proportional_reward = 0
                    if deposits[mode_level] > 0:
                        proportional_reward = int(
                            (self.proportional_reward_rate * reward_total *
                             voters[i].deposit) /
                            (100 * deposits[mode_level]))
                    constant_reward = int(
                        ((100 - self.proportional_reward_rate) * reward_total) /
                        (100 * counts[mode_level]))
                    reclaim_amount = (voters[i].deposit +
                                      proportional_reward +
                                      constant_reward)
                elif (voters[i].revealed_correctly and
                      mode_level - self.reclaim_threshold <=
                      voters[i].revealed_level and
                      voters[i].revealed_level <=
                      mode_level + self.reclaim_threshold):
                    self.assertNotEqual(mode_level, self.level_max)
                    reclaim_amount = voters[i].deposit
                self.assertEqual(self.oracle.reclaim(
                    voters[i].address, voters[i].balance_holder),
                    reclaim_amount)
                reclaim_total += reclaim_amount
                self.assertEqual(voters[i].balance_holder.amount,
                                 reclaim_amount)
                self.supply.burn(voters[i].balance_holder,
                                 reclaim_amount)

                self.assertEqual(self.oracle.reclaim(
                    voters[i].address, voters[i].balance_holder), 0)
                self.assertEqual(self.oracle.reclaim(
                    -voters[i].address, voters[i].balance_holder), 0)

        self.assertEqual(deposit_to_reclaim + reward_total,
                         deposit_total + mint)
        remainder = deposit_total + mint - reclaim_total
        mint = random.randint(0, 20)
        burned = self.oracle.advance_phase(mint)
        self.assertEqual(burned, remainder)
        self.prev_mint = mint


def main():
    iteration = 1000
    for level_max in [2, 3, 4, 5, 6, 11]:
        for reclaim_threshold in range(0, level_max):
            for proportional_reward_rate in [0, 1, 20, 80, 99, 100]:
                for voter_count in [0, 1, 10, 100]:
                    test = OracleSimulator(level_max,
                                           reclaim_threshold,
                                           proportional_reward_rate,
                                           voter_count,
                                           iteration)
                    test.run()
                    test.teardown()


if __name__ == "__main__":
    main()
