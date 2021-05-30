// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

pragma solidity ^0.8.0;

import "./JohnLawCoin_v3.sol";

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
contract ACB_v4 is OwnableUpgradeable, PausableUpgradeable {
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
  JohnLawCoin_v2 public coin_;
  JohnLawBond_v2 public bond_;
  Oracle_v3 public oracle_;
  Logging_v2 public logging_;
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
  function initialize(JohnLawCoin_v2 coin, JohnLawBond_v2 bond,
                      Oracle_v3 oracle, Logging_v2 logging,
                      int bond_budget, uint oracle_level,
                      uint current_phase_start)
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
    bond_budget_ = bond_budget;
    
    // The current oracle level.
    oracle_level_ = oracle_level;

    // The timestamp when the current phase started.
    current_phase_start_ = current_phase_start;

    /*
    require(LEVEL_TO_EXCHANGE_RATE.length == oracle.getLevelMax(), "AC1");
    require(LEVEL_TO_BOND_PRICE.length == oracle.getLevelMax(), "AC2");
    require(LEVEL_TO_TAX_RATE.length == oracle.getLevelMax(), "AC3");
    */
  }

  // Deprecate the ACB. Only the owner can call this method.
  function deprecate()
      public onlyOwner {
    coin_.transferOwnership(msg.sender);
    bond_.transferOwnership(msg.sender);
    oracle_.transferOwnership(msg.sender);
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
