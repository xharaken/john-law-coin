// SPDX-License-Identifier: Apache-2.0
//
// Copyright 2021 Kentaro Hara
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

pragma solidity ^0.8.0;

import "./JohnLawCoin_v3.sol";

// A contract to test Oracle.
contract OracleForTesting_v3 is Oracle_v3 {
}

// A contract to test ACB.
contract ACBForTesting_v3 is ACB_v3 {
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
