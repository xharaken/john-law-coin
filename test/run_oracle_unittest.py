#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import common

# Need 7 parameters:
# - level_max
# - reclaim_threshold
# - proportional_reward_rate
# - tax
# - deposit
# - mode_level
# - other_level

common.reset_network(8)
command = "truffle test oracle_unittest.js '5 1 90 100 20 2 0'"
common.run_test(command)

for level_max in [2, 4, 9]:
    for reclaim_threshold in [0, 1, level_max - 1]:
        for proportional_reward_rate in [0, 90, 100]:
            for tax in [0, 50]:
                for deposit in [0, 100]:
                    for mode_level in [0, int(level_max / 2),
                                       level_max - 1]:
                        for other_level in [0, int(level_max / 2),
                                            level_max - 1]:
                            if other_level == mode_level:
                                continue
                            command = (
                                "truffle test oracle_unittest.js '" +
                                str(level_max) + " " +
                                str(reclaim_threshold) + " " +
                                str(proportional_reward_rate) + " " +
                                str(tax) + " " +
                                str(deposit) + " " +
                                str(mode_level) + " " +
                                str(other_level) + "'")
                            common.reset_network(8)
                            common.run_test(command)
