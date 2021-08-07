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

common.reset_network(41)
command = ("truffle test test/acb_simulator.js " +
           "'996 1000 12 2 604800 90 10 10 [6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "1 28800 20 3 40 30 1'")
common.run_test(command)

iteration = 30
for (bond_price, bond_redemption_price) in [(996, 1000)]:
    for bond_redemption_period in [1, 12]:
        for bond_redeemable_period in [1, 12]:
            for epoch_duration in [7 * 24 * 60 * 60]:
                for proportional_reward_rate in [0, 90, 100]:
                    for deposit_rate in [0, 10, 100]:
                        for damping_factor in [10, 100]:
                            for level_to_exchange_rate in [
                                    [9, 11, 12],
                                    [0, 1, 10, 11, 12],
                                    [6, 7, 8, 9, 10, 11, 12, 13, 14]]:
                                for reclaim_threshold in [1, len(
                                        level_to_exchange_rate) - 1]:
                                    price_change_interval = (
                                        int(epoch_duration / 21) + 1)
                                    price_change_percentage = 20
                                    start_price_multiplier = 3
                                    for voter_count in [40]:
                                        command = (
                                            "truffle test " +
                                            "test/acb_simulator.js '" +
                                            str(bond_price) + " " +
                                            str(bond_redemption_price) + " " +
                                            str(bond_redemption_period) + " " +
                                            str(bond_redeemable_period) + " " +
                                            str(epoch_duration) + " " +
                                            str(proportional_reward_rate) +
                                            " " +
                                            str(deposit_rate) + " " +
                                            str(damping_factor) + " " +
                                            str(level_to_exchange_rate) + " " +
                                            str(reclaim_threshold) + " " +
                                            str(price_change_interval) + " " +
                                            str(price_change_percentage) + " " +
                                            str(start_price_multiplier) + " " +
                                            str(voter_count) + " " +
                                            str(iteration) + " 1'")
                                        common.reset_network(voter_count + 1)
                                        common.run_test(command)
