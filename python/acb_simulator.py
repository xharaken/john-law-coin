#!/usr/bin/env python3
from jlc import *
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
        self.revealed_level = [0] * 3
        self.revealed_salt = [0] * 3
        self.reclaimed = [False] * 3
        self.bonds = {}
        self.balance = 0


class ACBSimulator(unittest.TestCase):

    def __init__(self,
                 bond_redemption_price,
                 bond_redemption_period,
                 phase_duration,
                 proportional_reward_rate,
                 deposit_rate,
                 dumping_factor,
                 level_to_exchange_rate,
                 level_to_bond_price,
                 reclaim_threshold,
                 voter_count,
                 iteration):
        super().__init__()

        print('redemp_price=%d redemp_period=%d phase_dur=%d reward_rate=%d '
              'deposit_rate=%d dumping=%d reclaim=%d voter=%d iter=%d' %
              (bond_redemption_price,
               bond_redemption_period,
               phase_duration,
               proportional_reward_rate,
               deposit_rate,
               dumping_factor,
               reclaim_threshold,
               voter_count,
               iteration))
        print('levels=', end='')
        print(level_to_exchange_rate)

        ACB.BOND_REDEMPTION_PRICE = bond_redemption_price
        ACB.BOND_REDEMPTION_PERIOD = bond_redemption_period
        ACB.PHASE_DURATION = phase_duration
        ACB.PROPORTIONAL_REWARD_RATE = proportional_reward_rate
        ACB.DEPOSIT_RATE = deposit_rate
        ACB.DUMPING_FACTOR = dumping_factor
        ACB.RECLAIM_THRESHOLD = reclaim_threshold
        ACB.LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate
        ACB.LEVEL_MAX = len(ACB.LEVEL_TO_EXCHANGE_RATE)
        ACB.LEVEL_TO_BOND_PRICE = level_to_bond_price

        self.acb = ACB(0x1000)
        self.acb.check_constants_for_testing()

        self.lost_deposit = [0] * 3
        self.iteration = iteration

        self.voter_count = voter_count
        self.voters = []
        for i in range(self.voter_count):
            address = "address" + str(i)
            self.assertEqual(self.acb.create_account(address), True)
            self.voters.append(Voter(address))

        class Metrics:
            def __init__(self):
                self.reset_total()
                self.reset_local()

            def reset_local(self):
                self.reveal_hit = 0
                self.reveal_miss = 0
                self.reclaim_hit = 0
                self.reclaim_miss = 0
                self.redeem_count = 0
                self.fast_redeem_count = 0
                self.redemption_count = 0
                self.redeem_hit = 0
                self.purchase_hit = 0
                self.delta = 0
                self.mint = 0
                self.lost = 0

            def reset_total(self):
                self.total_reveal_hit = 0
                self.total_reveal_miss = 0
                self.total_reclaim_hit = 0
                self.total_reclaim_miss = 0
                self.supply_increased = 0
                self.supply_decreased = 0
                self.supply_nochange = 0
                self.total_redemption_count = 0
                self.total_redeem_count = 0
                self.total_fast_redeem_count = 0
                self.total_redeem_hit = 0
                self.total_purchase_hit = 0
                self.total_mint = 0
                self.total_lost = 0

            def update_total(self):
                self.total_reveal_hit += self.reveal_hit
                self.total_reveal_miss += self.reveal_miss
                self.total_reclaim_hit += self.reclaim_hit
                self.total_reclaim_miss += self.reclaim_miss
                if self.delta > 0:
                    self.supply_increased += 1
                elif self.delta < 0:
                    self.supply_decreased += 1
                else:
                    self.supply_nochange += 1
                self.total_redeem_count += self.redeem_count
                self.total_fast_redeem_count += self.fast_redeem_count
                self.total_redemption_count += self.redemption_count
                self.total_redeem_hit += self.redeem_hit
                self.total_purchase_hit += self.purchase_hit
                self.total_mint += self.mint
                self.total_lost += self.lost

        self.metrics = Metrics()


    def teardown(self):
        pass

    def run(self):

        acb = self.acb
        ACB.COIN_TRANSFER_MAX = ACB.INITIAL_COIN_SUPPLY * 1000

        for i in range(self.voter_count):
            amount = random.randint(
                0, ACB.LEVEL_TO_BOND_PRICE[ACB.LEVEL_MAX - 1] * 10)
            if random.randint(0, 9) >= 9:
                amount = 0
            self.voters[i].balance = amount
            acb.coin_supply.mint(acb.balances[self.voters[i].address],
                                 self.voters[i].balance)
        initial_coin_supply = acb.coin_supply.amount

        epoch = 0
        for i in range(self.iteration):
            if acb.coin_supply.amount >= ACB.INITIAL_COIN_SUPPLY * 100:
                break

            self.metrics.reset_local()

            coin_supply1 = acb.coin_supply.amount

            acb.set_timestamp(acb.get_timestamp() + ACB.PHASE_DURATION)
            commit_observed = self.vote(epoch)
            if not commit_observed:
                continue

            epoch += 1
            coin_supply2 = acb.coin_supply.amount
            bond_supply = acb.bond_supply.amount
            bond_budget = acb.bond_budget

            self.redeem_bonds()
            self.purchase_bonds()

            if False:
                print('epoch=%d reveal_hit=%d/%d=%d%% reclaim_hit=%d/%d=%d%% '
                      'purchase_hit=%d/%d=%d%% redeem_hit=%d/%d=%d%% '
                      'redemptions=%d/%d=%d%% fast_redeem=%d/%d=%d%% '
                      'delta=%d mint=%d lost=%d coin_supply=%d->%d->%d=%d '
                      'bond_supply=%d->%d bond_budget=%d->%d' %
                      (epoch,
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
                       self.metrics.fast_redeem_count,
                       self.metrics.redeem_count,
                       divide_or_zero(100 * self.metrics.fast_redeem_count,
                                      self.metrics.redeem_count),
                       self.metrics.delta,
                       self.metrics.mint,
                       self.metrics.lost,
                       coin_supply1,
                       coin_supply2,
                       acb.coin_supply.amount,
                       acb.coin_supply.amount - coin_supply1,
                       bond_supply,
                       acb.bond_supply.amount,
                       bond_budget,
                       acb.bond_budget
                       ))
            self.metrics.update_total()

        print("================")
        print('epoch=%d reveal_hit=%d/%d=%d%% reclaim_hit=%d/%d=%d%% '
              'purchase_hit=%d/%d=%d%% redeem_hit=%d/%d=%d%% '
              'redemptions=%d/%d=%d%% fast_redeem=%d/%d=%d%% '
              'supply=%d/%d/%d coin_supply=%d mint=%d lost=%d bond_supply=%d' %
              (epoch,
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
               self.metrics.total_purchase_hit,
               self.voter_count * epoch,
               divide_or_zero(100 * self.metrics.total_purchase_hit,
                              self.voter_count * epoch),
               self.metrics.total_redeem_hit,
               self.voter_count * epoch,
               divide_or_zero(100 * self.metrics.total_redeem_hit,
                              self.voter_count * epoch),
               self.metrics.total_redemption_count,
               self.metrics.total_redeem_hit,
               divide_or_zero(100 * self.metrics.total_redemption_count,
                              self.metrics.total_redeem_hit),
               self.metrics.total_fast_redeem_count,
               self.metrics.total_redeem_count,
               divide_or_zero(100 * self.metrics.total_fast_redeem_count,
                              self.metrics.total_redeem_count),
               self.metrics.supply_increased,
               self.metrics.supply_nochange,
               self.metrics.supply_decreased,
               acb.coin_supply.amount - initial_coin_supply,
               self.metrics.total_mint,
               self.metrics.total_lost,
               acb.bond_supply.amount
               ))
        print("================")
        print()

    def purchase_bonds(self):
        acb = self.acb

        start_index = random.randint(0, self.voter_count - 1)
        for index in range(self.voter_count):
            bond_budget = acb.bond_budget
            if bond_budget <= 0:
                continue

            voter = self.voters[(start_index + index) % self.voter_count]
            bond_price = ACB.LEVEL_TO_BOND_PRICE[ACB.LEVEL_MAX - 1]
            if 0 <= acb.oracle_level and acb.oracle_level < ACB.LEVEL_MAX:
                bond_price = ACB.LEVEL_TO_BOND_PRICE[acb.oracle_level]
            count = min(acb.bond_budget, int(0.3 * voter.balance / bond_price))
            if count <= 0:
                continue

            self.assertEqual(acb.purchase_bonds(voter.address, 0), 0)
            self.assertEqual(acb.purchase_bonds(voter.address,
                                                acb.bond_budget + 1), 0)

            coin_supply = acb.coin_supply.amount
            bond_supply = acb.bond_supply.amount
            redemption = acb.get_timestamp() + ACB.BOND_REDEMPTION_PERIOD
            if redemption in voter.bonds:
                voter.bonds[redemption] += count
            else:
                voter.bonds[redemption] = count
            voter.balance -= bond_price * count

            self.assertEqual(acb.purchase_bonds(voter.address, count),
                             redemption)
            self.assertEqual(acb.balances[voter.address].amount, voter.balance)
            self.assertEqual(acb.coin_supply.amount,
                             coin_supply - bond_price * count)
            self.assertEqual(acb.bond_supply.amount,
                             bond_supply + count)
            self.assertEqual(acb.bond_budget,
                             bond_budget - count)
            self.assertEqual(acb.bonds[voter.address][redemption].amount,
                             voter.bonds[redemption])

            self.metrics.purchase_hit += 1

    def redeem_bonds(self):
        acb = self.acb

        start_index = random.randint(0, self.voter_count - 1)
        for index in range(self.voter_count):
            if random.randint(0, 9) >= 9:
                continue

            voter = self.voters[(start_index + index) % self.voter_count]

            redemptions = list(voter.bonds.keys())
            if len(redemptions) == 0:
                continue

            self.assertEqual(
                acb.redeem_bonds(0x2000, [redemptions[0]]), 0)
            self.assertEqual(
                acb.redeem_bonds(voter.address, [redemptions[0], -1]), 0)
            self.assertEqual(
                acb.redeem_bonds(
                    voter.address, [redemptions[0], redemptions[0]]), 0)

            fast_redeem_count = 0
            redeem_count = 0
            bond_budget = acb.bond_budget
            for redemption in redemptions:
                count = voter.bonds[redemption]
                if redemption > acb.get_timestamp():
                    if bond_budget >= 0:
                        continue
                    count = min(count, -bond_budget)
                    fast_redeem_count += count
                redeem_count += count
                bond_budget += count
                voter.bonds[redemption] -= count
                assert(voter.bonds[redemption] >= 0)
                if voter.bonds[redemption] == 0:
                    del voter.bonds[redemption]
            voter.balance += ACB.BOND_REDEMPTION_PRICE * redeem_count

            coin_supply = acb.coin_supply.amount
            bond_supply = acb.bond_supply.amount
            self.assertEqual(
                acb.redeem_bonds(voter.address, redemptions), redeem_count)
            self.assertEqual(acb.bond_budget, bond_budget)
            self.assertEqual(acb.balances[voter.address].amount, voter.balance)
            for redemption in voter.bonds:
                self.assertEqual(acb.bonds[voter.address][redemption].amount,
                                 voter.bonds[redemption])
            self.assertEqual(acb.bond_supply.amount,
                             bond_supply - redeem_count)
            self.assertEqual(acb.coin_supply.amount,
                             coin_supply + ACB.BOND_REDEMPTION_PRICE *
                             redeem_count)

            self.metrics.fast_redeem_count += fast_redeem_count
            self.metrics.redeem_count += redeem_count
            self.metrics.redemption_count += len(redemptions)
            self.metrics.redeem_hit += 1


    def vote(self, epoch):
        acb = self.acb
        voters = self.voters
        current = epoch % 3
        prev = (epoch - 1) % 3
        prev_prev = (epoch - 2) % 3

        revealed_deposits = [0] * ACB.LEVEL_MAX
        revealed_counts = [0] * ACB.LEVEL_MAX
        for i in range(len(voters)):
            if (voters[i].committed[prev_prev] and
                voters[i].revealed[prev_prev] and
                voters[i].revealed_level[prev_prev] ==
                voters[i].committed_level[prev_prev] and
                0 <= voters[i].revealed_level[prev_prev] and
                voters[i].revealed_level[prev_prev] < ACB.LEVEL_MAX and
                voters[i].revealed_salt[prev_prev] ==
                voters[i].committed_salt[prev_prev]):
                level = voters[i].revealed_level[prev_prev]
                revealed_deposits[level] += voters[i].deposit[prev_prev]
                revealed_counts[level] += 1

        mode_level = ACB.LEVEL_MAX
        max_deposit = 0
        max_count = 0
        for level in range(ACB.LEVEL_MAX):
            if (revealed_counts[level] > 0 and
                (mode_level == ACB.LEVEL_MAX or
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
                voters[i].revealed_level[prev_prev] ==
                voters[i].committed_level[prev_prev] and
                0 <= voters[i].revealed_level[prev_prev] and
                voters[i].revealed_level[prev_prev] < ACB.LEVEL_MAX and
                voters[i].revealed_salt[prev_prev] ==
                voters[i].committed_salt[prev_prev] and
                (abs(voters[i].revealed_level[prev_prev] - mode_level) <=
                 ACB.RECLAIM_THRESHOLD)):
                deposit_to_be_reclaimed += voters[i].deposit[prev_prev]
        assert(deposit_to_be_reclaimed <= deposit_total)
        if mode_level == ACB.LEVEL_MAX:
            assert(deposit_to_be_reclaimed == 0)

        delta = 0
        if mode_level != ACB.LEVEL_MAX:
            delta = int(acb.coin_supply.amount *
                        (ACB.LEVEL_TO_EXCHANGE_RATE[mode_level] -
                         1 * ACB.EXCHANGE_RATE_DIVISOR) /
                        ACB.EXCHANGE_RATE_DIVISOR)
            delta = int(delta * ACB.DUMPING_FACTOR / 100)

        mint = 0
        redeemable_bonds = 0
        issued_bonds = 0
        if delta >= 0:
            necessary_bonds = int(delta / ACB.BOND_REDEMPTION_PRICE)
            if necessary_bonds <= acb.bond_supply.amount:
                redeemable_bonds = necessary_bonds
            else:
                redeemable_bonds = acb.bond_supply.amount
                mint = ((necessary_bonds - acb.bond_supply.amount) *
                        ACB.BOND_REDEMPTION_PRICE)
        else:
            issued_bonds = int(
                -delta / ACB.LEVEL_TO_BOND_PRICE[mode_level])

        target_level = random.randint(0, ACB.LEVEL_MAX - 1)
        #target_level = int(epoch / 6) % 3
        #target_level = epoch % 3

        reward_total = deposit_total - deposit_to_be_reclaimed + mint
        reclaimed_total = 0
        commit_observed = False
        for i in range(len(voters)):
            voters[i].committed[current] = False
            voters[i].committed_level[current] = 0
            voters[i].committed_salt[current] = 0
            voters[i].deposit[current] = 0
            voters[i].revealed[current] = False
            voters[i].revealed_level[current] = 0
            voters[i].revealed_salt[current] = 0
            voters[i].reclaimed[current] = False

            voters[i].committed[current] = (random.randint(0, 99) < 99)
            if not voters[i].committed[current]:
                continue

            rand = random.randint(0, 9)
            if rand < 5:
                voters[i].committed_level[current] = target_level
            elif rand < 7:
                voters[i].committed_level[current] = (
                    (target_level - 1) % ACB.LEVEL_MAX)
            elif rand < 9:
                voters[i].committed_level[current] = (
                    (target_level + 1) % ACB.LEVEL_MAX)
            else:
                voters[i].committed_level[current] = random.randint(
                    0, ACB.LEVEL_MAX)

            voters[i].committed_salt[current] = random.randint(0, 10)
            committed_hash = Oracle.hash(
                voters[i].address,
                voters[i].committed_level[current],
                voters[i].committed_salt[current])
            voters[i].deposit[current] = int(
                voters[i].balance * ACB.DEPOSIT_RATE / 100)

            voters[i].revealed[prev] = True
            if random.randint(0, 99) < 97:
                voters[i].revealed_level[prev] = voters[i].committed_level[prev]
            else:
                voters[i].revealed_level[prev] = random.randint(
                    0, ACB.LEVEL_MAX)
            if random.randint(0, 99) < 97:
                voters[i].revealed_salt[prev] = voters[i].committed_salt[prev]
            else:
                voters[i].revealed_salt[prev] = random.randint(0, 10)

            voters[i].reclaimed[prev_prev] = True

            reveal_result = (
                voters[i].committed[prev] and
                voters[i].revealed_level[prev] ==
                voters[i].committed_level[prev] and
                0 <= voters[i].revealed_level[prev] and
                voters[i].revealed_level[prev] < ACB.LEVEL_MAX and
                voters[i].revealed_salt[prev] ==
                voters[i].committed_salt[prev])

            reclaim_result = (
                voters[i].committed[prev_prev] and
                voters[i].revealed[prev_prev] and
                voters[i].revealed_level[prev_prev] ==
                voters[i].committed_level[prev_prev] and
                0 <= voters[i].revealed_level[prev_prev] and
                voters[i].revealed_level[prev_prev] < ACB.LEVEL_MAX and
                voters[i].revealed_salt[prev_prev] ==
                voters[i].committed_salt[prev_prev] and
                (abs(voters[i].revealed_level[prev_prev] - mode_level) <=
                 ACB.RECLAIM_THRESHOLD))

            coin_supply = acb.coin_supply.amount
            bond_supply = acb.bond_supply.amount
            bond_budget = acb.bond_budget

            reclaimed_deposit = 0
            if reclaim_result:
                reclaimed_deposit = voters[i].deposit[prev_prev]

            reward = 0
            if (reclaim_result and
                mode_level == voters[i].revealed_level[prev_prev]):
                proportional_reward = 0
                if revealed_deposits[mode_level] > 0:
                    proportional_reward = int(
                        ACB.PROPORTIONAL_REWARD_RATE * reward_total *
                        voters[i].deposit[prev_prev] /
                        (100 * revealed_deposits[mode_level]))
                constant_reward = int(
                    (100 - ACB.PROPORTIONAL_REWARD_RATE) * reward_total /
                    (100 * revealed_counts[mode_level]))
                reward = proportional_reward + constant_reward

            voters[i].balance = (voters[i].balance -
                                 voters[i].deposit[current] +
                                 reclaimed_deposit + reward)
            reclaimed_total += reclaimed_deposit + reward

            self.assertEqual(acb.vote(0x2000,
                                      committed_hash,
                                      voters[i].revealed_level[prev],
                                      voters[i].revealed_salt[prev]),
                             (False, False, 0, False))
            self.assertEqual(acb.vote(voters[i].address,
                                      committed_hash,
                                      voters[i].revealed_level[prev],
                                      voters[i].revealed_salt[prev]),
                             (True, reveal_result,
                              reclaimed_deposit + reward, not commit_observed))
            self.assertEqual(acb.vote(voters[i].address,
                                      committed_hash,
                                      voters[i].revealed_level[prev],
                                      voters[i].revealed_salt[prev]),
                             (False, False, 0, False))

            self.assertEqual(acb.balances[voters[i].address].amount,
                             voters[i].balance)

            if reveal_result:
                self.metrics.reveal_hit += 1
            else:
                self.metrics.reveal_miss += 1
            if reclaim_result > 0:
                self.metrics.reclaim_hit += 1
            else:
                self.metrics.reclaim_miss += 1

            if not commit_observed:
                self.assertEqual(acb.bond_supply.amount, bond_supply)
                if mode_level == ACB.LEVEL_MAX:
                    self.assertEqual(acb.bond_budget, bond_budget)
                elif delta >= 0:
                    self.assertEqual(acb.bond_budget, -redeemable_bonds)
                else:
                    self.assertEqual(acb.bond_budget, issued_bonds)
                self.assertEqual(acb.coin_supply.amount,
                                 coin_supply + mint -
                                 self.lost_deposit[(epoch - 1) % 3])
                self.assertEqual(acb.oracle_level, mode_level)
                commit_observed = True

                self.metrics.delta = delta
                self.metrics.mint = mint
                self.metrics.lost = self.lost_deposit[(epoch - 1) % 3]
            else:
                self.assertEqual(acb.oracle_level, mode_level)
                self.assertEqual(acb.bond_supply.amount, bond_supply)
                self.assertEqual(acb.bond_budget, bond_budget)

        self.lost_deposit[epoch % 3] =  deposit_total + mint - reclaimed_total
        return commit_observed


def main():
    iteration = 1000

    test = ACBSimulator(
        1000,
        45,
        7,
        80,
        10,
        10,
        [7, 8, 9, 10, 11, 12, 13],
        [970, 980, 990, 997, 997, 997, 997],
        1,
        200,
        iteration)
    test.run()
    test.teardown()

    for bond_redemption_price in [3, 998, 1000]:
        for bond_redemption_period in [1, 2, 5, 45 * 24 * 60 * 60]:
            for phase_duration in [1, 2, 5, 7 * 24 * 60 * 60]:
                for proportional_reward_rate in [0, 1, 80, 99, 100]:
                    for deposit_rate in [0, 1, 10, 99, 100]:
                        for dumping_factor in [1, 30, 99, 100]:
                            p = bond_redemption_price
                            for (level_to_exchange_rate,
                                 level_to_bond_price) in [
                                     ([9, 11, 12],
                                      [max(1, p - 20), max(1, p - 10), p]),
                                     ([0, 1, 10, 11, 12],
                                      [max(1, p - 20), max(1, p - 10),
                                       p, p, p]),
                                     ([7, 8, 9, 10, 11, 12, 13],
                                      [max(1, p - 20), max(1, p - 10),
                                       max(1, p - 20), max(1, p - 10),
                                       p, p, p])]:
                                for reclaim_threshold in range(1, len(
                                    level_to_exchange_rate)):
                                    for voter_count in [1, 10, 200]:
                                        test = ACBSimulator(
                                            bond_redemption_price,
                                            bond_redemption_period,
                                            phase_duration,
                                            proportional_reward_rate,
                                            deposit_rate,
                                            dumping_factor,
                                            level_to_exchange_rate,
                                            level_to_bond_price,
                                            reclaim_threshold,
                                            voter_count,
                                            iteration)
                                        test.run()
                                        test.teardown()


if __name__ == "__main__":
    main()
