#!/usr/bin/env python3
from jlc import *
import unittest

class OracleUnitTest(unittest.TestCase):
    def __init__(self, level_max, reclaim_threshold, proportional_reward_rate,
                 mint, deposit, mode_level, other_level):
        super().__init__()
        print('level_max=%d reclaim=%d prop=%d mint=%d '
              'deposit=%d mode_level=%d other_level=%d' %
              (level_max, reclaim_threshold, proportional_reward_rate,
               mint, deposit, mode_level, other_level))
        self.level_max = level_max
        self.reclaim_threshold = reclaim_threshold
        self.proportional_reward_rate = proportional_reward_rate
        self.mint = mint
        assert(mint >= 0)
        self.deposit = deposit
        assert(deposit >= 0)
        self.mode_level = mode_level
        self.other_level = other_level
        assert(0 <= mode_level and mode_level < level_max)
        assert(0 <= other_level and other_level < level_max)
        assert(mode_level != other_level)
        self.oracle = Oracle(level_max, reclaim_threshold,
                             proportional_reward_rate)
        self.assertEqual(self.oracle.level_max, level_max)
        self.assertEqual(self.oracle.reclaim_threshold, reclaim_threshold)
        for i in [0, 1, 2]:
            self.assertEqual(len(self.oracle.epochs[i].votes), level_max)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(self.oracle.epochs[1].state, State.RECLAIM)
        self.assertEqual(self.oracle.epochs[2].state, State.REVEAL)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.supply = TokenSupply()

    def teardown(self):
        burn_holder = TokenHolder()
        self.oracle.destroy(burn_holder)
        self.supply.burn(burn_holder)
        burn_holder.destroy()
        self.assertEqual(self.supply.amount, 0)

    def run(self):
        # Invalid oracle
        with self.assertRaises(Exception):
            Oracle(-1, 1)
        with self.assertRaises(Exception):
            Oracle(0, 1)
        with self.assertRaises(Exception):
            Oracle(1, 1)
        with self.assertRaises(Exception):
            Oracle(2, 2)
        with self.assertRaises(Exception):
            Oracle(2, -1)

        mint_holder = TokenHolder()
        burn_holder = TokenHolder()
        deposit_holder = TokenHolder()
        reclaim_holder = TokenHolder()

        # no commit -> no reveal -> no reclaim
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, 0)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)
        self.assertEqual(self.oracle.epochs[1].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[1].commits), 0)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].reward_total, 0)
        self.assertEqual(self.oracle.epochs[2].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[2].commits), 0)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].reward_total, self.mint)

        self.assertEqual(self.oracle.reveal(0x1000, -1, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(0x1000, 0, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(0x1000, 0, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.level_max, 1111, ""), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, self.mint)
        self.assertEqual(self.oracle.epochs[1].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[1].commits), 0)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].reward_total, 0)
        self.assertEqual(self.oracle.epochs[2].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[2].commits), 0)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].reward_total, 0)

        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), False)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)
        self.assertEqual(self.oracle.epochs[1].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[1].commits), 0)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].reward_total, self.mint)
        self.assertEqual(self.oracle.epochs[2].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[2].commits), 0)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].reward_total, 0)

        self.supply.mint(burn_holder, 10)
        with self.assertRaises(Exception):
            self.oracle.advance_phase(mint_holder, burn_holder)
        self.supply.burn(burn_holder)

        # 1 commit -> 1 reveal -> 1 reclaim
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), False)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, 0, 1111),
                               deposit_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 1)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)
        self.assertEqual(self.oracle.epochs[1].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[1].commits), 0)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].reward_total, 0)
        self.assertEqual(self.oracle.epochs[2].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[2].commits), 0)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].reward_total, self.mint)

        self.assertEqual(self.oracle.reveal(0x1000, -1, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.level_max, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(0x2000, 0, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), True)
        self.assertEqual(self.oracle.reveal(0x1000, 0, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), False)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 1)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         self.mode_level)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 1)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 0)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit)
                self.assertEqual(vote.should_reward, True)
                self.assertEqual(vote.should_reclaim, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].reward_total, self.mint)
        self.assertEqual(self.oracle.epochs[1].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[1].commits), 0)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].reward_total, 0)
        self.assertEqual(self.oracle.epochs[2].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[2].commits), 0)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].reward_total, 0)

        self.supply.mint(reclaim_holder, 10)
        with self.assertRaises(Exception):
            self.oracle.reclaim(0x1000, reclaim_holder)
        self.supply.burn(reclaim_holder)

        reclaim_amount = self.deposit + self._reward(self.mint, 1)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), False)
        self.assertEqual(self.oracle.reclaim(0x2000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = self.mint - self._reward(self.mint, 1) * 1
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)
        self.assertEqual(self.oracle.epochs[1].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[1].commits), 0)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].reward_total, self.mint)
        self.assertEqual(self.oracle.epochs[2].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[2].commits), 0)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].reward_total, 0)

        # 1 commit -> 1 reveal -> 1 reclaim
        #             1 commit -> 1 reveal -> 1 reclaim
        #                         1 commit -> 1 reveal -> 1 reclaim
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 1)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)
        self.assertEqual(self.oracle.epochs[1].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[1].commits), 0)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].reward_total, 0)
        self.assertEqual(self.oracle.epochs[2].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[2].commits), 0)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].reward_total, self.mint)

        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, "aaa"), True)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 1)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         self.mode_level)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 1)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 0)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].reward_total, self.mint)
        self.assertEqual(self.oracle.epochs[1].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[1].commits), 1)
        self.assertEqual(self.oracle.epochs[1].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[1].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[1].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[1].reward_total, 0)
        self.assertEqual(self.oracle.epochs[2].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[2].commits), 0)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].reward_total, 0)

        reclaim_amount = self.deposit + self._reward(self.mint, 1)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)

        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, "bbb"), True)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = self.mint - self._reward(self.mint, 1) * 1
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)
        self.assertEqual(self.oracle.epochs[1].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[1].commits), 1)
        self.assertEqual(self.oracle.epochs[1].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[1].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[1].commits[0x1000].revealed_level,
                         self.mode_level)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].votes[self.mode_level].count, 1)
        self.assertEqual(self.oracle.epochs[1].votes[self.other_level].count, 0)
        for level in range(self.level_max):
            vote = self.oracle.epochs[1].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[1].reward_total, self.mint)
        self.assertEqual(self.oracle.epochs[2].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[2].commits), 1)
        self.assertEqual(self.oracle.epochs[2].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[2].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[2].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[2].reward_total, 0)

        reclaim_amount = self.deposit + self._reward(self.mint, 1)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)

        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, "ccc"), True)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = self.mint - self._reward(self.mint, 1) * 1
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)
        self.assertEqual(self.oracle.epochs[1].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[1].commits), 0)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].reward_total, 0)
        self.assertEqual(self.oracle.epochs[2].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[2].commits), 1)
        self.assertEqual(self.oracle.epochs[2].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[2].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[2].commits[0x1000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[2].commits[0x1000].revealed_comment,
                         "ccc")
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].votes[self.mode_level].count, 1)
        self.assertEqual(self.oracle.epochs[2].votes[self.other_level].count, 0)
        for level in range(self.level_max):
            vote = self.oracle.epochs[2].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[2].reward_total, self.mint)

        reclaim_amount = self.deposit + self._reward(self.mint, 1)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)

        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = self.mint - self._reward(self.mint, 1) * 1
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, self.mint)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, self.mint)
        self.assertEqual(self.oracle.epochs[1].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[1].commits), 0)
        self.assertEqual(len(self.oracle.epochs[1].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[1].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[1].reward_total, 0)
        self.assertEqual(self.oracle.epochs[2].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[2].commits), 0)
        self.assertEqual(len(self.oracle.epochs[2].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[2].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[2].reward_total, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)

        # 6 commits on the mode ->
        # 6 reveals on the mode ->
        # full reclaim
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x2000,
                               hash_function(0x2000, self.mode_level, 2222),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x3000,
                               hash_function(0x3000, self.mode_level, 3333),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x4000,
                               hash_function(0x4000, self.mode_level, 4444),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x5000,
                               hash_function(0x5000, self.mode_level, 5555),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x6000,
                               hash_function(0x6000, self.mode_level, 6666),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].committed_hash,
                         hash_function(0x2000, self.mode_level, 2222))
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].committed_hash,
                         hash_function(0x3000, self.mode_level, 3333))
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].committed_hash,
                         hash_function(0x4000, self.mode_level, 4444))
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].committed_hash,
                         hash_function(0x5000, self.mode_level, 5555))
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].committed_hash,
                         hash_function(0x6000, self.mode_level, 6666))
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level + 100, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x2000, self.mode_level, 2222, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x3000, self.mode_level, 3333, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x4000, self.mode_level, 4444, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x5000, self.mode_level, 5555, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x6000, self.mode_level, 6666, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x7000, self.mode_level, 7777, ""), False)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         self.mode_level)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 6)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 0)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit * 6)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount,
                         self.mint)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, self.mint)

        reclaim_amount = self.deposit + self._reward(self.mint, 6)
        self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x5000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x4000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x3000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x2000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), False)
        self.assertEqual(self.oracle.reclaim(0x7000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = self.mint - self._reward(self.mint, 6) * 6
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        # 6 commits on the mode ->
        # 6 reveals on the mode ->
        # no reclaim
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x2000,
                               hash_function(0x2000, self.mode_level, 2222),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x3000,
                               hash_function(0x3000, self.mode_level, 3333),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x4000,
                               hash_function(0x4000, self.mode_level, 4444),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x5000,
                               hash_function(0x5000, self.mode_level, 5555),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x6000,
                               hash_function(0x6000, self.mode_level, 6666),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].committed_hash,
                         hash_function(0x2000, self.mode_level, 2222))
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].committed_hash,
                         hash_function(0x3000, self.mode_level, 3333))
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].committed_hash,
                         hash_function(0x4000, self.mode_level, 4444))
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].committed_hash,
                         hash_function(0x5000, self.mode_level, 5555))
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].committed_hash,
                         hash_function(0x6000, self.mode_level, 6666))
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level + 100, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x2000, self.mode_level, 2222, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x3000, self.mode_level, 3333, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x4000, self.mode_level, 4444, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x5000, self.mode_level, 5555, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x6000, self.mode_level, 6666, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x7000, self.mode_level, 7777, ""), False)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         self.mode_level)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 6)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 0)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit * 6)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount,
                         self.mint)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, self.mint)

        self.assertEqual(self.oracle.reclaim(0x7000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = self.mint + self.deposit * 6
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        # 4 commits on the mode + 2 commits on the other level ->
        # 4 reveals on the mode + 2 reveals on the other level ->
        # full reclaim
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x2000,
                               hash_function(0x2000, self.other_level, 2222),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x3000,
                               hash_function(0x3000, self.mode_level, 3333),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x4000,
                               hash_function(0x4000, self.mode_level, 4444),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x5000,
                               hash_function(0x5000, self.mode_level, 5555),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x6000,
                               hash_function(0x6000, self.other_level, 6666),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].committed_hash,
                         hash_function(0x2000, self.other_level, 2222))
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].committed_hash,
                         hash_function(0x3000, self.mode_level, 3333))
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].committed_hash,
                         hash_function(0x4000, self.mode_level, 4444))
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].committed_hash,
                         hash_function(0x5000, self.mode_level, 5555))
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].committed_hash,
                         hash_function(0x6000, self.other_level, 6666))
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level + 100, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x2000, self.other_level, 2222, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x3000, self.mode_level, 3333, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x4000, self.mode_level, 4444, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x5000, self.mode_level, 5555, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x6000, self.other_level, 6666, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x7000, self.mode_level, 7777, ""), False)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         self.other_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         self.other_level)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 4)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 2)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit * 4)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if self._is_in_reclaim_threshold(self.other_level):
            reward_total = self.mint
            deposit_total = self.deposit * 6
        else:
            reward_total = self.mint + self.deposit * 2
            deposit_total = self.deposit * 4
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount,
                         reward_total)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         deposit_total)

        if self._is_in_reclaim_threshold(self.other_level):
            self.assertEqual(self.oracle.reclaim(0x2000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, self.deposit)
            self.supply.burn(reclaim_holder)
            self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, self.deposit)
            self.supply.burn(reclaim_holder)
        else:
            self.assertEqual(self.oracle.reclaim(0x2000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, 0)
            self.supply.burn(reclaim_holder)
            self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, 0)
            self.supply.burn(reclaim_holder)

        reclaim_amount = self.deposit + self._reward(reward_total, 4)
        self.assertEqual(self.oracle.reclaim(0x5000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x4000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x3000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), False)
        self.assertEqual(self.oracle.reclaim(0x7000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = reward_total - self._reward(reward_total, 4) * 4
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        # 4 commits on the mode + 2 commits on the other level ->
        # 4 reveals on the mode + 2 reveals on the other level ->
        # no reclaim
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x2000,
                               hash_function(0x2000, self.other_level, 2222),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x3000,
                               hash_function(0x3000, self.mode_level, 3333),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x4000,
                               hash_function(0x4000, self.mode_level, 4444),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x5000,
                               hash_function(0x5000, self.mode_level, 5555),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x6000,
                               hash_function(0x6000, self.other_level, 6666),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].committed_hash,
                         hash_function(0x2000, self.other_level, 2222))
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].committed_hash,
                         hash_function(0x3000, self.mode_level, 3333))
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].committed_hash,
                         hash_function(0x4000, self.mode_level, 4444))
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].committed_hash,
                         hash_function(0x5000, self.mode_level, 5555))
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].committed_hash,
                         hash_function(0x6000, self.other_level, 6666))
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level + 100, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x2000, self.other_level, 2222, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x3000, self.mode_level, 3333, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x4000, self.mode_level, 4444, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x5000, self.mode_level, 5555, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x6000, self.other_level, 6666, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x7000, self.mode_level, 7777, ""), False)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         self.other_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         self.other_level)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 4)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 2)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit * 4)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if self._is_in_reclaim_threshold(self.other_level):
            reward_total = self.mint
            deposit_total = self.deposit * 6
        else:
            reward_total = self.mint + self.deposit * 2
            deposit_total = self.deposit * 4
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount,
                         reward_total)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         deposit_total)

        self.assertEqual(self.oracle.reclaim(0x7000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = self.mint + self.deposit * 6
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        # 3 commits on the two modes ->
        # 3 reveals on the two modes ->
        # full reclaim
        real_mode_level = min(self.mode_level, self.other_level)
        real_other_level = max(self.mode_level, self.other_level)
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, real_mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x2000,
                               hash_function(0x2000, real_other_level, 2222),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x3000,
                               hash_function(0x3000, real_mode_level, 3333),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x4000,
                               hash_function(0x4000, real_other_level, 4444),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x5000,
                               hash_function(0x5000, real_mode_level, 5555),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x6000,
                               hash_function(0x6000, real_other_level, 6666),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, real_mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].committed_hash,
                         hash_function(0x2000, real_other_level, 2222))
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].committed_hash,
                         hash_function(0x3000, real_mode_level, 3333))
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].committed_hash,
                         hash_function(0x4000, real_other_level, 4444))
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].committed_hash,
                         hash_function(0x5000, real_mode_level, 5555))
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].committed_hash,
                         hash_function(0x6000, real_other_level, 6666))
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        self.assertEqual(self.oracle.reveal(
            0x1000, real_mode_level + 100, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, real_mode_level, 1111, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x1000, real_mode_level, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x2000, real_other_level, 2222, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x3000, real_mode_level, 3333, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x4000, real_other_level, 4444, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x5000, real_mode_level, 5555, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x6000, real_other_level, 6666, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x7000, real_mode_level, 7777, ""), False)

        self.assertEqual(self.oracle.mode_level(), real_mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         real_mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         real_other_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         real_mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         real_other_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         real_mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         real_other_level)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 3)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 3)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == real_mode_level:
                self.assertEqual(vote.deposit, self.deposit * 3)
                self.assertEqual(vote.should_reward, True)
            elif (real_mode_level - self.reclaim_threshold <= level and
                  level <= real_mode_level + self.reclaim_threshold):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if (real_mode_level - self.reclaim_threshold <= real_other_level and
            real_other_level <= real_mode_level + self.reclaim_threshold):
            reward_total = self.mint
            deposit_total = self.deposit * 6
        else:
            reward_total = self.mint + self.deposit * 3
            deposit_total = self.deposit * 3
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount,
                         reward_total)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         deposit_total)

        if (real_mode_level - self.reclaim_threshold <= real_other_level and
            real_other_level <= real_mode_level + self.reclaim_threshold):
            self.assertEqual(self.oracle.reclaim(0x2000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, self.deposit)
            self.supply.burn(reclaim_holder)
            self.assertEqual(self.oracle.reclaim(0x4000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, self.deposit)
            self.supply.burn(reclaim_holder)
            self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, self.deposit)
            self.supply.burn(reclaim_holder)
        else:
            self.assertEqual(self.oracle.reclaim(0x2000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, 0)
            self.supply.burn(reclaim_holder)
            self.assertEqual(self.oracle.reclaim(0x4000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, 0)
            self.supply.burn(reclaim_holder)
            self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, 0)
            self.supply.burn(reclaim_holder)

        reclaim_amount = self.deposit + self._reward(reward_total, 3)
        self.assertEqual(self.oracle.reclaim(0x5000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x3000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), False)
        self.assertEqual(self.oracle.reclaim(0x7000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = reward_total - self._reward(reward_total, 3) * 3
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        # 3 commits on the two modes ->
        # 3 reveals on the two modes ->
        # no reclaim
        real_mode_level = min(self.mode_level, self.other_level)
        real_other_level = max(self.mode_level, self.other_level)
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, real_mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x2000,
                               hash_function(0x2000, real_other_level, 2222),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x3000,
                               hash_function(0x3000, real_mode_level, 3333),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x4000,
                               hash_function(0x4000, real_other_level, 4444),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x5000,
                               hash_function(0x5000, real_mode_level, 5555),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x6000,
                               hash_function(0x6000, real_other_level, 6666),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, real_mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].committed_hash,
                         hash_function(0x2000, real_other_level, 2222))
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].committed_hash,
                         hash_function(0x3000, real_mode_level, 3333))
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].committed_hash,
                         hash_function(0x4000, real_other_level, 4444))
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].committed_hash,
                         hash_function(0x5000, real_mode_level, 5555))
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].committed_hash,
                         hash_function(0x6000, real_other_level, 6666))
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        self.assertEqual(self.oracle.reveal(
            0x1000, real_mode_level + 100, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, real_mode_level, 1111, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x1000, real_mode_level, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x2000, real_other_level, 2222, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x3000, real_mode_level, 3333, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x4000, real_other_level, 4444, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x5000, real_mode_level, 5555, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x6000, real_other_level, 6666, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x7000, real_mode_level, 7777, ""), False)

        self.assertEqual(self.oracle.mode_level(),
                         min(real_mode_level, real_other_level))

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         real_mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         real_other_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         real_mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         real_other_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         real_mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         real_other_level)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 3)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 3)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == real_mode_level:
                self.assertEqual(vote.deposit, self.deposit * 3)
                self.assertEqual(vote.should_reward, True)
            elif (real_mode_level - self.reclaim_threshold <= level and
                  level <= real_mode_level + self.reclaim_threshold):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if (real_mode_level - self.reclaim_threshold <= real_other_level and
            real_other_level <= real_mode_level + self.reclaim_threshold):
            reward_total = self.mint
            deposit_total = self.deposit * 6
        else:
            reward_total = self.mint + self.deposit * 3
            deposit_total = self.deposit * 3
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount,
                         reward_total)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         deposit_total)

        self.assertEqual(self.oracle.reclaim(0x7000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = self.mint + self.deposit * 6
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        # 4 commits on the mode + 2 commits on the other level ->
        # 2 reveals on the mode + 1 reveals on the other level ->
        # full reclaim
        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x2000,
                               hash_function(0x2000, self.other_level, 2222),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x3000,
                               hash_function(0x3000, self.mode_level, 3333),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x4000,
                               hash_function(0x4000, self.mode_level, 4444),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x5000,
                               hash_function(0x5000, self.mode_level, 5555),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x6000,
                               hash_function(0x6000, self.other_level, 6666),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].committed_hash,
                         hash_function(0x2000, self.other_level, 2222))
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].committed_hash,
                         hash_function(0x3000, self.mode_level, 3333))
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].committed_hash,
                         hash_function(0x4000, self.mode_level, 4444))
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].committed_hash,
                         hash_function(0x5000, self.mode_level, 5555))
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].committed_hash,
                         hash_function(0x6000, self.other_level, 6666))
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level + 100, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level, 1111, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x2000, self.other_level, 2222, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x3000, self.mode_level, 3333, ""), True)
        # Incorrect reveal_level
        self.assertEqual(self.oracle.reveal(
            0x4000, self.other_level, 4444, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x4000, self.mode_level, 4444, ""), False)
        # Incorrect salt
        self.assertEqual(self.oracle.reveal(
            0x5000, self.mode_level, 6666, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x5000, self.mode_level, 5555, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x7000, self.mode_level, 7777, ""), False)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         self.other_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 2)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 1)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit * 2)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if self._is_in_reclaim_threshold(self.other_level):
            reward_total = self.mint + self.deposit * 3
            deposit_total = self.deposit * 3
        else:
            reward_total = self.mint + self.deposit * 4
            deposit_total = self.deposit * 2
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount,
                         reward_total)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         deposit_total)

        if self._is_in_reclaim_threshold(self.other_level):
            self.assertEqual(self.oracle.reclaim(0x2000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, self.deposit)
            self.supply.burn(reclaim_holder)
            self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), False)
            self.assertEqual(reclaim_holder.amount, 0)
            self.supply.burn(reclaim_holder)
        else:
            self.assertEqual(self.oracle.reclaim(0x2000, reclaim_holder), True)
            self.assertEqual(reclaim_holder.amount, 0)
            self.supply.burn(reclaim_holder)
            self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), False)
            self.assertEqual(reclaim_holder.amount, 0)
            self.supply.burn(reclaim_holder)

        reclaim_amount = self.deposit + self._reward(reward_total, 2)
        self.assertEqual(self.oracle.reclaim(0x5000, reclaim_holder), False)
        self.assertEqual(reclaim_holder.amount, 0)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x4000, reclaim_holder), False)
        self.assertEqual(reclaim_holder.amount, 0)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x3000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), True)
        self.assertEqual(reclaim_holder.amount, reclaim_amount)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x6000, reclaim_holder), False)
        self.assertEqual(self.oracle.reclaim(0x7000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = reward_total - self._reward(reward_total, 2) * 2
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        # 4 commits on the mode + 2 commits on the other level ->
        # 2 reveals on the mode + 1 reveals on the other level ->
        # no reclaim

        self.assertEqual(self.oracle.mode_level(), -1)

        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x1000,
                               hash_function(0x1000, self.mode_level, 1111),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x2000,
                               hash_function(0x2000, self.other_level, 2222),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x3000,
                               hash_function(0x3000, self.mode_level, 3333),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x4000,
                               hash_function(0x4000, self.mode_level, 4444),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x5000,
                               hash_function(0x5000, self.mode_level, 5555),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)
        self.supply.mint(deposit_holder, self.deposit)
        self.assertEqual(
            self.oracle.commit(0x6000,
                               hash_function(0x6000, self.other_level, 6666),
                               deposit_holder), True)
        self.assertEqual(deposit_holder.amount, 0)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 1)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.REVEAL)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].committed_hash,
                         hash_function(0x1000, self.mode_level, 1111))
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].committed_hash,
                         hash_function(0x2000, self.other_level, 2222))
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].committed_hash,
                         hash_function(0x3000, self.mode_level, 3333))
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].committed_hash,
                         hash_function(0x4000, self.mode_level, 4444))
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].committed_hash,
                         hash_function(0x5000, self.mode_level, 5555))
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].committed_hash,
                         hash_function(0x6000, self.other_level, 6666))
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].deposit,
                         self.deposit)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         -1)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         self.deposit * 6)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        self.assertEqual(self.oracle.reveal(
            0x1000, self.mode_level + 100, 1111, ""), False)
        # Incorrect revealed level
        self.assertEqual(self.oracle.reveal(
            0x2000, self.mode_level, 2222, ""), False)
        # Incorrect salt
        self.assertEqual(self.oracle.reveal(
            0x3000, self.mode_level, 4444, ""), False)
        self.assertEqual(self.oracle.reveal(
            0x4000, self.mode_level, 4444, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x5000, self.mode_level, 5555, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x6000, self.other_level, 6666, ""), True)
        self.assertEqual(self.oracle.reveal(
            0x7000, self.mode_level, 7777, ""), False)

        self.assertEqual(self.oracle.mode_level(), self.mode_level)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        self.assertEqual(burn_holder.amount, self.mint)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 2)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.RECLAIM)
        self.assertEqual(len(self.oracle.epochs[0].commits), 6)
        self.assertEqual(self.oracle.epochs[0].commits[0x1000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x2000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x3000].revealed_level,
                         -1)
        self.assertEqual(self.oracle.epochs[0].commits[0x4000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x5000].revealed_level,
                         self.mode_level)
        self.assertEqual(self.oracle.epochs[0].commits[0x6000].revealed_level,
                         self.other_level)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].votes[self.mode_level].count, 2)
        self.assertEqual(self.oracle.epochs[0].votes[self.other_level].count, 1)
        for level in range(self.level_max):
            vote = self.oracle.epochs[0].votes[level]
            if level == self.mode_level:
                self.assertEqual(vote.deposit, self.deposit * 2)
                self.assertEqual(vote.should_reward, True)
            elif self._is_in_reclaim_threshold(level):
                self.assertEqual(vote.should_reclaim, True)
            else:
                self.assertEqual(vote.should_reclaim, False)

        reward_total = 0
        deposit_total = 0
        if self._is_in_reclaim_threshold(self.other_level):
            reward_total = self.mint + self.deposit * 3
            deposit_total = self.deposit * 3
        else:
            reward_total = self.mint + self.deposit * 4
            deposit_total = self.deposit * 2
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount,
                         reward_total)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount,
                         deposit_total)

        self.assertEqual(self.oracle.reclaim(0x1000, reclaim_holder), False)
        self.assertEqual(reclaim_holder.amount, 0)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x2000, reclaim_holder), False)
        self.assertEqual(reclaim_holder.amount, 0)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x3000, reclaim_holder), False)
        self.assertEqual(reclaim_holder.amount, 0)
        self.supply.burn(reclaim_holder)
        self.assertEqual(self.oracle.reclaim(0x7000, reclaim_holder), False)

        self.supply.mint(mint_holder, self.mint)
        self.oracle.advance_phase(mint_holder, burn_holder)
        self.assertEqual(mint_holder.amount, 0)
        remainder = self.mint + self.deposit * 6
        self.assertEqual(burn_holder.amount, remainder)
        self.supply.burn(burn_holder)
        self.assertEqual(self.oracle.latest_epoch, 0)
        self.assertEqual(self.oracle.mode_level(), -1)
        self.assertEqual(self.oracle.epochs[0].state, State.COMMIT)
        self.assertEqual(len(self.oracle.epochs[0].commits), 0)
        self.assertEqual(len(self.oracle.epochs[0].votes), self.level_max)
        self.assertEqual(self.oracle.epochs[0].reward_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].deposit_holder.amount, 0)
        self.assertEqual(self.oracle.epochs[0].reward_total, 0)

        mint_holder.destroy()
        burn_holder.destroy()
        reclaim_holder.destroy()
        deposit_holder.destroy()
        pass

    def _is_in_reclaim_threshold(self, level):
        return (self.mode_level - self.reclaim_threshold <= level and
                level <= self.mode_level + self.reclaim_threshold)

    def _reward(self, reward_total, count):
        proportional_reward = 0
        if self.deposit > 0:
            proportional_reward = int(
                (self.proportional_reward_rate * reward_total) / (100 * count))
        constant_reward = int(
            ((100 - self.proportional_reward_rate) * reward_total) /
            (100 * count))
        return proportional_reward + constant_reward



def main():
    for level_max in [2, 3, 4, 5, 6, 11]:
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
