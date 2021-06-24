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
                 tax):
        super().__init__()

        print('bond_price=%d redemp_price=%d redemp_period=%d '
              'redeem_period=%d epoch_dur=%d reward_rate=%d '
              'deposit_rate=%d damping=%d reclaim=%d tax=%d' %
              (bond_price,
               bond_redemption_price,
               bond_redemption_period,
               bond_redeemable_period,
               epoch_duration,
               proportional_reward_rate,
               deposit_rate,
               damping_factor,
               reclaim_threshold,
               tax))
        print('exchange_rate=', end='')
        print(level_to_exchange_rate)

        self.accounts = ['0x0000', '0x1000', '0x2000', '0x3000', '0x4000',
                         '0x5000', '0x6000', '0x7000']

        coin = JohnLawCoin(self.accounts[1])
        bond = JohnLawBond()
        self.oracle = Oracle()
        logging = Logging()
        self.acb = ACB(coin, bond, self.oracle, logging)
        level_max = len(level_to_exchange_rate)
        self.oracle.override_constants_for_testing(
            level_max, reclaim_threshold, proportional_reward_rate)
        self.acb.override_constants_for_testing(
            bond_price, bond_redemption_price, bond_redemption_period,
            bond_redeemable_period, epoch_duration, deposit_rate,
            damping_factor, level_to_exchange_rate)

        self.initial_coin_supply = JohnLawCoin.INITIAL_COIN_SUPPLY
        self.bond_price = ACB.BOND_PRICE
        self.tax_rate = JohnLawCoin.TAX_RATE
        self.tax = tax

        for level in range(Oracle.LEVEL_MAX):
            if (ACB.LEVEL_TO_EXCHANGE_RATE[level] ==
                1.1 * ACB.EXCHANGE_RATE_DIVISOR):
                self.default_level = level
        assert(0 < self.default_level and
               self.default_level < Oracle.LEVEL_MAX - 1)

    def teardown(self):
        pass

    def run(self):
        acb = self.acb
        accounts = self.accounts

        # initial coin supply
        self.assertEqual(acb.coin.balance_of(accounts[1]),
                         self.initial_coin_supply)
        self.assertEqual(acb.coin.balance_of(accounts[2]), 0)
        self.assertEqual(acb.coin.balance_of(accounts[3]), 0)

        # transfer
        with self.assertRaises(Exception):
            acb.coin.transfer(accounts[4], accounts[1], 1)
        acb.coin.transfer(accounts[1], accounts[2], 0)
        with self.assertRaises(Exception):
            acb.coin.transfer(accounts[2], accounts[1], 1)
        with self.assertRaises(Exception):
            acb.coin.transfer(accounts[1], accounts[2],
                              self.initial_coin_supply + 1)
        acb.coin.transfer(accounts[1], accounts[2], 1)
        acb.coin.transfer(accounts[1], accounts[3], 10)
        acb.coin.transfer(accounts[3], accounts[2], 5)
        self.assertEqual(acb.coin.balance_of(accounts[1]),
                         self.initial_coin_supply - 11)
        self.assertEqual(acb.coin.balance_of(accounts[2]), 6)
        self.assertEqual(acb.coin.balance_of(accounts[3]), 5)
        acb.coin.transfer(accounts[2], accounts[2], 5)
        self.assertEqual(acb.coin.balance_of(accounts[1]),
                         self.initial_coin_supply - 11)
        self.assertEqual(acb.coin.balance_of(accounts[2]), 6)
        self.assertEqual(acb.coin.balance_of(accounts[3]), 5)
        acb.coin.transfer(accounts[2], accounts[3], 0)
        with self.assertRaises(Exception):
            acb.coin.transfer(accounts[2], accounts[3], 7)
        acb.coin.transfer(accounts[2], accounts[3], 6)
        self.assertEqual(acb.coin.balance_of(accounts[1]),
                         self.initial_coin_supply - 11)
        self.assertEqual(acb.coin.balance_of(accounts[2]), 0)
        self.assertEqual(acb.coin.balance_of(accounts[3]), 11)
        acb.coin.transfer(accounts[3], accounts[1], 11)
        self.assertEqual(acb.coin.balance_of(accounts[1]),
                         self.initial_coin_supply)
        self.assertEqual(acb.coin.balance_of(accounts[2]), 0)
        self.assertEqual(acb.coin.balance_of(accounts[3]), 0)
        self.assertEqual(acb.coin.total_supply, self.initial_coin_supply)
        acb.coin.transfer(accounts[1], accounts[2], 1000)
        self.assertEqual(acb.coin.balance_of(accounts[1]),
                         self.initial_coin_supply - 1000)
        self.assertEqual(acb.coin.balance_of(accounts[2]), 990)
        self.assertEqual(acb.coin.balance_of(acb.coin.tax_account), 10)
        acb.coin.transfer(accounts[2], accounts[1], 990)
        self.assertEqual(acb.coin.balance_of(accounts[1]),
                         self.initial_coin_supply - 19)
        self.assertEqual(acb.coin.balance_of(accounts[2]), 0)
        self.assertEqual(acb.coin.balance_of(acb.coin.tax_account), 19)
        acb.coin.transfer(acb.coin.tax_account, accounts[1], 19)
        self.assertEqual(acb.coin.balance_of(accounts[1]),
                         self.initial_coin_supply)
        self.assertEqual(acb.coin.balance_of(accounts[2]), 0)
        self.assertEqual(acb.coin.balance_of(accounts[3]), 0)
        self.assertEqual(acb.coin.total_supply, self.initial_coin_supply)

        # _control_supply
        acb.oracle_level = Oracle.LEVEL_MAX - 1
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE - 1), 0)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(ACB.BOND_REDEMPTION_PRICE),
                         ACB.BOND_REDEMPTION_PRICE)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE + 1), ACB.BOND_REDEMPTION_PRICE)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 10),
                         ACB.BOND_REDEMPTION_PRICE * 10)
        self.assertEqual(acb.bond_budget, 0)

        self.assertEqual(acb._control_supply(-(self.bond_price - 1)), 0)
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(-self.bond_price), 0)
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 1)
        self.assertEqual(acb._control_supply(0), 0)
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(-self.bond_price * 99), 0)
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 99)
        self.assertEqual(acb._control_supply(0), 0)
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(-self.bond_price * 100), 0)
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 100)
        
        self.assertEqual(acb.purchase_bonds(accounts[1], 50),
                         acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD)
        self.assertEqual(acb.purchase_bonds(accounts[1], 50),
                         acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD)
        self.assertEqual(acb.bond.total_supply, 100)
        self.assertEqual(acb.bond_budget, 0)

        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE - 1), 0)
        self.assertEqual(acb._control_supply(ACB.BOND_REDEMPTION_PRICE), 0)
        self.assertEqual(acb.bond_budget, -1)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE + 1), 0)
        self.assertEqual(acb.bond_budget, -1)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 68), 0)
        self.assertEqual(acb.bond_budget, -68)
        self.assertEqual(acb._control_supply(0), 0)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 30), 0)
        self.assertEqual(acb.bond_budget, -30)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE - 1), 0)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 200),
                         ACB.BOND_REDEMPTION_PRICE * 100)
        self.assertEqual(acb.bond_budget, -100)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 100), 0)
        self.assertEqual(acb.bond_budget, -100)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 100), 0)
        self.assertEqual(acb.bond_budget, -100)
        
        self.assertEqual(acb._control_supply(-self.bond_price * 100), 0)
        self.assertEqual(acb.bond.total_supply, 100)
        self.assertEqual(acb.bond_budget, 100)

        self.assertEqual(acb.purchase_bonds(accounts[1], 50),
                         acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD)
        self.assertEqual(acb.purchase_bonds(accounts[1], 50),
                         acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD)
        self.assertEqual(acb.bond.total_supply, 200)
        self.assertEqual(acb.bond_budget, 0)

        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 30 - 1), 0)
        self.assertEqual(acb.bond_budget, -29)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 30), 0)
        self.assertEqual(acb.bond_budget, -30)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 30 + 1), 0)
        self.assertEqual(acb.bond_budget, -30)
        self.assertEqual(acb._control_supply(
            ACB.BOND_REDEMPTION_PRICE * 210),
                         ACB.BOND_REDEMPTION_PRICE * 10)
        self.assertEqual(acb.bond_budget, -200)

        self.assertEqual(acb.redeem_bonds(
            accounts[1],
            [acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD]), 200)
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 0)

        # timestamp
        self.assertEqual(acb.get_timestamp(), 0)
        acb.set_timestamp(ACB.EPOCH_DURATION)
        self.assertEqual(acb.get_timestamp(), ACB.EPOCH_DURATION)
        with self.assertRaises(Exception):
            acb.set_timestamp(ACB.EPOCH_DURATION - 1)
        with self.assertRaises(Exception):
            acb.set_timestamp(ACB.EPOCH_DURATION)
        with self.assertRaises(Exception):
            acb.set_timestamp(0)

        if (ACB.BOND_PRICE >= 2 and
            ACB.BOND_REDEMPTION_PRICE >= 2 and
            ACB.BOND_REDEMPTION_PERIOD >= 3 and
            ACB.BOND_REDEEMABLE_PERIOD >= 3 and
            ACB.EPOCH_DURATION >= 2):

            # purchase_bonds
            self.assertEqual(acb._control_supply(-self.bond_price * 80), 0)
            self.assertEqual(acb.bond.total_supply, 0)
            self.assertEqual(acb.bond_budget, 80)
        
            coin_supply = acb.coin.total_supply

            self.advance_epoch(ACB.EPOCH_DURATION)
            t1 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

            acb.coin.move(accounts[1], accounts[2], self.bond_price * 30)
            acb.coin.move(accounts[1], accounts[3], self.bond_price * 50)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[4], 1)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[5], 1)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[1], 0)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[1], 81)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[2], 0)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[2], 81)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[2], 31)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[3], 0)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[3], 81)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[3], 51)

            self.assertEqual(acb.purchase_bonds(accounts[2], 1), t1)
            self.assertEqual(acb.bond.total_supply, 1)
            self.assertEqual(acb.bond_budget, 79)
            self.assertEqual(acb.bond.balance_of(accounts[2], t1), 1)
            self.check_redemption_epochs(acb.bond, accounts[2], [t1])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply - self.bond_price * 1)
            
            self.assertEqual(acb.purchase_bonds(accounts[2], 10), t1)
            self.assertEqual(acb.bond.total_supply, 11)
            self.assertEqual(acb.bond_budget, 69)
            self.assertEqual(acb.bond.balance_of(accounts[2], t1), 11)
            self.check_redemption_epochs(acb.bond, accounts[2], [t1])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply - self.bond_price * 11)

            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[1], 70)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[3], 70)

            self.advance_epoch(ACB.EPOCH_DURATION)
            t2 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

            self.assertEqual(acb.purchase_bonds(accounts[2], 1), t2)
            self.assertEqual(acb.bond.total_supply, 12)
            self.assertEqual(acb.bond_budget, 68)
            self.assertEqual(acb.bond.balance_of(accounts[2], t2), 1)
            self.check_redemption_epochs(acb.bond, accounts[2], [t1, t2])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply - self.bond_price * 12)

            self.assertEqual(acb.purchase_bonds(accounts[2], 10), t2)
            self.assertEqual(acb.bond.total_supply, 22)
            self.assertEqual(acb.bond_budget, 58)
            self.assertEqual(acb.bond.balance_of(accounts[2], t2), 11)
            self.check_redemption_epochs(acb.bond, accounts[2], [t1, t2])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply - self.bond_price * 22)

            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[1], 59)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[3], 59)

            self.assertEqual(acb.purchase_bonds(accounts[1], 10), t2)
            self.assertEqual(acb.bond.total_supply, 32)
            self.assertEqual(acb.bond_budget, 48)
            self.assertEqual(acb.bond.balance_of(accounts[1], t2), 10)
            self.check_redemption_epochs(acb.bond, accounts[1], [t2])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply - self.bond_price * 32)

            self.advance_epoch(ACB.EPOCH_DURATION)
            t3 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[3], 49)
            self.assertEqual(acb.purchase_bonds(accounts[3], 48), t3)
            self.assertEqual(acb.bond.total_supply, 80)
            self.assertEqual(acb.bond_budget, 0)
            self.assertEqual(acb.bond.balance_of(accounts[3], t3), 48)
            self.check_redemption_epochs(acb.bond, accounts[3], [t3])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply - self.bond_price * 80)

            acb.coin.move(accounts[1], accounts[2], self.bond_price * 10)
            acb.coin.move(accounts[1], accounts[3], self.bond_price * 10)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[2], 1)
            self.assertEqual(acb.bond.total_supply, 80)
            self.assertEqual(acb.bond_budget, 0)
            self.assertEqual(acb.bond.balance_of(accounts[3], t3), 48)
            self.check_redemption_epochs(acb.bond, accounts[3], [t3])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply - self.bond_price * 80)
            with self.assertRaises(Exception):
                acb.purchase_bonds(accounts[3], 1)
            self.assertEqual(acb.bond.total_supply, 80)
            self.assertEqual(acb.bond_budget, 0)
            self.assertEqual(acb.bond.balance_of(accounts[3], t3), 48)
            self.check_redemption_epochs(acb.bond, accounts[3], [t3])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply - self.bond_price * 80)

            self.assertEqual(acb.coin.balance_of(accounts[2]),
                             (30 + 10 - 22) * self.bond_price)
            self.assertEqual(acb.coin.balance_of(accounts[3]),
                             (50 + 10 - 48) * self.bond_price)

            # redeem_bonds
            self.assertEqual(acb.bond.balance_of(accounts[2], t1), 11)
            self.assertEqual(acb.bond.balance_of(accounts[1], t2), 10)
            self.assertEqual(acb.bond.balance_of(accounts[2], t2), 11)
            self.assertEqual(acb.bond.balance_of(accounts[3], t3), 48)
            self.assertEqual(
                acb.bond.number_of_bonds_owned_by(accounts[1]), 10);
            self.assertEqual(
                acb.bond.number_of_bonds_owned_by(accounts[2]), 22);
            self.assertEqual(
                acb.bond.number_of_bonds_owned_by(accounts[3]), 48);
            self.check_redemption_epochs(acb.bond, accounts[1], [t2])
            self.check_redemption_epochs(acb.bond, accounts[2], [t1, t2])
            self.check_redemption_epochs(acb.bond, accounts[3], [t3])

            self.advance_epoch(ACB.EPOCH_DURATION * ACB.BOND_REDEMPTION_PERIOD)
            t4 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

            self.assertEqual(acb.redeem_bonds(accounts[4], [t1]), 0)
            self.assertEqual(acb.redeem_bonds(accounts[2], []), 0)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            balance = acb.coin.balance_of(accounts[2])
            self.assertEqual(acb.bond_budget, 0)
            self.assertEqual(acb.redeem_bonds(accounts[2], [t1]), 11)
            self.assertEqual(acb.bond.balance_of(accounts[2], t1), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t2), 11)
            self.assertEqual(acb.bond.balance_of(accounts[2], t3), 0)
            self.check_redemption_epochs(acb.bond, accounts[2], [t2])
            self.assertEqual(acb.coin.balance_of(accounts[2]),
                             balance + 11 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond_budget, 11)
            self.assertEqual(acb.bond.total_supply, bond_supply - 11)
            self.assertEqual(acb.coin.total_supply, coin_supply +
                             11 * ACB.BOND_REDEMPTION_PRICE)

            self.assertEqual(acb.redeem_bonds(accounts[2], [t2, 123456]), 11)
            self.assertEqual(acb.bond.balance_of(accounts[2], t1), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t2), 0)
            self.check_redemption_epochs(acb.bond, accounts[2], [])
            self.assertEqual(acb.coin.balance_of(accounts[2]),
                             balance + 22 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond_budget, 22)
            self.assertEqual(acb.bond.total_supply, bond_supply - 22)
            self.assertEqual(acb.coin.total_supply, coin_supply +
                             22 * ACB.BOND_REDEMPTION_PRICE)

            self.assertEqual(acb.redeem_bonds(accounts[2], [t3]), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t1), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t2), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t3), 0)
            self.check_redemption_epochs(acb.bond, accounts[2], [])
            self.assertEqual(acb.coin.balance_of(accounts[2]),
                             balance + 22 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond_budget, 22)
            self.assertEqual(acb.bond.total_supply, bond_supply - 22)
            self.assertEqual(acb.coin.total_supply, coin_supply +
                             22 * ACB.BOND_REDEMPTION_PRICE)

            balance = acb.coin.balance_of(accounts[3])
            self.assertEqual(acb.redeem_bonds(accounts[3], [t2, t2, t1]), 0)
            self.assertEqual(acb.bond.balance_of(accounts[3], t1), 0)
            self.assertEqual(acb.bond.balance_of(accounts[3], t2), 0)
            self.assertEqual(acb.bond.balance_of(accounts[3], t3), 48)
            self.check_redemption_epochs(acb.bond, accounts[3], [t3])
            self.assertEqual(acb.coin.balance_of(accounts[3]), balance)
            self.assertEqual(acb.bond_budget, 22)
            self.assertEqual(acb.bond.total_supply, bond_supply - 22)
            self.assertEqual(acb.coin.total_supply, coin_supply +
                             22 * ACB.BOND_REDEMPTION_PRICE)

            self.assertEqual(acb.redeem_bonds(accounts[3], [t3, t3, t3]), 48)
            self.assertEqual(acb.bond.balance_of(accounts[3], t1), 0)
            self.assertEqual(acb.bond.balance_of(accounts[3], t2), 0)
            self.assertEqual(acb.bond.balance_of(accounts[3], t3), 0)
            self.check_redemption_epochs(acb.bond, accounts[3], [])
            self.assertEqual(acb.coin.balance_of(accounts[3]),
                             balance + 48 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond_budget, 70)
            self.assertEqual(acb.bond.total_supply, bond_supply - 70)
            self.assertEqual(acb.coin.total_supply, coin_supply +
                             70 * ACB.BOND_REDEMPTION_PRICE)

            balance = acb.coin.balance_of(accounts[1])
            self.assertEqual(acb.redeem_bonds(accounts[1], [t2]), 10)
            self.assertEqual(acb.bond.balance_of(accounts[1], t2), 0)
            self.assertEqual(acb.bond.number_of_bonds_owned_by(accounts[1]), 0);
            self.assertEqual(acb.bond.number_of_bonds_owned_by(accounts[2]), 0);
            self.assertEqual(acb.bond.number_of_bonds_owned_by(accounts[3]), 0);
            self.check_redemption_epochs(acb.bond, accounts[1], [])
            self.assertEqual(acb.coin.balance_of(accounts[1]),
                             balance + 10 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond_budget, 80)
            self.assertEqual(acb.bond.total_supply, bond_supply - 80)
            self.assertEqual(acb.coin.total_supply, coin_supply +
                             80 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, 0)

            self.assertEqual(acb.bond_budget, 80)
            self.assertEqual(acb._control_supply(-100 * self.bond_price), 0)
            self.assertEqual(acb.bond_budget, 100)

            balance = acb.coin.balance_of(accounts[2])
            acb.coin.move(accounts[2], accounts[1], balance)
            self.assertEqual(acb.coin.balance_of(accounts[2]), 0)
            acb.coin.move(accounts[1], accounts[2], 100 * self.bond_price)
            self.assertEqual(acb.purchase_bonds(accounts[2], 20), t4)
            self.advance_epoch(1)
            t5 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD
            self.assertEqual(acb.purchase_bonds(accounts[2], 20), t5)
            self.advance_epoch(
                ACB.EPOCH_DURATION * ACB.BOND_REDEMPTION_PERIOD - 2)
            t6 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD
            self.assertEqual(acb.purchase_bonds(accounts[2], 20), t6)
            self.advance_epoch(1)
            t7 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD
            self.assertEqual(acb.purchase_bonds(accounts[2], 20), t7)
            self.advance_epoch(ACB.EPOCH_DURATION)
            t8 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD
            self.assertEqual(acb.purchase_bonds(accounts[2], 20), t8)
            self.assertEqual(acb.coin.balance_of(accounts[2]), 0)
            self.assertEqual(t4, t5)
            self.assertNotEqual(t4, t6)
            self.assertEqual(t7 - t4, ACB.BOND_REDEMPTION_PERIOD)
            self.assertEqual(t8 - t7, 1)

            self.assertEqual(acb.bond_budget, 0)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(acb.redeem_bonds(
                accounts[2], [t4, t5, t6, t7, t8]), 40)
            self.assertEqual(acb.bond.balance_of(accounts[2], t4), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t5), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 20)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 20)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 20)
            self.assertEqual(acb.bond.number_of_bonds_owned_by(accounts[1]), 0);
            self.assertEqual(
                acb.bond.number_of_bonds_owned_by(accounts[2]), 60);
            self.assertEqual(
                acb.bond.number_of_bonds_owned_by(accounts[3]), 0);
            self.check_redemption_epochs(acb.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + 40 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, bond_supply - 40)
            self.assertEqual(acb.bond_budget, 40)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(acb.redeem_bonds(accounts[2], [t6, t7, t8]), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 20)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 20)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 20)
            self.check_redemption_epochs(acb.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(acb.coin.total_supply, coin_supply)
            self.assertEqual(acb.bond.total_supply, bond_supply)
            self.assertEqual(acb.bond_budget, 40)

            self.assertEqual(acb._control_supply(
                5 * ACB.BOND_REDEMPTION_PRICE), 0)
            self.assertEqual(acb.bond_budget, -5)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(acb.redeem_bonds(accounts[2], [t6, t7, t8]), 5)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 15)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 20)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 20)
            self.check_redemption_epochs(acb.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + 5 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, bond_supply - 5)
            self.assertEqual(acb.bond_budget, 0)

            self.assertEqual(acb.bond_budget, 0)
            self.assertEqual(acb._control_supply(
                5 * ACB.BOND_REDEMPTION_PRICE), 0)
            self.assertEqual(acb.bond_budget, -5)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(acb.redeem_bonds(accounts[2], [t8, t7, t6]), 5)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 15)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 20)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 15)
            self.check_redemption_epochs(acb.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + 5 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, bond_supply - 5)
            self.assertEqual(acb.bond_budget, 0)

            self.assertEqual(acb.bond_budget, 0)
            self.assertEqual(acb._control_supply(
                5 * ACB.BOND_REDEMPTION_PRICE), 0)
            self.assertEqual(acb.bond_budget, -5)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(acb.redeem_bonds(accounts[2], [t7]), 5)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 15)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 15)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 15)
            self.check_redemption_epochs(acb.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + 5 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, bond_supply - 5)
            self.assertEqual(acb.bond_budget, 0)

            self.advance_epoch(ACB.EPOCH_DURATION * ACB.BOND_REDEMPTION_PERIOD -
                               ACB.EPOCH_DURATION - 1)
            t9 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

            self.assertEqual(acb.bond_budget, 0)
            self.assertEqual(acb._control_supply(
                20 * ACB.BOND_REDEMPTION_PRICE), 0)
            self.assertEqual(acb.bond_budget, -20)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(t9 - t6, ACB.BOND_REDEMPTION_PERIOD)
            self.assertEqual(t6 <= acb.oracle.epoch_id, True)
            self.assertEqual(acb.redeem_bonds(accounts[2], [t6, t8, t7]), 20)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 15)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 10)
            self.check_redemption_epochs(acb.bond, accounts[2], [t7, t8])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + 20 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, bond_supply - 20)
            self.assertEqual(acb.bond_budget, 0)

            self.assertEqual(acb._control_supply(
                15 * ACB.BOND_REDEMPTION_PRICE), 0)
            self.assertEqual(acb.bond_budget, -15)
            self.assertEqual(acb._control_supply(
                30 * ACB.BOND_REDEMPTION_PRICE), 5 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond_budget, -25)
            self.assertEqual(acb._control_supply(
                1 * ACB.BOND_REDEMPTION_PRICE), 0)
            self.assertEqual(acb.bond_budget, -1)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(acb.redeem_bonds(accounts[2], [t7, t8]), 1)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 14)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 10)
            self.check_redemption_epochs(acb.bond, accounts[2], [t7, t8])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + 1 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, bond_supply - 1)
            self.assertEqual(acb.bond_budget, 0)

            self.advance_epoch(1)
            t10 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

            self.assertEqual(acb._control_supply(
                2 * ACB.BOND_REDEMPTION_PRICE), 0)
            self.assertEqual(acb.bond_budget, -2)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(acb.redeem_bonds(accounts[2], [t8, t7]), 16)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 8)
            self.check_redemption_epochs(acb.bond, accounts[2], [t8])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + 16 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, bond_supply - 16)
            self.assertEqual(acb.bond_budget, 14)

            self.assertEqual(acb._control_supply(
                1 * ACB.BOND_REDEMPTION_PRICE), 0)
            self.assertEqual(acb.bond_budget, -1)

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(acb.redeem_bonds(accounts[2], [t8]), 1)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 7)
            self.check_redemption_epochs(acb.bond, accounts[2], [t8])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + 1 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, bond_supply - 1)
            self.assertEqual(acb.bond_budget, 0)

            self.advance_epoch(ACB.EPOCH_DURATION)
            t11 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

            coin_supply = acb.coin.total_supply
            bond_supply = acb.bond.total_supply
            self.assertEqual(acb.redeem_bonds(accounts[2], [t8]), 7)
            self.assertEqual(acb.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t7), 0)
            self.assertEqual(acb.bond.balance_of(accounts[2], t8), 0)
            self.assertEqual(acb.bond.number_of_bonds_owned_by(accounts[1]), 0);
            self.assertEqual(acb.bond.number_of_bonds_owned_by(accounts[2]), 0);
            self.assertEqual(acb.bond.number_of_bonds_owned_by(accounts[3]), 0);
            self.check_redemption_epochs(acb.bond, accounts[2], [])
            self.assertEqual(acb.coin.total_supply,
                             coin_supply + 7 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond.total_supply, bond_supply - 7)
            self.assertEqual(acb.bond_budget, 7)

            self.assertEqual(acb.bond.total_supply, 0)
            self.assertEqual(acb.bond_budget, 7)
            self.assertEqual(acb._control_supply(
                5 * ACB.BOND_REDEMPTION_PRICE), 5 * ACB.BOND_REDEMPTION_PRICE)
            self.assertEqual(acb.bond_budget, 0)

        # bond expire
        self.assertEqual(acb._control_supply(-self.bond_price * 80), 0)
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 80)
        
        acb.coin.move(accounts[1], accounts[2], self.bond_price * 30)
        
        self.advance_epoch(ACB.EPOCH_DURATION)
        t1 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

        self.assertEqual(acb.purchase_bonds(accounts[2], 10), t1)
        self.assertEqual(acb.bond.total_supply, 10)
        self.assertEqual(acb.valid_bond_supply(), 10)
        self.assertEqual(acb.bond.balance_of(accounts[2], t1), 10)
        self.check_redemption_epochs(acb.bond, accounts[2], [t1])

        self.advance_epoch(ACB.EPOCH_DURATION)
        t2 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

        self.assertEqual(acb.purchase_bonds(accounts[2], 20), t2)
        self.assertEqual(acb.bond.total_supply, 30)
        self.assertEqual(acb.valid_bond_supply(), 30)
        self.assertEqual(acb.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(acb.bond, accounts[2], [t1, t2])

        self.advance_epoch(ACB.EPOCH_DURATION *
                           (ACB.BOND_REDEMPTION_PERIOD +
                            ACB.BOND_REDEEMABLE_PERIOD - 2))
        
        self.assertEqual(acb.bond.total_supply, 30)
        self.assertEqual(acb.valid_bond_supply(), 30)
        self.assertEqual(acb.bond.balance_of(accounts[2], t1), 10)
        self.assertEqual(acb.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(acb.bond, accounts[2], [t1, t2])

        self.assertEqual(acb.redeem_bonds(accounts[2], [t1]), 10)
        self.assertEqual(acb.redeem_bonds(accounts[2], [t1]), 0)

        self.advance_epoch(ACB.EPOCH_DURATION)
        
        self.assertEqual(acb.bond.total_supply, 20)
        self.assertEqual(acb.valid_bond_supply(), 20)
        self.assertEqual(acb.bond.balance_of(accounts[2], t1), 0)
        self.assertEqual(acb.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(acb.bond, accounts[2], [t2])

        self.assertEqual(acb.redeem_bonds(accounts[2], [t2]), 20)
        self.assertEqual(acb.redeem_bonds(accounts[2], [t2]), 0)

        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.valid_bond_supply(), 0)
        self.assertEqual(acb.bond.balance_of(accounts[2], t1), 0)
        self.assertEqual(acb.bond.balance_of(accounts[2], t2), 0)
        self.check_redemption_epochs(acb.bond, accounts[2], [])

        acb.coin.move(accounts[1], accounts[2], self.bond_price * 30)
        
        self.advance_epoch(ACB.EPOCH_DURATION)
        t1 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

        self.assertEqual(acb.purchase_bonds(accounts[2], 10), t1)
        self.assertEqual(acb.bond.total_supply, 10)
        self.assertEqual(acb.valid_bond_supply(), 10)
        self.assertEqual(acb.bond.balance_of(accounts[2], t1), 10)
        self.check_redemption_epochs(acb.bond, accounts[2], [t1])

        self.advance_epoch(ACB.EPOCH_DURATION)
        t2 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

        self.assertEqual(acb.purchase_bonds(accounts[2], 20), t2)
        self.assertEqual(acb.bond.total_supply, 30)
        self.assertEqual(acb.valid_bond_supply(), 30)
        self.assertEqual(acb.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(acb.bond, accounts[2], [t1, t2])

        self.advance_epoch(ACB.EPOCH_DURATION *
                           (ACB.BOND_REDEMPTION_PERIOD +
                            ACB.BOND_REDEEMABLE_PERIOD - 1))
        
        self.assertEqual(acb.bond.total_supply, 30)
        self.assertEqual(acb.valid_bond_supply(), 20)
        self.assertEqual(acb.bond.balance_of(accounts[2], t1), 10)
        self.assertEqual(acb.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(acb.bond, accounts[2], [t1, t2])

        self.assertEqual(acb.redeem_bonds(accounts[2], [t1]), 0)

        self.advance_epoch(ACB.EPOCH_DURATION)
        
        self.assertEqual(acb.bond.total_supply, 20)
        self.assertEqual(acb.valid_bond_supply(), 0)
        self.assertEqual(acb.bond.balance_of(accounts[2], t1), 0)
        self.assertEqual(acb.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(acb.bond, accounts[2], [t2])

        self.assertEqual(acb.redeem_bonds(accounts[2], [t2]), 0)

        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.valid_bond_supply(), 0)
        self.assertEqual(acb.bond.balance_of(accounts[2], t1), 0)
        self.assertEqual(acb.bond.balance_of(accounts[2], t2), 0)
        self.check_redemption_epochs(acb.bond, accounts[2], [])

        self.acb.set_timestamp(self.acb.get_timestamp() + ACB.EPOCH_DURATION)
        
        remainder = [0, 0, 0]
        deposit_4 = [0, 0, 0]
        deposit_5 = [0, 0, 0]
        deposit_6 = [0, 0, 0]
        now = 0
        self.set_tax()

        acb.coin.move(accounts[1], accounts[4], 100)
        self.assertEqual(acb.coin.balance_of(accounts[4]), 100)

        self.assertEqual(acb.vote(
            accounts[7], Oracle.encrypt(
                accounts[7], self.default_level, 7777),
            self.default_level, 7777), (True, False, 0, 0, 0, True))

        # 1 commit
        balance = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 1),
            self.default_level, 1), (True, False, deposit_4[now], 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance - deposit_4[now])
        balance = acb.coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 1),
            self.default_level, 1), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 1),
            self.default_level, 1), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()

        balance = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.current_epoch_start,
                         acb.get_timestamp() - ACB.EPOCH_DURATION)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 2),
            self.default_level, 1), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance - deposit_4[now])
        balance = acb.coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 2),
            self.default_level, 1), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        balance = acb.coin.balance_of(accounts[4])
        reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                     self.tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(Oracle.PROPORTIONAL_REWARD_RATE *
                          self.tax / 100)
        remainder[now] = self.tax - reward
        deposit_4[now] = int(balance * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.current_epoch_start,
                         acb.get_timestamp() - ACB.EPOCH_DURATION)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 3),
            self.default_level, 1),
                         (True, False, deposit_4[now],
                          deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = acb.coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 3),
            self.default_level, 1), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.current_epoch_start, acb.get_timestamp())
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = 0

        balance = acb.coin.balance_of(accounts[4])
        coin_supply = acb.coin.total_supply
        remainder[now] = deposit_4[(now - 2) % 3] + self.tax
        deposit_4[now] = int(balance * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 4),
            self.default_level, 3), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance - deposit_4[now])
        balance = acb.coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 4),
            self.default_level, 2), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        balance = acb.coin.balance_of(accounts[4])
        coin_supply = acb.coin.total_supply
        reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                     self.tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(Oracle.PROPORTIONAL_REWARD_RATE *
                          self.tax / 100)
        remainder[now] = self.tax - reward
        deposit_4[now] = int(balance * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 5),
            self.default_level, 4),
                         (True, True, deposit_4[now],
                          deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = acb.coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 5),
            self.default_level, 4), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        balance = acb.coin.balance_of(accounts[4])
        coin_supply = acb.coin.total_supply
        reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                     self.tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(Oracle.PROPORTIONAL_REWARD_RATE *
                          self.tax / 100)
        remainder[now] = self.tax - reward
        deposit_4[now] = int(balance * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 6),
            self.default_level, 5), (True, True, deposit_4[now],
                                     deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = acb.coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 6),
            self.default_level, 5), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        balance = acb.coin.balance_of(accounts[4])
        coin_supply = acb.coin.total_supply
        reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                     self.tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(Oracle.PROPORTIONAL_REWARD_RATE *
                          self.tax / 100)
        remainder[now] = self.tax - reward
        deposit_4[now] = int(balance * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 7),
            self.default_level, 6),
                         (True, True, deposit_4[now],
                          deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = acb.coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 7),
            self.default_level, 6), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        balance = acb.coin.balance_of(accounts[4])
        coin_supply = acb.coin.total_supply
        reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                     self.tax / 100)
        if deposit_4[(now - 2) % 3] > 0:
            reward += int(Oracle.PROPORTIONAL_REWARD_RATE *
                          self.tax / 100)
        remainder[now] = self.tax - reward
        deposit_4[now] = int(balance * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 8),
            self.default_level, 6),
                         (True, False, deposit_4[now],
                          deposit_4[(now - 2) % 3], reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance - deposit_4[now] +
                         deposit_4[(now - 2) % 3] + reward)
        balance = acb.coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 8),
            self.default_level, 6), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = 0

        balance = acb.coin.balance_of(accounts[4])
        coin_supply = acb.coin.total_supply
        reward = 0
        remainder[now] = deposit_4[(now - 2) % 3] + self.tax - reward
        deposit_4[now] = 0
        self.assertEqual(acb.vote(
            accounts[4], ACB.NULL_HASH, self.default_level, 7),
                         (True, False, deposit_4[now],
                          0, reward, True))
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance - deposit_4[now] + reward)
        balance = acb.coin.balance_of(accounts[4])
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 8),
            self.default_level, 6), (False, False, 0, 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[4]), balance)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        # 3 commits on the stable level.
        self.reset_balances()

        acb.coin.move(accounts[1], accounts[4], 100)
        acb.coin.move(accounts[1], accounts[5], 100)
        self.assertEqual(acb.coin.balance_of(accounts[5]), 100)
        self.assertEqual(acb.coin.balance_of(accounts[6]), 0)

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = 0

        coin_supply = acb.coin.total_supply
        remainder[now] = deposit_4[(now - 2) % 3] + self.tax
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, -1),
            self.default_level, -1), (True, False, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, -1),
            self.default_level, -1), (True, False, deposit_5[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, -1),
            self.default_level, -1), (True, False, deposit_6[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = 0

        coin_supply = acb.coin.total_supply
        remainder[now] = deposit_4[(now - 2) % 3] + self.tax
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 1),
            self.default_level, 0), (True, False, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 1),
            self.default_level, 0), (True, False, deposit_5[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 1),
            self.default_level, 0), (True, False, deposit_6[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = 0

        coin_supply = acb.coin.total_supply
        remainder[now] = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                          deposit_6[(now - 2) % 3] + self.tax)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 2),
            self.default_level, 1), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 2),
            self.default_level, 1), (True, True, deposit_5[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 2),
            self.default_level, 1), (True, True, deposit_6[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 3),
            self.default_level, 2),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 3),
            self.default_level, 2),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 3),
            self.default_level, 2),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 4),
            self.default_level, 3),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 4),
            self.default_level, 3),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 4),
            self.default_level, 3),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)

        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        self.reset_balances()
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 5),
            self.default_level, 4),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 5),
            self.default_level, 4),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 5),
            self.default_level, 4),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(deposit_4[now], 0)
        self.assertEqual(deposit_5[now], 0)
        self.assertEqual(deposit_6[now], 0)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 6),
            self.default_level, 5),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 6),
            self.default_level, 5),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 6),
            self.default_level, 5),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 7),
            self.default_level, 6),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 7),
            self.default_level, 6),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 7),
            self.default_level, 5),
                         (True, False, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = deposit_6[(now - 2) % 3] + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 8),
            self.default_level, 6),
                         (True, False, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 8),
            self.default_level, 6),
                         (True, False, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 8),
            self.default_level, 7), (True, True, deposit_6[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] +
                         reward_6)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                        self.tax)
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (1 * 100))
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        if deposit_6[(now - 2) % 3] > 0:
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total / 100)
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 9),
            self.default_level, 0), (True, False, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 9),
            self.default_level, 0), (True, False, deposit_5[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 9),
            self.default_level, 0),
                         (True, False, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = 0

        coin_supply = acb.coin.total_supply
        reward_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                        deposit_6[(now - 2) % 3] + self.tax)
        constant_reward = 0
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        remainder[now] = reward_total
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 10),
            self.default_level, 9), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 10),
            self.default_level, 9), (True, True, deposit_5[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 10),
            self.default_level, 9), (True, True, deposit_6[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2 + deposit_4[(now - 2) % 3])
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 11),
            self.default_level, 10),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 11),
            self.default_level, 10),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = deposit_4[(now - 2) % 3] + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_5[(now - 2) % 3] + deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward + deposit_5[(now - 2) % 3])
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 12),
            self.default_level, 11),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = deposit_5[(now - 2) % 3] + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (1 * 100))
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 0 + deposit_6[(now - 2) % 3])
        deposit13 = int(
            acb.coin.balance_of(accounts[1]) * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[1], Oracle.encrypt(
                accounts[1], self.default_level, -1),
            self.default_level, -1), (True, False, deposit13, 0, 0, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = 0

        coin_supply = acb.coin.total_supply
        remainder[now] = deposit_6[(now - 2) % 3] + self.tax
        deposit14 = int(
            acb.coin.balance_of(accounts[1]) * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[1], Oracle.encrypt(
                accounts[1], self.default_level, -1),
            self.default_level, -1), (True, True, deposit14, 0, 0, True))
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        # 3 commits on the stable level and another level.

        # 0, stable, stable
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        self.reset_balances()
        mint = self.mint_at_default_level()

        acb.coin.move(accounts[1], accounts[4], 10000)
        acb.coin.move(accounts[1], accounts[5], 2000)
        acb.coin.move(accounts[1], accounts[5], 8100)

        coin_supply = acb.coin.total_supply
        reward_total = deposit13 + self.tax
        constant_reward = 0
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        remainder[now] = reward_total
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], 0, 1),
            self.default_level, 0), (True, False, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 1),
            self.default_level, 0), (True, False, deposit_5[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 1),
            self.default_level, 0), (True, False, deposit_6[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = 0

        coin_supply = acb.coin.total_supply
        reward_total = deposit14 + self.tax
        constant_reward = 0
        reward_4 = 0
        reward_5 = 0
        reward_6 = 0
        remainder[now] = reward_total
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 2),
            0, 1), (True, True, deposit_4[now], 0, 0, True))
        self.assertEqual(acb.oracle_level, Oracle.LEVEL_MAX)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now])
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 2),
            self.default_level, 1), (True, True, deposit_5[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now])
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 2),
            self.default_level, 1), (True, True, deposit_6[now], 0, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now])
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reclaim_4 = 0
        in_threshold = False
        if self.default_level - 0 <= Oracle.RECLAIM_THRESHOLD:
            in_threshold = True
            reclaim_4 = deposit_4[(now - 2) % 3]
        reward_total = (deposit_4[(now - 2) % 3] - reclaim_4 +
                        self.tax)
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_5[(now - 2) % 3] + deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 3),
            self.default_level, 2),
                         (True, True, deposit_4[now], reclaim_4, 0, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + reclaim_4)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 3),
            self.default_level, 2),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 3),
            self.default_level, 2),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        # 0, 0, stable
        tmp_deposit_rate = ACB.DEPOSIT_RATE
        if ACB.DEPOSIT_RATE == 0:
            ACB.DEPOSIT_RATE = 1

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        self.reset_balances()
        mint = self.mint_at_default_level()

        acb.coin.move(accounts[1], accounts[4], 2900)
        acb.coin.move(accounts[1], accounts[5], 7000)
        acb.coin.move(accounts[1], accounts[6], 10000)

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], 0, 4), self.default_level, 3),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], 0, 4), self.default_level, 3),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 4), self.default_level, 3),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        ACB.DEPOSIT_RATE = tmp_deposit_rate

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                       reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 5), 0, 4),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                         reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 5), 0, 4),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                         reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 5), self.default_level, 4),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reclaim_4 = reclaim_5 = 0
        in_threshold = False
        if self.default_level - 0 <= Oracle.RECLAIM_THRESHOLD:
            in_threshold = True
            reclaim_4 = deposit_4[(now - 2) % 3]
            reclaim_5 = deposit_5[(now - 2) % 3]
        reward_total = (deposit_4[(now - 2) % 3] - reclaim_4 +
                        deposit_5[(now - 2) % 3] - reclaim_5 +
                        self.tax)
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (1 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total =  deposit_6[(now - 2) % 3]
        if deposit_total > 0:
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 6), self.default_level, 5),
                         (True, True, deposit_4[now], reclaim_4, 0, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + reclaim_4)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 6), self.default_level, 5),
                         (True, True, deposit_5[now], reclaim_5, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + reclaim_5)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 6), self.default_level, 5),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        # stable, stable, level_max - 1
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        self.reset_balances()
        mint = self.mint_at_default_level()

        acb.coin.move(accounts[1], accounts[4], 3100)
        acb.coin.move(accounts[1], accounts[5], 7000)
        acb.coin.move(accounts[1], accounts[6], 10000)

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 7),
            self.default_level, 6),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 7),
            self.default_level, 6),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], Oracle.LEVEL_MAX - 1, 7),
            self.default_level, 6),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 8),
            self.default_level, 7),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 8),
            self.default_level, 7),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 8),
            Oracle.LEVEL_MAX - 1, 7),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reclaim_6 = 0
        in_threshold = False
        if (Oracle.LEVEL_MAX - 1 - self.default_level <=
            Oracle.RECLAIM_THRESHOLD):
            in_threshold = True
            reclaim_6 = deposit_6[(now - 2) % 3]
        reward_total = (deposit_6[(now - 2) % 3] - reclaim_6 +
                        self.tax)
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3]
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 9),
            self.default_level, 8),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 9),
            self.default_level, 8),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 9),
            self.default_level, 8),
                         (True, True, deposit_6[now], reclaim_6, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + reclaim_6)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        # stable, level_max - 1, level_max - 1
        tmp_deposit_rate = ACB.DEPOSIT_RATE
        if ACB.DEPOSIT_RATE == 0:
            ACB.DEPOSIT_RATE = 1

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        self.reset_balances()
        mint = self.mint_at_default_level()

        acb.coin.move(accounts[1], accounts[4], 10000)
        acb.coin.move(accounts[1], accounts[5], 7000)
        acb.coin.move(accounts[1], accounts[6], 2900)

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 10),
            self.default_level, 9),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], Oracle.LEVEL_MAX - 1, 10),
            self.default_level, 9),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], Oracle.LEVEL_MAX - 1, 10),
            self.default_level, 9),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        ACB.DEPOSIT_RATE = tmp_deposit_rate

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 11),
            self.default_level, 10),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 11),
            Oracle.LEVEL_MAX - 1, 10),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 11),
            Oracle.LEVEL_MAX - 1, 10),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reclaim_5 = reclaim_6 = 0
        in_threshold = False
        if Oracle.LEVEL_MAX - 1 - self.default_level <= Oracle.RECLAIM_THRESHOLD:
            in_threshold = True
            reclaim_5 = deposit_5[(now - 2) % 3]
            reclaim_6 = deposit_6[(now - 2) % 3]
        reward_total = (deposit_5[(now - 2) % 3] - reclaim_5 +
                        deposit_6[(now - 2) % 3] - reclaim_6 +
                        self.tax)
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (1 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = deposit_4[(now - 2) % 3]
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 12),
            self.default_level, 11),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 12),
            self.default_level, 11),
                         (True, True, deposit_5[now], reclaim_5, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + reclaim_5)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 12),
            self.default_level, 11),
                         (True, True, deposit_6[now], reclaim_6, 0, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + reclaim_6)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        # stable, stable, level_max - 1; deposit is the same
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        self.reset_balances()
        mint = self.mint_at_default_level()

        acb.coin.move(accounts[1], accounts[4], 10000)
        acb.coin.move(accounts[1], accounts[5], 7000)
        acb.coin.move(accounts[1], accounts[6], 3000)

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], Oracle.LEVEL_MAX - 1, 13),
            self.default_level, 12),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 13),
            self.default_level, 12),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 13),
            self.default_level, 12),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 3)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 14),
            Oracle.LEVEL_MAX - 1, 13),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 14),
            self.default_level, 13),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 14),
            self.default_level, 13),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reclaim_4 = 0
        in_threshold = False
        if (Oracle.LEVEL_MAX - 1 - self.default_level <=
            Oracle.RECLAIM_THRESHOLD):
            in_threshold = True
            reclaim_4 = deposit_4[(now - 2) % 3]
        reward_total = (deposit_4[(now - 2) % 3] - reclaim_4 +
                        self.tax)
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (2 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_5[(now - 2) % 3] + deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_5 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_5[(now - 2) % 3] /
                           (deposit_total * 100))
            reward_6 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_6[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 2)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], self.default_level, 15),
            self.default_level, 14),
                         (True, True, deposit_4[now], reclaim_4, 0, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + reclaim_4)
        balance_5 = acb.coin.balance_of(accounts[5])
        deposit_5[now] = int(balance_5 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[5], Oracle.encrypt(
                accounts[5], self.default_level, 15),
            self.default_level, 14),
                         (True, True, deposit_5[now], deposit_5[(now - 2) % 3],
                          reward_5 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[5]),
                         balance_5 - deposit_5[now] + deposit_5[(now - 2) % 3] +
                         reward_5 + constant_reward)
        balance_6 = acb.coin.balance_of(accounts[6])
        deposit_6[now] = int(balance_6 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[6], Oracle.encrypt(
                accounts[6], self.default_level, 15),
            self.default_level, 14),
                         (True, True, deposit_6[now], deposit_6[(now - 2) % 3],
                          reward_6 + constant_reward, False))
        self.assertEqual(acb.coin.balance_of(accounts[6]),
                         balance_6 - deposit_6[now] + deposit_6[(now - 2) % 3] +
                         reward_6 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        # all levels
        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        self.reset_balances()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = 0 + self.tax
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (3 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = (deposit_4[(now - 2) % 3] + deposit_5[(now - 2) % 3] +
                         deposit_6[(now - 2) % 3])
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1 + deposit_5[(now - 2) % 3] +
                          deposit_6[(now - 2) % 3])
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], 0, 4444),
            self.default_level, 15),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        now = (now + 1) % 3
        acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)
        self.set_tax()
        mint = self.mint_at_default_level()

        coin_supply = acb.coin.total_supply
        reward_total = (deposit_5[(now - 2) % 3] + deposit_6[(now - 2) % 3] +
                        self.tax)
        constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                              reward_total / (1 * 100))
        reward_4 = reward_5 = reward_6 = 0
        deposit_total = deposit_4[(now - 2) % 3]
        if deposit_total > 0:
            reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                           reward_total * deposit_4[(now - 2) % 3] /
                           (deposit_total * 100))
        remainder[now] = (reward_total - reward_4 - reward_5 - reward_6 -
                          constant_reward * 1)
        balance_4 = acb.coin.balance_of(accounts[4])
        deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
        self.assertEqual(acb.vote(
            accounts[4], Oracle.encrypt(
                accounts[4], 1, 4444), 0, 4444),
                         (True, True, deposit_4[now], deposit_4[(now - 2) % 3],
                          reward_4 + constant_reward, True))
        self.assertEqual(acb.oracle_level, self.default_level)
        self.assertEqual(acb.coin.balance_of(accounts[4]),
                         balance_4 - deposit_4[now] + deposit_4[(now - 2) % 3] +
                         reward_4 + constant_reward)
        self.assertEqual(acb.coin.total_supply,
                         coin_supply -
                         remainder[(now - 1) % 3])

        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 0)
        self.assertEqual(acb._control_supply(-self.bond_price * 2), 0)
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.bond_budget, 2)
        t12 = acb.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD
        self.assertEqual(acb.purchase_bonds(accounts[1], 2), t12)
        self.assertEqual(acb.bond.total_supply, 2)

        tax_total = 0
        period = 1
        valid_bond_supply = 0
        for level in range(2, Oracle.LEVEL_MAX + 2):
            now = (now + 1) % 3
            acb.set_timestamp(acb.get_timestamp() + ACB.EPOCH_DURATION)

            self.assertEqual(acb.bond.total_supply, 2)
            valid_bond_supply = 2 if (period < ACB.BOND_REDEMPTION_PERIOD +
                                      ACB.BOND_REDEEMABLE_PERIOD) else 0
            coin_supply = acb.coin.total_supply
            reward_total = tax_total
            constant_reward = int((100 - Oracle.PROPORTIONAL_REWARD_RATE) *
                                  reward_total / (1 * 100))
            reward_4 = 0
            deposit_total = deposit_4[(now - 2) % 3]
            if deposit_total > 0:
                reward_4 = int(Oracle.PROPORTIONAL_REWARD_RATE *
                               reward_total * deposit_4[(now - 2) % 3] /
                               (deposit_total * 100))
            remainder[now] = (reward_total - reward_4 - constant_reward * 1)
            balance_4 = acb.coin.balance_of(accounts[4])
            deposit_4[now] = int(balance_4 * ACB.DEPOSIT_RATE / 100)
            self.assertEqual(acb.vote(
                accounts[4], Oracle.encrypt(
                    accounts[4], level, 4444), level - 1, 4444),
                             (True,
                              True if level < Oracle.LEVEL_MAX + 1 else False,
                              deposit_4[now],
                              deposit_4[(now - 2) % 3],
                              reward_4 + constant_reward,
                              True))
            
            mint = 0
            bond_budget = 0
            delta = int(self.acb.coin.total_supply *
                        (ACB.LEVEL_TO_EXCHANGE_RATE[level - 2] - 10) / 10)
            delta = int(delta * ACB.DAMPING_FACTOR / 100)
            if delta == 0:
                mint = 0
                issued_bonds = 0
            elif delta > 0:
                necessary_bonds = int(delta / ACB.BOND_REDEMPTION_PRICE)
                if necessary_bonds >= valid_bond_supply:
                    mint = ((necessary_bonds - valid_bond_supply) *
                            ACB.BOND_REDEMPTION_PRICE)
                    bond_budget = -valid_bond_supply
                else:
                    mint = 0
                    bond_budget = -necessary_bonds
            else:
                mint = 0
                bond_budget = int(-delta / self.bond_price)
            period += 1

            self.assertEqual(acb.oracle_level, level - 2)
            self.assertEqual(acb.coin.balance_of(accounts[4]),
                             balance_4 - deposit_4[now] +
                             deposit_4[(now - 2) % 3] +
                             reward_4 + constant_reward)
            self.assertEqual(acb.coin.total_supply,
                             coin_supply -
                             remainder[(now - 1) % 3])
            self.assertEqual(acb.bond.total_supply, 2)
            self.assertEqual(acb.bond_budget, bond_budget)
            self.assertEqual(acb.valid_bond_supply(), valid_bond_supply)

            tax_total = 0
            self.assertEqual(acb.coin.balance_of(acb.coin.tax_account), 0)
            for transfer in [0, 1234, 1111]:
                tax = int(transfer * self.tax_rate / 100)
                balance_1 = acb.coin.balance_of(accounts[1])
                balance_2 = acb.coin.balance_of(accounts[2])
                balance_tax = acb.coin.balance_of(acb.coin.tax_account)
                acb.coin.transfer(accounts[1], accounts[2], transfer)
                self.assertEqual(acb.coin.balance_of(accounts[1]),
                                 balance_1 - transfer)
                self.assertEqual(acb.coin.balance_of(accounts[2]),
                                 balance_2 + transfer - tax)
                self.assertEqual(acb.coin.balance_of(acb.coin.tax_account),
                                 balance_tax + tax)
                tax_total += tax

        now += 1
        self.assertEqual(acb.redeem_bonds(accounts[1], [t12]),
                         valid_bond_supply)

        self.reset_balances();
        self.assertEqual(acb.bond.total_supply, 0)
        self.assertEqual(acb.coin.total_supply,
                         self.initial_coin_supply + deposit_4[(now - 2) % 3] +
                         deposit_4[(now - 1) % 3] + remainder[(now - 1) % 3] +
                         tax_total)


    def advance_epoch(self, amount):
        bond_budget = self.acb.bond_budget
        remaining = amount
        while remaining > 0:
            time_to_next_epoch = (ACB.EPOCH_DURATION -
                                  self.acb.get_timestamp() +
                                  self.acb.current_epoch_start)
            advance = min(time_to_next_epoch, remaining)
            if advance > 0:
                self.acb.set_timestamp(self.acb.get_timestamp() + advance)
            self.acb.vote(
                self.accounts[7],
                Oracle.encrypt(self.accounts[7], Oracle.LEVEL_MAX, 1),
                Oracle.LEVEL_MAX, 1)
            remaining -= advance
        self.assertEqual(self.acb._control_supply(
            -self.bond_price * bond_budget), 0)
        self.assertEqual(self.acb.bond_budget, bond_budget)

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
        self.assertEqual(self.acb.coin.balance_of(self.acb.coin.tax_account), 0)
        self.acb.coin.mint(self.acb.coin.tax_account, self.tax)

    def mint_at_default_level(self):
        delta = int(self.acb.coin.total_supply * (11 - 10) / 10)
        delta = int(delta * ACB.DAMPING_FACTOR / 100)
        mint = (int(delta / ACB.BOND_REDEMPTION_PRICE) *
                ACB.BOND_REDEMPTION_PRICE)
        assert(delta > 0)
        self.assertEqual(self.acb.bond.total_supply, 0)
        self.assertEqual(self.acb.bond_budget, 0)
        return mint

    def reset_balances(self):
        for account in self.accounts:
            self.acb.coin.burn(account, self.acb.coin.balance_of(account))
        self.acb.coin.mint(self.accounts[1], self.initial_coin_supply)


def main():
    bond_price = 996
    bond_redemption_price = 1000
    bond_redemption_period = 12
    bond_redeemable_period = 3
    epoch_duration = 7 * 24 * 60 * 60
    proportional_reward_rate = 90
    deposit_rate = 10
    damping_factor = 10
    reclaim_threshold = 1
    tax = 12345
    level_to_exchange_rate = [1, 11, 20]

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
        tax)
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
                                                tax)
                                            test.run()
                                            test.teardown()


if __name__ == "__main__":
    main()
