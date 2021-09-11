#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

from johnlawcoin import *
import unittest

class OpenMarketOperationUnitTest(unittest.TestCase):
    def __init__(self, price_change_interval,
                 price_change_percentage, start_price_multiplier):
        super().__init__()
        print('price_change_interval=%d price_change_percentage=%d '
              'start_price_multiplier=%d' %
              (price_change_interval, price_change_percentage,
               start_price_multiplier))

        self._open_market_operation = OpenMarketOperation()
        self._open_market_operation.override_constants_for_testing(
            price_change_interval, price_change_percentage,
            start_price_multiplier)
        self._eth_pool = EthPool()
        self._price_change_interval = price_change_interval
        self._price_change_percentage = price_change_percentage
        self._price_change_max = OpenMarketOperation.PRICE_CHANGE_MAX
        self._start_price_multiplier = start_price_multiplier

    def teardown(self):
        pass

    def run(self):
        accounts = ['0x0000', '0x1000', '0x2000', '0x3000', '0x4000',
                    '0x5000', '0x6000', '0x7000']
        operation = self._open_market_operation
        latest_price = operation.latest_price
        
        self.assertEqual(operation.start_price, 0)
        self.assertEqual(operation.latest_price, latest_price)
        self.assertEqual(operation.coin_budget, 0)
        self.assertEqual(operation.eth_balance, 0)

        with self.assertRaises(Exception):
            operation.increase_coin_supply(0, 0)
        with self.assertRaises(Exception):
            operation.increase_coin_supply(10, 10)
        with self.assertRaises(Exception):
            operation.decrease_coin_supply(0, 0)
        with self.assertRaises(Exception):
            operation.decrease_coin_supply(10, 10)

        operation.update_coin_budget(0)
        self.assertEqual(operation.start_price, 0)
        self.assertEqual(operation.latest_price, latest_price)
        self.assertEqual(operation.coin_budget, 0)
        self.assertEqual(operation.eth_balance, 0)
        
        with self.assertRaises(Exception):
            operation.increase_coin_supply(0, 0)
        with self.assertRaises(Exception):
            operation.increase_coin_supply(10, 10)
        with self.assertRaises(Exception):
            operation.decrease_coin_supply(0, 0)
        with self.assertRaises(Exception):
            operation.decrease_coin_supply(10, 10)

        eth_balance = 0
        for updated_coin_budget in [
                1000, 2000, -1000, -2000, 0, 10000, 0, -10000,
                -100000000]:
            operation.update_coin_budget(updated_coin_budget)
            start_price = 0
            if updated_coin_budget > 0:
                start_price = latest_price * self._start_price_multiplier
            elif updated_coin_budget < 0:
                start_price = int(latest_price / self._start_price_multiplier)
            self.assertEqual(operation.start_price, start_price)
            self.assertEqual(operation.latest_price, latest_price)
            self.assertEqual(operation.coin_budget, updated_coin_budget)
            self.assertEqual(operation.eth_balance, eth_balance)

            if updated_coin_budget >= 0:
                with self.assertRaises(Exception):
                    operation.decrease_coin_supply(0, 0)
                with self.assertRaises(Exception):
                    operation.decrease_coin_supply(10, 10)
            if updated_coin_budget <= 0:
                with self.assertRaises(Exception):
                    operation.increase_coin_supply(0, 0)
                with self.assertRaises(Exception):
                    operation.increase_coin_supply(10, 10)

            coin_budget = updated_coin_budget
            if updated_coin_budget > 0:
                for elapsed_time in [
                        0, 1, self._price_change_interval + 1,
                        self._price_change_interval,
                        self._price_change_interval - 1,
                        self._price_change_interval * 2,
                        self._price_change_interval * 2 - 1,
                        self._price_change_interval * 22]:
                    for requested_eth_amount in [
                            0, 1, int(updated_coin_budget * start_price / 4),
                            int(updated_coin_budget * start_price / 8),
                            updated_coin_budget * start_price + 1]:
                        if coin_budget == 0:
                            with self.assertRaises(Exception):
                                operation.increase_coin_supply(
                                    requested_eth_amount, elapsed_time)
                            continue
                        price = start_price
                        for i in range(
                                min(int(elapsed_time /
                                        self._price_change_interval),
                                    self._price_change_max)):
                            price = int(price * (
                                100 - self._price_change_percentage) / 100)
                        if price == 0:
                            price = 1
                        self.assertEqual(
                            operation.get_current_price(elapsed_time), price)
                            
                        eth_amount = 0
                        coin_amount = 0
                        if price == 0:
                            with self.assertRaises(Exception):
                                operation.increase_coin_supply(
                                    requested_eth_amount, elapsed_time)
                            continue
                        coin_amount = int(requested_eth_amount / price)
                        if coin_amount > coin_budget:
                            coin_amount = coin_budget
                        eth_amount = coin_amount * price
                        if coin_amount > 0:
                            latest_price = price
                        coin_budget -= coin_amount
                        eth_balance += eth_amount
                        self.assertEqual(operation.increase_coin_supply(
                            requested_eth_amount, elapsed_time),
                                         (eth_amount, coin_amount))
                        self.assertEqual(operation.start_price, start_price)
                        self.assertEqual(operation.latest_price, latest_price)
                        self.assertEqual(operation.coin_budget, coin_budget)
                        self.assertEqual(operation.eth_balance, eth_balance)
            elif updated_coin_budget < 0:
                for elapsed_time in [
                        0, 1, self._price_change_interval + 1,
                        self._price_change_interval,
                        self._price_change_interval - 1,
                        self._price_change_interval * 2,
                        self._price_change_interval * 2 - 1,
                        self._price_change_interval * 22]:
                    for requested_coin_amount in [
                            0, 1, int(-updated_coin_budget / 4),
                            int(-updated_coin_budget / 8),
                            -updated_coin_budget + 1]:
                        if coin_budget == 0:
                            with self.assertRaises(Exception):
                                operation.decrease_coin_supply(
                                    requested_eth_amount, elapsed_time)
                            continue
                        
                        price = start_price
                        for i in range(
                                min(int(elapsed_time /
                                        self._price_change_interval),
                                    self._price_change_max)):
                            price = int(price * (
                                100 + self._price_change_percentage) / 100)
                        self.assertEqual(
                            operation.get_current_price(elapsed_time), price)
                            
                        eth_amount = 0
                        coin_amount = 0
                        if price == 0:
                            with self.assertRaises(Exception):
                                operation.decrease_coin_supply(
                                    requested_eth_amount, elapsed_time)
                            continue
                        coin_amount = requested_coin_amount
                        if coin_amount >= -coin_budget:
                            coin_amount = -coin_budget
                        eth_amount = int(coin_amount * price)
                        if eth_amount >= eth_balance:
                            eth_amount = eth_balance
                        coin_amount = int(eth_amount / price)
                        if coin_amount > 0:
                            latest_price = price
                        coin_budget += coin_amount
                        eth_balance -= eth_amount
                        self.assertEqual(operation.decrease_coin_supply(
                            requested_coin_amount, elapsed_time),
                                         (eth_amount, coin_amount))
                        self.assertEqual(operation.start_price, start_price)
                        self.assertEqual(operation.latest_price, latest_price)
                        self.assertEqual(operation.coin_budget, coin_budget)
                        self.assertEqual(operation.eth_balance, eth_balance)

        self.assertEqual(self._eth_pool.eth_balance, 0)
        self._eth_pool.increase_eth(10)
        self.assertEqual(self._eth_pool.eth_balance, 10)
        self._eth_pool.increase_eth(100)
        self.assertEqual(self._eth_pool.eth_balance, 110)
        self._eth_pool.decrease_eth(accounts[0], 20)
        self.assertEqual(self._eth_pool.eth_balance, 90)
        with self.assertRaises(Exception):
            self._eth_pool.decrease_eth(accounts[0], 91)
        self._eth_pool.decrease_eth(accounts[0], 90)
        self.assertEqual(self._eth_pool.eth_balance, 0)
        self._eth_pool.decrease_eth(accounts[0], 0)
        self.assertEqual(self._eth_pool.eth_balance, 0)
        

def main():
    test = OpenMarketOperationUnitTest(8 * 60 * 60, 15, 3)
    test.run()
    test.teardown()

    for price_change_interval in [1, 8 * 60 * 60]:
        for price_change_percentage in [0, 1, 15, 50, 99, 100]:
            for start_price_multiplier in [1, 3, 100]:
                test = OpenMarketOperationUnitTest(
                    price_change_interval, price_change_percentage,
                    start_price_multiplier)
                test.run()
                test.teardown()

if __name__ == "__main__":
    main()
