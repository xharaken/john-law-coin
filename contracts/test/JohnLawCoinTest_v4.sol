// SPDX-License-Identifier: MIT
//
// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

pragma solidity ^0.8.0;

import "./JohnLawCoin_v4.sol";

// A contract to test ACB.
contract ACBForTesting_v4 is ACB_v4 {
  function overrideConstants(uint bond_redemption_price,
                             uint bond_redemption_period,
                             uint epoch_duration,
                             uint deposit_rate,
                             uint damping_factor,
                             uint[] memory level_to_exchange_rate,
                             uint[] memory level_to_bond_price)
      public onlyOwner {
    BOND_REDEMPTION_PRICE = bond_redemption_price;
    BOND_REDEMPTION_PERIOD = bond_redemption_period;
    EPOCH_DURATION = epoch_duration;
    DEPOSIT_RATE = deposit_rate;
    DAMPING_FACTOR = damping_factor;
    LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate;
    LEVEL_TO_BOND_PRICE = level_to_bond_price;

    require(1 <= BOND_REDEMPTION_PRICE && BOND_REDEMPTION_PRICE <= 100000,
            "oc1");
    require(1 <= BOND_REDEMPTION_PERIOD &&
            BOND_REDEMPTION_PERIOD <= 365 * 24 * 60 * 60, "oc2");
    require(1 <= EPOCH_DURATION && EPOCH_DURATION <= 30 * 24 * 60 * 60, "oc3");
    require(0 <= DEPOSIT_RATE && DEPOSIT_RATE <= 100, "oc4");
    require(1 <= DAMPING_FACTOR && DAMPING_FACTOR <= 100, "oc5");
    require(LEVEL_TO_EXCHANGE_RATE.length == LEVEL_TO_BOND_PRICE.length, "oc6");
    for (uint i = 0; i < LEVEL_TO_BOND_PRICE.length; i++) {
      require(LEVEL_TO_BOND_PRICE[i] <= BOND_REDEMPTION_PRICE, "oc8");
    }
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
