// SPDX-License-Identifier: MIT
pragma solidity >=0.7.1 <0.9.0;

import "./JLC.sol";

// A contract to test Oracle.
contract OracleForTesting is Oracle {

  function overrideConstants(uint level_max,
                              uint reclaim_threshold,
                              uint proportional_reward_rate)
      public {
    LEVEL_MAX = level_max;
    RECLAIM_THRESHOLD = reclaim_threshold;
    PROPORTIONAL_REWARD_RATE = proportional_reward_rate;

    require(2 <= LEVEL_MAX && LEVEL_MAX < 100,
            "override_constants: 1");
    require(0 <= RECLAIM_THRESHOLD && RECLAIM_THRESHOLD < LEVEL_MAX,
            "override_constants: 2");
    require(0 <= PROPORTIONAL_REWARD_RATE &&
            PROPORTIONAL_REWARD_RATE <= 100,
            "override_constants: 3");

    for (uint i = 0; i < 3; i++) {
      for (uint level = epochs_[i].votes.length; level < LEVEL_MAX; level++) {
        epochs_[i].votes.push(Vote(0, 0, false, false));
      }
    }
  }
}

// A contract to test ACB.
contract ACBForTesting is ACB {
  uint private timestamp_;

  function overrideConstants(uint bond_redemption_price,
                              uint bond_redemption_period,
                              uint phase_duration,
                              uint deposit_rate,
                              uint dumping_factor,
                              uint[] memory level_to_exchange_rate,
                              uint[] memory level_to_bond_price)
      public {
    BOND_REDEMPTION_PRICE = bond_redemption_price;
    BOND_REDEMPTION_PERIOD = bond_redemption_period;
    PHASE_DURATION = phase_duration;
    DEPOSIT_RATE = deposit_rate;
    DUMPING_FACTOR = dumping_factor;
    LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate;
    LEVEL_TO_BOND_PRICE = level_to_bond_price;

    require(1 <= BOND_REDEMPTION_PRICE && BOND_REDEMPTION_PRICE <= 100000,
            "override_constants: 1");
    require(1 <= BOND_REDEMPTION_PERIOD &&
            BOND_REDEMPTION_PERIOD <= 365 * 24 * 60 * 60,
            "override_constants: 2");
    require(1 <= PHASE_DURATION && PHASE_DURATION <= 30 * 24 * 60 * 60,
            "override_constants: 3");
    require(0 <= DEPOSIT_RATE && DEPOSIT_RATE <= 100,
            "override_constants: 4");
    require(1 <= DUMPING_FACTOR && DUMPING_FACTOR <= 100,
            "override_constants: 5");
    require(0 <= INITIAL_COIN_SUPPLY,
            "override_constants: 6");
    for (uint i = 0; i < LEVEL_TO_BOND_PRICE.length; i++) {
      require(
          LEVEL_TO_BOND_PRICE[i] <= BOND_REDEMPTION_PRICE,
          "override_constants: 7");
    }
  }

  function controlSupply(int delta)
      public returns (uint) {
    return _controlSupply(delta);
  }

  function getTimestamp()
      public override view returns (uint) {
    return timestamp_;
  }

  function setTimestamp(uint timestamp)
      public {
    require(timestamp > timestamp_, "setTimestamp: 1");
    timestamp_ = timestamp;
  }

  function setOracleLevel(uint oracle_level)
      public {
    oracle_level_ = oracle_level;
  }

  function coinMint(address account, uint amount)
      public {
    coin_.mint(account, amount);
  }

  function coinBurn(address account, uint amount)
      public {
    coin_.burn(account, amount);
  }
}
