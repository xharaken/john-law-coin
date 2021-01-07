// SPDX-License-Identifier: MIT
pragma solidity >=0.7.1 <0.9.0;

import "./JLC.sol";

// A contract to test Oracle.
contract OracleForTesting is Oracle {
  constructor(uint level_max, uint reclaim_threshold,
              uint proportional_reward_rate, TokenSupply coin_supply)
      Oracle(level_max, reclaim_threshold,
             proportional_reward_rate, coin_supply) {
  }
  
  function get_vote(uint epoch_index, uint level)
      public onlyOwner view returns (uint, uint, bool, bool) {
    require(0 <= epoch_index && epoch_index <= 2,
            "get_vote: 0 <= epoch_index <= 2");
    require(0 <= level && level < epochs_[epoch_index].votes.length,
            "get_vote: 0 <= level < epochs_[epoch_index].votes.length");
    Vote memory vote = epochs_[epoch_index].votes[level];
    return (vote.deposit, vote.count, vote.should_reclaim, vote.should_reward);
  }

  function get_commit(uint epoch_index, address account)
      public onlyOwner view returns (bytes32, uint, uint, Phase, uint) {
    require(0 <= epoch_index && epoch_index <= 2,
            "get_commit: 0 <= epoch_index <= 2");
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
  
  function get_epoch()
      public view returns (uint) {
    return epoch_;
  }
  
  function coin_supply_address()
      public view returns (TokenSupply) {
    return coin_supply_;
  }

}

// A contract to test ACB.
contract ACBForTesting is ACB {
  uint private timestamp_;

  constructor(uint bond_redemption_price,
              uint bond_redemption_period,
              uint phase_duration,
              uint proportional_reward_rate,
              uint deposit_rate,
              uint dumping_factor,
              uint reclaim_threshold,
              uint[] memory level_to_exchange_rate,
              uint[] memory level_to_bond_price,
              uint coin_transfer_max,
              uint initial_coin_supply)
      ACB() {
    BOND_REDEMPTION_PRICE = bond_redemption_price;
    BOND_REDEMPTION_PERIOD = bond_redemption_period;
    PHASE_DURATION = phase_duration;
    PROPORTIONAL_REWARD_RATE = proportional_reward_rate;
    DEPOSIT_RATE = deposit_rate;
    DUMPING_FACTOR = dumping_factor;
    RECLAIM_THRESHOLD = reclaim_threshold;
    LEVEL_TO_EXCHANGE_RATE = level_to_exchange_rate;
    LEVEL_MAX = LEVEL_TO_EXCHANGE_RATE.length;
    LEVEL_TO_BOND_PRICE = level_to_bond_price;
    COIN_TRANSFER_MAX = coin_transfer_max;
    INITIAL_COIN_SUPPLY = initial_coin_supply;

    oracle_ = new Oracle(LEVEL_MAX,
                         RECLAIM_THRESHOLD,
                         PROPORTIONAL_REWARD_RATE,
                         coin_supply_);
    coin_supply_.set_delegated_owner(address(oracle_));
    bond_supply_.set_delegated_owner(address(oracle_));
    oracle_level_ = LEVEL_MAX;
    
    check_constants();
  }

  function check_constants()
      private view {
    require(1 <= BOND_REDEMPTION_PRICE && BOND_REDEMPTION_PRICE <= 100000,
            "check_constants: BOND_REDEMPTION_PRICE");
    require(1 <= BOND_REDEMPTION_PERIOD &&
            BOND_REDEMPTION_PERIOD <= 365 * 24 * 60 * 60,
            "check_constants: BOND_REDEMPTION_PERIOD");
    require(1 <= PHASE_DURATION && PHASE_DURATION <= 30 * 24 * 60 * 60,
            "check_constants: PHASE_DURATION");
    require(0 <= PROPORTIONAL_REWARD_RATE && PROPORTIONAL_REWARD_RATE <= 100,
            "check_constants: PROPORTIONAL_REWARD_RATE");
    require(0 <= DEPOSIT_RATE && DEPOSIT_RATE <= 100,
            "check_constants: DEPOSIT_RATE");
    require(1 <= DUMPING_FACTOR && DUMPING_FACTOR <= 100,
            "check_constants: DUMPING_FACTOR");
    require(0 <= INITIAL_COIN_SUPPLY,
            "check_constants: INITIAL_COIN_SUPPLY");
    require(0 <= RECLAIM_THRESHOLD && RECLAIM_THRESHOLD < LEVEL_MAX,
            "check_constants: RECLAIM_THRESHOLD");
    require(LEVEL_TO_EXCHANGE_RATE.length == LEVEL_MAX,
            "check_constants: LEVEL_TO_EXCHANGE_RATE.length == LEVEL_MAX");
    require(LEVEL_TO_BOND_PRICE.length == LEVEL_MAX,
            "check_constants: LEVEL_TO_BOND_PRICE.length == LEVEL_MAX");
    for (uint i = 0; i < LEVEL_TO_BOND_PRICE.length; i++) {
      require(
          LEVEL_TO_BOND_PRICE[i] <= BOND_REDEMPTION_PRICE,
          "check_constants: LEVEL_TO_BOND_PRICE[i] <= BOND_REDEMPTION_PRICE");
    }
    require(LEVEL_MAX >= 3, "check_constants: LEVEL_MAX >= 3");
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
    require(timestamp > timestamp_, "set_timestamp: timestamp > timestamp_");
    timestamp_ = timestamp;
  }

  function set_oracle_level(uint oracle_level)
      public {
    oracle_level_ = oracle_level;
  }

  function coin_supply_mint(address account, uint amount)
      public {
    require(address(balances_[account]) != address(0x0),
            "coin_supply_mint: address(balances_[account]) != address(0x0)");
    coin_supply_.mint(balances_[account], amount);
  }

  function get_coin_supply()
      public view returns (uint) {
    return coin_supply_.amount_();
  }

  function get_bond_supply()
      public view returns (uint) {
    return bond_supply_.amount_();
  }

  function get_bond_budget()
      public view returns (int) {
    return bond_budget_;
  }

  function get_oracle_level()
      public view returns (uint) {
    return oracle_level_;
  }

  function coin_supply_address()
      public view returns (TokenSupply) {
    return coin_supply_;
  }

  function bond_supply_address()
      public view returns (TokenSupply) {
    return bond_supply_;
  }

  function oracle_address()
      public view returns (Oracle) {
    return oracle_;
  }

  function balance_holder_address(address account)
      public view returns (TokenHolder){
    require(address(balances_[account]) != address(0x0),
            "balance_holder_: address(balances_[account]) != address(0x0)");
    return balances_[account];
  }

  function bond_holder_address(address account, uint redemption)
      public view returns (TokenHolder){
    require(
        address(bonds_[account][redemption]) != address(0x0),
        "bond_holder_: address(bonds_[account][redemption]) != address(0x0)");
    return bonds_[account][redemption];
  }

  function get_balances(address[] memory accounts)
      public view returns (int[10] memory) {
    int[10] memory amounts;
    require(accounts.length < 10, "get_balances: accounts.length < 10");
    for (uint i = 0; i < accounts.length; i++) {
      if (address(balances_[accounts[i]]) == address(0x0)) {
        amounts[i] = -1;
      } else {
        amounts[i] = int(balances_[accounts[i]].amount_());
      }
    }
    return amounts;
  }

  function get_bonds(address account, uint[] memory redemptions)
      public view returns (int[10] memory) {
    int[10] memory amounts;
    require(redemptions.length < 10, "get_bonds: redemptions.length < 10");
    for (uint i = 0; i < redemptions.length; i++) {
      if (address(bonds_[account][redemptions[i]]) == address(0x0)) {
        amounts[i] = -1;
      } else {
        amounts[i] = int(bonds_[account][redemptions[i]].amount_());
      }
    }
    return amounts;
  }

  function reset_balances(address genesis_account, address[] memory accounts)
      public {
    for (uint i = 0; i < accounts.length; i++) {
      require(
          address(balances_[accounts[i]]) != address(0x0),
          "reset_balances: address(balances_[accounts[i]]) != address(0x0)");
      coin_supply_.burn(balances_[accounts[i]],
                        balances_[accounts[i]].amount_());
    }
    require(
        address(balances_[genesis_account]) != address(0x0),
        "reset_balances: address(balances_[genesis_account]) != address(0x0)");
    coin_supply_.burn(balances_[genesis_account],
                      balances_[genesis_account].amount_());
    coin_supply_.mint(balances_[genesis_account], INITIAL_COIN_SUPPLY);
  }
}
