#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import common

# Need 3 parameters:
# - price_change_interval
# - price_change_percentage
# - start_price_multiplier

common.reset_network(8)
command = ("truffle test --network test " +
           "test/open_market_operation_unittest.js '28800 15 3'")
common.run_test(command)

for price_change_interval in [1, 8 * 60 * 60]:
    for price_change_percentage in [0, 1, 15, 50, 99, 100]:
        for start_price_multiplier in [1, 3, 100]:
            command = (
                "truffle test test/open_market_operation_unittest.js '" +
                str(price_change_interval) + " " +
                str(price_change_percentage) + " " +
                str(start_price_multiplier) + "'")
            common.reset_network(8)
            common.run_test(command)
