// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

pragma solidity ^0.8.0;

import "../JohnLawCoin.sol";

//------------------------------------------------------------------------------
// [JohnLawCoin contract]
//
// JohnLawCoin is implemented as ERC20 tokens.
//
// Permission: Only the ACB and its oracle can mint, burn and transfer the
// coins. Only the ACB can pause and unpause the contract. Coin holders can
// transfer their coins using the ERC20 token APIs.
//------------------------------------------------------------------------------
contract JohnLawCoin_v2 is ERC20PausableUpgradeable, OwnableUpgradeable {
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

  address public tax_account_v2_;
  mapping (address => uint) public dummy_;

  // Events.
  event TransferEvent(address indexed sender, address receiver,
                      uint amount, uint tax);

  function upgrade()
      public onlyOwner {
    tax_account_v2_ = tax_account_;
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
    mint_v2(account, amount);
  }

  function mint_v2(address account, uint amount)
      public onlyOwner {
    _mint(account, amount);
    dummy_[account] = amount;
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
    burn_v2(account, amount);
  }

  function burn_v2(address account, uint amount)
      public onlyOwner {
    _burn(account, amount);
    dummy_[account] = amount;
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
    move_v2(sender, receiver, amount);
  }

  function move_v2(address sender, address receiver, uint amount)
      public onlyOwner {
    _transfer(sender, receiver, amount);
    dummy_[receiver] = amount;
  }

  // Pause the contract. Only the ACB can call this method.
  function pause()
      public onlyOwner {
    if (!paused()) {
      _pause();
    }
  }
  
  // Unpause the contract. Only the ACB can call this method.
  function unpause()
      public onlyOwner {
    if (paused()) {
      _unpause();
    }
  }

  // Override decimals.
  function decimals()
      public pure override returns (uint8) {
    return 18;
  }

  // Set the tax rate. Only the ACB can call this method.
  function resetTaxAccount()
      public onlyOwner {
    resetTaxAccount_v2();
  }

  function resetTaxAccount_v2()
      public onlyOwner {
    address old_tax_account = tax_account_v2_;
    tax_account_v2_ = address(uint160(uint(keccak256(abi.encode(
        "tax_v2", block.number)))));
    move(old_tax_account, tax_account_v2_, balanceOf(old_tax_account));
    tax_account_v2_ = tax_account_;
  }

  // Override ERC20's transfer method to impose a tax set by the ACB.
  function transfer(address account, uint amount)
      public override returns (bool) {
    return transfer_v2(account, amount);
  }

  function transfer_v2(address account, uint amount)
      public returns (bool) {
    uint tax = amount * TAX_RATE / 100;
    _transfer(_msgSender(), tax_account_v2_, tax);
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
contract JohnLawBond_v2 is OwnableUpgradeable {
  using EnumerableSet for EnumerableSet.UintSet;

  // Attributes.
  
  // _bonds[account][redemption_epoch] stores the number of the bonds
  // owned by the |account| and have the |redemption_epoch|.
  mapping (address => mapping (uint => uint)) private _bonds;

  // A mapping from a user account to the redemption epochs of the bonds
  // owned by the user.
  mapping (address => EnumerableSet.UintSet) private _redemption_epochs;

  // A mapping from a user account to the number of bonds owned by the account.
  mapping (address => uint) private _bond_count;
  
  // bond_supply[redemption_epoch] is the total number of bonds that have
  // the |redemption_epoch|.
  mapping (uint => uint) private _bond_supply;
  
  // The total bond supply.
  uint private _total_supply;

  uint private _total_supply_v2;
  mapping (address => mapping (uint => uint)) private _bonds_v2;
  mapping (address => EnumerableSet.UintSet) private _redemption_epochs_v2;
  mapping (address => uint) private _bond_count_v2;
  mapping (uint => uint) private _bond_supply_v2;

  // Events.
  event MintEvent(address indexed account,
                  uint redemption_epoch, uint amount);
  event BurnEvent(address indexed account,
                  uint redemption_epoch, uint amount);

  function upgrade()
      public onlyOwner {
    _total_supply_v2 = _total_supply;
    for (uint epoch = 0; epoch < 100; epoch++) {
        _bond_supply_v2[epoch] = _bond_supply[epoch];
    }
  }
  
  // Mint bonds to one account. Only the ACB can call this method.
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
    mint_v2(account, redemption_epoch, amount);
  }

  function mint_v2(address account, uint redemption_epoch, uint amount)
      public onlyOwner {
    _bonds[account][redemption_epoch] += amount;
    _bonds_v2[account][redemption_epoch] += amount;
    _total_supply_v2 += amount;
    _bond_count[account] += amount;
    _bond_count_v2[account] += amount;
    _bond_supply[redemption_epoch] += amount;
    _bond_supply_v2[redemption_epoch] += amount;
    if (_bonds[account][redemption_epoch] > 0) {
      _redemption_epochs[account].add(redemption_epoch);
      _redemption_epochs_v2[account].add(redemption_epoch);
    }
    emit MintEvent(account, redemption_epoch, amount);
  }

  // Burn bonds from one account. Only the ACB can call this method.
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
    burn_v2(account, redemption_epoch, amount);
  }

  function burn_v2(address account, uint redemption_epoch, uint amount)
      public onlyOwner {
    _bonds[account][redemption_epoch] -= amount;
    _bonds_v2[account][redemption_epoch] += amount;
    _total_supply_v2 -= amount;
    _bond_count[account] -= amount;
    _bond_count_v2[account] += amount;  // Use + to avoid underflow.
    _bond_supply[redemption_epoch] -= amount;
    _bond_supply_v2[redemption_epoch] -= amount;
    if (_bonds[account][redemption_epoch] == 0) {
      _redemption_epochs[account].remove(redemption_epoch);
      _redemption_epochs_v2[account].remove(redemption_epoch);
    }
    emit BurnEvent(account, redemption_epoch, amount);
  }

  // Public getter: Return the number of bonds owned by the |account|.
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

  // Public getter: Return the number of the bonds owned by the |account| and
  // have the |redemption_epoch|.
  function balanceOf(address account, uint redemption_epoch)
      public view returns (uint) {
    return balanceOf_v2(account, redemption_epoch);
  }

  function balanceOf_v2(address account, uint redemption_epoch)
      public view returns (uint) {
    return _bonds[account][redemption_epoch];
  }

  // Public getter: Return the total bond supply.
  function totalSupply()
      public view returns (uint) {
    return _total_supply_v2;
  }

  // Public getter: Return the number of bonds whose redemption epoch is
  // |redemption_epoch|.
  function bondSupplyAt(uint redemption_epoch)
      public view returns (uint) {
    return _bond_supply_v2[redemption_epoch];
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
contract Oracle_v2 is OwnableUpgradeable {
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
  event CommitEvent(address indexed sender,
                    bytes32 hash, uint deposited);
  event RevealEvent(address indexed sender,
                    uint oracle_level, uint salt);
  event ReclaimEvent(address indexed sender, uint deposited, uint rewarded);
  event AdvancePhaseEvent(uint indexed epoch_id, uint tax, uint burned);

  function upgrade()
      public onlyOwner {
    epoch_id_v2_ = epoch_id_;
    for (uint epoch_index = 0; epoch_index < 3; epoch_index++) {
      epochs_[epoch_index].deposit_account_v2 =
          epochs_[epoch_index].deposit_account;
      epochs_[epoch_index].reward_account_v2 =
          epochs_[epoch_index].reward_account;
      epochs_[epoch_index].reward_total_v2 =
          epochs_[epoch_index].reward_total;
      epochs_[epoch_index].phase_v2 =
          epochs_[epoch_index].phase;
      for (uint level = 0; level < getLevelMax(); level++) {
        Vote storage vote = epochs_[epoch_index].votes[level];
        vote.should_reclaim_v2 = vote.should_reclaim;
        vote.should_reward_v2 = vote.should_reward;
        vote.deposit_v2 = vote.deposit;
        vote.count_v2 = vote.count;
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
    return commit_v2(coin, sender, hash, deposit);
  }
  
  function commit_v2(JohnLawCoin_v2 coin, address sender,
                     bytes32 hash, uint deposit)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[epoch_id_v2_ % 3];
    require(epoch.phase_v2 == Phase.COMMIT, "co1");
    if (coin.balanceOf(sender) < deposit) {
      return false;
    }
    // One voter can commit only once per phase.
    if (epoch.commits[sender].epoch_id == epoch_id_v2_) {
      return false;
    }

    // Create a commit entry.
    epoch.commits[sender] = Commit(
        hash, deposit, LEVEL_MAX, Phase.COMMIT, epoch_id_v2_,
        hash, deposit, LEVEL_MAX, epoch_id_v2_);
    require(epoch.commits[sender].phase == Phase.COMMIT, "co2");

    // Move the deposited coins to the deposit account.
    coin.move(sender, epoch.deposit_account_v2, deposit);
    emit CommitEvent(sender, hash, deposit);
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
    return reveal_v2(sender, oracle_level, salt);
  }
  
  function reveal_v2(address sender, uint oracle_level, uint salt)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[(epoch_id_v2_ - 1) % 3];
    require(epoch.phase_v2 == Phase.REVEAL, "rv1");
    if (LEVEL_MAX <= oracle_level) {
      return false;
    }
    if (epoch.commits[sender].epoch_id != epoch_id_v2_ - 1) {
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
    epoch.votes[oracle_level].deposit_v2 += epoch.commits[sender].deposit;
    epoch.votes[oracle_level].count_v2 += 1;
    emit RevealEvent(sender, oracle_level, salt);
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
    return reclaim_v2(coin, sender);
  }
  
  function reclaim_v2(JohnLawCoin_v2 coin, address sender)
      public onlyOwner returns (uint, uint) {
    Epoch storage epoch = epochs_[(epoch_id_v2_ - 2) % 3];
    require(epoch.phase_v2 == Phase.RECLAIM, "rc1");
    if (epoch.commits[sender].epoch_id != epoch_id_v2_ - 2){
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

    if (!epoch.votes[oracle_level].should_reclaim_v2) {
      return (0, 0);
    }

    require(epoch.votes[oracle_level].count_v2 > 0, "rc3");
    // Reclaim the deposited coins.
    coin.move(epoch.deposit_account_v2, sender, deposit);

    uint reward = 0;
    if (epoch.votes[oracle_level].should_reward_v2) {
      // The voter who voted for the "truth" level can receive the reward.
      //
      // The PROPORTIONAL_REWARD_RATE of the reward is distributed to the
      // voters in proportion to the coins they deposited. This incentivizes
      // voters who have many coins (and thus have more power on determining
      // the "truth" level) to join the oracle.
      //
      // The rest of the reward is distributed to the voters evenly. This
      // incentivizes more voters (including new voters) to join the oracle.
      if (epoch.votes[oracle_level].deposit_v2 > 0) {
        reward += (uint(PROPORTIONAL_REWARD_RATE) * epoch.reward_total_v2 *
                   deposit) /
                  (uint(100) * epoch.votes[oracle_level].deposit_v2);
      }
      reward += ((uint(100) - PROPORTIONAL_REWARD_RATE) *
                 epoch.reward_total_v2) /
                (uint(100) * epoch.votes[oracle_level].count_v2);
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
  //
  // Returns
  // ----------------
  // None.
  function advance(JohnLawCoin_v2 coin)
      public onlyOwner returns (uint) {
    return advance_v2(coin);
  }
  
  function advance_v2(JohnLawCoin_v2 coin)
      public onlyOwner returns (uint) {
    // Advance the phase.
    epoch_id_v2_ += 1;
    epoch_id_ += 1;

    // Step 1: Move the commit phase to the reveal phase.
    Epoch storage epoch = epochs_[(epoch_id_v2_ - 1) % 3];
    require(epoch.phase_v2 == Phase.COMMIT, "ad1");
    epoch.phase_v2 = Phase.REVEAL;

    // Step 2: Move the reveal phase to the reclaim phase.
    epoch = epochs_[(epoch_id_v2_ - 2) % 3];
    require(epoch.phase_v2 == Phase.REVEAL, "ad2");
    epoch.phase_v2 = Phase.RECLAIM;

    // The "truth" level is set to the mode of the weighted majority votes.
    uint mode_level = getModeLevel();
    if (0 <= mode_level && mode_level < LEVEL_MAX) {
      uint deposit_revealed = 0;
      uint deposit_to_reclaim = 0;
      for (uint level = 0; level < LEVEL_MAX; level++) {
        require(epoch.votes[level].should_reclaim_v2 == false, "ad3");
        require(epoch.votes[level].should_reward_v2 == false, "ad4");
        deposit_revealed += epoch.votes[level].deposit_v2;
        if ((mode_level < RECLAIM_THRESHOLD ||
             mode_level - RECLAIM_THRESHOLD <= level) &&
            level <= mode_level + RECLAIM_THRESHOLD) {
          // Voters who voted for the oracle levels in [mode_level -
          // reclaim_threshold, mode_level + reclaim_threshold] are eligible
          // to reclaim their deposited coins. Other voters lose their deposited
          // coins.
          epoch.votes[level].should_reclaim_v2 = true;
          deposit_to_reclaim += epoch.votes[level].deposit_v2;
        }
      }

      // Voters who voted for the "truth" level are eligible to receive the
      // reward.
      epoch.votes[mode_level].should_reward_v2 = true;

      // Note: |deposit_revealed| is equal to
      // |balanceOf(epoch.deposit_account_v2)|
      // only when all the voters who voted in the commit phase revealed
      // their votes correctly in the reveal phase.
      require(deposit_revealed <= coin.balanceOf(epoch.deposit_account_v2),
              "ad5");
      require(deposit_to_reclaim <= coin.balanceOf(epoch.deposit_account_v2),
              "ad6");

      // The lost coins are moved to the reward account.
      coin.move(
          epoch.deposit_account_v2,
          epoch.reward_account_v2,
          coin.balanceOf(epoch.deposit_account_v2) - deposit_to_reclaim);
    }

    // Move the collected tax to the reward account.
    address tax_account = coin.tax_account_v2_();
    uint tax = coin.balanceOf(tax_account);
    coin.move(tax_account, epoch.reward_account_v2, tax);

    // Set the total amount of the reward.
    epoch.reward_total_v2 = coin.balanceOf(epoch.reward_account_v2);

    // Step 3: Move the reclaim phase to the commit phase.
    uint epoch_index = epoch_id_v2_ % 3;
    epoch = epochs_[epoch_index];
    require(epoch.phase_v2 == Phase.RECLAIM, "ad7");

    uint burned = coin.balanceOf(epoch.deposit_account_v2) +
                  coin.balanceOf(epoch.reward_account_v2);
    // Burn the remaining deposited coins.
    coin.burn(epoch.deposit_account_v2, coin.balanceOf(
        epoch.deposit_account_v2));
    // Burn the remaining reward.
    coin.burn(epoch.reward_account_v2, coin.balanceOf(epoch.reward_account_v2));

    // Initialize the Epoch object for the next commit phase.
    //
    // |epoch.commits_| cannot be cleared due to the restriction of Solidity.
    // |epoch_id_| ensures the stale commit entries are not misused.
    for (uint level = 0; level < LEVEL_MAX; level++) {
      epoch.votes[level] = Vote(0, 0, false, false, false, false, 0, 0);
    }
    // Regenerate the account addresses just in case.
    require(coin.balanceOf(epoch.deposit_account_v2) == 0, "ad8");
    require(coin.balanceOf(epoch.reward_account_v2) == 0, "ad9");
    epoch.deposit_account_v2 =
        address(uint160(uint(keccak256(abi.encode(
            "deposit_v2", epoch_index, block.number)))));
    epoch.reward_account_v2 =
        address(uint160(uint(keccak256(abi.encode(
            "reward_v2", epoch_index, block.number)))));
    epoch.reward_total_v2 = 0;
    epoch.phase_v2 = Phase.COMMIT;

    emit AdvancePhaseEvent(epoch_id_v2_, tax, burned);
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
    return getModeLevel_v2();
  }
  
  function getModeLevel_v2()
      public onlyOwner view returns (uint) {
    Epoch storage epoch = epochs_[(epoch_id_v2_ - 2) % 3];
    require(epoch.phase_v2 == Phase.RECLAIM, "gm1");
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
  function revokeOwnership(JohnLawCoin_v2 coin)
      public onlyOwner {
    return revokeOwnership_v2(coin);
  }
  
  function revokeOwnership_v2(JohnLawCoin_v2 coin)
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
    return (vote.deposit_v2, vote.count_v2, vote.should_reclaim_v2,
            vote.should_reward_v2);
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
  function encrypt(address sender, uint level, uint salt)
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
// The Logging contract records various metrics for analysis purpose.
//------------------------------------------------------------------------------
contract Logging_v2 is OwnableUpgradeable {
  
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

    uint new_value1;
    uint new_value2;
    uint new_value3;
    uint new_value4;
  }

  // A struct to record metrics about epoch.
  struct EpochLog {
    uint minted_coins;
    uint burned_coins;
    int coin_supply_delta;
    int bond_budget;
    uint total_coin_supply;
    uint total_bond_supply;
    uint valid_bond_supply;
    uint oracle_level;
    uint current_epoch_start;
    uint tax;

    uint new_value1;
    uint new_value2;
  }

  // A struct to record metrics about bond operations.
  struct BondLog {
    uint purchased_bonds;
    uint redeemed_bonds;
    uint expired_bonds;

    uint new_value1;
    uint new_value2;
  }

  struct AnotherLog {
    uint new_value1;
    uint new_value2;
    uint new_value3;
    uint new_value4;
  }

  // Attributes.

  // Logs about voting.
  mapping (uint => VoteLog) public vote_logs_;
  
  // Logs about epoch.
  mapping (uint => EpochLog) public epoch_logs_;

  // Logs about bond operations.
  mapping (uint => BondLog) public bond_logs_;

  mapping (uint => AnotherLog) public another_logs_;
 
  function upgrade()
      public onlyOwner {
  }

  // Public getter: Return the VoteLog of |epoch_id|.
  function getVoteLog(uint epoch_id)
      public view returns (
          uint, uint, uint, uint, uint, uint, uint, uint, uint) {
    return getVoteLog_v2(epoch_id);
  }

  function getVoteLog_v2(uint epoch_id)
      public view returns (
          uint, uint, uint, uint, uint, uint, uint, uint, uint) {
    VoteLog memory log = vote_logs_[epoch_id];
    return (log.commit_succeeded, log.commit_failed, log.reveal_succeeded,
            log.reveal_failed, log.reclaim_succeeded, log.reward_succeeded,
            log.deposited, log.reclaimed, log.rewarded);
  }

  // Public getter: Return the EpochLog of |epoch_id|.
  function getEpochLog(uint epoch_id)
      public view returns (
          uint, uint, int, int, uint, uint, uint, uint, uint, uint) {
    return getEpochLog_v2(epoch_id);
  }

  function getEpochLog_v2(uint epoch_id)
      public view returns (
          uint, uint, int, int, uint, uint, uint, uint, uint, uint) {
    EpochLog memory log = epoch_logs_[epoch_id];
    return (log.minted_coins, log.burned_coins, log.coin_supply_delta,
            log.bond_budget, log.total_coin_supply, log.total_bond_supply,
            log.valid_bond_supply, log.oracle_level, log.current_epoch_start,
            log.tax);
  }
  
  // Public getter: Return the BondLog of |epoch_id|.
  function getBondLog(uint epoch_id)
      public view returns (uint, uint, uint) {
    return getBondLog_v2(epoch_id);
  }

  function getBondLog_v2(uint epoch_id)
      public view returns (uint, uint, uint) {
    BondLog memory log = bond_logs_[epoch_id];
    return (log.purchased_bonds, log.redeemed_bonds, log.expired_bonds);
  }
  
  // Called when the oracle phase is updated.
  //
  // Parameters
  // ----------------
  // |epoch_id|: The epoch ID.
  // |minted|: The amount of the minted coins.
  // |burned|: The amount of the burned coins.
  // |delta|: The delta of the total coin supply.
  // |bond_budget|: ACB.bond_budget_.
  // |total_coin_supply|: The total coin supply.
  // |total_bond_supply|: The total bond supply.
  // |oracle_level|: ACB.oracle_level_.
  // |current_epoch_start|: ACB.current_epoch_start_.
  // |tax|: The amount of the tax collected in the phase.
  //
  // Returns
  // ----------------
  // None.
  function updatedEpoch(uint epoch_id, uint minted, uint burned, int delta,
                        int bond_budget, uint total_coin_supply,
                        uint total_bond_supply, uint valid_bond_supply,
                        uint oracle_level, uint current_epoch_start, uint tax)
      public onlyOwner {
    updatedEpoch_v2(epoch_id, minted, burned, delta, bond_budget,
                    total_coin_supply, total_bond_supply, valid_bond_supply,
                    oracle_level, current_epoch_start, tax);
  }

  function updatedEpoch_v2(uint epoch_id, uint minted, uint burned, int delta,
                           int bond_budget, uint total_coin_supply,
                           uint total_bond_supply, uint valid_bond_supply,
                           uint oracle_level, uint current_epoch_start,
                           uint tax)
      public onlyOwner {
    epoch_logs_[epoch_id].minted_coins = minted;
    epoch_logs_[epoch_id].burned_coins = burned;
    epoch_logs_[epoch_id].coin_supply_delta = delta;
    epoch_logs_[epoch_id].bond_budget = bond_budget;
    epoch_logs_[epoch_id].total_coin_supply = total_coin_supply;
    epoch_logs_[epoch_id].total_bond_supply = total_bond_supply;
    epoch_logs_[epoch_id].valid_bond_supply = valid_bond_supply;
    epoch_logs_[epoch_id].oracle_level = oracle_level;
    epoch_logs_[epoch_id].current_epoch_start = current_epoch_start;
    epoch_logs_[epoch_id].tax = tax;
    epoch_logs_[epoch_id].new_value1 += minted;
    epoch_logs_[epoch_id].new_value2 += burned;

    another_logs_[epoch_id].new_value1 += minted;
    another_logs_[epoch_id].new_value2 += burned;
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
  function voted(uint epoch_id, bool commit_result, bool reveal_result,
                 uint deposit, uint reclaimed, uint rewarded)
      public onlyOwner {
    voted_v2(epoch_id, commit_result, reveal_result, deposit,
             reclaimed, rewarded);
  }

  function voted_v2(uint epoch_id, bool commit_result, bool reveal_result,
                    uint deposit, uint reclaimed, uint rewarded)
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
    vote_logs_[epoch_id].deposited += deposit;
    vote_logs_[epoch_id].reclaimed += reclaimed;
    vote_logs_[epoch_id].rewarded += rewarded;
    vote_logs_[epoch_id].new_value1 += deposit;
    vote_logs_[epoch_id].new_value2 += reclaimed;

    another_logs_[epoch_id].new_value1 += deposit;
    another_logs_[epoch_id].new_value2 += reclaimed;
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
  function purchasedBonds(uint epoch_id, uint purchased_bonds)
      public onlyOwner {
    purchasedBonds_v2(epoch_id, purchased_bonds);
  }

  function purchasedBonds_v2(uint epoch_id, uint purchased_bonds)
      public onlyOwner {
    bond_logs_[epoch_id].purchased_bonds += purchased_bonds;
    bond_logs_[epoch_id].new_value1 += purchased_bonds;
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
  function redeemedBonds(uint epoch_id, uint redeemed_bonds, uint expired_bonds)
      public onlyOwner {
    redeemedBonds_v2(epoch_id, redeemed_bonds, expired_bonds);
  }
  
  function redeemedBonds_v2(uint epoch_id, uint redeemed_bonds, uint expired_bonds)
      public onlyOwner {
    bond_logs_[epoch_id].redeemed_bonds += redeemed_bonds;
    bond_logs_[epoch_id].expired_bonds += expired_bonds;
    bond_logs_[epoch_id].new_value1 += redeemed_bonds;
    bond_logs_[epoch_id].new_value2 += expired_bonds;
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
//    supply by issuing new bonds.
//
// Permission: All methods are public. No one (including the genesis account)
// is privileged to influence the monetary policies of the ACB. The ACB
// is fully decentralized and there is truly no gatekeeper. The only exceptions
// are a few methods that can be called only by the genesis account. They are
// needed for the genesis account to upgrade the smart contract and fix bugs
// in a development phase.
//------------------------------------------------------------------------------
contract ACB_v2 is OwnableUpgradeable, PausableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;
  bytes32 public constant NULL_HASH = 0;

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'public' (instead of
  // 'constant') because tests want to override the values.
  uint public BOND_PRICE;
  uint public BOND_REDEMPTION_PRICE;
  uint public BOND_REDEMPTION_PERIOD;
  uint public BOND_REDEEMABLE_PERIOD;
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
  JohnLawBond public bond_;
  Oracle public oracle_;
  Logging public logging_;
  int public bond_budget_;
  uint public oracle_level_;
  uint public current_epoch_start_;

  JohnLawCoin_v2 public coin_v2_;
  JohnLawBond_v2 public bond_v2_;
  Oracle_v2 public oracle_v2_;
  Logging_v2 public logging_v2_;
  int public bond_budget_v2_;
  uint public oracle_level_v2_;
  uint public current_epoch_start_v2_;

  // Events.
  event PayableEvent(address indexed sender, uint value);
  event VoteEvent(address indexed sender, bytes32 hash,
                  uint oracle_level, uint salt,
                  bool commit_result, bool reveal_result,
                  uint deposited, uint reclaimed, uint rewarded,
                  bool epoch_updated);
  event PurchaseBondsEvent(address indexed sender, uint purchased_bonds,
                           uint redemption_epoch);
  event RedeemBondsEvent(address indexed sender, uint redeemed_bonds,
                         uint expired_bonds);
  event ControlSupplyEvent(int delta, int bond_budget, uint mint);

  function upgrade(JohnLawCoin_v2 coin, JohnLawBond_v2 bond,
                   Oracle_v2 oracle, Logging_v2 logging)
      public onlyOwner {
    coin_v2_ = coin;
    bond_v2_ = bond;
    bond_budget_v2_ = bond_budget_;
    oracle_v2_ = oracle;
    oracle_level_v2_ = oracle_level_;
    current_epoch_start_v2_ = current_epoch_start_;
    logging_v2_ = logging;

    coin_v2_.upgrade();
    bond_v2_.upgrade();
    oracle_v2_.upgrade();
    logging_v2_.upgrade();
  }

  // Deprecate the ACB. Only the owner can call this method.
  function deprecate()
      public onlyOwner {
    coin_v2_.transferOwnership(msg.sender);
    bond_v2_.transferOwnership(msg.sender);
    oracle_v2_.transferOwnership(msg.sender);
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
    bool epoch_updated;
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
  // |hash|: The hash to be committed in the current phase. Specify
  // ACB.NULL_HASH if you do not want to commit and only want to reveal and
  // reclaim previous votes.
  // |oracle_level|: The oracle level you voted for in the previous phase.
  // |salt|: The salt you used in the previous phase.
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
  function vote(bytes32 hash, uint oracle_level,
                uint salt)
      public whenNotPaused returns (bool, bool, uint, uint, uint, bool) {
    return vote_v2(hash, oracle_level, salt);
  }
  
  function vote_v2(bytes32 hash, uint oracle_level,
                   uint salt)
      public whenNotPaused returns (bool, bool, uint, uint, uint, bool) {
    VoteResult memory result;
    
    result.epoch_updated = false;
    if (getTimestamp() >= current_epoch_start_v2_ + EPOCH_DURATION) {
      // Start a new phase.
      result.epoch_updated = true;
      current_epoch_start_v2_ = getTimestamp();
      current_epoch_start_ = current_epoch_start_v2_;
      
      // Advance to the next phase. Provide the |tax| coins to the oracle
      // as a reward.
      uint tax = coin_v2_.balanceOf(coin_v2_.tax_account_v2_());
      coin_v2_.transferOwnership(address(oracle_v2_));
      uint burned = oracle_v2_.advance(coin_v2_);
      oracle_v2_.revokeOwnership(coin_v2_);
      
      // Reset the tax account address just in case.
      coin_v2_.resetTaxAccount();
      require(coin_v2_.balanceOf(coin_v2_.tax_account_v2_()) == 0, "vo2");
      
      int delta = 0;
      oracle_level_ = oracle_v2_.getModeLevel();
      if (oracle_level_ != oracle_v2_.getLevelMax()) {
        require(0 <= oracle_level_ && oracle_level_ < oracle_v2_.getLevelMax(),
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
        
        // To avoid increasing or decreasing too many coins in one phase,
        // multiply the damping factor.
        delta = delta * int(DAMPING_FACTOR) / 100;
      }

      // Increase or decrease the total coin supply.
      uint mint = _controlSupply(delta);

      logging_v2_.updatedEpoch(oracle_v2_.epoch_id_(), mint, burned, delta,
                               bond_budget_, coin_v2_.totalSupply(),
                               bond_v2_.totalSupply(), validBondSupply(),
                               oracle_level_, current_epoch_start_v2_, tax);
    }
    
    coin_v2_.transferOwnership(address(oracle_v2_));

    // Commit.
    //
    // The voter needs to deposit the DEPOSIT_RATE percentage of their coin
    // balance.
    result.deposited = coin_v2_.balanceOf(msg.sender) * DEPOSIT_RATE / 100;
    if (hash == 0) {
      result.deposited = 0;
    }
    result.commit_result = oracle_v2_.commit(
        coin_v2_, msg.sender, hash, result.deposited);
    if (!result.commit_result) {
      result.deposited = 0;
    }
    
    // Reveal.
    result.reveal_result = oracle_v2_.reveal(msg.sender, oracle_level, salt);
    
    // Reclaim.
    (result.reclaimed, result.rewarded) =
        oracle_v2_.reclaim(coin_v2_, msg.sender);

    oracle_v2_.revokeOwnership(coin_v2_);
    
    logging_v2_.voted(oracle_v2_.epoch_id_(), result.commit_result,
                      result.reveal_result, result.deposited,
                      result.reclaimed, result.rewarded);
    emit VoteEvent(
        msg.sender, hash, oracle_level, salt,
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
    return purchaseBonds_v2(count);
  }

  function purchaseBonds_v2(uint count)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    require(count > 0, "PurchaseBonds: You must purchase at least one bond.");
    require(bond_budget_ >= count.toInt256(),
            "PurchaseBonds: The ACB's bond budget is not enough.");

    uint amount = BOND_PRICE * count;
    require(coin_v2_.balanceOf(sender) >= amount,
            "PurchaseBonds: Your coin balance is not enough.");

    // Set the redemption epoch of the bonds.
    uint redemption_epoch = oracle_v2_.epoch_id_() + BOND_REDEMPTION_PERIOD;

    // Issue new bonds.
    bond_v2_.mint(sender, redemption_epoch, count);
    bond_budget_ -= count.toInt256();
    require(bond_budget_ >= 0, "pb1");
    require(validBondSupply().toInt256() + bond_budget_ >= 0, "pb2");
    require(bond_v2_.balanceOf(sender, redemption_epoch) > 0, "pb3");

    // Burn the corresponding coins.
    coin_v2_.burn(sender, amount);

    logging_v2_.purchasedBonds(oracle_v2_.epoch_id_(), count);
    emit PurchaseBondsEvent(sender, count, redemption_epoch);
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
    return redeemBonds_v2(redemption_epochs);
  }

  function redeemBonds_v2(uint[] memory redemption_epochs)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;

    uint redeemed_bonds = 0;
    uint expired_bonds = 0;
    uint epoch_id = oracle_v2_.epoch_id_();
    for (uint i = 0; i < redemption_epochs.length; i++) {
      uint redemption_epoch = redemption_epochs[i];
      uint count = bond_v2_.balanceOf(sender, redemption_epoch);
      if (epoch_id < redemption_epoch) {
        // If the bonds have not yet hit their redemption epoch, the ACB
        // accepts the redemption as long as |bond_budget_| is negative.
        if (bond_budget_ >= 0) {
          continue;
        }
        if (count > (-bond_budget_).toUint256()) {
          count = (-bond_budget_).toUint256();
        }
      }
      if (epoch_id < redemption_epoch + BOND_REDEEMABLE_PERIOD) {
        // If the bonds are not expired, mint the corresponding coins to the
        // user account.
        uint amount = count * BOND_REDEMPTION_PRICE;
        coin_v2_.mint(sender, amount);

        // Burn the redeemed bonds.
        bond_budget_ += count.toInt256();
        redeemed_bonds += count;
      } else {
        expired_bonds += count;
      }
      bond_v2_.burn(sender, redemption_epoch, count);
    }
    require(validBondSupply().toInt256() + bond_budget_ >= 0, "rb1");
    
    logging_v2_.redeemedBonds(epoch_id, redeemed_bonds, expired_bonds);
    emit RedeemBondsEvent(sender, redeemed_bonds, expired_bonds);
    return redeemed_bonds;
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
    return _controlSupply_v2(delta);
  }

  function _controlSupply_v2(int delta)
      internal whenNotPaused returns (uint) {
    uint mint = 0;
    uint bond_supply = validBondSupply();
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
        // The ACB needs to mint the remaining coins.
        mint = (count - bond_supply) * BOND_REDEMPTION_PRICE;
      }
      require(bond_budget_ <= 0, "cs1");
    } else {
      // Issue new bonds to decrease the total coin supply.
      bond_budget_ = -delta / BOND_PRICE.toInt256();
      require(bond_budget_ >= 0, "cs2");
    }

    require(bond_supply.toInt256() + bond_budget_ >= 0, "cs3");
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
  function encrypt(uint level, uint salt)
      public view returns (bytes32) {
    return encrypt_v2(level, salt);
  }

  function encrypt_v2(uint level, uint salt)
      public view returns (bytes32) {
    address sender = msg.sender;
    return oracle_v2_.encrypt(sender, level, salt);
  }

  // Public getter: Return the valid bond supply; i.e., the total supply of
  // not-yet-expired bonds.
  function validBondSupply()
      public view returns (uint) {
    return validBondSupply_v2();
  }

  function validBondSupply_v2()
      public view returns (uint) {
    uint count = 0;
    uint epoch_id = oracle_v2_.epoch_id_();
    for (uint redemption_epoch =
             (epoch_id > BOND_REDEEMABLE_PERIOD ?
              epoch_id - BOND_REDEEMABLE_PERIOD + 1 : 0);
         // The previous versions of the smart contract might have used a larger
         // BOND_REDEMPTION_PERIOD. Add 20 to look up all the redemption
         // epochs that might have set in the previous versions.
         redemption_epoch <= epoch_id + BOND_REDEMPTION_PERIOD + 20;
         redemption_epoch++) {
      count += bond_v2_.bondSupplyAt(redemption_epoch);
    }
    return count;
  }

  // Public getter: Return the current timestamp in seconds.
  function getTimestamp()
      public virtual view returns (uint) {
    // block.timestamp is better than block.number because the granularity of
    // the phase update is EPOCH_DURATION (1 week).
    return block.timestamp;
  }

}
