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

# Need 13 parameters:
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
# - should_upgrade

for i in range(10):
    command = ("truffle test acb_simulator.js " +
               "'1000 84 7 90 10 10 [6, 7, 8, 9, 10, 11, 12, 13, 14] " +
               "[970, 978, 986, 992, 997, 997, 997, 997, 997] " +
               "[30, 20, 12, 5, 0, 0, 0, 0, 0] 1 40 100 0'")
    common.reset_network(41)
    common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'1000 84 7 90 10 10 [6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "[200, 400, 600, 800, 997, 997, 997, 997, 997] " +
           "[30, 20, 12, 5, 0, 0, 0, 0, 0] 1 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'1000 84 7 90 10 10 [2, 3, 4, 5, 6, 7, 8, 9, 10] " +
           "[970, 978, 986, 992, 997, 997, 997, 997, 997] " +
           "[30, 20, 12, 5, 0, 0, 0, 0, 0] 1 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'1000 84 7 90 10 10 [10, 11, 12, 13, 14, 15, 16, 17, 18] " +
           "[970, 978, 986, 992, 997, 997, 997, 997, 997] " +
           "[30, 20, 12, 5, 0, 0, 0, 0, 0] 1 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'1000 84 7 90 10 90 [6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "[970, 978, 986, 992, 997, 997, 997, 997, 997] " +
           "[30, 20, 12, 5, 0, 0, 0, 0, 0] 1 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'1000 84 7 90 90 10 [6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "[970, 978, 986, 992, 997, 997, 997, 997, 997] " +
           "[30, 20, 12, 5, 0, 0, 0, 0, 0] 1 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'1000 84 7 10 10 10 [6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "[970, 978, 986, 992, 997, 997, 997, 997, 997] " +
           "[30, 20, 12, 5, 0, 0, 0, 0, 0] 1 40 100 0'")
common.reset_network(41)
common.run_test(command)

command = ("truffle test acb_simulator.js " +
           "'1000 7 7 90 10 10 [6, 7, 8, 9, 10, 11, 12, 13, 14] " +
           "[970, 978, 986, 992, 997, 997, 997, 997, 997] " +
           "[30, 20, 12, 5, 0, 0, 0, 0, 0] 1 40 100 0'")
common.reset_network(41)
common.run_test(command)
