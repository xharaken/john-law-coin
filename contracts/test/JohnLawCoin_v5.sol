// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

pragma solidity ^0.8.0;

import "./JohnLawCoin_v4.sol";

//------------------------------------------------------------------------------
// [BondOperation contract]
//
// The BondOperation contract increases / decreases the total coin supply by
// redeeming / issuing bonds. The bond budget is updated by the ACB every epoch.
//------------------------------------------------------------------------------
contract BondOperation_v5 is OwnableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'public' (instead of
  // 'constant') because tests want to override the values.
  uint public BOND_PRICE;
  uint public BOND_REDEMPTION_PRICE;
  uint public BOND_REDEMPTION_PERIOD;
  uint public BOND_REDEEMABLE_PERIOD;

  // Attributes. See the comment in initialize().
  JohnLawBond_v2 public bond_;
  int public bond_budget_;

  // Events.
  event PurchaseBondsEvent(address indexed sender, uint indexed epoch_id,
                           uint purchased_bonds, uint redemption_epoch);
  event RedeemBondsEvent(address indexed sender, uint indexed epoch_id,
                         uint redeemed_bonds, uint expired_bonds);
  event UpdateBondBudgetEvent(uint indexed epoch_id, int delta,
                              int bond_budget, uint mint);

  // Initializer. The ownership of the contracts needs to be transferred to the
  // ACB just after the initializer is invoked.
  //
  // Parameters
  // ----------------
  // |coin|: The JohnLawCoin contract.
  // |bond|: The JohnLawBond contract.
  // |oracle|: The Oracle contract.
  // |logging|: The Logging contract.
  function initialize(JohnLawBond_v2 bond, int bond_budget)
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
    // ACB's bond budget is negative. During BOND_REDEEMABLE_PERIOD, the
    // bonds are redeemable regardless of the ACB's bond budget. After
    // BOND_REDEEMABLE_PERIOD, the bonds are expired.
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
    bond_budget_ = bond_budget;
  }

  // Deprecate the contract. Only the owner can call this method.
  function deprecate()
      public onlyOwner {
    bond_.transferOwnership(msg.sender);
  }

  // Purchase bonds.
  //
  // Parameters
  // ----------------
  // |sender|: The sender account.
  // |count|: The number of bonds to purchase.
  // |epoch_id|: The current epoch ID.
  // |coin|: The JohnLawCoin contract.
  //
  // Returns
  // ----------------
  // The redemption epoch of the purchased bonds if it succeeds. 0 otherwise.
  function purchaseBonds(address sender, uint count,
                         uint epoch_id, JohnLawCoin_v2 coin)
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
    require((validBondSupply(epoch_id).toInt256()) + bond_budget_ >= 0, "pb2");
    require(bond_.balanceOf(sender, redemption_epoch) > 0, "pb3");

    // Burn the corresponding coins.
    coin.burn(sender, amount);
    emit PurchaseBondsEvent(sender, epoch_id, count, redemption_epoch);
    return redemption_epoch;
  }
  
  // Redeem bonds.
  //
  // Parameters
  // ----------------
  // |sender|: The sender account.
  // |redemption_epochs|: An array of bonds to be redeemed. Bonds are
  // identified by their redemption epochs.
  // |epoch_id|: The current epoch ID.
  // |coin|: The JohnLawCoin contract.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  // - The number of redeemed bonds.
  // - The number of expired bonds.
  function redeemBonds(address sender, uint[] memory redemption_epochs,
                       uint epoch_id, JohnLawCoin_v2 coin)
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
      }
      if (epoch_id < redemption_epoch + BOND_REDEEMABLE_PERIOD) {
        // If the bonds are not expired, mint the corresponding coins to the
        // user account.
        uint amount = count * BOND_REDEMPTION_PRICE;
        coin.mint(sender, amount);

        bond_budget_ += count.toInt256();
        redeemed_bonds += count;
      } else {
        expired_bonds += count;
      }
      // Burn the redeemed / expired bonds.
      bond_.burn(sender, redemption_epoch, count);
    }
    require(validBondSupply(epoch_id).toInt256() + bond_budget_ >= 0, "rb1");
    emit RedeemBondsEvent(sender, epoch_id, redeemed_bonds, expired_bonds);
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
  function revokeOwnership(JohnLawCoin_v2 coin)
      public onlyOwner {
    coin.transferOwnership(msg.sender);
  }
}

//------------------------------------------------------------------------------
// [OpenMarketOperation contract]
//
// The OpenMarketOperation contract increases / decreases the total coin supply
// by purchasing / selling ETH from the open market. The price auction is
// implemented as a Dutch auction.
//------------------------------------------------------------------------------
contract OpenMarketOperation_v5 is OwnableUpgradeable {
  using SafeCast for uint;
  using SafeCast for int;

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'public' (instead of
  // 'constant') because tests want to override the values.
  uint public PRICE_CHANGE_INTERVAL;
  uint public PRICE_CHANGE_PERCENTAGE;
  uint public START_PRICE_MULTIPILER;

  // Attributes. See the comment in initialize().
  uint public latest_price_;
  uint public start_price_;
  uint public eth_balance_;
  int public coin_budget_;

  // Events.
  event IncreaseCoinSupplyEvent(uint requested_eth_amount, uint elapsed_time,
                                uint eth_amount, uint coin_amount);
  event DecreaseCoinSupplyEvent(uint requested_coin_amount, uint elapsed_time,
                                uint eth_amount, uint coin_amount);
  event UpdateCoinBudgetEvent(int coin_budget);
  
  // Constructor.
  function initialize(uint latest_price, uint start_price, uint eth_balance,
                      int coin_budget)
      public initializer {
    __Ownable_init();
    
    // Constants.

    // The price auction is implemented as a Dutch auction as follows:
    //
    // Let P be the latest price at which the OpenMarketOperation exchanged
    // coins with ETH. At the beginning of each epoch, the ACB sets the coin
    // budget (i.e., how many coins should be added to / removed from the
    // total coin supply).
    //
    // When the OpenMarketOperation increases the total coin supply,
    // the auction starts with the price of P * START_PRICE_MULTIPILER.
    // Then the price is decreased by PRICE_CHANGE_PERCENTAGE % every
    // PRICE_CHANGE_INTERVAL seconds. Coins and ETH are exchanged at the
    // given price (the OpenMarketOperation sells coins and purchases ETH).
    // The auction stops when all the coins in the coin budget are sold.
    //
    // When the OpenMarketOperation decreases the total coin supply,
    // the auction starts with the price of P / START_PRICE_MULTIPILER.
    // Then the price is increased by PRICE_CHANGE_PERCENTAGE % every
    // PRICE_CHANGE_INTERVAL seconds. Coins and ETH are exchanged at the
    // given price (the OpenMarketOperation sells ETH and purchases coins).
    // The auction stops when all the coins in the coin budget are purchased.
    PRICE_CHANGE_INTERVAL = 8 * 60 * 60; // 8 hours
    PRICE_CHANGE_PERCENTAGE = 15; // 15%
    START_PRICE_MULTIPILER = 3;
    
    // Attributes.
    
    // The latest price at which the OpenMarketOperation exchanged coins
    // with ETH. The price is measured by wei / coin. If the price is 1000,
    // it means 1 coin is exchanged with 1000 wei.
    latest_price_ = latest_price;
    
    // The start price is updated at the beginning of each epoch.
    start_price_ = start_price;
    
    // The current ETH balance.
    eth_balance_ = eth_balance;
    
    // The current coin budget.
    coin_budget_ = coin_budget;
  }
  
  // Increase the total coin supply by purchasing ETH from the sender account.
  // This method returns the amount of coins and ETH to be exchanged.
  // The actual change to the total coin supply and the ETH pool is made by
  // the ACB.
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
  // enough coins in the pool.
  // - The amount of coins to be exchanged.
  function increaseCoinSupply(uint requested_eth_amount, uint elapsed_time)
      public onlyOwner returns (uint, uint) {
    require(coin_budget_ > 0,
            "OpenMarketOperation: The coin budget must be positive.");
        
    // Calculate the current price.
    uint price = start_price_;
    for (uint i = 0; i < elapsed_time / PRICE_CHANGE_INTERVAL; i++) {
      price = price * (100 - PRICE_CHANGE_PERCENTAGE) / 100;
    }
    require(price > 0,
            "OpenMarketOperation: The ETH / coin price must be positive.");

    // Calculate the amount of coins and ETH to be exchanged.
    uint coin_amount = requested_eth_amount / price;
    if (coin_amount > coin_budget_.toUint256()) {
      coin_amount = coin_budget_.toUint256();
    }
    uint eth_amount = coin_amount * price;
        
    if (coin_amount > 0) {
      latest_price_ = price;
    }
    coin_budget_ -= coin_amount.toInt256();
    eth_balance_ += eth_amount;
    require(coin_budget_ >= 0, "ic1");
    require(eth_amount <= requested_eth_amount, "ic2");

    emit IncreaseCoinSupplyEvent(requested_eth_amount, elapsed_time,
                                 eth_amount, coin_amount);
    return (eth_amount, coin_amount);
  }

  // Decrease the total coin supply by selling ETH to the sender account.
  // This method returns the amount of coins and ETH to be exchanged.
  // The actual change to the total coin supply and the ETH pool is made by
  // the ACB.
  //
  // Parameters
  // ----------------
  // |requested_coin_amount|: The amount of coins the sender is willing to pay.
  // |elapsed_time|: The elapsed seconds from the current epoch start.
  //
  // Returns
  // ----------------
  // A tuple of two values:
  // - The amount of ETH to be exchanged.
  // - The amount of coins to be exchanged. This can be smaller than
  // |requested_coin_amount| when the open market operation does not have
  // enough ETH in the pool.
  function decreaseCoinSupply(uint requested_coin_amount, uint elapsed_time)
      public onlyOwner returns (uint, uint) {
    require(coin_budget_ < 0,
            "OpenMarketOperation: The coin budget must be negative.");
        
    // Calculate the current price.
    uint price = start_price_;
    for (uint i = 0; i < elapsed_time / PRICE_CHANGE_INTERVAL; i++) {
      price = price * (100 + PRICE_CHANGE_PERCENTAGE) / 100;
    }
    if (price == 0) {
      price = 1;
    }
        
    // Calculate the amount of coins and ETH to be exchanged.
    uint coin_amount = requested_coin_amount;
    if (coin_amount >= (-coin_budget_).toUint256()) {
      coin_amount = (-coin_budget_).toUint256();
    }
    uint eth_amount = coin_amount * price;
    if (eth_amount >= eth_balance_) {
      eth_amount = eth_balance_;
    }
    coin_amount = eth_amount / price;
        
    if (coin_amount > 0) {
      latest_price_ = price;
    }
    coin_budget_ += coin_amount.toInt256();
    eth_balance_ -= eth_amount;
    require(coin_budget_ <= 0);
    require(coin_amount <= requested_coin_amount, "dc1");

    emit DecreaseCoinSupplyEvent(requested_coin_amount, elapsed_time,
                                 eth_amount, coin_amount);
    return (eth_amount, coin_amount);
  }
  
  // Receive ETH from the |sender| and increase ETH in the pool.
  function increaseEthInPool(address sender)
      public onlyOwner payable {
  }

  // Decrease |eth_amount| ETH in the pool and send it to the |sender|.
  function decreaseEthInPool(address sender, uint eth_amount)
      public onlyOwner {
    require(address(this).balance >= eth_amount, "se1");
    (bool success,) =
        payable(sender).call{value: eth_amount}("");
    require(success, "se2");
  }

  // Update the coin budget (i.e., how many coins should be added to / removed
  // from the total coin supply). The ACB calls the method at the beginning of
  // each epoch.
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
      start_price_ = latest_price_ * START_PRICE_MULTIPILER;
      require(start_price_ > 0, "uc2");
    } else if (coin_budget_ == 0) {
      start_price_ = 0;
    } else {
      start_price_ = latest_price_ / START_PRICE_MULTIPILER;
      if (start_price_ == 0) {
        start_price_ = 1;
      }
      require(start_price_ > 0, "uc3");
    }
    emit UpdateCoinBudgetEvent(coin_budget_);
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
contract Oracle_v5 is OwnableUpgradeable {
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
  function initialize(uint epoch_id)
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
              "deposit_v5", epoch_index, block.number)))));
      epochs_[epoch_index].reward_account =
          address(uint160(uint(keccak256(abi.encode(
              "reward_v5", epoch_index, block.number)))));
      epochs_[epoch_index].reward_total = 0;
    }
    epochs_[epoch_id % 3].phase = Phase.COMMIT;
    epochs_[(epoch_id + 1) % 3].phase = Phase.RECLAIM;
    epochs_[(epoch_id + 2) % 3].phase = Phase.REVEAL;

    // |epoch_id_| is a monotonically increasing ID (3, 4, 5, ...).
    // The Epoch object at |epoch_id_ % 3| is in the commit phase.
    // The Epoch object at |(epoch_id_ - 1) % 3| is in the reveal phase.
    // The Epoch object at |(epoch_id_ - 2) % 3| is in the reclaim phase.
    // The epoch ID starts with 3 because 0 in the commit entry is not
    // distinguishable from an uninitialized commit entry in Solidity.
    epoch_id_ = epoch_id;
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
            "deposit_v5", epoch_index, block.number)))));
    epoch.reward_account =
        address(uint160(uint(keccak256(abi.encode(
            "reward_v5", epoch_index, block.number)))));
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
contract ACB_v5 is OwnableUpgradeable, PausableUpgradeable {
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
  JohnLawCoin_v2 public coin_;
  Oracle_v3 public old_oracle_;
  Oracle_v5 public oracle_;
  BondOperation_v5 public bond_operation_;
  OpenMarketOperation_v5 public open_market_operation_;
  Logging_v2 public logging_;
  uint public oracle_level_;
  uint public current_epoch_start_;
  uint public age_;

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
  // |logging|: The Logging contract.
  function initialize(JohnLawCoin_v2 coin, Oracle_v3 old_oracle,
                      Oracle_v5 oracle, BondOperation_v5 bond_operation,
                      OpenMarketOperation_v5 open_market_operation,
                      Logging_v2 logging, uint oracle_level,
                      uint current_epoch_start)
      public initializer {
    __Ownable_init();
    __Pausable_init();

    // Constants.

    // The following table shows the mapping from the oracle level to the
    // exchange rate. Voters can vote for one of the oracle levels.
    //
    // -----------------------------------
    // | oracle level | exchange rate    |
    // |              |                  |
    // -----------------------------------
    // |             0| 1 coin = 0.6 USD |
    // |             1| 1 coin = 0.7 USD |
    // |             2| 1 coin = 0.8 USD |
    // |             3| 1 coin = 0.9 USD |
    // |             4| 1 coin = 1.0 USD |
    // |             5| 1 coin = 1.1 USD |
    // |             6| 1 coin = 1.2 USD |
    // |             7| 1 coin = 1.3 USD |
    // |             8| 1 coin = 1.4 USD |
    // -----------------------------------
    //
    // Voters are expected to look up the current exchange rate using
    // real-world currency exchangers and vote for the oracle level that
    // corresponds to the exchange rate. Strictly speaking, the current
    // exchange rate is defined as the exchange rate at the point when the
    // current epoch started (i.e., current_epoch_start_).
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

    // The duration of the epoch. The ACB adjusts the total coin supply once
    // per epoch. Voters can vote once per epoch.
    EPOCH_DURATION = 60; // 1 week.

    // The percentage of the coin balance voters need to deposit.
    DEPOSIT_RATE = 10; // 10%.

    // A damping factor to avoid minting or burning too many coins in one epoch.
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
    
    // The Oracle contract.
    old_oracle_ = old_oracle;

    // The Oracle contract.
    oracle_ = oracle;

    // The BondOperation contract.
    bond_operation_ = bond_operation;

    // The OpenMarketOperation contract.
    open_market_operation_ = open_market_operation;

    // The Logging contract.
    logging_ = logging;

    // The current oracle level.
    oracle_level_ = oracle_level;

    // The timestamp when the current epoch started.
    current_epoch_start_ = current_epoch_start;

    age_ = 0;

    /*
    require(LEVEL_TO_EXCHANGE_RATE.length == oracle.getLevelMax(), "AC1");
    */
  }

  // Deprecate the ACB. Only the owner can call this method.
  function deprecate()
      public onlyOwner {
    coin_.transferOwnership(msg.sender);
    old_oracle_.transferOwnership(msg.sender);
    oracle_.transferOwnership(msg.sender);
    bond_operation_.transferOwnership(msg.sender);
    open_market_operation_.transferOwnership(msg.sender);
    logging_.transferOwnership(msg.sender);
  }

  // Pause the ACB in emergency cases. Only the owner can call this method.
  function pause()
      public onlyOwner {
    if (!paused()) {
      _pause();
    }
    coin_.pause();
  }

  // Unpause the ACB. Only the owner can call this method.
  function unpause()
      public onlyOwner {
    if (paused()) {
      _unpause();
    }
    coin_.unpause();
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

  function _getLevelMax()
      internal whenNotPaused view returns (uint) {
    if (age_ <= 2) {
      return old_oracle_.getLevelMax();
    }
    return oracle_.getLevelMax();
  }

  function _getModeLevel()
      internal whenNotPaused view returns (uint) {
    if (age_ <= 2) {
      return old_oracle_.getModeLevel();
    }
    return oracle_.getModeLevel();
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
      age_ += 1;
      
      // Advance to the next epoch. Provide the |tax| coins to the oracle
      // as a reward.
      uint tax = coin_.balanceOf(coin_.tax_account_());
      uint burned = 0;
      if (age_ <= 2) {
        // Advance the old oracle first to give the tax to the old oracle.
        coin_.transferOwnership(address(old_oracle_));
        burned = old_oracle_.advance(coin_);
        old_oracle_.revokeOwnership(coin_);
        
        coin_.transferOwnership(address(oracle_));
        uint ret = oracle_.advance(coin_);
        require(ret == 0, "vo2");
        oracle_.revokeOwnership(coin_);
      } else if (age_ == 3) {
        // Advance the new oracle first to give the tax to the new oracle.
        coin_.transferOwnership(address(oracle_));
        uint ret = oracle_.advance(coin_);
        require(ret == 0, "vo3");
        oracle_.revokeOwnership(coin_);
        
        coin_.transferOwnership(address(old_oracle_));
        burned = old_oracle_.advance(coin_);
        old_oracle_.revokeOwnership(coin_);
      } else {
        // Advance the new oracle first to give the tax to the new oracle.
        coin_.transferOwnership(address(oracle_));
        burned = oracle_.advance(coin_);
        oracle_.revokeOwnership(coin_);
        
        coin_.transferOwnership(address(old_oracle_));
        uint ret = old_oracle_.advance(coin_);
        require(ret == 0, "vo4");
        old_oracle_.revokeOwnership(coin_);
      }

      // Reset the tax account address just in case.
      coin_.resetTaxAccount();
      require(coin_.balanceOf(coin_.tax_account_()) == 0, "vo2");
      
      int delta = 0;
      oracle_level_ = _getModeLevel();
      if (oracle_level_ != _getLevelMax()) {
        require(0 <= oracle_level_ &&
                oracle_level_ < _getLevelMax(), "vo1");
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

        // To avoid increasing or decreasing too many coins in one epoch,
        // multiply the damping factor.
        delta = delta * int(DAMPING_FACTOR) / 100;
      }

      // Update the bond budget.
      uint mint = bond_operation_.updateBondBudget(delta, result.epoch_id);

      if (oracle_level_ == 0 && delta < 0) {
        require(mint == 0, "vo2");
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
          result.epoch_id, open_market_operation_.coin_budget_());
      emit UpdateEpochEvent(result.epoch_id, current_epoch_start_,
                            tax, burned, delta, mint);
    }

    // Commit.
    //
    // The voter needs to deposit the DEPOSIT_RATE percentage of their coin
    // balance.
    result.deposited = coin_.balanceOf(msg.sender) * DEPOSIT_RATE / 100;
    if (hash == NULL_HASH) {
      result.deposited = 0;
    }
    require(age_ >= 1, "vo5");
    coin_.transferOwnership(address(oracle_));
    result.commit_result =
        oracle_.commit(coin_, msg.sender, hash, result.deposited);
    oracle_.revokeOwnership(coin_);
    if (!result.commit_result) {
      result.deposited = 0;
    }

    // Reveal.
    if (age_ <= 1) {
      coin_.transferOwnership(address(old_oracle_));
      result.reveal_result = old_oracle_.reveal(msg.sender, oracle_level, salt);
      old_oracle_.revokeOwnership(coin_);
    } else {
      coin_.transferOwnership(address(oracle_));
      result.reveal_result = oracle_.reveal(msg.sender, oracle_level, salt);
      oracle_.revokeOwnership(coin_);
    }
    
    // Reclaim.
    if (age_ <= 2) {
      coin_.transferOwnership(address(old_oracle_));
      (result.reclaimed, result.rewarded) =
          old_oracle_.reclaim(coin_, msg.sender);
      old_oracle_.revokeOwnership(coin_);
    } else {
      coin_.transferOwnership(address(oracle_));
      (result.reclaimed, result.rewarded) = oracle_.reclaim(coin_, msg.sender);
      oracle_.revokeOwnership(coin_);
    }

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
  // The redemption epoch of the purchased bonds if it succeeds. 0
  // otherwise.
  function purchaseBonds(uint count)
      public whenNotPaused returns (uint) {
    uint epoch_id = oracle_.epoch_id_();
    
    coin_.transferOwnership(address(bond_operation_));
    uint redemption_epoch =
        bond_operation_.purchaseBonds(address(msg.sender), count,
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
  // |redemption_epochs|: An array of bonds to be redeemed. Bonds are
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
        bond_operation_.redeemBonds(address(msg.sender), redemption_epochs,
                                    epoch_id, coin_);
    bond_operation_.revokeOwnership(coin_);
    
    logging_.redeemBonds(epoch_id, redeemed_bonds, expired_bonds);
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
    
    // Calculate the amount of ETH and coins to be exchanged.
    (uint eth_amount, uint coin_amount) =
        open_market_operation_.increaseCoinSupply(
            requested_eth_amount, elapsed_time);
    
    coin_.mint(msg.sender, coin_amount);
    
    require(address(this).balance >= requested_eth_amount, "pc1");
    bool success;
    (success,) =
        payable(address(open_market_operation_)).call{value: eth_amount}(
            abi.encodeWithSignature("increaseEthInPool(address)", msg.sender));
    require(success, "pc2");
    
    // Pay back the remaining ETH to the sender. This may trigger any arbitrary
    // operations in an external smart contract. This must be called at the very
    // end of purchaseCoins().
    (success,) =
        payable(msg.sender).call{value: requested_eth_amount - eth_amount}("");
    require(success, "pc3");

    logging_.purchaseCoins(oracle_.epoch_id_(), eth_amount, coin_amount);
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
    require(coin_.balanceOf(msg.sender) >= requested_coin_amount,
            "OpenMarketOperation: Your coin balance is not enough.");
        
    // Calculate the amount of ETH and coins to be exchanged.
    uint elapsed_time = getTimestamp() - current_epoch_start_;
    (uint eth_amount, uint coin_amount) =
        open_market_operation_.decreaseCoinSupply(
            requested_coin_amount, elapsed_time);

    coin_.burn(msg.sender, coin_amount);
    
    // Send ETH to the sender. This may trigger any arbitrary operations in an
    // external smart contract. This must be called at the very end of
    // sellCoins().
    open_market_operation_.decreaseEthInPool(msg.sender, eth_amount);
    
    logging_.sellCoins(oracle_.epoch_id_(), eth_amount, coin_amount);
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
    if (age_ <= 2) {
      return old_oracle_.encrypt(sender, level, salt);
    }
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
