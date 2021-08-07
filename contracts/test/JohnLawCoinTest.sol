// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

pragma solidity ^0.8.0;

import "../JohnLawCoin.sol";

// A contract to test BondOperation.
contract BondOperationForTesting is BondOperation {
  function overrideConstants(uint bond_price,
                             uint bond_redemption_price,
                             uint bond_redemption_period,
                             uint bond_redeemable_period)
      public onlyOwner {
    BOND_PRICE = bond_price;
    BOND_REDEMPTION_PRICE = bond_redemption_price;
    BOND_REDEMPTION_PERIOD = bond_redemption_period;
    BOND_REDEEMABLE_PERIOD = bond_redeemable_period;
    
    require(1 <= BOND_PRICE && BOND_PRICE <= BOND_REDEMPTION_PRICE,
            "oc4");
    require(1 <= BOND_REDEMPTION_PRICE && BOND_REDEMPTION_PRICE <= 100000,
            "oc5");
    require(1 <= BOND_REDEMPTION_PERIOD &&
            BOND_REDEMPTION_PERIOD <= 20, "oc6");
    require(1 <= BOND_REDEEMABLE_PERIOD &&
            BOND_REDEEMABLE_PERIOD <= 20, "oc7");
  }
}

// A contract to test OpenMarketOperation.
contract OpenMarketOperationForTesting is OpenMarketOperation {
  function overrideConstants(uint price_change_interval,
                             uint price_change_percentage,
                             uint start_price_multiplier)
      public onlyOwner {
    PRICE_CHANGE_INTERVAL = price_change_interval;
    PRICE_CHANGE_PERCENTAGE = price_change_percentage;
    START_PRICE_MULTIPILER = start_price_multiplier;

    require(1 <= PRICE_CHANGE_INTERVAL, "oc1");
    require(0 <= PRICE_CHANGE_PERCENTAGE && PRICE_CHANGE_PERCENTAGE <= 100,
            "oc2");
    require(1 <= START_PRICE_MULTIPILER, "oc3");
  }
}

// A contract to test Oracle.
contract OracleForTesting is Oracle {
  function overrideConstants(uint level_max,
                             uint reclaim_threshold,
                             uint proportional_reward_rate)
      public onlyOwner {
    LEVEL_MAX = level_max;
    RECLAIM_THRESHOLD = reclaim_threshold;
    PROPORTIONAL_REWARD_RATE = proportional_reward_rate;

    require(2 <= LEVEL_MAX && LEVEL_MAX < 100, "oc8");
    require(0 <= RECLAIM_THRESHOLD && RECLAIM_THRESHOLD < LEVEL_MAX, "oc9");
    require(0 <= PROPORTIONAL_REWARD_RATE && PROPORTIONAL_REWARD_RATE <= 100,
            "oc10");

    for (uint i = 0; i < 3; i++) {
      for (uint level = 0; level < LEVEL_MAX; level++) {
        epochs_[i].votes[level] = Vote(0, 0, false, false);
      }
    }
  }
}

// A contract to test ACB.
contract ACBForTesting is ACB {
  function overrideConstants(uint epoch_duration,
                             uint deposit_rate,
                             uint damping_factor,
                             uint[] memory level_to_exchange_rate)
      public onlyOwner {
    EPOCH_DURATION = epoch_duration;
    DEPOSIT_RATE = deposit_rate;
    DAMPING_FACTOR = damping_factor;
    LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate;

    require(1 <= EPOCH_DURATION && EPOCH_DURATION <= 30 * 24 * 60 * 60, "oc11");
    require(0 <= DEPOSIT_RATE && DEPOSIT_RATE <= 100, "oc12");
    require(1 <= DAMPING_FACTOR && DAMPING_FACTOR <= 100, "oc13");
  }

  function getTimestamp()
      public override view returns (uint) {
    return _timestamp_for_testing;
  }

  function setTimestamp(uint timestamp)
      public onlyOwner {
    _timestamp_for_testing = timestamp;
  }

  function setOracleLevel(uint oracle_level)
      public onlyOwner {
    oracle_level_ = oracle_level;
  }

  function setDepositRate(uint deposit_rate)
      public onlyOwner {
    DEPOSIT_RATE = deposit_rate;
  }

  function setCoin(address account, uint amount)
      public onlyOwner {
    coin_.burn(account, coin_.balanceOf(account));
    coin_.mint(account, amount);
  }

  function moveCoin(address sender, address receiver, uint amount)
      public onlyOwner {
    coin_.move(sender, receiver, amount);
  }

  function updateBondBudget(int delta, uint epoch_id)
      public onlyOwner returns (uint) {
    return bond_operation_.updateBondBudget(delta, epoch_id);
  }

  function updateCoinBudget(int coin_budget)
      public onlyOwner {
    open_market_operation_.updateCoinBudget(coin_budget);
  }
}
