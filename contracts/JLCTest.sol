// SPDX-License-Identifier: MIT
pragma solidity >=0.7.1 <0.9.0;

import "./JLC.sol";

// A contract to test Oracle.
contract OracleForTesting is Oracle {

  function override_constants(uint level_max,
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
  
  function get_vote(uint epoch_index, uint level)
      public view returns (uint, uint, bool, bool) {
    require(0 <= epoch_index && epoch_index <= 2,
            "get_vote: 1");
    require(0 <= level && level < epochs_[epoch_index].votes.length,
            "get_vote: 2");
    Vote memory vote = epochs_[epoch_index].votes[level];
    return (vote.deposit, vote.count, vote.should_reclaim, vote.should_reward);
  }

  function get_commit(uint epoch_index, address account)
      public view returns (bytes32, uint, uint, Phase, uint) {
    require(0 <= epoch_index && epoch_index <= 2,
            "get_commit: 1");
    Commit memory commit = epochs_[epoch_index].commits[account];
    return (commit.committed_hash, commit.deposit, commit.revealed_level,
            commit.phase, commit.epoch);
  }

  function get_epoch_members(uint epoch_index)
      public view returns (TokenHolder, uint, TokenHolder, Phase) {
    return (epochs_[epoch_index].reward_holder,
            epochs_[epoch_index].reward_total,
            epochs_[epoch_index].deposit_holder,
            epochs_[epoch_index].phase);
  }
}

// A contract to test ACB.
contract ACBForTesting is ACB {
  uint private timestamp_;

  function override_constants(uint bond_redemption_price,
                              uint bond_redemption_period,
                              uint phase_duration,
                              uint deposit_rate,
                              uint dumping_factor,
                              uint[] memory level_to_exchange_rate,
                              uint[] memory level_to_bond_price,
                              uint coin_transfer_max)
      public {
    BOND_REDEMPTION_PRICE = bond_redemption_price;
    BOND_REDEMPTION_PERIOD = bond_redemption_period;
    PHASE_DURATION = phase_duration;
    DEPOSIT_RATE = deposit_rate;
    DUMPING_FACTOR = dumping_factor;
    LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate;
    LEVEL_TO_BOND_PRICE = level_to_bond_price;
    COIN_TRANSFER_MAX = coin_transfer_max;

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

  function control_supply(int delta)
      public returns (uint) {
    return _control_supply(delta);
  }

  function get_timestamp()
      public override view returns (uint) {
    return timestamp_;
  }

  function set_timestamp(uint timestamp)
      public {
    require(timestamp > timestamp_, "set_timestamp: 1");
    timestamp_ = timestamp;
  }

  function set_oracle_level(uint oracle_level)
      public {
    oracle_level_ = oracle_level;
  }

  function coin_supply_mint(address account, uint amount)
      public {
    require(address(balances_[account]) != address(0x0),
            "coin_supply_mint: 1");
    coin_supply_.mint(balances_[account], amount);
  }

  function get_bond_holder(address account, uint redemption)
      public view returns (TokenHolder){
    return bonds_[account][redemption];
  }

  function reset_balance(address account, uint amount)
      public {
    require(address(balances_[account]) != address(0x0),
            "reset_balances: 1");
    coin_supply_.burn(balances_[account],
                      balances_[account].amount_());
    if (amount > 0) {
      coin_supply_.mint(balances_[account], amount);
    }
  }
}
