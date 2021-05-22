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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

//------------------------------------------------------------------------------
// [Overview]
//
// JohnLawCoin is a stablecoin realized by an Algorithmic Central Bank (ACB).
// The monetary policies are backed by MMT (Modern Monetary Theory).
// The system is fully decentralized and there is truly no gatekeeper.
//
// JohnLawCoin is a real-world experiment to verify the following assumption:
//
// - There is a way to stabilize the coin price with algorithmically defined
//   monetary policies without holding any collateral like USD.
//
// If JohnLawCoin is successful and proves the assumption is correct, it will
// provide interesting insights for both non-fiat currencies and fiat
// currencies; i.e., 1) there is a way for non-fiat cryptocurrencies to
// implement a stablecoin without having any gatekeeper that holds collateral,
// and 2) there is a way for developing countries to implement a fixed exchange
// rate system for their fiat currencies without holding adequate USD reserves.
// This will upgrade human's understanding about money.
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
// If you have any questions, file GitHub issues
// (https://github.com/xharaken/john-law-coin).
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// [JohnLawCoin contract]
//
// JohnLawCoin is implemented as ERC20 tokens.
//
// Permission: Only the ACB and its oracle can mint, burn and transfer the
// coins. Only the ACB can pause and unpause the contract. Coin holders can
// transfer their coins using the ERC20 token APIs.
//------------------------------------------------------------------------------
contract JohnLawCoin is ERC20PausableUpgradeable, OwnableUpgradeable {
  // Constants.

  // Name of the ERC20 token.
  string public constant NAME = "JohnLawCoin";
  
  // Symbol of the ERC20 token.
  string public constant SYMBOL = "JLC";

  // The initial coin supply.
  uint public constant INITIAL_COIN_SUPPLY = 10000000;
  
  // Attributes.
  
  // The tax rate set by the ACB.
  uint public tax_rate_;

  // The account to which the tax is sent.
  address public tax_account_;

  // Events.
  event TransferEvent(address indexed sender, address receiver,
                      uint amount, uint tax);

  // Initializer.
  function initialize()
      public initializer {
    __ERC20Pausable_init();
    __ERC20_init(NAME, SYMBOL);
    __Ownable_init();
    
    tax_rate_ = 0;
    tax_account_ = address(uint160(uint(keccak256(abi.encode(
        "tax", block.number)))));

    // Mint the initial coins to the genesis account.
    _mint(msg.sender, INITIAL_COIN_SUPPLY);
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
  function mint(address account, uint amount)
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
  function burn(address account, uint amount)
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
  function move(address sender, address receiver, uint amount)
      public onlyOwner {
    _transfer(sender, receiver, amount);
  }

  // Pause the contract. Only the ACB can call this method.
  function pause()
      public onlyOwner {
    _pause();
  }
  
  // Unpause the contract. Only the ACB can call this method.
  function unpause()
      public onlyOwner {
    _unpause();
  }

  // Override decimals.
  function decimals()
      public pure override returns (uint8) {
    return 0;
  }

  // Set the tax rate. Only the ACB can call this method.
  function setTaxRate(uint tax_rate)
      public onlyOwner {
    require(0 <= tax_rate && tax_rate <= 100, "st1");
    tax_rate_ = tax_rate;
    
    // Regenerate the account address just in case.
    address old_tax_account = tax_account_;
    tax_account_ = address(uint160(uint(keccak256(abi.encode(
        "tax", block.number)))));
    move(old_tax_account, tax_account_, balanceOf(old_tax_account));
  }

  // Override ERC20's transfer method to impose a tax set by the ACB.
  function transfer(address account, uint amount)
      public override returns (bool) {
    uint tax = amount * tax_rate_ / 100;
    if (tax > 0) {
      _transfer(_msgSender(), tax_account_, tax);
    }
    _transfer(_msgSender(), account, amount - tax);
    emit TransferEvent(_msgSender(), account, amount - tax, tax);
    return true;
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
contract JohnLawBond is OwnableUpgradeable {
  using EnumerableSet for EnumerableSet.UintSet;

  // Attributes.
  
  // A mapping from a user account to the redemption timestamps of the bonds
  // owned by the user.
  mapping (address => EnumerableSet.UintSet) private _redemption_timestamps;

  // A mapping from a user account to the number of bonds owned by the account.
  mapping (address => uint) private _number_of_bonds;
  
  // _bonds[account][redemption_timestamp] stores the number of the bonds
  // owned by the |account| and have the |redemption_timestamp|.
  mapping (address => mapping (uint => uint)) private _bonds;

  // The total bond supply.
  uint private _total_supply;

  // Events.
  event MintEvent(address indexed account,
                  uint redemption_timestamp, uint amount);
  event BurnEvent(address indexed account,
                  uint redemption_timestamp, uint amount);

  // Initializer.
  function initialize()
      public initializer {
    __Ownable_init();
    
    _total_supply = 0;
  }
  
  // Mint bonds to one account. Only the ACB can call this method.
  //
  // Parameters
  // ----------------
  // |account|: The account to which the bonds are minted.
  // |redemption_timestamp|: The redemption timestamp of the bonds.
  // |amount|: The amount to be minted.
  //
  // Returns
  // ----------------
  // None.
  function mint(address account, uint redemption_timestamp, uint amount)
      public onlyOwner {
    _bonds[account][redemption_timestamp] += amount;
    _total_supply += amount;
    _number_of_bonds[account] += amount;
    if (_bonds[account][redemption_timestamp] > 0) {
      _redemption_timestamps[account].add(redemption_timestamp);
    }
    emit MintEvent(account, redemption_timestamp, amount);
  }

  // Burn bonds from one account. Only the ACB can call this method.
  //
  // Parameters
  // ----------------
  // |account|: The account from which the bonds are burned.
  // |redemption_timestamp|: The redemption timestamp of the bonds.
  // |amount|: The amount to be burned.
  //
  // Returns
  // ----------------
  // None.
  function burn(address account, uint redemption_timestamp, uint amount)
      public onlyOwner {
    _bonds[account][redemption_timestamp] -= amount;
    _total_supply -= amount;
    _number_of_bonds[account] -= amount;
    if (_bonds[account][redemption_timestamp] == 0) {
      _redemption_timestamps[account].remove(redemption_timestamp);
    }
    emit BurnEvent(account, redemption_timestamp, amount);
  }

  // Public getter: Return the number of bonds owned by the |account|.
  function numberOfBondsOwnedBy(address account)
      public view returns (uint) {
    return _number_of_bonds[account];
  }

  // Public getter: Return the number of redemption timestamps of the bonds
  // owned by the |account|.
  function numberOfRedemptionTimestampsOwnedBy(address account)
      public view returns (uint) {
    return _redemption_timestamps[account].length();
  }

  // Public getter: Return the |index|-th redemption timestamp of the bonds
  // owned by the |account|. |index| must be smaller than the value returned by
  // numberOfRedemptionTimestampsOwnedBy(account).
  function getRedemptionTimestampOwnedBy(address account, uint index)
      public view returns (uint) {
    return _redemption_timestamps[account].at(index);
  }

  // Public getter: Return the number of the bonds owned by the |account| and
  // have the |redemption_timestamp|.
  function balanceOf(address account, uint redemption_timestamp)
      public view returns (uint) {
    return _bonds[account][redemption_timestamp];
  }

  // Public getter: Return the total bond supply.
  function totalSupply()
      public view returns (uint) {
    return _total_supply;
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
    bytes32 committed_hash;
    // The amount of deposited coins (filled in the commit phase).
    uint deposit;
    // The revealed level (filled in the reveal phase).
    uint revealed_level;
    // The phase of this commit entry.
    Phase phase;
    // The phase ID when this commit entry is created.
    uint phase_id;
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
  }

  // Attributes. See the comment in initialize().
  // This can be an array of Epochs but is intentionally using a mapping to
  // make the Epoch struct upgradeable.
  mapping (uint => Epoch) public epochs_;
  uint public phase_id_;

  // Events.
  event CommitEvent(address indexed sender,
                    bytes32 committed_hash, uint deposited);
  event RevealEvent(address indexed sender,
                    uint revealed_level, uint revealed_salt);
  event ReclaimEvent(address indexed sender, uint reclaimed, uint rewarded);
  event AdvancePhaseEvent(uint indexed phase_id,
                          uint minted, uint burned);

  // Initializer.
  function initialize()
      public initializer {
    __Ownable_init();

    // Constants.
    
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

    // Attributes.

    // The oracle creates three Epoch objects and uses them in a round-robin
    // manner (commit => reveal => reclaim).
    for (uint epoch_index = 0; epoch_index < 3; epoch_index++) {
      for (uint level = 0; level < LEVEL_MAX; level++) {
        epochs_[epoch_index].votes[level] = Vote(0, 0, false, false);
      }
      epochs_[epoch_index].deposit_account =
          address(uint160(uint(keccak256(abi.encode(
              "deposit", epoch_index, block.number)))));
      epochs_[epoch_index].reward_account =
          address(uint160(uint(keccak256(abi.encode(
              "reward", epoch_index, block.number)))));
      epochs_[epoch_index].reward_total = 0;
    }
    epochs_[0].phase = Phase.COMMIT;
    epochs_[1].phase = Phase.RECLAIM;
    epochs_[2].phase = Phase.REVEAL;

    // |phase_id_| is a monotonically increasing ID (3, 4, 5, ...).
    // The Epoch object at |phase_id_ % 3| is in the commit phase.
    // The Epoch object at |(phase_id_ - 1) % 3| is in the reveal phase.
    // The Epoch object at |(phase_id_ - 2) % 3| is in the reclaim phase.
    // The phase ID starts with 3 because 0 in the commit entry is not
    // distinguishable from an uninitialized commit entry in Solidity.
    phase_id_ = 3;
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
    Epoch storage epoch = epochs_[phase_id_ % 3];
    require(epoch.phase == Phase.COMMIT, "co1");
    if (coin.balanceOf(sender) < deposit) {
      return false;
    }
    
    // One voter can commit only once per phase.
    if (epoch.commits[sender].phase_id == phase_id_) {
      return false;
    }

    // Create a commit entry.
    epoch.commits[sender] = Commit(
        committed_hash, deposit, LEVEL_MAX, Phase.COMMIT, phase_id_);
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
    Epoch storage epoch = epochs_[(phase_id_ - 1) % 3];
    require(epoch.phase == Phase.REVEAL, "rv1");
    if (LEVEL_MAX <= revealed_level) {
      return false;
    }
    if (epoch.commits[sender].phase_id != phase_id_ - 1) {
      // The corresponding commit was not found.
      return false;
    }
    
    // One voter can reveal only once per phase.
    if (epoch.commits[sender].phase != Phase.COMMIT) {
      return false;
    }
    epoch.commits[sender].phase = Phase.REVEAL;

    // Check if the committed hash matches the revealed level and the salt.
    bytes32 reveal_hash = hash(sender, revealed_level, revealed_salt);
    bytes32 committed_hash = epoch.commits[sender].committed_hash;
    if (committed_hash != reveal_hash) {
      return false;
    }

    // Update the commit entry with the revealed level.
    epoch.commits[sender].revealed_level = revealed_level;

    // Count up the vote.
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
  // A tuple of two values:
  //  - uint: The amount of the reclaimed coins. This becomes a positive value
  //    when the voter is eligible to reclaim their deposited coins.
  //  - uint: The amount of the reward. This becomes a positive value when the
  //    voter voted for the "truth" oracle level.
  function reclaim(JohnLawCoin coin, address sender)
      public onlyOwner returns (uint, uint) {
    Epoch storage epoch = epochs_[(phase_id_ - 2) % 3];
    require(epoch.phase == Phase.RECLAIM, "rc1");
    if (epoch.commits[sender].phase_id != phase_id_ - 2){
      // The corresponding commit was not found.
      return (0, 0);
    }
    
    // One voter can reclaim only once per phase.
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
  // |mint|: The amount of the coins minted for the reward.
  //
  // Returns
  // ----------------
  // None.
  function advance(JohnLawCoin coin, uint mint)
      public onlyOwner returns (uint) {
    // Step 1: Move the commit phase to the reveal phase.
    Epoch storage epoch = epochs_[phase_id_ % 3];
    require(epoch.phase == Phase.COMMIT, "ad1");
    epoch.phase = Phase.REVEAL;

    // Step 2: Move the reveal phase to the reclaim phase.
    epoch = epochs_[(phase_id_ - 1) % 3];
    require(epoch.phase == Phase.REVEAL, "ad2");

    // The "truth" level is set to the mode of the weighted majority votes.
    uint mode_level = getModeLevel();
    if (0 <= mode_level && mode_level < LEVEL_MAX) {
      uint deposit_voted = 0;
      uint deposit_to_reclaim = 0;
      for (uint level = 0; level < LEVEL_MAX; level++) {
        require(epoch.votes[level].should_reclaim == false, "ad3");
        require(epoch.votes[level].should_reward == false, "ad4");
        deposit_voted += epoch.votes[level].deposit;
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
      require(deposit_voted <= coin.balanceOf(epoch.deposit_account), "ad5");
      require(
          deposit_to_reclaim <= coin.balanceOf(epoch.deposit_account), "ad6");

      // The lost coins are moved to the reward account.
      coin.move(epoch.deposit_account, epoch.reward_account,
                coin.balanceOf(epoch.deposit_account) - deposit_to_reclaim);
    }

    // Mint |mint| coins to the reward account.
    coin.mint(epoch.reward_account, mint);

    // Set the total amount of the reward.
    epoch.reward_total = coin.balanceOf(epoch.reward_account);
    epoch.phase = Phase.RECLAIM;

    // Step 3: Move the reclaim phase to the commit phase.
    uint epoch_index = (phase_id_ - 2) % 3;
    epoch = epochs_[epoch_index];
    require(epoch.phase == Phase.RECLAIM, "ad7");

    uint burned = coin.balanceOf(epoch.deposit_account) +
                  coin.balanceOf(epoch.reward_account);
    // Burn the remaining deposited coins.
    coin.burn(epoch.deposit_account, coin.balanceOf(epoch.deposit_account));
    // Burn the remaining reward.
    coin.burn(epoch.reward_account, coin.balanceOf(epoch.reward_account));

    // Initialize the Epoch object for the next commit phase.
    //
    // |epoch.commits_| cannot be cleared due to the restriction of Solidity.
    // |phase_id_| ensures the stale commit entries are not misused.
    for (uint level = 0; level < LEVEL_MAX; level++) {
      epoch.votes[level] = Vote(0, 0, false, false);
    }
    // Regenerate the account addresses just in case.
    require(coin.balanceOf(epoch.deposit_account) == 0, "ad8");
    require(coin.balanceOf(epoch.reward_account) == 0, "ad9");
    epoch.deposit_account =
        address(uint160(uint(keccak256(abi.encode(
            "deposit", epoch_index, block.number)))));
    epoch.reward_account =
        address(uint160(uint(keccak256(abi.encode(
            "reward", epoch_index, block.number)))));
    epoch.reward_total = 0;
    epoch.phase = Phase.COMMIT;

    // Advance the phase.
    phase_id_ += 1;

    emit AdvancePhaseEvent(phase_id_, mint, burned);
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
    Epoch storage epoch = epochs_[(phase_id_ - 1) % 3];
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
  function revokeOwnership(JohnLawCoin coin)
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
    return (vote.deposit, vote.count, vote.should_reclaim, vote.should_reward);
  }

  // Public getter: Return the Commit object at |epoch_index| and |account|.
  function getCommit(uint epoch_index, address account)
      public view returns (bytes32, uint, uint, Phase, uint) {
    require(0 <= epoch_index && epoch_index <= 2, "gc1");
    Commit memory entry = epochs_[epoch_index].commits[account];
    return (entry.committed_hash, entry.deposit, entry.revealed_level,
            entry.phase, entry.phase_id);
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
  function hash(address sender, uint level, uint salt)
      public pure returns (bytes32) {
    return keccak256(abi.encode(sender, level, salt));
  }
}

//------------------------------------------------------------------------------
// [Logging contract]
//
// The Logging contract records various metrics for analysis purpose.
//------------------------------------------------------------------------------
contract Logging is OwnableUpgradeable {

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
    uint total_coin_supply;
    uint total_bond_supply;
    uint oracle_level;
    uint current_phase_start;
    uint burned_tax;
    uint purchased_bonds;
    uint redeemed_bonds;
  }

  // Attributes.

  // Logs about the voting.
  mapping (uint => VoteLog) public vote_logs_;
  
  // Logs about the ACB.
  mapping (uint => ACBLog) public acb_logs_;

  // The index of the current log.
  uint public log_index_;
  
  // Initializer.
  function initialize()
      public initializer {
    __Ownable_init();
    
    log_index_ = 0;
  }

  // Public getter: Return the VoteLog at the |log_index|.
  function getVoteLog(uint log_index)
      public view returns (
          uint, uint, uint, uint, uint, uint, uint, uint, uint) {
    VoteLog memory log = vote_logs_[log_index];
    return (log.commit_succeeded, log.commit_failed, log.reveal_succeeded,
            log.reveal_failed, log.reclaim_succeeded, log.reward_succeeded,
            log.deposited, log.reclaimed, log.rewarded);
  }

  // Public getter: Return the ACBLog at the |log_index|.
  function getACBLog(uint log_index)
      public view returns (
          uint, uint, int, int, uint, uint, uint, uint, uint, uint, uint) {
    ACBLog memory log = acb_logs_[log_index];
    return (log.minted_coins, log.burned_coins, log.coin_supply_delta,
            log.bond_budget, log.total_coin_supply, log.total_bond_supply,
            log.oracle_level, log.current_phase_start, log.burned_tax,
            log.purchased_bonds, log.redeemed_bonds);
  }

  // Called when the oracle phase is updated.
  //
  // Parameters
  // ----------------
  // |minted|: The amount of the minted coins.
  // |burned|: The amount of the burned coins.
  // |delta|: The delta of the total coin supply.
  // |bond_budget|: ACB.bond_budget_.
  // |total_coin_supply|: The total coin supply.
  // |total_bond_supply|: The total bond supply.
  // |oracle_level|: ACB.oracle_level_.
  // |current_phase_start|: ACB.current_phase_start_.
  // |burned_tax|: The amount of the burned tax.
  //
  // Returns
  // ----------------
  // None.
  function phaseUpdated(uint minted, uint burned, int delta, int bond_budget,
                        uint total_coin_supply, uint total_bond_supply,
                        uint oracle_level, uint current_phase_start,
                        uint burned_tax)
      public onlyOwner {
    log_index_ += 1;
    vote_logs_[log_index_] = VoteLog(0, 0, 0, 0, 0, 0, 0, 0, 0);
    acb_logs_[log_index_] = ACBLog(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      
    acb_logs_[log_index_].minted_coins = minted;
    acb_logs_[log_index_].burned_coins = burned;
    acb_logs_[log_index_].coin_supply_delta = delta;
    acb_logs_[log_index_].bond_budget = bond_budget;
    acb_logs_[log_index_].total_coin_supply = total_coin_supply;
    acb_logs_[log_index_].total_bond_supply = total_bond_supply;
    acb_logs_[log_index_].oracle_level = oracle_level;
    acb_logs_[log_index_].current_phase_start = current_phase_start;
    acb_logs_[log_index_].burned_tax = burned_tax;
  }

  // Called when ACB.vote is called.
  //
  // Parameters
  // ----------------
  // |commit_result|: Whether the commit succeeded or not.
  // |reveal_result|: Whether the reveal succeeded or not.
  // |deposited|: The amount of the deposited coins.
  // |reclaimed|: The amount of the reclaimed coins.
  // |rewarded|: The amount of the reward.
  //
  // Returns
  // ----------------
  // None.
  function voted(bool commit_result, bool reveal_result, uint deposited,
                 uint reclaimed, uint rewarded)
      public onlyOwner {
    if (commit_result) {
      vote_logs_[log_index_].commit_succeeded += 1;
    } else {
      vote_logs_[log_index_].commit_failed += 1;
    }
    if (reveal_result) {
      vote_logs_[log_index_].reveal_succeeded += 1;
    } else {
      vote_logs_[log_index_].reveal_failed += 1;
    }
    if (reclaimed > 0) {
      vote_logs_[log_index_].reclaim_succeeded += 1;
    }
    if (rewarded > 0) {
      vote_logs_[log_index_].reward_succeeded += 1;
    }
    vote_logs_[log_index_].deposited += deposited;
    vote_logs_[log_index_].reclaimed += reclaimed;
    vote_logs_[log_index_].rewarded += rewarded;
  }

  // Called when ACB.purchaseBonds is called.
  //
  // Parameters
  // ----------------
  // |count|: The number of the purchased bonds.
  //
  // Returns
  // ----------------
  // None.
  function purchasedBonds(uint count)
      public onlyOwner {
    acb_logs_[log_index_].purchased_bonds += count;
  }

  // Called when ACB.redeemBonds is called.
  //
  // Parameters
  // ----------------
  // |count|: The number of the redeemded bonds.
  //
  // Returns
  // ----------------
  // None.
  function redeemedBonds(uint count)
      public onlyOwner {
    acb_logs_[log_index_].redeemed_bonds += count;
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
// 3. If the exchange rate is larger than 1.0, the ACB increases the total coin
//    supply by redeeming issued bonds (regardless of their redemption dates).
//    If that is not enough to supply sufficient coins, the ACB mints new coins
//    and provides the coins to the oracle as a reward.
// 4. If the exchange rate is smaller than 1.0, the ACB decreases the total coin
//    supply by issuing new bonds and imposing tax on coin transfers.
//
// Permission: All methods are public. No one (including the genesis account)
// is privileged to influence the monetary policies of the ACB. The ACB
// is fully decentralized and there is truly no gatekeeper. The only exceptions
// are a few methods that can be called only by the genesis account. They are
// needed for the genesis account to upgrade the smart contract and fix bugs
// in a development phase.
//------------------------------------------------------------------------------
contract ACB is OwnableUpgradeable, PausableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;
  bytes32 public constant NULL_HASH = 0;

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'public' (instead of
  // 'constant') because tests want to override the values.
  uint public BOND_REDEMPTION_PRICE;
  uint public BOND_REDEMPTION_PERIOD;
  uint[] public LEVEL_TO_EXCHANGE_RATE;
  uint public EXCHANGE_RATE_DIVISOR;
  uint[] public LEVEL_TO_BOND_PRICE;
  uint[] public LEVEL_TO_TAX_RATE;
  uint public PHASE_DURATION;
  uint public DEPOSIT_RATE;
  uint public DAMPING_FACTOR;

  // Used only in testing. This cannot be put in a derived contract due to
  // a restriction of @openzeppelin/truffle-upgrades.
  uint public _timestamp_for_testing;

  // Attributes. See the comment in initialize().
  JohnLawCoin public coin_;
  JohnLawBond public bond_;
  Oracle public oracle_;
  Logging public logging_;
  int public bond_budget_;
  uint public oracle_level_;
  uint public current_phase_start_;

  // Events.
  event PayableEvent(address indexed sender, uint value);
  event VoteEvent(address indexed sender, bytes32 committed_hash,
                  uint revealed_level, uint revealed_salt,
                  bool commit_result, bool reveal_result,
                  uint deposited, uint reclaimed, uint rewarded,
                  bool phase_updated);
  event PurchaseBondsEvent(address indexed sender, uint count,
                           uint redemption_timestamp);
  event RedeemBondsEvent(address indexed sender, uint count);
  event ControlSupplyEvent(int delta, int bond_budget, uint mint);

  // Initializer. The ownership of the contracts needs to be transferred to the
  // ACB just after the initializer is invoked.
  //
  // Parameters
  // ----------------
  // |coin|: The JohnLawCoin contract.
  // |bond|: The JohnLawBond contract.
  // |oracle|: The Oracle contract.
  // |logging|: The Logging contract.
  function initialize(JohnLawCoin coin, JohnLawBond bond,
                      Oracle oracle, Logging logging)
      public initializer {
    __Ownable_init();
    __Pausable_init();

    // Constants.

    // The following table shows the mapping from the oracle level to the
    // exchange rate, the bond issue price and the tax rate. Voters can vote for
    // one of the oracle levels.
    //
    // -----------------------------------------------------------------------
    // | oracle level | exchange rate    | bond issue price       | tax rate |
    // |              |                  | (annual interest rate) |          |
    // -----------------------------------------------------------------------
    // |             0| 1 coin = 0.6 USD |       970 coins (14.1%)|       30%|
    // |             1| 1 coin = 0.7 USD |       978 coins (10.1%)|       20%|
    // |             2| 1 coin = 0.8 USD |       986 coins (6.32%)|       12%|
    // |             3| 1 coin = 0.9 USD |       992 coins (3.55%)|        5%|
    // |             4| 1 coin = 1.0 USD |       997 coins (1.31%)|        0%|
    // |             5| 1 coin = 1.1 USD |       997 coins (1.31%)|        0%|
    // |             6| 1 coin = 1.2 USD |       997 coins (1.31%)|        0%|
    // |             7| 1 coin = 1.3 USD |       997 coins (1.31%)|        0%|
    // |             8| 1 coin = 1.4 USD |       997 coins (1.31%)|        0%|
    // -----------------------------------------------------------------------
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
    // rate of 1.1. This translation is needed to avoid using float numbers in
    // Solidity.
    LEVEL_TO_EXCHANGE_RATE = [6, 7, 8, 9, 10, 11, 12, 13, 14];
    EXCHANGE_RATE_DIVISOR = 10;

    // LEVEL_TO_BOND_PRICE is the mapping from the oracle levels to the
    // bond prices.
    LEVEL_TO_BOND_PRICE = [970, 978, 986, 992, 997, 997, 997, 997, 997];

    // The bond redemption price and the redemption period.
    BOND_REDEMPTION_PRICE = 1000; // One bond is redeemed for 1000 coins.
    BOND_REDEMPTION_PERIOD = 84 * 24 * 60 * 60; // 12 weeks.

    // LEVEL_TO_TAX_RATE is the mapping from the oracle levels to the tax rate.
    LEVEL_TO_TAX_RATE = [30, 20, 12, 5, 0, 0, 0, 0, 0];

    // The duration of the oracle phase. The ACB adjusts the total coin supply
    // once per phase. Voters can vote once per phase.
    PHASE_DURATION = 60; // 1 week.

    // The percentage of the coin balance voters need to deposit.
    DEPOSIT_RATE = 10; // 10%.

    // A damping factor to avoid minting or burning too many coins in one
    // phase.
    DAMPING_FACTOR = 10; // 10%.

    // Attributes.

    // The JohnLawCoin contract.
    //
    // Note that 10000000 coins (corresponding to 10 M USD) are given to the
    // genesis account initially. This is important to make sure that the
    // genesis account can have power to determine the exchange rate until
    // the ecosystem stabilizes. Once real-world currency exchangers start
    // converting JLC with USD and the oracle gets a sufficient number of
    // honest voters to agree on the real-world exchange rate consistently,
    // the genesis account can lose its power by decreasing its coin balance.
    // This mechanism is mandatory to stabilize the exchange rate and
    // bootstrap the ecosystem successfully.
    //
    // Specifically, the genesis account votes for the oracle level 5 until
    // real-world currency exchangers appear. When real-world currency
    // exchangers appear, the genesis account votes for the oracle level
    // corresponding to the real-world exchange rate. Other voters are
    // expected to follow the genesis account. When the oracle gets enough
    // honest voters, the genesis account decreases its coin balance and loses
    // its power, moving the oracle to a fully decentralized system.
    coin_ = coin;
    
    // The JohnLawBond contract.
    bond_ = bond;
    
    // The Oracle contract.
    oracle_ = oracle;

    // The Logging contract.
    logging_ = logging;

    // If |bond_budget_| is positive, it indicates the number of bonds the ACB
    // can issue to decrease the total coin supply. If |bond_budget_| is
    // negative, it indicates the number of bonds the ACB can redeem to
    // increase the total coin supply.
    bond_budget_ = 0;
    
    // The current oracle level.
    oracle_level_ = oracle.getLevelMax();

    // The timestamp when the current phase started.
    current_phase_start_ = getTimestamp();

    require(LEVEL_TO_EXCHANGE_RATE.length == oracle.getLevelMax(), "AC1");
    require(LEVEL_TO_BOND_PRICE.length == oracle.getLevelMax(), "AC2");
    require(LEVEL_TO_TAX_RATE.length == oracle.getLevelMax(), "AC3");
  }

  // Deprecate the ACB. Only the owner can call this method.
  function deprecate()
      public whenNotPaused onlyOwner {
    coin_.transferOwnership(msg.sender);
    bond_.transferOwnership(msg.sender);
    oracle_.transferOwnership(msg.sender);
    logging_.transferOwnership(msg.sender);
  }

  // Pause the ACB in emergency cases. Only the owner can call this method.
  function pause()
      public whenNotPaused onlyOwner {
    _pause();
    coin_.pause();
  }

  // Unpause the ACB. Only the owner can call this method.
  function unpause()
      public whenPaused onlyOwner {
    _unpause();
    coin_.unpause();
  }

  // Payable fallback to receive and store ETH. Give us a tip :D
  fallback() external payable {
    emit PayableEvent(msg.sender, msg.value);
  }
  receive() external payable {
    emit PayableEvent(msg.sender, msg.value);
  }

  // Withdraw the tips. Only the owner can call this method.
  function withdrawTips()
      public whenNotPaused onlyOwner {
    payable(msg.sender).transfer(address(this).balance);
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

  // Vote for the exchange rate. The voter can commit a vote to the current
  // phase, reveal their vote in the previous phase, and reclaim the deposited
  // coins and get a reward for their vote in the phase before the previous
  // phase at the same time.
  //
  // Parameters
  // ----------------
  // |committed_hash|: The hash to be committed in the current phase. Specify
  // ACB.NULL_HASH if you do not want to commit and only want to reveal and
  // reclaim previous votes.
  // |revealed_level|: The oracle level you voted for in the previous phase.
  // |revealed_salt|: The salt you used in the previous phase.
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
  function vote(bytes32 committed_hash, uint revealed_level, uint revealed_salt)
      public whenNotPaused returns (bool, bool, uint, uint, uint, bool) {
    VoteResult memory result;
    
    result.phase_updated = false;
    if (getTimestamp() >= current_phase_start_ + PHASE_DURATION) {
      // Start a new phase.
      result.phase_updated = true;
      current_phase_start_ = getTimestamp();
      
      int delta = 0;
      uint tax_rate = 0;
      oracle_level_ = oracle_.getModeLevel();
      if (oracle_level_ != oracle_.getLevelMax()) {
        require(0 <= oracle_level_ && oracle_level_ < oracle_.getLevelMax(),
                "vo1");
        // Translate the oracle level to the exchange rate.
        uint exchange_rate = LEVEL_TO_EXCHANGE_RATE[oracle_level_];

        // Calculate the amount of coins to be minted or burned based on the
        // Quantity Theory of Money. If the exchange rate is 1.1 (i.e., 1 coin
        // = 1.1 USD), the total coin supply is increased by 10%. If the
        // exchange rate is 0.8 (i.e., 1 coin = 0.8 USD), the total coin supply
        // is decreased by 20%.
        delta = coin_.totalSupply().toInt256() *
                (int(exchange_rate) - int(EXCHANGE_RATE_DIVISOR)) /
                int(EXCHANGE_RATE_DIVISOR);

        // To avoid increasing or decreasing too many coins in one phase,
        // multiply the damping factor.
        delta = delta * int(DAMPING_FACTOR) / 100;

        // Translate the oracle level to the tax rate.
        tax_rate = LEVEL_TO_TAX_RATE[oracle_level_];
      }

      // Increase or decrease the total coin supply.
      uint mint = _controlSupply(delta);

      // Burn the tax. This is fine because the purpose of the tax is to
      // decrease the total coin supply.
      address tax_account = coin_.tax_account_();
      uint burned_tax = coin_.balanceOf(tax_account);
      coin_.burn(tax_account, burned_tax);
      coin_.setTaxRate(tax_rate);

      // Advance to the next phase. Provide the |mint| coins to the oracle
      // as a reward.
      coin_.transferOwnership(address(oracle_));
      uint burned = oracle_.advance(coin_, mint);
      oracle_.revokeOwnership(coin_);
      
      logging_.phaseUpdated(mint, burned, delta, bond_budget_,
                            coin_.totalSupply(), bond_.totalSupply(),
                            oracle_level_, current_phase_start_, burned_tax);
    }

    coin_.transferOwnership(address(oracle_));
    
    // Commit.
    //
    // The voter needs to deposit the DEPOSIT_RATE percentage of their coin
    // balance.
    result.deposited = coin_.balanceOf(msg.sender) * DEPOSIT_RATE / 100;
    if (committed_hash == NULL_HASH) {
      result.deposited = 0;
    }
    result.commit_result = oracle_.commit(
        coin_, msg.sender, committed_hash, result.deposited);
    if (!result.commit_result) {
      result.deposited = 0;
    }

    // Reveal.
    result.reveal_result = oracle_.reveal(
        msg.sender, revealed_level, revealed_salt);
    
    // Reclaim.
    (result.reclaimed, result.rewarded) = oracle_.reclaim(coin_, msg.sender);

    oracle_.revokeOwnership(coin_);

    logging_.voted(result.commit_result, result.reveal_result,
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
      // The ACB does not have enough bonds to issue.
      return 0;
    }

    uint bond_price = LEVEL_TO_BOND_PRICE[oracle_.getLevelMax() - 1];
    if (0 <= oracle_level_ && oracle_level_ < oracle_.getLevelMax()) {
      bond_price = LEVEL_TO_BOND_PRICE[oracle_level_];
    }
    uint amount = bond_price * count;
    if (coin_.balanceOf(sender) < amount) {
      // The user does not have enough coins to purchase the bonds.
      return 0;
    }

    // Set the redemption timestamp of the bonds.
    uint redemption_timestamp = getTimestamp() + BOND_REDEMPTION_PERIOD;

    // Issue new bonds.
    bond_.mint(sender, redemption_timestamp, count);
    bond_budget_ -= count.toInt256();
    require(bond_budget_ >= 0, "pb1");
    require((bond_.totalSupply().toInt256()) + bond_budget_ >= 0, "pb2");
    require(bond_.balanceOf(sender, redemption_timestamp) > 0, "pb3");

    // Burn the corresponding coins.
    coin_.burn(sender, amount);

    logging_.purchasedBonds(count);
    emit PurchaseBondsEvent(sender, count, redemption_timestamp);
    return redemption_timestamp;
  }
  
  // Redeem bonds.
  //
  // Parameters
  // ----------------
  // |redemption_timestamps|: An array of bonds to be redeemed. Bonds are
  // identified by their redemption timestamps.
  //
  // Returns
  // ----------------
  // The number of successfully redeemed bonds.
  function redeemBonds(uint[] memory redemption_timestamps)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;

    uint count_total = 0;
    for (uint i = 0; i < redemption_timestamps.length; i++) {
      uint redemption_timestamp = redemption_timestamps[i];
      uint count = bond_.balanceOf(sender, redemption_timestamp);
      if (redemption_timestamp > getTimestamp()) {
        // If the bonds have not yet hit their redemption timestamp, the ACB
        // accepts the redemption as long as |bond_budget_| is negative.
        if (bond_budget_ >= 0) {
          continue;
        }
        if (count > (-bond_budget_).toUint256()) {
          count = (-bond_budget_).toUint256();
        }
      }

      // Mint the corresponding coins to the user account.
      uint amount = count * BOND_REDEMPTION_PRICE;
      coin_.mint(sender, amount);

      // Burn the redeemed bonds.
      bond_budget_ += count.toInt256();
      bond_.burn(sender, redemption_timestamp, count);
      count_total += count;
    }
    require(bond_.totalSupply().toInt256() + bond_budget_ >= 0, "rb1");
    
    logging_.redeemedBonds(count_total);
    emit RedeemBondsEvent(sender, count_total);
    return count_total;
  }

  // Increase or decrease the total coin supply.
  //
  // Parameters
  // ----------------
  // |delta|: The target increase or decrease to the total coin supply.
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
      if (count <= bond_.totalSupply()) {
        // If there are sufficient bonds to redeem, increase the total coin
        // supply by redeeming the bonds.
        bond_budget_ = -count.toInt256();
      } else {
        // Otherwise, redeem all the issued bonds.
        bond_budget_ = -bond_.totalSupply().toInt256();
        // The ACB needs to mint the remaining coins.
        mint = (count - bond_.totalSupply()) * BOND_REDEMPTION_PRICE;
      }
      require(bond_budget_ <= 0, "cs1");
    } else {
      require(0 <= oracle_level_ && oracle_level_ < oracle_.getLevelMax(),
              "cs2");
      // Issue new bonds to decrease the total coin supply.
      bond_budget_ = -delta / LEVEL_TO_BOND_PRICE[oracle_level_].toInt256();
      require(bond_budget_ >= 0, "cs3");
    }

    require(bond_.totalSupply().toInt256() + bond_budget_ >= 0, "cs4");
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
    return oracle_.hash(sender, level, salt);
  }

  // Public getter: Return the current timestamp in seconds.
  function getTimestamp()
      public virtual view returns (uint) {
    // block.timestamp is better than block.number because the granularity of
    // the phase update is PHASE_DURATION (1 week).
    return block.timestamp;
  }

}
