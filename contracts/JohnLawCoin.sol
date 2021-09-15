// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

//------------------------------------------------------------------------------
// [Overview]
//
// JohnLawCoin is a non-collateralized stablecoin realized by an Algorithmic
// Central Bank (ACB). The system is fully decentralized and there is truly
// no gatekeeper. No gatekeeper means there is no entity to be regulated.
//
// JohnLawCoin is a real-world experiment to verify one assumption: There is
// a way to stabilize the currency price with algorithmically defined monetary
// policies without holding any collateral like USD.
//
// If JohnLawCoin is successful and proves the assumption is correct, it will
// provide interesting insights for both non-fiat cryptocurrencies and fiat
// currencies; i.e., 1) non-fiat cryptocurrencies can use the algorithm to
// implement a stablecoin without having any gatekeeper that holds collateral,
// and 2) real-world central banks of developing countries can use the
// algorithm to implement a fixed exchange rate system for their fiat
// currencies without holding adequate USD reserves. This will upgrade
// human's understanding about money.
//
// JohnLawCoin has the following important properties:
//
// - There is truly no gatekeeper. The ACB is fully automated and no one
//   (including the author of the smart contracts) has the privilege of
//   influencing the monetary policies of the ACB. This can be verified by the
//   fact that the smart contracts have no operations that need privileged
//   permissions.
// - The smart contracts are self-contained. There are no dependencies on other
//   smart contracts and external services.
// - All operations are guaranteed to terminate with the time complexity of
//   O(1). The time complexity of each operation is determined solely by the
//   input size of the operation and not affected by the state of the smart
//   contracts.
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
// Permission: Except public getters, only the ACB can call the methods.
// Coin holders can transfer their coins using the ERC20 token APIs.
//------------------------------------------------------------------------------
contract JohnLawCoin is ERC20PausableUpgradeable, OwnableUpgradeable {
  // Constants.

  // Name of the ERC20 token.
  string public constant NAME = "JohnLawCoin";
  
  // Symbol of the ERC20 token.
  string public constant SYMBOL = "JLC";

  // The initial coin supply.
  uint public constant INITIAL_COIN_SUPPLY = 10000000;

  // The tax rate.
  uint public constant TAX_RATE = 1;
  
  // Attributes.
  
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
    
    tax_account_ = address(uint160(uint(keccak256(abi.encode(
        "tax", block.number)))));

    // Mint the initial coins to the genesis account.
    _mint(msg.sender, INITIAL_COIN_SUPPLY);
  }

  // Mint coins to one account.
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

  // Burn coins from one account.
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

  // Move coins from one account to another account. Coin holders should use
  // ERC20's transfer method instead.
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

  // Pause the contract.
  function pause()
      public onlyOwner {
    if (!paused()) {
      _pause();
    }
  }
  
  // Unpause the contract.
  function unpause()
      public onlyOwner {
    if (paused()) {
      _unpause();
    }
  }

  // Override decimals.
  function decimals()
      public pure override returns (uint8) {
    return 0;
  }

  // Reset the tax account.
  function resetTaxAccount()
      public onlyOwner {
    address old_tax_account = tax_account_;
    tax_account_ = address(uint160(uint(keccak256(abi.encode(
        "tax", block.number)))));
    move(old_tax_account, tax_account_, balanceOf(old_tax_account));
  }

  // Override ERC20's transfer method to impose a tax set by the ACB.
  //
  // Parameters
  // ----------------
  // |account|: The receiver account.
  // |amount|: The amount to be transferred.
  //
  // Returns
  // ----------------
  // None.
  function transfer(address account, uint amount)
      public override returns (bool) {
    uint tax = amount * TAX_RATE / 100;
    _transfer(_msgSender(), tax_account_, tax);
    _transfer(_msgSender(), account, amount - tax);
    emit TransferEvent(_msgSender(), account, amount - tax, tax);
    return true;
  }
}

//------------------------------------------------------------------------------
// [JohnLawBond contract]
//
// JohnLawBond is an implementation of the bonds to increase / decrease the
// total coin supply. The bonds are not transferable.
//
// Permission: Except public getters, only the ACB can call the methods.
//------------------------------------------------------------------------------
contract JohnLawBond is OwnableUpgradeable {
  using EnumerableSet for EnumerableSet.UintSet;

  // Attributes.
  
  // _bonds[account][redemption_epoch] stores the number of the bonds
  // owned by the |account| that become redeemable at |redemption_epoch|.
  mapping (address => mapping (uint => uint)) private _bonds;

  // _redemption_epochs[account] is a set of the redemption epochs of the
  // bonds owned by the |account|.
  mapping (address => EnumerableSet.UintSet) private _redemption_epochs;

  // _bond_count[account] is the number of the bonds owned by the |account|.
  mapping (address => uint) private _bond_count;

  // _bond_supply[redemption_epoch] is the total number of the bonds that become
  // redeemable at |redemption_epoch|.
  mapping (uint => uint) private _bond_supply;
  
  // The total bond supply.
  uint private _total_supply;

  // Events.
  event MintEvent(address indexed account, uint redemption_epoch, uint amount);
  event BurnEvent(address indexed account, uint redemption_epoch, uint amount);

  // Initializer.
  function initialize()
      public initializer {
    __Ownable_init();
    
    _total_supply = 0;
  }
  
  // Mint bonds to one account.
  //
  // Parameters
  // ----------------
  // |account|: The account to which the bonds are minted.
  // |redemption_epoch|: The redemption epoch of the bonds.
  // |amount|: The amount to be minted.
  //
  // Returns
  // ----------------
  // None.
  function mint(address account, uint redemption_epoch, uint amount)
      public onlyOwner {
    _bonds[account][redemption_epoch] += amount;
    _total_supply += amount;
    _bond_count[account] += amount;
    _bond_supply[redemption_epoch] += amount;
    if (_bonds[account][redemption_epoch] > 0) {
      _redemption_epochs[account].add(redemption_epoch);
    }
    emit MintEvent(account, redemption_epoch, amount);
  }

  // Burn bonds from one account.
  //
  // Parameters
  // ----------------
  // |account|: The account from which the bonds are burned.
  // |redemption_epoch|: The redemption epoch of the bonds.
  // |amount|: The amount to be burned.
  //
  // Returns
  // ----------------
  // None.
  function burn(address account, uint redemption_epoch, uint amount)
      public onlyOwner {
    _bonds[account][redemption_epoch] -= amount;
    _total_supply -= amount;
    _bond_count[account] -= amount;
    _bond_supply[redemption_epoch] -= amount;
    if (_bonds[account][redemption_epoch] == 0) {
      _redemption_epochs[account].remove(redemption_epoch);
    }
    emit BurnEvent(account, redemption_epoch, amount);
  }

  // Public getter: Return the number of the bonds owned by the |account|.
  function numberOfBondsOwnedBy(address account)
      public view returns (uint) {
    return _bond_count[account];
  }

  // Public getter: Return the number of redemption epochs of the bonds
  // owned by the |account|.
  function numberOfRedemptionEpochsOwnedBy(address account)
      public view returns (uint) {
    return _redemption_epochs[account].length();
  }

  // Public getter: Return the |index|-th redemption epoch of the bonds
  // owned by the |account|. |index| must be smaller than the value returned by
  // numberOfRedemptionEpochsOwnedBy(account).
  function getRedemptionEpochOwnedBy(address account, uint index)
      public view returns (uint) {
    return _redemption_epochs[account].at(index);
  }

  // Public getter: Return the number of the bonds owned by the |account| that
  // become redeemable at |redemption_epoch|.
  function balanceOf(address account, uint redemption_epoch)
      public view returns (uint) {
    return _bonds[account][redemption_epoch];
  }

  // Public getter: Return the total bond supply.
  function totalSupply()
      public view returns (uint) {
    return _total_supply;
  }

  // Public getter: Return the number of the bonds that become redeemable at
  // |redemption_epoch|.
  function bondSupplyAt(uint redemption_epoch)
      public view returns (uint) {
    return _bond_supply[redemption_epoch];
  }
}

//------------------------------------------------------------------------------
// [Oracle contract]
//
// The oracle is a decentralized mechanism to determine one "truth" level
// from 0, 1, 2, ..., LEVEL_MAX - 1. The oracle uses the commit-reveal-reclaim
// voting scheme.
//
// Permission: Except public getters, only the ACB can call the methods.
//------------------------------------------------------------------------------
contract Oracle is OwnableUpgradeable {
  // Constants. The values are defined in initialize(). The values never change
  // during the contract execution but use 'public' (instead of 'constant')
  // because tests want to override the values.
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
  }

  // Vote is a struct to aggregate voting statistics for each oracle level.
  // The data is aggregated during the reveal phase and finalized at the end
  // of the reveal phase.
  struct Vote {
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

  // Epoch is a struct to keep track of the states in the commit-reveal-reclaim
  // scheme. The oracle creates three Epoch objects and uses them in a
  // round-robin manner. For example, when the first Epoch object is in use for
  // the commit phase, the second Epoch object is in use for the reveal phase,
  // and the third Epoch object is in use for the reclaim phase.
  struct Epoch {
    // The commit entries.
    mapping (address => Commit) commits;
    // The voting statistics for all the oracle levels. This uses a mapping
    // (instead of an array) to make the Vote struct upgradeable.
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
  // This uses a mapping (instead of an array) to make the Epoch struct
  // upgradeable.
  mapping (uint => Epoch) public epochs_;
  uint public epoch_id_;

  // Events.
  event CommitEvent(address indexed sender, uint indexed epoch_id,
                    bytes32 hash, uint deposited);
  event RevealEvent(address indexed sender, uint indexed epoch_id,
                    uint oracle_level, uint salt);
  event ReclaimEvent(address indexed sender, uint indexed epoch_id,
                     uint reclaimed, uint rewarded);
  event AdvancePhaseEvent(uint indexed epoch_id, uint tax, uint burned);

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
    
    // The lost coins and the collected tax are distributed to the voters who
    // voted for the "truth" level as a reward. The PROPORTIONAL_REWARD_RATE
    // of the reward is distributed to the voters in proportion to the coins
    // they deposited. The rest of the reward is distributed to the voters
    // evenly.
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

    // |epoch_id_| is a monotonically increasing ID (3, 4, 5, ...).
    // The Epoch object at |epoch_id_ % 3| is in the commit phase.
    // The Epoch object at |(epoch_id_ - 1) % 3| is in the reveal phase.
    // The Epoch object at |(epoch_id_ - 2) % 3| is in the reclaim phase.
    // The epoch ID starts with 3 because 0 in the commit entry is not
    // distinguishable from an uninitialized commit entry in Solidity.
    epoch_id_ = 3;
  }

  // Do commit.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |hash|: The committed hash.
  // |deposit|: The amount of the deposited coins.
  // |coin|: The JohnLawCoin contract. The ownership needs to be transferred to
  // this contract.
  //
  // Returns
  // ----------------
  // True if the commit succeeded. False otherwise.
  function commit(address sender, bytes32 hash, uint deposit, JohnLawCoin coin)
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
        hash, deposit, LEVEL_MAX, Phase.COMMIT, epoch_id_);
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
    bytes32 reveal_hash = encrypt(sender, oracle_level, salt);
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
  // |sender|: The voter's account.
  // |coin|: The JohnLawCoin contract. The ownership needs to be transferred to
  // this contract.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  //  - uint: The amount of the reclaimed coins. This becomes a positive value
  //    when the voter is eligible to reclaim their deposited coins.
  //  - uint: The amount of the reward. This becomes a positive value when the
  //    voter voted for the "truth" oracle level.
  function reclaim(address sender, JohnLawCoin coin)
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
      // voters who have more coins (and thus have more power on determining
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
  // |coin|: The JohnLawCoin contract. The ownership needs to be transferred to
  // this contract.
  //
  // Returns
  // ----------------
  // None.
  function advance(JohnLawCoin coin)
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
        deposit_revealed += epoch.votes[level].deposit;
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
      coin.move(epoch.deposit_account, epoch.reward_account,
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
    coin.burn(epoch.deposit_account, coin.balanceOf(epoch.deposit_account));
    // Burn the remaining reward.
    coin.burn(epoch.reward_account, coin.balanceOf(epoch.reward_account));

    // Initialize the Epoch object for the next commit phase.
    //
    // |epoch.commits_| cannot be cleared due to the restriction of Solidity.
    // |epoch_id_| ensures the stale commit entries are not misused.
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
  function revokeOwnership(JohnLawCoin coin)
      public onlyOwner {
    coin.transferOwnership(msg.sender);
  }

  // Public getter: Return the Vote object at |epoch_index| and |level|.
  function getVote(uint epoch_index, uint level)
      public view returns (uint, uint, bool, bool) {
    require(0 <= epoch_index && epoch_index <= 2, "gv1");
    require(0 <= level && level < LEVEL_MAX, "gv2");
    Vote memory vote = epochs_[epoch_index].votes[level];
    return (vote.deposit, vote.count, vote.should_reclaim, vote.should_reward);
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
  
  // Calculate a hash to be committed. Voters are expected to use this function
  // to create a hash used in the commit phase.
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
// [Logging contract]
//
// The Logging contract records various metrics for analysis purpose.
//
// Permission: Except public getters, only the ACB can call the methods.
//------------------------------------------------------------------------------
contract Logging is OwnableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;

  // A struct to record metrics about voting.
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

  // A struct to record metrics about Epoch.
  struct EpochLog {
    uint minted_coins;
    uint burned_coins;
    int coin_supply_delta;
    uint total_coin_supply;
    uint oracle_level;
    uint current_epoch_start;
    uint tax;
  }

  // A struct to record metrics about BondOperation.
  struct BondOperationLog {
    int bond_budget;
    uint total_bond_supply;
    uint valid_bond_supply;
    uint purchased_bonds;
    uint redeemed_bonds;
    uint expired_bonds;
  }

  // A struct to record metrics about OpenMarketOperation.
  struct OpenMarketOperationLog {
    int coin_budget;
    int exchanged_coins;
    int exchanged_eth;
    uint eth_balance;
    uint latest_price;
  }
  
  // Attributes.

  // Logs about voting.
  mapping (uint => VoteLog) public vote_logs_;
  
  // Logs about Epoch.
  mapping (uint => EpochLog) public epoch_logs_;

  // Logs about BondOperation.
  mapping (uint => BondOperationLog) public bond_operation_logs_;

  // Logs about OpenMarketOperation.
  mapping (uint => OpenMarketOperationLog) public open_market_operation_logs_;

  // Initializer.
  function initialize()
      public initializer {
    __Ownable_init();
  }

  // Public getter: Return the VoteLog of |epoch_id|.
  function getVoteLog(uint epoch_id)
      public view returns (
          uint, uint, uint, uint, uint, uint, uint, uint, uint) {
    VoteLog memory log = vote_logs_[epoch_id];
    return (log.commit_succeeded, log.commit_failed, log.reveal_succeeded,
            log.reveal_failed, log.reclaim_succeeded, log.reward_succeeded,
            log.deposited, log.reclaimed, log.rewarded);
  }

  // Public getter: Return the EpochLog of |epoch_id|.
  function getEpochLog(uint epoch_id)
      public view returns (uint, uint, int, uint, uint, uint, uint) {
    EpochLog memory log = epoch_logs_[epoch_id];
    return (log.minted_coins, log.burned_coins, log.coin_supply_delta,
            log.total_coin_supply, log.oracle_level, log.current_epoch_start,
            log.tax);
  }

  // Public getter: Return the BondOperationLog of |epoch_id|.
  function getBondOperationLog(uint epoch_id)
      public view returns (int, uint, uint, uint, uint, uint) {
    BondOperationLog memory log = bond_operation_logs_[epoch_id];
    return (log.bond_budget, log.total_bond_supply, log.valid_bond_supply,
            log.purchased_bonds, log.redeemed_bonds, log.expired_bonds);
  }

  // Public getter: Return the OpenMarketOperationLog of |epoch_id|.
  function getOpenMarketOperationLog(uint epoch_id)
      public view returns (int, int, int, uint, uint) {
    OpenMarketOperationLog memory log = open_market_operation_logs_[epoch_id];
    return (log.coin_budget, log.exchanged_coins, log.exchanged_eth,
            log.eth_balance, log.latest_price);
  }

  // Called when the epoch is updated.
  //
  // Parameters
  // ----------------
  // |epoch_id|: The epoch ID.
  // |minted|: The amount of the minted coins.
  // |burned|: The amount of the burned coins.
  // |delta|: The delta of the total coin supply.
  // |total_coin_supply|: The total coin supply.
  // |oracle_level|: ACB.oracle_level_.
  // |current_epoch_start|: ACB.current_epoch_start_.
  // |tax|: The amount of the tax collected in the previous epoch.
  //
  // Returns
  // ----------------
  // None.
  function updateEpoch(uint epoch_id, uint minted, uint burned, int delta,
                       uint total_coin_supply, uint oracle_level,
                       uint current_epoch_start, uint tax)
      public onlyOwner {
    epoch_logs_[epoch_id].minted_coins = minted;
    epoch_logs_[epoch_id].burned_coins = burned;
    epoch_logs_[epoch_id].coin_supply_delta = delta;
    epoch_logs_[epoch_id].total_coin_supply = total_coin_supply;
    epoch_logs_[epoch_id].oracle_level = oracle_level;
    epoch_logs_[epoch_id].current_epoch_start = current_epoch_start;
    epoch_logs_[epoch_id].tax = tax;
  }

  // Called when BondOperation's bond budget is updated at the beginning of
  // the epoch.
  //
  // Parameters
  // ----------------
  // |epoch_id|: The epoch ID.
  // |bond_budget|: The bond budget.
  // |total_bond_supply|: The total bond supply.
  // |valid_bond_supply|: The valid bond supply.
  //
  // Returns
  // ----------------
  // None.
  function updateBondBudget(uint epoch_id, int bond_budget,
                            uint total_bond_supply, uint valid_bond_supply)
      public onlyOwner {
    bond_operation_logs_[epoch_id].bond_budget = bond_budget;
    bond_operation_logs_[epoch_id].total_bond_supply = total_bond_supply;
    bond_operation_logs_[epoch_id].valid_bond_supply = valid_bond_supply;
    bond_operation_logs_[epoch_id].purchased_bonds = 0;
    bond_operation_logs_[epoch_id].redeemed_bonds = 0;
    bond_operation_logs_[epoch_id].expired_bonds = 0;
  }

  // Called when OpenMarketOperation's coin budget is updated at the beginning
  // of the epoch.
  //
  // Parameters
  // ----------------
  // |epoch_id|: The epoch ID.
  // |coin_budget|: The coin budget.
  // |eth_balance|: The ETH balance in the EthPool.
  // |latest_price|: The latest ETH / JLC price.
  //
  // Returns
  // ----------------
  // None.
  function updateCoinBudget(uint epoch_id, int coin_budget,
                            uint eth_balance, uint latest_price)
      public onlyOwner {
    open_market_operation_logs_[epoch_id].coin_budget = coin_budget;
    open_market_operation_logs_[epoch_id].exchanged_coins = 0;
    open_market_operation_logs_[epoch_id].exchanged_eth = 0;
    open_market_operation_logs_[epoch_id].eth_balance = eth_balance;
    open_market_operation_logs_[epoch_id].latest_price = latest_price;
  }

  // Called when ACB.vote is called.
  //
  // Parameters
  // ----------------
  // |epoch_id|: The epoch ID.
  // |commit_result|: Whether the commit succeeded or not.
  // |reveal_result|: Whether the reveal succeeded or not.
  // |deposited|: The amount of the deposited coins.
  // |reclaimed|: The amount of the reclaimed coins.
  // |rewarded|: The amount of the reward.
  //
  // Returns
  // ----------------
  // None.
  function vote(uint epoch_id, bool commit_result, bool reveal_result,
                uint deposited, uint reclaimed, uint rewarded)
      public onlyOwner {
    if (commit_result) {
      vote_logs_[epoch_id].commit_succeeded += 1;
    } else {
      vote_logs_[epoch_id].commit_failed += 1;
    }
    if (reveal_result) {
      vote_logs_[epoch_id].reveal_succeeded += 1;
    } else {
      vote_logs_[epoch_id].reveal_failed += 1;
    }
    if (reclaimed > 0) {
      vote_logs_[epoch_id].reclaim_succeeded += 1;
    }
    if (rewarded > 0) {
      vote_logs_[epoch_id].reward_succeeded += 1;
    }
    vote_logs_[epoch_id].deposited += deposited;
    vote_logs_[epoch_id].reclaimed += reclaimed;
    vote_logs_[epoch_id].rewarded += rewarded;
  }

  // Called when ACB.purchaseBonds is called.
  //
  // Parameters
  // ----------------
  // |epoch_id|: The epoch ID.
  // |purchased_bonds|: The number of purchased bonds.
  //
  // Returns
  // ----------------
  // None.
  function purchaseBonds(uint epoch_id, uint purchased_bonds)
      public onlyOwner {
    bond_operation_logs_[epoch_id].purchased_bonds += purchased_bonds;
  }

  // Called when ACB.redeemBonds is called.
  //
  // Parameters
  // ----------------
  // |epoch_id|: The epoch ID.
  // |redeemed_bonds|: The number of redeemded bonds.
  // |expired_bonds|: The number of expired bonds.
  //
  // Returns
  // ----------------
  // None.
  function redeemBonds(uint epoch_id, uint redeemed_bonds, uint expired_bonds)
      public onlyOwner {
    bond_operation_logs_[epoch_id].redeemed_bonds += redeemed_bonds;
    bond_operation_logs_[epoch_id].expired_bonds += expired_bonds;
  }

  // Called when ACB.purchaseCoins is called.
  //
  // Parameters
  // ----------------
  // |epoch_id|: The epoch ID.
  // |eth_amount|: The amount of ETH exchanged.
  // |coin_amount|: The amount of JLC exchanged.
  //
  // Returns
  // ----------------
  // None.
  function purchaseCoins(uint epoch_id, uint eth_amount, uint coin_amount)
      public onlyOwner {
    open_market_operation_logs_[epoch_id].exchanged_eth +=
        eth_amount.toInt256();
    open_market_operation_logs_[epoch_id].exchanged_coins +=
        coin_amount.toInt256();
  }

  // Called when ACB.sellCoins is called.
  //
  // Parameters
  // ----------------
  // |epoch_id|: The epoch ID.
  // |eth_amount|: The amount of ETH exchanged.
  // |coin_amount|: The amount of JLC exchanged.
  //
  // Returns
  // ----------------
  // None.
  function sellCoins(uint epoch_id, uint eth_amount, uint coin_amount)
      public onlyOwner {
    open_market_operation_logs_[epoch_id].exchanged_eth -=
        eth_amount.toInt256();
    open_market_operation_logs_[epoch_id].exchanged_coins -=
        coin_amount.toInt256();
  }
}

//------------------------------------------------------------------------------
// [BondOperation contract]
//
// The BondOperation contract increases / decreases the total coin supply by
// redeeming / issuing bonds. The bond budget is updated by the ACB every epoch.
//
// Permission: Except public getters, only the ACB can call the methods.
//------------------------------------------------------------------------------
contract BondOperation is OwnableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;

  // Constants. The values are defined in initialize(). The values never change
  // during the contract execution but use 'public' (instead of 'constant')
  // because tests want to override the values.
  uint public BOND_PRICE;
  uint public BOND_REDEMPTION_PRICE;
  uint public BOND_REDEMPTION_PERIOD;
  uint public BOND_REDEEMABLE_PERIOD;

  // Attributes. See the comment in initialize().
  JohnLawBond public bond_;
  int public bond_budget_;

  // Events.
  event IncreaseBondSupplyEvent(address indexed sender, uint indexed epoch_id,
                                uint issued_bonds, uint redemption_epoch);
  event DecreaseBondSupplyEvent(address indexed sender, uint indexed epoch_id,
                                uint redeemed_bonds, uint expired_bonds);
  event UpdateBondBudgetEvent(uint indexed epoch_id, int delta,
                              int bond_budget, uint mint);

  // Initializer.
  //
  // Parameters
  // ----------------
  // |bond|: The JohnLawBond contract. The ownership needs to be transferred to
  // this contract.
  function initialize(JohnLawBond bond)
      public initializer {
    __Ownable_init();
    
    // Constants.
    
    // The bond structure.
    //
    // |<---BOND_REDEMPTION_PERIOD--->|<---BOND_REDEEMABLE_PERIOD--->|
    // ^                              ^                              ^
    // Issued                         Becomes redeemable             Expired
    //
    // During BOND_REDEMPTION_PERIOD, the bonds are redeemable as long as the
    // bond budget is negative. During BOND_REDEEMABLE_PERIOD, the bonds are
    // redeemable regardless of the bond budget. After BOND_REDEEMABLE_PERIOD,
    // the bonds are expired.
    BOND_PRICE = 996; // One bond is sold for 996 coins.
    BOND_REDEMPTION_PRICE = 1000; // One bond is redeemed for 1000 coins.
    BOND_REDEMPTION_PERIOD = 12; // 12 epochs.
    BOND_REDEEMABLE_PERIOD = 2; // 2 epochs.

    // The JohnLawBond contract.
    bond_ = bond;
    
    // If |bond_budget_| is positive, it indicates the number of bonds the ACB
    // can issue to decrease the total coin supply. If |bond_budget_| is
    // negative, it indicates the number of bonds the ACB can redeem to
    // increase the total coin supply.
    bond_budget_ = 0;
  }

  // Deprecate the contract.
  function deprecate()
      public onlyOwner {
    bond_.transferOwnership(msg.sender);
  }

  // Increase the total bond supply by issuing bonds.
  //
  // Parameters
  // ----------------
  // |sender|: The sender account.
  // |count|: The number of bonds to be issued.
  // |epoch_id|: The current epoch ID.
  // |coin|: The JohnLawCoin contract. The ownership needs to be transferred to
  // this contract.
  //
  // Returns
  // ----------------
  // The redemption epoch of the issued bonds if it succeeds. 0 otherwise.
  function increaseBondSupply(address sender, uint count,
                              uint epoch_id, JohnLawCoin coin)
      public onlyOwner returns (uint) {
    require(count > 0, "BondOperation: You must purchase at least one bond.");
    require(bond_budget_ >= count.toInt256(),
            "BondOperation: The bond budget is not enough.");

    uint amount = BOND_PRICE * count;
    require(coin.balanceOf(sender) >= amount,
            "BondOperation: Your coin balance is not enough.");

    // Set the redemption epoch of the bonds.
    uint redemption_epoch = epoch_id + BOND_REDEMPTION_PERIOD;

    // Issue new bonds.
    bond_.mint(sender, redemption_epoch, count);
    bond_budget_ -= count.toInt256();
    require(bond_budget_ >= 0, "pb1");
    require(bond_.balanceOf(sender, redemption_epoch) > 0, "pb2");

    // Burn the corresponding coins.
    coin.burn(sender, amount);
    emit IncreaseBondSupplyEvent(sender, epoch_id, count, redemption_epoch);
    return redemption_epoch;
  }
  
  // Decrease the total bond supply by redeeming bonds.
  //
  // Parameters
  // ----------------
  // |sender|: The sender account.
  // |redemption_epochs|: An array of bonds to be redeemed. The bonds are
  // identified by their redemption epochs.
  // |epoch_id|: The current epoch ID.
  // |coin|: The JohnLawCoin contract. The ownership needs to be transferred to
  // this contract.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  // - The number of redeemed bonds.
  // - The number of expired bonds.
  function decreaseBondSupply(address sender, uint[] memory redemption_epochs,
                              uint epoch_id, JohnLawCoin coin)
      public onlyOwner returns (uint, uint) {
    uint redeemed_bonds = 0;
    uint expired_bonds = 0;
    for (uint i = 0; i < redemption_epochs.length; i++) {
      uint redemption_epoch = redemption_epochs[i];
      uint count = bond_.balanceOf(sender, redemption_epoch);
      if (epoch_id < redemption_epoch) {
        // If the bonds have not yet hit their redemption epoch, the
        // BondOperation accepts the redemption as long as |bond_budget_| is
        // negative.
        if (bond_budget_ >= 0) {
          continue;
        }
        if (count > (-bond_budget_).toUint256()) {
          count = (-bond_budget_).toUint256();
        }
        bond_budget_ += count.toInt256();
      }
      if (epoch_id < redemption_epoch + BOND_REDEEMABLE_PERIOD) {
        // If the bonds are not expired, mint the corresponding coins to the
        // sender account.
        uint amount = count * BOND_REDEMPTION_PRICE;
        coin.mint(sender, amount);
        redeemed_bonds += count;
      } else {
        expired_bonds += count;
      }
      // Burn the redeemed / expired bonds.
      bond_.burn(sender, redemption_epoch, count);
    }
    emit DecreaseBondSupplyEvent(sender, epoch_id,
                                 redeemed_bonds, expired_bonds);
    return (redeemed_bonds, expired_bonds);
  }

  // Update the bond budget to increase or decrease the total coin supply.
  //
  // Parameters
  // ----------------
  // |delta|: The target increase or decrease of the total coin supply.
  // |epoch_id|: The current epoch ID.
  //
  // Returns
  // ----------------
  // The amount of coins that cannot be increased by adjusting the bond budget
  // and thus need to be newly minted.
  function updateBondBudget(int delta, uint epoch_id)
      public onlyOwner returns (uint) {
    uint mint = 0;
    uint bond_supply = validBondSupply(epoch_id);
    if (delta == 0) {
      // No change in the total coin supply.
      bond_budget_ = 0;
    } else if (delta > 0) {
      // Increase the total coin supply.
      uint count = delta.toUint256() / BOND_REDEMPTION_PRICE;
      if (count <= bond_supply) {
        // If there are sufficient bonds to redeem, increase the total coin
        // supply by redeeming the bonds.
        bond_budget_ = -count.toInt256();
      } else {
        // Otherwise, redeem all the issued bonds.
        bond_budget_ = -bond_supply.toInt256();
        // The remaining coins need to be newly minted.
        mint = (count - bond_supply) * BOND_REDEMPTION_PRICE;
      }
      require(bond_budget_ <= 0, "cs1");
    } else {
      // Issue new bonds to decrease the total coin supply.
      bond_budget_ = -delta / BOND_PRICE.toInt256();
      require(bond_budget_ >= 0, "cs2");
    }

    require(bond_supply.toInt256() + bond_budget_ >= 0, "cs3");
    emit UpdateBondBudgetEvent(epoch_id, delta, bond_budget_, mint);
    return mint;
  }

  // Public getter: Return the valid bond supply; i.e., the total supply of
  // not-yet-expired bonds.
  function validBondSupply(uint epoch_id)
      public view returns (uint) {
    uint count = 0;
    for (uint redemption_epoch =
             (epoch_id > BOND_REDEEMABLE_PERIOD ?
              epoch_id - BOND_REDEEMABLE_PERIOD + 1 : 0);
         redemption_epoch <= epoch_id + BOND_REDEMPTION_PERIOD;
         redemption_epoch++) {
      count += bond_.bondSupplyAt(redemption_epoch);
    }
    return count;
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
}

//------------------------------------------------------------------------------
// [OpenMarketOperation contract]
//
// The OpenMarketOperation contract increases / decreases the total coin supply
// by purchasing / selling ETH from the open market. The price between JLC and
// ETH is determined by a Dutch auction.
//
// Permission: Except public getters, only the ACB can call the methods.
//------------------------------------------------------------------------------
contract OpenMarketOperation is OwnableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;

  // Constants. The values are defined in initialize(). The values never change
  // during the contract execution but use 'public' (instead of 'constant')
  // because tests want to override the values.
  uint public PRICE_CHANGE_INTERVAL;
  uint public PRICE_CHANGE_PERCENTAGE;
  uint public PRICE_CHANGE_MAX;
  uint public START_PRICE_MULTIPLIER;

  // Attributes. See the comment in initialize().
  uint public latest_price_;
  uint public start_price_;
  int public coin_budget_;

  // Events.
  event IncreaseCoinSupplyEvent(uint requested_eth_amount, uint elapsed_time,
                                uint eth_amount, uint coin_amount);
  event DecreaseCoinSupplyEvent(uint requested_coin_amount, uint elapsed_time,
                                uint eth_balance, uint eth_amount,
                                uint coin_amount);
  event UpdateCoinBudgetEvent(int coin_budget);
  
  // Initializer.
  function initialize()
      public initializer {
    __Ownable_init();
    
    // Constants.

    // The price auction is implemented as a Dutch auction as follows:
    //
    // Let P be the latest price at which the open market operation exchanged
    // JLC with ETH. The price is measured by ETH wei / JLC. When the price is
    // P, it means 1 JLC is exchanged with P ETH wei.
    //
    // At the beginning of each epoch, the ACB sets the coin budget; i.e., the
    // amount of JLC to be purchased / sold by the open market operation.
    //
    // When the open market operation increases the total coin supply,
    // the auction starts with the price of P * START_PRICE_MULTIPLIER.
    // Then the price is decreased by PRICE_CHANGE_PERCENTAGE % every
    // PRICE_CHANGE_INTERVAL seconds. JLC and ETH are exchanged at the
    // given price (the open market operation sells JLC and purchases ETH).
    // The auction stops when the open market operation finished selling JLC
    // in the coin budget.
    //
    // When the open market operation decreases the total coin supply,
    // the auction starts with the price of P / START_PRICE_MULTIPLIER.
    // Then the price is increased by PRICE_CHANGE_PERCENTAGE % every
    // PRICE_CHANGE_INTERVAL seconds. JLC and ETH are exchanged at the
    // given price (the open market operation sells ETH and purchases JLC).
    // The auction stops when the open market operation finished purchasing JLC
    // in the coin budget.
    //
    // To avoid the price from increasing / decreasing too much, the price
    // is allowed to increase / decrease up to PRICE_CHANGE_MAX times.
    //
    // TODO: Change PRICE_CHANGE_INTERVAL to 8 * 60 * 60 before launching to the
    // mainnet. It's set to 60 seconds for the Ropsten Testnet.
    PRICE_CHANGE_INTERVAL = 60; // 8 hours
    PRICE_CHANGE_PERCENTAGE = 15; // 15%
    PRICE_CHANGE_MAX = 25;
    START_PRICE_MULTIPLIER = 3;
    
    // Attributes.

    // The latest price at which the open market operation exchanged JLC with
    // ETH.
    latest_price_ = 1000000000000;
    
    // The start price is updated at the beginning of each epoch.
    start_price_ = 0;
    
    // The current coin budget.
    coin_budget_ = 0;
  }
  
  // Increase the total coin supply by purchasing ETH from the sender account.
  // This method returns the amount of JLC and ETH to be exchanged. The actual
  // change to the total coin supply and the ETH pool is made by the ACB.
  //
  // Parameters
  // ----------------
  // |requested_eth_amount|: The amount of ETH the sender is willing to pay.
  // |elapsed_time|: The elapsed seconds from the current epoch start.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  // - The amount of ETH to be exchanged. This can be smaller than
  // |requested_eth_amount| when the open market operation does not have
  // enough coin budget.
  // - The amount of JLC to be exchanged.
  function increaseCoinSupply(uint requested_eth_amount, uint elapsed_time)
      public onlyOwner returns (uint, uint) {
    require(coin_budget_ > 0,
            "OpenMarketOperation: The coin budget must be positive.");
        
    // Calculate the amount of JLC and ETH to be exchanged.
    uint price = getCurrentPrice(elapsed_time);
    uint coin_amount = requested_eth_amount / price;
    if (coin_amount > coin_budget_.toUint256()) {
      coin_amount = coin_budget_.toUint256();
    }
    uint eth_amount = coin_amount * price;
        
    if (coin_amount > 0) {
      latest_price_ = price;
    }
    coin_budget_ -= coin_amount.toInt256();
    require(coin_budget_ >= 0, "ic1");
    require(eth_amount <= requested_eth_amount, "ic2");

    emit IncreaseCoinSupplyEvent(requested_eth_amount, elapsed_time,
                                 eth_amount, coin_amount);
    return (eth_amount, coin_amount);
  }

  // Decrease the total coin supply by selling ETH to the sender account.
  // This method returns the amount of JLC and ETH to be exchanged. The actual
  // change to the total coin supply and the ETH pool is made by the ACB.
  //
  // Parameters
  // ----------------
  // |requested_coin_amount|: The amount of JLC the sender is willing to pay.
  // |elapsed_time|: The elapsed seconds from the current epoch start.
  // |eth_balance|: The ETH balance in the EthPool.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  // - The amount of ETH to be exchanged.
  // - The amount of JLC to be exchanged. This can be smaller than
  // |requested_coin_amount| when the open market operation does not have
  // enough ETH in the pool.
  function decreaseCoinSupply(uint requested_coin_amount, uint elapsed_time,
                              uint eth_balance)
      public onlyOwner returns (uint, uint) {
    require(coin_budget_ < 0,
            "OpenMarketOperation: The coin budget must be negative.");
        
    // Calculate the amount of JLC and ETH to be exchanged.
    uint price = getCurrentPrice(elapsed_time);
    uint coin_amount = requested_coin_amount;
    if (coin_amount >= (-coin_budget_).toUint256()) {
      coin_amount = (-coin_budget_).toUint256();
    }
    uint eth_amount = coin_amount * price;
    if (eth_amount >= eth_balance) {
      eth_amount = eth_balance;
    }
    coin_amount = eth_amount / price;
        
    if (coin_amount > 0) {
      latest_price_ = price;
    }
    coin_budget_ += coin_amount.toInt256();
    require(coin_budget_ <= 0, "dc1");
    require(coin_amount <= requested_coin_amount, "dc2");

    emit DecreaseCoinSupplyEvent(requested_coin_amount, elapsed_time,
                                 eth_balance, eth_amount, coin_amount);
    return (eth_amount, coin_amount);
  }

  // Return the current price in the Dutch auction.
  //
  // Parameters
  // ----------------
  // |elapsed_time|: The elapsed seconds from the current epoch start.
  //
  // Returns
  // ----------------
  // The current price.
  function getCurrentPrice(uint elapsed_time)
      public view returns (uint) {
    if (coin_budget_ > 0) {
      uint price = start_price_;
      for (uint i = 0;
           i < elapsed_time / PRICE_CHANGE_INTERVAL && i < PRICE_CHANGE_MAX;
           i++) {
        price = price * (100 - PRICE_CHANGE_PERCENTAGE) / 100;
      }
      if (price == 0) {
        price = 1;
      }
      return price;
    } else if (coin_budget_ < 0) {
      uint price = start_price_;
      for (uint i = 0;
           i < elapsed_time / PRICE_CHANGE_INTERVAL && i < PRICE_CHANGE_MAX;
           i++) {
        price = price * (100 + PRICE_CHANGE_PERCENTAGE) / 100;
      }
      return price;
    }
    return 0;
  }
  
  // Update the coin budget. The coin budget indicates how many coins should
  // be added to / removed from the total coin supply; i.e., the amount of JLC
  // to be sold / purchased by the open market operation. The ACB calls the
  // method at the beginning of each epoch.
  //
  // Parameters
  // ----------------
  // |coin_budget|: The coin budget.
  //
  // Returns
  // ----------------
  // None.
  function updateCoinBudget(int coin_budget)
      public onlyOwner {
    coin_budget_ = coin_budget;
    require(latest_price_ > 0, "uc1");
    if (coin_budget_ > 0) {
      start_price_ = latest_price_ * START_PRICE_MULTIPLIER;
      require(start_price_ > 0, "uc2");
    } else if (coin_budget_ == 0) {
      start_price_ = 0;
    } else {
      start_price_ = latest_price_ / START_PRICE_MULTIPLIER;
      if (start_price_ == 0) {
        start_price_ = 1;
      }
      require(start_price_ > 0, "uc3");
    }
    emit UpdateCoinBudgetEvent(coin_budget_);
  }
}

//------------------------------------------------------------------------------
// [EthPool contract]
//
// The EthPool contract stores ETH for the open market operation.
//
// Permission: Except public getters, only the ACB can call the methods.
//------------------------------------------------------------------------------
contract EthPool is OwnableUpgradeable {
  // Initializer.
  function initialize()
      public initializer {
    __Ownable_init();
  }
  
  // Increase ETH.
  function increaseEth()
      public onlyOwner payable {
  }

  // Decrease |eth_amount| ETH and send it to the |receiver|.
  function decreaseEth(address receiver, uint eth_amount)
      public onlyOwner {
    require(address(this).balance >= eth_amount, "de1");
    (bool success,) =
        payable(receiver).call{value: eth_amount}("");
    require(success, "de2");
  }
}

//------------------------------------------------------------------------------
// [ACB contract]
//
// The ACB stabilizes the USD / JLC exchange rate to 1.0 with algorithmically
// defined monetary policies:
//
// 1. The ACB obtains the exchange rate from the oracle.
// 2. If the exchange rate is 1.0, the ACB does nothing.
// 3. If the exchange rate is higher than 1.0, the ACB increases the total coin
//    supply by redeeming issued bonds (regardless of their redemption dates).
//    If that is not enough to supply sufficient coins, the ACB performs an open
//    market operation to sell JLC and purchase ETH to increase the total coin
//    supply.
// 4. If the exchange rate is lower than 1.0, the ACB decreases the total coin
//    supply by issuing new bonds. If the exchange rate drops down to 0.6, the
//    ACB performs an open market operation to sell ETH and purchase JLC to
//    decrease the total coin supply.
//
// Permission: All the methods are public. No one (including the genesis
// account) is privileged to influence the monetary policies of the ACB. The ACB
// is fully decentralized and there is truly no gatekeeper. The only exceptions
// are a few methods the genesis account may use to upgrade the smart contracts
// to fix bugs during a development phase.
//------------------------------------------------------------------------------
contract ACB is OwnableUpgradeable, PausableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;
  bytes32 public constant NULL_HASH = 0;

  // Constants. The values are defined in initialize(). The values never change
  // during the contract execution but use 'public' (instead of 'constant')
  // because tests want to override the values.
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

  // Initializer. The ownership of the contracts needs to be transferred to the
  // ACB just after the initializer is invoked.
  //
  // Parameters
  // ----------------
  // |coin|: The JohnLawCoin contract.
  // |oracle|: The Oracle contract.
  // |bond_operation|: The BondOperation contract.
  // |open_market_operation|: The OpenMarketOperation contract.
  // |eth_pool|: The EthPool contract.
  // |logging|: The Logging contract.
  function initialize(JohnLawCoin coin, Oracle oracle,
                      BondOperation bond_operation,
                      OpenMarketOperation open_market_operation,
                      EthPool eth_pool,
                      Logging logging)
      public initializer {
    __Ownable_init();
    __Pausable_init();

    // Constants.

    // The following table shows the mapping from the oracle level to the
    // exchange rate. Voters can vote for one of the oracle levels.
    //
    // ----------------------------------
    // | oracle level | exchange rate   |
    // ----------------------------------
    // |            0 | 1 JLC = 0.6 USD |
    // |            1 | 1 JLC = 0.7 USD |
    // |            2 | 1 JLC = 0.8 USD |
    // |            3 | 1 JLC = 0.9 USD |
    // |            4 | 1 JLC = 1.0 USD |
    // |            5 | 1 JLC = 1.1 USD |
    // |            6 | 1 JLC = 1.2 USD |
    // |            7 | 1 JLC = 1.3 USD |
    // |            8 | 1 JLC = 1.4 USD |
    // ----------------------------------
    //
    // Voters are expected to look up the current exchange rate using
    // real-world currency exchangers and vote for the oracle level that is
    // closest to the current exchange rate. Strictly speaking, the current
    // exchange rate is defined as the exchange rate at the point when the
    // current epoch started (i.e., current_epoch_start_).
    //
    // In the bootstrap phase where no currency exchanger supports JLC <->
    // USD conversion, voters are expected to vote for the oracle level 5
    // (i.e., 1 JLC = 1.1 USD). This helps increase the total coin supply
    // gradually and incentivize early adopters in the bootstrap phase. Once
    // a currency exchanger supports the conversion, voters are expected to
    // vote for the oracle level that is closest to the real-world exchange
    // rate.
    //
    // Note that 10000000 coins (corresponding to 10 M USD) are given to the
    // genesis account initially. This is important to make sure that the
    // genesis account has power to determine the exchange rate until the
    // ecosystem stabilizes. Once a real-world currency exchanger supports
    // the conversion and the oracle gets a sufficient number of honest voters
    // to agree on the real-world exchange rate consistently, the genesis
    // account can lose its power by decreasing its coin balance, moving the
    // oracle to a fully decentralized system. This mechanism is mandatory
    // to stabilize the exchange rate and bootstrap the ecosystem successfully.

    // LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
    // exchange rates. The real exchange rate is obtained by dividing the values
    // by EXCHANGE_RATE_DIVISOR. For example, 11 corresponds to the exchange
    // rate of 1.1. This translation is needed to avoid using float numbers in
    // Solidity.
    LEVEL_TO_EXCHANGE_RATE = [6, 7, 8, 9, 10, 11, 12, 13, 14];
    EXCHANGE_RATE_DIVISOR = 10;

    // The duration of the epoch. The ACB adjusts the total coin supply once
    // per epoch. Voters can vote once per epoch.
    //
    // TODO: Change the value to 7 * 24 * 60 * 60 before launching to the
    // mainnet. It's set to 1 min for the Ropsten Testnet.
    EPOCH_DURATION = 60; // 1 week.

    // The percentage of the coin balance voters need to deposit.
    DEPOSIT_RATE = 10; // 10%.

    // A damping factor to avoid minting or burning too many coins in one epoch.
    DAMPING_FACTOR = 10; // 10%.

    // Attributes.

    // The JohnLawCoin contract.
    coin_ = coin;
    
    // The Oracle contract.
    oracle_ = oracle;

    // The BondOperation contract.
    bond_operation_ = bond_operation;

    // The OpenMarketOperation contract.
    open_market_operation_ = open_market_operation;

    // The EthPool contract.
    eth_pool_ = eth_pool;

    // The Logging contract.
    logging_ = logging;

    // The current oracle level.
    oracle_level_ = oracle.LEVEL_MAX();

    // The timestamp when the current epoch started.
    current_epoch_start_ = getTimestamp();

    require(LEVEL_TO_EXCHANGE_RATE.length == oracle.LEVEL_MAX(), "AC1");
  }

  // Deprecate the ACB. Only the genesis account can call this method.
  function deprecate()
      public onlyOwner {
    coin_.transferOwnership(msg.sender);
    oracle_.transferOwnership(msg.sender);
    bond_operation_.transferOwnership(msg.sender);
    open_market_operation_.transferOwnership(msg.sender);
    eth_pool_.transferOwnership(msg.sender);
    logging_.transferOwnership(msg.sender);
  }

  // Pause the ACB in emergency cases. Only the genesis account can call this
  // method.
  function pause()
      public onlyOwner {
    if (!paused()) {
      _pause();
    }
    coin_.pause();
  }

  // Unpause the ACB. Only the genesis account can call this method.
  function unpause()
      public onlyOwner {
    if (paused()) {
      _unpause();
    }
    coin_.unpause();
  }

  // Payable fallback to receive and store ETH. Give us tips :D
  fallback() external payable {
    require(msg.data.length == 0, "fb1");
    emit PayableEvent(msg.sender, msg.value);
  }
  receive() external payable {
    emit PayableEvent(msg.sender, msg.value);
  }

  // Withdraw the tips. Only the genesis account can call this method.
  function withdrawTips()
      public whenNotPaused onlyOwner {
    (bool success,) =
        payable(msg.sender).call{value: address(this).balance}("");
    require(success, "wt1");
  }

  // A struct to pack local variables. This is needed to avoid a stack-too-deep
  // error in Solidity.
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
  // |oracle_level|: The oracle level you voted for in the epoch N-1.
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
  function vote(bytes32 hash, uint oracle_level, uint salt)
      public whenNotPaused returns (bool, bool, uint, uint, uint, bool) {
    VoteResult memory result;

    result.epoch_id = oracle_.epoch_id_();
    result.epoch_updated = false;
    if (getTimestamp() >= current_epoch_start_ + EPOCH_DURATION) {
      // Start a new epoch.
      result.epoch_updated = true;
      result.epoch_id += 1;
      current_epoch_start_ = getTimestamp();
      
      // Advance to the next epoch. Provide the |tax| coins to the oracle
      // as a reward.
      uint tax = coin_.balanceOf(coin_.tax_account_());
      coin_.transferOwnership(address(oracle_));
      uint burned = oracle_.advance(coin_);
      oracle_.revokeOwnership(coin_);
      
      // Reset the tax account address just in case.
      coin_.resetTaxAccount();
      require(coin_.balanceOf(coin_.tax_account_()) == 0, "vo1");
      
      int delta = 0;
      oracle_level_ = oracle_.getModeLevel();
      if (oracle_level_ != oracle_.LEVEL_MAX()) {
        require(0 <= oracle_level_ && oracle_level_ < oracle_.LEVEL_MAX(),
                "vo2");
        // Translate the oracle level to the exchange rate.
        uint exchange_rate = LEVEL_TO_EXCHANGE_RATE[oracle_level_];

        // Calculate the amount of coins to be minted or burned based on the
        // Quantity Theory of Money. If the exchange rate is 1.1 (i.e., 1 JLC
        // = 1.1 USD), the total coin supply is increased by 10%. If the
        // exchange rate is 0.8 (i.e., 1 JLC = 0.8 USD), the total coin supply
        // is decreased by 20%.
        delta = coin_.totalSupply().toInt256() *
                (int(exchange_rate) - int(EXCHANGE_RATE_DIVISOR)) /
                int(EXCHANGE_RATE_DIVISOR);

        // To avoid increasing or decreasing too many coins in one epoch,
        // multiply the damping factor.
        delta = delta * int(DAMPING_FACTOR) / 100;
      }

      // Update the bond budget.
      uint mint = bond_operation_.updateBondBudget(delta, result.epoch_id);

      // Update the coin budget.
      if (oracle_level_ == 0 && delta < 0) {
        require(mint == 0, "vo3");
        open_market_operation_.updateCoinBudget(delta);
      } else {
        open_market_operation_.updateCoinBudget(mint.toInt256());
      }

      logging_.updateEpoch(
          result.epoch_id, mint, burned, delta, coin_.totalSupply(),
          oracle_level_, current_epoch_start_, tax);
      logging_.updateBondBudget(
          result.epoch_id, bond_operation_.bond_budget_(),
          bond_operation_.bond_().totalSupply(),
          bond_operation_.validBondSupply(result.epoch_id));
      logging_.updateCoinBudget(
          result.epoch_id, open_market_operation_.coin_budget_(),
          address(eth_pool_).balance,
          open_market_operation_.latest_price_());
      emit UpdateEpochEvent(result.epoch_id, current_epoch_start_, tax,
                            burned, delta, mint);
    }

    coin_.transferOwnership(address(oracle_));
    
    // Commit.
    //
    // The voter needs to deposit the DEPOSIT_RATE percentage of their coin
    // balance.
    result.deposited = coin_.balanceOf(msg.sender) * DEPOSIT_RATE / 100;
    if (hash == NULL_HASH) {
      result.deposited = 0;
    }
    result.commit_result = oracle_.commit(
        msg.sender, hash, result.deposited, coin_);
    if (!result.commit_result) {
      result.deposited = 0;
    }

    // Reveal.
    result.reveal_result = oracle_.reveal(msg.sender, oracle_level, salt);
    
    // Reclaim.
    (result.reclaimed, result.rewarded) = oracle_.reclaim(msg.sender, coin_);

    oracle_.revokeOwnership(coin_);

    logging_.vote(result.epoch_id, result.commit_result,
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
  // The redemption epoch of the purchased bonds.
  function purchaseBonds(uint count)
      public whenNotPaused returns (uint) {
    uint epoch_id = oracle_.epoch_id_();
    
    coin_.transferOwnership(address(bond_operation_));
    uint redemption_epoch =
        bond_operation_.increaseBondSupply(address(msg.sender), count,
                                           epoch_id, coin_);
    bond_operation_.revokeOwnership(coin_);
    
    logging_.purchaseBonds(epoch_id, count);
    emit PurchaseBondsEvent(address(msg.sender), epoch_id,
                            count, redemption_epoch);
    return redemption_epoch;
  }
  
  // Redeem bonds.
  //
  // Parameters
  // ----------------
  // |redemption_epochs|: An array of bonds to be redeemed. The bonds are
  // identified by their redemption epochs.
  //
  // Returns
  // ----------------
  // The number of successfully redeemed bonds.
  function redeemBonds(uint[] memory redemption_epochs)
      public whenNotPaused returns (uint) {
    uint epoch_id = oracle_.epoch_id_();
    
    coin_.transferOwnership(address(bond_operation_));
    (uint redeemed_bonds, uint expired_bonds) =
        bond_operation_.decreaseBondSupply(
            address(msg.sender), redemption_epochs, epoch_id, coin_);
    bond_operation_.revokeOwnership(coin_);
    
    logging_.redeemBonds(epoch_id, redeemed_bonds, expired_bonds);
    emit RedeemBondsEvent(address(msg.sender), epoch_id,
                          redeemed_bonds, expired_bonds);
    return redeemed_bonds;
  }

  // Pay ETH and purchase JLC from the open market operation.
  //
  // Parameters
  // ----------------
  // The sender needs to pay |requested_eth_amount| ETH.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  // - The amount of ETH the sender paid. This value can be smaller than
  // |requested_eth_amount| when the open market operation does not have enough
  // coin budget. The remaining ETH is returned to the sender's wallet.
  // - The amount of JLC the sender purchased.
  function purchaseCoins()
      public whenNotPaused payable returns (uint, uint) {
    uint requested_eth_amount = msg.value;
    uint elapsed_time = getTimestamp() - current_epoch_start_;
    
    // Calculate the amount of ETH and JLC to be exchanged.
    (uint eth_amount, uint coin_amount) =
        open_market_operation_.increaseCoinSupply(
            requested_eth_amount, elapsed_time);
    
    coin_.mint(msg.sender, coin_amount);
    
    require(address(this).balance >= requested_eth_amount, "pc1");
    bool success;
    (success,) =
        payable(address(eth_pool_)).call{value: eth_amount}(
            abi.encodeWithSignature("increaseEth()"));
    require(success, "pc2");
    
    logging_.purchaseCoins(oracle_.epoch_id_(), eth_amount, coin_amount);
    
    // Pay back the remaining ETH to the sender. This may trigger any arbitrary
    // operations in an external smart contract. This must be called at the very
    // end of purchaseCoins().
    (success,) =
        payable(msg.sender).call{value: requested_eth_amount - eth_amount}("");
    require(success, "pc3");

    emit PurchaseCoinsEvent(msg.sender, requested_eth_amount,
                            eth_amount, coin_amount);
    return (eth_amount, coin_amount);
  }
  
  // Pay JLC and purchase ETH from the open market operation.
  //
  // Parameters
  // ----------------
  // |requested_coin_amount|: The amount of JLC the sender is willing to pay.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  // - The amount of ETH the sender purchased.
  // - The amount of JLC the sender paid. This value can be smaller than
  // |requested_coin_amount| when the open market operation does not have
  // enough ETH in the pool.
  function sellCoins(uint requested_coin_amount)
      public whenNotPaused returns (uint, uint) {
    // The sender does not have enough coins.
    require(coin_.balanceOf(msg.sender) >= requested_coin_amount,
            "OpenMarketOperation: Your coin balance is not enough.");
        
    // Calculate the amount of ETH and JLC to be exchanged.
    uint elapsed_time = getTimestamp() - current_epoch_start_;
    (uint eth_amount, uint coin_amount) =
        open_market_operation_.decreaseCoinSupply(
            requested_coin_amount, elapsed_time, address(eth_pool_).balance);

    coin_.burn(msg.sender, coin_amount);
    
    logging_.sellCoins(oracle_.epoch_id_(), eth_amount, coin_amount);
    
    // Send ETH to the sender. This may trigger any arbitrary operations in an
    // external smart contract. This must be called at the very end of
    // sellCoins().
    eth_pool_.decreaseEth(msg.sender, eth_amount);
    
    emit SellCoinsEvent(msg.sender, requested_coin_amount,
                        eth_amount, coin_amount);
    return (eth_amount, coin_amount);
  }

  // Calculate a hash to be committed to the oracle. Voters are expected to call
  // this function to create the hash.
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
    return oracle_.encrypt(sender, level, salt);
  }

  // Public getter: Return the current timestamp in seconds.
  function getTimestamp()
      public virtual view returns (uint) {
    // block.timestamp is better than block.number because the granularity of
    // the epoch update is EPOCH_DURATION (1 week).
    return block.timestamp;
  }

}
