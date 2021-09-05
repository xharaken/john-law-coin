#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

from acb_simulator import *
import unittest, random

def main():
    # Need 15 parameters:
    # - bond_price
    # - bond_redemption_price
    # - bond_redemption_period
    # - bond_redeemable_period
    # - epoch_duration
    # - proportional_reward_rate
    # - deposit_rate
    # - damping_factor
    # - level_to_exchange_rate
    # - reclaim_threshold
    # - price_change_interval
    # - price_change_percentage
    # - start_price_multiplier
    # - voter_count
    # - iteration

    for i in range(10):
        test = ACBSimulator(
            996,
            1000,
            12,
            2,
            7 * 24 * 60 * 60,
            90,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            1,
            8 * 60 * 60,
            20,
            3,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")

    for i in range(3):
        test = ACBSimulator(
            800,
            1000,
            12,
            2,
            7 * 24 * 60 * 60,
            90,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            1,
            8 * 60 * 60,
            20,
            3,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")

    for i in range(3):
        test = ACBSimulator(
            996,
            1000,
            12,
            2,
            7 * 24 * 60 * 60,
            90,
            10,
            10,
            [2, 3, 4, 5, 6, 7, 8, 9, 10],
            1,
            8 * 60 * 60,
            20,
            3,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")

    for i in range(3):
        test = ACBSimulator(
            996,
            1000,
            12,
            2,
            7 * 24 * 60 * 60,
            90,
            10,
            10,
            [10, 11, 12, 13, 14, 15, 16, 17, 18],
            1,
            8 * 60 * 60,
            20,
            3,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")

    for i in range(3):
        test = ACBSimulator(
            996,
            1000,
            12,
            2,
            7 * 24 * 60 * 60,
            90,
            10,
            90,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            1,
            8 * 60 * 60,
            20,
            3,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")

    for i in range(3):
        test = ACBSimulator(
            996,
            1000,
            12,
            2,
            7 * 24 * 60 * 60,
            90,
            90,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            1,
            8 * 60 * 60,
            20,
            3,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")

    for i in range(3):
        test = ACBSimulator(
            996,
            1000,
            12,
            2,
            7 * 24 * 60 * 60,
            10,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            1,
            8 * 60 * 60,
            20,
            3,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")

    for i in range(3):
        test = ACBSimulator(
            996,
            1000,
            1,
            2,
            7 * 24 * 60 * 60,
            90,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            1,
            8 * 60 * 60,
            20,
            3,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")

    for i in range(3):
        test = ACBSimulator(
            996,
            1000,
            12,
            2,
            7 * 24 * 60 * 60,
            90,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            1,
            8 * 60 * 60,
            60,
            3,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")

    for i in range(3):
        test = ACBSimulator(
            996,
            1000,
            12,
            2,
            7 * 24 * 60 * 60,
            90,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            1,
            8 * 60 * 60,
            20,
            1,
            40,
            100)
        test.run()
        test.teardown()
    print("========================================================")


if __name__ == "__main__":
    main()
