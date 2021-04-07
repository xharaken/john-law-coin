#!/usr/bin/env python3
#
# Copyright 2021 Kentaro Hara
#
# Licensed under the Apache License, Version 2.0 (the "License")
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

from johnlawcoin import *
import unittest

class LoggingUnitTest(unittest.TestCase):
    def __init__(self):
        super().__init__()

    def teardown(self):
        pass

    def run(self):
        logging = Logging()
        self.assertEqual(logging.log_index, 0)
        acb_log = logging.acb_logs[logging.log_index]
        self.assertEqual(acb_log.minted_coins, 0)
        self.assertEqual(acb_log.burned_coins, 0)
        self.assertEqual(acb_log.coin_supply_delta, 0)
        self.assertEqual(acb_log.bond_budget, 0)
        self.assertEqual(acb_log.coin_total_supply, 0)
        self.assertEqual(acb_log.bond_total_supply, 0)
        self.assertEqual(acb_log.oracle_level, 0)
        self.assertEqual(acb_log.current_phase_start, 0)
        self.assertEqual(acb_log.burned_tax, 0)
        self.assertEqual(acb_log.purchased_bonds, 0)
        self.assertEqual(acb_log.redeemed_bonds, 0)
        vote_log = logging.vote_logs[logging.log_index]
        self.assertEqual(vote_log.commit_succeeded, 0)
        self.assertEqual(vote_log.deposited, 0)
        self.assertEqual(vote_log.commit_failed, 0)
        self.assertEqual(vote_log.reveal_succeeded, 0)
        self.assertEqual(vote_log.reveal_failed, 0)
        self.assertEqual(vote_log.reclaim_succeeded, 0)
        self.assertEqual(vote_log.reward_succeeded, 0)
        self.assertEqual(vote_log.reclaimed, 0)
        self.assertEqual(vote_log.rewarded, 0)

        log_max = 1000
        for i in range(log_max + 10):
            logging.phase_updated(1, 2, 3, 4, 5, 6, 7, 8, 9)
            if i >= 5 and i < log_max - 5:
                continue
            logging.purchased_bonds(1)
            logging.purchased_bonds(2)
            logging.purchased_bonds(3)
            logging.redeemed_bonds(1)
            logging.redeemed_bonds(2)
            logging.redeemed_bonds(3)
            logging.redeemed_bonds(4)
            self.assertEqual(logging.log_index, (i + 1) % log_max)
            acb_log = logging.acb_logs[logging.log_index]
            self.assertEqual(acb_log.minted_coins, 1)
            self.assertEqual(acb_log.burned_coins, 2)
            self.assertEqual(acb_log.coin_supply_delta, 3)
            self.assertEqual(acb_log.bond_budget, 4)
            self.assertEqual(acb_log.coin_total_supply, 5)
            self.assertEqual(acb_log.bond_total_supply, 6)
            self.assertEqual(acb_log.oracle_level, 7)
            self.assertEqual(acb_log.current_phase_start, 8)
            self.assertEqual(acb_log.burned_tax, 9)
            self.assertEqual(acb_log.purchased_bonds, 6)
            self.assertEqual(acb_log.redeemed_bonds, 10)

            logging.voted(False, False, 0, 0, 0)
            vote_log = logging.vote_logs[logging.log_index]
            self.assertEqual(vote_log.commit_succeeded, 0)
            self.assertEqual(vote_log.deposited, 0)
            self.assertEqual(vote_log.commit_failed, 1)
            self.assertEqual(vote_log.reveal_succeeded, 0)
            self.assertEqual(vote_log.reveal_failed, 1)
            self.assertEqual(vote_log.reclaim_succeeded, 0)
            self.assertEqual(vote_log.reward_succeeded, 0)
            self.assertEqual(vote_log.reclaimed, 0)
            self.assertEqual(vote_log.rewarded, 0)

            logging.voted(False, True, 0, 0, 0)
            vote_log = logging.vote_logs[logging.log_index]
            self.assertEqual(vote_log.commit_succeeded, 0)
            self.assertEqual(vote_log.deposited, 0)
            self.assertEqual(vote_log.commit_failed, 2)
            self.assertEqual(vote_log.reveal_succeeded, 1)
            self.assertEqual(vote_log.reveal_failed, 1)
            self.assertEqual(vote_log.reclaim_succeeded, 0)
            self.assertEqual(vote_log.reward_succeeded, 0)
            self.assertEqual(vote_log.reclaimed, 0)
            self.assertEqual(vote_log.rewarded, 0)

            logging.voted(True, True, 10, 0, 0)
            vote_log = logging.vote_logs[logging.log_index]
            self.assertEqual(vote_log.commit_succeeded, 1)
            self.assertEqual(vote_log.deposited, 10)
            self.assertEqual(vote_log.commit_failed, 2)
            self.assertEqual(vote_log.reveal_succeeded, 2)
            self.assertEqual(vote_log.reveal_failed, 1)
            self.assertEqual(vote_log.reclaim_succeeded, 0)
            self.assertEqual(vote_log.reward_succeeded, 0)
            self.assertEqual(vote_log.reclaimed, 0)
            self.assertEqual(vote_log.rewarded, 0)

            logging.voted(True, False, 10, 0, 0)
            vote_log = logging.vote_logs[logging.log_index]
            self.assertEqual(vote_log.commit_succeeded, 2)
            self.assertEqual(vote_log.deposited, 20)
            self.assertEqual(vote_log.commit_failed, 2)
            self.assertEqual(vote_log.reveal_succeeded, 2)
            self.assertEqual(vote_log.reveal_failed, 2)
            self.assertEqual(vote_log.reclaim_succeeded, 0)
            self.assertEqual(vote_log.reward_succeeded, 0)
            self.assertEqual(vote_log.reclaimed, 0)
            self.assertEqual(vote_log.rewarded, 0)

            logging.voted(True, True, 10, 5, 6)
            vote_log = logging.vote_logs[logging.log_index]
            self.assertEqual(vote_log.commit_succeeded, 3)
            self.assertEqual(vote_log.deposited, 30)
            self.assertEqual(vote_log.commit_failed, 2)
            self.assertEqual(vote_log.reveal_succeeded, 3)
            self.assertEqual(vote_log.reveal_failed, 2)
            self.assertEqual(vote_log.reclaim_succeeded, 1)
            self.assertEqual(vote_log.reward_succeeded, 1)
            self.assertEqual(vote_log.reclaimed, 5)
            self.assertEqual(vote_log.rewarded, 6)

            logging.voted(True, True, 10, 5, 6)
            vote_log = logging.vote_logs[logging.log_index]
            self.assertEqual(vote_log.commit_succeeded, 4)
            self.assertEqual(vote_log.deposited, 40)
            self.assertEqual(vote_log.commit_failed, 2)
            self.assertEqual(vote_log.reveal_succeeded, 4)
            self.assertEqual(vote_log.reveal_failed, 2)
            self.assertEqual(vote_log.reclaim_succeeded, 2)
            self.assertEqual(vote_log.reward_succeeded, 2)
            self.assertEqual(vote_log.reclaimed, 10)
            self.assertEqual(vote_log.rewarded, 12)


def main():
    test = LoggingUnitTest()
    test.run()
    test.teardown()

if __name__ == "__main__":
    main()
