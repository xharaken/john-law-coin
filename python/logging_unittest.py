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
        for epoch_id in range(30):
            logging.update_epoch(epoch_id, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
            epoch_log = logging.epoch_logs[epoch_id]
            self.assertEqual(epoch_log.minted_coins, 1)
            self.assertEqual(epoch_log.burned_coins, 2)
            self.assertEqual(epoch_log.coin_supply_delta, 3)
            self.assertEqual(epoch_log.bond_budget, 4)
            self.assertEqual(epoch_log.total_coin_supply, 5)
            self.assertEqual(epoch_log.total_bond_supply, 6)
            self.assertEqual(epoch_log.valid_bond_supply, 7)
            self.assertEqual(epoch_log.oracle_level, 8)
            self.assertEqual(epoch_log.current_epoch_start, 9)
            self.assertEqual(epoch_log.tax, 10)

            logging.purchase_bonds(epoch_id, 1)
            logging.purchase_bonds(epoch_id, 2)
            logging.purchase_bonds(epoch_id, 3)
            logging.redeem_bonds(epoch_id, 1, 10)
            logging.redeem_bonds(epoch_id, 2, 20)
            logging.redeem_bonds(epoch_id, 3, 30)
            logging.redeem_bonds(epoch_id, 4, 40)
            logging.vote(epoch_id, False, False, 0, 0, 0)
            bond_log = logging.bond_logs[epoch_id]
            self.assertEqual(bond_log.purchased_bonds, 6)
            self.assertEqual(bond_log.redeemed_bonds, 10)
            self.assertEqual(bond_log.expired_bonds, 100)
            
            vote_log = logging.vote_logs[epoch_id]
            self.assertEqual(vote_log.commit_succeeded, 0)
            self.assertEqual(vote_log.deposited, 0)
            self.assertEqual(vote_log.commit_failed, 1)
            self.assertEqual(vote_log.reveal_succeeded, 0)
            self.assertEqual(vote_log.reveal_failed, 1)
            self.assertEqual(vote_log.reclaim_succeeded, 0)
            self.assertEqual(vote_log.reward_succeeded, 0)
            self.assertEqual(vote_log.reclaimed, 0)
            self.assertEqual(vote_log.rewarded, 0)

            logging.vote(epoch_id, False, True, 0, 0, 0)
            vote_log = logging.vote_logs[epoch_id]
            self.assertEqual(vote_log.commit_succeeded, 0)
            self.assertEqual(vote_log.deposited, 0)
            self.assertEqual(vote_log.commit_failed, 2)
            self.assertEqual(vote_log.reveal_succeeded, 1)
            self.assertEqual(vote_log.reveal_failed, 1)
            self.assertEqual(vote_log.reclaim_succeeded, 0)
            self.assertEqual(vote_log.reward_succeeded, 0)
            self.assertEqual(vote_log.reclaimed, 0)
            self.assertEqual(vote_log.rewarded, 0)

            logging.vote(epoch_id, True, True, 10, 0, 0)
            vote_log = logging.vote_logs[epoch_id]
            self.assertEqual(vote_log.commit_succeeded, 1)
            self.assertEqual(vote_log.deposited, 10)
            self.assertEqual(vote_log.commit_failed, 2)
            self.assertEqual(vote_log.reveal_succeeded, 2)
            self.assertEqual(vote_log.reveal_failed, 1)
            self.assertEqual(vote_log.reclaim_succeeded, 0)
            self.assertEqual(vote_log.reward_succeeded, 0)
            self.assertEqual(vote_log.reclaimed, 0)
            self.assertEqual(vote_log.rewarded, 0)

            logging.vote(epoch_id, True, False, 10, 0, 0)
            vote_log = logging.vote_logs[epoch_id]
            self.assertEqual(vote_log.commit_succeeded, 2)
            self.assertEqual(vote_log.deposited, 20)
            self.assertEqual(vote_log.commit_failed, 2)
            self.assertEqual(vote_log.reveal_succeeded, 2)
            self.assertEqual(vote_log.reveal_failed, 2)
            self.assertEqual(vote_log.reclaim_succeeded, 0)
            self.assertEqual(vote_log.reward_succeeded, 0)
            self.assertEqual(vote_log.reclaimed, 0)
            self.assertEqual(vote_log.rewarded, 0)

            logging.vote(epoch_id, True, True, 10, 5, 6)
            vote_log = logging.vote_logs[epoch_id]
            self.assertEqual(vote_log.commit_succeeded, 3)
            self.assertEqual(vote_log.deposited, 30)
            self.assertEqual(vote_log.commit_failed, 2)
            self.assertEqual(vote_log.reveal_succeeded, 3)
            self.assertEqual(vote_log.reveal_failed, 2)
            self.assertEqual(vote_log.reclaim_succeeded, 1)
            self.assertEqual(vote_log.reward_succeeded, 1)
            self.assertEqual(vote_log.reclaimed, 5)
            self.assertEqual(vote_log.rewarded, 6)

            logging.vote(epoch_id, True, True, 10, 5, 6)
            vote_log = logging.vote_logs[epoch_id]
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
