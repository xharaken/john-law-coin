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
// The ACB stabilizes the JLC / USD exchange rate to 1.0 with algorithmically
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
contract ACB_v4 is OwnableUpgradeable, PausableUpgradeable {
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
  JohnLawCoin_v2 public coin_;
  Oracle_v3 public oracle_;
  BondOperation_v2 public bond_operation_;
  OpenMarketOperation_v2 public open_market_operation_;
  EthPool_v2 public eth_pool_;
  Logging_v2 public logging_;
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
  function initialize(JohnLawCoin_v2 coin, Oracle_v3 oracle,
                      BondOperation_v2 bond_operation,
                      OpenMarketOperation_v2 open_market_operation,
                      EthPool_v2 eth_pool,
                      Logging_v2 logging,
                      uint oracle_level, uint current_epoch_start)
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
    oracle_level_ = oracle_level;

    // The timestamp when the current epoch started.
    current_epoch_start_ = current_epoch_start;

    /*
    require(LEVEL_TO_EXCHANGE_RATE.length == oracle.LEVEL_MAX(), "AC1");
    */
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

  // Payable fallback to receive and store ETH. Give us tips :)
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
          result.epoch_id, bond_operation_.bond_budget_v2_(),
          bond_operation_.bond_v2_().totalSupply(),
          bond_operation_.validBondSupply(result.epoch_id));
      logging_.updateCoinBudget(
          result.epoch_id, open_market_operation_.coin_budget_v2_(),
          address(eth_pool_).balance,
          open_market_operation_.latest_price_());
      emit UpdateEpochEvent(result.epoch_id, current_epoch_start_,
                            tax, burned, delta, mint);
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
    
    require(open_market_operation_.eth_balance_() <=
            address(eth_pool_).balance, "pc1");
    
    // Calculate the amount of ETH and JLC to be exchanged.
    (uint eth_amount, uint coin_amount) =
        open_market_operation_.increaseCoinSupply(
            requested_eth_amount, elapsed_time);
    
    coin_.mint(msg.sender, coin_amount);
    
    require(address(this).balance >= requested_eth_amount, "pc2");
    bool success;
    (success,) =
        payable(address(eth_pool_)).call{value: eth_amount}(
            abi.encodeWithSignature("increaseEth()"));
    require(success, "pc3");
    require(open_market_operation_.eth_balance_() <=
            address(eth_pool_).balance, "pc4");
    
    logging_.purchaseCoins(oracle_.epoch_id_(), eth_amount, coin_amount);
    
    // Pay back the remaining ETH to the sender. This may trigger any arbitrary
    // operations in an external smart contract. This must be called at the very
    // end of purchaseCoins().
    (success,) =
        payable(msg.sender).call{value: requested_eth_amount - eth_amount}("");
    require(success, "pc5");

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
        
    require(open_market_operation_.eth_balance_() <=
            address(eth_pool_).balance, "sc1");
    
    // Calculate the amount of ETH and JLC to be exchanged.
    uint elapsed_time = getTimestamp() - current_epoch_start_;
    (uint eth_amount, uint coin_amount) =
        open_market_operation_.decreaseCoinSupply(
            requested_coin_amount, elapsed_time);

    coin_.burn(msg.sender, coin_amount);
    
    logging_.sellCoins(oracle_.epoch_id_(), eth_amount, coin_amount);
    
    // Send ETH to the sender. This may trigger any arbitrary operations in an
    // external smart contract. This must be called at the very end of
    // sellCoins().
    eth_pool_.decreaseEth(msg.sender, eth_amount);
    require(open_market_operation_.eth_balance_() <=
            address(eth_pool_).balance, "sc2");
    
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
