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
# JohnLawCoin is a non-collateralized stablecoin realized by an Algorithmic
# Central Bank (ACB). The system is fully decentralized and there is truly
# no gatekeeper. No gatekeeper means there is no entity to be regulated.
#
# JohnLawCoin is a real-world experiment to verify one assumption: There is
# a way to stabilize the currency price with algorithmically defined monetary
# policies without holding any collateral like USD.
#
# If JohnLawCoin is successful and proves the assumption is correct, it will
# provide interesting insights for both non-fiat cryptocurrencies and fiat
# currencies; i.e., 1) non-fiat cryptocurrencies can use the algorithm to
# implement a stablecoin without having any gatekeeper that holds collateral,
# and 2) real-world central banks of developing countries can use the
# algorithm to implement a fixed exchange rate system for their fiat
# currencies without holding adequate USD reserves. This will upgrade
# human's understanding about money.
#
# JohnLawCoin has the following important properties:
#
# - There is truly no gatekeeper. The ACB is fully automated and no one
#   (including the author of the smart contracts) has the privilege of
#   influencing the monetary policies of the ACB. This can be verified by the
#   fact that the smart contracts have no operations that need privileged
#   permissions.
# - The smart contracts are self-contained. There are no dependencies on other
#   smart contracts and external services.
# - All operations are guaranteed to terminate with the time complexity of
#   O(1). The time complexity of each operation is determined solely by the
#   input size of the operation and not affected by the state of the smart
#   contracts.
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
    #
    # Parameters
    # ----------------
    # |account|: The receiver account.
    # |amount|: The amount to be transferred.
    #
    # Returns
    # ----------------
    # None.
    def transfer(self, sender, receiver, amount):
        assert(sender in self.balances)
        assert(self.balances[sender] >= amount)
        tax = int(amount * JohnLawCoin.TAX_RATE / 100)
        self.move(sender, self.tax_account, tax)
        self.move(sender, receiver, amount - tax)


#------------------------------------------------------------------------------
# [JohnLawBond contract]
#
# JohnLawBond is an implementation of the bonds to increase / decrease the
# total coin supply. The bonds are not transferable.
#------------------------------------------------------------------------------
class JohnLawBond:
    # Constructor.
    def __init__(self):
        # _bonds[account][redemption_epoch] stores the number of the
        # bonds owned by the |account| that become redeemable at
        # |redemption_epoch|.
        self.bonds = {}

        # _redemption_epochs[account] is a set of the redemption epochs of the
        # bonds owned by the |account|.
        self.redemption_epochs = {}

        # _bond_count[account] is the number of the bonds owned by the
        # |account|.
        self.bond_count = {}

        # _bond_supply[redemption_epoch] is the total number of the bonds that
        # become redeemable at |redemption_epoch|.
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

    # Public getter: Return the number of the bonds owned by the |account|.
    def number_of_bonds_owned_by(self, account):
        if account not in self.bond_count:
            return 0
        return self.bond_count[account]

    # Public getter: Return the number of redemption epochs of the bonds owned
    # by the |account|.
    def number_of_redemption_epochs_owned_by(self, account):
        if account not in self.redemption_epochs:
            return 0
        return len(self.redemption_epochs[account])

    # Public getter: Return the |index|-th redemption epoch of the bonds owned
    # by the |account|. |index| must be smaller than the value returned by
    # numberOfRedemptionEpochsOwnedBy(account).
    def get_redemption_epoch_owned_by(self, account, index):
        assert(0 <= index and
               index < self.number_of_redemption_epochs_owned_by(account))
        return list(self.redemption_epochs[account].keys())[index]

    # Public getter: Return the number of the bonds owned by the |account| that
    # become redeemable at |redemption_epoch|.
    def balance_of(self, account, redemption_epoch):
        if account not in self.bonds:
            return 0
        if redemption_epoch not in self.bonds[account]:
            return 0
        return self.bonds[account][redemption_epoch]

    # Public getter: Return the number of the bonds that become redeemable at
    # |redemption_epoch|.
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

    # Vote is a struct to aggregate voting statistics for each oracle level.
    # The data is aggregated during the reveal phase and finalized at the end
    # of the reveal phase.
    class Vote:
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

    # Epoch is a struct to keep track of the states in the commit-reveal-reclaim
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

        # The lost coins and the collected tax are distributed to the voters who
        # voted for the "truth" level as a reward. The PROPORTIONAL_REWARD_RATE
        # of the reward is distributed to the voters in proportion to the coins
        # they deposited. The rest of the reward is distributed to the voters
        # evenly.
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
    # |sender|: The voter's account.
    # |hash|: The committed hash.
    # |deposit|: The amount of the deposited coins.
    # |coin|: The JohnLawCoin contract.
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
        reveal_hash = self.encrypt(sender, oracle_level, salt)
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
    # |sender|: The voter's account.
    # |coin|: The JohnLawCoin contract.
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
            # incentivizes voters who have more coins (and thus have more power
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
    # |coin|: The JohnLawCoin contract.
    #
    # Returns
    # ----------------
    # None.
    def advance(self, coin):
        # Advance the phase.
        self.epoch_id += 1
        
        # Step 1: Move the commit phase to the reveal phase.
        epoch = self.epochs[(self.epoch_id - 1) % 3]
        assert(epoch.phase == Oracle.Phase.COMMIT)
        epoch.phase = Oracle.Phase.REVEAL

        # Step 2: Move the reveal phase to the reclaim phase.
        epoch = self.epochs[(self.epoch_id - 2) % 3]
        assert(epoch.phase == Oracle.Phase.REVEAL)
        epoch.phase = Oracle.Phase.RECLAIM

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

        # Step 3: Move the reclaim phase to the commit phase.
        epoch_index = self.epoch_id % 3
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
        epoch = self.epochs[(self.epoch_id - 2) % 3]
        assert(epoch.phase == Oracle.Phase.RECLAIM)
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
    def encrypt(self, sender, level, salt):
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

    # A struct to record metrics about Epoch.
    class EpochLog:
      def __init__(self):
          self.minted_coins = 0
          self.burned_coins = 0
          self.coin_supply_delta = 0
          self.total_coin_supply = 0
          self.oracle_level = 0
          self.current_epoch_start = 0
          self.tax = 0

    # A struct to record metrics about BondOperation.
    class BondOperationLog:
      def __init__(self):
          self.bond_budget = 0
          self.total_bond_supply = 0
          self.valid_bond_supply = 0
          self.purchased_bonds = 0
          self.redeemed_bonds = 0
          self.expired_bonds = 0

    # A struct to record metrics about OpenMarketOperation.
    class OpenMarketOperationLog:
      def __init__(self):
          self.coin_budget = 0
          self.exchanged_coins = 0
          self.exchanged_eth = 0
          self.eth_balance = 0
          self.latest_price = 0
    
    # Constructor.
    def __init__(self):
        # Logs about voting.
        self.vote_logs = {}

        # Logs about Epoch.
        self.epoch_logs = {}

        # Logs about BondOperation.
        self.bond_operation_logs = {}

        # Logs about OpenMarketOperation.
        self.open_market_operation_logs = {}

    # Python only.
    def ensure_logs(self, epoch_id):
        if epoch_id not in self.epoch_logs:
            self.epoch_logs[epoch_id] = Logging.EpochLog()
            self.vote_logs[epoch_id] = Logging.VoteLog()
            self.bond_operation_logs[epoch_id] = Logging.BondOperationLog()
            self.open_market_operation_logs[
                epoch_id] = Logging.OpenMarketOperationLog()
        
    # Called when the epoch is updated.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |minted|: The amount of the minted coins.
    # |burned|: The amount of the burned coins.
    # |delta|: The delta of the total coin supply.
    # |total_coin_supply|: The total coin supply.
    # |oracle_level|: ACB.oracle_level_.
    # |current_epoch_start|: ACB.current_epoch_start_.
    # |tax|: The amount of the tax collected in the previous epoch.
    #
    # Returns
    # ----------------
    # None.
    def update_epoch(self, epoch_id, minted, burned, delta, total_coin_supply,
                     oracle_level, current_epoch_start, tax):
        self.ensure_logs(epoch_id)
        self.epoch_logs[epoch_id].minted_coins = minted
        self.epoch_logs[epoch_id].burned_coins = burned
        self.epoch_logs[epoch_id].coin_supply_delta = delta
        self.epoch_logs[epoch_id].total_coin_supply = total_coin_supply
        self.epoch_logs[epoch_id].oracle_level = oracle_level
        self.epoch_logs[epoch_id].current_epoch_start = current_epoch_start
        self.epoch_logs[epoch_id].tax = tax

    # Called when BondOperation's bond budget is updated at the beginning of
    # the epoch.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |bond_budget|: The bond budget.
    # |total_bond_supply|: The total bond supply.
    # |valid_bond_supply|: The valid bond supply.
    #
    # Returns
    # ----------------
    # None.
    def update_bond_budget(self, epoch_id, bond_budget, total_bond_supply,
                           valid_bond_supply):
        self.ensure_logs(epoch_id)
        self.bond_operation_logs[epoch_id].bond_budget = bond_budget
        self.bond_operation_logs[epoch_id].total_bond_supply = total_bond_supply
        self.bond_operation_logs[epoch_id].valid_bond_supply = valid_bond_supply
        self.bond_operation_logs[epoch_id].purchased_bonds = 0
        self.bond_operation_logs[epoch_id].redeemed_bonds = 0
        self.bond_operation_logs[epoch_id].expired_bonds = 0

    # Called when OpenMarketOperation's coin budget is updated at the beginning
    # of the epoch.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |coin_budget|: The coin budget.
    # |eth_balance|: The ETH balance in the EthPool.
    # |latest_price|: The latest ETH / JLC price.
    #
    # Returns
    # ----------------
    # None.
    def update_coin_budget(self, epoch_id, coin_budget,
                           eth_balance, latest_price):
        self.ensure_logs(epoch_id)
        self.open_market_operation_logs[epoch_id].coin_budget = coin_budget
        self.open_market_operation_logs[epoch_id].exchanged_coins = 0
        self.open_market_operation_logs[epoch_id].exchanged_eth = 0
        self.open_market_operation_logs[epoch_id].eth_balance = eth_balance
        self.open_market_operation_logs[epoch_id].latest_price = latest_price

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
    def vote(self, epoch_id, commit_result, reveal_result, deposited,
             reclaimed, rewarded):
        self.ensure_logs(epoch_id)
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

    # Called when ACB.purchaseBonds is called.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |purchased_bonds|: The number of purchased bonds.
    #
    # Returns
    # ----------------
    # None.
    def purchase_bonds(self, epoch_id, purchased_bonds):
        self.ensure_logs(epoch_id)
        self.bond_operation_logs[epoch_id].purchased_bonds += purchased_bonds

    # Called when ACB.redeemBonds is called.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |redeemed_bonds|: The number of redeemded bonds.
    # |expired_bonds|: The number of expired bonds.
    #
    # Returns
    # ----------------
    # None.
    def redeem_bonds(self, epoch_id, redeemed_bonds, expired_bonds):
        self.ensure_logs(epoch_id)
        self.bond_operation_logs[epoch_id].redeemed_bonds += redeemed_bonds
        self.bond_operation_logs[epoch_id].expired_bonds += expired_bonds

    # Called when ACB.purchaseCoins is called.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |eth_amount|: The amount of ETH exchanged.
    # |coin_amount|: The amount of JLC exchanged.
    #
    # Returns
    # ----------------
    # None.
    def purchase_coins(self, epoch_id, eth_amount, coin_amount):
        self.ensure_logs(epoch_id)
        self.open_market_operation_logs[epoch_id].exchanged_eth += eth_amount
        self.open_market_operation_logs[
            epoch_id].exchanged_coins += coin_amount

    # Called when ACB.sell_coins is called.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The epoch ID.
    # |eth_amount|: The amount of ETH exchanged.
    # |coin_amount|: The amount of JLC exchanged.
    #
    # Returns
    # ----------------
    # None.
    def sell_coins(self, epoch_id, eth_amount, coin_amount):
        self.ensure_logs(epoch_id)
        self.open_market_operation_logs[epoch_id].exchanged_eth -= eth_amount
        self.open_market_operation_logs[
            epoch_id].exchanged_coins -= coin_amount

#-------------------------------------------------------------------------------
# [BondOperation contract]
#
# The BondOperation contract increases / decreases the total coin supply by
# redeeming / issuing bonds. The bond budget is updated by the ACB every epoch.
#-------------------------------------------------------------------------------
class BondOperation:
    
    # Constructor.
    #
    # Parameters
    # ----------------
    # |bond|: The JohnLawBond contract.
    def __init__(self, bond):
        # ----------------
        # Constants
        # ----------------
        
        # The bond structure.
        #
        # |<---BOND_REDEMPTION_PERIOD--->|<---BOND_REDEEMABLE_PERIOD--->|
        # ^                              ^                              ^
        # Issued                         Becomes redeemable             Expired
        #
        # During BOND_REDEMPTION_PERIOD, the bonds are redeemable as long as the
        # bond budget is negative. During BOND_REDEEMABLE_PERIOD, the bonds are
        # redeemable regardless of the bond budget. After
        # BOND_REDEEMABLE_PERIOD, the bonds are expired.
        #
        # One bond is sold for 996 coins.
        BondOperation.BOND_PRICE = 996
        # One bond is redeemed for 1000 coins.
        BondOperation.BOND_REDEMPTION_PRICE = 1000
        # 12 epochs.
        BondOperation.BOND_REDEMPTION_PERIOD = 12
        # 2 epochs.
        BondOperation.BOND_REDEEMABLE_PERIOD = 2

        # ----------------
        # Attributes
        # ----------------

        # The JohnLawBond contract.
        self.bond = bond

        # If |bond_budget| is positive, it indicates the number of bonds the ACB
        # can issue to decrease the total coin supply. If |bond_budget| is
        # negative, it indicates the number of bonds the ACB can redeem to
        # increase the total coin supply.
        self.bond_budget = 0

    # Test only.
    def override_constants_for_testing(
            self, bond_price, bond_redemption_price, bond_redemption_period,
            bond_redeemable_period):

        BondOperation.BOND_PRICE = bond_price
        BondOperation.BOND_REDEMPTION_PRICE = bond_redemption_price
        BondOperation.BOND_REDEMPTION_PERIOD = bond_redemption_period
        BondOperation.BOND_REDEEMABLE_PERIOD = bond_redeemable_period

        assert(1 <= BondOperation.BOND_PRICE and
               BondOperation.BOND_PRICE <= BondOperation.BOND_REDEMPTION_PRICE)
        assert(1 <= BondOperation.BOND_REDEMPTION_PRICE and
               BondOperation.BOND_REDEMPTION_PRICE <= 100000)
        assert(1 <= BondOperation.BOND_REDEMPTION_PERIOD and
               BondOperation.BOND_REDEMPTION_PERIOD <= 20)
        assert(1 <= BondOperation.BOND_REDEEMABLE_PERIOD and
               BondOperation.BOND_REDEEMABLE_PERIOD <= 20)
        
    # Increase the total bond supply by issuing bonds.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |count|: The number of bonds to issue.
    # |epoch_id|: The current epoch ID.
    # |coin|: The JohnLawCoin contract.
    #
    # Returns
    # ----------------
    # The redemption epoch of the issued bonds if it succeeds.
    # 0 otherwise.
    def increase_bond_supply(self, sender, count, epoch_id, coin):
        # The sender must purchase at least one bond.
        assert(count > 0)
        # The BondOperation does not have enough bonds to issue.
        assert(self.bond_budget >= count)

        amount = BondOperation.BOND_PRICE * count
        # The sender does not have enough coins to purchase the bonds.
        assert(coin.balance_of(sender) >= amount)

        # Set the redemption epoch of the bonds.
        redemption_epoch = epoch_id + BondOperation.BOND_REDEMPTION_PERIOD

        # Issue new bonds.
        self.bond.mint(sender, redemption_epoch, count)
        self.bond_budget -= count
        assert(self.bond_budget >= 0)
        assert(self.bond.balance_of(sender, redemption_epoch) > 0)

        # Burn the corresponding coins.
        coin.burn(sender, amount)
        return redemption_epoch

    # Decrease the total bond supply by redeeming bonds.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |redemption_epochs|: An array of bonds to be redeemed. The bonds are
    # identified by their redemption epochs.
    # |epoch_id|: The current epoch ID.
    # |coin|: The JohnLawCoin contract.
    #
    # Returns
    # ----------------
    # A tuple of two values:
    # - The number of redeemed bonds.
    # - The number of expired bonds.
    def decrease_bond_supply(self, sender, redemption_epochs, epoch_id, coin):
        redeemed_bonds = 0
        expired_bonds = 0
        for redemption_epoch in redemption_epochs:
            count = self.bond.balance_of(sender, redemption_epoch)
            if epoch_id < redemption_epoch:
                # If the bonds have not yet hit their redemption epoch, the
                # BondOperation accepts the redemption as long as
                # |self.bond_budget| is negative.
                if self.bond_budget >= 0:
                    continue
                if count > -self.bond_budget:
                    count = -self.bond_budget
                self.bond_budget += count

            if (epoch_id <
                redemption_epoch + BondOperation.BOND_REDEEMABLE_PERIOD):
                # If the bonds are not expired, mint the corresponding coins
                # to the sender account.
                amount = count * BondOperation.BOND_REDEMPTION_PRICE
                coin.mint(sender, amount)
                redeemed_bonds += count
            else:
                expired_bonds += count

            # Burn the redeemed / expired bonds.
            self.bond.burn(sender, redemption_epoch, count)

        return (redeemed_bonds, expired_bonds)

    # Update the bond budget to increase or decrease the total coin supply.
    #
    # Parameters
    # ----------------
    # |delta|: The target increase or decrease of the total coin supply.
    # |epoch_id|: The current epoch ID.
    #
    # Returns
    # ----------------
    # The amount of coins that cannot be increased by adjusting the bond budget
    # and thus need to be newly minted.
    def update_bond_budget(self, delta, epoch_id):
        mint = 0
        bond_supply = self.valid_bond_supply(epoch_id)
        if delta == 0:
            # No change in the total coin supply.
            self.bond_budget = 0
        elif delta > 0:
            # Increase the total coin supply.
            count = int(delta / BondOperation.BOND_REDEMPTION_PRICE)
            if count <= bond_supply:
                # If there are sufficient bonds to redeem, increase the total
                # coin supply by redeeming bonds.
                self.bond_budget = -count
            else:
                # Otherwise, redeem all the issued bonds.
                self.bond_budget = -bond_supply
                # The remaining coins need to be newly minted.
                mint = ((count - bond_supply) *
                        BondOperation.BOND_REDEMPTION_PRICE)
            assert(self.bond_budget <= 0)
        else:
            assert(delta < 0)
            # Issue new bonds to decrease the total coin supply.
            self.bond_budget = int(-delta / BondOperation.BOND_PRICE)
            assert(self.bond_budget >= 0)

        assert(bond_supply + self.bond_budget >= 0)
        assert(mint >= 0)
        return mint

    # Return the valid bond supply; i.e., the total supply of bonds that are
    # not yet expired.
    #
    # Parameters
    # ----------------
    # |epoch_id|: The current epoch ID.
    def valid_bond_supply(self, epoch_id):
        count = 0
        for redemption_epoch in range(
                max(epoch_id - BondOperation.BOND_REDEEMABLE_PERIOD + 1, 0),
                epoch_id + BondOperation.BOND_REDEMPTION_PERIOD + 1):
            count += self.bond.bond_supply_at(redemption_epoch)
        return count

    
#-------------------------------------------------------------------------------
# [OpenMarketOperation contract]
#
# The OpenMarketOperation contract increases / decreases the total coin supply
# by purchasing / selling ETH from the open market. The price between JLC and
# ETH is determined by a Dutch auction.
#-------------------------------------------------------------------------------
class OpenMarketOperation:

    # Initializer.
    def __init__(self):
        # Constants.
        
        # The price auction is implemented as a Dutch auction as follows:
        #
        # Let P be the latest price at which the open market operation exchanged
        # JLC with ETH. The price is measured by ETH wei / JLC. When the price
        # is P, it means 1 JLC is exchanged with P ETH wei.
        #
        # At the beginning of each epoch, the ACB sets the coin budget; i.e.,
        # the amount of JLC to be purchased / sold by the open market operation.
        #
        # When the open market operation increases the total coin supply,
        # the auction starts with the price of P * START_PRICE_MULTIPILER.
        # Then the price is decreased by PRICE_CHANGE_PERCENTAGE % every
        # PRICE_CHANGE_INTERVAL seconds. JLC and ETH are exchanged at the
        # given price (the open market operation sells JLC and purchases ETH).
        # The auction stops when the open market operation finished selling JLC
        # in the coin budget.
        #
        # When the open market operation decreases the total coin supply,
        # the auction starts with the price of P / START_PRICE_MULTIPILER.
        # Then the price is increased by PRICE_CHANGE_PERCENTAGE % every
        # PRICE_CHANGE_INTERVAL seconds. JLC and ETH are exchanged at the
        # given price (the open market operation sells ETH and purchases JLC).
        # The auction stops when the open market operation finished purchasing
        # JLC in the coin budget.
        OpenMarketOperation.PRICE_CHANGE_INTERVAL = 8 * 60 * 60 # 8 hours
        OpenMarketOperation.PRICE_CHANGE_PERCENTAGE = 15 # 15%
        OpenMarketOperation.START_PRICE_MULTIPILER = 3

        # Attributes.

        # The latest price at which the open market operation exchanged JLC
        # with ETH.
        self.latest_price = 1000000000000
        
        # The start price is updated at the beginning of each epoch.
        self.start_price = 0
        
        # The current ETH balance.
        self.eth_balance = 0
        
        # The current coin budget.
        self.coin_budget = 0

        # Python only: The actual ETH balance in the pool.
        self.actual_eth_balance = 0

    # Test only.
    def override_constants_for_testing(
            self, price_change_interval,
            price_change_percentage, start_price_multiplier):
        OpenMarketOperation.PRICE_CHANGE_INTERVAL = price_change_interval
        OpenMarketOperation.PRICE_CHANGE_PERCENTAGE = price_change_percentage
        OpenMarketOperation.START_PRICE_MULTIPILER = start_price_multiplier

        assert(1 <= OpenMarketOperation.PRICE_CHANGE_INTERVAL)
        assert(0 <= OpenMarketOperation.PRICE_CHANGE_PERCENTAGE and
               OpenMarketOperation.PRICE_CHANGE_PERCENTAGE <= 100)
        assert(1 <= OpenMarketOperation.START_PRICE_MULTIPILER)

    # Increase the total coin supply by purchasing ETH from the sender account.
    # This method returns the amount of JLC and ETH to be exchanged. The actual
    # change to the total coin supply and the ETH pool is made by the ACB.
    #
    # Parameters
    # ----------------
    # |requested_eth_amount|: The amount of ETH the sender is willing to pay.
    # |elapsed_time|: The elapsed seconds from the current epoch start.
    #
    # Returns
    # ----------------
    # A tuple of two values:
    # - The amount of ETH to be exchanged. This can be smaller than
    # |requested_eth_amount| when the open market operation does not have
    # enough coin budget.
    # - The amount of JLC to be exchanged.
    def increase_coin_supply(self, requested_eth_amount, elapsed_time):
        assert(self.coin_budget > 0)
        
        # Calculate the amount of JLC and ETH to be exchanged.
        price = self.get_current_price(elapsed_time)
        coin_amount = int(requested_eth_amount / price)
        if coin_amount > self.coin_budget:
            coin_amount = self.coin_budget
        eth_amount = coin_amount * price
        
        if coin_amount > 0:
            self.latest_price = price
        self.coin_budget -= coin_amount
        self.eth_balance += eth_amount
        assert(self.coin_budget >= 0)
        assert(eth_amount <= requested_eth_amount)
        return (eth_amount, coin_amount)

    # Decrease the total coin supply by selling ETH to the sender account.
    # This method returns the amount of JLC and ETH to be exchanged. The actual
    # change to the total coin supply and the ETH pool is made by the ACB.
    #
    # Parameters
    # ----------------
    # |requested_coin_amount|: The amount of JLC the sender is willing to pay.
    # |elapsed_time|: The elapsed seconds from the current epoch start.
    #
    # Returns
    # ----------------
    # A tuple of two values:
    # - The amount of ETH to be exchanged.
    # - The amount of JLC to be exchanged. This can be smaller than
    # |requested_coin_amount| when the open market operation does not have
    # enough ETH in the pool.
    def decrease_coin_supply(self, requested_coin_amount, elapsed_time):
        assert(self.coin_budget < 0)
        
        # Calculate the amount of JLC and ETH to be exchanged.
        price = self.get_current_price(elapsed_time)
        coin_amount = requested_coin_amount
        if coin_amount >= -self.coin_budget:
            coin_amount = -self.coin_budget
        eth_amount = int(coin_amount * price)
        if eth_amount >= self.eth_balance:
            eth_amount = self.eth_balance
        coin_amount = int(eth_amount / price)
        
        if coin_amount > 0:
            self.latest_price = price
        self.coin_budget += coin_amount
        self.eth_balance -= eth_amount
        assert(self.coin_budget <= 0)
        assert(coin_amount <= requested_coin_amount)
        return (eth_amount, coin_amount)

    # Return the current price in the Dutch auction.
    #
    # Parameters
    # ----------------
    # |elapsed_time|: The elapsed seconds from the current epoch start.
    #
    # Returns
    # ----------------
    # The current price.
    def get_current_price(self, elapsed_time):
        if self.coin_budget > 0:
            price = self.start_price
            finish_price = int(
                self.start_price / (
                    OpenMarketOperation.START_PRICE_MULTIPILER *
                    OpenMarketOperation.START_PRICE_MULTIPILER))
            for i in range(int(elapsed_time /
                               OpenMarketOperation.PRICE_CHANGE_INTERVAL)):
                if i > 100 or price < finish_price:
                    break
                price = int(price * (
                    100 - OpenMarketOperation.PRICE_CHANGE_PERCENTAGE) / 100)
            if price == 0:
                price = 1
            return price
        if self.coin_budget < 0:
            price = self.start_price
            finish_price = self.start_price * (
                    OpenMarketOperation.START_PRICE_MULTIPILER *
                    OpenMarketOperation.START_PRICE_MULTIPILER)
            for i in range(int(elapsed_time /
                               OpenMarketOperation.PRICE_CHANGE_INTERVAL)):
                if i > 100 or price > finish_price:
                    break
                price = int(price * (
                    100 + OpenMarketOperation.PRICE_CHANGE_PERCENTAGE) / 100)
            return price
        return 0
    
    # Update the coin budget. The coin budget indicates how many coins should
    # be added to / removed from the total coin supply; i.e., the amount of JLC
    # to be sold / purchased by the open market operation. The ACB calls the
    # method at the beginning of each epoch.
    #
    # Parameters
    # ----------------
    # |coin_budget|: The coin budget.
    #
    # Returns
    # ----------------
    # None.
    def update_coin_budget(self, coin_budget):
        self.coin_budget = coin_budget
        assert(self.latest_price > 0)
        if self.coin_budget > 0:
            self.start_price = (
                self.latest_price *
                OpenMarketOperation.START_PRICE_MULTIPILER)
            assert(self.start_price > 0)
        elif self.coin_budget == 0:
            self.start_price = 0
        else:
            self.start_price = int(
                self.latest_price /
                OpenMarketOperation.START_PRICE_MULTIPILER)
            if self.start_price == 0:
                self.start_price = 1
            assert(self.start_price > 0)

        
#-------------------------------------------------------------------------------
# [EthPool contract]
#
# The EthPool contract stores ETH for the open market operation.
#-------------------------------------------------------------------------------
class EthPool:
    
    # Initializer.
    def __init__(self):
        self.eth_balance = 0

    # Increase ETH.
    def increase_eth(self, eth_amount):
        self.eth_balance += eth_amount

    # Decrease |eth_amount| ETH and send it to the |receiver|.
    def decrease_eth(self, receiver, eth_amount):
        assert(self.eth_balance >= eth_amount)
        self.eth_balance -= eth_amount
    

#------------------------------------------------------------------------------
# [ACB contract]
#
# The ACB stabilizes the USD / JLC exchange rate to 1.0 with algorithmically
# defined monetary policies:
#
# 1. The ACB obtains the exchange rate from the oracle.
# 2. If the exchange rate is 1.0, the ACB does nothing.
# 3. If the exchange rate is higher than 1.0, the ACB increases the total coin
#    supply by redeeming issued bonds (regardless of their redemption dates).
#    If that is not enough to supply sufficient coins, the ACB performs an open
#    market operation to sell JLC and purchase ETH to increase the total coin
#    supply.
# 4. If the exchange rate is lower than 1.0, the ACB decreases the total coin
#    supply by issuing new bonds. If the exchange rate drops down to 0.6, the
#    ACB performs an open market operation to sell ETH and purchase JLC to
#    decrease the total coin supply.
#
# Permission: All the methods are public. No one (including the genesis
# account) is privileged to influence the monetary policies of the ACB. The ACB
# is fully decentralized and there is truly no gatekeeper. The only exceptions
# are a few methods the genesis account may use to upgrade the smart contracts
# to fix bugs during a development phase.
#------------------------------------------------------------------------------
class ACB:
    NULL_HASH = 0

    # Initializer.
    #
    # Parameters
    # ----------------
    # |coin|: The JohnLawCoin contract.
    # |oracle|: The Oracle contract.
    # |bond_operation|: The BondOperation contract.
    # |open_market_operation|: The OpenMarketOperation contract.
    # |eth_pool|: The EthPool contract.
    # |logging|: The Logging contract.
    def __init__(self, coin, oracle, bond_operation,
                 open_market_operation, eth_pool, logging):
        # ----------------
        # Constants
        # ----------------

        # The following table shows the mapping from the oracle level to the
        # exchange rate. Voters can vote for one of the oracle levels.
        #
        # ----------------------------------
        # | oracle level | exchange rate   |
        # ----------------------------------
        # |            0 | 1 JLC = 0.6 USD |
        # |            1 | 1 JLC = 0.7 USD |
        # |            2 | 1 JLC = 0.8 USD |
        # |            3 | 1 JLC = 0.9 USD |
        # |            4 | 1 JLC = 1.0 USD |
        # |            5 | 1 JLC = 1.1 USD |
        # |            6 | 1 JLC = 1.2 USD |
        # |            7 | 1 JLC = 1.3 USD |
        # |            8 | 1 JLC = 1.4 USD |
        # ----------------------------------
        #
        # Voters are expected to look up the current exchange rate using
        # real-world currency exchangers and vote for the oracle level that
        # is closest to the current exchange rate. Strictly speaking, the
        # current exchange rate is defined as the exchange rate at the point
        # when the current epoch started (i.e., current_epoch_start_).
        #
        # In the bootstrap phase where no currency exchanger supports JLC <->
        # USD conversion, voters are expected to vote for the oracle level 5
        # (i.e., 1 JLC = 1.1 USD). This helps increase the total coin supply
        # gradually and incentivize early adopters in the bootstrap phase. Once
        # a currency exchanger supports the conversion, voters are expected to
        # vote for the oracle level that is closest to the real-world exchange
        # rate.
        #
        # Note that 10000000 coins (corresponding to 10 M USD) are given to the
        # genesis account initially. This is important to make sure that the
        # genesis account has power to determine the exchange rate until
        # the ecosystem stabilizes. Once a real-world currency exchanger
        # supports the conversion and the oracle gets a sufficient number of
        # honest voters to agree on the real-world exchange rate consistently,
        # the genesis account can lose its power by decreasing its coin
        # balance, moving the oracle to a fully decentralized system. This
        # mechanism is mandatory to stabilize the exchange rate and bootstrap
        # the ecosystem successfully.
        
        # LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
        # exchange rates. The real exchange rate is obtained by dividing the
        # values by EXCHANGE_RATE_DIVISOR. For example, 11 corresponds to the
        # exchange rate of 1.1. This translation is needed to avoid using
        # float numbers in Solidity.
        ACB.LEVEL_TO_EXCHANGE_RATE = [6, 7, 8, 9, 10, 11, 12, 13, 14]
        ACB.EXCHANGE_RATE_DIVISOR = 10

        # The duration of the epoch. The ACB adjusts the total coin supply
        # once per epoch. Voters can vote once per epoch.
        ACB.EPOCH_DURATION = 7 * 24 * 60 * 60 # 1 week.

        # The percentage of the coin balance voters need to deposit.
        ACB.DEPOSIT_RATE = 10 # 10%.

        # A damping factor to avoid minting or burning too many coins in one
        # epoch.
        ACB.DAMPING_FACTOR = 10 # 10%.

        # ----------------
        # Attributes
        # ----------------

        # The JohnLawCoin contract.
        self.coin = coin

        # The current timestamp.
        self.timestamp = 0

        # The timestamp when the current epoch started.
        self.current_epoch_start = self.get_timestamp()

        # The Oracle contract.
        self.oracle = oracle

        # The BondOperation contract.
        self.bond_operation = bond_operation

        # The OpenMarketOperation contract.
        self.open_market_operation = open_market_operation

        # The EthPool contract.
        self.eth_pool = eth_pool

        # The current oracle level.
        self.oracle_level = Oracle.LEVEL_MAX

        # The Logging contract.
        self.logging = logging

        assert(len(ACB.LEVEL_TO_EXCHANGE_RATE) == Oracle.LEVEL_MAX)

    # Test only.
    def override_constants_for_testing(
            self, epoch_duration, deposit_rate, damping_factor,
            level_to_exchange_rate):

        ACB.EPOCH_DURATION = epoch_duration
        ACB.DEPOSIT_RATE = deposit_rate
        ACB.DAMPING_FACTOR = damping_factor
        ACB.LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate

        assert(1 <= ACB.EPOCH_DURATION and
               ACB.EPOCH_DURATION <= 30 * 24 * 60 * 60)
        assert(0 <= ACB.DEPOSIT_RATE and ACB.DEPOSIT_RATE <= 100)
        assert(1 <= ACB.DAMPING_FACTOR and ACB.DAMPING_FACTOR <= 100)
        assert(len(ACB.LEVEL_TO_EXCHANGE_RATE) == Oracle.LEVEL_MAX)

        self.oracle_level = Oracle.LEVEL_MAX

    # Vote for the exchange rate. The voter can commit a vote to the current
    # epoch N, reveal their vote in the epoch N-1, and reclaim the deposited
    # coins and get a reward for their vote in the epoch N-2 at the same time.
    #
    # Parameters
    # ----------------
    # |hash|: The hash to be committed in the current epoch N. Specify
    # ACB.NULL_HASH if you do not want to commit and only want to reveal and
    # reclaim previous votes.
    # |oracle_level|: The oracle level you voted for in the epoch N-1.
    # |salt|: The salt you used in the epoch N-1.
    #
    # Returns
    # ----------------
    # A tuple of six values:
    #  - boolean: Whether the commit succeeded or not.
    #  - boolean: Whether the reveal succeeded or not.
    #  - uint: The amount of the deposited coins.
    #  - uint: The amount of the reclaimed coins.
    #  - uint: The amount of the reward.
    #  - boolean: Whether this vote updated the epoch.
    def vote(self, sender, hash, oracle_level, salt):
        epoch_updated = False
        timestamp = self.get_timestamp()
        if timestamp >= self.current_epoch_start + ACB.EPOCH_DURATION:
            # Start a new epoch.
            epoch_updated = True
            self.current_epoch_start = timestamp

            # Advance to the next epoch. Provide the |tax| coins to the oracle
            # as a reward.
            tax = self.coin.balance_of(self.coin.tax_account)
            burned = self.oracle.advance(self.coin)
            
            # Reset the tax account address just in case.
            self.coin.reset_tax_account()
            assert(self.coin.balance_of(self.coin.tax_account) == 0)

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

                # To avoid increasing or decreasing too many coins in one epoch,
                # multiply the damping factor.
                delta = int(delta * ACB.DAMPING_FACTOR / 100)

            # Update the bond budget.
            epoch_id = self.oracle.epoch_id
            mint = self.bond_operation.update_bond_budget(delta, epoch_id)

            # Update the coin budget.
            if self.oracle_level == 0 and delta < 0:
                assert(mint == 0)
                self.open_market_operation.update_coin_budget(delta)
            else:
                self.open_market_operation.update_coin_budget(mint)

            self.logging.update_epoch(
                epoch_id, mint, burned, delta, self.coin.total_supply,
                self.oracle_level, self.current_epoch_start, tax)
            self.logging.update_bond_budget(
                epoch_id, self.bond_operation.bond_budget,
                self.bond_operation.bond.total_supply,
                self.bond_operation.valid_bond_supply(epoch_id))
            self.logging.update_coin_budget(
                epoch_id, self.open_market_operation.coin_budget,
                self.open_market_operation.eth_balance,
                self.open_market_operation.latest_price)

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

        self.logging.vote(
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
    # The redemption epoch of the purchased bonds.
    def purchase_bonds(self, sender, count):
        redemption_epoch = self.bond_operation.increase_bond_supply(
            sender, count, self.oracle.epoch_id, self.coin)
        self.logging.purchase_bonds(self.oracle.epoch_id, count)
        return redemption_epoch

    # Redeem bonds.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |redemption_epochs|: An array of bonds to be redeemed. The bonds are
    # identified by their redemption epochs.
    #
    # Returns
    # ----------------
    # The number of successfully redeemed bonds.
    def redeem_bonds(self, sender, redemption_epochs):
        (redeemed_bonds, expired_bonds) = (
            self.bond_operation.decrease_bond_supply(
                sender, redemption_epochs, self.oracle.epoch_id, self.coin))
        self.logging.redeem_bonds(
            self.oracle.epoch_id, redeemed_bonds, expired_bonds)
        return redeemed_bonds

    # Pay ETH and purchase JLC from the open market operation.
    #
    # Parameters
    # ----------------
    # The sender needs to pay |requested_eth_amount| ETH.
    #
    # Returns
    # ----------------
    # A tuple of two values:
    # - The amount of ETH the sender paid. This value can be smaller than
    # |requested_eth_amount| when the open market operation does not have enough
    # coin budget. The remaining ETH is returned to the sender's wallet.
    # - The amount of JLC the sender purchased.
    def purchase_coins(self, sender, requested_eth_amount):
        elapsed_time = self.get_timestamp() - self.current_epoch_start

        assert(self.open_market_operation.eth_balance <=
               self.eth_pool.eth_balance)
        
        # Calculate the amount of ETH and JLC to be exchanged.
        (eth_amount, coin_amount) = (
            self.open_market_operation.increase_coin_supply(
                requested_eth_amount, elapsed_time))
        
        self.coin.mint(sender, coin_amount)

        self.logging.purchase_coins(
            self.oracle.epoch_id, eth_amount, coin_amount)
        
        self.eth_pool.increase_eth(eth_amount)
        assert(self.open_market_operation.eth_balance <=
               self.eth_pool.eth_balance)

        return (eth_amount, coin_amount)

    # Pay JLC and purchase ETH from the open market operation.
    #
    # Parameters
    # ----------------
    # |requested_coin_amount|: The amount of JLC the sender is willing to pay.
    #
    # Returns
    # ----------------
    # A tuple of two values:
    # - The amount of ETH the sender purchased.
    # - The amount of JLC the sender paid. This value can be smaller than
    # |requested_coin_amount| when the open market operation does not have
    # enough ETH in the pool.
    def sell_coins(self, sender, requested_coin_amount):
        # The sender does not have enough coins.
        assert(self.coin.balance_of(sender) >= requested_coin_amount)
        
        elapsed_time = self.get_timestamp() - self.current_epoch_start
        
        assert(self.open_market_operation.eth_balance <=
               self.eth_pool.eth_balance)
        
        # Calculate the amount of ETH and JLC to be exchanged.
        (eth_amount, coin_amount) = (
            self.open_market_operation.decrease_coin_supply(
                requested_coin_amount, elapsed_time))
        
        self.coin.burn(sender, coin_amount)

        self.logging.sell_coins(
            self.oracle.epoch_id, eth_amount, coin_amount)
        
        self.eth_pool.decrease_eth(sender, eth_amount)
        assert(self.open_market_operation.eth_balance <=
               self.eth_pool.eth_balance)

        return (eth_amount, coin_amount)

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
    def encrypt(self, sender, level, salt):
        string = str(sender) + "_" + str(level) + "_" + str(salt)
        return hashlib.sha256(string.encode()).hexdigest()

    # Return the current timestamp in seconds.
    def get_timestamp(self):
        return self.timestamp

    # Set the current timestamp in seconds to |timestamp|.
    def set_timestamp(self, timestamp):
        self.timestamp = timestamp
