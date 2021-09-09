#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import common

# Need 5 parameters:
# - level_max
# - reclaim_threshold
# - proportional_reward_rate
# - voter_count
# - iteration

common.reset_network(11)
command = "truffle test test/oracle_simulator.js '5 1 90 10 10'"
common.run_test(command)

iteration = 40
for level_max in [2, 4, 9]:
    for reclaim_threshold in [0, 1, int(level_max / 2), level_max - 1]:
        for proportional_reward_rate in [0, 90, 100]:
            for voter_count in [1, 20]:
                command = (
                    "truffle test test/oracle_simulator.js '" +
                    str(level_max) + " " +
                    str(reclaim_threshold) + " " +
                    str(proportional_reward_rate) + " " +
                    str(voter_count) + " " +
                    str(iteration) + "'")
                common.reset_network(voter_count + 1)
                common.run_test(command)
