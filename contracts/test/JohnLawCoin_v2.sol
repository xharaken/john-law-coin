// SPDX-License-Identifier: Apache-2.0
//
// Copyright 2021 Google LLC
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

pragma solidity >=0.7.1 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/SignedSafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";
import "openzeppelin-solidity/contracts/utils/SafeCast.sol";

import "../JohnLawCoin.sol";

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
contract Oracle_v2 is OwnableUpgradeable {
  using SafeMath for uint;
  uint constant internal UINT_MAX = 2 ** 256 - 1;

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
    
    // Reserved for future use.
    uint[6] __reserved;
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
    
    // Reserved for future use.
    uint[8] __reserved;
  }

  // Epoch is a struct to keep track of states in the commit-reveal-reclaim
  // scheme. The oracle creates three Epoch objects and uses them in a
  // round-robin manner. For example, when the first Epoch object is in use for
  // the commit phase, the second Epoch object is in use for the reveal phase,
  // and the third Epoch object is in use for the reclaim phase.
  struct Epoch {
    // The commit entries.
    mapping (address => Commit) commits;
    // The voting statistics for all the oracle levels.
    Vote[] votes;
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
    
    // Reserved for future use.
    uint[17] __reserved;
  }

  // Attributes. See the comment in initialize().
  Epoch[3] public epochs_;
  uint public epoch_timestamp_;

  uint public epoch_timestamp_v2_;
  
  // Events.
  event CommitEvent(address indexed, bytes32, uint);
  event RevealEvent(address indexed, uint, uint);
  event ReclaimEvent(address indexed, uint, uint);
  event AdvancePhaseEvent(uint indexed, uint, uint);

  function upgrade()
      public onlyOwner {
    epoch_timestamp_v2_ = epoch_timestamp_;
    for (uint epoch_index = 0; epoch_index < 3; epoch_index++) {
      epochs_[epoch_index].deposit_account_v2 =
          epochs_[epoch_index].deposit_account;
      epochs_[epoch_index].reward_account_v2 =
          epochs_[epoch_index].reward_account;
      epochs_[epoch_index].reward_total_v2 =
          epochs_[epoch_index].reward_total;
      epochs_[epoch_index].phase_v2 =
          epochs_[epoch_index].phase;
      for (uint level = 0; level < epochs_[epoch_index].votes.length; level++) {
        Vote storage vote = epochs_[epoch_index].votes[level];
        vote.should_reclaim_v2 = vote.should_reclaim;
        vote.should_reward_v2 = vote.should_reward;
        vote.deposit_v2 = vote.deposit;
        vote.count_v2 = vote.count;
      }
    }
  }

  // Initializer.
  function initialize()
      public initializer {
    __Ownable_init();

    // ----------------
    // Constants
    // ----------------
    
    // The number of the oracle levels.
    LEVEL_MAX = 9;
    
    // If the "truth" level is 4 and RECLAIM_THRESHOLD is 1, the voters who
    // voted for 3, 4 and 5 can reclaim their deposited coins. Other voters
    // lose their deposited coins.
    RECLAIM_THRESHOLD = 1;
    
    // The lost coins and the coins minted by the ACB are distributed to the
    // voters who voted for the "truth" level as a reward. The
    // PROPORTIONAL_REWARD_RATE of the reward is distributed to the voters in
    // proportion to the coins they deposited. The rest of the reward is
    // distributed to the voters evenly.
    PROPORTIONAL_REWARD_RATE = 90; // 90%

    // ----------------
    // Attributes
    // ----------------

    // The oracle creates three Epoch objects and uses them in a round-robin
    // manner (commit => reveal => reclaim).
    for (uint epoch_index = 0; epoch_index < 3; epoch_index++) {
      for (uint level = 0; level < LEVEL_MAX; level++) {
        epochs_[epoch_index].votes.push(
            Vote(0, 0, false, false, false, false, 0, 0,
                 [UINT_MAX, UINT_MAX, UINT_MAX, UINT_MAX, UINT_MAX,
                  UINT_MAX, UINT_MAX, UINT_MAX]));
      }
      epochs_[epoch_index].deposit_account =
          address(uint160(uint(keccak256(abi.encode(
              "deposit_account_address", epoch_index)))));
      epochs_[epoch_index].reward_account =
          address(uint160(uint(keccak256(abi.encode(
              "reward_account_address", epoch_index)))));
      epochs_[epoch_index].reward_total = 0;
    }
    epochs_[0].phase = Phase.COMMIT;
    epochs_[1].phase = Phase.RECLAIM;
    epochs_[2].phase = Phase.REVEAL;

    // |epoch_timestamp_| is a monotonically increasing timestamp (3, 4, 5, ...
    // ). The Epoch object at |epoch_timestamp_ % 3| is in the commit phase.
    // The Epoch object at |(epoch_timestamp_ - 1) % 3| is in the reveal phase.
    // The Epoch object at |(epoch_timestamp_ - 2) % 3| is in the reclaim phase.
    // The timestamp starts with 3 because 0 in the commit entry is not
    // distinguishable from an uninitialized commit entry in Solidity.
    epoch_timestamp_ = 3;
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
  function commit(JohnLawCoin coin, address sender,
                  bytes32 committed_hash, uint deposit)
      public onlyOwner returns (bool) {
    return commit_v2(coin, sender, committed_hash, deposit);
  }
  
  function commit_v2(JohnLawCoin coin, address sender,
                     bytes32 committed_hash, uint deposit)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[epoch_timestamp_v2_.mod(3)];
    require(epoch.phase_v2 == Phase.COMMIT, "commit: 1");
    if (coin.balanceOf(sender) < deposit) {
      return false;
    }
    // One voter can commit only once per epoch.
    if (epoch.commits[sender].epoch_timestamp == epoch_timestamp_v2_) {
      return false;
    }

    // Create a commit entry.
    epoch.commits[sender] = Commit(
        committed_hash, deposit, LEVEL_MAX, Phase.COMMIT, epoch_timestamp_v2_,
        committed_hash, deposit, LEVEL_MAX, epoch_timestamp_v2_,
        [UINT_MAX, UINT_MAX, UINT_MAX, UINT_MAX, UINT_MAX, UINT_MAX]);
    require(epoch.commits[sender].phase == Phase.COMMIT, "commit: 2");

    // Move the deposited coins to the deposit account.
    coin.move(sender, epoch.deposit_account_v2, deposit);
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
    return reveal_v2(sender, revealed_level, revealed_salt);
  }
  
  function reveal_v2(address sender, uint revealed_level, uint revealed_salt)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[(epoch_timestamp_v2_.sub(1)).mod(3)];
    require(epoch.phase_v2 == Phase.REVEAL, "reveal: 1");
    if (revealed_level < 0 || LEVEL_MAX <= revealed_level) {
      return false;
    }
    if (epoch.commits[sender].epoch_timestamp != epoch_timestamp_v2_.sub(1)) {
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
    epoch.votes[revealed_level].deposit_v2 =
        epoch.votes[revealed_level].deposit_v2.add(
            epoch.commits[sender].deposit);
    epoch.votes[revealed_level].count_v2 =
        epoch.votes[revealed_level].count_v2.add(1);
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
  // A tuple of two values:
  //  - uint: The amount of reclaimed coins. This becomes a positive number when
  //    the voter is eligible to reclaim their deposited coins.
  //  - uint: The amount of reward. This becomes a positive number when the
  //    voter voted for the "truth" oracle level.
  function reclaim(JohnLawCoin coin, address sender)
      public onlyOwner returns (uint, uint) {
    return reclaim_v2(coin, sender);
  }
  
  function reclaim_v2(JohnLawCoin coin, address sender)
      public onlyOwner returns (uint, uint) {
    Epoch storage epoch = epochs_[(epoch_timestamp_v2_.sub(2)).mod(3)];
    require(epoch.phase_v2 == Phase.RECLAIM, "reclaim: 1");
    if (epoch.commits[sender].epoch_timestamp != epoch_timestamp_v2_.sub(2)){
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
    require(0 <= revealed_level && revealed_level < LEVEL_MAX, "reclaim: 2");

    if (!epoch.votes[revealed_level].should_reclaim_v2) {
      return (0, 0);
    }

    require(epoch.votes[revealed_level].count_v2 > 0, "reclaim: 3");
    // Reclaim the deposited coins.
    coin.move(epoch.deposit_account_v2, sender, deposit);

    uint reward = 0;
    if (epoch.votes[revealed_level].should_reward_v2) {
      // The voter who voted for the "truth" level can receive the reward.
      //
      // The PROPORTIONAL_REWARD_RATE of the reward is distributed to the
      // voters in proportion to the coins they deposited. This incentivizes
      // voters who have many coins (and thus have more power on determining
      // the "truth" level) to join the oracle.
      //
      // The rest of the reward is distributed to the voters evenly. This
      // incentivizes more voters (including new voters) to join the oracle.
      if (epoch.votes[revealed_level].deposit_v2 > 0) {
        reward = reward.add(
            (uint(PROPORTIONAL_REWARD_RATE).mul(epoch.reward_total_v2)
                 .mul(deposit))
            .div((uint(100).mul(epoch.votes[revealed_level].deposit_v2))));
      }
      reward = reward.add(
          ((uint(100).sub(PROPORTIONAL_REWARD_RATE))
               .mul(epoch.reward_total_v2))
          .div(uint(100).mul(epoch.votes[revealed_level].count_v2)));
      coin.move(epoch.reward_account_v2, sender, reward);
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
  function advance(JohnLawCoin coin, uint mint)
      public onlyOwner returns (uint) {
    return advance_v2(coin, mint);
  }
  
  function advance_v2(JohnLawCoin coin, uint mint)
      public onlyOwner returns (uint) {
    // Step 1: Move the commit phase to the reveal phase.
    Epoch storage epoch = epochs_[epoch_timestamp_v2_.mod(3)];
    require(epoch.phase_v2 == Phase.COMMIT, "advance: 1");
    epoch.phase_v2 = Phase.REVEAL;

    // Step 2: Move the reveal phase to the reclaim phase.
    epoch = epochs_[(epoch_timestamp_v2_.sub(1)).mod(3)];
    require(epoch.phase_v2 == Phase.REVEAL, "advance: 2");

    // The "truth" level is set to the mode of the votes.
    uint mode_level = getModeLevel();
    if (0 <= mode_level && mode_level < LEVEL_MAX) {
      uint deposit_voted = 0;
      uint deposit_to_reclaim = 0;
      for (uint level = 0; level < LEVEL_MAX; level++) {
        require(epoch.votes[level].should_reclaim_v2 == false, "advance: 3");
        require(epoch.votes[level].should_reward_v2 == false, "advance: 4");
        deposit_voted = deposit_voted.add(epoch.votes[level].deposit_v2);
        if ((mode_level < RECLAIM_THRESHOLD ||
             mode_level.sub(RECLAIM_THRESHOLD) <= level) &&
            level <= mode_level.add(RECLAIM_THRESHOLD)) {
          // Voters who voted for the oracle levels in [mode_level -
          // reclaim_threshold, mode_level + reclaim_threshold] are eligible
          // to reclaim their deposited coins. Other voters lose their deposited
          // coins.
          epoch.votes[level].should_reclaim_v2 = true;
          deposit_to_reclaim =
              deposit_to_reclaim.add(epoch.votes[level].deposit_v2);
        }
      }

      // Voters who voted for the "truth" level are eligible to receive the
      // reward.
      epoch.votes[mode_level].should_reward_v2 = true;

      // Note: |deposit_voted| is equal to |balanceOf(epoch.deposit_account_v2)|
      // only when all the voters who voted in the commit phase revealed
      // their votes correctly in the reveal phase.
      require(deposit_voted <= coin.balanceOf(epoch.deposit_account_v2),
              "advance: 5");
      require(
          deposit_to_reclaim <= coin.balanceOf(epoch.deposit_account_v2),
          "advance: 6");

      // The lost coins are moved to the reward account.
      coin.move(
          epoch.deposit_account_v2,
          epoch.reward_account_v2,
          coin.balanceOf(epoch.deposit_account_v2).sub(deposit_to_reclaim));
    }

    // Mint |mint| coins to the reward account.
    coin.mint(epoch.reward_account_v2, mint);

    // Set the total amount of the reward.
    epoch.reward_total_v2 = coin.balanceOf(epoch.reward_account_v2);
    epoch.phase_v2 = Phase.RECLAIM;

    // Step 3: Move the reclaim phase to the commit phase.
    epoch = epochs_[(epoch_timestamp_v2_.sub(2)).mod(3)];
    require(epoch.phase_v2 == Phase.RECLAIM, "advance: 7");

    uint burned = (coin.balanceOf(epoch.deposit_account_v2))
                  .add(coin.balanceOf(epoch.reward_account_v2));
    // Burn the remaining deposited coins.
    coin.burn(epoch.deposit_account_v2, coin.balanceOf(
        epoch.deposit_account_v2));
    // Burn the remaining reward.
    coin.burn(epoch.reward_account_v2, coin.balanceOf(epoch.reward_account_v2));

    // Initialize the epoch for the next commit phase.
    //
    // |epoch.commits_| cannot be cleared due to the restriction of Solidity.
    // |epoch_timestamp_v2_| ensures the stale commit entries are not used.
    for (uint level = 0; level < LEVEL_MAX; level++) {
      epoch.votes[level] =
          Vote(0, 0, false, false, false, false, 0, 0,
               [UINT_MAX, UINT_MAX, UINT_MAX, UINT_MAX, UINT_MAX,
                UINT_MAX, UINT_MAX, UINT_MAX]);
    }
    require(coin.balanceOf(epoch.deposit_account_v2) == 0, "advance: 8");
    require(coin.balanceOf(epoch.reward_account_v2) == 0, "advance: 9");
    epoch.reward_total_v2 = 0;
    epoch.phase_v2 = Phase.COMMIT;

    // Advance the phase.
    epoch_timestamp_v2_ = epoch_timestamp_v2_.add(1);

    emit AdvancePhaseEvent(epoch_timestamp_v2_, mint, burned);
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
    return getModeLevel_v2();
  }
  
  function getModeLevel_v2()
      public onlyOwner view returns (uint) {
    Epoch storage epoch = epochs_[(epoch_timestamp_v2_.sub(1)).mod(3)];
    require(epoch.phase_v2 == Phase.REVEAL, "getModeLevel: 1");
    uint mode_level = LEVEL_MAX;
    uint max_deposit = 0;
    uint max_count = 0;
    for (uint level = 0; level < LEVEL_MAX; level++) {
      if (epoch.votes[level].count_v2 > 0 &&
          (mode_level == LEVEL_MAX ||
           max_deposit < epoch.votes[level].deposit_v2 ||
           (max_deposit == epoch.votes[level].deposit_v2 &&
            max_count < epoch.votes[level].count_v2))){
        max_deposit = epoch.votes[level].deposit_v2;
        max_count = epoch.votes[level].count_v2;
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
  function revokeOwnership(JohnLawCoin coin)
      public onlyOwner {
    return revokeOwnership_v2(coin);
  }
  
  function revokeOwnership_v2(JohnLawCoin coin)
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
    require(0 <= epoch_index && epoch_index <= 2, "getVote: 1");
    require(0 <= level && level < epochs_[epoch_index].votes.length,
            "getVote: 2");
    Vote memory vote = epochs_[epoch_index].votes[level];
    return (vote.deposit_v2, vote.count_v2, vote.should_reclaim_v2,
            vote.should_reward_v2);
  }

  // Public getter: Return the Commit struct at |epoch_index| and |account|.
  function getCommit(uint epoch_index, address account)
      public view returns (bytes32, uint, uint, Phase, uint) {
    require(0 <= epoch_index && epoch_index <= 2, "getCommit: 1");
    Commit memory entry = epochs_[epoch_index].commits[account];
    return (entry.committed_hash, entry.deposit, entry.revealed_level,
            entry.phase, entry.epoch_timestamp);
  }

  // Public getter: Return the Epoch struct at |epoch_index|.
  function getEpoch(uint epoch_index)
      public view returns (address, address, uint, Phase) {
    require(0 <= epoch_index && epoch_index <= 2, "getEpoch: 1");
    return (epochs_[epoch_index].deposit_account_v2,
            epochs_[epoch_index].reward_account_v2,
            epochs_[epoch_index].reward_total_v2,
            epochs_[epoch_index].phase_v2);
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
    return hash_v2(sender, level, salt);
  }
  
  function hash_v2(address sender, uint level, uint salt)
      public pure returns (bytes32) {
    return keccak256(abi.encode(sender, level, salt));
  }
}

//------------------------------------------------------------------------------
// [Logging contract]
//
// The Logging contract records metrics about JohnLawCoin. The logs are useful
// to analyze JohnLawCoin's historical trend.
//------------------------------------------------------------------------------
contract Logging_v2 is Ownable {
  using SafeMath for uint;
  using SignedSafeMath for int;
  
  // A struct to record metrics about the voting.
  struct VoteLog {
    uint commit_succeeded;
    uint commit_failed;
    uint reveal_succeeded;
    uint reveal_failed;
    uint reclaim_succeeded;
    uint reward_succeeded;
    uint deposited;
    uint reclaimed;
    uint rewarded;
  }

  // A struct to record metrics about the ACB.
  struct ACBLog {
    uint minted_coins;
    uint burned_coins;
    int coin_supply_delta;
    int bond_budget;
    uint purchased_bonds;
    uint redeemed_bonds;
    uint coin_total_supply;
    uint bond_total_supply;
    uint oracle_level;
    uint current_phase_start;
  }

  // The maximum number of logs.
  uint constant LOG_MAX = 1000;
  
  // The index of the current log. When the index exceeds Logging.LOG_MAX,
  // the index is reset to 0.
  uint public log_index_ = 0;
  
  // The logs about the voting.
  VoteLog[LOG_MAX] public vote_logs_;
  
  // The logs about the ACB.
  ACBLog[LOG_MAX] public acb_logs_;

  // Constructor.
  constructor() {
  }

  function getVoteLog(uint log_index)
      public view returns (
          uint, uint, uint, uint, uint, uint, uint, uint, uint) {
    VoteLog memory log = vote_logs_[log_index];
    return (log.commit_succeeded, log.commit_failed, log.reveal_succeeded,
            log.reveal_failed, log.reclaim_succeeded, log.reward_succeeded,
            log.deposited, log.reclaimed, log.rewarded);
  }

  function getACBLog(uint log_index)
      public view returns (
          uint, uint, int, int, uint, uint, uint, uint, uint, uint) {
    ACBLog memory log = acb_logs_[log_index];
    return (log.minted_coins, log.burned_coins, log.coin_supply_delta,
            log.bond_budget, log.purchased_bonds, log.redeemed_bonds,
            log.coin_total_supply, log.bond_total_supply,
            log.oracle_level, log.current_phase_start);
  }

  // Called when the oracle phase is updated.
  //
  // Parameters
  // ----------------
  // |current_phase_start|: ACB.current_phase_start_.
  // |bond_budget|: ACB.bond_budget_.
  // |delta|: The delta of the total coin supply.
  // |oracle_level|: ACB.oracle_level_.
  // |mint|: The amount of the minted coins.
  // |burned|: The amount of the burned coins.
  // |coin_total_supply|: The total coin supply.
  // |bond_total_supply|: The total bond supply.
  //
  // Returns
  // ----------------
  // None.
  function phaseUpdated(uint current_phase_start, int bond_budget, int delta,
                        uint oracle_level, uint mint, uint burned,
                        uint coin_total_supply, uint bond_total_supply)
      public onlyOwner {
    log_index_ = (log_index_.add(1)).div(LOG_MAX);
    vote_logs_[log_index_] =
        VoteLog(0, 0, 0, 0, 0, 0, 0, 0, 0);
    acb_logs_[log_index_] =
        ACBLog(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      
    acb_logs_[log_index_].current_phase_start = current_phase_start;
    acb_logs_[log_index_].bond_budget = bond_budget;
    acb_logs_[log_index_].coin_supply_delta = delta;
    acb_logs_[log_index_].oracle_level = oracle_level;
    acb_logs_[log_index_].minted_coins = mint;
    acb_logs_[log_index_].burned_coins = burned;
    acb_logs_[log_index_].coin_total_supply = coin_total_supply;
    acb_logs_[log_index_].bond_total_supply = bond_total_supply;
  }

  // Called when ACB.vote is called.
  //
  // Parameters
  // ----------------
  // |commit_result|: Whether the commit succeeded or not.
  // |deposit|: The amount of the deposited coins.
  // |reveal_result|: Whether the reveal succeeded or not.
  // |reclaimed|: The amount of the reclaimed coins.
  // |reward|: The amount of the reward.
  //
  // Returns
  // ----------------
  // None.
  function voted(bool commit_result, bool reveal_result, uint deposit,
                 uint reclaimed, uint reward)
      public onlyOwner {
    if (commit_result) {
      vote_logs_[log_index_].commit_succeeded =
          vote_logs_[log_index_].commit_succeeded.add(1);
    } else {
      vote_logs_[log_index_].commit_failed =
          vote_logs_[log_index_].commit_failed.add(1);
    }
    if (reveal_result) {
      vote_logs_[log_index_].reveal_succeeded =
          vote_logs_[log_index_].reveal_succeeded.add(1);
    } else {
      vote_logs_[log_index_].reveal_failed =
          vote_logs_[log_index_].reveal_failed.add(1);
    }
    if (reclaimed > 0) {
      vote_logs_[log_index_].reclaim_succeeded =
          vote_logs_[log_index_].reclaim_succeeded.add(1);
    }
    if (reward > 0) {
      vote_logs_[log_index_].reward_succeeded =
          vote_logs_[log_index_].reward_succeeded.add(1);
    }
    vote_logs_[log_index_].deposited =
        vote_logs_[log_index_].deposited.add(deposit);
    vote_logs_[log_index_].reclaimed =
        vote_logs_[log_index_].reclaimed.add(reclaimed);
    vote_logs_[log_index_].rewarded =
        vote_logs_[log_index_].rewarded.add(reward);
  }

  // Called when ACB.purchaseBonds is called.
  //
  // Parameters
  // ----------------
  // |count|: The number of purchased bonds.
  //
  // Returns
  // ----------------
  // None.
  function purchasedBonds(uint count)
      public onlyOwner {
    acb_logs_[log_index_].purchased_bonds =
        acb_logs_[log_index_].purchased_bonds.add(count);
  }

  // Called when ACB.redeemBonds is called.
  //
  // Parameters
  // ----------------
  // |count|: The number of redeemded bonds.
  //
  // Returns
  // ----------------
  // None.
  function redeemedBonds(uint count)
      public onlyOwner {
    acb_logs_[log_index_].redeemed_bonds =
        acb_logs_[log_index_].redeemed_bonds.add(count);
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
// are initialize(), pause() and unpause(). These methods can be called only by
// the genesis account. This is needed for the genesis account to upgrade the
// smart contract and fix bugs in a development phase.
//------------------------------------------------------------------------------
contract ACB_v2 is OwnableUpgradeable, PausableUpgradeable {
  using SafeMath for uint;
  using SignedSafeMath for int;
  using SafeCast for uint;
  using SafeCast for int;

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'internal' (instead of
  // 'constant') because tests want to override the values.
  uint internal BOND_REDEMPTION_PRICE;
  uint internal BOND_REDEMPTION_PERIOD;
  uint[] internal LEVEL_TO_EXCHANGE_RATE;
  uint internal EXCHANGE_RATE_DIVISOR;
  uint[] internal LEVEL_TO_BOND_PRICE;
  uint internal PHASE_DURATION;
  uint internal DEPOSIT_RATE;
  uint internal DAMPING_FACTOR;
  uint internal INITIAL_COIN_SUPPLY;

  // Used only in testing. This cannot be put in a derived contract due to
  // a restriction of @openzeppelin/truffle-upgrades.
  uint internal _timestamp_for_testing;

  // Attributes. See the comment in initialize().
  JohnLawCoin public coin_;
  JohnLawBond public bond_;
  int public bond_budget_;
  Oracle public oracle_;
  uint public oracle_level_;
  uint public current_phase_start_;
  Logging public logging_;

  JohnLawCoin public coin_v2_;
  JohnLawBond public bond_v2_;
  int public bond_budget_v2_;
  Oracle_v2 public oracle_v2_;
  uint public oracle_level_v2_;
  uint public current_phase_start_v2_;
  Logging_v2 public logging_v2_;

  // Events.
  event VoteEvent(address indexed, bytes32, uint, uint,
                  bool, bool, uint, uint, uint, bool);
  event PurchaseBondsEvent(address indexed, uint, uint);
  event RedeemBondsEvent(address indexed, uint[], uint);
  event ControlSupplyEvent(int, int, uint);

  function upgrade(Oracle_v2 oracle, Logging_v2 logging)
      public onlyOwner {
    coin_v2_ = coin_;
    bond_v2_ = bond_;
    bond_budget_v2_ = bond_budget_;
    oracle_v2_ = oracle;
    oracle_level_v2_ = oracle_level_;
    current_phase_start_v2_ = current_phase_start_;
    logging_v2_ = logging;
    oracle_v2_.upgrade();
  }

  // Initializer.
  //
  // Parameters
  // ----------------
  // |oracle|: The oracle contract. The ownership needs to be transferred to
  // the ACB.
  // |logging|: The logging contract. The ownership needs to be transferred to
  // the ACB.
  function initialize(Oracle oracle, Logging logging)
      public initializer {
    __Ownable_init();
    __Pausable_init();

    // ----------------
    // Constants
    // ----------------

    // The following table shows the mapping from the oracle levels to the
    // exchange rates and the bond prices. Voters can vote for one of the oracle
    // levels.
    //
    //  -------------------------------------------------------------
    //  | oracle level | exchange rate    | bond price              |
    //  |              |                  | (annual interest rate)  |
    //  -------------------------------------------------------------
    //  | 0            | 1 coin = 0.6 USD | 950 coins (25.0%)       |
    //  | 1            | 1 coin = 0.7 USD | 965 coins (16.7%)       |
    //  | 2            | 1 coin = 0.8 USD | 978 coins (10.1%)       |
    //  | 3            | 1 coin = 0.9 USD | 990 coins (4.46%)       |
    //  | 4            | 1 coin = 1.0 USD | 997 coins (1.31%)       |
    //  | 5            | 1 coin = 1.1 USD | 997 coins (1.31%)       |
    //  | 6            | 1 coin = 1.2 USD | 997 coins (1.31%)       |
    //  | 7            | 1 coin = 1.3 USD | 997 coins (1.31%)       |
    //  | 8            | 1 coin = 1.4 USD | 997 coins (1.31%)       |
    //  -------------------------------------------------------------
    //
    // Voters are expected to look up the current exchange rate using
    // real-world currency exchangers and vote for the oracle level that
    // corresponds to the exchange rate. Strictly speaking, the current
    // exchange rate is defined as the exchange rate at the point when the
    // current phase started (i.e., current_phase_start_).
    //
    // In the bootstrap phase in which no currency exchanger supports JLC <=>
    // USD conversions, voters are expected to vote for the oracle level 5
    // (i.e., 1 coin = 1.1 USD). This helps increase the total coin supply
    // gradually in the bootstrap phase and incentivize early adopters. Once
    // currency exchangers support the conversions, voters are expected to vote
    // for the oracle level that corresponds to the real-world exchange rate.
    //
    // LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
    // exchange rates. The real exchange rate is obtained by dividing the values
    // by EXCHANGE_RATE_DIVISOR. For example, 11 corresponds to the exchange
    // rate of 1.1. This translation is needed to avoid using decimal numbers in
    // the smart contract.
    LEVEL_TO_EXCHANGE_RATE = [6, 7, 8, 9, 10, 11, 12, 13, 14];
    EXCHANGE_RATE_DIVISOR = 10;

    // LEVEL_TO_BOND_PRICE is the mapping from the oracle levels to the
    // bond prices.
    LEVEL_TO_BOND_PRICE = [950, 965, 978, 990, 997, 997, 997, 997, 997];

    // The bond redemption price and the redemption period.
    BOND_REDEMPTION_PRICE = 1000; // One bond is redeemed for 1000 USD.
    BOND_REDEMPTION_PERIOD = 84 * 24 * 60 * 60; // 12 weeks.

    // The duration of the oracle phase. The ACB adjusts the total coin supply
    // once per phase. Voters can vote once per phase.
    PHASE_DURATION = 7 * 24 * 60 * 60; // 1 week.

    // The percentage of the coin balance the voter needs to deposit.
    DEPOSIT_RATE = 10; // 10%.

    // The damping factor to avoid minting or burning too many coins in one
    // phase.
    DAMPING_FACTOR = 10; // 10%.

    // The initial coin supply given to the genesis account.
    //
    // It is important to give a substantial amount of coins to the genesis
    // account so that the genesis account can have power to determine the
    // exchange rate until the ecosystem stabilizes. Once real-world currency
    // exchangers start converting JLC with USD and the oracle gets a sufficient
    // number of honest voters to agree on the real-world exchange rate
    // consistently, the genesis account can lose its power by decreasing its
    // coin balance. This mechanism is mandatory to stabilize the exchange rate
    // and bootstrap the ecosystem successfully.
    //
    // Specifically, the genesis account votes for the oracle level 5 until
    // real-world currency exchangers appear. Once real-world currency
    // exchangers appear, the genesis account votes for the oracle level
    // corresponding to the real-world exchange rate. Other voters are
    // expected to follow the genesis account. Once the oracle gets enough
    // honest voters, the genesis account decreases its coin balance and loses
    // its power, moving the oracle to a fully decentralized system.
    INITIAL_COIN_SUPPLY = 2100000; // 2.1 M USD

    // ----------------
    // Attributes
    // ----------------

    // The JohnLawCoin contract.
    coin_ = new JohnLawCoin();
    
    // The JohnLawBond contract.
    bond_ = new JohnLawBond();
    
    // If |bond_budget_| is positive, it indicates the number of bonds the ACM
    // wants to issue to decrease the total coin supply. If |bond_budget_| is
    // negative, it indicates the number of bonds the ACB wants to redeem to
    // increase the total coin supply.
    bond_budget_ = 0;
    
    // The timestamp when the current phase started.
    current_phase_start_ = 0;

    // The oracle contract.
    oracle_ = oracle;

    // The current oracle level.
    oracle_level_ = oracle.getLevelMax();

    // The logging contract.
    logging_ = logging;

    require(LEVEL_TO_EXCHANGE_RATE.length == oracle.getLevelMax(),
            "constructor: 1");
    require(LEVEL_TO_BOND_PRICE.length == oracle.getLevelMax(),
            "constructor: 2");
    
    // Mint the initial coins to the genesis account.
    coin_.mint(msg.sender, INITIAL_COIN_SUPPLY);
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
  // |committed_hash|: The hash to be committed in the current phase.
  // |revealed_level|: The oracle level to be revealed in the prior phase.
  // |revealed_salt|: The voter's salt to be revealed in the prior phase.
  //
  // Returns
  // ----------------
  // A tuple of six values:
  //  - boolean: Whether the commit succeeded or not.
  //  - boolean: Whether the reveal succeeded or not.
  //  - uint: The amount of the deposited coins.
  //  - uint: The amount of the reclaimed coins.
  //  - uint: The amount of the reward.
  //  - boolean: Whether this vote resulted in a phase update.
  function vote(bytes32 committed_hash, uint revealed_level,
                uint revealed_salt)
      public whenNotPaused returns (bool, bool, uint, uint, uint, bool) {
    return vote_v2(committed_hash, revealed_level, revealed_salt);
  }
  
  function vote_v2(bytes32 committed_hash, uint revealed_level,
                   uint revealed_salt)
      public whenNotPaused returns (bool, bool, uint, uint, uint, bool) {
    
    VoteResult memory result;
    
    // Temporarily transfer the ownership of the JohnLawCoin contract to the
    // oracle.
    coin_v2_.transferOwnership(address(oracle_v2_));
    
    result.phase_updated = false;
    if (getTimestamp() >= current_phase_start_.add(PHASE_DURATION)) {
      // Start a new phase.
      result.phase_updated = true;
      current_phase_start_ = getTimestamp();
      
      uint mint = 0;
      int delta = 0;
      oracle_level_ = oracle_v2_.getModeLevel();
      if (oracle_level_ != oracle_v2_.getLevelMax()) {
        require(0 <= oracle_level_ && oracle_level_ < oracle_v2_.getLevelMax(),
                "vote: 1");
        // Translate the mode level to the exchange rate.
        uint exchange_rate = LEVEL_TO_EXCHANGE_RATE[oracle_level_];

        // Calculate the amount of coins to be minted or burned based on the
        // Quantity Theory of Money. If the exchnage rate is 1.1 (i.e., 1 coin
        // = 1.1 USD), the total coin supply is increased by 10%. If the
        // exchange rate is 0.8 (i.e., 1 coin = 0.8 USD), the total coin supply
        // is decreased by 20%.
        delta = coin_v2_.totalSupply().toInt256()
                .mul(int(exchange_rate)
                         .sub(int(EXCHANGE_RATE_DIVISOR)))
                .div(int(EXCHANGE_RATE_DIVISOR));
        
        // To avoid increasing or decreasing too many coins in one phase,
        // multiply the damping factor.
        delta = delta.mul(int(DAMPING_FACTOR)).div(100);

        // Increase or decrease the total coin supply.
        mint = _controlSupply(delta);
      }

      // Advance to the next phase. Provide the |mint| coins to the oracle
      // as a reward.
      uint burned = oracle_v2_.advance(coin_v2_, mint);
      
      logging_v2_.phaseUpdated(current_phase_start_, bond_budget_, delta,
                               oracle_level_, mint, burned,
                               coin_.totalSupply(), bond_.totalSupply());
    }

    // Commit.
    //
    // The voter needs to deposit the DEPOSIT_RATE percentage of their coin
    // balance.
    result.deposited =
        coin_v2_.balanceOf(msg.sender).mul(DEPOSIT_RATE).div(100);
    result.commit_result = oracle_v2_.commit(
        coin_v2_, msg.sender, committed_hash, result.deposited);
    if (!result.commit_result) {
      result.deposited = 0;
    }
    
    // Reveal.
    result.reveal_result = oracle_v2_.reveal(
        msg.sender, revealed_level, revealed_salt);
    
    // Reclaim.
    (result.reclaimed, result.rewarded) =
        oracle_v2_.reclaim(coin_v2_, msg.sender);

    // Revoke the ownership of the JohnLawCoin contract from the oracle.
    oracle_v2_.revokeOwnership(coin_v2_);
    
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
    return purchaseBonds_v2(count);
  }

  function purchaseBonds_v2(uint count)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    if (count <= 0) {
      return 0;
    }
    if (bond_budget_ < count.toInt256()) {
      // ACB does not have enough bonds to issue.
      return 0;
    }

    uint bond_price = LEVEL_TO_BOND_PRICE[oracle_v2_.getLevelMax() - 1];
    if (0 <= oracle_level_ && oracle_level_ < oracle_v2_.getLevelMax()) {
      bond_price = LEVEL_TO_BOND_PRICE[oracle_level_];
    }
    uint amount = bond_price.mul(count);
    if (coin_v2_.balanceOf(sender) < amount) {
      // The user does not have enough coins to purchase the bonds.
      return 0;
    }

    // Set the redemption timestamp of the bonds.
    uint redemption = getTimestamp().add(BOND_REDEMPTION_PERIOD);

    // Issue new bonds
    bond_v2_.mint(sender, redemption, count);
    bond_budget_ = bond_budget_.sub(count.toInt256());
    require(bond_budget_ >= 0, "purchaseBonds: 1");
    require((bond_v2_.totalSupply().toInt256()).add(bond_budget_) >= 0,
            "purchaseBonds: 2");
    require(bond_v2_.balanceOf(sender, redemption) > 0, "purchaseBonds: 3");

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
    return redeemBonds_v2(redemptions);
  }

  function redeemBonds_v2(uint[] memory redemptions)
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
      uint amount = count.mul(BOND_REDEMPTION_PRICE);
      coin_v2_.mint(sender, amount);

      // Burn the redeemed bonds.
      bond_budget_ = bond_budget_.add(count.toInt256());
      bond_v2_.burn(sender, redemption, count);
      count_total = count_total.add(count);
    }
    require((bond_v2_.totalSupply().toInt256()).add(bond_budget_) >= 0,
            "redeemBonds: 1");
    
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
    return _controlSupply_v2(delta);
  }

  function _controlSupply_v2(int delta)
      internal whenNotPaused returns (uint) {
    uint mint = 0;
    if (delta == 0) {
      // No change in the total coin supply.
      bond_budget_ = 0;
    } else if (delta > 0) {
      // Increase the total coin supply.
      uint count = delta.toUint256().div(BOND_REDEMPTION_PRICE);
      if (count <= bond_v2_.totalSupply()) {
        // If there are sufficient bonds to redeem, increase the total coin
        // supply by redeeming the bonds.
        bond_budget_ = -count.toInt256();
      } else {
        // Otherwise, redeem all the issued bonds.
        bond_budget_ = -bond_v2_.totalSupply().toInt256();
        // The ACB needs to mint the remaining coins.
        mint = (count.sub(bond_v2_.totalSupply())).mul(BOND_REDEMPTION_PRICE);
      }
      require(bond_budget_ <= 0, "_controlSupply: 1");
    } else {
      require(0 <= oracle_level_ && oracle_level_ < oracle_v2_.getLevelMax(),
              "_controlSupply: 2");
      // Issue new bonds to decrease the total coin supply.
      bond_budget_ = -delta.div(LEVEL_TO_BOND_PRICE[oracle_level_].toInt256());
      require(bond_budget_ >= 0, "_controlSupply: 3");
    }

    require((bond_v2_.totalSupply().toInt256()).add(bond_budget_) >= 0,
            "_controlSupply: 4");
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
    return hash_v2(level, salt);
  }

  function hash_v2(uint level, uint salt)
      public view returns (bytes32) {
    address sender = msg.sender;
    return oracle_v2_.hash(sender, level, salt);
  }
  
  // Return the current timestamp in seconds.
  function getTimestamp()
      public virtual view returns (uint) {
    // block.timestamp is better than block.number because the granularity of
    // the phase update is PHASE_DURATION (1 week).
    return block.timestamp;
  }

}
