#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import common

# Need 16 parameters:
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
# - should_upgrade

for i in range(10):
    command = ("truffle test acb_simulator.js " +
               "'996 1000 12 2 604800 90 10 10 " +
               "[6, 7, 8, 9, 10, 11, 12, 13, 14] " +
               "1 28800 20 3 40 100 0'")
    common.reset_network(41)
    common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'800 1000 12 2 604800 90 10 10 " +
           "[6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "1 28800 20 3 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'996 1000 12 2 604800 90 10 10 " +
           "[2, 3, 4, 5, 6, 7, 8, 9, 10] " +
           "1 28800 20 3 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'996 1000 12 2 604800 90 10 10 " +
           "[10, 11, 12, 13, 14, 15, 16, 17, 18] " +
           "1 28800 20 3 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'996 1000 12 2 604800 90 10 90 " +
           "[6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "1 28800 20 3 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'996 1000 12 2 604800 90 90 10 " +
           "[6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "1 28800 20 3 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'996 1000 12 2 604800 10 10 10 " +
           "[6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "1 28800 20 3 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'996 1000 1 2 604800 90 10 10 " +
           "[6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "1 28800 20 3 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'996 1000 1 2 604800 90 10 10 " +
           "[6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "1 28800 60 3 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'996 1000 1 2 604800 90 10 10 " +
           "[6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "1 28800 20 1 40 100 0'")
common.reset_network(41)
common.run_test(command)
