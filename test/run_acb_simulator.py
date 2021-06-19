#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import common

# Need 13 parameters:
# - bond_redemption_price
# - bond_redemption_period
# - epoch_duration
# - proportional_reward_rate
# - deposit_rate
# - damping_factor
# - level_to_exchange_rate
# - level_to_bond_price
# - reclaim_threshold
# - voter_count
# - iteration
# - should_upgrade

common.reset_network(41)
command = ("truffle test acb_simulator.js " +
           "'1000 84 7 90 10 10 [6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "[970, 978, 986, 992, 997, 997, 997, 997, 997] " +
           "1 40 100 0'")
common.run_test(command)

iteration = 100
for bond_redemption_price in [1000]:
    for bond_redemption_period in [1, 84 * 24 * 60 * 60]:
        for epoch_duration in [1, 7 * 24 * 60 * 60]:
            for proportional_reward_rate in [0, 90, 100]:
                for deposit_rate in [0, 10, 100]:
                    for damping_factor in [10, 100]:
                        p = bond_redemption_price
                        for (level_to_exchange_rate,
                             level_to_bond_price) in [
                                 ([9, 11, 12],
                                  [max(1, p - 20), max(1, p - 10), p]),
                                 ([0, 1, 10, 11, 12],
                                  [max(1, p - 20), max(1, p - 10), p, p, p]),
                                 ([6, 7, 8, 9, 10, 11, 12, 13, 14],
                                  [max(1, p - 30),
                                   max(1, p - 20), max(1, p - 20),
                                   max(1, p - 10), max(1, p - 10),
                                   p, p, p, p])]:
                            for reclaim_threshold in [1, len(
                                level_to_exchange_rate) - 1]:
                                for voter_count in [40]:
                                    command = (
                                        "truffle test acb_simulator.js '" +
                                        str(bond_redemption_price) + " " +
                                        str(bond_redemption_period) + " " +
                                        str(epoch_duration) + " " +
                                        str(proportional_reward_rate) + " " +
                                        str(deposit_rate) + " " +
                                        str(damping_factor) + " " +
                                        str(level_to_exchange_rate) + " " +
                                        str(level_to_bond_price) + " " +
                                        str(reclaim_threshold) + " " +
                                        str(voter_count) + " " +
                                        str(iteration) + " 0'")
                                    common.reset_network(voter_count + 1)
                                    common.run_test(command)
