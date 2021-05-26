#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

from acb_simulator import *
import unittest, random

def main():
    # Need 12 parameters:
    # - bond_redemption_price
    # - bond_redemption_period
    # - phase_duration
    # - proportional_reward_rate
    # - deposit_rate
    # - damping_factor
    # - level_to_exchange_rate
    # - level_to_bond_price
    # - level_to_tax_rate
    # - reclaim_threshold
    # - voter_count
    # - iteration

    for i in range(10):
        test = ACBSimulator(
            1000,
            84,
            7,
            90,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            [970, 978, 986, 992, 997, 997, 997, 997, 997],
            [30, 20, 12, 5, 0, 0, 0, 0, 0],
            1,
            40,
            100)
        test.run()
        test.teardown()

    for i in range(3):
        test = ACBSimulator(
            1000,
            84,
            7,
            90,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            [200, 400, 600, 800, 997, 997, 997, 997, 997],
            [30, 20, 12, 5, 0, 0, 0, 0, 0],
            1,
            40,
            100)
        test.run()
        test.teardown()

    for i in range(3):
        test = ACBSimulator(
            1000,
            84,
            7,
            90,
            10,
            10,
            [2, 3, 4, 5, 6, 7, 8, 9, 10],
            [970, 978, 986, 992, 997, 997, 997, 997, 997],
            [30, 20, 12, 5, 0, 0, 0, 0, 0],
            1,
            40,
            100)
        test.run()
        test.teardown()

    for i in range(3):
        test = ACBSimulator(
            1000,
            84,
            7,
            90,
            10,
            10,
            [10, 11, 12, 13, 14, 15, 16, 17, 18],
            [970, 978, 986, 992, 997, 997, 997, 997, 997],
            [30, 20, 12, 5, 0, 0, 0, 0, 0],
            1,
            40,
            100)
        test.run()
        test.teardown()

    for i in range(3):
        test = ACBSimulator(
            1000,
            84,
            7,
            90,
            10,
            90,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            [970, 978, 986, 992, 997, 997, 997, 997, 997],
            [30, 20, 12, 5, 0, 0, 0, 0, 0],
            1,
            40,
            100)
        test.run()
        test.teardown()

    for i in range(3):
        test = ACBSimulator(
            1000,
            84,
            7,
            90,
            90,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            [970, 978, 986, 992, 997, 997, 997, 997, 997],
            [30, 20, 12, 5, 0, 0, 0, 0, 0],
            1,
            40,
            100)
        test.run()
        test.teardown()

    for i in range(3):
        test = ACBSimulator(
            1000,
            84,
            7,
            10,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            [970, 978, 986, 992, 997, 997, 997, 997, 997],
            [30, 20, 12, 5, 0, 0, 0, 0, 0],
            1,
            40,
            100)
        test.run()
        test.teardown()

    for i in range(3):
        test = ACBSimulator(
            1000,
            7,
            7,
            90,
            10,
            10,
            [6, 7, 8, 9, 10, 11, 12, 13, 14],
            [970, 978, 986, 992, 997, 997, 997, 997, 997],
            [30, 20, 12, 5, 0, 0, 0, 0, 0],
            1,
            40,
            100)
        test.run()
        test.teardown()


if __name__ == "__main__":
    main()
