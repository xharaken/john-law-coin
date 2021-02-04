#!/usr/bin/env python3
#
# Copyright 2021 Google LLC
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

# Need 7 parameters:
# - level_max
# - reclaim_threshold
# - proportional_reward_rate
# - mint
# - deposit
# - mode_level
# - other_level

common.reset_network(8)
command = "truffle test oracle_unittest.js '5 1 90 20 100 2 0'"
common.run_test(command)

for level_max in [2, 4, 9]:
    for reclaim_threshold in range(0, level_max):
        for proportional_reward_rate in [0, 90, 100]:
            for mint in [0, 50]:
                for deposit in [0, 100]:
                    for mode_level in range(0, level_max):
                        for other_level in [0, int(level_max / 2),
                                            level_max - 1]:
                            if other_level == mode_level:
                                continue
                            command = (
                                "truffle test oracle_unittest.js '" +
                                str(level_max) + " " +
                                str(reclaim_threshold) + " " +
                                str(proportional_reward_rate) + " " +
                                str(mint) + " " +
                                str(deposit) + " " +
                                str(mode_level) + " " +
                                str(other_level) + "'")
                            common.reset_network(8)
                            common.run_test(command)
