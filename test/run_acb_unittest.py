#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import common

# Need 10 parameters:
# - bond_redemption_price
# - bond_redemption_period
# - phase_duration
# - proportional_reward_rate
# - deposit_rate
# - damping_factor
# - reclaim_threshold
# - level_to_exchange_rate
# - level_to_bond_price
# - level_to_tax_rate

common.reset_network(8)
command = ("truffle test acb_unittest.js " +
           "'1000 10 2 90 10 10 [1, 11, 20] [990, 997, 997] [20, 10, 0] 1'")
common.run_test(command)

for bond_redemption_price in [1000]:
    for bond_redemption_period in [1, 84 * 24 * 60 * 60]:
        for phase_duration in [1, 7 * 24 * 60 * 60]:
            for proportional_reward_rate in [0, 90, 100]:
                for deposit_rate in [0, 10, 100]:
                    for damping_factor in [10, 100]:
                        p = bond_redemption_price
                        for (level_to_exchange_rate,
                             level_to_bond_price,
                             level_to_tax_rate) in [
                                 ([9, 11, 12],
                                  [max(1, p - 20), max(1, p - 10), p],
                                  [20, 10, 0]),
                                 ([0, 1, 10, 11, 12],
                                  [max(1, p - 20), max(1, p - 10),
                                   p, p, p],
                                  [20, 10, 10, 0, 0]),
                                 ([6, 7, 8, 9, 10, 11, 12, 13, 14],
                                  [max(1, p - 30),
                                   max(1, p - 20), max(1, p - 20),
                                   max(1, p - 10), max(1, p - 10),
                                   p, p, p, p],
                                  [30, 20, 12, 5, 0, 0, 0, 0, 0])]:
                            for reclaim_threshold in [1, len(
                                level_to_exchange_rate) - 1]:
                                command = (
                                    "truffle test acb_unittest.js '" +
                                    str(bond_redemption_price) + " " +
                                    str(bond_redemption_period) + " " +
                                    str(phase_duration) + " " +
                                    str(proportional_reward_rate) + " " +
                                    str(deposit_rate) + " " +
                                    str(damping_factor) + " " +
                                    str(level_to_exchange_rate) + " " +
                                    str(level_to_bond_price) + " " +
                                    str(level_to_tax_rate) + " " +
                                    str(reclaim_threshold) + "'")
                                common.reset_network(8)
                                common.run_test(command)
