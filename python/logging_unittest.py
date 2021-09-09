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
            logging.update_epoch(epoch_id, 1, 2, 3, 4, 5, 6, 7)
            epoch_log = logging.epoch_logs[epoch_id]
            self.assertEqual(epoch_log.minted_coins, 1)
            self.assertEqual(epoch_log.burned_coins, 2)
            self.assertEqual(epoch_log.coin_supply_delta, 3)
            self.assertEqual(epoch_log.total_coin_supply, 4)
            self.assertEqual(epoch_log.oracle_level, 5)
            self.assertEqual(epoch_log.current_epoch_start, 6)
            self.assertEqual(epoch_log.tax, 7)

            logging.update_bond_budget(epoch_id, 1, 2, 3)
            bond_operation_log = logging.bond_operation_logs[epoch_id]
            self.assertEqual(bond_operation_log.bond_budget, 1)
            self.assertEqual(bond_operation_log.total_bond_supply, 2)
            self.assertEqual(bond_operation_log.valid_bond_supply, 3)
            self.assertEqual(bond_operation_log.purchased_bonds, 0)
            self.assertEqual(bond_operation_log.redeemed_bonds, 0)
            self.assertEqual(bond_operation_log.expired_bonds, 0)
            
            logging.update_coin_budget(epoch_id, 1, 2, 3)
            open_market_operation_log = logging.open_market_operation_logs[
                epoch_id]
            self.assertEqual(open_market_operation_log.coin_budget, 1)
            self.assertEqual(open_market_operation_log.exchanged_coins, 0)
            self.assertEqual(open_market_operation_log.exchanged_eth, 0)
            self.assertEqual(open_market_operation_log.eth_balance, 2)
            self.assertEqual(open_market_operation_log.latest_price, 3)

            logging.purchase_bonds(epoch_id, 1)
            logging.purchase_bonds(epoch_id, 2)
            logging.purchase_bonds(epoch_id, 3)
            logging.redeem_bonds(epoch_id, 1, 10)
            logging.redeem_bonds(epoch_id, 2, 20)
            logging.redeem_bonds(epoch_id, 3, 30)
            logging.redeem_bonds(epoch_id, 4, 40)
            bond_operation_log = logging.bond_operation_logs[epoch_id]
            self.assertEqual(bond_operation_log.bond_budget, 1)
            self.assertEqual(bond_operation_log.total_bond_supply, 2)
            self.assertEqual(bond_operation_log.valid_bond_supply, 3)
            self.assertEqual(bond_operation_log.purchased_bonds, 6)
            self.assertEqual(bond_operation_log.redeemed_bonds, 10)
            self.assertEqual(bond_operation_log.expired_bonds, 100)

            logging.purchase_coins(epoch_id, 1, 10)
            logging.purchase_coins(epoch_id, 2, 20)
            logging.purchase_coins(epoch_id, 3, 30)
            logging.sell_coins(epoch_id, 100, 1000)
            logging.sell_coins(epoch_id, 200, 2000)
            logging.sell_coins(epoch_id, 300, 3000)
            open_market_operation_log = logging.open_market_operation_logs[
                epoch_id]
            self.assertEqual(open_market_operation_log.coin_budget, 1)
            self.assertEqual(open_market_operation_log.exchanged_coins,
                             -5940)
            self.assertEqual(open_market_operation_log.exchanged_eth,
                             -594)
            self.assertEqual(open_market_operation_log.eth_balance,
                             2)
            self.assertEqual(open_market_operation_log.latest_price,
                             3)
            
            logging.vote(epoch_id, False, False, 0, 0, 0)
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
