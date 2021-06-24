#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import hashlib, random

#-------------------------------------------------------------------------------
# [Overview]
#
# JohnLawCoin is a stable coin realized by an Algorithmic Central Bank (ACB).
# The system is fully decentralized and there is truly no gatekeeper.
#
# JohnLawCoin is a real-world experiment to verify the following assumption:
#
# - There is a way to stabilize the coin price with algorithmically defined
#   monetary policies without holding any collateral.
#
# If JohnLawCoin is successful and proves the assumption is correct, it will
# provide interesting insights for both non-fiat currencies and fiat
# currencies; i.e., 1) there is a way for non-fiat cryptocurrencies to
# implement a stablecoin without having any gatekeeper that holds collateral,
# and 2) there is a way for developing countries to implement a fixed exchange
# rate system for their fiat currencies without holding adequate USD reserves.
# This will upgrade human's understanding about money.
#
# JohnLawCoin has the following important properties:
#
# - There is truly no gatekeeper. The ACB is fully automated and no one
#   (including the author of the smart contract) has the privileges of
#   influencing the monetary policies of the ACB. This can be verified by the
#   fact that the smart contract has no operations that need privileged
#   permissions.
# - The smart contract is self-contained. There are no dependencies on other
#   smart contracts and external services.
# - All operations are guaranteed to terminate in the time complexity of O(1).
#   The time complexity of each operation is determined solely by the input
#   size of the operation and not affected by the state of the smart contract.
#
# See the whitepaper for more details
# (https://github.com/xharaken/john-law-coin/blob/main/docs/whitepaper.pdf).
#
# If you have any questions, add comments to the GitHub issues
# (https://github.com/xharaken/john-law-coin).
#-------------------------------------------------------------------------------

#-------------------------------------------------------------------------------
# [JohnLawCoin contract]
#
# JohnLawCoin is implemented as ERC20 tokens.
#-------------------------------------------------------------------------------
class JohnLawCoin:
    # Constructor.
    def __init__(self, genesis_account):
        # The initial coin supply.
        JohnLawCoin.INITIAL_COIN_SUPPLY = 10000000
        # The tax rate.
        JohnLawCoin.TAX_RATE = 1
        
        # The mapping from the user account to the coin balance.
        self.balances = {}
        # The total coin supply.
        self.total_supply = 0
        # The account to which the tax is sent.
        self.tax_account = "tax" + str(random.random())

        # Mint the initial coins to the genesis account.
        self.mint(genesis_account, JohnLawCoin.INITIAL_COIN_SUPPLY)

    # Mint coins to one account.
    #
    # Parameters
    # ----------------
    # |account|: The account to which the coins are minted.
    # |amount|: The amount to be minted.
    #
    # Returns
    # ----------------
    # None.
    def mint(self, account, amount):
        assert(amount >= 0)
        if account not in self.balances:
            self.balances[account] = 0
        self.balances[account] += amount
        self.total_supply += amount

    # Burn coins from one account.
    #
    # Parameters
    # ----------------
    # |account|: The account from which the coins are burned.
    # |amount|: The amount to be burned.
    #
    # Returns
    # ----------------
    # None.
    def burn(self, account, amount):
        assert(amount >= 0)
        if account not in self.balances:
            self.balances[account] = 0
        assert(self.balances[account] >= amount)
        self.balances[account] -= amount
        assert(self.total_supply >= amount)
        self.total_supply -= amount

    # Move coins from one account to another account. This method can be used
    # only by the ACB and its oracle. Coin holders should use ERC20's transfer
    # method instead.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |receiver|: The receiver account.
    # |amount|: The amount to be moved.
    #
    # Returns
    # ----------------
    # None.
    def move(self, sender, receiver, amount):
        assert(amount >= 0)
        self.burn(sender, amount)
        self.mint(receiver, amount)

    # Return the coin balance.
    def balance_of(self, account):
        if account not in self.balances:
            return 0
        return self.balances[account]

    # Reset the tax account. Only the ACB can call this method.
    def reset_tax_account(self):
        old_tax_account = self.tax_account
        self.tax_account = "tax" + str(random.random())
        self.move(old_tax_account, self.tax_account,
                  self.balance_of(old_tax_account))

    # Override ERC20's transfer method to impose a tax set by the ACB.
    def transfer(self, sender, receiver, amount):
        assert(sender in self.balances)
        assert(self.balances[sender] >= amount)
        tax = int(amount * JohnLawCoin.TAX_RATE / 100)
        self.move(sender, self.tax_account, tax)
        self.move(sender, receiver, amount - tax)


#------------------------------------------------------------------------------
# [JohnLawBond contract]
#
# JohnLawBond is an implementation of the bonds to control the total coin
# supply. The bonds are not transferable.
#------------------------------------------------------------------------------
class JohnLawBond:
    # Constructor.
    def __init__(self):
        # bonds[account][redemption_epoch] stores the number of the
        # bonds owned by the |account| and have the |redemption_epoch|.
        self.bonds = {}

        # redemption_epochs[account] is a set of the redemption epochs of the
        # bonds owned by the |account|.
        self.redemption_epochs = {}

        # bond_count[account] is the number of bonds owned by the |account|.
        self.bond_count = {}

        # bond_supply[redemption_epoch] is the total number of bonds that have
        # the |redemption_epoch|.
        self.bond_supply = {}

        # The total bond supply.
        self.total_supply = 0

    # Mint bonds to one account.
    #
    # Parameters
    # ----------------
    # |account|: The account to which the bonds are minted.
    # |redemption_epoch|: The redemption epoch of the bonds.
    # |amount|: The amount to be minted.
    #
    # Returns
    # ----------------
    # None.
    def mint(self, account, redemption_epoch, amount):
        assert(amount >= 0)
        if account not in self.bonds:
            self.bonds[account] = {}
            self.bond_count[account] = 0
        if redemption_epoch not in self.bonds[account]:
            self.bonds[account][redemption_epoch] = 0
        if redemption_epoch not in self.bond_supply:
            self.bond_supply[redemption_epoch] = 0
        self.bonds[account][redemption_epoch] += amount
        self.total_supply += amount
        self.bond_count[account] += amount
        self.bond_supply[redemption_epoch] += amount

        if account not in self.redemption_epochs:
            self.redemption_epochs[account] = {}
        if (self.bonds[account][redemption_epoch] > 0 and
            redemption_epoch not in self.redemption_epochs[account]):
            self.redemption_epochs[account][redemption_epoch] = True

    # Burn bonds from one account.
    #
    # Parameters
    # ----------------
    # |account|: The account from which the bonds are burned.
    # |redemption_epoch|: The redemption epoch of the bonds.
    # |amount|: The amount to be burned.
    #
    # Returns
    # ----------------
    # None.
    def burn(self, account, redemption_epoch, amount):
        assert(amount >= 0)
        if account not in self.bonds:
            self.bonds[account] = {}
            self.bond_count[account] = 0
        if redemption_epoch not in self.bonds[account]:
            self.bonds[account][redemption_epoch] = 0
        if redemption_epoch not in self.bond_supply:
            self.bond_supply[redemption_epoch] = 0
        assert(self.bonds[account][redemption_epoch] >= amount)
        self.bonds[account][redemption_epoch] -= amount
        assert(self.total_supply >= amount)
        self.total_supply -= amount
        assert(self.bond_count[account] >= amount)
        self.bond_count[account] -= amount
        assert(self.bond_supply[redemption_epoch] >= amount)
        self.bond_supply[redemption_epoch] -= amount

        if account not in self.redemption_epochs:
            self.redemption_epochs[account] = {}
        if (self.bonds[account][redemption_epoch] == 0 and
            redemption_epoch in self.redemption_epochs[account]):
            del self.redemption_epochs[account][redemption_epoch]

    # Return the number of bonds owned by the |account|.
    def number_of_bonds_owned_by(self, account):
        if account not in self.bond_count:
            return 0
        return self.bond_count[account]

    # Return the number of redemption epochs of the bonds owned by the
    # |account|.
    def number_of_redemption_epochs_owned_by(self, account):
        if account not in self.redemption_epochs:
            return 0
        return len(self.redemption_epochs[account])

    # Return the |index|-th redemption epoch of the bonds owned by the
    # |account|. |index| must be smaller than the value returned by
    # numberOfRedemptionEpochsOwnedBy(account).
    def get_redemption_epoch_owned_by(self, account, index):
        assert(0 <= index and
               index < self.number_of_redemption_epochs_owned_by(account))
        return list(self.redemption_epochs[account].keys())[index]

    # Return the bond balance.
    def balance_of(self, account, redemption_epoch):
        if account not in self.bonds:
            return 0
        if redemption_epoch not in self.bonds[account]:
            return 0
        return self.bonds[account][redemption_epoch]

    # Return the number of bonds whose redemption epoch is |redemption_epoch|.
    def bond_supply_at(self, redemption_epoch):
        if redemption_epoch not in self.bond_supply:
            return 0
        return self.bond_supply[redemption_epoch]


#-------------------------------------------------------------------------------
# [Oracle contract]
#
# The oracle is a decentralized mechanism to determine one "truth" level
# from 0, 1, 2, ..., LEVEL_MAX - 1. The oracle uses the commit-reveal-reclaim
# voting scheme.
#-------------------------------------------------------------------------------

# The oracle.
class Oracle:

    # The valid phase transition is: COMMIT => REVEAL => RECLAIM.
    class Phase:
        COMMIT = 0
        REVEAL = 1
        RECLAIM = 2

    # Commit is a struct to manage one commit entry in the commit-reveal-reclaim
    # scheme.
    class Commit:
        def __init__(self, hash, deposit,
                     oracle_level, phase, epoch_id):
            # The committed hash (filled in the commit phase).
            self.hash = hash
            # The amount of deposited coins (filled in the commit phase).
            self.deposit = deposit
            # The oracle level (filled in the reveal phase).
            self.oracle_level = oracle_level
            # The phase of this commit entry.
            self.phase = phase
            # The epoch ID when this commit entry is created.
            self.epoch_id = epoch_id

    # Vote is a struct to count votes for each oracle level.
    class Vote:
        # Voting statitics are aggregated during the reveal phase and finalized
        # at the end of the reveal phase.
        def __init__(self, deposit, count, should_reclaim, should_reward):
            # The total amount of the coins deposited by the voters who voted
            # for this oracle level.
            self.deposit = deposit
            # The number of the voters.
            self.count = count
            # Set to true when the voters for this oracle level are eligible to
            # reclaim the coins they deposited.
            self.should_reclaim = should_reclaim
            # Set to true when the voters for this oracle level are eligible to
            # receive a reward.
            self.should_reward = should_reward

    # Epoch is a struct to keep track of states in the commit-reveal-reclaim
    # scheme. The oracle creates three Epoch objects and uses them in a
    # round-robin manner. For example, when the first Epoch object is in use for
    # the commit phase, the second Epoch object is in use for the reveal phase,
    # and the third Epoch object is in use for the reclaim phase.
    class Epoch:
        def __init__(self):
            # The commit entries.
            self.commits = {}
            # The voting statistics for all the oracle levels.
            self.votes = []
            # An account to store coins deposited by the voters.
            self.deposit_account = 0
            # An account to store the reward.
            self.reward_account = 0
            # The total amount of the reward.
            self.reward_total = 0
            # The current phase of this Epoch.
            self.phase = Oracle.Phase.COMMIT

    # Constructor.
    def __init__(self):
        # ----------------
        # Constants
        # ----------------

        # The number of the oracle levels.
        Oracle.LEVEL_MAX = 9

        # If the "truth" level is 4 and RECLAIM_THRESHOLD is 1, the voters who
        # voted for 3, 4 and 5 can reclaim their deposited coins. Other voters
        # lose their deposited coins.
        Oracle.RECLAIM_THRESHOLD = 1

        # The lost coins and the coins minted by ACB are distributed to the
        # voters who voted for the "truth" level as a reward. The
        # PROPORTIONAL_REWARD_RATE of the reward is distributed to the voters in
        # proportion to the coins they deposited. The rest of the reward is
        # distributed to the voters evenly.
        Oracle.PROPORTIONAL_REWARD_RATE = 90 # 90%

        # ----------------
        # Attributes
        # ----------------

        # The oracle creates three Epoch objects and uses them in a round-robin
        # manner (commit => reveal => reclaim).
        self.epochs = [Oracle.Epoch(), Oracle.Epoch(), Oracle.Epoch()]
        for epoch_index in [0, 1, 2]:
            for level in range(Oracle.LEVEL_MAX):
                self.epochs[epoch_index].votes.append(
                    Oracle.Vote(0, 0, False, False))
            self.epochs[epoch_index].deposit_account = (
                "deposit" + str(epoch_index) + str(random.random()))
            self.epochs[epoch_index].reward_account = (
                "reward" + str(epoch_index) + str(random.random()))
            self.epochs[epoch_index].reward_total = 0
        self.epochs[0].phase = Oracle.Phase.COMMIT
        self.epochs[1].phase = Oracle.Phase.RECLAIM
        self.epochs[2].phase = Oracle.Phase.REVEAL

        # |epoch_id_| is a monotonically increasing ID (3, 4, 5, ...).
        # The Epoch object at |epoch_id_ % 3| is in the commit phase.
        # The Epoch object at |(epoch_id_ - 1) % 3| is in the reveal phase.
        # The Epoch object at |(epoch_id_ - 2) % 3| is in the reclaim phase.
        # The epoch ID starts with 3 because 0 in the commit entry is not
        # distinguishable from an uninitialized commit entry in Solidity.
        self.epoch_id = 3

    # Test only.
    def override_constants_for_testing(
        self, level_max, reclaim_threshold, proportional_reward_rate):

        Oracle.LEVEL_MAX = level_max
        Oracle.RECLAIM_THRESHOLD = reclaim_threshold
        Oracle.PROPORTIONAL_REWARD_RATE = proportional_reward_rate

        assert(2 <= Oracle.LEVEL_MAX and Oracle.LEVEL_MAX < 100)
        assert(0 <= Oracle.RECLAIM_THRESHOLD and
               Oracle.RECLAIM_THRESHOLD < Oracle.LEVEL_MAX)
        assert(0 <= Oracle.PROPORTIONAL_REWARD_RATE and
               Oracle.PROPORTIONAL_REWARD_RATE <= 100)

        for epoch_index in [0, 1, 2]:
            for level in range(
                len(self.epochs[epoch_index].votes), Oracle.LEVEL_MAX):
                self.epochs[epoch_index].votes.append(
                    Oracle.Vote(0, 0, False, False))

    # Do commit.
    #
    # Parameters
    # ----------------
    # |coin|: The JohnLawCoin contract.
    # |sender|: The voter's account.
    # |hash|: The committed hash.
    # |deposit|: The amount of the deposited coins.
    #
    # Returns
    # ----------------
    # True if the commit succeeded. False otherwise.
    def commit(self, coin, sender, hash, deposit):
        epoch = self.epochs[self.epoch_id % 3]
        assert(epoch.phase == Oracle.Phase.COMMIT)
        assert(deposit >= 0)
        if coin.balance_of(sender) < deposit:
            return False

        # One voter can commit only once per phase.
        if (sender in epoch.commits and
            epoch.commits[sender].epoch_id == self.epoch_id):
            return False

        # Create a commit entry.
        epoch.commits[sender] = Oracle.Commit(
            hash, deposit, Oracle.LEVEL_MAX,
            Oracle.Phase.COMMIT, self.epoch_id)
        assert(epoch.commits[sender].phase == Oracle.Phase.COMMIT)

        # Move the deposited coins to the deposit account.
        coin.move(sender, epoch.deposit_account, deposit)
        return True

    # Do reveal.
    #
    # Parameters
    # ----------------
    # |sender|: The voter's account.
    # |oracle_level|: The oracle level revealed by the voter.
    # |salt|: The salt revealed by the voter.
    #
    # Returns
    # ----------------
    # True if the reveal succeeded. False otherwise.
    def reveal(self, sender, oracle_level, salt):
        epoch = self.epochs[(self.epoch_id - 1) % 3]
        assert(epoch.phase == Oracle.Phase.REVEAL)
        if oracle_level < 0 or Oracle.LEVEL_MAX <= oracle_level:
            return False
        if (sender not in epoch.commits or
            epoch.commits[sender].epoch_id != self.epoch_id - 1):
            # The corresponding commit was not found.
            return False

        # One voter can reveal only once per phase.
        if epoch.commits[sender].phase != Oracle.Phase.COMMIT:
            return False
        epoch.commits[sender].phase = Oracle.Phase.REVEAL

        # Check if the committed hash matches the revealed level and salt.
        reveal_hash = Oracle.encrypt(sender, oracle_level, salt)
        hash = epoch.commits[sender].hash
        if hash != reveal_hash:
            return False

        # Update the commit entry with the revealed level.
        epoch.commits[sender].oracle_level = oracle_level

        # Count up the vote.
        epoch.votes[oracle_level].deposit += epoch.commits[sender].deposit
        epoch.votes[oracle_level].count += 1
        return True

    # Do reclaim.
    #
    # Parameters
    # ----------------
    # |coin|: The JohnLawCoin contract.
    # |sender|: The voter's account.
    #
    # Returns
    # ----------------
    # A tuple of two values:
    #  - uint: The amount of the reclaimed coins. This becomes a positive value
    #    when the voter is eligible to reclaim their deposited coins.
    #  - uint: The amount of the reward. This becomes a positive value when the
    #    voter voted for the "truth" oracle level.
    def reclaim(self, coin, sender):
        epoch = self.epochs[(self.epoch_id - 2) % 3]
        assert(epoch.phase == Oracle.Phase.RECLAIM)
        if (sender not in epoch.commits or
            epoch.commits[sender].epoch_id != self.epoch_id - 2):
            # The corresponding commit was not found.
            return (0, 0)

        # One voter can reclaim only once per phase.
        if epoch.commits[sender].phase != Oracle.Phase.REVEAL:
            return (0, 0)

        epoch.commits[sender].phase = Oracle.Phase.RECLAIM
        deposit = epoch.commits[sender].deposit
        oracle_level = epoch.commits[sender].oracle_level
        if oracle_level == Oracle.LEVEL_MAX:
            return (0, 0)
        assert(0 <= oracle_level and oracle_level < Oracle.LEVEL_MAX)

        if not epoch.votes[oracle_level].should_reclaim:
            return (0, 0)
        assert(epoch.votes[oracle_level].should_reclaim)
        assert(epoch.votes[oracle_level].count > 0)

        # Reclaim the deposited coins.
        coin.move(epoch.deposit_account, sender, deposit)

        reward = 0
        if epoch.votes[oracle_level].should_reward:
            # The voter who voted for the "truth" level can receive the reward.
            #
            # The PROPORTIONAL_REWARD_RATE of the reward is distributed to the
            # voters in proportion to the coins they deposited. This
            # incentivizes voters who have many coins (and thus have more power
            # on determining the "truth" level) to join the oracle.
            #
            # The rest of the reward is distributed to the voters evenly. This
            # incentivizes more voters (including new voters) to join the
            # oracle.
            if epoch.votes[oracle_level].deposit > 0:
                reward += int(
                    Oracle.PROPORTIONAL_REWARD_RATE *
                    epoch.reward_total * deposit /
                    (100 * epoch.votes[oracle_level].deposit))
            reward += int(
                ((100 - Oracle.PROPORTIONAL_REWARD_RATE) * epoch.reward_total) /
                (100 * epoch.votes[oracle_level].count))
            coin.move(epoch.reward_account, sender, reward)
        return (deposit, reward)

    # Advance to the next phase. COMMIT => REVEAL, REVEAL => RECLAIM,
    # RECLAIM => COMMIT.
    #
    # Parameters
    # ----------------
    # |coin|: JohnLawCoin.
    #
    # Returns
    # ----------------
    # None.
    def advance(self, coin):
        # Step 1: Move the commit phase to the reveal phase.
        epoch = self.epochs[self.epoch_id % 3]
        assert(epoch.phase == Oracle.Phase.COMMIT)
        epoch.phase = Oracle.Phase.REVEAL

        # Step 2: Move the reveal phase to the reclaim phase.
        epoch = self.epochs[(self.epoch_id - 1) % 3]
        assert(epoch.phase == Oracle.Phase.REVEAL)

        # The "truth" level is set to the mode of the weighted majority votes.
        mode_level = self.get_mode_level()
        if 0 <= mode_level and mode_level < Oracle.LEVEL_MAX:
            deposit_revealed = 0
            deposit_to_reclaim = 0
            for level in range(Oracle.LEVEL_MAX):
                assert(epoch.votes[level].should_reclaim == False)
                assert(epoch.votes[level].should_reward == False)
                deposit_revealed += epoch.votes[level].deposit
                if (mode_level - Oracle.RECLAIM_THRESHOLD <= level and
                    level <= mode_level + Oracle.RECLAIM_THRESHOLD):
                    # Voters who voted for the oracle levels in [mode_level -
                    # RECLAIM_THRESHOLD, mode_level + RECLAIM_THRESHOLD] are
                    # eligible to reclaim their deposited coins. Other voters
                    # lose their deposited coins.
                    epoch.votes[level].should_reclaim = True
                    deposit_to_reclaim += epoch.votes[level].deposit

            # Voters who voted for the "truth" level are eligible to receive
            # the reward.
            epoch.votes[mode_level].should_reward = True

            # Note: |deposit_revealed| is equal to
            # |coin.balance_of(epoch.deposit_account)| only when all the voters
            # who voted in the commit phase revealed their votes correctly in
            # the reveal phase.
            assert(deposit_revealed <= coin.balance_of(epoch.deposit_account))
            assert(deposit_to_reclaim <= coin.balance_of(epoch.deposit_account))

            # The lost coins are moved to the reward account.
            coin.move(
                epoch.deposit_account, epoch.reward_account,
                coin.balance_of(epoch.deposit_account) - deposit_to_reclaim)

        # Move the collected tax to the reward account.
        coin.move(coin.tax_account, epoch.reward_account,
                  coin.balance_of(coin.tax_account))

        # Set the total amount of the reward.
        epoch.reward_total = coin.balance_of(epoch.reward_account)
        epoch.phase = Oracle.Phase.RECLAIM

        # Step 3: Move the reclaim phase to the commit phase.
        epoch_index = (self.epoch_id - 2) % 3
        epoch = self.epochs[epoch_index]
        assert(epoch.phase == Oracle.Phase.RECLAIM)

        burned = (coin.balance_of(epoch.deposit_account) +
                  coin.balance_of(epoch.reward_account))
        # Burn the remaining deposited coins.
        coin.burn(epoch.deposit_account, coin.balance_of(epoch.deposit_account))
        # Burn the remaining reward.
        coin.burn(epoch.reward_account, coin.balance_of(epoch.reward_account))

        # Initialize the Epoch object for the next commit phase.
        #
        # |epoch.commits_| cannot be cleared due to the restriction of Solidity.
        # |epoch_id_| ensures the stale commit entries are not misused.
        epoch.votes = []
        for i in range(Oracle.LEVEL_MAX):
            epoch.votes.append(Oracle.Vote(0, 0, False, False))
        # Regenerate the account addresses just in case.
        assert(coin.balance_of(epoch.deposit_account) == 0)
        assert(coin.balance_of(epoch.reward_account) == 0)
        epoch.deposit_account = (
            "deposit" + str(epoch_index) + str(random.random()))
        epoch.reward_account = (
            "reward" + str(epoch_index) + str(random.random()))
        epoch.reward_total = 0
        epoch.phase = Oracle.Phase.COMMIT

        # Advance the phase.
        self.epoch_id += 1
        return burned

    # Return the oracle level that got the largest amount of deposited coins.
    # In other words, return the mode of the votes weighted by the deposited
    # coins.
    #
    # Parameters
    # ----------------
    # None.
    #
    # Returns
    # ----------------
    # If there are multiple modes, return the mode that has the largest votes.
    # If there are multiple modes that have the largest votes, return the
    # smallest mode. If there are no votes, return LEVEL_MAX.
    def get_mode_level(self):
        epoch = self.epochs[(self.epoch_id - 1) % 3]
        assert(epoch.phase == Oracle.Phase.REVEAL)
        mode_level = Oracle.LEVEL_MAX
        max_deposit = 0
        max_count = 0
        for level in range(Oracle.LEVEL_MAX):
            if (epoch.votes[level].count > 0 and
                (mode_level == Oracle.LEVEL_MAX or
                 max_deposit < epoch.votes[level].deposit or
                 (max_deposit == epoch.votes[level].deposit and
                  max_count < epoch.votes[level].count))):
                max_deposit = epoch.votes[level].deposit
                max_count = epoch.votes[level].count
                mode_level = level
        if mode_level == Oracle.LEVEL_MAX:
            assert(max_deposit == 0)
            assert(max_count == 0)
            return Oracle.LEVEL_MAX
        assert(0 <= mode_level and mode_level < Oracle.LEVEL_MAX)
        return mode_level

    # Calculate a hash to be committed. Voters are expected to use this
    # function to create a hash used in the commit phase.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |level|: The oracle level to vote.
    # |salt|: The voter's salt.
    #
    # Returns
    # ----------------
    # The calculated hash value.
    def encrypt(sender, level, salt):
        string = str(sender) + "_" + str(level) + "_" + str(salt)
        return hashlib.sha256(string.encode()).hexdigest()


#-------------------------------------------------------------------------------
# [Logging contract]
#
# The Logging contract records various metrics for analysis purpose.
#-------------------------------------------------------------------------------
class Logging:
    # A struct to record metrics about voting.
    class VoteLog:
      def __init__(self):
          self.commit_succeeded = 0
          self.commit_failed = 0
          self.reveal_succeeded = 0
          self.reveal_failed = 0
          self.reclaim_succeeded = 0
          self.reward_succeeded = 0
          self.deposited = 0
          self.reclaimed = 0
          self.rewarded = 0

    # A struct to record metrics about epoch.
    class EpochLog:
      def __init__(self):
          self.minted_coins = 0
          self.burned_coins = 0
          self.coin_supply_delta = 0
          self.bond_budget = 0
          self.total_coin_supply = 0
          self.total_bond_supply = 0
          self.valid_bond_supply = 0
          self.oracle_level = 0
          self.current_epoch_start = 0
          self.tax = 0

    # A struct to record metrics about bond operations.
    class BondLog:
      def __init__(self):
          self.purchased_bonds = 0
          self.redeemed_bonds = 0
          self.expired_bonds = 0

    # Constructor.
    def __init__(self):
        # Logs about voting.
        self.vote_logs = {}

        # Logs about epoch.
        self.epoch_logs = {}

        # Logs about bond operations.
        self.bond_logs = {}

    # Called when the oracle phase is updated.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |minted|: The amount of the minted coins.
    # |burned|: The amount of the burned coins.
    # |delta|: The delta of the total coin supply.
    # |bond_budget|: ACB.bond_budget_.
    # |total_coin_supply|: The total coin supply.
    # |total_bond_supply|: The total bond supply.
    # |valid_bond_supply|: The valid bond supply.
    # |oracle_level|: ACB.oracle_level_.
    # |current_epoch_start|: ACB.current_epoch_start_.
    # |tax|: The amount of the tax collected in the phase.
    #
    # Returns
    # ----------------
    # None.
    def epoch_updated(self, epoch_id, minted, burned, delta, bond_budget,
                      total_coin_supply, total_bond_supply, valid_bond_supply,
                      oracle_level, current_epoch_start, tax):
        if epoch_id not in self.epoch_logs:
            self.epoch_logs[epoch_id] = Logging.EpochLog()
            self.vote_logs[epoch_id] = Logging.VoteLog()
            self.bond_logs[epoch_id] = Logging.BondLog()

        self.epoch_logs[epoch_id].minted_coins = minted
        self.epoch_logs[epoch_id].burned_coins = burned
        self.epoch_logs[epoch_id].coin_supply_delta = delta
        self.epoch_logs[epoch_id].bond_budget = bond_budget
        self.epoch_logs[epoch_id].total_coin_supply = total_coin_supply
        self.epoch_logs[epoch_id].total_bond_supply = total_bond_supply
        self.epoch_logs[epoch_id].valid_bond_supply = valid_bond_supply
        self.epoch_logs[epoch_id].oracle_level = oracle_level
        self.epoch_logs[epoch_id].current_epoch_start = current_epoch_start
        self.epoch_logs[epoch_id].tax = tax

    # Called when ACB.vote is called.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |commit_result|: Whether the commit succeeded or not.
    # |reveal_result|: Whether the reveal succeeded or not.
    # |deposited|: The amount of the deposited coins.
    # |reclaimed|: The amount of the reclaimed coins.
    # |rewarded|: The amount of the reward.
    #
    # Returns
    # ----------------
    # None.
    def voted(self, epoch_id, commit_result, reveal_result, deposited,
              reclaimed, rewarded):
        if epoch_id not in self.vote_logs:
            self.epoch_logs[epoch_id] = Logging.EpochLog()
            self.vote_logs[epoch_id] = Logging.VoteLog()
            self.bond_logs[epoch_id] = Logging.BondLog()
            
        if commit_result:
            self.vote_logs[epoch_id].commit_succeeded += 1
        else:
            self.vote_logs[epoch_id].commit_failed += 1
        if reveal_result:
            self.vote_logs[epoch_id].reveal_succeeded += 1
        else:
            self.vote_logs[epoch_id].reveal_failed += 1
        if reclaimed > 0:
            self.vote_logs[epoch_id].reclaim_succeeded += 1
        if rewarded > 0:
            self.vote_logs[epoch_id].reward_succeeded += 1
        self.vote_logs[epoch_id].deposited += deposited
        self.vote_logs[epoch_id].reclaimed += reclaimed
        self.vote_logs[epoch_id].rewarded += rewarded

    # Called when ACB.purchase_bonds is called.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |count|: The number of purchased bonds.
    #
    # Returns
    # ----------------
    # None.
    def purchased_bonds(self, epoch_id, count):
        if epoch_id not in self.bond_logs:
            self.epoch_logs[epoch_id] = Logging.EpochLog()
            self.vote_logs[epoch_id] = Logging.VoteLog()
            self.bond_logs[epoch_id] = Logging.BondLog()
            
        self.bond_logs[epoch_id].purchased_bonds += count

    # Called when ACB.redeem_bonds is called.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |count_valid|: The number of redeemded bonds.
    # |count_expired|: The number of expired bonds.
    #
    # Returns
    # ----------------
    # None.
    def redeemed_bonds(self, epoch_id, count_valid, count_expired):
        if epoch_id not in self.bond_logs:
            self.epoch_logs[epoch_id] = Logging.EpochLog()
            self.vote_logs[epoch_id] = Logging.VoteLog()
            self.bond_logs[epoch_id] = Logging.BondLog()
            
        self.bond_logs[epoch_id].redeemed_bonds += count_valid
        self.bond_logs[epoch_id].expired_bonds += count_expired


#-------------------------------------------------------------------------------
# [ACB contract]
#
# The ACB stabilizes the coin price with algorithmically defined monetary
# policies without holding any collateral. The ACB stabilizes the JLC / USD
# exchange rate to 1.0 as follows:
#
# 1. The ACB obtains the exchange rate from the oracle.
# 2. If the exchange rate is 1.0, the ACB does nothing.
# 3. If the exchange rate is larger than 1.0, the ACB increases the total coin
#    supply by redeeming issued bonds (regardless of their redemption dates).
#    If that is not enough to supply sufficient coins, the ACB mints new coins
#    and provides the coins to the oracle as a reward.
# 4. If the exchange rate is smaller than 1.0, the ACB decreases the total coin
#    supply by issuing new bonds.
#-------------------------------------------------------------------------------

class ACB:
    NULL_HASH = 0

    # Constructor.
    #
    # Parameters
    # ----------------
    # |coin|: The JohnLawCoin contract.
    # |bond|: The JohnLawBond contract.
    # |oracle|: The Oracle contract.
    # |logging|: The Logging contract.
    def __init__(self, coin, bond, oracle, logging):
        # ----------------
        # Constants
        # ----------------

        # The following table shows the mapping from the oracle level to the
        # exchange rate. Voters can vote for one of the oracle levels.
        #
        # -----------------------------------
        # | oracle level | exchange rate    |
        # |              |                  |
        # -----------------------------------
        # |             0| 1 coin = 0.6 USD |
        # |             1| 1 coin = 0.7 USD |
        # |             2| 1 coin = 0.8 USD |
        # |             3| 1 coin = 0.9 USD |
        # |             4| 1 coin = 1.0 USD |
        # |             5| 1 coin = 1.1 USD |
        # |             6| 1 coin = 1.2 USD |
        # |             7| 1 coin = 1.3 USD |
        # |             8| 1 coin = 1.4 USD |
        # -----------------------------------
        #
        # Voters are expected to look up the current exchange rate using
        # real-world currency exchangers and vote for the oracle level that
        # corresponds to the exchange rate. Strictly speaking, the current
        # exchange rate is defined as the exchange rate at the point when the
        # current phase started (i.e., current_epoch_start_).
        #
        # In the bootstrap phase in which no currency exchanger supports JLC
        # <=> USD conversions, voters are expected to vote for the oracle
        # level 5 (i.e., 1 coin = 1.1 USD). This helps increase the total coin
        # supply gradually in the bootstrap phase and incentivize early
        # adopters. Once currency exchangers support the conversions, voters
        # are expected to vote for the oracle level that corresponds to the
        # real-world exchange rate.
        #
        # LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
        # exchange rates. The real exchange rate is obtained by dividing the
        # values by EXCHANGE_RATE_DIVISOR. For example, 11 corresponds to the
        # exchange rate of 1.1. This translation is needed to avoid using
        # float numbers in Solidity.
        ACB.LEVEL_TO_EXCHANGE_RATE = [6, 7, 8, 9, 10, 11, 12, 13, 14]
        ACB.EXCHANGE_RATE_DIVISOR = 10

        # The bond structure.
        #
        # |<---BOND_REDEMPTION_PERIOD--->|<---BOND_REDEEMABLE_PERIOD--->|
        # ^                              ^                              ^
        # Issued                         Becomes redeemable             Expired
        #
        # During BOND_REDEMPTION_PERIOD, the bonds are redeemable as long as the
        # ACB's bond budget is negative. During BOND_REDEEMABLE_PERIOD, the
        # bonds are redeemable regardless of the ACB's bond budget. After
        # BOND_REDEEMABLE_PERIOD, the bonds are expired.
        ACB.BOND_PRICE = 996 # One bond is sold for 996 coins.
        ACB.BOND_REDEMPTION_PRICE = 1000 # One bond is redeemed for 1000 coins.
        ACB.BOND_REDEMPTION_PERIOD = 12 # 12 epochs.
        ACB.BOND_REDEEMABLE_PERIOD = 2 # 2 epochs.

        # The duration of the oracle phase. The ACB adjusts the total coin
        # supply once per phase. Voters can vote once per phase.
        ACB.EPOCH_DURATION = 7 * 24 * 60 * 60 # 1 week.

        # The percentage of the coin balance voters need to deposit.
        ACB.DEPOSIT_RATE = 10 # 10%.

        # A damping factor to avoid minting or burning too many coins in one
        # phase.
        ACB.DAMPING_FACTOR = 10 # 10%.

        # ----------------
        # Attributes
        # ----------------

        # The JohnLawCoin contract.
        #
        # Note that 10000000 coins (corresponding to 10 M USD) are given to the
        # genesis account initially. This is important to make sure that the
        # genesis account can have power to determine the exchange rate until
        # the ecosystem stabilizes. Once real-world currency exchangers start
        # converting JLC with USD and the oracle gets a sufficient number of
        # honest voters to agree on the real-world exchange rate consistently,
        # the genesis account can lose its power by decreasing its coin balance.
        # This mechanism is mandatory to stabilize the exchange rate and
        # bootstrap the ecosystem successfully.
        #
        # Specifically, the genesis account votes for the oracle level 5 until
        # real-world currency exchangers appear. Once real-world currency
        # exchangers appear, the genesis account votes for the oracle level
        # corresponding to the real-world exchange rate. Other voters are
        # expected to follow the genesis account. Once the oracle gets enough
        # honest voters, the genesis account decreases its coin balance and
        # loses its power, moving the oracle to a fully decentralized system.
        self.coin = coin

        # The JohnLawBond contract.
        self.bond = bond

        # If |bond_budget| is positive, it indicates the number of bonds the ACB
        # can issue to decrease the total coin supply. If |bond_budget| is
        # negative, it indicates the number of bonds the ACB can redeem to
        # increase the total coin supply.
        self.bond_budget = 0

        # The current timestamp.
        self.timestamp = 0

        # The timestamp when the current epoch started.
        self.current_epoch_start = self.get_timestamp()

        # The oracle contract.
        self.oracle = oracle

        # The current oracle level.
        self.oracle_level = Oracle.LEVEL_MAX

        # The logging contract.
        self.logging = logging

        assert(len(ACB.LEVEL_TO_EXCHANGE_RATE) == Oracle.LEVEL_MAX)

    # Test only.
    def override_constants_for_testing(
        self, bond_price, bond_redemption_price, bond_redemption_period,
        bond_redeemable_period, epoch_duration, deposit_rate, damping_factor,
        level_to_exchange_rate):

        ACB.BOND_PRICE = bond_price
        ACB.BOND_REDEMPTION_PRICE = bond_redemption_price
        ACB.BOND_REDEMPTION_PERIOD = bond_redemption_period
        ACB.BOND_REDEEMABLE_PERIOD = bond_redeemable_period
        ACB.EPOCH_DURATION = epoch_duration
        ACB.DEPOSIT_RATE = deposit_rate
        ACB.DAMPING_FACTOR = damping_factor
        ACB.LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate

        assert(1 <= ACB.BOND_PRICE and
               ACB.BOND_PRICE <= ACB.BOND_REDEMPTION_PRICE)
        assert(1 <= ACB.BOND_REDEMPTION_PRICE and
               ACB.BOND_REDEMPTION_PRICE <= 100000)
        assert(1 <= ACB.BOND_REDEMPTION_PERIOD and
               ACB.BOND_REDEMPTION_PERIOD <= 100)
        assert(1 <= ACB.BOND_REDEEMABLE_PERIOD and
               ACB.BOND_REDEEMABLE_PERIOD <= 100)
        assert(1 <= ACB.EPOCH_DURATION and
               ACB.EPOCH_DURATION <= 30 * 24 * 60 * 60)
        assert(0 <= ACB.DEPOSIT_RATE and ACB.DEPOSIT_RATE <= 100)
        assert(1 <= ACB.DAMPING_FACTOR and ACB.DAMPING_FACTOR <= 100)
        assert(len(ACB.LEVEL_TO_EXCHANGE_RATE) == Oracle.LEVEL_MAX)

        self.oracle_level = Oracle.LEVEL_MAX

    # Vote for the exchange rate. The voter can commit a vote to the current
    # phase, reveal their vote in the previous phase, and reclaim the deposited
    # coins and get a reward for their vote in the phase before the previous
    # phase at the same time.
    #
    # Parameters
    # ----------------
    # |hash|: The hash to be committed in the current phase. Specify
    # ACB.NULL_HASH if you do not want to commit and only want to reveal and
    # reclaim previous votes.
    # |oracle_level|: The oracle level you voted for in the previous phase.
    # |salt|: The salt you used in the previous phase.
    #
    # Returns
    # ----------------
    # A tuple of six values:
    #  - boolean: Whether the commit succeeded or not.
    #  - boolean: Whether the reveal succeeded or not.
    #  - uint: The amount of the deposited coins.
    #  - uint: The amount of the reclaimed coins.
    #  - uint: The amount of the reward.
    #  - boolean: Whether this vote resulted in a phase update.
    def vote(self, sender, hash, oracle_level, salt):
        epoch_updated = False
        timestamp = self.get_timestamp()
        if timestamp >= self.current_epoch_start + ACB.EPOCH_DURATION:
            # Start a new phase.
            epoch_updated = True
            self.current_epoch_start = timestamp

            delta = 0
            self.oracle_level = self.oracle.get_mode_level()
            if self.oracle_level != Oracle.LEVEL_MAX:
                assert(0 <= self.oracle_level and
                       self.oracle_level < Oracle.LEVEL_MAX)
                # Translate the oracle level to the exchange rate.
                exchange_rate = ACB.LEVEL_TO_EXCHANGE_RATE[self.oracle_level]

                # Calculate the amount of coins to be minted or burned based on
                # the Quantum Theory of Money. If the exchange rate is 1.1
                # (i.e., 1 coin = 1.1 USD), the total coin supply is increased
                # by 10%. If the exchange rate is 0.8 (i.e., 1 coin = 0.8 USD),
                # the total coin supply is decreased by 20%.
                delta = int(self.coin.total_supply *
                            (exchange_rate - ACB.EXCHANGE_RATE_DIVISOR) /
                            ACB.EXCHANGE_RATE_DIVISOR)

                # To avoid increasing or decreasing too many coins in one phase,
                # multiply the damping factor.
                delta = int(delta * ACB.DAMPING_FACTOR / 100)

            # Advance to the next phase. Provide the |tax| coins to the oracle
            # as a reward.
            tax = self.coin.balance_of(self.coin.tax_account)
            burned = self.oracle.advance(self.coin)
            
            # Reset the tax account address just in case.
            self.coin.reset_tax_account()
            assert(self.coin.balance_of(self.coin.tax_account) == 0)

            # Increase or decrease the total coin supply.
            mint = self._control_supply(delta)

            self.logging.epoch_updated(
                self.oracle.epoch_id, mint, burned, delta, self.bond_budget,
                self.coin.total_supply, self.bond.total_supply,
                self.valid_bond_supply(), self.oracle_level,
                self.current_epoch_start, tax)

        # Commit.
        #
        # The voter needs to deposit the DEPOSIT_RATE percentage of their coin
        # balance.
        deposited = int(self.coin.balance_of(sender) * ACB.DEPOSIT_RATE / 100)
        if hash == ACB.NULL_HASH:
            deposited = 0
        assert(deposited >= 0)
        commit_result = self.oracle.commit(self.coin, sender, hash, deposited)
        if not commit_result:
            deposited = 0

        # Reveal.
        reveal_result = self.oracle.reveal(sender, oracle_level, salt)

        # Reclaim.
        (reclaimed, rewarded) = self.oracle.reclaim(self.coin, sender)

        self.logging.voted(
            self.oracle.epoch_id, commit_result, reveal_result,
            deposited, reclaimed, rewarded)
        return (commit_result, reveal_result, deposited, reclaimed, rewarded,
                epoch_updated)

    # Purchase bonds.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |count|: The number of bonds to purchase.
    #
    # Returns
    # ----------------
    # The redemption epoch of the purchased bonds if it succeeds.
    # 0 otherwise.
    def purchase_bonds(self, sender, count):
        # The user must purchase at least one bond.
        assert(count > 0)
        # The ACB does not have enough bonds to issue.
        assert(self.bond_budget >= count)

        amount = ACB.BOND_PRICE * count
        # The user does not have enough coins to purchase the bonds.
        assert(self.coin.balance_of(sender) >= amount)

        # Set the redemption epoch of the bonds.
        redemption_epoch = self.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD

        # Issue new bonds.
        self.bond.mint(sender, redemption_epoch, count)
        self.bond_budget -= count
        assert(self.bond_budget >= 0)
        assert(self.valid_bond_supply() + self.bond_budget >= 0)
        assert(self.bond.balance_of(sender, redemption_epoch) > 0)

        # Burn the corresponding coins.
        self.coin.burn(sender, amount)

        self.logging.purchased_bonds(self.oracle.epoch_id, count)
        return redemption_epoch

    # Redeem bonds.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |redemption_epochs|: An array of bonds to be redeemed. Bonds are
    # identified by their redemption epochs.
    #
    # Returns
    # ----------------
    # The number of successfully redeemed bonds.
    def redeem_bonds(self, sender, redemption_epochs):
        count_valid = 0
        count_expired = 0
        for redemption_epoch in redemption_epochs:
            count = self.bond.balance_of(sender, redemption_epoch)
            if self.oracle.epoch_id < redemption_epoch:
                # If the bonds have not yet hit their redemption epoch, the
                # ACB accepts the redemption as long as |self.bond_budget| is
                # negative.
                if self.bond_budget >= 0:
                    continue
                if count > -self.bond_budget:
                    count = -self.bond_budget

            if (self.oracle.epoch_id <
                redemption_epoch + ACB.BOND_REDEEMABLE_PERIOD):
                # If the bonds are not expired, mint the corresponding coins
                # to the user account.
                amount = count * ACB.BOND_REDEMPTION_PRICE
                self.coin.mint(sender, amount)

                # Burn the redeemed bonds.
                self.bond_budget += count
                count_valid += count
            else:
                count_expired += count

            self.bond.burn(sender, redemption_epoch, count)

        assert(self.valid_bond_supply() + self.bond_budget >= 0)

        self.logging.redeemed_bonds(
            self.oracle.epoch_id, count_valid, count_expired)
        return count_valid

    # Increase or decrease the total coin supply.
    #
    # Parameters
    # ----------------
    # |delta|: The target increase or decrease to the total coin supply.
    #
    # Returns
    # ----------------
    # The amount of coins that need to be newly minted by the ACB.
    def _control_supply(self, delta):
        mint = 0
        bond_supply = self.valid_bond_supply()
        if delta == 0:
            # No change in the total coin supply.
            self.bond_budget = 0
        elif delta > 0:
            # Increase the total coin supply.
            count = int(delta / ACB.BOND_REDEMPTION_PRICE)
            if count <= bond_supply:
                # If there are sufficient bonds to redeem, increase the total
                # coin supply by redeeming bonds.
                self.bond_budget = -count
            else:
                # Otherwise, redeem all the issued bonds.
                self.bond_budget = -bond_supply
                # The ACB needs to mint the remaining coins.
                mint = ((count - bond_supply) *
                        ACB.BOND_REDEMPTION_PRICE)
            assert(self.bond_budget <= 0)
        else:
            assert(delta < 0)
            # Issue new bonds to decrease the total coin supply.
            self.bond_budget = int(-delta / ACB.BOND_PRICE)
            assert(self.bond_budget >= 0)

        assert(bond_supply + self.bond_budget >= 0)
        assert(mint >= 0)
        return mint

    # Return the valid bond supply; i.e., the total supply of bonds that are
    # not yet expired.
    def valid_bond_supply(self):
        count = 0
        for redemption_epoch in range(
                max(self.oracle.epoch_id - ACB.BOND_REDEEMABLE_PERIOD + 1, 0),
                self.oracle.epoch_id + ACB.BOND_REDEMPTION_PERIOD + 1):
            count += self.bond.bond_supply_at(redemption_epoch)
        return count

    # Return the current timestamp in seconds.
    def get_timestamp(self):
        return self.timestamp

    # Set the current timestamp in seconds to |timestamp|.
    def set_timestamp(self, timestamp):
        assert(timestamp > self.timestamp)
        self.timestamp = timestamp
