#!/usr/bin/env python3
from johnlawcoin import *
import unittest

class OracleUnitTest(unittest.TestCase):
    def __init__(self, level_max, reclaim_threshold, proportional_reward_rate,
                 mint, deposit, mode_level, other_level):
        super().__init__()
        print('level_max=%d reclaim=%d prop=%d mint=%d '
              'deposit=%d mode_level=%d other_level=%d' %
              (level_max, reclaim_threshold, proportional_reward_rate,
               mint, deposit, mode_level, other_level))

        self.mint = mint
        assert(mint >= 0)
        self.deposit = deposit
        assert(deposit >= 0)
        self.mode_level = mode_level
        self.other_level = other_level
        assert(0 <= mode_level and mode_level < level_max)
        assert(0 <= other_level and other_level < level_max)
        assert(mode_level != other_level)

        self.coin = JohnLawCoin()
        self.oracle = Oracle()
        self.oracle.override_constants_for_testing(
            level_max, reclaim_threshold, proportional_reward_rate)

        for i in [0, 1, 2]:
            self.assertTrue(len(self.oracle.epochs[i].votes) >= level_max)
        self.assertEqual(self.oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(self.oracle.epochs[1].phase, Phase.RECLAIM)
        self.assertEqual(self.oracle.epochs[2].phase, Phase.REVEAL)
        self.assertEqual(self.oracle.epoch_timestamp % 3, 0)

    def teardown(self):
        pass

    def run(self):
        _level_max = Oracle.LEVEL_MAX
        _reclaim_threshold = Oracle.RECLAIM_THRESHOLD
        _proportional_reward_rate = Oracle.PROPORTIONAL_REWARD_RATE
        _mint = self.mint
        _deposit = self.deposit
        _mode_level = self.mode_level
        _other_level = self.other_level
        _coin = self.coin
        _oracle = self.oracle

        accounts = ['0x0000', '0x1000', '0x2000', '0x3000', '0x4000',
                    '0x5000', '0x6000', '0x7000']

        # no commit -> no reveal -> no reclaim
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), 0)
        self.assertEqual(_coin.total_supply, coin_supply + _mint)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)
        self.assertEqual(_oracle.epochs[1].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[1].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_oracle.epochs[1].reward_total, 0)
        self.assertEqual(_oracle.epochs[2].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[2].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)
        self.assertEqual(_oracle.epochs[2].reward_total, _mint)

        self.assertEqual(_oracle.reveal(accounts[1], -1, 1111), False)
        self.assertEqual(_oracle.reveal(accounts[1], 0, 1111), False)
        self.assertEqual(_oracle.reveal(accounts[1], 0, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], _level_max, 1111), False)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, _mint)
        self.assertEqual(_oracle.epochs[1].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[1].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_oracle.epochs[1].reward_total, 0)
        self.assertEqual(_oracle.epochs[2].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[2].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)
        self.assertEqual(_oracle.epochs[2].reward_total, 0)

        self.assertEqual(_oracle.reclaim(_coin, accounts[1]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)
        self.assertEqual(_oracle.epochs[1].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[1].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_oracle.epochs[1].reward_total, _mint)
        self.assertEqual(_oracle.epochs[2].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[2].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)
        self.assertEqual(_oracle.epochs[2].reward_total, 0)

        # 1 commit -> 1 reveal -> 1 reclaim
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])

        with self.assertRaises(Exception):
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           -1)

        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit + 1), False)
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), False)
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], 0, 1111),
                           _deposit), False)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 1)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)
        self.assertEqual(_oracle.epochs[1].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[1].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_oracle.epochs[1].reward_total, 0)
        self.assertEqual(_oracle.epochs[2].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[2].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)
        self.assertEqual(_oracle.epochs[2].reward_total, _mint)

        self.assertEqual(_oracle.reveal(accounts[1], -1, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], _level_max, 1111), False)
        self.assertEqual(_oracle.reveal(accounts[2], 0, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), True)
        self.assertEqual(_oracle.reveal(accounts[1], 0, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), False)

        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 1)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 1)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 0)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit)
                self.assertEqual(vote.should_reward, True)
                self.assertEqual(vote.should_reclaim, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit)
        self.assertEqual(_oracle.epochs[0].reward_total, _mint)
        self.assertEqual(_oracle.epochs[1].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[1].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_oracle.epochs[1].reward_total, 0)
        self.assertEqual(_oracle.epochs[2].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[2].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)
        self.assertEqual(_oracle.epochs[2].reward_total, 0)

        reclaim_amount = _deposit + self._reward(_mint, 1)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[1]),
                         balance + reclaim_amount)
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[2]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint),
                         _mint - self._reward(_mint, 1) * 1)
        self.assertEqual(_coin.total_supply,
                         coin_supply + self._reward(_mint, 1) * 1)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 1)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)
        self.assertEqual(_oracle.epochs[1].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[1].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_oracle.epochs[1].reward_total, _mint)
        self.assertEqual(_oracle.epochs[2].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[2].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)
        self.assertEqual(_oracle.epochs[2].reward_total, 0)

        # 1 commit -> 1 reveal -> 1 reclaim
        #             1 commit -> 1 reveal -> 1 reclaim
        #                         1 commit -> 1 reveal -> 1 reclaim
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 1)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)
        self.assertEqual(_oracle.epochs[1].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[1].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_oracle.epochs[1].reward_total, 0)
        self.assertEqual(_oracle.epochs[2].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[2].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)
        self.assertEqual(_oracle.epochs[2].reward_total, _mint)

        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), True)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)


        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 1)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 1)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 0)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit)
        self.assertEqual(_oracle.epochs[0].reward_total, _mint)
        self.assertEqual(_oracle.epochs[1].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[1].commits), 1)
        self.assertEqual(_oracle.epochs[1].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[1].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[1].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account),
                         _deposit)
        self.assertEqual(_oracle.epochs[1].reward_total, 0)
        self.assertEqual(_oracle.epochs[2].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[2].commits), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)
        self.assertEqual(_oracle.epochs[2].reward_total, 0)

        reclaim_amount = _deposit + self._reward(_mint, 1)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[1]),
                         balance + reclaim_amount)

        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), True)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)


        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint),
                         _mint - self._reward(_mint, 1) * 1)
        self.assertEqual(_coin.total_supply,
                         coin_supply + self._reward(_mint, 1) * 1)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 1)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)
        self.assertEqual(_oracle.epochs[1].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[1].commits), 1)
        self.assertEqual(_oracle.epochs[1].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[1].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[1].commits[accounts[1]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[1].votes[_mode_level].count, 1)
        self.assertEqual(_oracle.epochs[1].votes[_other_level].count, 0)
        for level in range(_level_max):
            vote = _oracle.epochs[1].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account),
                         _deposit)
        self.assertEqual(_oracle.epochs[1].reward_total, _mint)
        self.assertEqual(_oracle.epochs[2].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[2].commits), 1)
        self.assertEqual(_oracle.epochs[2].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[2].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[2].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account),
                         _deposit)
        self.assertEqual(_oracle.epochs[2].reward_total, 0)

        reclaim_amount = _deposit + self._reward(_mint, 1)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[1]),
                         balance + reclaim_amount)

        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), True)

        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint),
                         _mint - self._reward(_mint, 1) * 1)
        self.assertEqual(_coin.total_supply,
                         coin_supply + self._reward(_mint, 1) * 1)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 1)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)
        self.assertEqual(_oracle.epochs[1].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[1].commits), 1)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_oracle.epochs[1].reward_total, 0)
        self.assertEqual(_oracle.epochs[2].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[2].commits), 1)
        self.assertEqual(_oracle.epochs[2].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[2].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[2].commits[accounts[1]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[2].votes[_mode_level].count, 1)
        self.assertEqual(_oracle.epochs[2].votes[_other_level].count, 0)
        for level in range(_level_max):
            vote = _oracle.epochs[2].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account),
                         _deposit)
        self.assertEqual(_oracle.epochs[2].reward_total, _mint)

        reclaim_amount = _deposit + self._reward(_mint, 1)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[1]),
                         balance + reclaim_amount)

        self.assertEqual(_oracle.get_mode_level(), _level_max)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint),
                         _mint - self._reward(_mint, 1) * 1)
        self.assertEqual(_coin.total_supply,
                         coin_supply + self._reward(_mint, 1) * 1)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 1)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, _mint)
        self.assertEqual(_oracle.epochs[1].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[1].commits), 1)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_oracle.epochs[1].reward_total, 0)
        self.assertEqual(_oracle.epochs[2].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[2].commits), 1)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)
        self.assertEqual(_oracle.epochs[2].reward_total, 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)

        # 6 commits on the mode ->
        # 6 reveals on the mode ->
        # full reclaim
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)

        _coin.mint(accounts[2], _deposit)
        balance = _coin.balance_of(accounts[2])
        self.assertEqual(
            _oracle.commit(_coin, accounts[2],
                           Oracle.hash(accounts[2], _mode_level, 2222),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[2]), balance - _deposit)

        _coin.mint(accounts[3], _deposit)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(
            _oracle.commit(_coin, accounts[3],
                           Oracle.hash(accounts[3], _mode_level, 3333),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[3]), balance - _deposit)

        _coin.mint(accounts[4], _deposit)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(
            _oracle.commit(_coin, accounts[4],
                           Oracle.hash(accounts[4], _mode_level, 4444),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[4]), balance - _deposit)

        _coin.mint(accounts[5], _deposit)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(
            _oracle.commit(_coin, accounts[5],
                           Oracle.hash(accounts[5], _mode_level, 5555),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[5]), balance - _deposit)

        _coin.mint(accounts[6], _deposit)
        balance = _coin.balance_of(accounts[6])
        self.assertEqual(
            _oracle.commit(_coin, accounts[6],
                           Oracle.hash(accounts[6], _mode_level, 6666),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[6]), balance - _deposit)


        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].committed_hash,
                         Oracle.hash(accounts[2], _mode_level, 2222))
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].committed_hash,
                         Oracle.hash(accounts[3], _mode_level, 3333))
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].committed_hash,
                         Oracle.hash(accounts[4], _mode_level, 4444))
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].committed_hash,
                         Oracle.hash(accounts[5], _mode_level, 5555))
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].committed_hash,
                         Oracle.hash(accounts[6], _mode_level, 6666))
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level + 100, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), True)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[2], _mode_level, 2222), True)
        self.assertEqual(_oracle.reveal(
            accounts[3], _mode_level, 3333), True)
        self.assertEqual(_oracle.reveal(
            accounts[4], _mode_level, 4444), True)
        self.assertEqual(_oracle.reveal(
            accounts[5], _mode_level, 5555), True)
        self.assertEqual(_oracle.reveal(
            accounts[6], _mode_level, 6666), True)
        self.assertEqual(_oracle.reveal(
            accounts[7], _mode_level, 7777), False)

        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 6)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 0)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit * 6)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, _mint)

        reclaim_amount = _deposit + self._reward(_mint, 6)
        balance = _coin.balance_of(accounts[6])
        self.assertEqual(_oracle.reclaim(_coin, accounts[6]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[6]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(_oracle.reclaim(_coin, accounts[5]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[5]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(_oracle.reclaim(_coin, accounts[4]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[4]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(_oracle.reclaim(_coin, accounts[3]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[3]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[2])
        self.assertEqual(_oracle.reclaim(_coin, accounts[2]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[2]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[1]),
                         balance + reclaim_amount)
        self.assertEqual(_oracle.reclaim(_coin, accounts[6]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[7]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint),
                         _mint - self._reward(_mint, 6) * 6)
        self.assertEqual(_coin.total_supply,
                         coin_supply + self._reward(_mint, 6) * 6)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        # 6 commits on the mode ->
        # 6 reveals on the mode ->
        # no reclaim
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)

        _coin.mint(accounts[2], _deposit)
        balance = _coin.balance_of(accounts[2])
        self.assertEqual(
            _oracle.commit(_coin, accounts[2],
                           Oracle.hash(accounts[2], _mode_level, 2222),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[2]), balance - _deposit)

        _coin.mint(accounts[3], _deposit)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(
            _oracle.commit(_coin, accounts[3],
                           Oracle.hash(accounts[3], _mode_level, 3333),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[3]), balance - _deposit)

        _coin.mint(accounts[4], _deposit)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(
            _oracle.commit(_coin, accounts[4],
                           Oracle.hash(accounts[4], _mode_level, 4444),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[4]), balance - _deposit)

        _coin.mint(accounts[5], _deposit)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(
            _oracle.commit(_coin, accounts[5],
                           Oracle.hash(accounts[5], _mode_level, 5555),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[5]), balance - _deposit)

        _coin.mint(accounts[6], _deposit)
        balance = _coin.balance_of(accounts[6])
        self.assertEqual(
            _oracle.commit(_coin, accounts[6],
                           Oracle.hash(accounts[6], _mode_level, 6666),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[6]), balance - _deposit)


        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].committed_hash,
                         Oracle.hash(accounts[2], _mode_level, 2222))
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].committed_hash,
                         Oracle.hash(accounts[3], _mode_level, 3333))
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].committed_hash,
                         Oracle.hash(accounts[4], _mode_level, 4444))
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].committed_hash,
                         Oracle.hash(accounts[5], _mode_level, 5555))
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].committed_hash,
                         Oracle.hash(accounts[6], _mode_level, 6666))
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level + 100, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), True)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[2], _mode_level, 2222), True)
        self.assertEqual(_oracle.reveal(
            accounts[3], _mode_level, 3333), True)
        self.assertEqual(_oracle.reveal(
            accounts[4], _mode_level, 4444), True)
        self.assertEqual(_oracle.reveal(
            accounts[5], _mode_level, 5555), True)
        self.assertEqual(_oracle.reveal(
            accounts[6], _mode_level, 6666), True)
        self.assertEqual(_oracle.reveal(
            accounts[7], _mode_level, 7777), False)

        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 6)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 0)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit * 6)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                         _mint)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, _mint)

        self.assertEqual(_oracle.reclaim(_coin, accounts[7]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint),
                         _mint + _deposit * 6)
        self.assertEqual(_coin.total_supply,
                         coin_supply - _deposit * 6)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        # 4 commits on the mode + 2 commits on the other level ->
        # 4 reveals on the mode + 2 reveals on the other level ->
        # full reclaim
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)

        _coin.mint(accounts[2], _deposit)
        balance = _coin.balance_of(accounts[2])
        self.assertEqual(
            _oracle.commit(_coin, accounts[2],
                           Oracle.hash(accounts[2], _other_level, 2222),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[2]), balance - _deposit)

        _coin.mint(accounts[3], _deposit)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(
            _oracle.commit(_coin, accounts[3],
                           Oracle.hash(accounts[3], _mode_level, 3333),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[3]), balance - _deposit)

        _coin.mint(accounts[4], _deposit)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(
            _oracle.commit(_coin, accounts[4],
                           Oracle.hash(accounts[4], _mode_level, 4444),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[4]), balance - _deposit)

        _coin.mint(accounts[5], _deposit)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(
            _oracle.commit(_coin, accounts[5],
                           Oracle.hash(accounts[5], _mode_level, 5555),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[5]), balance - _deposit)

        _coin.mint(accounts[6], _deposit)
        balance = _coin.balance_of(accounts[6])
        self.assertEqual(
            _oracle.commit(_coin, accounts[6],
                           Oracle.hash(accounts[6], _other_level, 6666),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[6]), balance - _deposit)


        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].committed_hash,
                         Oracle.hash(accounts[2], _other_level, 2222))
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].committed_hash,
                         Oracle.hash(accounts[3], _mode_level, 3333))
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].committed_hash,
                         Oracle.hash(accounts[4], _mode_level, 4444))
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].committed_hash,
                         Oracle.hash(accounts[5], _mode_level, 5555))
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].committed_hash,
                         Oracle.hash(accounts[6], _other_level, 6666))
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level + 100, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), True)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[2], _other_level, 2222), True)
        self.assertEqual(_oracle.reveal(
            accounts[3], _mode_level, 3333), True)
        self.assertEqual(_oracle.reveal(
            accounts[4], _mode_level, 4444), True)
        self.assertEqual(_oracle.reveal(
            accounts[5], _mode_level, 5555), True)
        self.assertEqual(_oracle.reveal(
            accounts[6], _other_level, 6666), True)
        self.assertEqual(_oracle.reveal(
            accounts[7], _mode_level, 7777), False)

        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _other_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _other_level)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 4)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 2)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit * 4)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if self._is_in_reclaim_threshold(_other_level):
            reward_total = _mint
            deposit_total = _deposit * 6
        else:
            reward_total = _mint + _deposit * 2
            deposit_total = _deposit * 4
            self.assertEqual(
                _coin.balance_of(_oracle.epochs[0].reward_account),
                reward_total)
            self.assertEqual(
                _coin.balance_of(_oracle.epochs[0].deposit_account),
                deposit_total)

        if self._is_in_reclaim_threshold(_other_level):
            balance = _coin.balance_of(accounts[2])
            self.assertEqual(_oracle.reclaim(_coin, accounts[2]),
                             _deposit)
            self.assertEqual(_coin.balance_of(accounts[2]),
                             balance + _deposit)
            balance = _coin.balance_of(accounts[6])
            self.assertEqual(_oracle.reclaim(_coin, accounts[6]),
                             _deposit)
            self.assertEqual(_coin.balance_of(accounts[6]),
                             balance + _deposit)
        else:
            self.assertEqual(_oracle.reclaim(_coin, accounts[2]), 0)
            self.assertEqual(_oracle.reclaim(_coin, accounts[6]), 0)

        reclaim_amount = _deposit + self._reward(reward_total, 4)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(_oracle.reclaim(_coin, accounts[5]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[5]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(_oracle.reclaim(_coin, accounts[4]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[4]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(_oracle.reclaim(_coin, accounts[3]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[3]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[1]),
                         balance + reclaim_amount)
        self.assertEqual(_oracle.reclaim(_coin, accounts[6]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[7]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint),
                         reward_total - self._reward(reward_total, 4) * 4)
        self.assertEqual(_coin.total_supply,
                         coin_supply + _mint - reward_total +
                         self._reward(reward_total, 4) * 4)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        # 4 commits on the mode + 2 commits on the other level ->
        # 4 reveals on the mode + 2 reveals on the other level ->
        # no reclaim
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)

        _coin.mint(accounts[2], _deposit)
        balance = _coin.balance_of(accounts[2])
        self.assertEqual(
            _oracle.commit(_coin, accounts[2],
                           Oracle.hash(accounts[2], _other_level, 2222),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[2]), balance - _deposit)

        _coin.mint(accounts[3], _deposit)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(
            _oracle.commit(_coin, accounts[3],
                           Oracle.hash(accounts[3], _mode_level, 3333),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[3]), balance - _deposit)

        _coin.mint(accounts[4], _deposit)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(
            _oracle.commit(_coin, accounts[4],
                           Oracle.hash(accounts[4], _mode_level, 4444),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[4]), balance - _deposit)

        _coin.mint(accounts[5], _deposit)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(
            _oracle.commit(_coin, accounts[5],
                           Oracle.hash(accounts[5], _mode_level, 5555),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[5]), balance - _deposit)

        _coin.mint(accounts[6], _deposit)
        balance = _coin.balance_of(accounts[6])
        self.assertEqual(
            _oracle.commit(_coin, accounts[6],
                           Oracle.hash(accounts[6], _other_level, 6666),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[6]), balance - _deposit)


        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].committed_hash,
                         Oracle.hash(accounts[2], _other_level, 2222))
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].committed_hash,
                         Oracle.hash(accounts[3], _mode_level, 3333))
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].committed_hash,
                         Oracle.hash(accounts[4], _mode_level, 4444))
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].committed_hash,
                         Oracle.hash(accounts[5], _mode_level, 5555))
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].committed_hash,
                         Oracle.hash(accounts[6], _other_level, 6666))
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level + 100, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), True)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[2], _other_level, 2222), True)
        self.assertEqual(_oracle.reveal(
            accounts[3], _mode_level, 3333), True)
        self.assertEqual(_oracle.reveal(
            accounts[4], _mode_level, 4444), True)
        self.assertEqual(_oracle.reveal(
            accounts[5], _mode_level, 5555), True)
        self.assertEqual(_oracle.reveal(
            accounts[6], _other_level, 6666), True)
        self.assertEqual(_oracle.reveal(
            accounts[7], _mode_level, 7777), False)

        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _other_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _other_level)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 4)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 2)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit * 4)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if self._is_in_reclaim_threshold(_other_level):
            reward_total = _mint
            deposit_total = _deposit * 6
        else:
            reward_total = _mint + _deposit * 2
            deposit_total = _deposit * 4
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                             reward_total)
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                             deposit_total)

        self.assertEqual(_oracle.reclaim(_coin, accounts[7]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint + _deposit * 6)
        self.assertEqual(_coin.total_supply,
                         coin_supply - _deposit * 6)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        # 3 commits on the two modes ->
        # 3 reveals on the two modes ->
        # full reclaim
        real_mode_level = min(_mode_level, _other_level)
        real_other_level = max(_mode_level, _other_level)
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], real_mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)

        _coin.mint(accounts[2], _deposit)
        balance = _coin.balance_of(accounts[2])
        self.assertEqual(
            _oracle.commit(_coin, accounts[2],
                           Oracle.hash(accounts[2], real_other_level, 2222),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[2]), balance - _deposit)

        _coin.mint(accounts[3], _deposit)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(
            _oracle.commit(_coin, accounts[3],
                           Oracle.hash(accounts[3], real_mode_level, 3333),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[3]), balance - _deposit)

        _coin.mint(accounts[4], _deposit)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(
            _oracle.commit(_coin, accounts[4],
                           Oracle.hash(accounts[4], real_other_level, 4444),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[4]), balance - _deposit)

        _coin.mint(accounts[5], _deposit)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(
            _oracle.commit(_coin, accounts[5],
                           Oracle.hash(accounts[5], real_mode_level, 5555),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[5]), balance - _deposit)

        _coin.mint(accounts[6], _deposit)
        balance = _coin.balance_of(accounts[6])
        self.assertEqual(
            _oracle.commit(_coin, accounts[6],
                           Oracle.hash(accounts[6], real_other_level, 6666),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[6]), balance - _deposit)


        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], real_mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].committed_hash,
                         Oracle.hash(accounts[2], real_other_level, 2222))
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].committed_hash,
                         Oracle.hash(accounts[3], real_mode_level, 3333))
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].committed_hash,
                         Oracle.hash(accounts[4], real_other_level, 4444))
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].committed_hash,
                         Oracle.hash(accounts[5], real_mode_level, 5555))
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].committed_hash,
                         Oracle.hash(accounts[6], real_other_level, 6666))
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        self.assertEqual(_oracle.reveal(
            accounts[1], real_mode_level + 100, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], real_mode_level, 1111), True)
        self.assertEqual(_oracle.reveal(
            accounts[1], real_mode_level, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[2], real_other_level, 2222), True)
        self.assertEqual(_oracle.reveal(
            accounts[3], real_mode_level, 3333), True)
        self.assertEqual(_oracle.reveal(
            accounts[4], real_other_level, 4444), True)
        self.assertEqual(_oracle.reveal(
            accounts[5], real_mode_level, 5555), True)
        self.assertEqual(_oracle.reveal(
            accounts[6], real_other_level, 6666), True)
        self.assertEqual(_oracle.reveal(
            accounts[7], real_mode_level, 7777), False)

        self.assertEqual(_oracle.get_mode_level(), real_mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         real_mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         real_other_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         real_mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         real_other_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         real_mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         real_other_level)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 3)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 3)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == real_mode_level:
                self.assertEqual(vote.deposit, _deposit * 3)
                self.assertEqual(vote.should_reward, True)
            elif (real_mode_level - _reclaim_threshold <= level and
                  level <= real_mode_level + _reclaim_threshold):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if (real_mode_level - _reclaim_threshold <= real_other_level and
            real_other_level <= real_mode_level + _reclaim_threshold):
            reward_total = _mint
            deposit_total = _deposit * 6
        else:
            reward_total = _mint + _deposit * 3
            deposit_total = _deposit * 3
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                             reward_total)
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                             deposit_total)

        if (real_mode_level - _reclaim_threshold <= real_other_level and
            real_other_level <= real_mode_level + _reclaim_threshold):
            balance = _coin.balance_of(accounts[2])
            self.assertEqual(_oracle.reclaim(_coin, accounts[2]),
                             _deposit)
            self.assertEqual(_coin.balance_of(accounts[2]),
                             balance + _deposit)
            balance = _coin.balance_of(accounts[4])
            self.assertEqual(_oracle.reclaim(_coin, accounts[4]),
                             _deposit)
            self.assertEqual(_coin.balance_of(accounts[4]),
                             balance + _deposit)
            balance = _coin.balance_of(accounts[6])
            self.assertEqual(_oracle.reclaim(_coin, accounts[6]),
                             _deposit)
            self.assertEqual(_coin.balance_of(accounts[6]),
                             balance + _deposit)
        else:
            self.assertEqual(_oracle.reclaim(_coin, accounts[2]), 0)
            self.assertEqual(_oracle.reclaim(_coin, accounts[4]), 0)
            self.assertEqual(_oracle.reclaim(_coin, accounts[6]), 0)

        reclaim_amount = _deposit + self._reward(reward_total, 3)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(_oracle.reclaim(_coin, accounts[5]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[5]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(_oracle.reclaim(_coin, accounts[3]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[3]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[1]),
                         balance + reclaim_amount)
        self.assertEqual(_oracle.reclaim(_coin, accounts[6]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[7]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint),
                         reward_total - self._reward(reward_total, 3) * 3)
        self.assertEqual(_coin.total_supply, coin_supply + _mint -
                         reward_total + self._reward(reward_total, 3) * 3)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        # 3 commits on the two modes ->
        # 3 reveals on the two modes ->
        # no reclaim
        real_mode_level = min(_mode_level, _other_level)
        real_other_level = max(_mode_level, _other_level)
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], real_mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)

        _coin.mint(accounts[2], _deposit)
        balance = _coin.balance_of(accounts[2])
        self.assertEqual(
            _oracle.commit(_coin, accounts[2],
                           Oracle.hash(accounts[2], real_other_level, 2222),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[2]), balance - _deposit)

        _coin.mint(accounts[3], _deposit)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(
            _oracle.commit(_coin, accounts[3],
                           Oracle.hash(accounts[3], real_mode_level, 3333),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[3]), balance - _deposit)

        _coin.mint(accounts[4], _deposit)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(
            _oracle.commit(_coin, accounts[4],
                           Oracle.hash(accounts[4], real_other_level, 4444),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[4]), balance - _deposit)

        _coin.mint(accounts[5], _deposit)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(
            _oracle.commit(_coin, accounts[5],
                           Oracle.hash(accounts[5], real_mode_level, 5555),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[5]), balance - _deposit)

        _coin.mint(accounts[6], _deposit)
        balance = _coin.balance_of(accounts[6])
        self.assertEqual(
            _oracle.commit(_coin, accounts[6],
                           Oracle.hash(accounts[6], real_other_level, 6666),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[6]), balance - _deposit)


        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], real_mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].committed_hash,
                         Oracle.hash(accounts[2], real_other_level, 2222))
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].committed_hash,
                         Oracle.hash(accounts[3], real_mode_level, 3333))
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].committed_hash,
                         Oracle.hash(accounts[4], real_other_level, 4444))
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].committed_hash,
                         Oracle.hash(accounts[5], real_mode_level, 5555))
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].committed_hash,
                         Oracle.hash(accounts[6], real_other_level, 6666))
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        self.assertEqual(_oracle.reveal(
            accounts[1], real_mode_level + 100, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], real_mode_level, 1111), True)
        self.assertEqual(_oracle.reveal(
            accounts[1], real_mode_level, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[2], real_other_level, 2222), True)
        self.assertEqual(_oracle.reveal(
            accounts[3], real_mode_level, 3333), True)
        self.assertEqual(_oracle.reveal(
            accounts[4], real_other_level, 4444), True)
        self.assertEqual(_oracle.reveal(
            accounts[5], real_mode_level, 5555), True)
        self.assertEqual(_oracle.reveal(
            accounts[6], real_other_level, 6666), True)
        self.assertEqual(_oracle.reveal(
            accounts[7], real_mode_level, 7777), False)

        self.assertEqual(_oracle.get_mode_level(),
                         min(real_mode_level, real_other_level))

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         real_mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         real_other_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         real_mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         real_other_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         real_mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         real_other_level)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 3)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 3)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == real_mode_level:
                self.assertEqual(vote.deposit, _deposit * 3)
                self.assertEqual(vote.should_reward, True)
            elif (real_mode_level - _reclaim_threshold <= level and
                  level <= real_mode_level + _reclaim_threshold):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if (real_mode_level - _reclaim_threshold <= real_other_level and
            real_other_level <= real_mode_level + _reclaim_threshold):
            reward_total = _mint
            deposit_total = _deposit * 6
        else:
            reward_total = _mint + _deposit * 3
            deposit_total = _deposit * 3
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                             reward_total)
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                             deposit_total)

        self.assertEqual(_oracle.reclaim(_coin, accounts[7]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint + _deposit * 6)
        self.assertEqual(_coin.total_supply,
                         coin_supply - _deposit * 6)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        # 4 commits on the mode + 2 commits on the other level ->
        # 2 reveals on the mode + 1 reveals on the other level ->
        # full reclaim
        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)

        _coin.mint(accounts[2], _deposit)
        balance = _coin.balance_of(accounts[2])
        self.assertEqual(
            _oracle.commit(_coin, accounts[2],
                           Oracle.hash(accounts[2], _other_level, 2222),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[2]), balance - _deposit)

        _coin.mint(accounts[3], _deposit)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(
            _oracle.commit(_coin, accounts[3],
                           Oracle.hash(accounts[3], _mode_level, 3333),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[3]), balance - _deposit)

        _coin.mint(accounts[4], _deposit)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(
            _oracle.commit(_coin, accounts[4],
                           Oracle.hash(accounts[4], _mode_level, 4444),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[4]), balance - _deposit)

        _coin.mint(accounts[5], _deposit)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(
            _oracle.commit(_coin, accounts[5],
                           Oracle.hash(accounts[5], _mode_level, 5555),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[5]), balance - _deposit)

        _coin.mint(accounts[6], _deposit)
        balance = _coin.balance_of(accounts[6])
        self.assertEqual(
            _oracle.commit(_coin, accounts[6],
                           Oracle.hash(accounts[6], _other_level, 6666),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[6]), balance - _deposit)


        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].committed_hash,
                         Oracle.hash(accounts[2], _other_level, 2222))
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].committed_hash,
                         Oracle.hash(accounts[3], _mode_level, 3333))
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].committed_hash,
                         Oracle.hash(accounts[4], _mode_level, 4444))
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].committed_hash,
                         Oracle.hash(accounts[5], _mode_level, 5555))
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].committed_hash,
                         Oracle.hash(accounts[6], _other_level, 6666))
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level + 100, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), True)
        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level, 1111), False)
        self.assertEqual(_oracle.reveal(
            accounts[2], _other_level, 2222), True)
        self.assertEqual(_oracle.reveal(
            accounts[3], _mode_level, 3333), True)
        # Incorrect reveal_level
        self.assertEqual(_oracle.reveal(
            accounts[4], _other_level, 4444), False)
        self.assertEqual(_oracle.reveal(
            accounts[4], _mode_level, 4444), False)
        # Incorrect salt
        self.assertEqual(_oracle.reveal(
            accounts[5], _mode_level, 6666), False)
        self.assertEqual(_oracle.reveal(
            accounts[5], _mode_level, 5555), False)
        self.assertEqual(_oracle.reveal(
            accounts[7], _mode_level, 7777), False)

        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _other_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 2)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 1)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit * 2)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if self._is_in_reclaim_threshold(_other_level):
            reward_total = _mint + _deposit * 3
            deposit_total = _deposit * 3
        else:
            reward_total = _mint + _deposit * 4
            deposit_total = _deposit * 2
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                             reward_total)
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                             deposit_total)

        if self._is_in_reclaim_threshold(_other_level):
            balance = _coin.balance_of(accounts[2])
            self.assertEqual(_oracle.reclaim(_coin, accounts[2]),
                             _deposit)
            self.assertEqual(_coin.balance_of(accounts[2]),
                             balance + _deposit)
            self.assertEqual(_oracle.reclaim(_coin, accounts[6]), 0)
        else:
            self.assertEqual(_oracle.reclaim(_coin, accounts[2]), 0)
            self.assertEqual(_oracle.reclaim(_coin, accounts[6]), 0)

        reclaim_amount = _deposit + self._reward(reward_total, 2)
        self.assertEqual(_oracle.reclaim(_coin, accounts[5]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[4]), 0)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(_oracle.reclaim(_coin, accounts[3]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[3]),
                         balance + reclaim_amount)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(_oracle.reclaim(_coin, accounts[1]),
                         reclaim_amount)
        self.assertEqual(_coin.balance_of(accounts[1]),
                         balance + reclaim_amount)
        self.assertEqual(_oracle.reclaim(_coin, accounts[6]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[7]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint),
                         reward_total - self._reward(reward_total, 2) * 2)
        self.assertEqual(_coin.total_supply, coin_supply + _mint -
                         reward_total + self._reward(reward_total, 2) * 2)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        # 4 commits on the mode + 2 commits on the other level ->
        # 2 reveals on the mode + 1 reveals on the other level ->
        # no reclaim

        self.assertEqual(_oracle.get_mode_level(), _level_max)

        _coin.mint(accounts[1], _deposit)
        balance = _coin.balance_of(accounts[1])
        self.assertEqual(
            _oracle.commit(_coin, accounts[1],
                           Oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[1]), balance - _deposit)

        _coin.mint(accounts[2], _deposit)
        balance = _coin.balance_of(accounts[2])
        self.assertEqual(
            _oracle.commit(_coin, accounts[2],
                           Oracle.hash(accounts[2], _other_level, 2222),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[2]), balance - _deposit)

        _coin.mint(accounts[3], _deposit)
        balance = _coin.balance_of(accounts[3])
        self.assertEqual(
            _oracle.commit(_coin, accounts[3],
                           Oracle.hash(accounts[3], _mode_level, 3333),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[3]), balance - _deposit)

        _coin.mint(accounts[4], _deposit)
        balance = _coin.balance_of(accounts[4])
        self.assertEqual(
            _oracle.commit(_coin, accounts[4],
                           Oracle.hash(accounts[4], _mode_level, 4444),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[4]), balance - _deposit)

        _coin.mint(accounts[5], _deposit)
        balance = _coin.balance_of(accounts[5])
        self.assertEqual(
            _oracle.commit(_coin, accounts[5],
                           Oracle.hash(accounts[5], _mode_level, 5555),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[5]), balance - _deposit)

        _coin.mint(accounts[6], _deposit)
        balance = _coin.balance_of(accounts[6])
        self.assertEqual(
            _oracle.commit(_coin, accounts[6],
                           Oracle.hash(accounts[6], _other_level, 6666),
                           _deposit), True)
        self.assertEqual(_coin.balance_of(accounts[6]), balance - _deposit)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 1)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.REVEAL)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].committed_hash,
                         Oracle.hash(accounts[1], _mode_level, 1111))
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].committed_hash,
                         Oracle.hash(accounts[2], _other_level, 2222))
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].committed_hash,
                         Oracle.hash(accounts[3], _mode_level, 3333))
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].committed_hash,
                         Oracle.hash(accounts[4], _mode_level, 4444))
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].committed_hash,
                         Oracle.hash(accounts[5], _mode_level, 5555))
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].committed_hash,
                         Oracle.hash(accounts[6], _other_level, 6666))
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].deposit,
                         _deposit)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _level_max)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                         _deposit * 6)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        self.assertEqual(_oracle.reveal(
            accounts[1], _mode_level + 100, 1111), False)
        # Incorrect revealed level
        self.assertEqual(_oracle.reveal(
            accounts[2], _mode_level, 2222), False)
        # Incorrect salt
        self.assertEqual(_oracle.reveal(
            accounts[3], _mode_level, 4444), False)
        self.assertEqual(_oracle.reveal(
            accounts[4], _mode_level, 4444), True)
        self.assertEqual(_oracle.reveal(
            accounts[5], _mode_level, 5555), True)
        self.assertEqual(_oracle.reveal(
            accounts[6], _other_level, 6666), True)
        self.assertEqual(_oracle.reveal(
            accounts[7], _mode_level, 7777), False)

        self.assertEqual(_oracle.get_mode_level(), _mode_level)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint)
        self.assertEqual(_coin.total_supply, coin_supply)
        self.assertEqual(_oracle.epoch_timestamp % 3, 2)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.RECLAIM)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_oracle.epochs[0].commits[accounts[1]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[2]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[3]].revealed_level,
                         _level_max)
        self.assertEqual(_oracle.epochs[0].commits[accounts[4]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[5]].revealed_level,
                         _mode_level)
        self.assertEqual(_oracle.epochs[0].commits[accounts[6]].revealed_level,
                         _other_level)
        self.assertEqual(_oracle.epochs[0].votes[_mode_level].count, 2)
        self.assertEqual(_oracle.epochs[0].votes[_other_level].count, 1)
        for level in range(_level_max):
            vote = _oracle.epochs[0].votes[level]
            if level == _mode_level:
                self.assertEqual(vote.deposit, _deposit * 2)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if self._is_in_reclaim_threshold(_other_level):
            reward_total = _mint + _deposit * 3
            deposit_total = _deposit * 3
        else:
            reward_total = _mint + _deposit * 4
            deposit_total = _deposit * 2
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account),
                             reward_total)
            self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account),
                             deposit_total)

        self.assertEqual(_oracle.reclaim(_coin, accounts[1]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[2]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[3]), 0)
        self.assertEqual(_oracle.reclaim(_coin, accounts[7]), 0)

        coin_supply = _coin.total_supply
        self.assertEqual(_oracle.advance(_coin, _mint), _mint + _deposit * 6)
        self.assertEqual(_coin.total_supply,
                         coin_supply - _deposit * 6)
        self.assertEqual(_oracle.epoch_timestamp % 3, 0)
        self.assertEqual(_oracle.get_mode_level(), _level_max)
        self.assertEqual(_oracle.epochs[0].phase, Phase.COMMIT)
        self.assertEqual(len(_oracle.epochs[0].commits), 6)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_oracle.epochs[0].reward_total, 0)

        self.assertEqual(_oracle.advance(_coin, 0), _mint)
        self.assertEqual(_oracle.advance(_coin, 0), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[0].deposit_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[1].deposit_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].reward_account), 0)
        self.assertEqual(_coin.balance_of(_oracle.epochs[2].deposit_account), 0)

        balance_total = (self.coin.balance_of(accounts[1]) +
                         self.coin.balance_of(accounts[2]) +
                         self.coin.balance_of(accounts[3]) +
                         self.coin.balance_of(accounts[4]) +
                         self.coin.balance_of(accounts[5]) +
                         self.coin.balance_of(accounts[6]))
        self.assertEqual(self.coin.total_supply, balance_total)

        # hash function
        self.assertNotEqual(Oracle.hash(accounts[1], 10, 1111), "")
        self.assertNotEqual(Oracle.hash(1, 11, 111),
                            Oracle.hash(11, 1, 111))
        self.assertNotEqual(Oracle.hash(1, 11, 111),
                            Oracle.hash(1, 111, 11))

    def _is_in_reclaim_threshold(self, level):
        return (self.mode_level - Oracle.RECLAIM_THRESHOLD <= level and
                level <= self.mode_level + Oracle.RECLAIM_THRESHOLD)

    def _reward(self, reward_total, count):
        proportional_reward = 0
        if self.deposit > 0:
            proportional_reward = int(
                (Oracle.PROPORTIONAL_REWARD_RATE * reward_total) /
                (100 * count))
        constant_reward = int(
            ((100 - Oracle.PROPORTIONAL_REWARD_RATE) * reward_total) /
            (100 * count))
        return proportional_reward + constant_reward


def main():
    level_max = 5
    reclaim_threshold = 1
    proportional_reward_rate = 80
    mint = 100
    deposit = 20
    mode_level = 2
    other_level = 0
    test = OracleUnitTest(level_max,
                          reclaim_threshold,
                          proportional_reward_rate,
                          mint,
                          deposit,
                          mode_level,
                          other_level)
    test.run()
    test.teardown()


    for level_max in [2, 3, 4, 5, 7]:
        for reclaim_threshold in range(0, level_max):
            for proportional_reward_rate in [0, 1, 20, 80, 99, 100]:
                for mint in [0, 17, 50]:
                    for deposit in [0, 1, 23, 100]:
                        for mode_level in range(0, level_max):
                            for other_level in range(0, level_max):
                                if other_level == mode_level:
                                    continue
                                test = OracleUnitTest(level_max,
                                                      reclaim_threshold,
                                                      proportional_reward_rate,
                                                      mint,
                                                      deposit,
                                                      mode_level,
                                                      other_level)
                                test.run()
                                test.teardown()


if __name__ == "__main__":
    main()
