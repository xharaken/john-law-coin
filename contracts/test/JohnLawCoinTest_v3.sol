// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

pragma solidity ^0.8.0;

import "./JohnLawCoin_v3.sol";

// A contract to test Oracle.
contract OracleForTesting_v3 is Oracle_v3 {
  function overrideConstants(uint reclaim_threshold,
                             uint proportional_reward_rate)
      public {
    RECLAIM_THRESHOLD = reclaim_threshold;
    PROPORTIONAL_REWARD_RATE = proportional_reward_rate;

    require(0 <= RECLAIM_THRESHOLD && RECLAIM_THRESHOLD < LEVEL_MAX, "oc1");
    require(0 <= PROPORTIONAL_REWARD_RATE && PROPORTIONAL_REWARD_RATE <= 100,
            "oc2");
  }
}

// A contract to test ACB.
contract ACBForTesting_v3 is ACB_v3 {
  function overrideConstants(uint epoch_duration,
                             uint deposit_rate,
                             uint damping_factor,
                             uint[] memory level_to_exchange_rate)
      public onlyOwner {
    EPOCH_DURATION = epoch_duration;
    DEPOSIT_RATE = deposit_rate;
    DAMPING_FACTOR = damping_factor;
    LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate;

    require(1 <= EPOCH_DURATION && EPOCH_DURATION <= 30 * 24 * 60 * 60, "oc3");
    require(0 <= DEPOSIT_RATE && DEPOSIT_RATE <= 100, "oc4");
    require(1 <= DAMPING_FACTOR && DAMPING_FACTOR <= 100, "oc5");
  }
  
  function getTimestamp()
      public override view returns (uint) {
    return _timestamp_for_testing;
  }

  function setTimestamp(uint timestamp)
      public onlyOwner {
    _timestamp_for_testing = timestamp;
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
