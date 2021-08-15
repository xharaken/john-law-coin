#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

from johnlawcoin import *
import unittest, random

class BondOperationUnitTest(unittest.TestCase):

    def __init__(self,
                 bond_price,
                 bond_redemption_price,
                 bond_redemption_period,
                 bond_redeemable_period):
        super().__init__()

        print('bond_price=%d redemp_price=%d redemp_period=%d '
              'redeem_period=%d' %
              (bond_price,
               bond_redemption_price,
               bond_redemption_period,
               bond_redeemable_period))
        self._bond_price = bond_price
        self._bond_redemption_price = bond_redemption_price
        self._bond_redemption_period = bond_redemption_period
        self._bond_redeemable_period = bond_redeemable_period

        self.accounts = ['0x0000', '0x1000', '0x2000', '0x3000', '0x4000',
                         '0x5000', '0x6000', '0x7000']

        self.coin = JohnLawCoin(self.accounts[1])
        self.bond = JohnLawBond()
        self.bond_operation = BondOperation(self.bond)
        self.bond_operation.override_constants_for_testing(
            self._bond_price, self._bond_redemption_price,
            self._bond_redemption_period,
            self._bond_redeemable_period)

        self.epoch_id = 3

    def teardown(self):
        pass

    def run(self):
        bond_operation = self.bond_operation
        accounts = self.accounts

        # update_bond_budget
        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.bond_budget, 0)
        self.check_update_bond_budget(
            self._bond_redemption_price - 1, 0)
        self.assertEqual(bond_operation.bond_budget, 0)
        self.check_update_bond_budget(self._bond_redemption_price,
                          self._bond_redemption_price)
        self.assertEqual(bond_operation.bond_budget, 0)
        self.check_update_bond_budget(self._bond_redemption_price + 1,
                          self._bond_redemption_price)
        self.assertEqual(bond_operation.bond_budget, 0)
        self.check_update_bond_budget(
            self._bond_redemption_price * 10,
            self._bond_redemption_price * 10)
        self.assertEqual(bond_operation.bond_budget, 0)

        self.check_update_bond_budget(-(self._bond_price - 1), 0)
        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.bond_budget, 0)
        self.check_update_bond_budget(-self._bond_price, 0)
        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.bond_budget, 1)
        self.check_update_bond_budget(0, 0)
        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.bond_budget, 0)
        self.check_update_bond_budget(-self._bond_price * 99, 0)
        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.bond_budget, 99)
        self.check_update_bond_budget(0, 0)
        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.bond_budget, 0)
        self.check_update_bond_budget(-self._bond_price * 100, 0)
        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.bond_budget, 100)
        
        self.check_increase_bond_supply(accounts[1], 50,
            self.epoch_id + self._bond_redemption_period)
        self.check_increase_bond_supply(accounts[1], 50,
            self.epoch_id + self._bond_redemption_period)
        self.assertEqual(self.bond.total_supply, 100)
        self.assertEqual(bond_operation.bond_budget, 0)

        self.check_update_bond_budget(
            self._bond_redemption_price - 1, 0)
        self.check_update_bond_budget(self._bond_redemption_price, 0)
        self.assertEqual(bond_operation.bond_budget, -1)
        self.check_update_bond_budget(
            self._bond_redemption_price + 1, 0)
        self.assertEqual(bond_operation.bond_budget, -1)
        self.check_update_bond_budget(
            self._bond_redemption_price * 68, 0)
        self.assertEqual(bond_operation.bond_budget, -68)
        self.check_update_bond_budget(0, 0)
        self.assertEqual(bond_operation.bond_budget, 0)
        self.check_update_bond_budget(
            self._bond_redemption_price * 30, 0)
        self.assertEqual(bond_operation.bond_budget, -30)
        self.check_update_bond_budget(
            self._bond_redemption_price - 1, 0)
        self.assertEqual(bond_operation.bond_budget, 0)
        self.check_update_bond_budget(
            self._bond_redemption_price * 200,
            self._bond_redemption_price * 100)
        self.assertEqual(bond_operation.bond_budget, -100)
        self.check_update_bond_budget(
            self._bond_redemption_price * 100, 0)
        self.assertEqual(bond_operation.bond_budget, -100)
        self.check_update_bond_budget(
            self._bond_redemption_price * 100, 0)
        self.assertEqual(bond_operation.bond_budget, -100)
        
        self.check_update_bond_budget(-self._bond_price * 100, 0)
        self.assertEqual(self.bond.total_supply, 100)
        self.assertEqual(bond_operation.bond_budget, 100)

        self.check_increase_bond_supply(accounts[1], 50,
            self.epoch_id + self._bond_redemption_period)
        self.check_increase_bond_supply(accounts[1], 50,
            self.epoch_id + self._bond_redemption_period)
        self.assertEqual(self.bond.total_supply, 200)
        self.assertEqual(bond_operation.bond_budget, 0)

        self.check_update_bond_budget(
            self._bond_redemption_price * 30 - 1, 0)
        self.assertEqual(bond_operation.bond_budget, -29)
        self.check_update_bond_budget(
            self._bond_redemption_price * 30, 0)
        self.assertEqual(bond_operation.bond_budget, -30)
        self.check_update_bond_budget(
            self._bond_redemption_price * 30 + 1, 0)
        self.assertEqual(bond_operation.bond_budget, -30)
        self.check_update_bond_budget(
            self._bond_redemption_price * 210,
            self._bond_redemption_price * 10)
        self.assertEqual(bond_operation.bond_budget, -200)

        self.check_decrease_bond_supply(
            accounts[1],
            [self.epoch_id + self._bond_redemption_period], 200, 0)
        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(self.bond_operation.bond_budget, 0)

        if (self._bond_price >= 2 and
            self._bond_redemption_price >= 2 and
            self._bond_redemption_period >= 3 and
            self._bond_redeemable_period >= 3):

            # increase_bond_supply
            self.check_update_bond_budget(-self._bond_price * 80, 0)
            self.assertEqual(self.bond.total_supply, 0)
            self.assertEqual(bond_operation.bond_budget, 80)
        
            coin_supply = self.coin.total_supply

            self.epoch_id += 1
            t1 = self.epoch_id + self._bond_redemption_period

            self.coin.move(accounts[1], accounts[2], self._bond_price * 30)
            self.coin.move(accounts[1], accounts[3], self._bond_price * 50)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[4], 1, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[5], 1, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[1], 0, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[1], 81, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[2], 0, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[2], 81, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[2], 31, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[3], 0, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[3], 81, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[3], 51, self.epoch_id, self.coin)

            self.check_increase_bond_supply(accounts[2], 1, t1)
            self.assertEqual(self.bond.total_supply, 1)
            self.assertEqual(bond_operation.bond_budget, 79)
            self.assertEqual(self.bond.balance_of(accounts[2], t1), 1)
            self.check_redemption_epochs(self.bond, accounts[2], [t1])
            self.assertEqual(self.coin.total_supply,
                             coin_supply - self._bond_price * 1)
            
            self.check_increase_bond_supply(accounts[2], 10, t1)
            self.assertEqual(self.bond.total_supply, 11)
            self.assertEqual(bond_operation.bond_budget, 69)
            self.assertEqual(self.bond.balance_of(accounts[2], t1), 11)
            self.check_redemption_epochs(self.bond, accounts[2], [t1])
            self.assertEqual(self.coin.total_supply,
                             coin_supply - self._bond_price * 11)
            
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[1], 70, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[3], 70, self.epoch_id, self.coin)

            self.epoch_id += 1
            t2 = self.epoch_id + self._bond_redemption_period

            self.check_increase_bond_supply(accounts[2], 1, t2)
            self.assertEqual(self.bond.total_supply, 12)
            self.assertEqual(bond_operation.bond_budget, 68)
            self.assertEqual(self.bond.balance_of(accounts[2], t2), 1)
            self.check_redemption_epochs(self.bond, accounts[2], [t1, t2])
            self.assertEqual(self.coin.total_supply,
                             coin_supply - self._bond_price * 12)

            self.check_increase_bond_supply(accounts[2], 10, t2)
            self.assertEqual(self.bond.total_supply, 22)
            self.assertEqual(bond_operation.bond_budget, 58)
            self.assertEqual(self.bond.balance_of(accounts[2], t2), 11)
            self.check_redemption_epochs(self.bond, accounts[2], [t1, t2])
            self.assertEqual(self.coin.total_supply,
                             coin_supply - self._bond_price * 22)

            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[1], 59, self.epoch_id, self.coin)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[3], 59, self.epoch_id, self.coin)

            self.check_increase_bond_supply(accounts[1], 10, t2)
            self.assertEqual(self.bond.total_supply, 32)
            self.assertEqual(bond_operation.bond_budget, 48)
            self.assertEqual(self.bond.balance_of(accounts[1], t2), 10)
            self.check_redemption_epochs(self.bond, accounts[1], [t2])
            self.assertEqual(self.coin.total_supply,
                             coin_supply - self._bond_price * 32)

            self.epoch_id += 1
            t3 = self.epoch_id + self._bond_redemption_period

            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[3], 49, self.epoch_id, self.coin)
            self.check_increase_bond_supply(accounts[3], 48, t3)
            self.assertEqual(self.bond.total_supply, 80)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.assertEqual(self.bond.balance_of(accounts[3], t3), 48)
            self.check_redemption_epochs(self.bond, accounts[3], [t3])
            self.assertEqual(self.coin.total_supply,
                             coin_supply - self._bond_price * 80)

            self.coin.move(accounts[1], accounts[2], self._bond_price * 10)
            self.coin.move(accounts[1], accounts[3], self._bond_price * 10)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[2], 1, self.epoch_id, self.coin)
            self.assertEqual(self.bond.total_supply, 80)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.assertEqual(self.bond.balance_of(accounts[3], t3), 48)
            self.check_redemption_epochs(self.bond, accounts[3], [t3])
            self.assertEqual(self.coin.total_supply,
                             coin_supply - self._bond_price * 80)
            with self.assertRaises(Exception):
                bond_operation.increase_bond_supply(
                    accounts[3], 1, self.epoch_id, self.coin)
            self.assertEqual(self.bond.total_supply, 80)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.assertEqual(self.bond.balance_of(accounts[3], t3), 48)
            self.check_redemption_epochs(self.bond, accounts[3], [t3])
            self.assertEqual(self.coin.total_supply,
                             coin_supply - self._bond_price * 80)

            self.assertEqual(self.coin.balance_of(accounts[2]),
                             (30 + 10 - 22) * self._bond_price)
            self.assertEqual(self.coin.balance_of(accounts[3]),
                             (50 + 10 - 48) * self._bond_price)

            # decrease_bond_supply
            self.assertEqual(self.bond.balance_of(accounts[2], t1), 11)
            self.assertEqual(self.bond.balance_of(accounts[1], t2), 10)
            self.assertEqual(self.bond.balance_of(accounts[2], t2), 11)
            self.assertEqual(self.bond.balance_of(accounts[3], t3), 48)
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[1]), 10);
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[2]), 22);
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[3]), 48);
            self.check_redemption_epochs(self.bond, accounts[1], [t2])
            self.check_redemption_epochs(self.bond, accounts[2], [t1, t2])
            self.check_redemption_epochs(self.bond, accounts[3], [t3])

            self.epoch_id += self._bond_redemption_period
            t4 = self.epoch_id + self._bond_redemption_period

            self.check_decrease_bond_supply(accounts[4], [t1], 0, 0)
            self.check_decrease_bond_supply(accounts[2], [], 0, 0)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            balance = self.coin.balance_of(accounts[2])
            self.assertEqual(bond_operation.bond_budget, 0)
            self.check_decrease_bond_supply(accounts[2], [t1], 11, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t1), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t2), 11)
            self.assertEqual(self.bond.balance_of(accounts[2], t3), 0)
            self.check_redemption_epochs(self.bond, accounts[2], [t2])
            self.assertEqual(self.coin.balance_of(accounts[2]),
                             balance + 11 * self._bond_redemption_price)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.assertEqual(self.bond.total_supply, bond_supply - 11)
            self.assertEqual(self.coin.total_supply, coin_supply +
                             11 * self._bond_redemption_price)

            self.check_decrease_bond_supply(accounts[2], [t2, 123456], 11, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t1), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t2), 0)
            self.check_redemption_epochs(self.bond, accounts[2], [])
            self.assertEqual(self.coin.balance_of(accounts[2]),
                             balance + 22 * self._bond_redemption_price)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.assertEqual(self.bond.total_supply, bond_supply - 22)
            self.assertEqual(self.coin.total_supply, coin_supply +
                             22 * self._bond_redemption_price)

            self.check_decrease_bond_supply(accounts[2], [t3], 0, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t1), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t2), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t3), 0)
            self.check_redemption_epochs(self.bond, accounts[2], [])
            self.assertEqual(self.coin.balance_of(accounts[2]),
                             balance + 22 * self._bond_redemption_price)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.assertEqual(self.bond.total_supply, bond_supply - 22)
            self.assertEqual(self.coin.total_supply, coin_supply +
                             22 * self._bond_redemption_price)

            balance = self.coin.balance_of(accounts[3])
            self.check_decrease_bond_supply(accounts[3], [t2, t2, t1], 0, 0)
            self.assertEqual(self.bond.balance_of(accounts[3], t1), 0)
            self.assertEqual(self.bond.balance_of(accounts[3], t2), 0)
            self.assertEqual(self.bond.balance_of(accounts[3], t3), 48)
            self.check_redemption_epochs(self.bond, accounts[3], [t3])
            self.assertEqual(self.coin.balance_of(accounts[3]), balance)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.assertEqual(self.bond.total_supply, bond_supply - 22)
            self.assertEqual(self.coin.total_supply, coin_supply +
                             22 * self._bond_redemption_price)

            self.check_decrease_bond_supply(accounts[3], [t3, t3, t3], 48, 0)
            self.assertEqual(self.bond.balance_of(accounts[3], t1), 0)
            self.assertEqual(self.bond.balance_of(accounts[3], t2), 0)
            self.assertEqual(self.bond.balance_of(accounts[3], t3), 0)
            self.check_redemption_epochs(self.bond, accounts[3], [])
            self.assertEqual(self.coin.balance_of(accounts[3]),
                             balance + 48 * self._bond_redemption_price)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.assertEqual(self.bond.total_supply, bond_supply - 70)
            self.assertEqual(self.coin.total_supply, coin_supply +
                             70 * self._bond_redemption_price)

            balance = self.coin.balance_of(accounts[1])
            self.check_decrease_bond_supply(accounts[1], [t2], 10, 0)
            self.assertEqual(self.bond.balance_of(accounts[1], t2), 0)
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[1]), 0);
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[2]), 0);
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[3]), 0);
            self.check_redemption_epochs(self.bond, accounts[1], [])
            self.assertEqual(self.coin.balance_of(accounts[1]),
                             balance + 10 * self._bond_redemption_price)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.assertEqual(self.bond.total_supply, bond_supply - 80)
            self.assertEqual(self.coin.total_supply, coin_supply +
                             80 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, 0)

            self.assertEqual(bond_operation.bond_budget, 0)
            self.check_update_bond_budget(-100 * self._bond_price, 0)
            self.assertEqual(bond_operation.bond_budget, 100)

            balance = self.coin.balance_of(accounts[2])
            self.coin.move(accounts[2], accounts[1], balance)
            self.assertEqual(self.coin.balance_of(accounts[2]), 0)
            self.coin.move(accounts[1], accounts[2], 100 * self._bond_price)
            self.check_increase_bond_supply(accounts[2], 20, t4)
            t5 = self.epoch_id + self._bond_redemption_period
            self.check_increase_bond_supply(accounts[2], 20, t5)
            self.epoch_id += self._bond_redemption_period - 1
            t6 = self.epoch_id + self._bond_redemption_period
            self.check_increase_bond_supply(accounts[2], 20, t6)
            self.epoch_id += 1
            t7 = self.epoch_id + self._bond_redemption_period
            self.check_increase_bond_supply(accounts[2], 20, t7)
            self.epoch_id += 1
            t8 = self.epoch_id + self._bond_redemption_period
            self.check_increase_bond_supply(accounts[2], 20, t8)
            self.assertEqual(self.coin.balance_of(accounts[2]), 0)
            self.assertEqual(t4, t5)
            self.assertNotEqual(t4, t6)
            self.assertEqual(t7 - t4, self._bond_redemption_period)
            self.assertEqual(t8 - t7, 1)

            self.assertEqual(bond_operation.bond_budget, 0)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.check_decrease_bond_supply(
                accounts[2], [t4, t5, t6, t7, t8], 40, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t4), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t5), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 20)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 20)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 20)
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[1]), 0);
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[2]), 60);
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[3]), 0);
            self.check_redemption_epochs(self.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(
                self.coin.total_supply,
                coin_supply + 40 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, bond_supply - 40)
            self.assertEqual(bond_operation.bond_budget, 0)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.check_decrease_bond_supply(accounts[2], [t6, t7, t8], 0, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 20)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 20)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 20)
            self.check_redemption_epochs(self.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(self.coin.total_supply, coin_supply)
            self.assertEqual(self.bond.total_supply, bond_supply)
            self.assertEqual(bond_operation.bond_budget, 0)

            self.check_update_bond_budget(
                5 * self._bond_redemption_price, 0)
            self.assertEqual(bond_operation.bond_budget, -5)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.check_decrease_bond_supply(accounts[2], [t6, t7, t8], 5, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 15)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 20)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 20)
            self.check_redemption_epochs(self.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(
                self.coin.total_supply,
                coin_supply + 5 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, bond_supply - 5)
            self.assertEqual(bond_operation.bond_budget, 0)

            self.assertEqual(bond_operation.bond_budget, 0)
            self.check_update_bond_budget(5 * self._bond_redemption_price, 0)
            self.assertEqual(bond_operation.bond_budget, -5)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.check_decrease_bond_supply(accounts[2], [t8, t7, t6], 5, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 15)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 20)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 15)
            self.check_redemption_epochs(self.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(
                self.coin.total_supply,
                coin_supply + 5 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, bond_supply - 5)
            self.assertEqual(bond_operation.bond_budget, 0)

            self.assertEqual(bond_operation.bond_budget, 0)
            self.check_update_bond_budget(
                5 * self._bond_redemption_price, 0)
            self.assertEqual(bond_operation.bond_budget, -5)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.check_decrease_bond_supply(accounts[2], [t7], 5, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 15)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 15)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 15)
            self.check_redemption_epochs(self.bond, accounts[2], [t6, t7, t8])
            self.assertEqual(
                self.coin.total_supply,
                coin_supply + 5 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, bond_supply - 5)
            self.assertEqual(bond_operation.bond_budget, 0)

            self.epoch_id += self._bond_redemption_period - 2
            t9 = self.epoch_id + self._bond_redemption_period

            self.assertEqual(bond_operation.bond_budget, 0)
            self.check_update_bond_budget(
                5 * self._bond_redemption_price, 0)
            self.assertEqual(bond_operation.bond_budget, -5)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.assertEqual(t9 - t6, self._bond_redemption_period)
            self.assertEqual(t6 <= self.epoch_id, True)
            self.check_decrease_bond_supply(accounts[2], [t6, t8, t7], 20, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 15)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 10)
            self.check_redemption_epochs(self.bond, accounts[2], [t7, t8])
            self.assertEqual(
                self.coin.total_supply,
                coin_supply + 20 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, bond_supply - 20)
            self.assertEqual(bond_operation.bond_budget, 0)

            self.check_update_bond_budget(
                15 * self._bond_redemption_price, 0)
            self.assertEqual(bond_operation.bond_budget, -15)
            self.check_update_bond_budget(
                30 * self._bond_redemption_price,
                5 * self._bond_redemption_price)
            self.assertEqual(bond_operation.bond_budget, -25)
            self.check_update_bond_budget(
                1 * self._bond_redemption_price, 0)
            self.assertEqual(bond_operation.bond_budget, -1)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.check_decrease_bond_supply(accounts[2], [t7, t8], 1, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 14)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 10)
            self.check_redemption_epochs(self.bond, accounts[2], [t7, t8])
            self.assertEqual(
                self.coin.total_supply,
                coin_supply + 1 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, bond_supply - 1)
            self.assertEqual(bond_operation.bond_budget, 0)

            self.epoch_id += 1
            t10 = self.epoch_id + self._bond_redemption_period

            self.check_update_bond_budget(
                2 * self._bond_redemption_price, 0)
            self.assertEqual(bond_operation.bond_budget, -2)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.check_decrease_bond_supply(accounts[2], [t8, t7], 16, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 8)
            self.check_redemption_epochs(self.bond, accounts[2], [t8])
            self.assertEqual(
                self.coin.total_supply,
                coin_supply + 16 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, bond_supply - 16)
            self.assertEqual(bond_operation.bond_budget, 0)

            self.check_update_bond_budget(
                1 * self._bond_redemption_price, 0)
            self.assertEqual(bond_operation.bond_budget, -1)

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.check_decrease_bond_supply(accounts[2], [t8], 1, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 7)
            self.check_redemption_epochs(self.bond, accounts[2], [t8])
            self.assertEqual(
                self.coin.total_supply,
                coin_supply + 1 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, bond_supply - 1)
            self.assertEqual(bond_operation.bond_budget, 0)

            self.epoch_id += 1
            t11 = self.epoch_id + self._bond_redemption_period

            coin_supply = self.coin.total_supply
            bond_supply = self.bond.total_supply
            self.check_decrease_bond_supply(accounts[2], [t8], 7, 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t6), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t7), 0)
            self.assertEqual(self.bond.balance_of(accounts[2], t8), 0)
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[1]), 0);
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[2]), 0);
            self.assertEqual(
                self.bond.number_of_bonds_owned_by(accounts[3]), 0);
            self.check_redemption_epochs(self.bond, accounts[2], [])
            self.assertEqual(
                self.coin.total_supply,
                coin_supply + 7 * self._bond_redemption_price)
            self.assertEqual(self.bond.total_supply, bond_supply - 7)
            self.assertEqual(bond_operation.bond_budget, 0)

            self.assertEqual(self.bond.total_supply, 0)
            self.assertEqual(bond_operation.bond_budget, 0)
            self.check_update_bond_budget(
                5 * self._bond_redemption_price,
                5 * self._bond_redemption_price)
            self.assertEqual(bond_operation.bond_budget, 0)

        # bond expire
        self.check_update_bond_budget(-self._bond_price * 80, 0)
        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.bond_budget, 80)
        
        self.coin.move(accounts[1], accounts[2], self._bond_price * 30)
        
        self.epoch_id += 1
        t1 = self.epoch_id + self._bond_redemption_period

        self.check_increase_bond_supply(accounts[2], 10, t1)
        self.assertEqual(self.bond.total_supply, 10)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 10)
        self.assertEqual(self.bond.balance_of(accounts[2], t1), 10)
        self.check_redemption_epochs(self.bond, accounts[2], [t1])

        self.epoch_id += 1
        t2 = self.epoch_id + self._bond_redemption_period

        self.check_increase_bond_supply(accounts[2], 20, t2)
        self.assertEqual(self.bond.total_supply, 30)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 30)
        self.assertEqual(self.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(self.bond, accounts[2], [t1, t2])

        self.epoch_id += (self._bond_redemption_period +
                          self._bond_redeemable_period - 2)
        
        self.assertEqual(self.bond.total_supply, 30)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 30)
        self.assertEqual(self.bond.balance_of(accounts[2], t1), 10)
        self.assertEqual(self.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(self.bond, accounts[2], [t1, t2])

        self.check_decrease_bond_supply(accounts[2], [t1], 10, 0)
        self.check_decrease_bond_supply(accounts[2], [t1], 0, 0)

        self.epoch_id += 1
        
        self.assertEqual(self.bond.total_supply, 20)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 20)
        self.assertEqual(self.bond.balance_of(accounts[2], t1), 0)
        self.assertEqual(self.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(self.bond, accounts[2], [t2])

        self.check_decrease_bond_supply(accounts[2], [t2], 20, 0)
        self.check_decrease_bond_supply(accounts[2], [t2], 0, 0)

        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 0)
        self.assertEqual(self.bond.balance_of(accounts[2], t1), 0)
        self.assertEqual(self.bond.balance_of(accounts[2], t2), 0)
        self.check_redemption_epochs(self.bond, accounts[2], [])

        self.coin.move(accounts[1], accounts[2], self._bond_price * 30)

        self.epoch_id += 1
        t1 = self.epoch_id + self._bond_redemption_period

        self.check_increase_bond_supply(accounts[2], 10, t1)
        self.assertEqual(self.bond.total_supply, 10)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 10)
        self.assertEqual(self.bond.balance_of(accounts[2], t1), 10)
        self.check_redemption_epochs(self.bond, accounts[2], [t1])

        self.epoch_id += 1
        t2 = self.epoch_id + self._bond_redemption_period

        self.check_increase_bond_supply(accounts[2], 20, t2)
        self.assertEqual(self.bond.total_supply, 30)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 30)
        self.assertEqual(self.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(self.bond, accounts[2], [t1, t2])

        self.epoch_id += (self._bond_redemption_period +
                          self._bond_redeemable_period - 1)
        
        self.assertEqual(self.bond.total_supply, 30)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 20)
        self.assertEqual(self.bond.balance_of(accounts[2], t1), 10)
        self.assertEqual(self.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(self.bond, accounts[2], [t1, t2])

        self.check_decrease_bond_supply(accounts[2], [t1], 0, 10)

        self.epoch_id += 1
        
        self.assertEqual(self.bond.total_supply, 20)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 0)
        self.assertEqual(self.bond.balance_of(accounts[2], t1), 0)
        self.assertEqual(self.bond.balance_of(accounts[2], t2), 20)
        self.check_redemption_epochs(self.bond, accounts[2], [t2])

        self.check_decrease_bond_supply(accounts[2], [t2], 0, 20)

        self.assertEqual(self.bond.total_supply, 0)
        self.assertEqual(bond_operation.valid_bond_supply(self.epoch_id), 0)
        self.assertEqual(self.bond.balance_of(accounts[2], t1), 0)
        self.assertEqual(self.bond.balance_of(accounts[2], t2), 0)
        self.check_redemption_epochs(self.bond, accounts[2], [])

    def check_update_bond_budget(self, delta, mint):
        self.assertEqual(
            self.bond_operation.update_bond_budget(delta, self.epoch_id), mint)

    def check_increase_bond_supply(self, account, count, redemption_epoch):
        self.assertEqual(self.bond_operation.increase_bond_supply(
            account, count, self.epoch_id, self.coin), redemption_epoch)

    def check_decrease_bond_supply(self, account, redemption_epochs,
                           redeemed_bonds, expired_bonds):
        (ret1, ret2) = self.bond_operation.decrease_bond_supply(
            account, redemption_epochs, self.epoch_id, self.coin)
        self.assertEqual(ret1, redeemed_bonds)
        self.assertEqual(ret2, expired_bonds)

    def check_redemption_epochs(self, bond, account, expected):
        count = bond.number_of_redemption_epochs_owned_by(account)
        self.assertEqual(count, len(expected))

        with self.assertRaises(Exception):
            bond.get_redemption_epoch_owned_by(account, count)

        for index in range(count):
            self.assertTrue(
                bond.get_redemption_epoch_owned_by(account, index)
                in expected)


def main():
    bond_price = 996
    bond_redemption_price = 1000
    bond_redemption_period = 12
    bond_redeemable_period = 2

    test = BondOperationUnitTest(
        bond_price,
        bond_redemption_price,
        bond_redemption_period,
        bond_redeemable_period)
    test.run()
    test.teardown()

    for (bond_price, bond_redemption_price) in [
            (1, 3), (996, 1000), (1000, 1000)]:
        for bond_redemption_period in range(1, 12):
            for bond_redeemable_period in range(1, 12):
                test = BondOperationUnitTest(
                    bond_price,
                    bond_redemption_price,
                    bond_redemption_period,
                    bond_redeemable_period)
                test.run()
                test.teardown()


if __name__ == "__main__":
    main()
