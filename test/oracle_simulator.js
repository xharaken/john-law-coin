const JohnLawCoin = artifacts.require("JohnLawCoin");
const JohnLawBond = artifacts.require("JohnLawBond");
const Oracle = artifacts.require("Oracle");
const OracleForTesting = artifacts.require("OracleForTesting");
const common = require("./common.js");
const should_throw = common.should_throw;
const mod = common.mod;
const randint = common.randint;

contract("OracleSimulator", function (accounts) {
  level_max = 5;
  reclaim_threshold = 1;
  proportional_reward_rate = 80;
  voter_count = 10;
  iteration = 100;
  parameterized_test(accounts,
                     level_max,
                     reclaim_threshold,
                     proportional_reward_rate,
                     voter_count, iteration);
});

function parameterized_test(accounts,
                            _level_max,
                            _reclaim_threshold,
                            _proportional_reward_rate,
                            _voter_count,
                            _iteration) {
  let test_name = "Oracle parameters: " + "level_max=" + _level_max +
      " reclaim=" + _reclaim_threshold +
      " prop=" + _proportional_reward_rate +
      " voter_count=" + _voter_count +
      " iteration=" + _iteration;

  assert.isTrue(_voter_count <= accounts.length);

  it(test_name, async function () {
    let _prev_mint = 0;
    let _coin = await JohnLawCoin.new();
    let _oracle = await OracleForTesting.new({gas: 12000000});
    await _oracle.initialize();
    await _oracle.overrideConstants(_level_max, _reclaim_threshold,
                                    _proportional_reward_rate);
    common.print_contract_size(_oracle, "OracleForTesting");

    for (let iter = 0; iter < _iteration; iter++) {
      console.log(iter);
      let voters = [];
      for (let i = 0; i < _voter_count; i++) {
        let voter = {
          address: accounts[i],
          committed: false,
          deposit: 0,
          committed_level: 0,
          committed_salt: 0,
          committed_correctly: false,
          revealed: false,
          revealed_correctly: false,
          revealed_level: 0,
          revealed_salt: 0,
          reclaimed: false
        };
        voters.push(voter);
      }

      for (let i = 0; i < voters.length; i++) {
        assert.equal(voters[i].address, accounts[i]);
        voters[i].committed = (randint(0, 99) < 95);
        if (voters[i].committed) {
          voters[i].deposit = randint(0, 10);
          voters[i].committed_level = randint(0, _level_max);
          voters[i].committed_salt = randint(0, 10);
          await _coin.mint(voters[i].address, voters[i].deposit);
          await check_commit(
              voters[i].address,
              await _oracle.hash(voters[i].address,
                                 voters[i].committed_level,
                                 voters[i].committed_salt),
              voters[i].deposit);

          assert.equal(await _coin.balanceOf(voters[i].address), 0);
          voters[i].committed_correctly = true;

          assert.equal(await _oracle.commit.call(
              _coin.address, voters[i].address,
              await _oracle.hash(voters[i].address,
                                 voters[i].committed_level,
                                 voters[i].committed_salt),
              0), false);
        }
      }

      let mint = randint(0, 20);
      await check_advance(mint, _prev_mint);
      _prev_mint = mint;

      for (let i = 0; i < voters.length; i++) {
        assert.equal(voters[i].address, accounts[i]);
        voters[i].revealed = (randint(0, 99) < 95);
        if (voters[i].revealed) {
          if (randint(0, 99) < 95) {
            voters[i].revealed_level = voters[i].committed_level;
          } else {
            voters[i].revealed_level = randint(0, _level_max);
          }
          if (randint(0, 99) < 95) {
            voters[i].revealed_salt = voters[i].committed_salt;
          } else {
            voters[i].revealed_salt = randint(0, 10);
          }
          voters[i].revealed_correctly = (
              voters[i].committed_correctly &&
                voters[i].revealed_level == voters[i].committed_level &&
                0 <= voters[i].revealed_level &&
                voters[i].revealed_level < _level_max &&
                voters[i].revealed_salt == voters[i].committed_salt);
          if (voters[i].revealed_correctly) {
            await check_reveal(voters[i].address,
                               voters[i].revealed_level,
                               voters[i].revealed_salt);
          }
          assert.equal(await _oracle.reveal.call(
              voters[i].address, voters[i].revealed_level,
              voters[i].revealed_salt), false);
        }
      }

      let deposits = [];
      let counts = [];
      for (let level = 0; level < _level_max; level++) {
        deposits.push(0);
        counts.push(0);
      }
      let deposit_total = 0;
      for (let i = 0; i < voters.length; i++) {
        if (voters[i].committed_correctly) {
          deposit_total += voters[i].deposit;
        }
        if (voters[i].revealed_correctly) {
          deposits[voters[i].revealed_level] += voters[i].deposit;
          counts[voters[i].revealed_level] += 1;
        }
      }

      let max_deposit = 0;
      let max_count = 0;
      let mode_level = _level_max;
      for (let level = 0; level < _level_max; level++) {
        if (counts[level] > 0 &&
            (mode_level == _level_max ||
             max_deposit < deposits[level] ||
             (max_deposit == deposits[level] &&
              max_count < counts[level]))) {
          max_deposit = deposits[level];
          max_count = counts[level];
          mode_level = level;
        }
      }

      assert.equal(await _oracle.getModeLevel(), mode_level);

      mint = randint(0, 20);
      let deposit_to_reclaim = 0;
      if (mode_level == _level_max) {
        reward_total = deposit_total + mint;
      } else {
        for (let level = 0; level < _level_max; level++) {
          if (mode_level - _reclaim_threshold <= level &&
              level <= mode_level + _reclaim_threshold) {
            deposit_to_reclaim += deposits[level];
          }
        }
        reward_total = deposit_total - deposit_to_reclaim + mint;
      }
      assert.equal(deposit_to_reclaim + reward_total,
                   deposit_total + mint);

      await check_advance(mint, _prev_mint);
      _prev_mint = mint;

      let reclaim_total = 0;
      for (let i = 0; i < voters.length; i++) {
        assert.equal(voters[i].address, accounts[i]);
        voters[i].reclaimed = (randint(0, 99) < 95);
        if (voters[i].reclaimed) {
          assert.equal(await _coin.balanceOf(voters[i].address), 0);
          let reclaim_amount = 0;
          let should_reclaim = false;
          if ((voters[i].revealed_correctly &&
               voters[i].revealed_level == mode_level)) {
            assert.notEqual(mode_level, _level_max);
            let proportional_reward = 0;
            if (deposits[mode_level] > 0) {
              proportional_reward = Math.floor(
                  (_proportional_reward_rate * reward_total *
                   voters[i].deposit) / (100 * deposits[mode_level]));
            }
            let constant_reward = Math.floor(
                ((100 - _proportional_reward_rate) * reward_total) /
                  (100 * counts[mode_level]));
            reclaim_amount =
                voters[i].deposit + proportional_reward + constant_reward;
            should_reclaim = true;
          } else if (voters[i].revealed_correctly &&
                     mode_level - _reclaim_threshold <=
                     voters[i].revealed_level &&
                     voters[i].revealed_level <=
                     mode_level + _reclaim_threshold) {
            assert.notEqual(mode_level, _level_max);
            reclaim_amount = voters[i].deposit;
            should_reclaim = true;
          }
          if (should_reclaim) {
            await check_reclaim(voters[i].address, reclaim_amount);
          }
          assert.equal(await _oracle.reclaim.call(
              _coin.address, voters[i].address), 0);
          reclaim_total += reclaim_amount;
          assert.equal(await _coin.balanceOf(voters[i].address),
                       reclaim_amount);
          await _coin.burn(voters[i].address, reclaim_amount);
        }
      }

      assert.equal(deposit_to_reclaim + reward_total, deposit_total + mint);
      let remainder = deposit_total + mint - reclaim_total;
      mint = randint(0, 20);
      await check_advance(mint, remainder);
      _prev_mint = mint;
    }

    assert.equal(await _coin.totalSupply(), _prev_mint);

    async function check_commit(account, committed_hash, deposit) {
      await _coin.transferOwnership(_oracle.address);
      let receipt =
          await _oracle.commit(_coin.address, account, committed_hash, deposit);
      await _oracle.revokeOwnership(_coin.address);
      let args = receipt.logs.filter(e => e.event == 'CommitEvent')[0].args;
      assert.equal(args[0], account);
      assert.equal(args[1], committed_hash);
      assert.equal(args[2], deposit);
    }

    async function check_reveal(account, level, salt) {
      let receipt = await _oracle.reveal(account, level, salt);
      let args = receipt.logs.filter(e => e.event == 'RevealEvent')[0].args;
      assert.equal(args[0], account);
      assert.equal(args[1], level);
      assert.equal(args[2], salt);
    }

    async function check_reclaim(account, reclaim_amount) {
      await _coin.transferOwnership(_oracle.address);
      let receipt = await _oracle.reclaim(_coin.address, account);
      await _oracle.revokeOwnership(_coin.address);
      let args = receipt.logs.filter(e => e.event == 'ReclaimEvent')[0].args;
      assert.equal(args[0], account);
      assert.equal(args[1].toNumber(), reclaim_amount);
    }

    async function check_advance(mint, burned) {
      await _coin.transferOwnership(_oracle.address);
      let receipt = await _oracle.advance(_coin.address, mint);
      await _oracle.revokeOwnership(_coin.address);
      let args = receipt.logs.filter(
          e => e.event == 'AdvancePhaseEvent')[0].args;
      assert.isTrue(args[0] >= 3);
      assert.equal(args[1].toNumber(), mint);
      assert.equal(args[2].toNumber(), burned);
    }

  });

}