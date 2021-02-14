#!/usr/bin/env python3
#
# Copyright 2021 Kentaro Hara
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import common

# Need 12 parameters:
# - bond_redemption_price
# - bond_redemption_period
# - phase_duration
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
           "[950, 965, 978, 990, 997, 997, 997, 997, 997] 1 40 30 1'")
common.run_test(command)

iteration = 30
for bond_redemption_price in [1000]:
    for bond_redemption_period in [1, 84 * 24 * 60 * 60]:
        for phase_duration in [1, 7 * 24 * 60 * 60]:
            for proportional_reward_rate in [0, 90, 100]:
                for deposit_rate in [0, 10, 100]:
                    for damping_factor in [10, 100]:
                        p = bond_redemption_price
                        for (level_to_exchange_rate,
                             level_to_bond_price) in [
                                 ([9, 11, 12],
                                  [max(1, p - 20), max(1, p - 10), p]),
                                 ([0, 1, 10, 11, 12],
                                  [max(1, p - 20), max(1, p - 10),
                                   p, p, p]),
                                 ([6, 7, 8, 9, 10, 11, 12, 13, 14],
                                  [max(1, p - 30),
                                   max(1, p - 20), max(1, p - 20),
                                   max(1, p - 10), max(1, p - 10),
                                   p, p, p])]:
                            for reclaim_threshold in [1, len(
                                level_to_exchange_rate) - 1]:
                                for voter_count in [40]:
                                    command = (
                                        "truffle test acb_simulator.js '" +
                                        str(bond_redemption_price) + " " +
                                        str(bond_redemption_period) + " " +
                                        str(phase_duration) + " " +
                                        str(proportional_reward_rate) + " " +
                                        str(deposit_rate) + " " +
                                        str(damping_factor) + " " +
                                        str(level_to_exchange_rate) + " " +
                                        str(level_to_bond_price) + " " +
                                        str(reclaim_threshold) + " " +
                                        str(voter_count) + " " +
                                        str(iteration) + " 1'")
                                    common.reset_network(voter_count + 1)
                                    common.run_test(command)
