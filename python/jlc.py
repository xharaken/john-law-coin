#!/usr/bin/env python3
import hashlib

#-------------------------------------------------------------------------------
# JohnLawCoin
#
# JohnLawCoin is a stable coin realized by an Algorithmic Central Bank (ACB).
# There is truly no gatekeeper in the system.
#
# JohnLawCoin is an experiment to verify the following assumption:
#
# - It is possible to stabilize the coin price with fully algorithmically
#   defined monetary policies without holding any collateral.
#
# If JohnLawCoin is successful, it will provide many interesting implications
# for 1) decentralized non-fiat currencies and 2) developing countries who want
# to stabilize their fiat currencies without sufficient USD reserve. See
# xxx.pdf to learn about JohnLawCoin and ACB.
#
# JohnLawCoin has the following important properties:
#
# - There is truly no gatekeeper. ACB is fully automated and no one (including
#   the author of the smart contract) has privileges to influence ACB. This can
#   be verified by the fact that the smart contract has no operations that
#   need privileged permissions.
# - The smart contract is self-contained. No dependencies on other smart
#   contracts or other external services.
# - All operations are guaranteed to finish in O(1) time complexity. The time
#   complexity of any operation is determined only by the input size of the
#   operation and not affected by the state of the contract.
#
#-------------------------------------------------------------------------------

#-------------------------------------------------------------------------------
# JohnLawCoin
#
# JohnLawCoin is implemented as ERC20 tokens. JohnLawCoin is:
#
# - mintable, burnable and transferable by ACB and its oracle
# - pausable by ACB
# - transferrable by coin holders.
#-------------------------------------------------------------------------------
class JohnLawCoin:
    # Constructor
    #
    # Parameters
    # ----------------
    # None.
    def __init__(self):
        # The mapping from the user account to the coin balance.
        self.balances = {}
        # The total coin supply.
        self.total_supply = 0

    # Mint coins to one account.
    #
    # Parameters
    # ----------------
    # |account|: The user account to which the coins are minted.
    # |amount|: The amount of the coins.
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
    # |account|: The user account from which the coins are burned.
    # |amount|: The amount of the coins.
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

    # Move coins from one account to another account. This method is for ACB and
    # its oracle to move coins from any arbitrary account. Coin holders can move
    # coins by using ERC20's transfer method.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |receiver|: The receiver account.
    # |amount|: The amount of the coins.
    #
    # Returns
    # ----------------
    # None.
    def move(self, sender, receiver, amount):
        assert(amount >= 0)
        self.burn(sender, amount)
        self.mint(receiver, amount)

    # Return the coin balance.
    #
    # Parameters
    # ----------------
    # |account|: The user account.
    #
    # Returns
    # ----------------
    # The coin balance of the account. Returns 0 if the account does not exist.
    def balance_of(self, account):
        if account not in self.balances:
            return 0
        return self.balances[account]

#------------------------------------------------------------------------------
# JohnLawBond
#
# JohnLawBond is an implementation of bonds ACB can issue and redeem to control
# the total coin supply in the system. JohnLawBond is:
#
# - mintable and burnable by ACB
# - not transferrable.
#------------------------------------------------------------------------------
class JohnLawBond:
    # Constructor.
    #
    # Parameters
    # ----------------
    # None.
    def __init__(self):
        # Bonds are specified by a pair of the user account and the redemption
        # timestamp. balances_[account][redemption] stores the number of bonds
        # that are held by the user account and have the redemption timestamp.
        self.balances = {}

        # The total bond supply.
        self.total_supply = 0

    # Mint bonds to one account.
    #
    # Parameters
    # ----------------
    # |account|: The user account to which the bonds are minted.
    # |redemption|: The redemtion timestamp of the bonds.
    # |amount|: The amount of the bonds.
    #
    # Returns
    # ----------------
    # None.
    def mint(self, account, redemption, amount):
        assert(amount >= 0)
        if account not in self.balances:
            self.balances[account] = {}
        if redemption not in self.balances[account]:
            self.balances[account][redemption] = 0
        self.balances[account][redemption] += amount
        self.total_supply += amount

    # Burn bonds from one account.
    #
    # Parameters
    # ----------------
    # |account|: The user account from which the bonds are burned.
    # |redemption|: The redemtion timestamp of the bonds.
    # |amount|: The amount of the bonds.
    #
    # Returns
    # ----------------
    # None.
    def burn(self, account, redemption, amount):
        assert(amount >= 0)
        if account not in self.balances:
            self.balances[account] = {}
        if redemption not in self.balances[account]:
            self.balances[account][redemption] = 0
        assert(self.balances[account][redemption] >= amount)
        self.balances[account][redemption] -= amount
        assert(self.total_supply >= amount)
        self.total_supply -= amount

    # Return the bond balance.
    #
    # Parameters
    # ----------------
    # |account|: The user account.
    # |redemption|: The redemtion timestamp.
    #
    # Returns
    # ----------------
    # The bond balance of the account. Returns 0 if the user account or the
    # redemption timestamp does not exist.
    def balance_of(self, account, redemption):
        if account not in self.balances:
            return 0
        if redemption not in self.balances[account]:
            return 0
        return self.balances[account][redemption]


#-------------------------------------------------------------------------------
# Oracle
#
# The Oracle is a mechanism to determine one "truth" level in 0, 1, 2, ...,
# LEVEL_MAX - 1 using the commit-reveal-reclaim voting scheme. The meaning of
# the oracle levels should be defined by the user of the oracle.
#-------------------------------------------------------------------------------

# The valid phase transition is: COMMIT => REVEAL => RECLAIM.
class Phase:
    COMMIT = 0
    REVEAL = 1
    RECLAIM = 2

# Commit is a struct to manage one commit entry in the commit-reveal-reclaim
# scheme.
class Commit:
    def __init__(self, committed_hash, deposit,
                 revealed_level, phase, epoch_timestamp):
        # The committed hash (filled in the commit phase).
        self.committed_hash = committed_hash
        # The amount of deposited coins (filled in the commit phase).
        self.deposit = deposit
        # The revealed level (filled in the reveal phase).
        self.revealed_level = revealed_level
        # The phase of this commit entry.
        self.phase = phase
        # The epoch timestamp when this commit entry is created.
        self.epoch_timestamp = epoch_timestamp


# Vote is a struct to count votes in each oracle level.
class Vote:
    # Voting statitics are aggregated during the reveal phase and finalized at
    # the end of the reveal phase.
    def __init__(self, deposit, count, should_reclaim, should_reward):
        # The total amount of coins deposited by the voters who voted for this
        # oracle level.
        self.deposit = deposit
        # The number of the voters.
        self.count = count
        # Set to True when the voters for this oracle level are eligible to
        # reclaim the desposited coins in the reclaim phase.
        self.should_reclaim = should_reclaim
        # Set to True when the voters for this oracle level are eligible to
        # receive a reward in the reclaim phase.
        self.should_reward = should_reward


# Epoch is a struct to keep track of phases throughout the commit / reveal /
# reclaim phases. The oracle creates three Epoch objects and uses them in a
# round-robin manner. For example, when the first Epoch object is in use for
# the commit phase, the second Epoch object is in use for the reveal phase,
# and the third Epoch object is in use for the reclaim phase.
class Epoch:
    def __init__(self):
        # The commit entries.
        self.commits = {}
        # The voting statistics for all oracle levels.
        self.votes = []
        # |deposit_account| holds the coins deposited by the voters.
        self.deposit_account = 0
        # Voters who voted for the "truth" level can receive a reward.
        # |reward_account| stores the reward.
        self.reward_account = 0
        # The total amount of the reward.
        self.reward_total = 0
        # The phase of this Epoch.
        self.phase = 0

# The oracle.
class Oracle:

    # Constructor
    #
    # Parameters
    # ----------------
    # None.
    def __init__(self):
        # ----------------
        # Constants
        # ----------------

        # The number of the oracle levels.
        Oracle.LEVEL_MAX = 7

        # If the "truth" level is 7 and RECLAIM_THRESHOLD is 2, the voters who
        # voted for 5, 6, 7, 8 and 9 can reclaim their deposited coins. Other
        # voters lose their deposited coins.
        Oracle.RECLAIM_THRESHOLD = 1

        # The lost deposited coins and the coins minted by ACB are distributed
        # to the voters who voted for the "truth" level as a reward. The
        # PROPORTIONAL_REWARD_RATE of the reward is distributed to the voters in
        # proportion to the coins they deposited. The rest of the reward is
        # distributed to the voters evenly.
        Oracle.PROPORTIONAL_REWARD_RATE = 80 # 80%

        # ----------------
        # Attributes
        # ----------------

        # The oracle creates three Epoch objects and uses them in a round-robin
        # manner (commit => reveal => reclaim).
        self.epochs = [Epoch(), Epoch(), Epoch()]
        for epoch_index in [0, 1, 2]:
            for level in range(Oracle.LEVEL_MAX):
                self.epochs[epoch_index].votes.append(Vote(0, 0, False, False))
            self.epochs[epoch_index].deposit_account = (
                "__deposit_account_for_epoch" + str(epoch_index))
            self.epochs[epoch_index].reward_account = (
                "__reward_account_for_epoch" + str(epoch_index))
            self.epochs[epoch_index].reward_total = 0
        self.epochs[0].phase = Phase.COMMIT
        self.epochs[1].phase = Phase.RECLAIM
        self.epochs[2].phase = Phase.REVEAL

        # The epoch timestamp increases monotonically (3, 4, 5, ...). The Epoch
        # object at |epoch_timestamp % 3| is in the commit phase. The Epoch
        # object at |(epoch_timestamp - 1) % 3| is in the reveal phase. The
        # Epoch object at |(epoch_timestamp - 2) % 3| is in the reclaim phase.
        # Start with 3 because 0 in the commit entry is not distinguishable
        # from an uninitialized commit entry in Solidity.
        self.epoch_timestamp = 3

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
                self.epochs[epoch_index].votes.append(Vote(0, 0, False, False))

    # Do commit.
    #
    # Parameters
    # ----------------
    # |coin|: JohnLawCoin.
    # |sender|: The voter's account.
    # |committed_hash|: The committed hash.
    # |deposit|: The amount of deposited coins.
    #
    # Returns
    # ----------------
    # True if the commit succeeded. False otherwise.
    def commit(self, coin, sender, committed_hash, deposit):
        epoch = self.epochs[self.epoch_timestamp % 3]
        assert(epoch.phase == Phase.COMMIT)
        assert(deposit >= 0)
        if coin.balance_of(sender) < deposit:
            return False
        # One voter can commit only once per epoch.
        if (sender in epoch.commits and
            epoch.commits[sender].epoch_timestamp == self.epoch_timestamp):
            return False

        # Create a commit entry.
        epoch.commits[sender] = Commit(
            committed_hash, deposit, Oracle.LEVEL_MAX,
            Phase.COMMIT, self.epoch_timestamp)

        # Move the deposited coins to the deposit account.
        coin.move(sender, epoch.deposit_account, deposit)
        return True

    # Do reveal.
    #
    # Parameters
    # ----------------
    # |sender|: The voter's account.
    # |revealed_level|: The voter reveals the level they used in the commit
    # phase.
    # |revealed_salt|: The voter reveals the salt they used in the commit
    # phase.
    #
    # Returns
    # ----------------
    # True if the reveal succeeded. False otherwise.
    def reveal(self, sender, revealed_level, revealed_salt):
        epoch = self.epochs[(self.epoch_timestamp - 1) % 3]
        assert(epoch.phase == Phase.REVEAL)
        if revealed_level < 0 or Oracle.LEVEL_MAX <= revealed_level:
            return False
        if (sender not in epoch.commits or
            epoch.commits[sender].epoch_timestamp != self.epoch_timestamp - 1):
            # The corresponding commit was not found.
            return False
        # One voter can reveal only once per epoch.
        if epoch.commits[sender].phase != Phase.COMMIT:
            return False
        epoch.commits[sender].phase = Phase.REVEAL

        # Check if the committed hash matches the revealed level and salt.
        reveal_hash = Oracle.hash(
            sender, revealed_level, revealed_salt)
        committed_hash = epoch.commits[sender].committed_hash
        if committed_hash != reveal_hash:
            return False

        # Update the commit entry with the revealed level and salt.
        epoch.commits[sender].revealed_level = revealed_level

        # Count votes.
        epoch.votes[revealed_level].deposit += epoch.commits[sender].deposit
        epoch.votes[revealed_level].count += 1
        return True

    # Do reclaim.
    #
    # Parameters
    # ----------------
    # |coin|: JohnLawCoin.
    # |sender|: The voter's account.
    #
    # Returns
    # ----------------
    # The amount of reclaimed coins.
    def reclaim(self, coin, sender):
        epoch = self.epochs[(self.epoch_timestamp - 2) % 3]
        assert(epoch.phase == Phase.RECLAIM)
        if (sender not in epoch.commits or
            epoch.commits[sender].epoch_timestamp != self.epoch_timestamp - 2):
            # The corresponding commit was not found.
            return 0
        # One voter can reclaim only once per epoch.
        if epoch.commits[sender].phase != Phase.REVEAL:
            return 0

        epoch.commits[sender].phase = Phase.RECLAIM
        deposit = epoch.commits[sender].deposit
        revealed_level = epoch.commits[sender].revealed_level
        if revealed_level == Oracle.LEVEL_MAX:
            return 0
        assert(0 <= revealed_level and revealed_level < Oracle.LEVEL_MAX)

        if not epoch.votes[revealed_level].should_reclaim:
            return 0

        reclaim_amount = 0
        assert(epoch.votes[revealed_level].should_reclaim)
        assert(epoch.votes[revealed_level].count > 0)
        # Reclaim the deposited coins.
        coin.move(epoch.deposit_account, sender, deposit)
        reclaim_amount += deposit

        if epoch.votes[revealed_level].should_reward:
            assert(epoch.votes[revealed_level].count > 0)
            # The voter who voted for the "truth" level can receive the reward.
            #
            # The PROPORTIONAL_REWARD_RATE percentage of the reward is
            # distributed to the voters in proportion to the coins they
            # deposited. This incentivizes voters who have more coins and thus
            # should have more power on determining the "truth" level to join
            # the oracle game.
            #
            # The rest of the reward is distributed to the voters evenly.
            # This incentivizes more voters to join the oracle game.
            proportional_reward = 0
            if epoch.votes[revealed_level].deposit > 0:
                proportional_reward = int(
                    Oracle.PROPORTIONAL_REWARD_RATE *
                    epoch.reward_total * deposit /
                    (100 * epoch.votes[revealed_level].deposit))
            assert(proportional_reward >= 0)
            constant_reward = int(
                ((100 - Oracle.PROPORTIONAL_REWARD_RATE) * epoch.reward_total) /
                (100 * epoch.votes[revealed_level].count))
            assert(constant_reward >= 0)
            coin.move(epoch.reward_account, sender,
                      proportional_reward + constant_reward)
            reclaim_amount += proportional_reward + constant_reward
        return reclaim_amount

    # Advance to the next phase. COMMIT => REVEAL, REVEAL => RECLAIM,
    # RECLAIM => COMMIT.
    #
    # Parameters
    # ----------------
    # |coin|: JohnLawCoin.
    # |mint|: The amount of coins to be supplied in the reclaim phase as the
    # reward.
    #
    # Returns
    # ----------------
    # None.
    def advance(self, coin, mint):
        assert(mint >= 0)

        # Step 1: Move the commit phase to the reveal phase.
        epoch = self.epochs[self.epoch_timestamp % 3]
        assert(epoch.phase == Phase.COMMIT)
        epoch.phase = Phase.REVEAL

        # Step 2: Move the reveal phase to the reclaim phase.
        epoch = self.epochs[(self.epoch_timestamp - 1) % 3]
        assert(epoch.phase == Phase.REVEAL)

        mode_level = self.get_mode_level()
        if 0 <= mode_level and mode_level < Oracle.LEVEL_MAX:
            deposit_voted = 0
            deposit_to_reclaim = 0
            for level in range(Oracle.LEVEL_MAX):
                assert(epoch.votes[level].should_reclaim == False)
                assert(epoch.votes[level].should_reward == False)
                deposit_voted += epoch.votes[level].deposit
                if (mode_level - Oracle.RECLAIM_THRESHOLD <= level and
                    level <= mode_level + Oracle.RECLAIM_THRESHOLD):
                    # Voters who voted for the oracle levels in [mode_level -
                    # RECLAIM_THRESHOLD, mode_level + RECLAIM_THRESHOLD] are
                    # eligible to reclaim the deposited coins. Other voters
                    # lose the deposited coins.
                    epoch.votes[level].should_reclaim = True
                    deposit_to_reclaim += epoch.votes[level].deposit

            # Voters who voted for the "truth" level are eligible to receive
            # the reward.
            epoch.votes[mode_level].should_reward = True

            # Note: |deposit_voted| is equal to
            # |coin.balance_of(epoch.deposit_account)| only when all the voters
            # who voted in the commit phase revealed their votes correctly in
            # the reveal phase.
            assert(deposit_voted <= coin.balance_of(epoch.deposit_account))
            assert(deposit_to_reclaim <= coin.balance_of(epoch.deposit_account))

            # The lost deposited coins are moved to the reward account.
            coin.move(
                epoch.deposit_account,
                epoch.reward_account,
                coin.balance_of(epoch.deposit_account) - deposit_to_reclaim)

        # Mint coins to the reward account.
        coin.mint(epoch.reward_account, mint)

        # Set the total amount of the reward.  The reward is distributed to the
        # voters who voted for the "truth" level.
        epoch.reward_total = coin.balance_of(epoch.reward_account)
        epoch.phase = Phase.RECLAIM

        # Step 3: Move the reclaim phase to the commit phase.
        epoch = self.epochs[(self.epoch_timestamp - 2) % 3]
        assert(epoch.phase == Phase.RECLAIM)

        burned = (coin.balance_of(epoch.deposit_account) +
                  coin.balance_of(epoch.reward_account))
        # Burn the deposited coins.
        coin.burn(epoch.deposit_account, coin.balance_of(epoch.deposit_account))
        # Burn the remaining reward.
        coin.burn(epoch.reward_account, coin.balance_of(epoch.reward_account))

        # Initialize the epoch for the next commit phase.
        #
        # The mapping cannot be erased due to the restriction of Solidity.
        # epoch.commits = {}
        epoch.votes = []
        for i in range(Oracle.LEVEL_MAX):
            epoch.votes.append(Vote(0, 0, False, False))
        assert(coin.balance_of(epoch.deposit_account) == 0)
        assert(coin.balance_of(epoch.reward_account) == 0)
        epoch.reward_total = 0
        epoch.phase = Phase.COMMIT

        # Advance the phase.
        self.epoch_timestamp += 1
        return burned

    # Return the mode of the oracle levels weighted by the deposited coins
    # (i.e., what level got the most deposited coins).
    #
    # Parameters
    # ----------------
    # None.
    #
    # Returns
    # ----------------
    # If there are multiple modes, return the mode that has the largest votes.
    # If there are multiple modes that has the largest votes, return the
    # smallest mode. If there are no votes, return LEVEL_MAX.
    def get_mode_level(self):
        epoch = self.epochs[(self.epoch_timestamp - 1) % 3]
        assert(epoch.phase == Phase.REVEAL)
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

    # Calculate the commit hash.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account
    # |level|: The oracle level to vote.
    # |salt|: The salt used for the vote.
    #
    # Returns
    # ----------------
    # The calculated hash value.
    def hash(sender, level, salt):
        string = str(sender) + "_" + str(level) + "_" + str(salt)
        return hashlib.sha256(string.encode()).hexdigest()


#-------------------------------------------------------------------------------
# Algorithmic Central Bank (ACB)
#
# ACB stabilizes the coin price with fully algorithmically defined monetary
# policies without holding any collateral. At a high-level, ACB works as
# follows:
#
# 1. ACB obtains the exchange rate between the coins and USD from the oracle.
# 2. If the exchange rate is 1.0, ACB does nothing.
# 3. If the exchange rate is larger than 1.0, ACB increases the coin supply by
#    proactively redeeming issued bonds. If that is not enough to supply
#    sufficient coins, ACB mints new coins. The minted coins are used as the
#    reward in the oracle.
# 4. If the exchange rate is smaller than 1.0, ACB decreases the coin supply by
#    issuing bonds.
#
#-------------------------------------------------------------------------------

class ACB:
    # Constructor.
    #
    # Parameters
    # ----------------
    # |genesis_account|: The genesis account that created the ACB.
    def __init__(self, genesis_account, oracle):
        # ----------------
        # Constants
        # ----------------

        # The following table shows the mapping from the oracle levels to the
        # exchange rates and the bond prices. Voters can vote for one of the
        # oracle levels.
        #
        #  -------------------------------------------------------------
        #  | oracle level | exchange rate    | bond price              |
        #  |              |                  | (annual interest rate)  |
        #  -------------------------------------------------------------
        #  | 0            | 1 coin = 0.7 USD | 970 coins (14.1%)       |
        #  | 1            | 1 coin = 0.8 USD | 980 coins (9.16%)       |
        #  | 2            | 1 coin = 0.9 USD | 990 coins (4.46%)       |
        #  | 3            | 1 coin = 1.0 USD | 997 coins (1.31%)       |
        #  | 4            | 1 coin = 1.1 USD | 997 coins (1.31%)       |
        #  | 5            | 1 coin = 1.2 USD | 997 coins (1.31%)       |
        #  | 6            | 1 coin = 1.3 USD | 997 coins (1.31%)       |
        #  -------------------------------------------------------------
        #
        # In the bootstrap phase in which no currency exchanger supports the
        # coin <=> USD conversions, voters are expected to vote for the oracle
        # level 4 (i.e., 1 coin = 1.1 USD). This helps increase the total coin
        # supply gradually in the bootstrap phase and incentivize early
        # adopters. Once currency exchangers support the conversions, voters
        # are expected to vote for the oracle level that corresponds to the
        # exchange rate determined by the currency exchangers.
        #
        # LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
        # exchange rates. The real exchange rate is obtained by dividing the
        # values by EXCHANGE_RATE_DIVISOR. For example, 11 corresponds to the
        # exchange rate of 1.1. This translation is needed to avoid using
        # decimal numbers in the smart contract.
        ACB.LEVEL_TO_EXCHANGE_RATE = [7, 8, 9, 10, 11, 12, 13]
        ACB.EXCHANGE_RATE_DIVISOR = 10

        # LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
        # bond prices
        ACB.LEVEL_TO_BOND_PRICE = [970, 980, 990, 997, 997, 997, 997]

        # The bond redemption price and the redemption period.
        ACB.BOND_REDEMPTION_PRICE = 1000 # One bond is redeemed at 1000 USD.
        ACB.BOND_REDEMPTION_PERIOD = 84 * 24 * 60 * 60 # 12 weeks.

        # The duration of the commit / reveal / reclaim phase.
        ACB.PHASE_DURATION = 7 * 24 * 60 * 60 # 1 week.

        # The percentage of the coin balance the voter needs to deposit.
        ACB.DEPOSIT_RATE = 10 # 10%.

        # To avoid supplying / burning too many coins to / from the system in
        # one epoch, ACB multiplies a dumping factor to the expected amount of
        # coins to be supplied or burned calculated by the Quantum Theory of
        # Money.
        ACB.DUMPING_FACTOR = 10 # 10%.

        # The initial coin supply given to the genesis account.
        # It is important to give a substantial amount of coins to the genesis
        # account so that the genesis account can have power to determine the
        # exchange rate until the ecosystem stabilizes. When real-world currency
        # exchangers start converting the coins with USD and the oracle gets
        # enough honest voters to agree on the real exchange rate consistently,
        # the genesis account can lose its power by decreasing its coin balance.
        # This mechanism is mandatory to stabilize the exchange rate and
        # bootstrap the ecosystem successfully.
        ACB.INITIAL_COIN_SUPPLY = 2100000 # 2.1 M USD

        # ----------------
        # Attributes
        # ----------------

        # JohnLawCoin.
        self.coin = JohnLawCoin()

        # JohnLawBond.
        self.bond = JohnLawBond()

        # If |bond_budget| is positive, it indicates the number of bonds ACM
        # wants to sell to decrease the total coin supply. If |bond_budget| is
        # negative, it indicates the number of bonds ACB wants to redeem to
        # increase the total coin supply.
        self.bond_budget = 0

        # The timestamp that started the current epoch.
        self.current_epoch_start = 0

        # The current timestamp.
        self.timestamp = 0

        # The oracle to determine the current exchange rate between the coins
        # and USD.
        self.oracle = oracle
        # The current oracle level.
        self.oracle_level = Oracle.LEVEL_MAX

        assert(len(ACB.LEVEL_TO_EXCHANGE_RATE) == Oracle.LEVEL_MAX)
        assert(len(ACB.LEVEL_TO_BOND_PRICE) == Oracle.LEVEL_MAX)

        # Mint the initial coins in the genesis account.
        self.coin.mint(genesis_account, ACB.INITIAL_COIN_SUPPLY)

    # Test only.
    def override_constants_for_testing(
        self, bond_redemption_price, bond_redemption_period,
        phase_duration, deposit_rate, dumping_factor,
        level_to_exchange_rate, level_to_bond_price):

        ACB.BOND_REDEMPTION_PRICE = bond_redemption_price
        ACB.BOND_REDEMPTION_PERIOD = bond_redemption_period
        ACB.PHASE_DURATION = phase_duration
        ACB.DEPOSIT_RATE = deposit_rate
        ACB.DUMPING_FACTOR = dumping_factor
        ACB.LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate
        ACB.LEVEL_TO_BOND_PRICE = level_to_bond_price

        assert(1 <= ACB.BOND_REDEMPTION_PRICE and
               ACB.BOND_REDEMPTION_PRICE <= 100000)
        assert(1 <= ACB.BOND_REDEMPTION_PERIOD and
               ACB.BOND_REDEMPTION_PERIOD <= 365 * 24 * 60 * 60)
        assert(1 <= ACB.PHASE_DURATION and
               ACB.PHASE_DURATION <= 30 * 24 * 60 * 60)
        assert(0 <= ACB.DEPOSIT_RATE and ACB.DEPOSIT_RATE <= 100)
        assert(1 <= ACB.DUMPING_FACTOR and ACB.DUMPING_FACTOR <= 100)
        assert(0 <= ACB.INITIAL_COIN_SUPPLY)
        for bond_price in ACB.LEVEL_TO_BOND_PRICE:
            assert(bond_price <= ACB.BOND_REDEMPTION_PRICE)

        assert(len(ACB.LEVEL_TO_EXCHANGE_RATE) == Oracle.LEVEL_MAX)
        assert(len(ACB.LEVEL_TO_BOND_PRICE) == Oracle.LEVEL_MAX)

        self.oracle_level = Oracle.LEVEL_MAX

    # Vote to the oracle. The user can vote to the commit phase of the current
    # epoch, the reveal phase of the previous epoch and the reclaim phase of
    # the previous of the previous epoch at the same time.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |committed_hash|: Voted to the commit phase of the current epoch.
    # |revealed_level|: Voted to the reveal phase of the previous epoch.
    # |revealed_salt|: Voted to the reveal phase of the previous epoch.
    #
    # Returns
    # ----------------
    # This function returns a tuple of four values.
    #  - First value (boolean): Whether the vote to the commit phase succeeded
    #    or not.
    #  - Second value (boolean): Whether the vote to the reveal phase succeeded
    #    or not.
    #  - Third value (int): The amount of coins reclaimed in the reclaim phase.
    #  - Fourth value (boolean): Whether this vote resulted in a oracle phase
    #    update.
    def vote(self, sender, committed_hash, revealed_level, revealed_salt):
        phase_updated = False
        timestamp = self.get_timestamp()
        if timestamp >= self.current_epoch_start + ACB.PHASE_DURATION:
            # Start a new epoch.
            phase_updated = True
            self.current_epoch_start = timestamp

            mint = 0
            self.oracle_level = self.oracle.get_mode_level()
            if self.oracle_level != Oracle.LEVEL_MAX:
                assert(0 <= self.oracle_level and
                       self.oracle_level < Oracle.LEVEL_MAX)
                # Translate the mode level to the exchange rate.
                exchange_rate = ACB.LEVEL_TO_EXCHANGE_RATE[self.oracle_level]

                # Calculate the amount of coins to be supplied or burned in the
                # system based on the Quantum Theory of Money. If the exchnage
                # rate is 1.1 (i.e., 1 coin = 1.1 USD), the total coin supply is
                # increased by 10%. If the exchange rate is 0.8 (i.e., 1 coin
                # = 0.8 USD), the total coin supply is decreased by 20%.
                delta = int(self.coin.total_supply *
                            (exchange_rate - ACB.EXCHANGE_RATE_DIVISOR) /
                            ACB.EXCHANGE_RATE_DIVISOR)

                # To avoid increasing or decreasing too many coins in one epoch,
                # multiply the damping factor.
                delta = int(delta * ACB.DUMPING_FACTOR / 100)

                # Increase or decrease the total coin supply.
                mint = self._control_supply(delta)

            # Advance to the next phase.
            self.oracle.advance(self.coin, mint)

        # Commit.
        #
        # The voter needs to deposit some coins. The voter can reclaim the
        # deposited coins later if the voter voted for the levels close to
        # the "truth" level determined by the oracle.
        deposit = int(
            self.coin.balance_of(sender) * ACB.DEPOSIT_RATE / 100)
        assert(deposit >= 0)
        commit_result = self.oracle.commit(
            self.coin, sender, committed_hash, deposit)

        # Reveal.
        reveal_result = self.oracle.reveal(
            sender, revealed_level, revealed_salt)

        # Reclaim.
        reclaim_amount = self.oracle.reclaim(self.coin, sender)
        assert(reclaim_amount >= 0)

        return (commit_result, reveal_result, reclaim_amount, phase_updated)

    # Purchase bonds.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |count|: The number of bonds to purchase.
    #
    # Returns
    # ----------------
    # The redemption timestamp of the purchased bonds if it succeeds.
    # 0 otherwise.
    def purchase_bonds(self, sender, count):
        if count <= 0:
            return 0
        if self.bond_budget < count:
            # ACB does not have enough bonds to sell.
            return 0

        bond_price = ACB.LEVEL_TO_BOND_PRICE[Oracle.LEVEL_MAX - 1]
        if 0 <= self.oracle_level and self.oracle_level < Oracle.LEVEL_MAX:
            bond_price = ACB.LEVEL_TO_BOND_PRICE[self.oracle_level]
        amount = bond_price * count
        if self.coin.balance_of(sender) < amount:
            # The user does not have enough coins to purchase the bonds.
            return 0

        # From now on, the bonds are identified by their redemption timestamp.
        redemption = self.get_timestamp() + ACB.BOND_REDEMPTION_PERIOD

        # Issue new bonds
        self.bond.mint(sender, redemption, count)
        self.bond_budget -= count
        assert(self.bond_budget >= 0)
        assert(self.bond.total_supply + self.bond_budget >= 0)
        assert(self.bond.balance_of(sender, redemption) > 0)

        # Burn the corresponding coins.
        self.coin.burn(sender, amount)
        return redemption

    # Redeem bonds.
    #
    # If there is any error in the specified parameters, no bonds are redeemed.
    #
    # Parameters
    # ----------------
    # |sender|: The sender account.
    # |redemptions|: The list of bonds the user wants to redeem. Bonds are
    # identified by their redemption timestamps.
    #
    # Returns
    # ----------------
    # The number of successfully redeemed bonds.
    def redeem_bonds(self, sender, redemptions):
        count_total = 0
        for redemption in redemptions:
            count = self.bond.balance_of(sender, redemption)
            if redemption > self.get_timestamp():
                # If the bonds have not yet hit their redemption timestamp, ACB
                # accepts the redemption as long as |self.bond_budget| is
                # negative.
                if self.bond_budget >= 0:
                    continue
                if count > -self.bond_budget:
                    count = -self.bond_budget

            self.bond_budget += count
            count_total += count

            # Mint the corresponding coins to the user's balance.
            amount = count * ACB.BOND_REDEMPTION_PRICE
            self.coin.mint(sender, amount)

            # Burn the redeemded bonds.
            self.bond.burn(sender, redemption, count)

        assert(self.bond.total_supply + self.bond_budget >= 0)
        return count_total

    # Increase or decrease the total coin supply.
    #
    # Parameters
    # ----------------
    # |delta|: If |delta| is positive, it indicates the amount of coins to be
    # supplied. If |delta| is negative, it indicates the amount of coins to be
    # burned.
    #
    # Returns
    # ----------------
    # The amount of coins that need to be newly minted by ACB.
    def _control_supply(self, delta):
        mint = 0
        if delta == 0:
            # No change in the total coin supply.
            self.bond_budget = 0
        elif delta > 0:
            # Increase the total coin supply.
            count = int(delta / ACB.BOND_REDEMPTION_PRICE)
            if count <= self.bond.total_supply:
                # If there are sufficient bonds to redeem, increase the coin
                # supply by redeeming bonds.
                self.bond_budget = -count
            else:
                # Otherwise, ACB needs to mint coins.
                self.bond_budget = -self.bond.total_supply
                mint = ((count - self.bond.total_supply) *
                        ACB.BOND_REDEMPTION_PRICE)
            assert(self.bond_budget <= 0)
        else:
            assert(delta < 0)
            assert(0 <= self.oracle_level and
                   self.oracle_level < Oracle.LEVEL_MAX)
            # Decrease the total coin supply.
            # Issue new bonds to decrease the coin supply.
            self.bond_budget = int(
                -delta / ACB.LEVEL_TO_BOND_PRICE[self.oracle_level])
            assert(self.bond_budget >= 0)

        assert(self.bond.total_supply + self.bond_budget >= 0)
        assert(mint >= 0)
        return mint

    # Return the current timestamp in seconds.
    #
    # Parameters
    # ----------------
    # None.
    #
    # Returns
    # ----------------
    # The current timestamp in seconds.
    def get_timestamp(self):
        return self.timestamp

    # Set the current timestamp in seconds.
    #
    # Paramters
    # ----------------
    # |timestamp|: The current timestamp to be set.
    #
    # Returns
    # ----------------
    # None.
    def set_timestamp(self, timestamp):
        assert(timestamp > self.timestamp)
        self.timestamp = timestamp
