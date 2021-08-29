// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

pragma solidity ^0.8.0;

import "./JohnLawCoin_v2.sol";

//------------------------------------------------------------------------------
// [Oracle contract]
//
// The oracle is a decentralized mechanism to determine one "truth" level
// from 0, 1, 2, ..., LEVEL_MAX - 1. The oracle uses the commit-reveal-reclaim
// voting scheme.
//
// Permission: Except public getters, only the ACB can call the methods of the
// oracle.
//------------------------------------------------------------------------------
contract Oracle_v3 is OwnableUpgradeable {
  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'public' (instead of
  // 'constant') because tests want to override the values.
  uint public LEVEL_MAX;
  uint public RECLAIM_THRESHOLD;
  uint public PROPORTIONAL_REWARD_RATE;

  // The valid phase transition is: COMMIT => REVEAL => RECLAIM.
  enum Phase {
    COMMIT, REVEAL, RECLAIM
  }

  // Commit is a struct to manage one commit entry in the commit-reveal-reclaim
  // scheme.
  struct Commit {
    // The committed hash (filled in the commit phase).
    bytes32 hash;
    // The amount of deposited coins (filled in the commit phase).
    uint deposit;
    // The oracle level (filled in the reveal phase).
    uint oracle_level;
    // The phase of this commit entry.
    Phase phase;
    // The epoch ID when this commit entry is created.
    uint epoch_id;

    bytes32 hash_v2;
    uint deposit_v2;
    uint oracle_level_v2;
    uint epoch_id_v2;
  }

  // Vote is a struct to count votes for each oracle level.
  struct Vote {
    // Voting statistics are aggregated during the reveal phase and finalized
    // at the end of the reveal phase.

    // The total amount of the coins deposited by the voters who voted for this
    // oracle level.
    uint deposit;
    // The number of the voters.
    uint count;
    // Set to true when the voters for this oracle level are eligible to
    // reclaim the coins they deposited.
    bool should_reclaim;
    // Set to true when the voters for this oracle level are eligible to
    // receive a reward.
    bool should_reward;

    bool should_reclaim_v2;
    bool should_reward_v2;
    uint deposit_v2;
    uint count_v2;
  }

  // Epoch is a struct to keep track of states in the commit-reveal-reclaim
  // scheme. The oracle creates three Epoch objects and uses them in a
  // round-robin manner. For example, when the first Epoch object is in use for
  // the commit phase, the second Epoch object is in use for the reveal phase,
  // and the third Epoch object is in use for the reclaim phase.
  struct Epoch {
    // The commit entries.
    mapping (address => Commit) commits;
    // The voting statistics for all the oracle levels. This can be an array
    // of Votes but intentionally uses a mapping to make the Vote struct
    // upgradeable.
    mapping (uint => Vote) votes;
    // An account to store coins deposited by the voters.
    address deposit_account;
    // An account to store the reward.
    address reward_account;
    // The total amount of the reward.
    uint reward_total;
    // The current phase of this Epoch.
    Phase phase;

    address deposit_account_v2;
    address reward_account_v2;
    uint reward_total_v2;
    Phase phase_v2;
  }

  // Attributes. See the comment in initialize().
  // This can be an array of Epochs but is intentionally using a mapping to
  // make the Epoch struct upgradeable.
  mapping (uint => Epoch) public epochs_;
  uint public epoch_id_;

  uint public epoch_id_v2_;
  
  // Events.
  event CommitEvent(address indexed sender, uint indexed epoch_id,
                    bytes32 hash, uint deposited);
  event RevealEvent(address indexed sender, uint indexed epoch_id,
                    uint oracle_level, uint salt);
  event ReclaimEvent(address indexed sender, uint indexed epoch_id,
                     uint deposited, uint rewarded);
  event AdvancePhaseEvent(uint indexed epoch_id, uint tax, uint burned);

  function upgrade()
      public onlyOwner {
    epoch_id_ = epoch_id_v2_;
    for (uint epoch_index = 0; epoch_index < 3; epoch_index++) {
      epochs_[epoch_index].deposit_account =
          epochs_[epoch_index].deposit_account_v2;
      epochs_[epoch_index].reward_account =
          epochs_[epoch_index].reward_account_v2;
      epochs_[epoch_index].reward_total =
          epochs_[epoch_index].reward_total_v2;
      epochs_[epoch_index].phase =
          epochs_[epoch_index].phase_v2;
      for (uint level = 0; level < getLevelMax(); level++) {
        Vote storage vote = epochs_[epoch_index].votes[level];
        vote.should_reclaim = vote.should_reclaim_v2;
        vote.should_reward = vote.should_reward_v2;
        vote.deposit = vote.deposit_v2;
        vote.count = vote.count_v2;
      }
    }
  }

  // Do commit.
  //
  // Parameters
  // ----------------
  // |coin|: The JohnLawCoin contract.
  // |sender|: The voter's account.
  // |hash|: The committed hash.
  // |deposit|: The amount of the deposited coins.
  //
  // Returns
  // ----------------
  // True if the commit succeeded. False otherwise.
  function commit(JohnLawCoin_v2 coin, address sender,
                  bytes32 hash, uint deposit)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[epoch_id_ % 3];
    require(epoch.phase == Phase.COMMIT, "co1");
    if (coin.balanceOf(sender) < deposit) {
      return false;
    }
    // One voter can commit only once per phase.
    if (epoch.commits[sender].epoch_id == epoch_id_) {
      return false;
    }

    // Create a commit entry.
    epoch.commits[sender] = Commit(
        hash, deposit, LEVEL_MAX, Phase.COMMIT, epoch_id_,
        hash, deposit, LEVEL_MAX, epoch_id_);
    require(epoch.commits[sender].phase == Phase.COMMIT, "co2");

    // Move the deposited coins to the deposit account.
    coin.move(sender, epoch.deposit_account, deposit);
    emit CommitEvent(sender, epoch_id_, hash, deposit);
    return true;
  }

  // Do reveal.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |oracle_level|: The oracle level revealed by the voter.
  // |salt|: The salt revealed by the voter.
  //
  // Returns
  // ----------------
  // True if the reveal succeeded. False otherwise.
  function reveal(address sender, uint oracle_level, uint salt)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[(epoch_id_ - 1) % 3];
    require(epoch.phase == Phase.REVEAL, "rv1");
    if (LEVEL_MAX <= oracle_level) {
      return false;
    }
    if (epoch.commits[sender].epoch_id != epoch_id_ - 1) {
      // The corresponding commit was not found.
      return false;
    }
    // One voter can reveal only once per phase.
    if (epoch.commits[sender].phase != Phase.COMMIT) {
      return false;
    }
    epoch.commits[sender].phase = Phase.REVEAL;

    // Check if the committed hash matches the revealed level and the salt.
    bytes32 reveal_hash = encrypt(
        sender, oracle_level, salt);
    bytes32 hash = epoch.commits[sender].hash;
    if (hash != reveal_hash) {
      return false;
    }

    // Update the commit entry with the revealed level.
    epoch.commits[sender].oracle_level = oracle_level;

    // Count up the vote.
    epoch.votes[oracle_level].deposit += epoch.commits[sender].deposit;
    epoch.votes[oracle_level].count += 1;
    emit RevealEvent(sender, epoch_id_, oracle_level, salt);
    return true;
  }

  // Do reclaim.
  //
  // Parameters
  // ----------------
  // |coin|: The JohnLawCoin contract.
  // |sender|: The voter's account.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  //  - uint: The amount of the reclaimed coins. This becomes a positive value
  //    when the voter is eligible to reclaim their deposited coins.
  //  - uint: The amount of the reward. This becomes a positive value when the
  //    voter voted for the "truth" oracle level.
  function reclaim(JohnLawCoin_v2 coin, address sender)
      public onlyOwner returns (uint, uint) {
    Epoch storage epoch = epochs_[(epoch_id_ - 2) % 3];
    require(epoch.phase == Phase.RECLAIM, "rc1");
    if (epoch.commits[sender].epoch_id != epoch_id_ - 2){
      // The corresponding commit was not found.
      return (0, 0);
    }
    // One voter can reclaim only once per phase.
    if (epoch.commits[sender].phase != Phase.REVEAL) {
      return (0, 0);
    }

    epoch.commits[sender].phase = Phase.RECLAIM;
    uint deposit = epoch.commits[sender].deposit;
    uint oracle_level = epoch.commits[sender].oracle_level;
    if (oracle_level == LEVEL_MAX) {
      return (0, 0);
    }
    require(0 <= oracle_level && oracle_level < LEVEL_MAX, "rc2");

    if (!epoch.votes[oracle_level].should_reclaim) {
      return (0, 0);
    }

    require(epoch.votes[oracle_level].count > 0, "rc3");
    // Reclaim the deposited coins.
    coin.move(epoch.deposit_account, sender, deposit);

    uint reward = 0;
    if (epoch.votes[oracle_level].should_reward) {
      // The voter who voted for the "truth" level can receive the reward.
      //
      // The PROPORTIONAL_REWARD_RATE of the reward is distributed to the
      // voters in proportion to the coins they deposited. This incentivizes
      // voters who have many coins (and thus have more power on determining
      // the "truth" level) to join the oracle.
      //
      // The rest of the reward is distributed to the voters evenly. This
      // incentivizes more voters (including new voters) to join the oracle.
      if (epoch.votes[oracle_level].deposit > 0) {
        reward += (uint(PROPORTIONAL_REWARD_RATE) * epoch.reward_total *
                   deposit) / (uint(100) * epoch.votes[oracle_level].deposit);
      }
      reward += ((uint(100) - PROPORTIONAL_REWARD_RATE) * epoch.reward_total) /
                (uint(100) * epoch.votes[oracle_level].count);
      coin.move(epoch.reward_account, sender, reward);
    }
    emit ReclaimEvent(sender, epoch_id_, deposit, reward);
    return (deposit, reward);
  }

  // Advance to the next phase. COMMIT => REVEAL, REVEAL => RECLAIM,
  // RECLAIM => COMMIT.
  //
  // Parameters
  // ----------------
  // |coin|: The JohnLawCoin contract.
  //
  // Returns
  // ----------------
  // None.
  function advance(JohnLawCoin_v2 coin)
      public onlyOwner returns (uint) {
    // Advance the phase.
    epoch_id_ += 1;

    // Step 1: Move the commit phase to the reveal phase.
    Epoch storage epoch = epochs_[(epoch_id_ - 1) % 3];
    require(epoch.phase == Phase.COMMIT, "ad1");
    epoch.phase = Phase.REVEAL;

    // Step 2: Move the reveal phase to the reclaim phase.
    epoch = epochs_[(epoch_id_ - 2) % 3];
    require(epoch.phase == Phase.REVEAL, "ad2");
    epoch.phase = Phase.RECLAIM;

    // The "truth" level is set to the mode of the weighted majority votes.
    uint mode_level = getModeLevel();
    if (0 <= mode_level && mode_level < LEVEL_MAX) {
      uint deposit_revealed = 0;
      uint deposit_to_reclaim = 0;
      for (uint level = 0; level < LEVEL_MAX; level++) {
        require(epoch.votes[level].should_reclaim == false, "ad3");
        require(epoch.votes[level].should_reward == false, "ad4");
        deposit_revealed = deposit_revealed + epoch.votes[level].deposit;
        if ((mode_level < RECLAIM_THRESHOLD ||
             mode_level - RECLAIM_THRESHOLD <= level) &&
            level <= mode_level + RECLAIM_THRESHOLD) {
          // Voters who voted for the oracle levels in [mode_level -
          // reclaim_threshold, mode_level + reclaim_threshold] are eligible
          // to reclaim their deposited coins. Other voters lose their deposited
          // coins.
          epoch.votes[level].should_reclaim = true;
          deposit_to_reclaim += epoch.votes[level].deposit;
        }
      }

      // Voters who voted for the "truth" level are eligible to receive the
      // reward.
      epoch.votes[mode_level].should_reward = true;

      // Note: |deposit_revealed| is equal to |balanceOf(epoch.deposit_account)|
      // only when all the voters who voted in the commit phase revealed
      // their votes correctly in the reveal phase.
      require(deposit_revealed <= coin.balanceOf(epoch.deposit_account), "ad5");
      require(
          deposit_to_reclaim <= coin.balanceOf(epoch.deposit_account), "ad6");

      // The lost coins are moved to the reward account.
      coin.move(
          epoch.deposit_account,
          epoch.reward_account,
          coin.balanceOf(epoch.deposit_account) - deposit_to_reclaim);
    }

    // Move the collected tax to the reward account.
    address tax_account = coin.tax_account_();
    uint tax = coin.balanceOf(tax_account);
    coin.move(tax_account, epoch.reward_account, tax);

    // Set the total amount of the reward.
    epoch.reward_total = coin.balanceOf(epoch.reward_account);

    // Step 3: Move the reclaim phase to the commit phase.
    uint epoch_index = epoch_id_ % 3;
    epoch = epochs_[epoch_index];
    require(epoch.phase == Phase.RECLAIM, "ad7");

    uint burned = coin.balanceOf(epoch.deposit_account) +
                  coin.balanceOf(epoch.reward_account);
    // Burn the remaining deposited coins.
    coin.burn(epoch.deposit_account, coin.balanceOf(
        epoch.deposit_account));
    // Burn the remaining reward.
    coin.burn(epoch.reward_account, coin.balanceOf(epoch.reward_account));

    // Initialize the Epoch object for the next commit phase.
    //
    // |epoch.commits_| cannot be cleared due to the restriction of Solidity.
    // |epoch_id_| ensures the stale commit entries are not misused.
    for (uint level = 0; level < LEVEL_MAX; level++) {
      epoch.votes[level] =
          Vote(0, 0, false, false, false, false, 0, 0);
    }
    require(coin.balanceOf(epoch.deposit_account) == 0, "ad8");
    require(coin.balanceOf(epoch.reward_account) == 0, "ad9");
    epoch.deposit_account =
        address(uint160(uint(keccak256(abi.encode(
            "deposit_v3", epoch_index, block.number)))));
    epoch.reward_account =
        address(uint160(uint(keccak256(abi.encode(
            "reward_v3", epoch_index, block.number)))));
    epoch.reward_total = 0;
    epoch.phase = Phase.COMMIT;

    emit AdvancePhaseEvent(epoch_id_, tax, burned);
    return burned;
  }

  // Return the oracle level that got the largest amount of deposited coins.
  // In other words, return the mode of the votes weighted by the deposited
  // coins.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // If there are multiple modes, return the mode that has the largest votes.
  // If there are multiple modes that have the largest votes, return the
  // smallest mode. If there are no votes, return LEVEL_MAX.
  function getModeLevel()
      public onlyOwner view returns (uint) {
    Epoch storage epoch = epochs_[(epoch_id_ - 2) % 3];
    require(epoch.phase == Phase.RECLAIM, "gm1");
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
    return mode_level;
  }

  // Return the ownership of the JohnLawCoin contract to the ACB.
  //
  // Parameters
  // ----------------
  // |coin|: The JohnLawCoin contract.
  //
  // Returns
  // ----------------
  // None.
  function revokeOwnership(JohnLawCoin_v2 coin)
      public onlyOwner {
    coin.transferOwnership(msg.sender);
  }

  // Public getter: Return LEVEL_MAX.
  function getLevelMax()
      public view returns (uint) {
    return LEVEL_MAX;
  }

  // Public getter: Return the Vote object at |epoch_index| and |level|.
  function getVote(uint epoch_index, uint level)
      public view returns (uint, uint, bool, bool) {
    require(0 <= epoch_index && epoch_index <= 2, "gv1");
    require(0 <= level && level < getLevelMax(), "gv2");
    Vote memory vote = epochs_[epoch_index].votes[level];
    return (vote.deposit, vote.count, vote.should_reclaim,
            vote.should_reward);
  }

  // Public getter: Return the Commit object at |epoch_index| and |account|.
  function getCommit(uint epoch_index, address account)
      public view returns (bytes32, uint, uint, Phase, uint) {
    require(0 <= epoch_index && epoch_index <= 2, "gc1");
    Commit memory entry = epochs_[epoch_index].commits[account];
    return (entry.hash, entry.deposit, entry.oracle_level,
            entry.phase, entry.epoch_id);
  }

  // Public getter: Return the Epoch object at |epoch_index|.
  function getEpoch(uint epoch_index)
      public view returns (address, address, uint, Phase) {
    require(0 <= epoch_index && epoch_index <= 2, "ge1");
    return (epochs_[epoch_index].deposit_account,
            epochs_[epoch_index].reward_account,
            epochs_[epoch_index].reward_total,
            epochs_[epoch_index].phase);
  }
  
  // Calculate a hash to be committed. Voters are expected to use this
  // function to create a hash used in the commit phase.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |level|: The oracle level to vote.
  // |salt|: The voter's salt.
  //
  // Returns
  // ----------------
  // The calculated hash value.
  function encrypt(address sender, uint level, uint salt)
      public pure returns (bytes32) {
    return keccak256(abi.encode(sender, level, salt));
  }
}

//------------------------------------------------------------------------------
// [ACB contract]
//
// The ACB stabilizes the coin price with algorithmically defined monetary
// policies without holding any collateral. The ACB stabilizes the JLC / USD
// exchange rate to 1.0 as follows:
//
// 1. The ACB obtains the exchange rate from the oracle.
// 2. If the exchange rate is 1.0, the ACB does nothing.
// 3. If the exchange rate is higher than 1.0, the ACB increases the total coin
//    supply by redeeming issued bonds (regardless of their redemption dates).
//    If that is not enough to supply sufficient coins, the ACB mints new coins
//    and provides the coins to the oracle as a reward.
// 4. If the exchange rate is lower than 1.0, the ACB decreases the total coin
//    supply by issuing new bonds.
//
// Permission: All methods are public. No one (including the genesis account)
// is privileged to influence the monetary policies of the ACB. The ACB
// is fully decentralized and there is truly no gatekeeper. The only exceptions
// are a few methods that can be called only by the genesis account. They are
// needed for the genesis account to upgrade the smart contract and fix bugs
// in a development phase.
//------------------------------------------------------------------------------
contract ACB_v3 is OwnableUpgradeable, PausableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;
  bytes32 public constant NULL_HASH = 0;

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'public' (instead of
  // 'constant') because tests want to override the values.
  uint[] public LEVEL_TO_EXCHANGE_RATE;
  uint public EXCHANGE_RATE_DIVISOR;
  uint public EPOCH_DURATION;
  uint public DEPOSIT_RATE;
  uint public DAMPING_FACTOR;

  // Used only in testing. This cannot be put in a derived contract due to
  // a restriction of @openzeppelin/truffle-upgrades.
  uint public _timestamp_for_testing;

  // Attributes. See the comment in initialize().
  JohnLawCoin public coin_;
  Oracle public oracle_;
  BondOperation public bond_operation_;
  OpenMarketOperation public open_market_operation_;
  EthPool public eth_pool_;
  Logging public logging_;
  uint public oracle_level_;
  uint public current_epoch_start_;

  JohnLawCoin_v2 public coin_v2_;
  Oracle_v2 public oracle_v2_;
  BondOperation_v2 public bond_operation_v2_;
  OpenMarketOperation_v2 public open_market_operation_v2_;
  EthPool_v2 public eth_pool_v2_;
  Logging_v2 public logging_v2_;
  uint public oracle_level_v2_;
  uint public current_epoch_start_v2_;

  Oracle_v3 public oracle_v3_;
  
  // Events.
  event PayableEvent(address indexed sender, uint value);
  event UpdateEpochEvent(uint epoch_id, uint current_epoch_start, uint tax,
                         uint burned, int delta, uint mint);
  event VoteEvent(address indexed sender, uint indexed epoch_id,
                  bytes32 hash, uint oracle_level, uint salt,
                  bool commit_result, bool reveal_result,
                  uint deposited, uint reclaimed, uint rewarded,
                  bool epoch_updated);
  event PurchaseBondsEvent(address indexed sender, uint indexed epoch_id,
                           uint purchased_bonds, uint redemption_epoch);
  event RedeemBondsEvent(address indexed sender, uint indexed epoch_id,
                         uint redeemed_bonds, uint expired_bonds);
  event PurchaseCoinsEvent(address indexed sender, uint requested_eth_amount,
                           uint eth_amount, uint coin_amount);
  event SellCoinsEvent(address indexed sender, uint requested_coin_amount,
                       uint eth_amount, uint coin_amount);

  function upgrade(Oracle_v3 oracle)
      public onlyOwner {
    // bond_budget_ = bond_budget_v2_;
    oracle_v3_ = oracle;
    // oracle_level_ = oracle_level_v2_;
    current_epoch_start_ = current_epoch_start_v2_;

    oracle_v3_.upgrade();
  }

  // Deprecate the ACB. Only the owner can call this method.
  function deprecate()
      public onlyOwner {
    coin_v2_.transferOwnership(msg.sender);
    oracle_v3_.transferOwnership(msg.sender);
    bond_operation_v2_.transferOwnership(msg.sender);
    open_market_operation_v2_.transferOwnership(msg.sender);
    eth_pool_v2_.transferOwnership(msg.sender);
    logging_v2_.transferOwnership(msg.sender);
  }

  // Pause the ACB in emergency cases. Only the owner can call this method.
  function pause()
      public onlyOwner {
    if (!paused()) {
      _pause();
    }
    coin_v2_.pause();
  }

  // Unpause the ACB. Only the owner can call this method.
  function unpause()
      public onlyOwner {
    if (paused()) {
      _unpause();
    }
    coin_v2_.unpause();
  }

  // Payable fallback to receive and store ETH. Give us a tip :)
  fallback() external payable {
    require(msg.data.length == 0, "fb1");
    emit PayableEvent(msg.sender, msg.value);
  }
  receive() external payable {
    emit PayableEvent(msg.sender, msg.value);
  }

  // Withdraw the tips. Only the owner can call this method.
  function withdrawTips()
      public whenNotPaused onlyOwner {
    (bool success,) =
        payable(msg.sender).call{value: address(this).balance}("");
    require(success, "wt1");
  }

  // A struct to pack local variables. This is needed to avoid a stack-too-deep
  // error of Solidity.
  struct VoteResult {
    uint epoch_id;
    bool epoch_updated;
    bool reveal_result;
    bool commit_result;
    uint deposited;
    uint reclaimed;
    uint rewarded;
  }

  // Vote for the exchange rate. The voter can commit a vote to the current
  // epoch N, reveal their vote in the epoch N-1, and reclaim the deposited
  // coins and get a reward for their vote in the epoch N-2 at the same time.
  //
  // Parameters
  // ----------------
  // |hash|: The hash to be committed in the current epoch N. Specify
  // ACB.NULL_HASH if you do not want to commit and only want to reveal and
  // reclaim previous votes.
  // |oracle_level|: The oracle level you voted for in the epoch N-1
  // |salt|: The salt you used in the epoch N-1.
  //
  // Returns
  // ----------------
  // A tuple of six values:
  //  - boolean: Whether the commit succeeded or not.
  //  - boolean: Whether the reveal succeeded or not.
  //  - uint: The amount of the deposited coins.
  //  - uint: The amount of the reclaimed coins.
  //  - uint: The amount of the reward.
  //  - boolean: Whether this vote updated the epoch.
  function vote(bytes32 hash, uint oracle_level,
                uint salt)
      public whenNotPaused returns (bool, bool, uint, uint, uint, bool) {
    
    VoteResult memory result;

    result.epoch_id = oracle_v3_.epoch_id_();
    result.epoch_updated = false;
    if (getTimestamp() >= current_epoch_start_ + EPOCH_DURATION) {
      // Start a new epoch.
      result.epoch_updated = true;
      result.epoch_id += 1;
      current_epoch_start_ = getTimestamp();
      
      // Advance to the next epoch. Provide the |tax| coins to the oracle
      // as a reward.
      uint tax = coin_v2_.balanceOf(coin_v2_.tax_account_());
      coin_v2_.transferOwnership(address(oracle_v3_));
      uint burned = oracle_v3_.advance(coin_v2_);
      oracle_v3_.revokeOwnership(coin_v2_);
      
      // Reset the tax account address just in case.
      coin_v2_.resetTaxAccount();
      require(coin_v2_.balanceOf(coin_v2_.tax_account_()) == 0, "vo2");
      
      int delta = 0;
      oracle_level_ = oracle_v3_.getModeLevel();
      if (oracle_level_ != oracle_v3_.getLevelMax()) {
        require(0 <= oracle_level_ && oracle_level_ < oracle_v3_.getLevelMax(),
                "vo1");
        // Translate the oracle level to the exchange rate.
        uint exchange_rate = LEVEL_TO_EXCHANGE_RATE[oracle_level_];

        // Calculate the amount of coins to be minted or burned based on the
        // Quantity Theory of Money. If the exchange rate is 1.1 (i.e., 1 coin
        // = 1.1 USD), the total coin supply is increased by 10%. If the
        // exchange rate is 0.8 (i.e., 1 coin = 0.8 USD), the total coin supply
        // is decreased by 20%.
        delta = coin_v2_.totalSupply().toInt256() *
                (int(exchange_rate) - int(EXCHANGE_RATE_DIVISOR)) /
                int(EXCHANGE_RATE_DIVISOR);

        // To avoid increasing or decreasing too many coins in one epoch,
        // multiply the damping factor.
        delta = delta * int(DAMPING_FACTOR) / 100;
      }

      // Update the bond budget.
      uint mint =
          bond_operation_v2_.updateBondBudget(delta, result.epoch_id);

      if (oracle_level_ == 0 && delta < 0) {
        require(mint == 0, "vo2");
        open_market_operation_v2_.updateCoinBudget(delta);
      } else {
        open_market_operation_v2_.updateCoinBudget(mint.toInt256());
      }

      logging_v2_.updateEpoch(
          result.epoch_id, mint, burned, delta, coin_v2_.totalSupply(),
          oracle_level_, current_epoch_start_, tax);
      logging_v2_.updateBondBudget(
          result.epoch_id, bond_operation_v2_.bond_budget_v2_(),
          bond_operation_v2_.bond_v2_().totalSupply(),
          bond_operation_v2_.validBondSupply(result.epoch_id));
      logging_v2_.updateCoinBudget(
          result.epoch_id, open_market_operation_v2_.coin_budget_v2_(),
          address(eth_pool_v2_).balance,
          open_market_operation_v2_.latest_price_());
      emit UpdateEpochEvent(result.epoch_id, current_epoch_start_,
                            tax, burned, delta, mint);
    }

    coin_v2_.transferOwnership(address(oracle_v3_));

    // Commit.
    //
    // The voter needs to deposit the DEPOSIT_RATE percentage of their coin
    // balance.
    result.deposited = coin_v2_.balanceOf(msg.sender) * DEPOSIT_RATE / 100;
    if (hash == 0) {
      result.deposited = 0;
    }
    result.commit_result = oracle_v3_.commit(
        coin_v2_, msg.sender, hash, result.deposited);
    if (!result.commit_result) {
      result.deposited = 0;
    }
    
    // Reveal.
    result.reveal_result = oracle_v3_.reveal(msg.sender, oracle_level, salt);
    
    // Reclaim.
    (result.reclaimed, result.rewarded) =
        oracle_v3_.reclaim(coin_v2_, msg.sender);

    oracle_v3_.revokeOwnership(coin_v2_);
    
    logging_v2_.vote(result.epoch_id, result.commit_result,
                     result.reveal_result, result.deposited,
                     result.reclaimed, result.rewarded);
    emit VoteEvent(
        msg.sender, result.epoch_id, hash, oracle_level, salt,
        result.commit_result, result.reveal_result, result.deposited,
        result.reclaimed, result.rewarded, result.epoch_updated);
    return (result.commit_result, result.reveal_result, result.deposited,
            result.reclaimed, result.rewarded, result.epoch_updated);
  }

  // Purchase bonds.
  //
  // Parameters
  // ----------------
  // |count|: The number of bonds to purchase.
  //
  // Returns
  // ----------------
  // The redemption epoch of the purchased bonds if it succeeds. 0
  // otherwise.
  function purchaseBonds(uint count)
      public whenNotPaused returns (uint) {
    uint epoch_id = oracle_v3_.epoch_id_();
    
    coin_v2_.transferOwnership(address(bond_operation_v2_));
    uint redemption_epoch =
        bond_operation_v2_.increaseBondSupply(address(msg.sender), count,
                                              epoch_id, coin_v2_);
    bond_operation_v2_.revokeOwnership(coin_v2_);
    
    logging_v2_.purchaseBonds(epoch_id, count);
    emit PurchaseBondsEvent(address(msg.sender), epoch_id,
                            count, redemption_epoch);
    return redemption_epoch;
  }
  
  // Redeem bonds.
  //
  // Parameters
  // ----------------
  // |redemption_epochs|: An array of bonds to be redeemed. Bonds are
  // identified by their redemption epochs.
  //
  // Returns
  // ----------------
  // The number of successfully redeemed bonds.
  function redeemBonds(uint[] memory redemption_epochs)
      public whenNotPaused returns (uint) {
    uint epoch_id = oracle_v3_.epoch_id_();
    
    coin_v2_.transferOwnership(address(bond_operation_v2_));
    (uint redeemed_bonds, uint expired_bonds) =
        bond_operation_v2_.decreaseBondSupply(
            address(msg.sender), redemption_epochs, epoch_id, coin_v2_);
    bond_operation_v2_.revokeOwnership(coin_v2_);
    
    logging_v2_.redeemBonds(epoch_id, redeemed_bonds, expired_bonds);
    emit RedeemBondsEvent(address(msg.sender), epoch_id,
                          redeemed_bonds, expired_bonds);
    return redeemed_bonds;
  }

  // Pay ETH and purchase coins from the open market operation.
  //
  // Parameters
  // ----------------
  // The sender needs to pay |requested_eth_amount| ETH.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  // - The amount of ETH the sender paied. This value can be smaller than
  // |requested_eth_amount| when the open market operation does not have enough
  // coins in the pool. The remaining ETH is returned to the sender's wallet.
  // - The amount of coins the sender purchased.
  function purchaseCoins()
      public whenNotPaused payable returns (uint, uint) {
    uint requested_eth_amount = msg.value;
    uint elapsed_time = getTimestamp() - current_epoch_start_;
    
    require(open_market_operation_v2_.eth_balance_() <=
            address(eth_pool_v2_).balance, "pc1");
    
    // Calculate the amount of ETH and coins to be exchanged.
    (uint eth_amount, uint coin_amount) =
        open_market_operation_v2_.increaseCoinSupply(
            requested_eth_amount, elapsed_time);
    
    coin_v2_.mint(msg.sender, coin_amount);
    
    require(address(this).balance >= requested_eth_amount, "pc2");
    bool success;
    (success,) =
        payable(address(eth_pool_v2_)).call{value: eth_amount}(
            abi.encodeWithSignature("increaseEth()"));
    require(success, "pc3");
    
    logging_.purchaseCoins(oracle_.epoch_id_(), eth_amount, coin_amount);
    
    // Pay back the remaining ETH to the sender. This may trigger any arbitrary
    // operations in an external smart contract. This must be called at the very
    // end of purchaseCoins().
    (success,) =
        payable(msg.sender).call{value: requested_eth_amount - eth_amount}("");
    require(success, "pc4");
    require(open_market_operation_v2_.eth_balance_() <=
            address(eth_pool_v2_).balance, "pc5");

    emit PurchaseCoinsEvent(msg.sender, requested_eth_amount,
                            eth_amount, coin_amount);
    return (eth_amount, coin_amount);
  }
  
  // Pay coins and purchase ETH from the open market operation.
  //
  // Parameters
  // ----------------
  // |requested_coin_amount|: The amount of coins the sender is willing to pay.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  // - The amount of ETH the sender purchased.
  // - The amount of coins the sender paied. This value can be smaller than
  // |requested_coin_amount| when the open market operation does not have
  // enough ETH in the pool.
  function sellCoins(uint requested_coin_amount)
      public whenNotPaused returns (uint, uint) {
    // The sender does not have enough coins.
    require(coin_v2_.balanceOf(msg.sender) >= requested_coin_amount,
            "OpenMarketOperation: Your coin balance is not enough.");
        
    require(open_market_operation_v2_.eth_balance_() <=
            address(eth_pool_v2_).balance, "sc1");
    
    // Calculate the amount of ETH and coins to be exchanged.
    uint elapsed_time = getTimestamp() - current_epoch_start_;
    (uint eth_amount, uint coin_amount) =
        open_market_operation_v2_.decreaseCoinSupply(
            requested_coin_amount, elapsed_time);

    coin_v2_.burn(msg.sender, coin_amount);
    
    logging_.sellCoins(oracle_.epoch_id_(), eth_amount, coin_amount);
    
    // Send ETH to the sender. This may trigger any arbitrary operations in an
    // external smart contract. This must be called at the very end of
    // sellCoins().
    eth_pool_v2_.decreaseEth(msg.sender, eth_amount);
    require(open_market_operation_v2_.eth_balance_() <=
            address(eth_pool_v2_).balance, "sc2");
    
    emit SellCoinsEvent(msg.sender, requested_coin_amount,
                        eth_amount, coin_amount);
    return (eth_amount, coin_amount);
  }

  // Calculate a hash to be committed to the oracle. Voters are expected to
  // call this function to create the hash.
  //
  // Parameters
  // ----------------
  // |level|: The oracle level to vote.
  // |salt|: The voter's salt.
  //
  // Returns
  // ----------------
  // The calculated hash value.
  function encrypt(uint level, uint salt)
      public view returns (bytes32) {
    address sender = msg.sender;
    return oracle_v3_.encrypt(sender, level, salt);
  }
  
  // Public getter: Return the current timestamp in seconds.
  function getTimestamp()
      public virtual view returns (uint) {
    // block.timestamp is better than block.number because the granularity of
    // the epoch update is EPOCH_DURATION (1 week).
    return block.timestamp;
  }

}
