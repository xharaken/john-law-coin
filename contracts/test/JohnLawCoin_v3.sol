// SPDX-License-Identifier: Apache-2.0
//
// Copyright 2021 Kentaro Hara
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
  // change during the contract execution but use 'internal' (instead of
  // 'constant') because tests want to override the values.
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
    // The committed hash (filled in the commit phase).
    bytes32 committed_hash;
    // The amount of deposited coins (filled in the commit phase).
    uint deposit;
    // The revealed level (filled in the reveal phase).
    uint revealed_level;
    // The phase of this commit entry.
    Phase phase;
    // The timestamp when this commit entry is created.
    uint epoch_timestamp;

    bytes32 committed_hash_v2;
    uint deposit_v2;
    uint revealed_level_v2;
    uint epoch_timestamp_v2;
  }

  // Vote is a struct to count votes in each oracle level.
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
    // of Votes but is intentionally using a mapping to make the Vote struct
    // upgradeable.
    mapping (uint => Vote) votes;
    // A special account to store coins deposited by the voters.
    address deposit_account;
    // A special account to store the reward.
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
  uint public epoch_timestamp_;

  uint public epoch_timestamp_v2_;
  
  // Events.
  event CommitEvent(address indexed sender,
                    bytes32 committed_hash, uint deposited);
  event RevealEvent(address indexed sender,
                    uint revealed_level, uint revealed_salt);
  event ReclaimEvent(address indexed sender, uint deposited, uint rewarded);
  event AdvancePhaseEvent(uint indexed epoch_timestamp,
                          uint minted, uint burned);

  function upgrade()
      public onlyOwner {
    epoch_timestamp_ = epoch_timestamp_v2_;
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
  // |committed_hash|: The committed hash.
  // |deposit|: The amount of the deposited coins.
  //
  // Returns
  // ----------------
  // True if the commit succeeded. False otherwise.
  function commit(JohnLawCoin_v2 coin, address sender,
                  bytes32 committed_hash, uint deposit)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[epoch_timestamp_ % 3];
    require(epoch.phase == Phase.COMMIT, "co1");
    if (coin.balanceOf(sender) < deposit) {
      return false;
    }
    // One voter can commit only once per epoch.
    if (epoch.commits[sender].epoch_timestamp == epoch_timestamp_) {
      return false;
    }

    // Create a commit entry.
    epoch.commits[sender] = Commit(
        committed_hash, deposit, LEVEL_MAX, Phase.COMMIT, epoch_timestamp_,
        committed_hash, deposit, LEVEL_MAX, epoch_timestamp_);
    require(epoch.commits[sender].phase == Phase.COMMIT, "co2");

    // Move the deposited coins to the deposit account.
    coin.move(sender, epoch.deposit_account, deposit);
    emit CommitEvent(sender, committed_hash, deposit);
    return true;
  }

  // Do reveal.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |revealed_level|: The oracle level revealed by the voter.
  // |revealed_salt|: The salt revealed by the voter.
  //
  // Returns
  // ----------------
  // True if the reveal succeeded. False otherwise.
  function reveal(address sender, uint revealed_level, uint revealed_salt)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[(epoch_timestamp_ - 1) % 3];
    require(epoch.phase == Phase.REVEAL, "rv1");
    if (revealed_level < 0 || LEVEL_MAX <= revealed_level) {
      return false;
    }
    if (epoch.commits[sender].epoch_timestamp != epoch_timestamp_ - 1) {
      // The corresponding commit was not found.
      return false;
    }
    // One voter can reveal only once per epoch.
    if (epoch.commits[sender].phase != Phase.COMMIT) {
      return false;
    }
    epoch.commits[sender].phase = Phase.REVEAL;

    // Check if the committed hash matches the revealed level and the salt.
    bytes32 reveal_hash = hash(
        sender, revealed_level, revealed_salt);
    bytes32 committed_hash = epoch.commits[sender].committed_hash;
    if (committed_hash != reveal_hash) {
      return false;
    }

    // Update the commit entry with the revealed level.
    epoch.commits[sender].revealed_level = revealed_level;

    // Count up votes and the deposited coins.
    epoch.votes[revealed_level].deposit += epoch.commits[sender].deposit;
    epoch.votes[revealed_level].count += 1;
    emit RevealEvent(sender, revealed_level, revealed_salt);
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
  // The total amount of the reclaimed coins and the reward.
  function reclaim(JohnLawCoin_v2 coin, address sender)
      public onlyOwner returns (uint, uint) {
    Epoch storage epoch = epochs_[(epoch_timestamp_ - 2) % 3];
    require(epoch.phase == Phase.RECLAIM, "rc1");
    if (epoch.commits[sender].epoch_timestamp != epoch_timestamp_ - 2){
      // The corresponding commit was not found.
      return (0, 0);
    }
    // One voter can reclaim only once per epoch.
    if (epoch.commits[sender].phase != Phase.REVEAL) {
      return (0, 0);
    }

    epoch.commits[sender].phase = Phase.RECLAIM;
    uint deposit = epoch.commits[sender].deposit;
    uint revealed_level = epoch.commits[sender].revealed_level;
    if (revealed_level == LEVEL_MAX) {
      return (0, 0);
    }
    require(0 <= revealed_level && revealed_level < LEVEL_MAX, "rc2");

    if (!epoch.votes[revealed_level].should_reclaim) {
      return (0, 0);
    }

    require(epoch.votes[revealed_level].count > 0, "rc3");
    // Reclaim the deposited coins.
    coin.move(epoch.deposit_account, sender, deposit);

    uint reward = 0;
    if (epoch.votes[revealed_level].should_reward) {
      // The voter who voted for the "truth" level can receive the reward.
      //
      // The PROPORTIONAL_REWARD_RATE of the reward is distributed to the
      // voters in proportion to the coins they deposited. This incentivizes
      // voters who have many coins (and thus have more power on determining
      // the "truth" level) to join the oracle.
      //
      // The rest of the reward is distributed to the voters evenly. This
      // incentivizes more voters (including new voters) to join the oracle.
      if (epoch.votes[revealed_level].deposit > 0) {
        reward += (uint(PROPORTIONAL_REWARD_RATE) * epoch.reward_total *
                   deposit) / (uint(100) * epoch.votes[revealed_level].deposit);
      }
      reward += ((uint(100) - PROPORTIONAL_REWARD_RATE) * epoch.reward_total) /
                (uint(100) * epoch.votes[revealed_level].count);
      coin.move(epoch.reward_account, sender, reward);
    }
    emit ReclaimEvent(sender, deposit, reward);
    return (deposit, reward);
  }

  // Advance to the next phase. COMMIT => REVEAL, REVEAL => RECLAIM,
  // RECLAIM => COMMIT.
  //
  // Parameters
  // ----------------
  // |coin|: The JohnLawCoin contract.
  // |mint|: The amount of coins provided for the reward in the reclaim phase.
  //
  // Returns
  // ----------------
  // None.
  function advance(JohnLawCoin_v2 coin, uint mint)
      public onlyOwner returns (uint) {
    // Step 1: Move the commit phase to the reveal phase.
    Epoch storage epoch = epochs_[epoch_timestamp_ % 3];
    require(epoch.phase == Phase.COMMIT, "ad1");
    epoch.phase = Phase.REVEAL;

    // Step 2: Move the reveal phase to the reclaim phase.
    epoch = epochs_[(epoch_timestamp_ - 1) % 3];
    require(epoch.phase == Phase.REVEAL, "ad2");

    // The "truth" level is set to the mode of the votes.
    uint mode_level = getModeLevel();
    if (0 <= mode_level && mode_level < LEVEL_MAX) {
      uint deposit_voted = 0;
      uint deposit_to_reclaim = 0;
      for (uint level = 0; level < LEVEL_MAX; level++) {
        require(epoch.votes[level].should_reclaim == false, "ad3");
        require(epoch.votes[level].should_reward == false, "ad4");
        deposit_voted = deposit_voted + epoch.votes[level].deposit;
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

      // Note: |deposit_voted| is equal to |balanceOf(epoch.deposit_account)|
      // only when all the voters who voted in the commit phase revealed
      // their votes correctly in the reveal phase.
      require(deposit_voted <= coin.balanceOf(epoch.deposit_account),"ad5");
      require(
          deposit_to_reclaim <= coin.balanceOf(epoch.deposit_account),"ad6");

      // The lost coins are moved to the reward account.
      coin.move(
          epoch.deposit_account,
          epoch.reward_account,
          coin.balanceOf(epoch.deposit_account) - deposit_to_reclaim);
    }

    // Mint |mint| coins to the reward account.
    coin.mint(epoch.reward_account, mint);

    // Set the total amount of the reward.
    epoch.reward_total = coin.balanceOf(epoch.reward_account);
    epoch.phase = Phase.RECLAIM;

    // Step 3: Move the reclaim phase to the commit phase.
    epoch = epochs_[(epoch_timestamp_ - 2) % 3];
    require(epoch.phase == Phase.RECLAIM, "ad7");

    uint burned = coin.balanceOf(epoch.deposit_account) +
                  coin.balanceOf(epoch.reward_account);
    // Burn the remaining deposited coins.
    coin.burn(epoch.deposit_account, coin.balanceOf(
        epoch.deposit_account));
    // Burn the remaining reward.
    coin.burn(epoch.reward_account, coin.balanceOf(epoch.reward_account));

    // Initialize the epoch for the next commit phase.
    //
    // |epoch.commits_| cannot be cleared due to the restriction of Solidity.
    // |epoch_timestamp_| ensures the stale commit entries are not used.
    for (uint level = 0; level < LEVEL_MAX; level++) {
      epoch.votes[level] =
          Vote(0, 0, false, false, false, false, 0, 0);
    }
    require(coin.balanceOf(epoch.deposit_account) == 0, "ad8");
    require(coin.balanceOf(epoch.reward_account) == 0, "ad9");
    epoch.reward_total = 0;
    epoch.phase = Phase.COMMIT;

    // Advance the phase.
    epoch_timestamp_ += 1;

    emit AdvancePhaseEvent(epoch_timestamp_, mint, burned);
    return burned;
  }

  // Return the oracle level that got the largest amount of deposited coins.
  // In other words, return the mode of the votes weighted by their deposited
  // coins.
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
  function getModeLevel()
      public onlyOwner view returns (uint) {
    Epoch storage epoch = epochs_[(epoch_timestamp_ - 1) % 3];
    require(epoch.phase == Phase.REVEAL, "gm1");
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

  // Public getter: Return the Vote struct at |epoch_index| and |level|.
  function getVote(uint epoch_index, uint level)
      public view returns (uint, uint, bool, bool) {
    require(0 <= epoch_index && epoch_index <= 2, "gv1");
    require(0 <= level && level < getLevelMax(), "gv2");
    Vote memory vote = epochs_[epoch_index].votes[level];
    return (vote.deposit, vote.count, vote.should_reclaim,
            vote.should_reward);
  }

  // Public getter: Return the Commit struct at |epoch_index| and |account|.
  function getCommit(uint epoch_index, address account)
      public view returns (bytes32, uint, uint, Phase, uint) {
    require(0 <= epoch_index && epoch_index <= 2, "gc1");
    Commit memory entry = epochs_[epoch_index].commits[account];
    return (entry.committed_hash, entry.deposit, entry.revealed_level,
            entry.phase, entry.epoch_timestamp);
  }

  // Public getter: Return the Epoch struct at |epoch_index|.
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
  function hash(address sender, uint level, uint salt)
      public pure returns (bytes32) {
    return keccak256(abi.encode(sender, level, salt));
  }
}

//------------------------------------------------------------------------------
// [ACB contract]
//
// The ACB stabilizes the coin price with algorithmically defined monetary
// policies without holding any collateral. The ACB stabilizes the coin / USD
// exchange rate to 1.0 as follows:
//
// 1. The ACB obtains the exchange rate from the oracle.
// 2. If the exchange rate is 1.0, the ACB does nothing.
// 3. If the exchange rate is larger than 1.0, the ACB increases the total coin
//    supply by redeeming issued bonds (regardless of their redemption dates).
//    If that is not enough to supply sufficient coins, the ACB mints new coins
//    and provides the coins to the oracle as the reward.
// 4. If the exchange rate is smaller than 1.0, the ACB decreases the total coin
//    supply by issuing new bonds.
//
// Permission: All methods are public. No one (including the genesis account)
// has the privileges of influencing the monetary policies of the ACB. The ACB
// is fully decentralized and there is truly no gatekeeper. The only exceptions
// are initialize(), deprecate(), pause() and unpause(). These methods can be
// called only by the genesis account. This is needed for the genesis account
// to upgrade the smart contract and fix bugs in a development phase.
//------------------------------------------------------------------------------
contract ACB_v3 is OwnableUpgradeable, PausableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;
  bytes32 public constant NULL_HASH = 0;

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'internal' (instead of
  // 'constant') because tests want to override the values.
  uint internal BOND_REDEMPTION_PRICE;
  uint internal BOND_REDEMPTION_PERIOD;
  uint[] internal LEVEL_TO_EXCHANGE_RATE;
  uint internal EXCHANGE_RATE_DIVISOR;
  uint[] internal LEVEL_TO_BOND_PRICE;
  uint[] internal LEVEL_TO_TAX_RATE;
  uint internal PHASE_DURATION;
  uint internal DEPOSIT_RATE;
  uint internal DAMPING_FACTOR;

  // Used only in testing. This cannot be put in a derived contract due to
  // a restriction of @openzeppelin/truffle-upgrades.
  uint internal _timestamp_for_testing;

  // Attributes. See the comment in initialize().
  JohnLawCoin public coin_;
  JohnLawBond public bond_;
  Oracle public oracle_;
  Logging public logging_;
  int public bond_budget_;
  uint public oracle_level_;
  uint public current_phase_start_;

  JohnLawCoin_v2 public coin_v2_;
  JohnLawBond_v2 public bond_v2_;
  Oracle_v2 public oracle_v2_;
  Logging_v2 public logging_v2_;
  int public bond_budget_v2_;
  uint public oracle_level_v2_;
  uint public current_phase_start_v2_;

  Oracle_v3 public oracle_v3_;
  
  // Events.
  event VoteEvent(address indexed sender, bytes32 committed_hash,
                  uint revealed_level, uint revealed_salt,
                  bool commit_result, bool reveal_result,
                  uint deposited, uint reclaimed, uint rewarded,
                  bool phase_updated);
  event PurchaseBondsEvent(address indexed sender, uint count,
                           uint redemption_timestamp);
  event RedeemBondsEvent(address indexed sender,
                         uint[] redemption_timestamps, uint count);
  event ControlSupplyEvent(int delta, int bond_budget, uint mint);

  function upgrade(Oracle_v3 oracle)
      public onlyOwner {
    // bond_budget_ = bond_budget_v2_;
    oracle_v3_ = oracle;
    // oracle_level_ = oracle_level_v2_;
    current_phase_start_ = current_phase_start_v2_;

    oracle_v3_.upgrade();
  }

  // Deprecate the ACB.
  function deprecate()
      public whenNotPaused onlyOwner {
    coin_v2_.transferOwnership(msg.sender);
    bond_v2_.transferOwnership(msg.sender);
    oracle_v3_.transferOwnership(msg.sender);
    logging_v2_.transferOwnership(msg.sender);
  }

  // Pause the ACB in emergency cases.
  function pause()
      public whenNotPaused onlyOwner {
    _pause();
    coin_v2_.pause();
  }

  // Unpause the ACB.
  function unpause()
      public whenPaused onlyOwner {
    _unpause();
    coin_v2_.unpause();
  }

  // A struct to pack local variables. This is needed to avoid a stack-too-deep
  // error of Solidity.
  struct VoteResult {
    bool phase_updated;
    bool reveal_result;
    bool commit_result;
    uint deposited;
    uint reclaimed;
    uint rewarded;
  }

  // Vote to the oracle. The voter can commit a vote in the current phase,
  // reveal their vote in the prior phase, and reclaim the deposited coins and
  // get a reward for their vote in the next prior phase at the same time.
  //
  // Parameters
  // ----------------
  // |committed_hash|: The hash to be committed in the current phase. Specify
  // ACB.NULL_HASH if you only want to reveal and reclaim previous votes and
  // do not want to commit.
  // |revealed_level|: The oracle level to be revealed in the prior phase.
  // |revealed_salt|: The voter's salt to be revealed in the prior phase.
  //
  // Returns
  // ----------------
  // A tuple of six values.
  //  - boolean: Whether the commit succeeded or not.
  //  - boolean: Whether the reveal succeeded or not.
  //  - uint: The amount of the deposited coins.
  //  - uint: The amount of the reclaimed coins.
  //  - uint: The amount of the reward.
  //  - boolean: Whether this vote resulted in a phase update.
  function vote(bytes32 committed_hash, uint revealed_level,
                uint revealed_salt)
      public whenNotPaused returns (bool, bool, uint, uint, uint, bool) {
    
    VoteResult memory result;
    
    result.phase_updated = false;
    if (getTimestamp() >= current_phase_start_ + PHASE_DURATION) {
      // Start a new phase.
      result.phase_updated = true;
      current_phase_start_ = getTimestamp();
      
      uint mint = 0;
      int delta = 0;
      uint tax_rate = 0;
      oracle_level_ = oracle_v3_.getModeLevel();
      if (oracle_level_ != oracle_v3_.getLevelMax()) {
        require(0 <= oracle_level_ && oracle_level_ < oracle_v3_.getLevelMax(),
                "vo1");
        // Translate the mode level to the exchange rate.
        uint exchange_rate = LEVEL_TO_EXCHANGE_RATE[oracle_level_];

        // Calculate the amount of coins to be minted or burned based on the
        // Quantity Theory of Money. If the exchnage rate is 1.1 (i.e., 1 coin
        // = 1.1 USD), the total coin supply is increased by 10%. If the
        // exchange rate is 0.8 (i.e., 1 coin = 0.8 USD), the total coin supply
        // is decreased by 20%.
        delta = coin_v2_.totalSupply().toInt256() *
                (int(exchange_rate) - int(EXCHANGE_RATE_DIVISOR)) /
                int(EXCHANGE_RATE_DIVISOR);

        // To avoid increasing or decreasing too many coins in one phase,
        // multiply the damping factor.
        delta = delta * int(DAMPING_FACTOR) / 100;

        // Increase or decrease the total coin supply.
        mint = _controlSupply(delta);
        
        // Translate the mode level to the tax rate.
        tax_rate = LEVEL_TO_TAX_RATE[oracle_level_];
      }

      // Burn the tax. This is fine because the purpose of the tax is to
      // decrease the total coin supply.
      address tax_account = coin_v2_.tax_account_();
      uint burned_tax = coin_v2_.balanceOf(tax_account);
      coin_v2_.burn(tax_account, burned_tax);
      coin_v2_.setTaxRate(tax_rate);

      // Advance to the next phase. Provide the |mint| coins to the oracle
      // as a reward.
      coin_v2_.transferOwnership(address(oracle_v3_));
      uint burned = oracle_v3_.advance(coin_v2_, mint);
      oracle_v3_.revokeOwnership(coin_v2_);
      
      logging_v2_.phaseUpdated(mint, burned, delta, bond_budget_,
                               coin_v2_.totalSupply(), bond_v2_.totalSupply(),
                               oracle_level_, current_phase_start_, burned_tax);
    }

    coin_v2_.transferOwnership(address(oracle_v3_));

    // Commit.
    //
    // The voter needs to deposit the DEPOSIT_RATE percentage of their coin
    // balance.
    result.deposited = coin_v2_.balanceOf(msg.sender) * DEPOSIT_RATE / 100;
    if (committed_hash == 0) {
      result.deposited = 0;
    }
    result.commit_result = oracle_v3_.commit(
        coin_v2_, msg.sender, committed_hash, result.deposited);
    if (!result.commit_result) {
      result.deposited = 0;
    }
    
    // Reveal.
    result.reveal_result = oracle_v3_.reveal(
        msg.sender, revealed_level, revealed_salt);
    
    // Reclaim.
    (result.reclaimed, result.rewarded) =
        oracle_v3_.reclaim(coin_v2_, msg.sender);

    oracle_v3_.revokeOwnership(coin_v2_);
    
    logging_v2_.voted(result.commit_result, result.reveal_result,
                      result.deposited, result.reclaimed, result.rewarded);
    emit VoteEvent(
        msg.sender, committed_hash, revealed_level, revealed_salt,
        result.commit_result, result.reveal_result, result.deposited,
        result.reclaimed, result.rewarded, result.phase_updated);
    return (result.commit_result, result.reveal_result, result.deposited,
            result.reclaimed, result.rewarded, result.phase_updated);
  }

  // Purchase bonds.
  //
  // Parameters
  // ----------------
  // |count|: The number of bonds to purchase.
  //
  // Returns
  // ----------------
  // The redemption timestamp of the purchased bonds if it succeeds. 0
  // otherwise.
  function purchaseBonds(uint count)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    if (count <= 0) {
      return 0;
    }
    if (bond_budget_ < count.toInt256()) {
      // ACB does not have enough bonds to issue.
      return 0;
    }

    uint bond_price = LEVEL_TO_BOND_PRICE[oracle_v3_.getLevelMax() - 1];
    if (0 <= oracle_level_ && oracle_level_ < oracle_v3_.getLevelMax()) {
      bond_price = LEVEL_TO_BOND_PRICE[oracle_level_];
    }
    uint amount = bond_price * count;
    if (coin_v2_.balanceOf(sender) < amount) {
      // The user does not have enough coins to purchase the bonds.
      return 0;
    }

    // Set the redemption timestamp of the bonds.
    uint redemption = getTimestamp() + BOND_REDEMPTION_PERIOD;

    // Issue new bonds
    bond_v2_.mint(sender, redemption, count);
    bond_budget_ -= count.toInt256();
    require(bond_budget_ >= 0, "pb1");
    require(bond_v2_.totalSupply().toInt256() + bond_budget_ >= 0, "pb2");
    require(bond_v2_.balanceOf(sender, redemption) > 0, "pb3");

    // Burn the corresponding coins.
    coin_v2_.burn(sender, amount);

    logging_v2_.purchasedBonds(count);
    emit PurchaseBondsEvent(sender, count, redemption);
    return redemption;
  }
  
  // Redeem bonds.
  //
  // Parameters
  // ----------------
  // |redemptions|: A list of bonds the user wants to redeem. Bonds are
  // identified by their redemption timestamps.
  //
  // Returns
  // ----------------
  // The number of successfully redeemed bonds.
  function redeemBonds(uint[] memory redemptions)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    uint count_total = 0;
    for (uint i = 0; i < redemptions.length; i++) {
      uint redemption = redemptions[i];
      uint count = bond_v2_.balanceOf(sender, redemption);
      if (redemption > getTimestamp()) {
        // If the bonds have not yet hit their redemption timestamp, the ACB
        // accepts the redemption as long as |bond_budget_| is negative.
        if (bond_budget_ >= 0) {
          continue;
        }
        if (count > (-bond_budget_).toUint256()) {
          count = (-bond_budget_).toUint256();
        }
      }

      // Mint the corresponding coins to the user's balance.
      uint amount = count * BOND_REDEMPTION_PRICE;
      coin_v2_.mint(sender, amount);

      // Burn the redeemed bonds.
      bond_budget_ += count.toInt256();
      bond_v2_.burn(sender, redemption, count);
      count_total += count;
    }
    require(bond_v2_.totalSupply().toInt256() + bond_budget_ >= 0, "rb1");
    
    logging_v2_.redeemedBonds(count_total);
    emit RedeemBondsEvent(sender, redemptions, count_total);
    return count_total;
  }

  // Increase or decrease the total coin supply.
  //
  // Parameters
  // ----------------
  // |delta|: If |delta| is positive, it indicates the amount of coins to be
  // minted. If |delta| is negative, it indicates the amount of coins to be
  // burned.
  //
  // Returns
  // ----------------
  // The amount of coins that need to be newly minted by the ACB.
  function _controlSupply(int delta)
      internal whenNotPaused returns (uint) {
    uint mint = 0;
    if (delta == 0) {
      // No change in the total coin supply.
      bond_budget_ = 0;
    } else if (delta > 0) {
      // Increase the total coin supply.
      uint count = delta.toUint256() / BOND_REDEMPTION_PRICE;
      if (count <= bond_v2_.totalSupply()) {
        // If there are sufficient bonds to redeem, increase the total coin
        // supply by redeeming the bonds.
        bond_budget_ = -count.toInt256();
      } else {
        // Otherwise, redeem all the issued bonds.
        bond_budget_ = -bond_v2_.totalSupply().toInt256();
        // The ACB needs to mint the remaining coins.
        mint = (count - bond_v2_.totalSupply()) * BOND_REDEMPTION_PRICE;
      }
      require(bond_budget_ <= 0, "cs1");
    } else {
      require(0 <= oracle_level_ && oracle_level_ < oracle_v3_.getLevelMax(),
              "cs2");
      // Issue new bonds to decrease the total coin supply.
      bond_budget_ = -delta / LEVEL_TO_BOND_PRICE[oracle_level_].toInt256();
      require(bond_budget_ >= 0, "cs3");
    }

    require(bond_v2_.totalSupply().toInt256() + bond_budget_ >= 0, "cs4");
    emit ControlSupplyEvent(delta, bond_budget_, mint);
    return mint;
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
  function hash(uint level, uint salt)
      public view returns (bytes32) {
    address sender = msg.sender;
    return oracle_v3_.hash(sender, level, salt);
  }
  
  // Return the current timestamp in seconds.
  function getTimestamp()
      public virtual view returns (uint) {
    // block.timestamp is better than block.number because the granularity of
    // the phase update is PHASE_DURATION (1 week).
    return block.timestamp;
  }

}
