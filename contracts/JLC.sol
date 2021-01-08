// SPDX-License-Identifier: MIT
pragma solidity >=0.7.1 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/SignedSafeMath.sol";

//------------------------------------------------------------------------------
// JohnLawCoin
//
// JohnLawCoin is a stable coin realized by an Algorithmic Central Bank (ACB).
// There is truly no gatekeeper in the system.
//
// JohnLawCoin is an experiment to verify the following assumption:
//
// - It is possible to stabilize the coin price with fully algorithmically
//   defined monetary policies without holding any collateral.
//
// If JohnLawCoin is successful, it will provide many interesting implications
// for 1) decentralized non-fiat currencies and 2) developing countries who want
// to stabilize their fiat currencies without sufficient USD reserve. See
// xxx.pdf to learn about JohnLawCoin and ACB.
//
// JohnLawCoin has the following important properties:
//
// - There is truly no gatekeeper. ACB is fully automated and no one (including
//   the author of the smart contract) has privileges to influence ACB. This can
//   be verified by the fact that the smart contract has no operations that
//   need privileged permissions.
// - The smart contract is self-contained. No dependencies on other smart
//   contracts or other external services.
// - All operations are guaranteed to finish in O(1) time complexity. The time
//   complexity of any operation is determined only by the input size of the
//   operation and not affected by the state of the contract.
//
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Helper contracts
//------------------------------------------------------------------------------

// TokenHolder is a contract to own tokens.
contract TokenHolder is Ownable {
  // Attributes
  // ----------------
  // |amount_|: The amount of tokens.
  uint public amount_;

  // Constructor
  //
  // Parameters
  // ----------------
  // |supply|: A TokenSupply associated with this TokenHolder.
  constructor(TokenSupply supply) {
    transferOwnership(address(supply));
    amount_ = 0;
  }

  // Change the amount. This function should be used only by TokenSupply.
  //
  // Parameters
  // ----------------
  // |amount|: The new amount.
  //
  // Returns:
  // ----------------
  // None.
  function set_amount(uint amount)
      public onlyOwner {
    amount_ = amount;
  }
}

// TokenSupply is responsible for minting / burning / transferring tokens
// to / from / between TokenHolders. TokenSupply is the only mechanism that can
// mint / burn / transfer tokens with a move-only semantics. This ensures that
// tokens can only move; i.e., no tokens are minted or lost unexpectedly.
contract TokenSupply is Ownable {
  // Attributes
  // ----------------
  // |amount_|: The amount of the total supply.
  // |delegated_owner_|: The token supply can also be used by the delegated
  // owner.
  uint public amount_;
  address private delegated_owner_;

  // Events.
  event SendToEvent(TokenHolder indexed src_holder,
                    TokenHolder indexed dst_holder, uint amount);
  event MintEvent(TokenHolder indexed holder, uint amount);
  event BurnEvent(TokenHolder indexed holder, uint amount);
    
  // Constructor.
  //
  // Parameters
  // ----------------
  // None.
  constructor() {
    amount_ = 0;
  }
  
  // Send |amount| tokens from one token holder to another token holder.
  //
  // Parameters
  // ----------------
  // |src_holder|: The source token holder.
  // |dst_holder|: The destination token holder.
  // |amount|: The amount of tokens to be transferred.
  //
  // Returns:
  // ----------------
  // None.
  function send_to(TokenHolder src_holder, TokenHolder dst_holder, uint amount)
      public {
    require(owner() == _msgSender() || delegated_owner_ == _msgSender(),
            "Ownable: caller is not the owner");

    require(src_holder.amount_() >= amount,
            "send_to: src_holder.amount_() >= amount");
    require(src_holder != dst_holder,
            "send_to: src_holder != dst_holder");
    src_holder.set_amount(src_holder.amount_() - amount);
    dst_holder.set_amount(dst_holder.amount_() + amount);
    emit SendToEvent(src_holder, dst_holder, amount);
  }

  // Mint |amount| tokens into a specified token holder.
  //
  // Parameters
  // ----------------
  // |holder|: The token holder.
  // |amount|: The amount of tokens to be minted.
  //
  // Returns:
  // ----------------
  // None.
  function mint(TokenHolder holder, uint amount)
      public {
    require(owner() == _msgSender() || delegated_owner_ == _msgSender(),
            "Ownable: caller is not the owner");
    
    amount_ += amount;
    holder.set_amount(holder.amount_() + amount);
    emit MintEvent(holder, amount);
  }

  // Burn tokens owned by a specified token holder.
  //
  // Parameters
  // ----------------
  // |holder|: The token holder.
  // |amount|: The amount of tokens to be burned.
  //
  // Returns:
  // ----------------
  // None.
  function burn(TokenHolder holder, uint amount)
      public {
    require(owner() == _msgSender() || delegated_owner_ == _msgSender(),
            "Ownable: caller is not the owner");

    require(amount_ >= holder.amount_(),
            "burn: amount_ >= holder.amount_()");
    require(holder.amount_() >= amount,
            "burn: holder.amount_() >= amount");
    amount_ -= amount;
    holder.set_amount(holder.amount_() - amount);
    emit BurnEvent(holder, amount);
  }

  // Set a delegated owner. The TokenSupply can be used by the original owner
  // and the delegated owner.
  //
  // Parameters
  // ----------------
  // |delegated_owner|: The delegated owner.
  //
  // Returns
  // ----------------
  // None.
  function set_delegated_owner(address delegated_owner)
      public onlyOwner {
    delegated_owner_ = delegated_owner;
  }
}

//------------------------------------------------------------------------------
// Oracle
//
// The Oracle is a mechanism to determine one "truth" level in 0, 1, 2, ...,
// LEVEL_MAX - 1 using the commit-reveal-reclaim voting scheme. The meaning of
// the oracle levels should be defined by the user of the oracle.
//------------------------------------------------------------------------------

// Oracle is a mechanism to determine one "truth" level in 0, 1, 2, ...,
// LEVEL_MAX - 1 using the commit-reveal-reclaim voting scheme.
contract Oracle is OwnableUpgradeable {

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'internal' (instead of
  // 'constant') because tests wants to override them.
  uint internal LEVEL_MAX;
  uint internal RECLAIM_THRESHOLD;
  uint internal PROPORTIONAL_REWARD_RATE;

  // The valid phase transition is: COMMIT => REVEAL => RECLAIM.
  enum Phase {
    COMMIT, REVEAL, RECLAIM
  }

  // Commit is a struct to manage one commit entry in the commit-reveal-reclaim
  // scheme.
  struct Commit {
    // Attributes
    // ----------------
    // |committed_hash|: The committed hash (filled in the commit phase).
    // |deposit|: The amount of deposited coins (filled in the commit phase).
    // |revealed_level|: The revealed level (filled in the reveal phase).
    // |phase|: The phase of this commit entry.
    // |epoch|: The epoch that created this commit entry.
    bytes32 committed_hash;
    uint deposit;
    uint revealed_level;
    Phase phase;
    uint epoch;
  }

  // Vote is a struct to count votes in each oracle level.
  struct Vote {
    // Attributes
    // ----------------
    // |deposit|: The total amount of coins deposited by the voters
    // who voted for this oracle level.
    // |count|: The number of the voters.
    // |should_reclaim|: Set to True when the voters for this oracle level
    // are eligible to reclaim the desposited coins in the reclaim phase.
    // |should_reward|: Set to True when the voters for this oracle level are
    // eligible to receive a reward in the reclaim phase.
    //
    // These are aggregated during the reveal phase and finalized at the end
    // of the reveal phase.
    uint deposit;
    uint count;
    bool should_reclaim;
    bool should_reward;
  }

  // Epoch is a struct to keep track of phases throughout the commit / reveal /
  // reclaim phases. The oracle creates three Epoch objects and uses them in a
  // round-robin manner. For example, when the first Epoch object is in use for
  // the commit phase, the second Epoch object is in use for the reveal phase,
  // and the third Epoch object is in use for the reclaim phase.
  struct Epoch {
    // Attributes
    // ----------------
    // |commits|: The commit entries.
    // |votes|: The voting statistics for all oracle levels.
    // |reward_holder|: Voters who voted for the "truth" level can receive a
    // reward. |reward_holder| stores the reward.
    // |reward_total|: The total amount of the reward.
    // |deposit_holder|: The coins deposited by the voters.
    // |phase|: The phase of this Epoch.
    mapping (address => Commit) commits;
    Vote[] votes;
    TokenHolder reward_holder;
    uint reward_total;
    TokenHolder deposit_holder;
    Phase phase;
  }

  // Attributes
  // ----------------
  // |epochs_|: The oracle creates three Epoch objects and uses them in a
  // round-robin manner (commit => reveal => reclaim).
  // |epoch_|: The current epoch. The Epoch object at |epoch % 3| is in
  // the commit phase. The Epoch object at |(epoch - 1) % 3| is in the
  // reveal phase. The Epoch object at |(epoch - 2) % 3| is in the
  // reclaim phase.
  // |coin_supply|: The total coin supply the oracle uses to mint, burn
  // and transfer coins.
  Epoch[3] internal epochs_;
  uint internal epoch_;
  TokenSupply internal coin_supply_;

  // Events.
  event CommitEvent(address indexed, bytes32, uint, TokenHolder);
  event RevealEvent(address indexed, uint, uint);
  event ReclaimEvent(address indexed, TokenHolder, uint);
  event AdvancePhaseEvent(uint indexed, uint, uint);

  // Initializer.
  //
  // Parameters
  // ----------------
  // |coin_supply|: The total coin supply.
  function initialize(TokenSupply coin_supply)
      public initializer {
    __Ownable_init();

    // The number of the oracle levels.
    LEVEL_MAX = 7;
    
    // If the "truth" level is 7 and RECLAIM_THRESHOLD is 2, the voters who
    // voted for 5, 6, 7, 8 and 9 can reclaim their deposited coins. Other
    // voters lose their deposited coins.
    RECLAIM_THRESHOLD = 1;
    
    // The lost deposited coins and the coins minted by ACB are distributed to
    // the voters who voted for the "truth" level as a reward. The
    // PROPORTIONAL_REWARD_RATE of the reward is distributed to the voters in
    // proportion to the coins they deposited. The rest of the reward is
    // distributed to the voters evenly.
    PROPORTIONAL_REWARD_RATE = 80; // 80%

    require(2 <= LEVEL_MAX && LEVEL_MAX < 100,
            "initializer: 2 <= LEVEL_MAX < 100");
    require(0 <= RECLAIM_THRESHOLD && RECLAIM_THRESHOLD < LEVEL_MAX,
            "initializer: 0 <= RECLAIM_THRESHOLD < LEVEL_MAX");
    require(0 <= PROPORTIONAL_REWARD_RATE &&
            PROPORTIONAL_REWARD_RATE <= 100,
            "initializer: 0 <= PROPORTIONAL_REWARD_RATE <= 100");
    
    coin_supply_ = coin_supply;

    for (uint i = 0; i < 3; i++) {
      for (uint level = 0; level < LEVEL_MAX; level++) {
        epochs_[i].votes.push(Vote(0, 0, false, false));
      }
      epochs_[i].reward_holder = new TokenHolder(coin_supply_);
      epochs_[i].reward_total = 0;
      epochs_[i].deposit_holder = new TokenHolder(coin_supply_);
    }
    epochs_[0].phase = Phase.COMMIT;
    epochs_[1].phase = Phase.RECLAIM;
    epochs_[2].phase = Phase.REVEAL;
    
    // Start with 3 because epoch 0 in the commit entry is not distinguishable
    // from an uninitialized commit entry.
    epoch_ = 3;
  }

  // Do commit.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |committed_hash|: The committed hash.
  // |deposit|: The amount of deposited coins.
  // |balance_holder|: The voter's coin balance holder.
  //
  // Returns
  // ----------------
  // True if the commit succeeded. False otherwise.
  function commit(address sender, bytes32 committed_hash,
                  uint deposit, TokenHolder balance_holder)
      public onlyOwner returns (bool) {
    require(epoch_ >= 3, "commit: epoch_ >= 3");
    
    Epoch storage epoch = epochs_[epoch_ % 3];
    require(epoch.phase == Phase.COMMIT,
            "commit: epoch.phase == Phase.COMMIT");
    if (balance_holder.amount_() < deposit) {
      return false;
    }
    // One voter can commit only once per epoch.
    if (epoch.commits[sender].epoch == epoch_) {
      return false;
    }

    // Create a commit entry.
    epoch.commits[sender] = Commit(
        committed_hash, deposit, LEVEL_MAX, Phase.COMMIT, epoch_);
    require(epoch.commits[sender].phase == Phase.COMMIT,
            "commit: epoch.commits[sender].phase == Phase.COMMIT");

    // Move the deposited coins to the deposit holder.
    coin_supply_.send_to(balance_holder, epoch.deposit_holder, deposit);
    emit CommitEvent(sender, committed_hash, deposit, balance_holder);
    return true;
  }

  // Do reveal.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |revealed_level|: The voter reveals the level they used in the commit
  // phase.
  // |revealed_salt|: The voter reveals the salt they used in the commit
  // phase.
  //
  // Returns
  // ----------------
  // True if the reveal succeeded. False otherwise.
  function reveal(address sender, uint revealed_level, uint revealed_salt)
      public onlyOwner returns (bool) {
    require(epoch_ >= 3, "reveal: epoch_ >= 3");
    
    Epoch storage epoch = epochs_[(epoch_ - 1) % 3];
    require(epoch.phase == Phase.REVEAL,
            "reveal: epoch.phase == Phase.REVEAL");
    if (revealed_level < 0 || LEVEL_MAX <= revealed_level) {
      return false;
    }
    if (epoch.commits[sender].epoch != epoch_ - 1) {
      // The corresponding commit was not found.
      return false;
    }
    // One voter can reveal only once per epoch.
    if (epoch.commits[sender].phase != Phase.COMMIT) {
      return false;
    }
    epoch.commits[sender].phase = Phase.REVEAL;

    // Check if the committed hash matches the revealed level and salt.
    bytes32 reveal_hash = hash(
        sender, revealed_level, revealed_salt);
    bytes32 committed_hash = epoch.commits[sender].committed_hash;
    if (committed_hash != reveal_hash) {
      return false;
    }

    // Update the commit entry with the revealed level and salt.
    epoch.commits[sender].revealed_level = revealed_level;

    // Count votes.
    epoch.votes[revealed_level].deposit += epoch.commits[sender].deposit;
    epoch.votes[revealed_level].count += 1;
    emit RevealEvent(sender, revealed_level, revealed_salt);
    return true;
  }

  // Do reclaim.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |balance_holder|: The voter's coin balance holder.
  //
  // Returns
  // ----------------
  // The amount of reclaimed coins.
  function reclaim(address sender, TokenHolder balance_holder)
      public onlyOwner returns (uint) {
    require(epoch_ >= 3, "reclaim: epoch_ >= 3");
    
    Epoch storage epoch = epochs_[(epoch_ - 2) % 3];
    require(epoch.phase == Phase.RECLAIM,
            "reclaim: epoch.phase == Phase.RECLAIM");
    if (epoch.commits[sender].epoch != epoch_ - 2){
      // The corresponding commit was not found.
      return 0;
    }
    // One voter can reclaim only once per epoch.
    if (epoch.commits[sender].phase != Phase.REVEAL) {
      return 0;
    }

    epoch.commits[sender].phase = Phase.RECLAIM;
    uint deposit = epoch.commits[sender].deposit;
    uint revealed_level = epoch.commits[sender].revealed_level;
    if (revealed_level == LEVEL_MAX) {
      return 0;
    }
    require(0 <= revealed_level && revealed_level < LEVEL_MAX,
            "reclaim: 0 <= revealed_level < LEVEL_MAX");

    if (!epoch.votes[revealed_level].should_reclaim) {
      return 0;
    }

    uint reclaim_amount = 0;
    require(epoch.votes[revealed_level].should_reclaim,
            "reclaim: epoch.votes[revealed_level].should_reclaim");
    require(epoch.votes[revealed_level].count > 0,
            "reclaim: epoch.votes[revealed_level].count > 0");
    // Reclaim the deposited coins.
    coin_supply_.send_to(epoch.deposit_holder, balance_holder, deposit);
    reclaim_amount += deposit;

    if (epoch.votes[revealed_level].should_reward) {
      require(epoch.votes[revealed_level].count > 0,
              "reclaim: epoch.votes[revealed_level].count > 0");
      // The voter who voted for the "truth" level can receive the reward.
      //
      // The PROPORTIONAL_REWARD_RATE of the reward is distributed to the
      // voters in proportion to the coins they deposited. This incentivizes
      // voters who have more coins and thus should have more power on
      // determining the "truth" level to join the oracle game.
      //
      // The rest of the reward is distributed to the voters evenly. This
      // incentivizes more voters to join the oracle game.
      uint proportional_reward = 0;
      if (epoch.votes[revealed_level].deposit > 0) {
        proportional_reward = (
            (PROPORTIONAL_REWARD_RATE * epoch.reward_total * deposit) /
            (100 * epoch.votes[revealed_level].deposit));
      }
      uint constant_reward = (
          ((100 - PROPORTIONAL_REWARD_RATE) * epoch.reward_total) /
          (100 * epoch.votes[revealed_level].count));
      coin_supply_.send_to(epoch.reward_holder,
                           balance_holder,
                           proportional_reward + constant_reward);
      reclaim_amount += proportional_reward + constant_reward;
    }
    emit ReclaimEvent(sender, balance_holder, reclaim_amount);
    return reclaim_amount;
  }

  // Advance to the next phase. COMMIT => REVEAL, REVEAL => RECLAIM,
  // RECLAIM => COMMIT.
  //
  // Parameters
  // ----------------
  // |mint|: The amount of coins to be supplied in the reclaim phase as the
  // reward.
  //
  // Returns
  // ----------------
  // None.
  function advance_phase(uint mint)
      public onlyOwner returns (uint) {
    require(epoch_ >= 3, "advance_phase: epoch_ >= 3");
    
    // Step 1: Move the commit phase to the reveal phase.
    Epoch storage epoch = epochs_[epoch_ % 3];
    require(epoch.phase == Phase.COMMIT,
            "advance_phase: epoch.phase == Phase.COMMIT");
    epoch.phase = Phase.REVEAL;

    // Step 2: Move the reveal phase to the reclaim phase.
    epoch = epochs_[(epoch_ - 1) % 3];
    require(epoch.phase == Phase.REVEAL,
            "advance_phase: epoch.phase == Phase.REVEAL");

    uint mode_level = get_mode_level();
    if (0 <= mode_level && mode_level < LEVEL_MAX) {
      uint deposit_voted = 0;
      uint deposit_to_reclaim = 0;
      for (uint level = 0; level < LEVEL_MAX; level++) {
        require(epoch.votes[level].should_reclaim == false,
                "advance_phase: epoch.votes[level].should_reclaim == false");
        require(epoch.votes[level].should_reward == false,
                "advance_phase: epoch.votes[level].should_reward == false");
        deposit_voted += epoch.votes[level].deposit;
        if ((mode_level < RECLAIM_THRESHOLD ||
             mode_level - RECLAIM_THRESHOLD <= level) &&
            level <= mode_level + RECLAIM_THRESHOLD) {
          // Voters who voted for the oracle levels in [mode_level -
          // reclaim_threshold, mode_level + reclaim_threshold] are eligible
          // to reclaim the deposited coins. Other voters lose the deposited
          // coins.
          epoch.votes[level].should_reclaim = true;
          deposit_to_reclaim += epoch.votes[level].deposit;
        }
      }

      // Voters who voted for the "truth" level are eligible to receive the
      // reward.
      epoch.votes[mode_level].should_reward = true;

      // Note: |deposit_voted| is equal to |epoch.deposit_holder.amount|
      // only when all the voters who voted in the commit phase revealed
      // their votes correctly in the reveal phase.
      require(deposit_voted <= epoch.deposit_holder.amount_(),
              "advance_phase: deposit_voted <= deposit_holder.amount_()");
      require(
          deposit_to_reclaim <= epoch.deposit_holder.amount_(),
          "advance_phase: deposit_to_reclaim <= deposit_holder.amount_()");

      // The lost deposited coins are moved to the reward holder.
      coin_supply_.send_to(
          epoch.deposit_holder,
          epoch.reward_holder,
          epoch.deposit_holder.amount_() - deposit_to_reclaim);
    }

    // Mint coins to the reward holder.
    coin_supply_.mint(epoch.reward_holder, mint);

    // Set the total amount of the reward.  The reward is distributed to the
    // voters who voted for the "truth" level.
    epoch.reward_total = epoch.reward_holder.amount_();
    epoch.phase = Phase.RECLAIM;

    // Step 3: Move the reclaim phase to the commit phase.
    epoch = epochs_[(epoch_ - 2) % 3];
    require(epoch.phase == Phase.RECLAIM,
            "advance_phase: epoch.phase == Phase.RECLAIM");

    uint burned = epoch.deposit_holder.amount_() +
                  epoch.reward_holder.amount_();
    // Burn the deposited coins.
    coin_supply_.burn(epoch.deposit_holder,
                      epoch.deposit_holder.amount_());
    // Burn the remaining reward.
    coin_supply_.burn(epoch.reward_holder,
                      epoch.reward_holder.amount_());

    // Initialize the epoch for the next commit phase.
    //
    // The mapping cannot be erased due to the restriction of Solidity.
    // epoch.commits = {}
    for (uint level = 0; level < LEVEL_MAX; level++) {
      epoch.votes[level] = Vote(0, 0, false, false);
    }
    require(epoch.deposit_holder.amount_() == 0,
            "advance_phase: epoch.deposit_holder.amount_() == 0");
    require(epoch.reward_holder.amount_() == 0,
            "advance_phase: epoch.reward_holder.amount_() == 0");
    epoch.reward_total = 0;
    epoch.phase = Phase.COMMIT;

    // Advance the phase.
    epoch_ += 1;

    emit AdvancePhaseEvent(epoch_, mint, burned);
    return burned;
  }

  // Return the mode of the oracle levels weighted by the deposited coins
  // (i.e., what level got the most deposited coins).
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // If there are multiple modes, return the mode that has the largest votes.
  // If there are multiple modes that has the largest votes, return the
  // smallest mode. If there are no votes, return LEVEL_MAX.
  function get_mode_level()
      public onlyOwner view returns (uint) {
    require(epoch_ >= 3, "get_mode_level: epoch_ >= 3");
    
    Epoch storage epoch = epochs_[(epoch_ - 1) % 3];
    require(epoch.phase == Phase.REVEAL,
            "get_mode_level: epoch.phase == Phase.REVEAL");
    uint mode_level = LEVEL_MAX;
    uint max_deposit = 0;
    uint max_count = 0;
    for (uint level = 0; level < LEVEL_MAX; level++) {
      if (epoch.votes[level].count > 0 &&
          (mode_level == LEVEL_MAX ||
           max_deposit < epoch.votes[level].deposit ||
           (max_deposit == epoch.votes[level].deposit &&
            max_count < epoch.votes[level].count))){
        max_deposit = epoch.votes[level].deposit;
        max_count = epoch.votes[level].count;
        mode_level = level;
      }
    }
    if (mode_level == LEVEL_MAX) {
      require(max_deposit == 0,
              "get_mode_level: max_deposit == 0");
      require(max_count == 0,
              "get_mode_level: max_count == 0");
      return LEVEL_MAX;
    }
    require(0 <= mode_level && mode_level < LEVEL_MAX,
            "get_mode_level: 0 <= mode_level < LEVEL_MAX");
    return mode_level;
  }

  // Return LEVEL_MAX.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // Returns LEVEL_MAX.
  function get_level_max()
      public onlyOwner view returns (uint) {
    return LEVEL_MAX;
  }

  // Calculate the committed hash.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |level|: The oracle level to vote.
  // |salt|: The salt used for the vote.
  //
  // Returns
  // ----------------
  // The calculated hash value.
  function hash(address sender, uint level, uint salt)
      public pure returns (bytes32) {
    return keccak256(abi.encode(sender, level, salt));
  }
}

//------------------------------------------------------------------------------
// Algorithmic Central Bank (ACB)
//
// ACB stabilizes the coin price with fully algorithmically defined monetary
// policies without holding any collateral. At a high-level, ACB works as
// follows:
//
// 1. ACB obtains the exchange rate between the coins and USD from the oracle.
// 2. If the exchange rate is 1.0, ACB does nothing.
// 3. If the exchange rate is larger than 1.0, ACB increases the coin supply by
//    proactively redeeming issued bonds. If that is not enough to supply
//    sufficient coins, ACB mints new coins. The minted coins are used as the
//    reward in the oracle.
// 4. If the exchange rate is smaller than 1.0, ACB decreases the coin supply by
//    issuing bonds.
//
//------------------------------------------------------------------------------

// The ACB contract.
contract ACB is OwnableUpgradeable, PausableUpgradeable {

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'internal' (instead of
  // 'constant') because tests wants to override them.
  // The bond redemption price and the redemption period.
  uint internal BOND_REDEMPTION_PRICE = 1000; // A bond is redeemed at 1000 USD.
  uint internal BOND_REDEMPTION_PERIOD = 84 * 24 * 60 * 60; // 12 weeks.

  // The following table shows the mapping from the oracle levels to the
  // exchange rates and the bond prices. Voters can vote for one of the oracle
  // levels.
  //
  //   -----------------------------------------------------------------------
  //   | oracle level | exchange rate    | bond price (annual interest rate) |
  //   -----------------------------------------------------------------------
  //   | 0            | 1 coin = 0.7 USD | 970 coins (14.1%)                 |
  //   | 1            | 1 coin = 0.8 USD | 980 coins (9.16%)                 |
  //   | 2            | 1 coin = 0.9 USD | 990 coins (4.46%)                 |
  //   | 3            | 1 coin = 1.0 USD | 997 coins (1.31%)                 |
  //   | 4            | 1 coin = 1.1 USD | 997 coins (1.31%)                 |
  //   | 5            | 1 coin = 1.2 USD | 997 coins (1.31%)                 |
  //   | 6            | 1 coin = 1.3 USD | 997 coins (1.31%)                 |
  //   -----------------------------------------------------------------------
  //
  // In the bootstrap phase in which no currency exchanger supports the coin
  // <=> USD conversions, voters are expected to vote for the oracle level 4
  // (i.e., 1 coin = 1.1 USD). This helps increase the total coin supply
  // gradually in the bootstrap phase and incentivize early adopters. Once
  // currency exchangers support the conversions, voters are expected to vote
  // for the oracle level that corresponds to the exchange rate determined by
  // the currency exchangers.
  //
  // LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
  // exchange rates. The real exchange rate is obtained by dividing the values
  // by EXCHANGE_RATE_DIVISOR. For example, 11 corresponds to the exchange rate
  // of 1.1. This translation is needed to avoid using decimal numbers in
  // the smart contract.
  uint[] internal LEVEL_TO_EXCHANGE_RATE = [7, 8, 9, 10, 11, 12, 13];
  uint internal EXCHANGE_RATE_DIVISOR = 10;

  // LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
  // bond prices
  uint[] internal LEVEL_TO_BOND_PRICE = [970, 980, 990, 997, 997, 997, 997];

  // The duration of the commit / reveal / reclaim phase.
  uint internal PHASE_DURATION = 7 * 24 * 60 * 60; // 1 week.

  // The percentage of the coin balance the voter needs to deposit.
  uint internal DEPOSIT_RATE = 10; // 10%.

  // To avoid supplying / burning too many coins to / from the system in
  // one epoch, ACB multiplies a dumping factor to the expected amount of
  // coins to be supplied or burned calculated by the Quantum Theory of
  // Money.
  uint internal DUMPING_FACTOR = 10; // 10%.

  // The initial coin supply given to the genesis account.
  // It is important to give a substantial amount of coins to the genesis
  // account so that the genesis account can have power to determine the
  // exchange rate until the ecosystem stabilizes. When real-world currency
  // exchangers start converting the coins with USD and the oracle gets
  // enough honest voters to agree on the real exchange rate consistently,
  // the genesis account can lose its power by decreasing its coin balance.
  // This mechanism is mandatory to stabilize the exchange rate and bootstrap
  // the ecosystem successfully.
  uint internal INITIAL_COIN_SUPPLY = 2100000; // 2.1 M USD

  // The maximum coins that can be transferred in one transaction.
  uint internal COIN_TRANSFER_MAX = 100000; // 100000 USD

  // Attributes
  // ----------------
  // |balances_|: A mapping from user accounts to their coin balances.
  // |bonds_|: A mapping from user accounts to the bonds they hold.
  // |coin_supply_|: The total coin supply in the system.
  // |bond_supply_|: The total bond supply in the system.
  // |bond_budget_|: If |bond_budget| is positive, it indicates the number
  // of bonds ACM wants to sell to decrease the total coin supply. If
  // |bond_budget_| is negative, it indicates the number of bonds ACB
  // wants to redeem to increase the total coin supply.
  // |oracle_|: The oracle to determine the current exchange rate between
  // th coins and USD.
  // |current_epoch_start_|: The timestamp that started the current epoch.
  // |oracle_level_|: The current oracle level.
  mapping (address => TokenHolder) internal balances_;
  mapping (address => mapping (uint => TokenHolder)) internal bonds_;
  TokenSupply internal coin_supply_;
  TokenSupply internal bond_supply_;
  int internal bond_budget_;
  Oracle internal oracle_;
  uint internal current_epoch_start_;
  uint internal oracle_level_;

  // Events.
  event CreateAccountEvent(address indexed);
  event VoteEvent(address indexed, bytes32, uint, uint,
                  bool, bool, uint, bool);
  event TransferEvent(address indexed, address indexed, uint);
  event PurchaseBondsEvent(address indexed, uint, uint);
  event RedeemBondsEvent(address indexed, uint[], uint);
  event ControlSupplyEvent(int, int, uint);

  //----------------------------------------------------------------------------
  // initialize(), activate(), pause() and unpause() are the only functions
  // the genesis account has the privilege to call. This is needed for the
  // genesis account to upgrade the smart contract and fix bugs until it is
  // in good shape. The genesis account has no control about monetary protocols
  // of the ACB.
  //----------------------------------------------------------------------------
  
  // Initializer.
  //
  // Parameters
  // ----------------
  // None.
  function initialize()
      public initializer {
    __Ownable_init();
    __Pausable_init();

    // The bond redemption price and the redemption period.
    BOND_REDEMPTION_PRICE = 1000; // A bond is redeemed at 1000 USD.
    BOND_REDEMPTION_PERIOD = 84 * 24 * 60 * 60; // 12 weeks.

    // The following table shows the mapping from the oracle levels to the
    // exchange rates and the bond prices. Voters can vote for one of the oracle
    // levels.
    //
    //  -----------------------------------------------------------------------
    //  | oracle level | exchange rate    | bond price (annual interest rate) |
    //  -----------------------------------------------------------------------
    //  | 0            | 1 coin = 0.7 USD | 970 coins (14.1%)                 |
    //  | 1            | 1 coin = 0.8 USD | 980 coins (9.16%)                 |
    //  | 2            | 1 coin = 0.9 USD | 990 coins (4.46%)                 |
    //  | 3            | 1 coin = 1.0 USD | 997 coins (1.31%)                 |
    //  | 4            | 1 coin = 1.1 USD | 997 coins (1.31%)                 |
    //  | 5            | 1 coin = 1.2 USD | 997 coins (1.31%)                 |
    //  | 6            | 1 coin = 1.3 USD | 997 coins (1.31%)                 |
    //  -----------------------------------------------------------------------
    //
    // In the bootstrap phase in which no currency exchanger supports the coin
    // <=> USD conversions, voters are expected to vote for the oracle level 4
    // (i.e., 1 coin = 1.1 USD). This helps increase the total coin supply
    // gradually in the bootstrap phase and incentivize early adopters. Once
    // currency exchangers support the conversions, voters are expected to vote
    // for the oracle level that corresponds to the exchange rate determined by
    // the currency exchangers.
    //
    // LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
    // exchange rates. The real exchange rate is obtained by dividing the values
    // by EXCHANGE_RATE_DIVISOR. For example, 11 corresponds to the exchange
    // rate of 1.1. This translation is needed to avoid using decimal numbers in
    // the smart contract.
    LEVEL_TO_EXCHANGE_RATE = [7, 8, 9, 10, 11, 12, 13];
    EXCHANGE_RATE_DIVISOR = 10;

    // LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
    // bond prices
    LEVEL_TO_BOND_PRICE = [970, 980, 990, 997, 997, 997, 997];

    // The duration of the commit / reveal / reclaim phase.
    PHASE_DURATION = 7 * 24 * 60 * 60; // 1 week.

    // The percentage of the coin balance the voter needs to deposit.
    DEPOSIT_RATE = 10; // 10%.

    // To avoid supplying / burning too many coins to / from the system in
    // one epoch, ACB multiplies a dumping factor to the expected amount of
    // coins to be supplied or burned calculated by the Quantum Theory of
    // Money.
    DUMPING_FACTOR = 10; // 10%.

    // The initial coin supply given to the genesis account.
    // It is important to give a substantial amount of coins to the genesis
    // account so that the genesis account can have power to determine the
    // exchange rate until the ecosystem stabilizes. When real-world currency
    // exchangers start converting the coins with USD and the oracle gets
    // enough honest voters to agree on the real exchange rate consistently,
    // the genesis account can lose its power by decreasing its coin balance.
    // This mechanism is mandatory to stabilize the exchange rate and bootstrap
    // the ecosystem successfully.
    INITIAL_COIN_SUPPLY = 2100000; // 2.1 M USD

    // The maximum coins that can be transferred in one transaction.
    COIN_TRANSFER_MAX = 100000; // 100000 USD
  
    require(1 <= BOND_REDEMPTION_PRICE && BOND_REDEMPTION_PRICE <= 100000,
            "initializer: BOND_REDEMPTION_PRICE");
    require(1 <= BOND_REDEMPTION_PERIOD &&
            BOND_REDEMPTION_PERIOD <= 365 * 24 * 60 * 60,
            "initializer: BOND_REDEMPTION_PERIOD");
    require(1 <= PHASE_DURATION && PHASE_DURATION <= 30 * 24 * 60 * 60,
            "initializer: PHASE_DURATION");
    require(0 <= DEPOSIT_RATE && DEPOSIT_RATE <= 100,
            "initializer: DEPOSIT_RATE");
    require(1 <= DUMPING_FACTOR && DUMPING_FACTOR <= 100,
            "initializer: DUMPING_FACTOR");
    require(0 <= INITIAL_COIN_SUPPLY,
            "initializer: INITIAL_COIN_SUPPLY");
    for (uint i = 0; i < LEVEL_TO_BOND_PRICE.length; i++) {
      require(
          LEVEL_TO_BOND_PRICE[i] <= BOND_REDEMPTION_PRICE,
          "initializer: LEVEL_TO_BOND_PRICE[i] <= BOND_REDEMPTION_PRICE");
    }
    
    coin_supply_ = new TokenSupply();
    bond_supply_ = new TokenSupply();
    bond_budget_ = 0;
    current_epoch_start_ = 0;

    // Mint the initial coins in the genesis account.
    require(create_account(), "initializer: create_account()");
    coin_supply_.mint(balances_[msg.sender], INITIAL_COIN_SUPPLY);

    // Pause until the ACB is activated.
    _pause();
  }

  // Activate the ACB with an oracle. This function should be called only once
  // just after the ACB is initialized.
  //
  // Parameters
  // ----------------
  // |oracle|: The oracle. The ownership of the oracle should be transferred to
  // the ACB before activate() is called.
  //
  // Returns
  // ----------------
  // None.
  function activate(Oracle oracle)
      public whenPaused onlyOwner {
    require(LEVEL_TO_EXCHANGE_RATE.length == oracle.get_level_max(),
            "activate: LEVEL_TO_EXCHANGE_RATE.length == get_level_max()");
    require(LEVEL_TO_BOND_PRICE.length == oracle.get_level_max(),
            "activate: LEVEL_TO_BOND_PRICE.length == get_level_max()");
    
    oracle_ = oracle;
    coin_supply_.set_delegated_owner(address(oracle));
    bond_supply_.set_delegated_owner(address(oracle));
    oracle_level_ = oracle.get_level_max();

    // Activate the ACB.
    _unpause();
  }

  // Pause the ACB in emergency cases.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // None.
  function pause()
      public whenNotPaused onlyOwner {
    _pause();
  }

  // Unpause the ACB.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // None.
  function unpause()
      public whenPaused onlyOwner {
    _unpause();
  }

  // Create a new user account.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // True if it succeeds. False otherwise.
  function create_account()
      public whenNotPaused returns (bool) {
    address sender = msg.sender;
    
    if (balances_[sender] != TokenHolder(0)) {
      return false;
    }
    balances_[sender] = new TokenHolder(coin_supply_);
    emit CreateAccountEvent(sender);
    return true;
  }

  // Vote to the oracle. The user can vote to the commit phase of the current
  // epoch, the reveal phase of the previous epoch and the reclaim phase of
  // the previous of the previous epoch at the same time.
  //
  // Parameters
  // ----------------
  // |committed_hash|: Voted to the commit phase of the current epoch.
  // |revealed_level|: Voted to the reveal phase of the previous epoch.
  // |revealed_salt|: Voted to the reveal phase of the previous epoch.
  //
  // Returns
  // ----------------
  // This function returns a tuple of four values.
  //  - First value (boolean): Whether the vote to the commit phase succeeded
  //    or not.
  //  - Second value (boolean): Whether the vote to the reveal phase succeeded
  //    or not.
  //  - Third value (int): The amount of coins reclaimed in the reclaim phase.
  //  - Fourth value (boolean): Whether this vote resulted in a oracle phase
  //    update.
  function vote(bytes32 committed_hash, uint revealed_level, uint revealed_salt)
      public whenNotPaused returns (bool, bool, uint, bool) {
    address sender = msg.sender;
    
    if (balances_[sender] == TokenHolder(0)) {
      return (false, false, 0, false);
    }
    
    bool phase_updated = false;
    if (get_timestamp() >= current_epoch_start_ + PHASE_DURATION) {
      // Start a new epoch.
      phase_updated = true;
      current_epoch_start_ = get_timestamp();
      
      uint mint = 0;
      oracle_level_ = oracle_.get_mode_level();
      if (oracle_level_ != oracle_.get_level_max()) {
        require(0 <= oracle_level_ && oracle_level_ < oracle_.get_level_max(),
                "vote: 0 <= oracle_level_ < oracle_.get_level_max()");
        // Translate the mode level to the exchange rate.
        uint exchange_rate = LEVEL_TO_EXCHANGE_RATE[oracle_level_];

        // Calculate the amount of coins to be supplied or burned in the system
        // based on the Quantum Theory of Money. If the exchnage rate is 1.1
        // (i.e., 1 coin = 1.1 USD), the total coin supply is increased by 10%.
        // If the exchange rate is 0.8 (i.e., 1 coin = 0.8 USD), the total coin
        // supply is decreased by 20%.
        int delta = int(coin_supply_.amount_()) *
                    (int(exchange_rate) - int(1 * EXCHANGE_RATE_DIVISOR)) /
                    int(EXCHANGE_RATE_DIVISOR);

        // To avoid increasing or decreasing too many coins in one epoch,
        // multiply the damping factor.
        delta = delta * int(DUMPING_FACTOR) / 100;

        // Increase or decrease the total coin supply.
        mint = _control_supply(delta);
      }

      // Advance to the next phase.
      oracle_.advance_phase(mint);
    }

    TokenHolder balance_holder = balances_[sender];

    // Commit.
    //
    // The voter needs to deposit some coins. The voter can reclaim the
    // deposited coins later if the voter voted for the levels close to
    // the "truth" level determined by the oracle.
    bool commit_result = oracle_.commit(
        sender, committed_hash,
        balance_holder.amount_() * DEPOSIT_RATE / 100,
        balance_holder);
    
    // Reveal.
    bool reveal_result = oracle_.reveal(
        sender, revealed_level, revealed_salt);
    
    // Reclaim.
    uint reclaim_amount = oracle_.reclaim(sender, balance_holder);

    emit VoteEvent(sender, committed_hash, revealed_level, revealed_salt,
                   commit_result, reveal_result, reclaim_amount, phase_updated);
    return (commit_result, reveal_result, reclaim_amount, phase_updated);
  }

  // Transfer coins from one account to another account.
  //
  // Parameters
  // ----------------
  // |receiver|: The destination account.
  // |amount|: The amount of coins to transfer.
  //
  // Returns
  // ----------------
  // The amount of successfully transferred coins.
  function transfer(address receiver, uint amount)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    if (balances_[sender] == TokenHolder(0)) {
      return 0;
    }
    if (balances_[receiver] == TokenHolder(0)) {
      return 0;
    }
    if (sender == receiver) {
      return 0;
    }
    if (amount <= 0 || COIN_TRANSFER_MAX <= amount) {
      return 0;
    }
    if (balances_[sender].amount_() < amount) {
      return 0;
    }

    coin_supply_.send_to(balances_[sender],
                         balances_[receiver], amount);
    emit TransferEvent(sender, receiver, amount);
    return amount;
  }

  // Purchase bonds.
  //
  // Parameters
  // ----------------
  // |count|: The number of bonds to purchase.
  //
  // Returns
  // ----------------
  // The redemption timestamp of the purchased bonds if it succeeds.
  // -1 otherwise.
  function purchase_bonds(uint count)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    if (balances_[sender] == TokenHolder(0)) {
      return 0;
    }
    if (count <= 0 || (COIN_TRANSFER_MAX <= count * BOND_REDEMPTION_PRICE)) {
      return 0;
    }
    if (bond_budget_ < int(count)) {
      // ACB does not have enough bonds to sell.
      return 0;
    }

    uint bond_price = LEVEL_TO_BOND_PRICE[oracle_.get_level_max() - 1];
    if (0 <= oracle_level_ && oracle_level_ < oracle_.get_level_max()) {
      bond_price = LEVEL_TO_BOND_PRICE[oracle_level_];
    }
    uint amount = bond_price * count;
    if (balances_[sender].amount_() < amount) {
      // The user does not have enough coins to purchase the bonds.
      return 0;
    }

    require(int(bond_supply_.amount_()) + bond_budget_ >= 0,
            "vote: bond_supply_.amount_() + bond_budget_ >= 0");

    // From now on, the bonds are identified by their redemption timestamp.
    uint redemption = get_timestamp() + BOND_REDEMPTION_PERIOD;
    if (bonds_[sender][redemption] == TokenHolder(0)) {
      bonds_[sender][redemption] = new TokenHolder(bond_supply_);
    } else {
      require(bonds_[sender][redemption].amount_() > 0,
              "vote: bonds_[sender][redemption].amount_() > 0");
    }

    // Issue new bonds
    bond_supply_.mint(bonds_[sender][redemption], count);
    bond_budget_ -= int(count);
    require(bond_budget_ >= 0,
            "vote: bond_budget_ >= 0");
    require(int(bond_supply_.amount_()) + bond_budget_ >= 0,
            "vote: bond_supply_.amount_() + bond_budget_ >= 0");
    require(bonds_[sender][redemption].amount_() > 0,
            "vote: bonds_[sender][redemption].amount_() > 0");

    // Burn the corresponding coins.
    coin_supply_.burn(balances_[sender], amount);

    emit PurchaseBondsEvent(sender, count, redemption);
    return redemption;
  }
  
  // Redeem bonds.
  //
  // If there is any error in the specified parameters, no bonds are redeemed.
  //
  // Parameters
  // ----------------
  // |redemptions|: The list of bonds the user wants to redeem. Bonds are
  // identified by their redemption timestamps.
  //
  // Returns
  // ----------------
  // The number of successfully redeemed bonds.
  function redeem_bonds(uint[] memory redemptions)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    if (balances_[sender] == TokenHolder(0)) {
      return 0;
    }
    if (redemptions.length == 0) {
      return 0;
    }

    for (uint i = 0; i < redemptions.length; i++) {
      if (bonds_[sender][redemptions[i]] == TokenHolder(0)) {
        return 0;
      }
      for (uint j = i + 1; j < redemptions.length; j++) {
        if (redemptions[i] == redemptions[j]) {
          return 0;
        }
      }
    }

    require(int(bond_supply_.amount_()) + bond_budget_ >= 0,
            "redeem: bond_supply_.amount_() + bond_budget_ >= 0");

    uint count_total = 0;
    for (uint i = 0; i < redemptions.length; i++) {
      uint redemption = redemptions[i];
      require(bonds_[sender][redemption] != TokenHolder(0),
              "redeem: bonds_[sender][redemption] != TokenHolder(0)");
      uint count = bonds_[sender][redemption].amount_();
      if (redemption > get_timestamp()) {
        // If the bonds have not yet hit their redemption timestamp, ACB
        // accepts the redemption as long as |bond_budget_| is negative.
        if (bond_budget_ >= 0) {
          continue;
        }
        if (count > uint(-bond_budget_)) {
          count = uint(-bond_budget_);
        }
      }

      require(count > 0, "redeem: count > 0");
      bond_budget_ += int(count);
      count_total += count;

      // Mint the corresponding coins to the user's balance.
      uint amount = count * BOND_REDEMPTION_PRICE;
      coin_supply_.mint(balances_[sender], amount);

      // Burn the redeemded bonds.
      bond_supply_.burn(bonds_[sender][redemption], count);
      if (bonds_[sender][redemption].amount_() == 0) {
        delete bonds_[sender][redemption];
        require(bonds_[sender][redemption] == TokenHolder(0),
                "redeem: bonds_[sender][redemption] == TokenHolder(0)");
      }
    }
    require(int(bond_supply_.amount_()) + bond_budget_ >= 0,
            "redeem: bond_supply_.amount_() + bond_budget_ >= 0");
    emit RedeemBondsEvent(sender, redemptions, count_total);
    return count_total;
  }

  // Increase or decrease the total coin supply.
  //
  // Parameters
  // ----------------
  // |delta|: If |delta| is positive, it indicates the amount of coins to be
  // supplied. If |delta| is negative, it indicates the amount of coins to be
  // burned.
  //
  // Returns
  // ----------------
  // The amount of coins that need to be newly minted by ACB.
  function _control_supply(int delta)
      internal whenNotPaused returns (uint) {
    require(int(bond_supply_.amount_()) + bond_budget_ >= 0,
            "_control_supply: bond_supply_.amount_() + bond_budget_ >= 0");

    uint mint = 0;
    if (delta == 0) {
      // No change in the total coin supply.
      bond_budget_ = 0;
    } else if (delta > 0) {
      // Increase the total coin supply.
      uint count = uint(delta) / BOND_REDEMPTION_PRICE;
      if (count <= bond_supply_.amount_()) {
        // If there are sufficient bonds to redeem, increase the coin supply
        // by redeeming bonds.
        bond_budget_ = -int(count);
      } else {
        // Otherwise, ACB needs to mint coins.
        bond_budget_ = -int(bond_supply_.amount_());
        mint = ((count - bond_supply_.amount_()) * BOND_REDEMPTION_PRICE);
      }
      require(bond_budget_ <= 0, "_control_supply: bond_budget_ <= 0");
    } else {
      require(delta < 0, "_control_supply: delta < 0");
      require(0 <= oracle_level_ && oracle_level_ < oracle_.get_level_max(),
              "_control_supply: 0 <= oracle_level_ < oracle_.get_level_max()");
      // Decrease the total coin supply. Issue new bonds to decrease the coin
      // supply.
      bond_budget_ = -delta / int(LEVEL_TO_BOND_PRICE[oracle_level_]);
      require(bond_budget_ >= 0, "_control_supply: bond_budget_ >= 0");
    }

    require(int(bond_supply_.amount_()) + bond_budget_ >= 0,
            "_control_supply: bond_supply_.amount_() + bond_budget_ >= 0");
    emit ControlSupplyEvent(delta, bond_budget_, mint);
    return mint;
  }

  // Calculate the committed hash.
  //
  // Parameters
  // ----------------
  // |level|: The oracle level to vote.
  // |salt|: The salt used for the vote.
  //
  // Returns
  // ----------------
  // The calculated hash value.
  function hash(uint level, uint salt)
      public view returns (bytes32) {
    address sender = msg.sender;
    return oracle_.hash(sender, level, salt);
  }
  
  // Return the current timestamp in seconds.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // The current timestamp in seconds.
  function get_timestamp()
      public virtual view returns (uint) {
    return 0;
  }

}
