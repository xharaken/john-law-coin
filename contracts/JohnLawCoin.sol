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

//------------------------------------------------------------------------------
// [Overview]
//
// JohnLawCoin is a stable coin realized by an Algorithmic Central Bank (ACB).
// The system is fully decentralized and there is truly no gatekeeper.
//
// JohnLawCoin is a real-world experiment to verify the following assumption:
//
// - It is possible to stabilize the coin price with fully algorithmically
//   defined monetary policies without holding any collateral.
//
// If JohnLawCoin is successful and proves the assumption is correct, it will
// provide interesting insights for both non-fiat currencies and fiat
// currencies; i.e., 1) there is a way for non-fiat cryptocurrencies to
// stabilize their currency price without having any gatekeeper, and 2) there
// is a way for central banks of developing countries to implement a fixed
// exchange rate system without holding adequate USD reserves. This will
// upgrade human's understanding about money.
//
// JohnLawCoin has the following important properties:
//
// - There is truly no gatekeeper. The ACB is fully automated and no one
//   (including the author of the smart contract) has the privileges of
//   influencing the monetary policies of the ACB. This can be verified by the
//   fact that the smart contract has no operations that need privileged
//   permissions.
// - The smart contract is self-contained. There are no dependencies on other
//   smart contracts and external services.
// - All operations are guaranteed to terminate in the time complexity of O(1).
//   The time complexity of each operation is determined solely by the input
//   size of the operation and not affected by the state of the smart contract.
//
// See the whitepaper for more details
// (https://github.com/xharaken/john-law-coin/blob/main/docs/whitepaper.pdf).
//
// If you have any questions, add comments to the GitHub issues
// (https://github.com/xharaken/john-law-coin).
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// [JohnLawCoin contract]
//
// JohnLawCoin is implemented as ERC20 tokens.
//
// Permission: Only the ACB and its oracle can mint, burn and transfer the
// coins. Only the ACB can pause and unpause the contract. Coin holders can
// transfer their coins using ERC20's APIs.
//------------------------------------------------------------------------------
contract JohnLawCoin is ERC20Pausable, Ownable {
  string public constant NAME = "JohnLawCoin";
  string public constant SYMBOL = "JLC";

  // Constructor.
  //
  // Parameters
  // ----------------
  // None.
  constructor()
      ERC20(NAME, SYMBOL) {
  }

  // Mint coins to one account. Only the ACB and its oracle can call this
  // method.
  //
  // Parameters
  // ----------------
  // |account|: The account to which the coins are minted.
  // |amount|: The amount to be minted.
  //
  // Returns
  // ----------------
  // None.
  function mint(address account, uint256 amount)
      public onlyOwner {
    _mint(account, amount);
  }

  // Burn coins from one account. Only the ACB and its oracle can call this
  // method.
  //
  // Parameters
  // ----------------
  // |account|: The account from which the coins are burned.
  // |amount|: The amount to be burned.
  //
  // Returns
  // ----------------
  // None.
  function burn(address account, uint256 amount)
      public onlyOwner {
    _burn(account, amount);
  }

  // Move coins from one account to another account. Only the ACB and its
  // oracle can call this method. Coin holders should use ERC20's transfer
  // method instead.
  //
  // Parameters
  // ----------------
  // |sender|: The sender account.
  // |receiver|: The receiver account.
  // |amount|: The amount to be moved.
  //
  // Returns
  // ----------------
  // None.
  function move(address sender, address receiver, uint256 amount)
      public onlyOwner {
    _transfer(sender, receiver, amount);
  }

  // Pause the contract. Only the ACB can call this method.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // None.
  function pause()
      public onlyOwner {
    _pause();
  }
  
  // Unpause the contract. Only the ACB can call this method.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // None.
  function unpause()
      public onlyOwner {
    _unpause();
  }
}

//------------------------------------------------------------------------------
// [JohnLawBond contract]
//
// JohnLawBond is an implementation of the bonds to control the total coin
// supply. The bonds are not transferable.
//
// Permission: Only the ACB can mint and burn the bonds. 
//------------------------------------------------------------------------------
contract JohnLawBond is Ownable {
  using SafeMath for uint;

  // Bonds are specified by a pair of the user account and the redemption
  // timestamp. _balances[account][redemption] stores the balance of the bonds
  // held by the account with the redemption timestamp.
  mapping (address => mapping (uint => uint)) private _balances;
  
  // The total bond supply.
  uint private _totalSupply;

  // Events.
  event MintEvent(address, uint, uint256);
  event BurnEvent(address, uint, uint256);

  // Constructor.
  //
  // Parameters
  // ----------------
  // None.
  constructor() {
    _totalSupply = 0;
  }
  
  // Mint bonds to one account. Only the ACB can call this method.
  //
  // Parameters
  // ----------------
  // |account|: The account to which the bonds are minted.
  // |redemption|: The redemption timestamp of the bonds.
  // |amount|: The amount to be minted.
  //
  // Returns
  // ----------------
  // None.
  function mint(address account, uint redemption, uint256 amount)
      public onlyOwner {
    _balances[account][redemption] = _balances[account][redemption].add(amount);
    _totalSupply = _totalSupply.add(amount);
    emit MintEvent(account, redemption, amount);
  }

  // Burn bonds from one account. Only the ACB can call this method.
  //
  // Parameters
  // ----------------
  // |account|: The account from which the bonds are burned.
  // |redemption|: The redemption timestamp of the bonds.
  // |amount|: The amount to be burned.
  //
  // Returns
  // ----------------
  // None.
  function burn(address account, uint redemption, uint256 amount)
      public onlyOwner {
    _balances[account][redemption] = _balances[account][redemption].sub(amount);
    _totalSupply = _totalSupply.sub(amount);
    emit BurnEvent(account, redemption, amount);
  }

  // Public getter: Return the balance of the bonds held by the |account| with
  // the |redemption| timestamp.
  function balanceOf(address account, uint redemption)
      public view returns (uint) {
    return _balances[account][redemption];
  }

  // Public getter: Return the total bond supply.
  function totalSupply()
      public view returns (uint) {
    return _totalSupply;
  }
}

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
contract Oracle is OwnableUpgradeable {
  using SafeMath for uint;

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
  }

  // Attributes. See the comment in initialize().
  Epoch[3] public epochs_;
  uint public epoch_timestamp_;

  // Events.
  event CommitEvent(address indexed, bytes32, uint);
  event RevealEvent(address indexed, uint, uint);
  event ReclaimEvent(address indexed, uint);
  event AdvancePhaseEvent(uint indexed, uint, uint);

  // Initializer.
  //
  // Parameters
  // ----------------
  // None.
  function initialize()
      public initializer {
    __Ownable_init();

    // ----------------
    // Constants
    // ----------------
    
    // The number of the oracle levels.
    LEVEL_MAX = 7;
    
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
        epochs_[epoch_index].votes.push(Vote(0, 0, false, false));
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
    Epoch storage epoch = epochs_[epoch_timestamp_.mod(3)];
    require(epoch.phase == Phase.COMMIT,
            "commit: 1");
    if (coin.balanceOf(sender) < deposit) {
      return false;
    }
    // One voter can commit only once per epoch.
    if (epoch.commits[sender].epoch_timestamp == epoch_timestamp_) {
      return false;
    }

    // Create a commit entry.
    epoch.commits[sender] = Commit(
        committed_hash, deposit, LEVEL_MAX, Phase.COMMIT, epoch_timestamp_);
    require(epoch.commits[sender].phase == Phase.COMMIT,
            "commit: 2");

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
    Epoch storage epoch = epochs_[(epoch_timestamp_.sub(1)).mod(3)];
    require(epoch.phase == Phase.REVEAL,
            "reveal: 1");
    if (revealed_level < 0 || LEVEL_MAX <= revealed_level) {
      return false;
    }
    if (epoch.commits[sender].epoch_timestamp != epoch_timestamp_.sub(1)) {
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
    epoch.votes[revealed_level].deposit =
        epoch.votes[revealed_level].deposit.add(epoch.commits[sender].deposit);
    epoch.votes[revealed_level].count =
        epoch.votes[revealed_level].count.add(1);
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
  function reclaim(JohnLawCoin coin, address sender)
      public onlyOwner returns (uint) {
    Epoch storage epoch = epochs_[(epoch_timestamp_.sub(2)).mod(3)];
    require(epoch.phase == Phase.RECLAIM,
            "reclaim: 1");
    if (epoch.commits[sender].epoch_timestamp != epoch_timestamp_.sub(2)){
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
            "reclaim: 2");

    if (!epoch.votes[revealed_level].should_reclaim) {
      return 0;
    }

    uint reclaim_amount = 0;
    require(epoch.votes[revealed_level].count > 0,
            "reclaim: 3");
    // Reclaim the deposited coins.
    coin.move(epoch.deposit_account, sender, deposit);
    reclaim_amount = reclaim_amount.add(deposit);

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
      uint proportional_reward = 0;
      if (epoch.votes[revealed_level].deposit > 0) {
        proportional_reward =
            (uint(PROPORTIONAL_REWARD_RATE).mul(epoch.reward_total)
                 .mul(deposit))
                .div((uint(100).mul(epoch.votes[revealed_level].deposit)));
      }
      uint constant_reward =
          ((uint(100).sub(PROPORTIONAL_REWARD_RATE)).mul(epoch.reward_total))
          .div(uint(100).mul(epoch.votes[revealed_level].count));
      coin.move(epoch.reward_account,
                     sender,
                     proportional_reward.add(constant_reward));
      reclaim_amount = reclaim_amount.add(proportional_reward)
                       .add(constant_reward);
    }
    emit ReclaimEvent(sender, reclaim_amount);
    return reclaim_amount;
  }

  // Advance to the next phase. COMMIT => REVEAL, REVEAL => RECLAIM,
  // RECLAIM => COMMIT.
  //
  // Parameters
  // ----------------
  // |coin|: The JohnLawCoin contract.
  // |mint|: The amount of the coins minted for the reward in the reclaim phase.
  //
  // Returns
  // ----------------
  // None.
  function advance(JohnLawCoin coin, uint mint)
      public onlyOwner returns (uint) {
    // Step 1: Move the commit phase to the reveal phase.
    Epoch storage epoch = epochs_[epoch_timestamp_.mod(3)];
    require(epoch.phase == Phase.COMMIT,
            "advance: 1");
    epoch.phase = Phase.REVEAL;

    // Step 2: Move the reveal phase to the reclaim phase.
    epoch = epochs_[(epoch_timestamp_.sub(1)).mod(3)];
    require(epoch.phase == Phase.REVEAL,
            "advance: 2");

    // The "truth" level is set to the mode of the votes.
    uint mode_level = getModeLevel();
    if (0 <= mode_level && mode_level < LEVEL_MAX) {
      uint deposit_voted = 0;
      uint deposit_to_reclaim = 0;
      for (uint level = 0; level < LEVEL_MAX; level++) {
        require(epoch.votes[level].should_reclaim == false,
                "advance: 3");
        require(epoch.votes[level].should_reward == false,
                "advance: 4");
        deposit_voted = deposit_voted.add(epoch.votes[level].deposit);
        if ((mode_level < RECLAIM_THRESHOLD ||
             mode_level.sub(RECLAIM_THRESHOLD) <= level) &&
            level <= mode_level.add(RECLAIM_THRESHOLD)) {
          // Voters who voted for the oracle levels in [mode_level -
          // reclaim_threshold, mode_level + reclaim_threshold] are eligible
          // to reclaim their deposited coins. Other voters lose their deposited
          // coins.
          epoch.votes[level].should_reclaim = true;
          deposit_to_reclaim =
              deposit_to_reclaim.add(epoch.votes[level].deposit);
        }
      }

      // Voters who voted for the "truth" level are eligible to receive the
      // reward.
      epoch.votes[mode_level].should_reward = true;

      // Note: |deposit_voted| is equal to |balanceOf(epoch.deposit_account)|
      // only when all the voters who voted in the commit phase revealed
      // their votes correctly in the reveal phase.
      require(deposit_voted <= coin.balanceOf(epoch.deposit_account),
              "advance: 5");
      require(
          deposit_to_reclaim <= coin.balanceOf(epoch.deposit_account),
          "advance: 6");

      // The lost coins are moved to the reward account.
      coin.move(
          epoch.deposit_account,
          epoch.reward_account,
          coin.balanceOf(epoch.deposit_account).sub(deposit_to_reclaim));
    }

    // Mint |mint| coins to the reward account.
    coin.mint(epoch.reward_account, mint);

    // Set the total amount of the reward.
    epoch.reward_total = coin.balanceOf(epoch.reward_account);
    epoch.phase = Phase.RECLAIM;

    // Step 3: Move the reclaim phase to the commit phase.
    epoch = epochs_[(epoch_timestamp_.sub(2)).mod(3)];
    require(epoch.phase == Phase.RECLAIM,
            "advance: 7");

    uint burned = (coin.balanceOf(epoch.deposit_account))
                  .add(coin.balanceOf(epoch.reward_account));
    // Burn the remaining deposited coins.
    coin.burn(epoch.deposit_account, coin.balanceOf(epoch.deposit_account));
    // Burn the remaining reward.
    coin.burn(epoch.reward_account, coin.balanceOf(epoch.reward_account));

    // Initialize the epoch for the next commit phase.
    //
    // |epoch.commits_| cannot be cleared due to the restriction of Solidity.
    // |epoch_timestamp_| ensures the stale commit entries are not used.
    for (uint level = 0; level < LEVEL_MAX; level++) {
      epoch.votes[level] = Vote(0, 0, false, false);
    }
    require(coin.balanceOf(epoch.deposit_account) == 0,
            "advance: 8");
    require(coin.balanceOf(epoch.reward_account) == 0,
            "advance: 9");
    epoch.reward_total = 0;
    epoch.phase = Phase.COMMIT;

    // Advance the phase.
    epoch_timestamp_ = epoch_timestamp_.add(1);

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
    Epoch storage epoch = epochs_[(epoch_timestamp_.sub(1)).mod(3)];
    require(epoch.phase == Phase.REVEAL,
            "getModeLevel: 1");
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
  function revokeOwnership(JohnLawCoin coin)
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
    require(0 <= epoch_index && epoch_index <= 2,
            "get_vote: 1");
    require(0 <= level && level < epochs_[epoch_index].votes.length,
            "get_vote: 2");
    Vote memory vote = epochs_[epoch_index].votes[level];
    return (vote.deposit, vote.count, vote.should_reclaim, vote.should_reward);
  }

  // Public getter: Return the Commit struct at |epoch_index| and |account|.
  function getCommit(uint epoch_index, address account)
      public view returns (bytes32, uint, uint, Phase, uint) {
    require(0 <= epoch_index && epoch_index <= 2,
            "get_commit: 1");
    Commit memory entry = epochs_[epoch_index].commits[account];
    return (entry.committed_hash, entry.deposit, entry.revealed_level,
            entry.phase, entry.epoch_timestamp);
  }

  // Public getter: Return the Epoch struct at |epoch_index|.
  function getEpoch(uint epoch_index)
      public view returns (address, address, uint, Phase) {
    require(0 <= epoch_index && epoch_index <= 2,
            "get_epoch: 1");
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
// are initialize(), pause() and unpause(). These methods can be called only by
// the genesis account. This is needed for the genesis account to upgrade the
// smart contract and fix bugs in a development phase.
//------------------------------------------------------------------------------
contract ACB is OwnableUpgradeable, PausableUpgradeable {
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

  // Attributes. See the comment in initialize().
  JohnLawCoin public coin_;
  JohnLawBond public bond_;
  int public bond_budget_;
  Oracle public oracle_;
  uint public oracle_level_;
  uint public current_phase_start_;

  // Events.
  event CreateAccountEvent(address indexed);
  event VoteEvent(address indexed, bytes32, uint, uint,
                  bool, bool, uint, bool);
  event PurchaseBondsEvent(address indexed, uint, uint);
  event RedeemBondsEvent(address indexed, uint[], uint);
  event ControlSupplyEvent(int, int, uint);

  // Initializer.
  //
  // Parameters
  // ----------------
  // |oracle|: The oracle. The ownership needs to be transferred to the ACB.
  function initialize(Oracle oracle)
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
    //  | 0            | 1 coin = 0.7 USD | 970 coins (14.1%)       |
    //  | 1            | 1 coin = 0.8 USD | 980 coins (9.16%)       |
    //  | 2            | 1 coin = 0.9 USD | 990 coins (4.46%)       |
    //  | 3            | 1 coin = 1.0 USD | 997 coins (1.31%)       |
    //  | 4            | 1 coin = 1.1 USD | 997 coins (1.31%)       |
    //  | 5            | 1 coin = 1.2 USD | 997 coins (1.31%)       |
    //  | 6            | 1 coin = 1.3 USD | 997 coins (1.31%)       |
    //  -------------------------------------------------------------
    //
    // In the bootstrap phase in which no currency exchanger supports JLC <=>
    // USD conversions, voters are expected to vote for the oracle level 4
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
    LEVEL_TO_EXCHANGE_RATE = [7, 8, 9, 10, 11, 12, 13];
    EXCHANGE_RATE_DIVISOR = 10;

    // LEVEL_TO_BOND_PRICE is the mapping from the oracle levels to the
    // bond prices.
    LEVEL_TO_BOND_PRICE = [970, 980, 990, 997, 997, 997, 997];

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
    // Specifically, the genesis account votes for the oracle level 4 until
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

    require(LEVEL_TO_EXCHANGE_RATE.length == oracle.getLevelMax(),
            "constructor: 1");
    require(LEVEL_TO_BOND_PRICE.length == oracle.getLevelMax(),
            "constructor: 2");
    
    // Mint the initial coins to the genesis account.
    coin_.mint(msg.sender, INITIAL_COIN_SUPPLY);
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
    coin_.pause();
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
    coin_.unpause();
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
  // A tuple of four values.
  //  - boolean: Whether the commit succeeded or not.
  //  - boolean: Whether the reveal succeeded or not.
  //  - uint: The total amount of the reclaimed coins and the reward.
  //  - boolean: Whether this vote resulted in a phase update.
  function vote(bytes32 committed_hash, uint revealed_level, uint revealed_salt)
      public whenNotPaused returns (bool, bool, uint, bool) {
    address sender = msg.sender;

    // Temporarily transfer the ownership of the JohnLawCoin contract to the
    // oracle.
    coin_.transferOwnership(address(oracle_));
    
    bool phase_updated = false;
    if (getTimestamp() >= current_phase_start_.add(PHASE_DURATION)) {
      // Start a new phase.
      phase_updated = true;
      current_phase_start_ = getTimestamp();
      
      uint mint = 0;
      oracle_level_ = oracle_.getModeLevel();
      if (oracle_level_ != oracle_.getLevelMax()) {
        require(0 <= oracle_level_ && oracle_level_ < oracle_.getLevelMax(),
                "vote: 1");
        // Translate the mode level to the exchange rate.
        uint exchange_rate = LEVEL_TO_EXCHANGE_RATE[oracle_level_];

        // Calculate the amount of coins to be minted or burned based on the
        // Quantity Theory of Money. If the exchnage rate is 1.1 (i.e., 1 coin
        // = 1.1 USD), the total coin supply is increased by 10%. If the
        // exchange rate is 0.8 (i.e., 1 coin = 0.8 USD), the total coin supply
        // is decreased by 20%.
        int delta =
            coin_.totalSupply().toInt256()
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
      oracle_.advance(coin_, mint);
    }

    // Commit.
    //
    // The voter needs to deposit the DEPOSIT_RATE percentage of their coin
    // balance.
    bool commit_result = oracle_.commit(
        coin_, sender, committed_hash,
        coin_.balanceOf(sender).mul(DEPOSIT_RATE).div(100));
    
    // Reveal.
    bool reveal_result = oracle_.reveal(sender, revealed_level, revealed_salt);
    
    // Reclaim.
    uint reclaim_amount = oracle_.reclaim(coin_, sender);

    // Revoke the ownership of the JohnLawCoin contract from the oracle.
    oracle_.revokeOwnership(coin_);
    
    emit VoteEvent(sender, committed_hash, revealed_level, revealed_salt,
                   commit_result, reveal_result, reclaim_amount, phase_updated);
    return (commit_result, reveal_result, reclaim_amount, phase_updated);
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
  function purchase_bonds(uint count)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    if (count <= 0) {
      return 0;
    }
    if (bond_budget_ < count.toInt256()) {
      // ACB does not have enough bonds to issue.
      return 0;
    }

    uint bond_price = LEVEL_TO_BOND_PRICE[oracle_.getLevelMax() - 1];
    if (0 <= oracle_level_ && oracle_level_ < oracle_.getLevelMax()) {
      bond_price = LEVEL_TO_BOND_PRICE[oracle_level_];
    }
    uint amount = bond_price.mul(count);
    if (coin_.balanceOf(sender) < amount) {
      // The user does not have enough coins to purchase the bonds.
      return 0;
    }

    // Set the redemption timestamp of the bonds.
    uint redemption = getTimestamp().add(BOND_REDEMPTION_PERIOD);

    // Issue new bonds
    bond_.mint(sender, redemption, count);
    bond_budget_ = bond_budget_.sub(count.toInt256());
    require(bond_budget_ >= 0,
            "purchase_bonds: 2");
    require((bond_.totalSupply().toInt256()).add(bond_budget_) >= 0,
            "purchase_bonds: 3");
    require(bond_.balanceOf(sender, redemption) > 0,
            "purchase_bonds: 4");

    // Burn the corresponding coins.
    coin_.burn(sender, amount);

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
  function redeem_bonds(uint[] memory redemptions)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    uint count_total = 0;
    for (uint i = 0; i < redemptions.length; i++) {
      uint redemption = redemptions[i];
      uint count = bond_.balanceOf(sender, redemption);
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
      coin_.mint(sender, amount);

      // Burn the redeemed bonds.
      bond_budget_ = bond_budget_.add(count.toInt256());
      bond_.burn(sender, redemption, count);
      count_total = count_total.add(count);
    }
    require((bond_.totalSupply().toInt256()).add(bond_budget_) >= 0,
            "redeem_bonds: 4");
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
      uint count = delta.toUint256().div(BOND_REDEMPTION_PRICE);
      if (count <= bond_.totalSupply()) {
        // If there are sufficient bonds to redeem, increase the total coin
        // supply by redeeming the bonds.
        bond_budget_ = -count.toInt256();
      } else {
        // Otherwise, redeem all the issued bonds.
        bond_budget_ = -bond_.totalSupply().toInt256();
        // The ACB needs to mint the remaining coins.
        mint = (count.sub(bond_.totalSupply())).mul(BOND_REDEMPTION_PRICE);
      }
      require(bond_budget_ <= 0, "_controlSupply: 1");
    } else {
      require(0 <= oracle_level_ && oracle_level_ < oracle_.getLevelMax(),
              "_controlSupply: 2");
      // Issue new bonds to decrease the total coin supply.
      bond_budget_ = -delta.div(LEVEL_TO_BOND_PRICE[oracle_level_].toInt256());
      require(bond_budget_ >= 0, "_controlSupply: 3");
    }

    require((bond_.totalSupply().toInt256()).add(bond_budget_) >= 0,
            "_controlSupply: 4");
    emit ControlSupplyEvent(delta, bond_budget_, mint);
    return mint;
  }

  // Calculate the hash to be committed to the oracle. Voters are expected to
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
  function getTimestamp()
      public virtual view returns (uint) {
    return block.timestamp;
  }

}
