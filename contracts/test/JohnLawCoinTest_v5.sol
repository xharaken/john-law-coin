// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

pragma solidity ^0.8.0;

import "./JohnLawCoin_v5.sol";

// A contract to test Oracle.
contract OracleForTesting_v5 is Oracle_v5 {
  function overrideConstants(uint level_max,
                             uint reclaim_threshold,
                             uint proportional_reward_rate)
      public onlyOwner {
    LEVEL_MAX = level_max;
    RECLAIM_THRESHOLD = reclaim_threshold;
    PROPORTIONAL_REWARD_RATE = proportional_reward_rate;

    require(2 <= LEVEL_MAX && LEVEL_MAX < 100, "oc1");
    require(0 <= RECLAIM_THRESHOLD && RECLAIM_THRESHOLD < LEVEL_MAX, "oc2");
    require(0 <= PROPORTIONAL_REWARD_RATE && PROPORTIONAL_REWARD_RATE <= 100,
            "oc3");

    for (uint i = 0; i < 3; i++) {
      for (uint level = 0; level < LEVEL_MAX; level++) {
        epochs_[i].votes[level] = Vote(0, 0, false, false);
      }
    }
  }
}

// A contract to test ACB.
contract ACBForTesting_v5 is ACB_v5 {
  function overrideConstants(uint bond_price,
                             uint bond_redemption_price,
                             uint bond_redemption_period,
                             uint bond_redeemable_period,
                             uint epoch_duration,
                             uint deposit_rate,
                             uint damping_factor,
                             uint[] memory level_to_exchange_rate)
      public onlyOwner {
    BOND_PRICE = bond_price;
    BOND_REDEMPTION_PRICE = bond_redemption_price;
    BOND_REDEMPTION_PERIOD = bond_redemption_period;
    BOND_REDEEMABLE_PERIOD = bond_redeemable_period;
    EPOCH_DURATION = epoch_duration;
    DEPOSIT_RATE = deposit_rate;
    DAMPING_FACTOR = damping_factor;
    LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate;

    require(1 <= BOND_PRICE && BOND_PRICE <= BOND_REDEMPTION_PRICE, "oc1");
    require(1 <= BOND_REDEMPTION_PRICE && BOND_REDEMPTION_PRICE <= 100000,
            "oc2");
    require(1 <= BOND_REDEMPTION_PERIOD &&
            BOND_REDEMPTION_PERIOD <= 100, "oc3");
    require(1 <= BOND_REDEEMABLE_PERIOD &&
            BOND_REDEEMABLE_PERIOD <= 100, "oc4");
    require(1 <= EPOCH_DURATION && EPOCH_DURATION <= 30 * 24 * 60 * 60, "oc5");
    require(0 <= DEPOSIT_RATE && DEPOSIT_RATE <= 100, "oc6");
    require(1 <= DAMPING_FACTOR && DAMPING_FACTOR <= 100, "oc7");
  }

  function controlSupply(int delta)
      public onlyOwner returns (uint) {
    return _controlSupply(delta);
  }

  function getTimestamp()
      public override view returns (uint) {
    return _timestamp_for_testing;
  }

  function setTimestamp(uint timestamp)
      public onlyOwner {
    require(timestamp > _timestamp_for_testing, "st1");
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
}
