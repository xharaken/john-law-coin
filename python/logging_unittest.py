#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

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
        self.assertEqual(acb_log.total_coin_supply, 0)
        self.assertEqual(acb_log.total_bond_supply, 0)
        self.assertEqual(acb_log.oracle_level, 0)
        self.assertEqual(acb_log.current_epoch_start, 0)
        self.assertEqual(acb_log.tax, 0)
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

        for i in range(50):
            logging.epoch_updated(1, 2, 3, 4, 5, 6, 7, 8, 9)
            logging.purchased_bonds(1)
            logging.purchased_bonds(2)
            logging.purchased_bonds(3)
            logging.redeemed_bonds(1)
            logging.redeemed_bonds(2)
            logging.redeemed_bonds(3)
            logging.redeemed_bonds(4)
            self.assertEqual(logging.log_index, i + 1)
            acb_log = logging.acb_logs[logging.log_index]
            self.assertEqual(acb_log.minted_coins, 1)
            self.assertEqual(acb_log.burned_coins, 2)
            self.assertEqual(acb_log.coin_supply_delta, 3)
            self.assertEqual(acb_log.bond_budget, 4)
            self.assertEqual(acb_log.total_coin_supply, 5)
            self.assertEqual(acb_log.total_bond_supply, 6)
            self.assertEqual(acb_log.oracle_level, 7)
            self.assertEqual(acb_log.current_epoch_start, 8)
            self.assertEqual(acb_log.tax, 9)
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
