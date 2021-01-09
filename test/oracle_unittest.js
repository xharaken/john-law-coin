const TokenSupply = artifacts.require("TokenSupply");
const TokenHolder = artifacts.require("TokenHolder");
const Oracle = artifacts.require("Oracle");
const OracleForTesting = artifacts.require("OracleForTesting");

contract("OracleUnittest", function (accounts) {
  level_max = 5;
  reclaim_threshold = 1;
  proportional_reward_rate = 80;
  mint = 100;
  deposit = 20;
  mode_level = 2;
  other_level = 0;
  parameterized_test(accounts,
                     level_max,
                     reclaim_threshold,
                     proportional_reward_rate,
                     mint,
                     deposit,
                     mode_level,
                     other_level);
});

function parameterized_test(accounts,
                            _level_max,
                            _reclaim_threshold,
                            _proportional_reward_rate,
                            _mint,
                            _deposit,
                            _mode_level,
                            _other_level) {
  let test_name = "Oracle parameters: " + "level_max=" + _level_max +
      " reclaim=" + _reclaim_threshold +
      " prop=" + _proportional_reward_rate +
      " mint=" + _mint + " deposit=" + _deposit +
      " mode_level=" + _mode_level + " other_level=" + _other_level;

  it(test_name, async function () {
    assert.isTrue(_mint >= 0);
    assert.isTrue(_deposit >= 0);
    assert.isTrue(0 <= _mode_level && _mode_level < _level_max);
    assert.isTrue(0 <= _other_level && _other_level < _level_max);
    assert.isTrue(_mode_level != _other_level);

    let _supply = await TokenSupply.new();
    let _oracle = await OracleForTesting.new({gas: 12000000});
    await _oracle.initialize(_supply.address);
    await _oracle.override_constants(_level_max, _reclaim_threshold,
                                     _proportional_reward_rate);
    print_contract_size(_oracle, "OracleForTesting");
    await _supply.set_delegated_owner(_oracle.address);
    await _supply.set_delegated_owner(_oracle.address);

    let current = await get_current([accounts[2]]);
    for (let i = 0; i < 3; i++) {
      assert.equal(current.epochs[i].votes.length, level_max);
    }
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epoch % 3, 0);

    await should_throw(async () => {
      await _oracle.advance_phase(-1);
    }, "out-of-bounds");

    let deposit_holder = await TokenHolder.new(_supply.address);
    let reclaim_holder = await TokenHolder.new(_supply.address);

    // no commit -> no reveal -> no reclaim
    assert.equal(await _oracle.get_mode_level(), _level_max);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, 0);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply + _mint);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, 0);
    assert.equal(current.epochs[1].deposit_holder.amount, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, _mint);
    assert.equal(current.epochs[2].deposit_holder.amount, 0);
    assert.equal(current.epochs[2].reward_total, _mint);

    await should_throw(async () => {
      await _oracle.reveal.call(accounts[1], -1, 1111);
    }, "out-of-bounds");

    assert.equal((await _oracle.reveal.call(accounts[1], 0, 1111)), false);
    assert.equal((await _oracle.reveal.call(accounts[1], 0, 1111)), false);
    assert.equal((await _oracle.reveal.call(
        accounts[1], _level_max, 1111)), false);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, _mint);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, _mint);
    assert.equal(current.epochs[1].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, 0);
    assert.equal(current.epochs[1].deposit_holder.amount, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, 0);
    assert.equal(current.epochs[2].deposit_holder.amount, 0);
    assert.equal(current.epochs[2].reward_total, 0);

    assert.equal(await _oracle.reclaim.call(
        accounts[1], reclaim_holder.address), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[1], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, _mint);
    assert.equal(current.epochs[1].deposit_holder.amount, 0);
    assert.equal(current.epochs[1].reward_total, _mint);
    assert.equal(current.epochs[2].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, 0);
    assert.equal(current.epochs[2].deposit_holder.amount, 0);
    assert.equal(current.epochs[2].reward_total, 0);

    // 1 commit -> 1 reveal -> 1 reclaim
    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    assert.equal(
        await _oracle.commit.call(
            accounts[1],
            await _oracle.hash(accounts[1], _mode_level, 1111),
            _deposit + 1, deposit_holder.address), false);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0)
    assert.equal(
        await _oracle.commit.call(
            accounts[1],
            await _oracle.hash(accounts[1], _mode_level, 1111),
            _deposit, deposit_holder.address), false);
    assert.equal(
        await _oracle.commit.call(
            accounts[1],
            await _oracle.hash(accounts[1], 0, 1111),
            _deposit, deposit_holder.address), false);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, 0);
    assert.equal(current.epochs[1].deposit_holder.amount, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, _mint);
    assert.equal(current.epochs[2].deposit_holder.amount, 0);
    assert.equal(current.epochs[2].reward_total, _mint);

    assert.equal(await _oracle.reveal.call(
        accounts[1], _level_max, 1111), false);
    assert.equal(await _oracle.reveal.call(accounts[2], 0, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(accounts[1], 0, 1111), false);
    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level, 1111), false);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 1);
    assert.equal(current.epochs[0].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit);
        assert.equal(vote.should_reward, true);
        assert.equal(vote.should_reclaim, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[0].reward_holder.amount, _mint);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit);
    assert.equal(current.epochs[0].reward_total, _mint);
    assert.equal(current.epochs[1].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, 0);
    assert.equal(current.epochs[1].deposit_holder.amount, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, 0);
    assert.equal(current.epochs[2].deposit_holder.amount, 0);
    assert.equal(current.epochs[2].reward_total, 0);

    reclaim_amount = _deposit + _reward(_mint, 1);
    await check_reclaim(accounts[1], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    assert.equal(await _oracle.reclaim.call(
        accounts[1], reclaim_holder.address), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[2], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              _mint - _reward(_mint, 1) * 1);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply + _reward(_mint, 1) * 1);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, _mint);
    assert.equal(current.epochs[1].deposit_holder.amount, 0);
    assert.equal(current.epochs[1].reward_total, _mint);
    assert.equal(current.epochs[2].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, 0);
    assert.equal(current.epochs[2].deposit_holder.amount, 0);
    assert.equal(current.epochs[2].reward_total, 0);

    // 1 commit -> 1 reveal -> 1 reclaim
    //             1 commit -> 1 reveal -> 1 reclaim
    //                         1 commit -> 1 reveal -> 1 reclaim
    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, 0);
    assert.equal(current.epochs[1].deposit_holder.amount, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, _mint);
    assert.equal(current.epochs[2].deposit_holder.amount, 0);
    assert.equal(current.epochs[2].reward_total, _mint);

    await check_reveal(accounts[1], _mode_level, 1111);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 1);
    assert.equal(current.epochs[0].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit);
        assert.equal(vote.should_reward, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[0].reward_holder.amount, _mint);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit);
    assert.equal(current.epochs[0].reward_total, _mint);
    assert.equal(current.epochs[1].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[1].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[1].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[1].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, 0);
    assert.equal(current.epochs[1].deposit_holder.amount,
                 _deposit);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, 0);
    assert.equal(current.epochs[2].deposit_holder.amount, 0);
    assert.equal(current.epochs[2].reward_total, 0);

    reclaim_amount = _deposit + _reward(_mint, 1);
    await check_reclaim(accounts[1], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);

    await check_reveal(accounts[1], _mode_level, 1111);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              _mint - _reward(_mint, 1) * 1);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply + _reward(_mint, 1) * 1);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[1].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111))
    assert.equal(current.epochs[1].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[1].commits[accounts[1]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].votes[_mode_level].count, 1);
    assert.equal(current.epochs[1].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[1].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit);
        assert.equal(vote.should_reward, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[1].reward_holder.amount, _mint);
    assert.equal(current.epochs[1].deposit_holder.amount,
                 _deposit);
    assert.equal(current.epochs[1].reward_total, _mint);
    assert.equal(current.epochs[2].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[2].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[2].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[2].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, 0);
    assert.equal(current.epochs[2].deposit_holder.amount,
                 _deposit);
    assert.equal(current.epochs[2].reward_total, 0);

    reclaim_amount = _deposit + _reward(_mint, 1);
    await check_reclaim(accounts[1], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);

    await check_reveal(accounts[1], _mode_level, 1111);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              _mint - _reward(_mint, 1) * 1);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply + _reward(_mint, 1) * 1);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);
    assert.equal(current.epochs[1].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, 0);
    assert.equal(current.epochs[1].deposit_holder.amount, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[2].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[2].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[2].commits[accounts[1]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].votes[_mode_level].count, 1);
    assert.equal(current.epochs[2].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[2].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit);
        assert.equal(vote.should_reward, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[2].reward_holder.amount, _mint);
    assert.equal(current.epochs[2].deposit_holder.amount,
                 _deposit);
    assert.equal(current.epochs[2].reward_total, _mint);

    reclaim_amount = _deposit + _reward(_mint, 1);
    await check_reclaim(accounts[1], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);

    assert.equal(await _oracle.get_mode_level(), _level_max);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              _mint - _reward(_mint, 1) * 1);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply + _reward(_mint, 1) * 1);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, _mint);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, _mint);
    assert.equal(current.epochs[1].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[1].votes.length, _level_max);
    assert.equal(current.epochs[1].reward_holder.amount, 0);
    assert.equal(current.epochs[1].deposit_holder.amount, 0);
    assert.equal(current.epochs[1].reward_total, 0);
    assert.equal(current.epochs[2].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[2].votes.length, _level_max);
    assert.equal(current.epochs[2].reward_holder.amount, 0);
    assert.equal(current.epochs[2].deposit_holder.amount, 0);
    assert.equal(current.epochs[2].reward_total, 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);

    // 6 commits on the mode ->
    // 6 reveals on the mode ->
    // full reclaim
    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[2],
                       await _oracle.hash(accounts[2], _mode_level, 2222),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[3],
                       await _oracle.hash(accounts[3], _mode_level, 3333),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[4],
                       await _oracle.hash(accounts[4], _mode_level, 4444),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[5],
                       await _oracle.hash(accounts[5], _mode_level, 5555),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[6],
                       await _oracle.hash(accounts[6], _mode_level, 6666),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].committed_hash,
                 await _oracle.hash(accounts[2], _mode_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].committed_hash,
                 await _oracle.hash(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].committed_hash,
                 await _oracle.hash(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].committed_hash,
                 await _oracle.hash(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].committed_hash,
                 await _oracle.hash(accounts[6], _mode_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);

    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _mode_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _mode_level, 6666);
    assert.equal(await _oracle.reveal.call(
        accounts[7], _mode_level, 7777), false);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 6);
    assert.equal(current.epochs[0].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 6);
        assert.equal(vote.should_reward, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false)
      }
    }
    assert.equal(current.epochs[0].reward_holder.amount,
                 _mint);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, _mint);


    reclaim_amount = _deposit + _reward(_mint, 6);

    await check_reclaim(accounts[6], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[5], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[4], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[3], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[2], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[1], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    assert.equal(await _oracle.reclaim.call(
        accounts[6], reclaim_holder.address), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[7], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              _mint - _reward(_mint, 6) * 6);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply + _reward(_mint, 6) * 6);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);

    // 6 commits on the mode ->
    // 6 reveals on the mode ->
    // no reclaim
    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[2],
                       await _oracle.hash(accounts[2], _mode_level, 2222),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[3],
                       await _oracle.hash(accounts[3], _mode_level, 3333),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[4],
                       await _oracle.hash(accounts[4], _mode_level, 4444),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[5],
                       await _oracle.hash(accounts[5], _mode_level, 5555),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[6],
                       await _oracle.hash(accounts[6], _mode_level, 6666),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].committed_hash,
                 await _oracle.hash(accounts[2], _mode_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].committed_hash,
                 await _oracle.hash(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].committed_hash,
                 await _oracle.hash(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].committed_hash,
                 await _oracle.hash(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].committed_hash,
                 await _oracle.hash(accounts[6], _mode_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);

    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _mode_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _mode_level, 6666);
    assert.equal(await _oracle.reveal.call(
        accounts[7], _mode_level, 7777), false);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 6);
    assert.equal(current.epochs[0].votes[_other_level].count, 0);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 6);
        assert.equal(vote.should_reward, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }
    assert.equal(current.epochs[0].reward_holder.amount,
                 _mint);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, _mint);

    assert.equal(await _oracle.reclaim.call(
        accounts[7], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              _mint + _deposit * 6);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply - _deposit * 6);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);

    // 4 commits on the mode + 2 commits on the other level ->
    // 4 reveals on the mode + 2 reveals on the other level ->
    // full reclaim
    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[2],
                       await _oracle.hash(accounts[2], _other_level, 2222),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[3],
                       await _oracle.hash(accounts[3], _mode_level, 3333),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[4],
                       await _oracle.hash(accounts[4], _mode_level, 4444),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[5],
                       await _oracle.hash(accounts[5], _mode_level, 5555),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[6],
                       await _oracle.hash(accounts[6], _other_level, 6666),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].committed_hash,
                 await _oracle.hash(accounts[2], _other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].committed_hash,
                 await _oracle.hash(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].committed_hash,
                 await _oracle.hash(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].committed_hash,
                 await _oracle.hash(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].committed_hash,
                 await _oracle.hash(accounts[6], _other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);

    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _other_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _other_level, 6666);
    assert.equal(await _oracle.reveal.call(
        accounts[7], _mode_level, 7777), false);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 4);
    assert.equal(current.epochs[0].votes[_other_level].count, 2);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 4);
        assert.equal(vote.should_reward, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }

    reward_total = 0;
    deposit_total = 0;
    if (_is_in_reclaim_threshold(_other_level)) {
      reward_total = _mint;
      deposit_total = _deposit * 6;
    } else {
      reward_total = _mint + _deposit * 2;
      deposit_total = _deposit * 4;
      assert.equal(current.epochs[0].reward_holder.amount,
                   reward_total);
      assert.equal(current.epochs[0].deposit_holder.amount,
                   deposit_total);
    }
    if (_is_in_reclaim_threshold(_other_level)) {
      await check_reclaim(  accounts[2], reclaim_holder.address, _deposit);
      assert.equal(await reclaim_holder.amount_(), _deposit);
      _supply.burn(reclaim_holder.address, _deposit);
      await check_reclaim(  accounts[6], reclaim_holder.address, _deposit);
      assert.equal(await reclaim_holder.amount_(), _deposit);
      _supply.burn(reclaim_holder.address, _deposit);
    } else {
      assert.equal(await _oracle.reclaim.call(
          accounts[2], reclaim_holder.address), 0);
      assert.equal(await reclaim_holder.amount_(), 0);
      assert.equal(await _oracle.reclaim.call(
          accounts[6], reclaim_holder.address), 0);
      assert.equal(await reclaim_holder.amount_(), 0);
    }

    reclaim_amount = _deposit + _reward(reward_total, 4);
    await check_reclaim(accounts[5], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[4], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[3], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[1], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    assert.equal(await _oracle.reclaim.call(
        accounts[6], reclaim_holder.address), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[7], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              reward_total - _reward(reward_total, 4) * 4);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply + _mint - reward_total +
                 _reward(reward_total, 4) * 4);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);

    // 4 commits on the mode + 2 commits on the other level ->
    // 4 reveals on the mode + 2 reveals on the other level ->
    // no reclaim
    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[2],
                       await _oracle.hash(accounts[2], _other_level, 2222),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[3],
                       await _oracle.hash(accounts[3], _mode_level, 3333),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[4],
                       await _oracle.hash(accounts[4], _mode_level, 4444),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[5],
                       await _oracle.hash(accounts[5], _mode_level, 5555),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[6],
                       await _oracle.hash(accounts[6], _other_level, 6666),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].committed_hash,
                 await _oracle.hash(accounts[2], _other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].committed_hash,
                 await _oracle.hash(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].committed_hash,
                 await _oracle.hash(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].committed_hash,
                 await _oracle.hash(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].committed_hash,
                 await _oracle.hash(accounts[6], _other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);

    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _other_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _other_level, 6666);
    assert.equal(await _oracle.reveal.call(
        accounts[7], _mode_level, 7777), false);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 4);
    assert.equal(current.epochs[0].votes[_other_level].count, 2);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 4);
        assert.equal(vote.should_reward, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }

    reward_total = 0;
    deposit_total = 0;
    if (_is_in_reclaim_threshold(_other_level)) {
      reward_total = _mint;
      deposit_total = _deposit * 6;
    } else {
      reward_total = _mint + _deposit * 2;
      deposit_total = _deposit * 4;
      assert.equal(current.epochs[0].reward_holder.amount,
                   reward_total);
      assert.equal(current.epochs[0].deposit_holder.amount,
                   deposit_total);
    }

    assert.equal(await _oracle.reclaim.call(
        accounts[7], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              _mint + _deposit * 6);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply - _deposit * 6);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);

    // 3 commits on the two modes ->
    // 3 reveals on the two modes ->
    // full reclaim
    real_mode_level = Math.min(_mode_level, _other_level);
    real_other_level = Math.max(_mode_level, _other_level);
    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(
                           accounts[1], real_mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[2],
                       await _oracle.hash(
                           accounts[2], real_other_level, 2222),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[3],
                       await _oracle.hash(
                           accounts[3], real_mode_level, 3333),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[4],
                       await _oracle.hash(
                           accounts[4], real_other_level, 4444),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[5],
                       await _oracle.hash(
                           accounts[5], real_mode_level, 5555),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[6],
                       await _oracle.hash(
                           accounts[6], real_other_level, 6666),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(
                     accounts[1], real_mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].committed_hash,
                 await _oracle.hash(
                     accounts[2], real_other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].committed_hash,
                 await _oracle.hash(
                     accounts[3], real_mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].committed_hash,
                 await _oracle.hash(
                     accounts[4], real_other_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].committed_hash,
                 await _oracle.hash(
                     accounts[5], real_mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].committed_hash,
                 await _oracle.hash(
                     accounts[6], real_other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);

    assert.equal(await _oracle.reveal.call(
        accounts[1], real_mode_level + 100, 1111), false);
    await check_reveal(accounts[1], real_mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
        accounts[1], real_mode_level, 1111), false);
    await check_reveal(accounts[2], real_other_level, 2222);
    await check_reveal(accounts[3], real_mode_level, 3333);
    await check_reveal(accounts[4], real_other_level, 4444);
    await check_reveal(accounts[5], real_mode_level, 5555);
    await check_reveal(accounts[6], real_other_level, 6666);
    assert.equal(await _oracle.reveal.call(
        accounts[7], real_mode_level, 7777), false);

    assert.equal(await _oracle.get_mode_level(), real_mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 real_other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 real_other_level);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 real_other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 3);
    assert.equal(current.epochs[0].votes[_other_level].count, 3);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == real_mode_level) {
        assert.equal(vote.deposit, _deposit * 3);
        assert.equal(vote.should_reward, true);
      } else if (real_mode_level - _reclaim_threshold <= level &&
                 level <= real_mode_level + _reclaim_threshold) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }

    reward_total = 0;
    deposit_total = 0;
    if (real_mode_level - _reclaim_threshold <= real_other_level &&
        real_other_level <= real_mode_level + _reclaim_threshold) {
      reward_total = _mint;
      deposit_total = _deposit * 6;
    } else {
      reward_total = _mint + _deposit * 3;
      deposit_total = _deposit * 3;
      assert.equal(current.epochs[0].reward_holder.amount,
                   reward_total);
      assert.equal(current.epochs[0].deposit_holder.amount,
                   deposit_total);
    }

    if (real_mode_level - _reclaim_threshold <= real_other_level &&
        real_other_level <= real_mode_level + _reclaim_threshold) {
      await check_reclaim(  accounts[2], reclaim_holder.address, _deposit);
      assert.equal(await reclaim_holder.amount_(), _deposit);
      _supply.burn(reclaim_holder.address, _deposit);
      await check_reclaim(  accounts[4], reclaim_holder.address, _deposit);
      assert.equal(await reclaim_holder.amount_(), _deposit);
      _supply.burn(reclaim_holder.address, _deposit);
      await check_reclaim(  accounts[6], reclaim_holder.address, _deposit);
      assert.equal(await reclaim_holder.amount_(), _deposit);
      _supply.burn(reclaim_holder.address, _deposit);
    } else {
      assert.equal(await _oracle.reclaim.call(
          accounts[2], reclaim_holder.address), 0);
      assert.equal(await reclaim_holder.amount_(), 0);
      assert.equal(await _oracle.reclaim.call(
          accounts[4], reclaim_holder.address), 0);
      assert.equal(await reclaim_holder.amount_(), 0);
      assert.equal(await _oracle.reclaim.call(
          accounts[6], reclaim_holder.address), 0);
      assert.equal(await reclaim_holder.amount_(), 0);
    }
    reclaim_amount = _deposit + _reward(reward_total, 3);
    await check_reclaim(accounts[5], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[3], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[1], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    assert.equal(await _oracle.reclaim.call(
        accounts[6], reclaim_holder.address), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[7], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              reward_total - _reward(reward_total, 3) * 3);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply + _mint -
                 reward_total + _reward(reward_total, 3) * 3);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);

    // 3 commits on the two modes ->
    // 3 reveals on the two modes ->
    // no reclaim
    real_mode_level = Math.min(_mode_level, _other_level);
    real_other_level = Math.max(_mode_level, _other_level);
    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(
                           accounts[1], real_mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[2],
                       await _oracle.hash(
                           accounts[2], real_other_level, 2222),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[3],
                       await _oracle.hash(
                           accounts[3], real_mode_level, 3333),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[4],
                       await _oracle.hash(accounts[4], real_other_level, 4444),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[5],
                       await _oracle.hash(
                           accounts[5], real_mode_level, 5555),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[6],
                       await _oracle.hash(
                           accounts[6], real_other_level, 6666),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(
                     accounts[1], real_mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].committed_hash,
                 await _oracle.hash(
                     accounts[2], real_other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].committed_hash,
                 await _oracle.hash(
                     accounts[3], real_mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].committed_hash,
                 await _oracle.hash(
                     accounts[4], real_other_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].committed_hash,
                 await _oracle.hash(
                     accounts[5], real_mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].committed_hash,
                 await _oracle.hash(
                     accounts[6], real_other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);

    assert.equal(await _oracle.reveal.call(
        accounts[1], real_mode_level + 100, 1111), false);
    await check_reveal(accounts[1], real_mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
        accounts[1], real_mode_level, 1111), false);
    await check_reveal(accounts[2], real_other_level, 2222);
    await check_reveal(accounts[3], real_mode_level, 3333);
    await check_reveal(accounts[4], real_other_level, 4444);
    await check_reveal(accounts[5], real_mode_level, 5555);
    await check_reveal(accounts[6], real_other_level, 6666);
    assert.equal(await _oracle.reveal.call(
        accounts[7], real_mode_level, 7777), false);

    assert.equal(await _oracle.get_mode_level(),
                 Math.min(real_mode_level, real_other_level));

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 real_other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 real_other_level);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 real_mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 real_other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 3);
    assert.equal(current.epochs[0].votes[_other_level].count, 3);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == real_mode_level) {
        assert.equal(vote.deposit, _deposit * 3);
        assert.equal(vote.should_reward, true);
      } else if (real_mode_level - _reclaim_threshold <= level &&
                 level <= real_mode_level + _reclaim_threshold) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false)
      }
    }

    reward_total = 0;
    deposit_total = 0;
    if (real_mode_level - _reclaim_threshold <= real_other_level &&
        real_other_level <= real_mode_level + _reclaim_threshold) {
      reward_total = _mint;
      deposit_total = _deposit * 6;
    } else {
      reward_total = _mint + _deposit * 3;
      deposit_total = _deposit * 3;
      assert.equal(current.epochs[0].reward_holder.amount,
                   reward_total);
      assert.equal(current.epochs[0].deposit_holder.amount,
                   deposit_total);
    }

    assert.equal(await _oracle.reclaim.call(
        accounts[7], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              _mint + _deposit * 6);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply - _deposit * 6);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);

    // 4 commits on the mode + 2 commits on the other level ->
    // 2 reveals on the mode + 1 reveals on the other level ->
    // full reclaim
    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[2],
                       await _oracle.hash(accounts[2], _other_level, 2222),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[3],
                       await _oracle.hash(accounts[3], _mode_level, 3333),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[4],
                       await _oracle.hash(accounts[4], _mode_level, 4444),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[5],
                       await _oracle.hash(accounts[5], _mode_level, 5555),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[6],
                       await _oracle.hash(accounts[6], _other_level, 6666),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].committed_hash,
                 await _oracle.hash(accounts[2], _other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].committed_hash,
                 await _oracle.hash(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].committed_hash,
                 await _oracle.hash(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].committed_hash,
                 await _oracle.hash(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].committed_hash,
                 await _oracle.hash(accounts[6], _other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);

    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level + 100, 1111), false);
    await check_reveal(accounts[1], _mode_level, 1111);
    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level, 1111), false);
    await check_reveal(accounts[2], _other_level, 2222);
    await check_reveal(accounts[3], _mode_level, 3333);
    // Incorrect reveal_level
    assert.equal(await _oracle.reveal.call(
        accounts[4], _other_level, 4444), false);
    await _oracle.reveal(accounts[4], _other_level, 4444);
    assert.equal(await _oracle.reveal.call(
        accounts[4], _mode_level, 4444), false);
    // Incorrect salt
    assert.equal(await _oracle.reveal.call(
        accounts[5], _mode_level, 6666), false);
    await _oracle.reveal(accounts[5], _mode_level, 6666);
    assert.equal(await _oracle.reveal.call(
        accounts[5], _mode_level, 5555), false);
    assert.equal(await _oracle.reveal.call(
        accounts[7], _mode_level, 7777), false);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _other_level);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 2);
    assert.equal(current.epochs[0].votes[_other_level].count, 1);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 2);
        assert.equal(vote.should_reward, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }

    reward_total = 0;
    deposit_total = 0;
    if (_is_in_reclaim_threshold(_other_level)) {
      reward_total = _mint + _deposit * 3;
      deposit_total = _deposit * 3;
    } else {
      reward_total = _mint + _deposit * 4;
      deposit_total = _deposit * 2;
      assert.equal(current.epochs[0].reward_holder.amount,
                   reward_total);
      assert.equal(current.epochs[0].deposit_holder.amount,
                   deposit_total);
    }

    if (_is_in_reclaim_threshold(_other_level)) {
      await check_reclaim(  accounts[2], reclaim_holder.address, _deposit);
      assert.equal(await reclaim_holder.amount_(), _deposit);
      _supply.burn(reclaim_holder.address, _deposit);
      assert.equal(await _oracle.reclaim.call(
          accounts[6], reclaim_holder.address), 0);
      assert.equal(await reclaim_holder.amount_(), 0);
    } else {
      assert.equal(await _oracle.reclaim.call(
          accounts[2], reclaim_holder.address), 0);
      assert.equal(await reclaim_holder.amount_(), 0);
      assert.equal(await _oracle.reclaim.call(
          accounts[6], reclaim_holder.address), 0);
      assert.equal(await reclaim_holder.amount_(), 0);
    }

    reclaim_amount = _deposit + _reward(reward_total, 2);
    assert.equal(await _oracle.reclaim.call(
        accounts[5], reclaim_holder.address), 0);
    assert.equal(await reclaim_holder.amount_(), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[4], reclaim_holder.address), 0);
    assert.equal(await reclaim_holder.amount_(), 0);
    await check_reclaim(accounts[3], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    await check_reclaim(accounts[1], reclaim_holder.address, reclaim_amount);
    assert.equal(await reclaim_holder.amount_(), reclaim_amount);
    _supply.burn(reclaim_holder.address, reclaim_amount);
    assert.equal(await _oracle.reclaim.call(
        accounts[6], reclaim_holder.address), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[7], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              reward_total - _reward(reward_total, 2) * 2);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply + _mint -
                 reward_total + _reward(reward_total, 2) * 2);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);

    // 4 commits on the mode + 2 commits on the other level ->
    // 2 reveals on the mode + 1 reveals on the other level ->
    // no reclaim

    assert.equal(await _oracle.get_mode_level(), _level_max);

    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[1],
                       await _oracle.hash(accounts[1], _mode_level, 1111),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[2],
                       await _oracle.hash(accounts[2], _other_level, 2222),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[3],
                       await _oracle.hash(accounts[3], _mode_level, 3333),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[4],
                       await _oracle.hash(accounts[4], _mode_level, 4444),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[5],
                       await _oracle.hash(accounts[5], _mode_level, 5555),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);
    await _supply.mint(deposit_holder.address, _deposit);
    await check_commit(accounts[6],
                       await _oracle.hash(accounts[6], _other_level, 6666),
                       _deposit, deposit_holder.address);
    assert.equal(await deposit_holder.amount_(), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 1);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.REVEAL);
    assert.equal(current.epochs[0].commits[accounts[1]].committed_hash,
                 await _oracle.hash(accounts[1], _mode_level, 1111));
    assert.equal(current.epochs[0].commits[accounts[1]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].committed_hash,
                 await _oracle.hash(accounts[2], _other_level, 2222));
    assert.equal(current.epochs[0].commits[accounts[2]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].committed_hash,
                 await _oracle.hash(accounts[3], _mode_level, 3333));
    assert.equal(current.epochs[0].commits[accounts[3]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].committed_hash,
                 await _oracle.hash(accounts[4], _mode_level, 4444));
    assert.equal(current.epochs[0].commits[accounts[4]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[5]].committed_hash,
                 await _oracle.hash(accounts[5], _mode_level, 5555));
    assert.equal(current.epochs[0].commits[accounts[5]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[6]].committed_hash,
                 await _oracle.hash(accounts[6], _other_level, 6666));
    assert.equal(current.epochs[0].commits[accounts[6]].deposit,
                 _deposit);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount,
                 _deposit * 6);
    assert.equal(current.epochs[0].reward_total, 0);

    assert.equal(await _oracle.reveal.call(
        accounts[1], _mode_level + 100, 1111), false);
    // Incorrect revealed level
    assert.equal(await _oracle.reveal.call(
        accounts[2], _mode_level, 2222), false);
    // Incorrect salt
    assert.equal(await _oracle.reveal.call(
        accounts[3], _mode_level, 4444), false);
    await check_reveal(accounts[4], _mode_level, 4444);
    await check_reveal(accounts[5], _mode_level, 5555);
    await check_reveal(accounts[6], _other_level, 6666);
    assert.equal(await _oracle.reveal.call(
        accounts[7], _mode_level, 7777), false);

    assert.equal(await _oracle.get_mode_level(), _mode_level);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint, _mint);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(), coin_supply);
    assert.equal(current.epoch % 3, 2);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.RECLAIM);
    assert.equal(current.epochs[0].commits[accounts[1]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[2]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[3]].revealed_level,
                 _level_max);
    assert.equal(current.epochs[0].commits[accounts[4]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[5]].revealed_level,
                 _mode_level);
    assert.equal(current.epochs[0].commits[accounts[6]].revealed_level,
                 _other_level);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].votes[_mode_level].count, 2);
    assert.equal(current.epochs[0].votes[_other_level].count, 1);
    for (let level = 0; level < _level_max; level++) {
      vote = current.epochs[0].votes[level];
      if (level == _mode_level) {
        assert.equal(vote.deposit, _deposit * 2);
        assert.equal(vote.should_reward, true);
      } else if (_is_in_reclaim_threshold(level)) {
        assert.equal(vote.should_reclaim, true);
      } else {
        assert.equal(vote.should_reclaim, false);
      }
    }

    reward_total = 0;
    deposit_total = 0;
    if (_is_in_reclaim_threshold(_other_level)) {
      reward_total = _mint + _deposit * 3;
      deposit_total = _deposit * 3;
    } else {
      reward_total = _mint + _deposit * 4;
      deposit_total = _deposit * 2;
      assert.equal(current.epochs[0].reward_holder.amount,
                   reward_total);
      assert.equal(current.epochs[0].deposit_holder.amount,
                   deposit_total);
    }

    assert.equal(await _oracle.reclaim.call(
        accounts[1], reclaim_holder.address), 0);
    assert.equal(await reclaim_holder.amount_(), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[2], reclaim_holder.address), 0);
    assert.equal(await reclaim_holder.amount_(), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[3], reclaim_holder.address), 0);
    assert.equal(await reclaim_holder.amount_(), 0);
    assert.equal(await _oracle.reclaim.call(
        accounts[7], reclaim_holder.address), 0);

    coin_supply = (await _supply.amount_()).toNumber();
    await check_advance_phase(_mint,
                              _mint + _deposit * 6);
    current = await get_current(accounts);
    assert.equal(await _supply.amount_(),
                 coin_supply - _deposit * 6);
    assert.equal(current.epoch % 3, 0);
    assert.equal(current.mode_level, _level_max);
    assert.equal(current.epochs[0].phase, Oracle.Phase.COMMIT);
    assert.equal(current.epochs[0].votes.length, _level_max);
    assert.equal(current.epochs[0].reward_holder.amount, 0);
    assert.equal(current.epochs[0].deposit_holder.amount, 0);
    assert.equal(current.epochs[0].reward_total, 0);

    await check_advance_phase(0, _mint);
    await check_advance_phase(0, 0);
    assert.equal(await _supply.amount_(), 0);

    // hash function
    assert.notEqual(await _oracle.hash(accounts[1], 10, 1111), 0);
    assert.notEqual(await _oracle.hash(accounts[1], 11, 111),
                    await _oracle.hash(accounts[1], 111, 11));
    assert.notEqual(await _oracle.hash(accounts[1], 11, 111),
                    await _oracle.hash(accounts[1], 1, 1111));

    // Ownable
    await should_throw(async () => {
      await _oracle.commit(accounts[1],
                           await _oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit, deposit_holder.address,
                           {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _oracle.reveal(accounts[1], _mode_level, 1111,
                           {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _oracle.reclaim(accounts[1], reclaim_holder.address,
                           {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _oracle.get_mode_level({from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await _oracle.advance_phase(1, {from: accounts[1]});
    }, "Ownable");

    _supply = await TokenSupply.new({from: accounts[2]});
    _oracle = await OracleForTesting.new({from: accounts[2], gas: 12000000});
    await _oracle.initialize(_supply.address, {from: accounts[2]});
    await _oracle.override_constants(_level_max, _reclaim_threshold,
                                     _proportional_reward_rate,
                                     {from: accounts[2]});
    await _supply.set_delegated_owner(_oracle.address, {from: accounts[2]});

    deposit_holder = await TokenHolder.new(
        _supply.address, {from: accounts[2]});
    reclaim_holder = await TokenHolder.new(
        _supply.address, {from: accounts[2]});

    await _oracle.commit(accounts[1],
                         await _oracle.hash(accounts[1], _mode_level, 1111),
                         _deposit, deposit_holder.address,
                         {from: accounts[2]});
    await should_throw(async () => {
      await _oracle.commit(accounts[1],
                           await _oracle.hash(accounts[1], _mode_level, 1111),
                           _deposit, deposit_holder.address,
                           {from: accounts[3]});
    }, "Ownable");

    await _oracle.reveal(accounts[1], _mode_level, 1111,
                         {from: accounts[2]});
    await should_throw(async () => {
      await _oracle.reveal(accounts[1], _mode_level, 1111,
                           {from: accounts[3]});
    }, "Ownable");

    await _oracle.reclaim(accounts[1], reclaim_holder.address,
                          {from: accounts[2]});
    await should_throw(async () => {
      await _oracle.reclaim(accounts[1], reclaim_holder.address,
                            {from: accounts[3]});
    }, "Ownable");

    await _oracle.get_mode_level({from: accounts[2]});
    await should_throw(async () => {
      await _oracle.get_mode_level({from: accounts[3]});
    }, "Ownable");

    await _oracle.advance_phase(1, {from: accounts[2]});
    await should_throw(async () => {
      await _oracle.advance_phase(1, {from: accounts[3]});
    }, "Ownable");

    let supply = await TokenSupply.at(await _oracle.coin_supply_());
    let holder = await TokenHolder.new(supply.address);
    await supply.mint(holder.address, 1, {from: accounts[2]});

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _oracle.coin_supply_());
      let holder = await TokenHolder.new(supply.address);
      await supply.mint(holder.address, 1);
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _oracle.coin_supply_());
      let holder = await TokenHolder.new(supply.address);
      await supply.mint(holder.address, 1, {from: accounts[3]});
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _oracle.coin_supply_());
      await _supply.set_delegated_owner(_oracle.address);
    }, "Ownable");

    await should_throw(async () => {
      let supply = await TokenSupply.at(await _oracle.coin_supply_());
      let holder = await TokenHolder.new(supply.address);
      await _supply.set_delegated_owner(_oracle.address, {from: accounts[3]});
    }, "Ownable");

    await should_throw(async () => {
      let ret = await _oracle.get_epoch_members(0);
      let holder = await TokenHolder.at(ret[0]);
      await holder.set_amount(1);
    }, "Ownable");

    await should_throw(async () => {
      let ret = await _oracle.get_epoch_members(0);
      let holder = await TokenHolder.at(ret[0]);
      await holder.set_amount(1, {from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      let ret = await _oracle.get_epoch_members(0);
      let holder = await TokenHolder.at(ret[0]);
      await holder.set_amount(1, {from: accounts[3]});
    }, "Ownable");

    await should_throw(async () => {
      let ret = await _oracle.get_epoch_members(0);
      let holder = await TokenHolder.at(ret[2]);
      await holder.set_amount(1);
    }, "Ownable");

    await should_throw(async () => {
      let ret = await _oracle.get_epoch_members(0);
      let holder = await TokenHolder.at(ret[2]);
      await holder.set_amount(1, {from: accounts[2]});
    }, "Ownable");

    await should_throw(async () => {
      let ret = await _oracle.get_epoch_members(0);
      let holder = await TokenHolder.at(ret[2]);
      await holder.set_amount(1, {from: accounts[3]});
    }, "Ownable");


    function _is_in_reclaim_threshold(level) {
      return (_mode_level - _reclaim_threshold <= level &&
              level <= _mode_level + _reclaim_threshold);
    }

    function _reward(reward_total, count) {
      let proportional_reward = 0;
      if (_deposit > 0) {
        proportional_reward = Math.floor(
            (_proportional_reward_rate * reward_total) / (100 * count));
      }
      constant_reward = Math.floor(
          ((100 - _proportional_reward_rate) * reward_total) /
            (100 * count));
      return proportional_reward + constant_reward;
    }

    async function check_commit(account, committed_hash,
                                deposit, balance_holder) {
      let receipt =
          await _oracle.commit(account, committed_hash,
                               deposit, balance_holder);
      let args = receipt.logs.filter(e => e.event == 'CommitEvent')[0].args;
      assert.equal(args[0], account);
      assert.equal(args[1], committed_hash);
      assert.equal(args[2], deposit);
      assert.equal(args[3], balance_holder);
    }

    async function check_reveal(account, level, salt) {
      let receipt = await _oracle.reveal(account, level, salt);
      let args = receipt.logs.filter(e => e.event == 'RevealEvent')[0].args;
      assert.equal(args[0], account);
      assert.equal(args[1], level);
      assert.equal(args[2], salt);
    }

    async function check_reclaim(account, reclaim_holder, reclaim_amount) {
      let receipt = await _oracle.reclaim(account, reclaim_holder);
      let args = receipt.logs.filter(e => e.event == 'ReclaimEvent')[0].args;
      assert.equal(args[0], account);
      assert.equal(args[1], reclaim_holder);
      assert.equal(args[2], reclaim_amount);
    }

    async function check_advance_phase(mint, burned) {
      let receipt = await _oracle.advance_phase(mint);
      let args = receipt.logs.filter(
          e => e.event == 'AdvancePhaseEvent')[0].args;
      assert.isTrue(args[0] >= 3);
      assert.equal(args[1], mint);
      assert.equal(args[2], burned);
    }

    async function get_current(accounts) {
      let oracle = {};
      oracle.level_max = _level_max;
      oracle.reclaim_threshold = _reclaim_threshold;
      oracle.proportional_reward_rate = _proportional_reward_rate;
      oracle.coin_supply = {};
      oracle.coin_supply.amount = (await (
          await TokenSupply.at(
              await _oracle.coin_supply_())).amount_()).toNumber();
      oracle.epoch = (await _oracle.epoch_()).toNumber();
      oracle.epochs = [];
      for (let epoch_index = 0; epoch_index < 3; epoch_index++) {
        let ret = await _oracle.get_epoch_members(epoch_index);
        let epoch = {};
        epoch.reward_holder = {};
        epoch.reward_holder.amount = (await (
            await TokenHolder.at(ret[0])).amount_()).toNumber();
        epoch.deposit_holder = {};
        epoch.deposit_holder.amount = (await (
            await TokenHolder.at(ret[2])).amount_()).toNumber();
        epoch.reward_total = ret[1];
        epoch.phase = ret[3];
        epoch.votes = [];
        for (let level = 0; level < oracle.level_max; level++) {
          let ret = await _oracle.get_vote(epoch_index, level);
          let vote = {deposit: ret[0], count: ret[1],
                      should_reclaim: ret[2], should_reward: ret[3]};
          epoch.votes.push(vote);
        }
        epoch.commits = {};

        for (let account of accounts) {
          let ret = await _oracle.get_commit(epoch_index, account);
          let commit = {committed_hash: ret[0], deposit: ret[1],
                        revealed_level: ret[2], phase: ret[3], epoch: ret[4]};
          epoch.commits[account] = commit;
        }
        oracle.epochs.push(epoch);
      }
      oracle.mode_level = await _oracle.get_mode_level();
      return oracle;
    }

    async function should_throw(callback, match) {
      let threw = false;
      try {
        await callback();
      } catch (e) {
        if (e.toString().indexOf(match) == -1) {
          console.log(e);
        } else {
          threw = true;
        }
      } finally {
        assert.equal(threw, true);
      }
    }

  });

}

function print_contract_size(instance, name) {
  let bytecode = instance.constructor._json.bytecode;
  let deployed = instance.constructor._json.deployedBytecode;
  let sizeOfB  = bytecode.length / 2;
  let sizeOfD  = deployed.length / 2;
  console.log(name + ": bytecode=" + sizeOfB + " deployed=" + sizeOfD);
}
