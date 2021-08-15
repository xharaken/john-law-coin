#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

from johnlawcoin import *
import unittest, random

class ACBUnitTest(unittest.TestCase):

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
                 tax,
                 price_change_interval,
                 price_change_percentage,
                 start_price_multiplier):
        super().__init__()

        print('bond_price=%d redemp_price=%d redemp_period=%d '
              'redeem_period=%d epoch_dur=%d reward_rate=%d '
              'deposit_rate=%d damping=%d reclaim=%d tax=%d '
              'price_interval=%d price_percent=%d price_multiplier=%d' %
              (bond_price,
               bond_redemption_price,
               bond_redemption_period,
               bond_redeemable_period,
               epoch_duration,
               proportional_reward_rate,
               deposit_rate,
               damping_factor,
               reclaim_threshold,
               tax,
               price_change_interval,
               price_change_percentage,
               start_price_multiplier))
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
        self._tax = tax
        self._price_change_interval = price_change_interval
        self._price_change_percentage = price_change_percentage
        self._start_price_multiplier = start_price_multiplier
        self._level_to_exchange_rate = level_to_exchange_rate
        self._level_max = len(level_to_exchange_rate)

        self.accounts = ['0x0000', '0x1000', '0x2000', '0x3000', '0x4000',
                         '0x5000', '0x6000', '0x7000']

        self._coin = JohnLawCoin(self.accounts[1])
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
        self._open_market_operation.override_constants_for_testing(
            self._price_change_interval, self._price_change_percentage,
            self._start_price_multiplier)
        self._acb.override_constants_for_testing(
            self._epoch_duration, self._deposit_rate, self._damping_factor,
            self._level_to_exchange_rate)

        self._initial_coin_supply = JohnLawCoin.INITIAL_COIN_SUPPLY
        self._tax_rate = JohnLawCoin.TAX_RATE

        for level in range(self._level_max):
            if (self._level_to_exchange_rate[level] == 11):
                self._default_level = level
        assert(0 < self._default_level and
               self._default_level < self._level_max - 1)

    def teardown(self):
        pass

    def run(self):
        acb = self._acb
        accounts = self.accounts

        # initial coin supply
        self.assertEqual(self._coin.balance_of(accounts[1]),
                         self._initial_coin_supply)
        self.assertEqual(self._coin.balance_of(accounts[2]), 0)
        self.assertEqual(self._coin.balance_of(accounts[3]), 0)

        # transfer
        with self.assertRaises(Exception):
            self._coin.transfer(accounts[4], accounts[1], 1)
        self._coin.transfer(accounts[1], accounts[2], 0)
        with self.assertRaises(Exception):
            self._coin.transfer(accounts[2], accounts[1], 1)
        with self.assertRaises(Exception):
            self._coin.transfer(accounts[1], accounts[2],
                              self._initial_coin_supply + 1)
        self._coin.transfer(accounts[1], accounts[2], 1)
        self._coin.transfer(accounts[1], accounts[3], 10)
        self._coin.transfer(accounts[3], accounts[2], 5)
        self.assertEqual(self._coin.balance_of(accounts[1]),
                         self._initial_coin_supply - 11)
        self.assertEqual(self._coin.balance_of(accounts[2]), 6)
        self.assertEqual(self._coin.balance_of(accounts[3]), 5)
        self._coin.transfer(accounts[2], accounts[2], 5)
        self.assertEqual(self._coin.balance_of(accounts[1]),
                         self._initial_coin_supply - 11)
        self.assertEqual(self._coin.balance_of(accounts[2]), 6)
        self.assertEqual(self._coin.balance_of(accounts[3]), 5)
        self._coin.transfer(accounts[2], accounts[3], 0)
        with self.assertRaises(Exception):
            self._coin.transfer(accounts[2], accounts[3], 7)
        self._coin.transfer(accounts[2], accounts[3], 6)
        self.assertEqual(self._coin.balance_of(accounts[1]),
                         self._initial_coin_supply - 11)
        self.assertEqual(self._coin.balance_of(accounts[2]), 0)
        self.assertEqual(self._coin.balance_of(accounts[3]), 11)
        self._coin.transfer(accounts[3], accounts[1], 11)
        self.assertEqual(self._coin.balance_of(accounts[1]),
                         self._initial_coin_supply)
        self.assertEqual(self._coin.balance_of(accounts[2]), 0)
        self.assertEqual(self._coin.balance_of(accounts[3]), 0)
        self.assertEqual(self._coin.total_supply, self._initial_coin_supply)
        self._coin.transfer(accounts[1], accounts[2], 1000)
        self.assertEqual(self._coin.balance_of(accounts[1]),
                         self._initial_coin_supply - 1000)
        self.assertEqual(self._coin.balance_of(accounts[2]), 990)
        self.assertEqual(self._coin.balance_of(self._coin.tax_account), 10)
        self._coin.transfer(accounts[2], accounts[1], 990)
        self.assertEqual(self._coin.balance_of(accounts[1]),
                         self._initial_coin_supply - 19)
        self.assertEqual(self._coin.balance_of(accounts[2]), 0)
        self.assertEqual(self._coin.balance_of(self._coin.tax_account), 19)
        self._coin.transfer(self._coin.tax_account, accounts[1], 19)
        self.assertEqual(self._coin.balance_of(accounts[1]),
                         self._initial_coin_supply)
        self.assertEqual(self._coin.balance_of(accounts[2]), 0)
        self.assertEqual(self._coin.balance_of(accounts[3]), 0)
        self.assertEqual(self._coin.total_supply, self._initial_coin_supply)

        # timestamp
        self.assertEqual(acb.get_timestamp(), 0)
        acb.set_timestamp(self._epoch_duration)
        self.assertEqual(acb.get_timestamp(), self._epoch_duration)

        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        
        burned = [0, 0, 0]
        deposit_4 = [0, 0, 0]
        deposit_5 = [0, 0, 0]
        deposit_6 = [0, 0, 0]
        now = 0
        self.set_tax()

        self._coin.move(accounts[1], accounts[4], 100)
        self.assertEqual(self._coin.balance_of(accounts[4]), 100)

        self.assertEqual(acb.vote(
            accounts[7], self._acb.encrypt(
                accounts[7], self._default_level, 7777),
            self._default_level, 7777), (True, False, 0, 0, 0, True))

        # 1 commit
        balance = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 1),
            self._default_level, 1), (True, False, deposit_4[now], 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance - deposit_4[now])
        balance = self._coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 1),
            self._default_level, 1), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 1),
            self._default_level, 1), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        balance = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance * self._deposit_rate / 100)
        self.assertEqual(acb.current_epoch_start,
                         acb.get_timestamp() - self._epoch_duration)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 2),
            self._default_level, 1), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance - deposit_4[now])
        balance = self._coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 2),
            self._default_level, 1), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        balance = self._coin.balance_of(accounts[4])
        reward = int((100 - self._proportional_reward_rate) *
                     self._tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(self._proportional_reward_rate *
                          self._tax / 100)
        burned[now] = self._tax - reward
        deposit_4[now] = int(balance * self._deposit_rate / 100)
        self.assertEqual(acb.current_epoch_start,
                         acb.get_timestamp() - self._epoch_duration)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 3),
            self._default_level, 1),
                         (True, False, deposit_4[now],
                          deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = self._coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 3),
            self._default_level, 1), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        balance = self._coin.balance_of(accounts[4])
        coin_supply = self._coin.total_supply
        burned[now] = deposit_4[(now - 2) % 3] + self._tax
        deposit_4[now] = int(balance * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 4),
            self._default_level, 3), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance - deposit_4[now])
        balance = self._coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 4),
            self._default_level, 2), (False, False, 0, 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         0)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        balance = self._coin.balance_of(accounts[4])
        coin_supply = self._coin.total_supply
        reward = int((100 - self._proportional_reward_rate) *
                     self._tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(self._proportional_reward_rate *
                          self._tax / 100)
        burned[now] = self._tax - reward
        deposit_4[now] = int(balance * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 5),
            self._default_level, 4),
                         (True, True, deposit_4[now],
                          deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = self._coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 5),
            self._default_level, 4), (False, False, 0, 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        balance = self._coin.balance_of(accounts[4])
        coin_supply = self._coin.total_supply
        reward = int((100 - self._proportional_reward_rate) *
                     self._tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(self._proportional_reward_rate *
                          self._tax / 100)
        burned[now] = self._tax - reward
        deposit_4[now] = int(balance * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 6),
            self._default_level, 5), (True, True, deposit_4[now],
                                     deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = self._coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 6),
            self._default_level, 5), (False, False, 0, 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        balance = self._coin.balance_of(accounts[4])
        coin_supply = self._coin.total_supply
        reward = int((100 - self._proportional_reward_rate) *
                     self._tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(self._proportional_reward_rate *
                          self._tax / 100)
        burned[now] = self._tax - reward
        deposit_4[now] = int(balance * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 7),
            self._default_level, 6),
                         (True, True, deposit_4[now],
                          deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = self._coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 7),
            self._default_level, 6), (False, False, 0, 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        balance = self._coin.balance_of(accounts[4])
        coin_supply = self._coin.total_supply
        reward = int((100 - self._proportional_reward_rate) *
                     self._tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(self._proportional_reward_rate *
                          self._tax / 100)
        burned[now] = self._tax - reward
        deposit_4[now] = int(balance * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 8),
            self._default_level, 6),
                         (True, False, deposit_4[now],
                          deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = self._coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 8),
            self._default_level, 6), (False, False, 0, 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        balance = self._coin.balance_of(accounts[4])
        coin_supply = self._coin.total_supply
        reward = 0
        burned[now] = deposit_4[(now - 2) % 3] + self._tax - reward
        deposit_4[now] = 0
        self.assertEqual(acb.vote(
            accounts[4], ACB.NULL_HASH, self._default_level, 7),
                         (True, False, deposit_4[now],
                          0, reward, True))
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance - deposit_4[now] + reward)
        balance = self._coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 8),
            self._default_level, 6), (False, False, 0, 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[4]), balance)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         0)

        # 3 commits on the stable level.
        self.reset_balances()

        self._coin.move(accounts[1], accounts[4], 100)
        self._coin.move(accounts[1], accounts[5], 100)
        self.assertEqual(self._coin.balance_of(accounts[5]), 100)
        self.assertEqual(self._coin.balance_of(accounts[6]), 0)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        burned[now] = deposit_4[(now - 2) % 3] + self._tax
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, -1),
            self._default_level, -1), (True, False, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, -1),
            self._default_level, -1),
                         (True, False, deposit_5[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, -1),
            self._default_level, -1),
                         (True, False, deposit_6[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         0)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        burned[now] = deposit_4[(now - 2) % 3] + self._tax
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 1),
            self._default_level, 0), (True, False, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 1),
            self._default_level, 0), (True, False, deposit_5[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 1),
            self._default_level, 0), (True, False, deposit_6[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         0)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        burned[now] = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                          deposit_6[(now - 2) % 3] + self._tax)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 2),
            self._default_level, 1), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 2),
            self._default_level, 1), (True, True, deposit_5[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 2),
            self._default_level, 1), (True, True, deposit_6[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         0)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 3),
            self._default_level, 2),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 3),
            self._default_level, 2),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 3),
            self._default_level, 2),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 4),
            self._default_level, 3),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 4),
            self._default_level, 3),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 4),
            self._default_level, 3),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        self.reset_balances()
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 5),
            self._default_level, 4),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 5),
            self._default_level, 4),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 5),
            self._default_level, 4),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(deposit_4[now], 0)
        self.assertEqual(deposit_5[now], 0)
        self.assertEqual(deposit_6[now], 0)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 6),
            self._default_level, 5),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 6),
            self._default_level, 5),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 6),
            self._default_level, 5),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 7),
            self._default_level, 6),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 7),
            self._default_level, 6),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 7),
            self._default_level, 5),
                         (True, False, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = deposit_6[(now - 2) % 3] + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 8),
            self._default_level, 6),
                         (True, False, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 8),
            self._default_level, 6),
                         (True, False, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 8),
            self._default_level, 7), (True, True, deposit_6[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] +
                         reward_6)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                        self._tax)
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (1 * 100))
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        if deposit_6[(now - 2) % 3] > 0:
            reward_6 = int(self._proportional_reward_rate *
                           reward_total / 100)
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 9),
            self._default_level, 0), (True, False, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 9),
            self._default_level, 0), (True, False, deposit_5[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 9),
            self._default_level, 0),
                         (True, False, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                        deposit_6[(now - 2) % 3] + self._tax)
        constant_reward = 0
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        burned[now] = reward_total
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 10),
            self._default_level, 9), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 10),
            self._default_level, 9), (True, True, deposit_5[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 10),
            self._default_level, 9), (True, True, deposit_6[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         0)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2 + deposit_4[(now - 2) % 3])
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 11),
            self._default_level, 10),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 11),
            self._default_level, 10),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = deposit_4[(now - 2) % 3] + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_5[(now - 2) % 3] + deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward + deposit_5[(now - 2) % 3])
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 12),
            self._default_level, 11),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = deposit_5[(now - 2) % 3] + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (1 * 100))
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 0 + deposit_6[(now - 2) % 3])
        deposit13 = int(
            self._coin.balance_of(accounts[1]) * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[1], self._acb.encrypt(
                accounts[1], self._default_level, -1),
            self._default_level, -1), (True, False, deposit13, 0, 0, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        burned[now] = deposit_6[(now - 2) % 3] + self._tax
        deposit14 = int(
            self._coin.balance_of(accounts[1]) * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[1], self._acb.encrypt(
                accounts[1], self._default_level, -1),
            self._default_level, -1), (True, True, deposit14, 0, 0, True))
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         0)

        # 3 commits on the stable level and another level.

        # 0, stable, stable
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()
        self.reset_balances()

        self._coin.move(accounts[1], accounts[4], 10000)
        self._coin.move(accounts[1], accounts[5], 2000)
        self._coin.move(accounts[1], accounts[5], 8100)

        coin_supply = self._coin.total_supply
        reward_total = deposit13 + self._tax
        constant_reward = 0
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        burned[now] = reward_total
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], 0, 1),
            self._default_level, 0), (True, False, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 1),
            self._default_level, 0), (True, False, deposit_5[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 1),
            self._default_level, 0), (True, False, deposit_6[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = deposit14 + self._tax
        constant_reward = 0
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        burned[now] = reward_total
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 2),
            0, 1), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self._level_max)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 2),
            self._default_level, 1), (True, True, deposit_5[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 2),
            self._default_level, 1), (True, True, deposit_6[now], 0, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         0)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reclaim_4 = 0
        in_threshold = False
        if self._default_level - 0 <= self._reclaim_threshold:
            in_threshold = True
            reclaim_4 = deposit_4[(now - 2) % 3]
        reward_total = (deposit_4[(now - 2) % 3] - reclaim_4 +
                        self._tax)
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_5[(now - 2) % 3] + deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 3),
            self._default_level, 2),
                         (True, True, deposit_4[now], reclaim_4, 0, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + reclaim_4)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 3),
            self._default_level, 2),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 3),
            self._default_level, 2),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        # 0, 0, stable
        tmp_deposit_rate = self._deposit_rate
        if self._deposit_rate == 0:
            self._deposit_rate = 1
            ACB.DEPOSIT_RATE = 1

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()
        self.reset_balances()

        self._coin.move(accounts[1], accounts[4], 2900)
        self._coin.move(accounts[1], accounts[5], 7000)
        self._coin.move(accounts[1], accounts[6], 10000)

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], 0, 4), self._default_level, 3),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], 0, 4), self._default_level, 3),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 4), self._default_level, 3),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        self._deposit_rate = tmp_deposit_rate
        ACB.DEPOSIT_RATE = tmp_deposit_rate

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                       reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 5), 0, 4),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                         reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 5), 0, 4),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                         reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 5), self._default_level, 4),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reclaim_4 = reclaim_5 = 0
        in_threshold = False
        if self._default_level - 0 <= self._reclaim_threshold:
            in_threshold = True
            reclaim_4 = deposit_4[(now - 2) % 3]
            reclaim_5 = deposit_5[(now - 2) % 3]
        reward_total = (deposit_4[(now - 2) % 3] - reclaim_4 +
                        deposit_5[(now - 2) % 3] - reclaim_5 +
                        self._tax)
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (1 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total =  deposit_6[(now - 2) % 3]
        if deposit_total > 0:
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 6), self._default_level, 5),
                         (True, True, deposit_4[now], reclaim_4, 0, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + reclaim_4)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 6), self._default_level, 5),
                         (True, True, deposit_5[now], reclaim_5, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + reclaim_5)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 6), self._default_level, 5),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        # stable, stable, level_max - 1
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()
        self.reset_balances()

        self._coin.move(accounts[1], accounts[4], 3100)
        self._coin.move(accounts[1], accounts[5], 7000)
        self._coin.move(accounts[1], accounts[6], 10000)

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 7),
            self._default_level, 6),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 7),
            self._default_level, 6),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._level_max - 1, 7),
            self._default_level, 6),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 8),
            self._default_level, 7),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 8),
            self._default_level, 7),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 8),
            self._level_max - 1, 7),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reclaim_6 = 0
        in_threshold = False
        if (self._level_max - 1 - self._default_level <=
            self._reclaim_threshold):
            in_threshold = True
            reclaim_6 = deposit_6[(now - 2) % 3]
        reward_total = (deposit_6[(now - 2) % 3] - reclaim_6 +
                        self._tax)
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3]
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 9),
            self._default_level, 8),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 9),
            self._default_level, 8),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 9),
            self._default_level, 8),
                         (True, True, deposit_6[now], reclaim_6, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + reclaim_6)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        # stable, level_max - 1, level_max - 1
        tmp_deposit_rate = self._deposit_rate
        if self._deposit_rate == 0:
            self._deposit_rate = 1
            ACB.DEPOSIT_RATE = 1

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()
        self.reset_balances()

        self._coin.move(accounts[1], accounts[4], 10000)
        self._coin.move(accounts[1], accounts[5], 7000)
        self._coin.move(accounts[1], accounts[6], 2900)

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 10),
            self._default_level, 9),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._level_max - 1, 10),
            self._default_level, 9),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._level_max - 1, 10),
            self._default_level, 9),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        self._deposit_rate = tmp_deposit_rate
        ACB.DEPOSIT_RATE = tmp_deposit_rate

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 11),
            self._default_level, 10),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 11),
            self._level_max - 1, 10),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 11),
            self._level_max - 1, 10),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reclaim_5 = reclaim_6 = 0
        in_threshold = False
        if (self._level_max - 1 - self._default_level <=
            self._reclaim_threshold):
            in_threshold = True
            reclaim_5 = deposit_5[(now - 2) % 3]
            reclaim_6 = deposit_6[(now - 2) % 3]
        reward_total = (deposit_5[(now - 2) % 3] - reclaim_5 +
                        deposit_6[(now - 2) % 3] - reclaim_6 +
                        self._tax)
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (1 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = deposit_4[(now - 2) % 3]
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 12),
            self._default_level, 11),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 12),
            self._default_level, 11),
                         (True, True, deposit_5[now], reclaim_5, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + reclaim_5)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 12),
            self._default_level, 11),
                         (True, True, deposit_6[now], reclaim_6, 0, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + reclaim_6)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        # stable, stable, level_max - 1; deposit is the same
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()
        self.reset_balances()

        self._coin.move(accounts[1], accounts[4], 10000)
        self._coin.move(accounts[1], accounts[5], 7000)
        self._coin.move(accounts[1], accounts[6], 3000)

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._level_max - 1, 13),
            self._default_level, 12),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 13),
            self._default_level, 12),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 13),
            self._default_level, 12),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 14),
            self._level_max - 1, 13),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 14),
            self._default_level, 13),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 14),
            self._default_level, 13),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reclaim_4 = 0
        in_threshold = False
        if (self._level_max - 1 - self._default_level <=
            self._reclaim_threshold):
            in_threshold = True
            reclaim_4 = deposit_4[(now - 2) % 3]
        reward_total = (deposit_4[(now - 2) % 3] - reclaim_4 +
                        self._tax)
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_5[(now - 2) % 3] + deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_5 = int(self._proportional_reward_rate *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(self._proportional_reward_rate *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], self._default_level, 15),
            self._default_level, 14),
                         (True, True, deposit_4[now], reclaim_4, 0, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + reclaim_4)
        balance_5 = self._coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[5], self._acb.encrypt(
                accounts[5], self._default_level, 15),
            self._default_level, 14),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = self._coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[6], self._acb.encrypt(
                accounts[6], self._default_level, 15),
            self._default_level, 14),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(self._coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        # all levels
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()
        self.reset_balances()

        coin_supply = self._coin.total_supply
        reward_total = 0 + self._tax
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1 + deposit_5[(now - 2) % 3] +
                          deposit_6[(now - 2) % 3])
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], 0, 4444),
            self._default_level, 15),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)
        self.set_tax()

        coin_supply = self._coin.total_supply
        reward_total = (deposit_5[(now - 2) % 3] + deposit_6[(now - 2) % 3] +
                        self._tax)
        constant_reward = int((100 - self._proportional_reward_rate) *
                              reward_total / (1 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = deposit_4[(now - 2) % 3]
        if deposit_total > 0:
            reward_4 = int(self._proportional_reward_rate *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
        burned[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1)
        balance_4 = self._coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
        self.assertEqual(acb.vote(
            accounts[4], self._acb.encrypt(
                accounts[4], 1, 4444), 0, 4444),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self._default_level)
        self.assertEqual(self._coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        self.assertEqual(self._coin.total_supply,
                         coin_supply -
                         burned[(now - 1) % 3])
        self.assertEqual(self._open_market_operation.coin_budget,
                         self.mint_at_default_level())

        self.assertEqual(self._bond.total_supply, 0)
        self.assertEqual(self._bond_operation.bond_budget, 0)
        self.assertEqual(self._bond_operation.update_bond_budget(
            -self._bond_price * 2, self._oracle.epoch_id), 0)
        self.assertEqual(self._bond.total_supply, 0)
        self.assertEqual(self._bond_operation.bond_budget, 2)
        t0 = self._oracle.epoch_id + self._bond_redemption_period
        self.assertEqual(acb.purchase_bonds(accounts[1], 2), t0)
        self.assertEqual(self._bond.total_supply, 2)

        tax_total = 0
        period = 1
        valid_bond_supply = 0
        for level in range(2, self._level_max + 2):
            now = (now + 1) % 3
            acb.set_timestamp(acb.get_timestamp() + self._epoch_duration)

            self.assertEqual(self._bond.total_supply, 2)
            valid_bond_supply = 2 if (
                period < self._bond_redemption_period +
                self._bond_redeemable_period) else 0
            coin_supply = self._coin.total_supply
            reward_total = tax_total
            constant_reward = int((100 - self._proportional_reward_rate) *
                                  reward_total / (1 * 100))
            reward_4 = 0
            deposit_total = deposit_4[(now - 2) % 3]
            if deposit_total > 0:
                reward_4 = int(self._proportional_reward_rate *
                               reward_total * deposit_4[(now - 2) % 3] /
                               (deposit_total * 100))
            burned[now] = (reward_total - reward_4 - constant_reward * 1)
            balance_4 = self._coin.balance_of(accounts[4])
            deposit_4[now] = int(balance_4 * self._deposit_rate / 100)
            self.assertEqual(acb.vote(
                accounts[4], self._acb.encrypt(
                    accounts[4], level, 4444), level - 1, 4444),
                             (True,
                              True if level < self._level_max + 1 else False,
                              deposit_4[now],
                              deposit_4[(now - 2) % 3],
                              reward_4 + constant_reward,
                              True))
            
            coin_budget = 0
            bond_budget = 0
            delta = int(self._coin.total_supply *
                        (self._level_to_exchange_rate[level - 2] - 10) / 10)
            delta = int(delta * self._damping_factor / 100)
            if delta == 0:
                coin_budget = 0
                issued_bonds = 0
            elif delta > 0:
                necessary_bonds = int(
                    delta / self._bond_redemption_price)
                if necessary_bonds >= valid_bond_supply:
                    coin_budget = ((necessary_bonds - valid_bond_supply) *
                                   self._bond_redemption_price)
                    bond_budget = -valid_bond_supply
                else:
                    coin_budget = 0
                    bond_budget = -necessary_bonds
            else:
                coin_budget = delta if level == 2 else 0
                bond_budget = int(-delta / self._bond_price)
            period += 1

            self.assertEqual(acb.oracle_level, level - 2)
            self.assertEqual(self._coin.balance_of(accounts[4]),
                             balance_4 - deposit_4[now] +
                             deposit_4[(now - 2) % 3] +
                             reward_4 + constant_reward)
            self.assertEqual(self._coin.total_supply,
                             coin_supply -
                             burned[(now - 1) % 3])
            self.assertEqual(self._bond.total_supply, 2)
            self.assertEqual(self._bond_operation.bond_budget, bond_budget)
            self.assertEqual(
                self._bond_operation.valid_bond_supply(self._oracle.epoch_id),
                valid_bond_supply)
            self.assertEqual(self._open_market_operation.coin_budget,
                             coin_budget)

            tax_total = 0
            self.assertEqual(self._coin.balance_of(self._coin.tax_account), 0)
            for transfer in [0, 1234, 1111]:
                tax = int(transfer * self._tax_rate / 100)
                balance_1 = self._coin.balance_of(accounts[1])
                balance_2 = self._coin.balance_of(accounts[2])
                balance_tax = self._coin.balance_of(self._coin.tax_account)
                self._coin.transfer(accounts[1], accounts[2], transfer)
                self.assertEqual(self._coin.balance_of(accounts[1]),
                                 balance_1 - transfer)
                self.assertEqual(self._coin.balance_of(accounts[2]),
                                 balance_2 + transfer - tax)
                self.assertEqual(self._coin.balance_of(self._coin.tax_account),
                                 balance_tax + tax)
                tax_total += tax

        now += 1
        self.assertEqual(acb.redeem_bonds(accounts[1], [t0]),
                         valid_bond_supply)

        self.reset_balances();
        self.assertEqual(self._bond.total_supply, 0)
        self.assertEqual(self._coin.total_supply,
                         self._initial_coin_supply + deposit_4[(now - 2) % 3] +
                         deposit_4[(now - 1) % 3] + burned[(now - 1) % 3] +
                         tax_total)
        
        # bond operation
        self.reset_balances();
        self._coin.move(accounts[1], accounts[2], self._bond_price * 60)
        self.assertEqual(self._bond_operation.update_bond_budget(
            -self._bond_price * 100, self._oracle.epoch_id), 0)
        self.assertEqual(self._bond.total_supply, 0)
        self.assertEqual(self._bond_operation.bond_budget, 100)
        t1 = self._oracle.epoch_id + self._bond_redemption_period
        with self.assertRaises(Exception):
            acb.purchase_bonds(accounts[1], 0)
        with self.assertRaises(Exception):
            acb.purchase_bonds(accounts[1], 101)
        with self.assertRaises(Exception):
            acb.purchase_bonds(accounts[2], 61)
        self.assertEqual(acb.purchase_bonds(accounts[1], 10), t1)
        self.assertEqual(self._bond.total_supply, 10)
        self.assertEqual(self._bond_operation.bond_budget, 90)
        self.assertEqual(acb.purchase_bonds(accounts[2], 20), t1)
        self.assertEqual(self._bond.total_supply, 30)
        self.assertEqual(self._bond_operation.bond_budget, 70)
        
        self.advance_epoch(1)
        self.assertEqual(self._bond_operation.update_bond_budget(
            -self._bond_price * 70, self._oracle.epoch_id), 0)
        self.assertEqual(self._bond.total_supply, 30)
        self.assertEqual(self._bond_operation.bond_budget, 70)
        t2 = self._oracle.epoch_id + self._bond_redemption_period
        self.assertEqual(acb.purchase_bonds(accounts[1], 30), t2)
        self.assertEqual(self._bond.total_supply, 60)
        self.assertEqual(self._bond_operation.bond_budget, 40)
        self.assertEqual(acb.purchase_bonds(accounts[2], 40), t2)
        self.assertEqual(self._bond.total_supply, 100)
        self.assertEqual(self._bond_operation.bond_budget, 0)
        with self.assertRaises(Exception):
            acb.purchase_bonds(accounts[1], 1)
        with self.assertRaises(Exception):
            acb.purchase_bonds(accounts[2], 1)
        self.advance_epoch(self._bond_redemption_period - 1)
        
        self.assertEqual(self._bond_operation.update_bond_budget(
            self._bond_redemption_price * 1, self._oracle.epoch_id), 0)
        self.assertEqual(self._bond_operation.bond_budget, -1)
        self.assertEqual(self._bond_operation.update_bond_budget(
            self._bond_redemption_price * 100, self._oracle.epoch_id), 0)
        self.assertEqual(self._bond_operation.bond_budget, -100)
        self.assertEqual(self._bond_operation.update_bond_budget(
            self._bond_redemption_price * 101, self._oracle.epoch_id),
            self._bond_redemption_price)
        self.assertEqual(self._bond_operation.bond_budget, -100)
        self.assertEqual(self._bond_operation.update_bond_budget(
            self._bond_redemption_price * 40, self._oracle.epoch_id), 0)
        self.assertEqual(self._bond_operation.bond_budget, -40)
        
        self.assertEqual(acb.redeem_bonds(accounts[1], [t1, t2]), 40)
        self.assertEqual(self._bond.total_supply, 60)
        self.assertEqual(self._bond_operation.bond_budget, -10)
        self.assertEqual(acb.redeem_bonds(accounts[2], [t1, t2]), 30)
        self.assertEqual(self._bond.total_supply, 30)
        self.assertEqual(self._bond_operation.bond_budget, 0)
        
        self.advance_epoch(1)
        self.assertEqual(acb.redeem_bonds(accounts[1], [t1, t2]), 0)
        self.assertEqual(self._bond.total_supply, 30)
        self.assertEqual(self._bond_operation.bond_budget, 0)
        self.assertEqual(acb.redeem_bonds(accounts[2], [t1, t2]), 30)
        self.assertEqual(self._bond.total_supply, 0)
        self.assertEqual(self._bond_operation.bond_budget, 0)
        self.assertEqual(acb.redeem_bonds(accounts[2], [t1, t2]), 0)

        # open market operation
        self.reset_balances();
        self._open_market_operation.update_coin_budget(0)
        with self.assertRaises(Exception):
            acb.purchase_coins(accounts[1], 0)
        with self.assertRaises(Exception):
            acb.sell_coins(accounts[1], 0)

        self._open_market_operation.update_coin_budget(100)
        price = self._open_market_operation.start_price
        with self.assertRaises(Exception):
            acb.sell_coins(accounts[1], 0)
        balance = self._coin.balance_of(accounts[1])
        eth_balance = self._open_market_operation.eth_balance
        self.assertEqual(
            acb.purchase_coins(accounts[1], 0), (0, 0))
        self.assertEqual(
            acb.purchase_coins(accounts[1], 100 * price), (100 * price, 100))
        self.assertEqual(self._coin.balance_of(accounts[1]), balance + 100)
        self.assertEqual(self._open_market_operation.eth_balance,
                         eth_balance + 100 * price)
        
        self._open_market_operation.update_coin_budget(100)
        price = self._open_market_operation.start_price
        with self.assertRaises(Exception):
            acb.sell_coins(accounts[1], 0)
        balance = self._coin.balance_of(accounts[1])
        eth_balance = self._open_market_operation.eth_balance
        self.assertEqual(
            acb.purchase_coins(accounts[1], 40 * price), (40 * price, 40))
        self.assertEqual(self._coin.balance_of(accounts[1]), balance + 40)
        self.assertEqual(self._open_market_operation.eth_balance,
                         eth_balance + 40 * price)
        self.assertEqual(
            acb.purchase_coins(accounts[1], 200 * price), (60 * price, 60))
        self.assertEqual(self._coin.balance_of(accounts[1]), balance + 100)
        self.assertEqual(self._open_market_operation.eth_balance,
                         eth_balance + 100 * price)
        with self.assertRaises(Exception):
            acb.purchase_coins(accounts[1], 10)
        
        self._open_market_operation.update_coin_budget(-100)
        price = self._open_market_operation.start_price
        with self.assertRaises(Exception):
            acb.purchase_coins(accounts[1], 0)
        balance = self._coin.balance_of(accounts[1])
        eth_balance = self._open_market_operation.eth_balance
        self.assertEqual(
            acb.sell_coins(accounts[1], 0), (0, 0))
        self.assertEqual(
            acb.sell_coins(accounts[1], 100), (100 * price, 100))
        self.assertEqual(self._coin.balance_of(accounts[1]), balance - 100)
        self.assertEqual(self._open_market_operation.eth_balance,
                         eth_balance - 100 * price)
        
        self._open_market_operation.update_coin_budget(-100)
        price = self._open_market_operation.start_price
        with self.assertRaises(Exception):
            acb.purchase_coins(accounts[1], 0)
        balance = self._coin.balance_of(accounts[1])
        eth_balance = self._open_market_operation.eth_balance
        self.assertEqual(
            acb.sell_coins(accounts[1], 40), (40 * price, 40))
        self.assertEqual(self._coin.balance_of(accounts[1]), balance - 40)
        self.assertEqual(self._open_market_operation.eth_balance,
                         eth_balance - 40 * price)
        self.assertEqual(
            acb.sell_coins(accounts[1], 200), (60 * price, 60))
        self.assertEqual(self._coin.balance_of(accounts[1]), balance - 100)
        self.assertEqual(self._open_market_operation.eth_balance,
                         eth_balance - 100 * price)
        with self.assertRaises(Exception):
            acb.sell_coins(accounts[1], 10)
        

    def advance_epoch(self, advance):
        for i in range(advance):
            self._acb.set_timestamp(
                self._acb.get_timestamp() + self._epoch_duration)
            self._acb.vote(self.accounts[7], self._acb.encrypt(
                self.accounts[7], self._level_max, 7777),
                     self._level_max, 7777)

    def check_redemption_epochs(self, bond, account, expected):
        count = bond.number_of_redemption_epochs_owned_by(account)
        self.assertEqual(count, len(expected))

        with self.assertRaises(Exception):
            bond.get_redemption_epoch_owned_by(account, count)

        for index in range(count):
            self.assertTrue(
                bond.get_redemption_epoch_owned_by(account, index)
                in expected)

    def set_tax(self):
        self.assertEqual(self._coin.balance_of(
            self._coin.tax_account), 0)
        self._coin.mint(self._coin.tax_account, self._tax)

    def mint_at_default_level(self):
        delta = int(self._coin.total_supply * (11 - 10) / 10)
        delta = int(delta * self._damping_factor / 100)
        mint = (int(delta / self._bond_redemption_price) *
                self._bond_redemption_price)
        assert(delta > 0)
        self.assertEqual(self._bond.total_supply, 0)
        self.assertEqual(self._bond_operation.bond_budget, 0)
        return mint

    def reset_balances(self):
        for account in self.accounts:
            self._coin.burn(account, self._coin.balance_of(account))
        self._coin.mint(self.accounts[1], self._initial_coin_supply)


def main():
    bond_price = 996
    bond_redemption_price = 1000
    bond_redemption_period = 12
    bond_redeemable_period = 2
    epoch_duration = 7 * 24 * 60 * 60
    proportional_reward_rate = 90
    deposit_rate = 10
    damping_factor = 10
    reclaim_threshold = 1
    tax = 12345
    level_to_exchange_rate = [1, 11, 20]
    price_change_interval = int(epoch_duration / 21)
    price_change_percentage = 20
    start_price_multiplier = 3

    test = ACBUnitTest(
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
        tax,
        price_change_interval,
        price_change_percentage,
        start_price_multiplier)
    test.run()
    test.teardown()

    for (bond_price, bond_redemption_price) in [
            (1, 3), (996, 1000), (1000, 1000)]:
        for bond_redemption_period in [1, 12]:
            for bond_redeemable_period in [1, 2, 12]:
                for epoch_duration in [1, 7 * 24 * 60 * 60]:
                    for proportional_reward_rate in [0, 1, 90, 100]:
                        for deposit_rate in [0, 10, 100]:
                            for damping_factor in [1, 10, 100]:
                                for level_to_exchange_rate in [
                                        [9, 11, 12],
                                        [0, 1, 10, 11, 12],
                                        [6, 7, 8, 9, 10, 11, 12, 13, 14]]:
                                    for reclaim_threshold in [0, 1, len(
                                            level_to_exchange_rate) - 1]:
                                        for tax in [0, 12345]:
                                            price_change_interval = int(
                                                epoch_duration / 21) + 1
                                            price_change_percentage = 20
                                            start_price_multiplier = 3
                                            test = ACBUnitTest(
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
                                                tax,
                                                price_change_interval,
                                                price_change_percentage,
                                                start_price_multiplier)
                                            test.run()
                                            test.teardown()


if __name__ == "__main__":
    main()
