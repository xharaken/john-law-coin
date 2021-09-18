#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import common

common.reset_network(8)
command = ("truffle test --network test test/logging_unittest.js")
common.run_test(command)
