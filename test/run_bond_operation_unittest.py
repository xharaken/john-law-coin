#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import common

# Need 4 parameters:
# - bond_price
# - bond_redemption_price
# - bond_redemption_period
# - bond_redeemable_period

common.reset_network(8)
command = ("truffle test test/bond_operation_unittest.js " +
           "'996 1000 12 2'")
common.run_test(command)

for (bond_price, bond_redemption_price) in [(1, 3), (996, 1000), (1000, 1000)]:
    for bond_redemption_period in [1, 6, 12]:
        for bond_redeemable_period in [1, 6, 12]:
            command = (
                "truffle test test/bond_operation_unittest.js '" +
                str(bond_price) + " " +
                str(bond_redemption_price) + " " +
                str(bond_redemption_period) + " " +
                str(bond_redeemable_period) + " ")
            common.reset_network(8)
            common.run_test(command)
