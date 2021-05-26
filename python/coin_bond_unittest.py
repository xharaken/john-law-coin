#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

from johnlawcoin import *
import unittest

class CoinBondUnitTest(unittest.TestCase):
    def __init__(self):
        super().__init__()

    def teardown(self):
        pass

    def run(self):
        accounts = ['0x0000', '0x1000', '0x2000', '0x3000', '0x4000',
                    '0x5000', '0x6000', '0x7000']

        # JohnLawCoin
        coin = JohnLawCoin(accounts[0])
        self.assertTrue(coin.total_supply > 0)
        self.assertEqual(coin.balance_of(accounts[0]), coin.total_supply)
        coin.burn(accounts[0], coin.total_supply)
        self.assertEqual(coin.total_supply, 0)

        # balance_of
        self.assertEqual(coin.balance_of(accounts[1]), 0)

        # mint
        coin.mint(accounts[1], 1)
        self.assertEqual(coin.total_supply, 1)
        self.assertEqual(coin.balance_of(accounts[1]), 1)

        coin.mint(accounts[1], 1)
        self.assertEqual(coin.total_supply, 2)
        self.assertEqual(coin.balance_of(accounts[1]), 2)

        coin.mint(accounts[1], 0)
        self.assertEqual(coin.total_supply, 2)
        self.assertEqual(coin.balance_of(accounts[1]), 2)

        coin.mint(accounts[2], 0)
        self.assertEqual(coin.total_supply, 2)
        self.assertEqual(coin.balance_of(accounts[1]), 2)
        self.assertEqual(coin.balance_of(accounts[2]), 0)

        coin.mint(accounts[2], 100)
        self.assertEqual(coin.total_supply, 102)
        self.assertEqual(coin.balance_of(accounts[1]), 2)
        self.assertEqual(coin.balance_of(accounts[2]), 100)

        # burn
        coin.burn(accounts[1], 1)
        self.assertEqual(coin.total_supply, 101)
        self.assertEqual(coin.balance_of(accounts[1]), 1)
        self.assertEqual(coin.balance_of(accounts[2]), 100)

        coin.burn(accounts[1], 0)
        self.assertEqual(coin.total_supply, 101)
        self.assertEqual(coin.balance_of(accounts[1]), 1)
        self.assertEqual(coin.balance_of(accounts[2]), 100)

        with self.assertRaises(Exception):
            coin.burn(accounts[3], 1)

        with self.assertRaises(Exception):
            coin.burn(accounts[1], 2)

        with self.assertRaises(Exception):
            coin.burn(accounts[2], 101)

        coin.burn(accounts[1], 1)
        self.assertEqual(coin.total_supply, 100)
        self.assertEqual(coin.balance_of(accounts[1]), 0)
        self.assertEqual(coin.balance_of(accounts[2]), 100)

        coin.burn(accounts[2], 100)
        self.assertEqual(coin.total_supply, 0)
        self.assertEqual(coin.balance_of(accounts[1]), 0)
        self.assertEqual(coin.balance_of(accounts[2]), 0)

        coin.burn(accounts[2], 0)
        self.assertEqual(coin.total_supply, 0)
        self.assertEqual(coin.balance_of(accounts[1]), 0)
        self.assertEqual(coin.balance_of(accounts[2]), 0)

        # move
        coin.mint(accounts[1], 100)
        coin.mint(accounts[2], 200)
        self.assertEqual(coin.total_supply, 300)
        self.assertEqual(coin.balance_of(accounts[1]), 100)
        self.assertEqual(coin.balance_of(accounts[2]), 200)

        coin.move(accounts[1], accounts[2], 10)
        self.assertEqual(coin.total_supply, 300)
        self.assertEqual(coin.balance_of(accounts[1]), 90)
        self.assertEqual(coin.balance_of(accounts[2]), 210)

        coin.move(accounts[2], accounts[1], 200)
        self.assertEqual(coin.total_supply, 300)
        self.assertEqual(coin.balance_of(accounts[1]), 290)
        self.assertEqual(coin.balance_of(accounts[2]), 10)

        coin.move(accounts[2], accounts[1], 0)
        self.assertEqual(coin.total_supply, 300)
        self.assertEqual(coin.balance_of(accounts[1]), 290)
        self.assertEqual(coin.balance_of(accounts[2]), 10)

        coin.move(accounts[4], accounts[2], 0)
        self.assertEqual(coin.total_supply, 300)
        self.assertEqual(coin.balance_of(accounts[1]), 290)
        self.assertEqual(coin.balance_of(accounts[2]), 10)

        with self.assertRaises(Exception):
            coin.move(accounts[1], accounts[2], 291)

        with self.assertRaises(Exception):
            coin.move(accounts[5], accounts[2], 1)

        coin.move(accounts[2], accounts[3], 1)
        self.assertEqual(coin.total_supply, 300)
        self.assertEqual(coin.balance_of(accounts[1]), 290)
        self.assertEqual(coin.balance_of(accounts[2]), 9)
        self.assertEqual(coin.balance_of(accounts[3]), 1)

        coin.move(accounts[2], accounts[5], 1)
        self.assertEqual(coin.total_supply, 300)
        self.assertEqual(coin.balance_of(accounts[1]), 290)
        self.assertEqual(coin.balance_of(accounts[2]), 8)
        self.assertEqual(coin.balance_of(accounts[3]), 1)
        self.assertEqual(coin.balance_of(accounts[5]), 1)

        # tax
        coin.set_tax_rate(0)
        coin.transfer(accounts[1], accounts[2], 10)
        self.assertEqual(coin.balance_of(accounts[1]), 280)
        self.assertEqual(coin.balance_of(accounts[2]), 18)
        self.assertEqual(coin.balance_of(coin.tax_account), 0)
        coin.set_tax_rate(10)
        coin.transfer(accounts[1], accounts[2], 10)
        self.assertEqual(coin.balance_of(accounts[1]), 270)
        self.assertEqual(coin.balance_of(accounts[2]), 27)
        self.assertEqual(coin.balance_of(coin.tax_account), 1)
        coin.transfer(accounts[1], accounts[2], 1)
        self.assertEqual(coin.balance_of(accounts[1]), 269)
        self.assertEqual(coin.balance_of(accounts[2]), 28)
        self.assertEqual(coin.balance_of(coin.tax_account), 1)
        coin.transfer(accounts[1], accounts[2], 19)
        self.assertEqual(coin.balance_of(accounts[1]), 250)
        self.assertEqual(coin.balance_of(accounts[2]), 46)
        self.assertEqual(coin.balance_of(coin.tax_account), 2)
        coin.transfer(accounts[1], accounts[1], 20)
        self.assertEqual(coin.balance_of(accounts[1]), 248)
        self.assertEqual(coin.balance_of(accounts[2]), 46)
        self.assertEqual(coin.balance_of(coin.tax_account), 4)
        old_tax_account = coin.tax_account
        coin.set_tax_rate(20)
        self.assertEqual(coin.balance_of(old_tax_account), 0)
        self.assertEqual(coin.balance_of(coin.tax_account), 4)
        old_tax_account = coin.tax_account
        coin.set_tax_rate(0)
        self.assertEqual(coin.balance_of(old_tax_account), 0)
        self.assertEqual(coin.balance_of(coin.tax_account), 4)

        # JohnLawBond
        bond = JohnLawBond()
        self.assertEqual(bond.total_supply, 0)

        # balance_of
        self.assertEqual(bond.balance_of(accounts[1], 1111), 0)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 0)
        self.check_redemption_timestamps(bond, accounts[1], [])

        # mint
        bond.mint(accounts[1], 1111, 1)
        self.assertEqual(bond.total_supply, 1)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 1)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 1)
        self.check_redemption_timestamps(bond, accounts[1], [1111])

        with self.assertRaises(Exception):
            bond.get_redemption_timestamp_owned_by(account, 1)

        bond.mint(accounts[1], 1111, 2)
        self.assertEqual(bond.total_supply, 3)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 3)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 3)
        self.check_redemption_timestamps(bond, accounts[1], [1111])

        bond.mint(accounts[1], 2222, 2)
        self.assertEqual(bond.total_supply, 5)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 3)
        self.assertEqual(bond.balance_of(accounts[1], 2222), 2)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 5)
        self.check_redemption_timestamps(bond, accounts[1], [1111, 2222])

        bond.mint(accounts[2], 2222, 5)
        self.assertEqual(bond.total_supply, 10)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 3)
        self.assertEqual(bond.balance_of(accounts[1], 2222), 2)
        self.assertEqual(bond.balance_of(accounts[2], 2222), 5)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 5)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[2]), 5)
        self.check_redemption_timestamps(bond, accounts[1], [1111, 2222])
        self.check_redemption_timestamps(bond, accounts[2], [2222])

        bond.burn(accounts[3], 1111, 0)
        self.assertEqual(bond.total_supply, 10)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 3)
        self.assertEqual(bond.balance_of(accounts[1], 2222), 2)
        self.assertEqual(bond.balance_of(accounts[2], 2222), 5)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 5)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[2]), 5)
        self.check_redemption_timestamps(bond, accounts[1], [1111, 2222])
        self.check_redemption_timestamps(bond, accounts[2], [2222])

        bond.burn(accounts[2], 1111, 0)
        self.assertEqual(bond.total_supply, 10)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 3)
        self.assertEqual(bond.balance_of(accounts[1], 2222), 2)
        self.assertEqual(bond.balance_of(accounts[2], 2222), 5)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 5)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[2]), 5)
        self.check_redemption_timestamps(bond, accounts[1], [1111, 2222])
        self.check_redemption_timestamps(bond, accounts[2], [2222])

        # burn
        with self.assertRaises(Exception):
            bond.burn(accounts[3], 1111, 1)

        with self.assertRaises(Exception):
            bond.burn(accounts[2], 1111, 1)

        with self.assertRaises(Exception):
            bond.burn(accounts[2], 2222, 6)

        with self.assertRaises(Exception):
            bond.burn(accounts[1], 2222, 3)

        bond.burn(accounts[2], 2222, 5)
        self.assertEqual(bond.total_supply, 5)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 3)
        self.assertEqual(bond.balance_of(accounts[1], 2222), 2)
        self.assertEqual(bond.balance_of(accounts[2], 2222), 0)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 5)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[2]), 0)
        self.check_redemption_timestamps(bond, accounts[1], [1111, 2222])
        self.check_redemption_timestamps(bond, accounts[2], [])

        bond.burn(accounts[1], 2222, 1)
        self.assertEqual(bond.total_supply, 4)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 3)
        self.assertEqual(bond.balance_of(accounts[1], 2222), 1)
        self.assertEqual(bond.balance_of(accounts[2], 2222), 0)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 4)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[2]), 0)
        self.check_redemption_timestamps(bond, accounts[1], [1111, 2222])
        self.check_redemption_timestamps(bond, accounts[2], [])

        bond.burn(accounts[1], 2222, 1)
        self.assertEqual(bond.total_supply, 3)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 3)
        self.assertEqual(bond.balance_of(accounts[1], 2222), 0)
        self.assertEqual(bond.balance_of(accounts[2], 2222), 0)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 3)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[2]), 0)
        self.check_redemption_timestamps(bond, accounts[1], [1111])
        self.check_redemption_timestamps(bond, accounts[2], [])

        bond.burn(accounts[1], 1111, 3)
        self.assertEqual(bond.total_supply, 0)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 0)
        self.assertEqual(bond.balance_of(accounts[1], 2222), 0)
        self.assertEqual(bond.balance_of(accounts[2], 2222), 0)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 0)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[2]), 0)
        self.check_redemption_timestamps(bond, accounts[1], [])
        self.check_redemption_timestamps(bond, accounts[2], [])

        bond.burn(accounts[1], 1111, 0)
        self.assertEqual(bond.total_supply, 0)
        self.assertEqual(bond.balance_of(accounts[1], 1111), 0)
        self.assertEqual(bond.balance_of(accounts[1], 2222), 0)
        self.assertEqual(bond.balance_of(accounts[2], 2222), 0)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[1]), 0)
        self.assertEqual(bond.number_of_bonds_owned_by(accounts[2]), 0)
        self.check_redemption_timestamps(bond, accounts[1], [])
        self.check_redemption_timestamps(bond, accounts[2], [])

    def check_redemption_timestamps(self, bond, account, expected):
        count = bond.number_of_redemption_timestamps_owned_by(account)
        self.assertEqual(count, len(expected))

        with self.assertRaises(Exception):
            bond.get_redemption_timestamp_owned_by(account, count)

        for index in range(count):
            self.assertTrue(
                bond.get_redemption_timestamp_owned_by(account, index)
                in expected)


def main():
    test = CoinBondUnitTest()
    test.run()
    test.teardown()

if __name__ == "__main__":
    main()
