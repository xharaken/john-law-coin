// SPDX-License-Identifier: MIT
pragma solidity >=0.7.1 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/SignedSafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";
import "openzeppelin-solidity/contracts/utils/SafeCast.sol";

//------------------------------------------------------------------------------
// JohnLawCoin
//
// JohnLawCoin is a stable coin realized by an Algorithmic Central Bank (ACB).
// There is truly no gatekeeper in the system.
//
// JohnLawCoin is an experiment to verify the following assumption:
//
// - It is possible to stabilize the coin price with fully algorithmically
//   defined monetary policies without holding any collateral.
//
// If JohnLawCoin is successful, it will provide many interesting implications
// for 1) decentralized non-fiat currencies and 2) developing countries who want
// to stabilize their fiat currencies without sufficient USD reserve. See
// xxx.pdf to learn about JohnLawCoin and ACB.
//
// JohnLawCoin has the following important properties:
//
// - There is truly no gatekeeper. ACB is fully automated and no one (including
//   the author of the smart contract) has privileges to influence ACB. This can
//   be verified by the fact that the smart contract has no operations that
//   need privileged permissions.
// - The smart contract is self-contained. No dependencies on other smart
//   contracts or other external services.
// - All operations are guaranteed to finish in O(1) time complexity. The time
//   complexity of any operation is determined only by the input size of the
//   operation and not affected by the state of the contract.
//
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// JohnLawCoin
//
// JohnLawCoin is implemented as ERC20 tokens. JohnLawCoin is:
//
// - mintable, burnable and transferable by ACB and its oracle
// - pausable by ACB
// - transferrable by coin holders.
//------------------------------------------------------------------------------
contract JohnLawCoin is ERC20Pausable, Ownable {
  string public constant NAME = "JohnLawCoin";
  string public constant SYMBOL = "JLC";

  // Constructor
  //
  // Parameters
  // ----------------
  // None.
  constructor()
      ERC20(NAME, SYMBOL) {
  }

  // Mint coins to one account.
  //
  // Parameters
  // ----------------
  // |account|: The user account to which the coins are minted.
  // |amount|: The amount of the coins.
  //
  // Returns
  // ----------------
  // None.
  function mint(address account, uint256 amount)
      public onlyOwner {
    _mint(account, amount);
  }

  // Burn coins from one account.
  //
  // Parameters
  // ----------------
  // |account|: The user account from which the coins are burned.
  // |amount|: The amount of the coins.
  //
  // Returns
  // ----------------
  // None.
  function burn(address account, uint256 amount)
      public onlyOwner {
    _burn(account, amount);
  }

  // Move coins from one account to another account. This method is for ACB and
  // its oracle to move coins from any arbitrary account. Coin holders can move
  // coins by using ERC20's transfer method.
  //
  // Parameters
  // ----------------
  // |sender|: The sender account.
  // |receiver|: The receiver account.
  // |amount|: The amount of the coins.
  //
  // Returns
  // ----------------
  // None.
  function move(address sender, address receiver, uint256 amount)
      public onlyOwner {
    _transfer(sender, receiver, amount);
  }

  // Pause JohnLawCoin.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // None.
  function pause()
      public onlyOwner {
    _pause();
  }
  
  // Unpause JohnLawCoin.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // None.
  function unpause()
      public onlyOwner {
    _unpause();
  }
}

//------------------------------------------------------------------------------
// JohnLawBond
//
// JohnLawBond is an implementation of bonds ACB can issue and redeem to control
// the total coin supply in the system. JohnLawBond is:
//
// - mintable and burnable by ACB
// - not transferrable.
//------------------------------------------------------------------------------
contract JohnLawBond is Ownable {
  using SafeMath for uint;

  // Bonds are specified by a pair of the user account and the redemption
  // timestamp. balances_[account][redemption] stores the number of bonds
  // that are held by the user account and have the redemption timestamp.
  mapping (address => mapping (uint => uint)) private _balances;
  
  // The total bond supply.
  uint private _totalSupply;

  // Events.
  event MintEvent(address, uint, uint256);
  event BurnEvent(address, uint, uint256);

  // Constructor.
  //
  // Parameters
  // ----------------
  // None.
  constructor() {
    _totalSupply = 0;
  }
  
  // Mint bonds to one account.
  //
  // Parameters
  // ----------------
  // |account|: The user account to which the bonds are minted.
  // |redemption|: The redemtion timestamp of the bonds.
  // |amount|: The amount of the bonds.
  //
  // Returns
  // ----------------
  // None.
  function mint(address account, uint redemption, uint256 amount)
      public onlyOwner {
    _balances[account][redemption] = _balances[account][redemption].add(amount);
    _totalSupply = _totalSupply.add(amount);
    emit MintEvent(account, redemption, amount);
  }

  // Burn bonds from one account.
  //
  // Parameters
  // ----------------
  // |account|: The user account from which the bonds are burned.
  // |redemption|: The redemtion timestamp of the bonds.
  // |amount|: The amount of the bonds.
  //
  // Returns
  // ----------------
  // None.
  function burn(address account, uint redemption, uint256 amount)
      public onlyOwner {
    _balances[account][redemption] = _balances[account][redemption].sub(amount);
    _totalSupply = _totalSupply.sub(amount);
    emit BurnEvent(account, redemption, amount);
  }

  // Public getter: Return the balance of bonds that are held by |account|
  // and have the |redemption| timestamp.
  function balanceOf(address account, uint redemption)
      public view returns (uint) {
    return _balances[account][redemption];
  }

  // Public getter: Return the total bond supply.
  function totalSupply()
      public view returns (uint) {
    return _totalSupply;
  }
}

//------------------------------------------------------------------------------
// Oracle
//
// The Oracle is a mechanism to determine one "truth" level in 0, 1, 2, ...,
// LEVEL_MAX - 1 using the commit-reveal-reclaim voting scheme. The meaning of
// the oracle levels should be defined by the user of the oracle.
//------------------------------------------------------------------------------
contract Oracle is OwnableUpgradeable {
  using SafeMath for uint;

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'internal' (instead of
  // 'constant') because tests wants to override them.
  uint internal LEVEL_MAX;
  uint internal RECLAIM_THRESHOLD;
  uint internal PROPORTIONAL_REWARD_RATE;

  // The valid phase transition is: COMMIT => REVEAL => RECLAIM.
  enum Phase {
    COMMIT, REVEAL, RECLAIM
  }

  // Commit is a struct to manage one commit entry in the commit-reveal-reclaim
  // scheme.
  struct Commit {
    // The committed hash (filled in the commit phase).
    bytes32 committed_hash;
    // The amount of deposited coins (filled in the commit phase).
    uint deposit;
    // The revealed level (filled in the reveal phase).
    uint revealed_level;
    // The phase of this commit entry.
    Phase phase;
    // The epoch timestamp when this commit entry is created.
    uint epoch_timestamp;
  }

  // Vote is a struct to count votes in each oracle level.
  struct Vote {
    // Voting statistics are aggregated during the reveal phase and finalized
    // at the end of the reveal phase.

    // The total amount of coins deposited by the voters who voted for this
    // oracle level.
    uint deposit;
    // The number of the voters.
    uint count;
    // Set to True when the voters for this oracle level are eligible to
    // reclaim the desposited coins in the reclaim phase.
    bool should_reclaim;
    // Set to True when the voters for this oracle level are eligible to
    // receive a reward in the reclaim phase.
    bool should_reward;
  }

  // Epoch is a struct to keep track of phases throughout the commit / reveal /
  // reclaim phases. The oracle creates three Epoch objects and uses them in a
  // round-robin manner. For example, when the first Epoch object is in use for
  // the commit phase, the second Epoch object is in use for the reveal phase,
  // and the third Epoch object is in use for the reclaim phase.
  struct Epoch {
    // The commit entries.
    mapping (address => Commit) commits;
    // The voting statistics for all oracle levels.
    Vote[] votes;
    // |deposit_account| stores the coins deposited by the voters.
    address deposit_account;
    // Voters who voted for the "truth" level can receive a reward.
    // |reward_account| stores the reward.
    address reward_account;
    // The total amount of the reward.
    uint reward_total;
    // The phase of this Epoch.
    Phase phase;
  }

  // Attributes. See the comment in initialize().
  Epoch[3] public epochs_;
  uint public epoch_timestamp_;

  // Events.
  event CommitEvent(address indexed, bytes32, uint);
  event RevealEvent(address indexed, uint, uint);
  event ReclaimEvent(address indexed, uint);
  event AdvancePhaseEvent(uint indexed, uint, uint);

  // Initializer.
  //
  // Parameters
  // ----------------
  // None.
  function initialize()
      public initializer {
    __Ownable_init();

    // ----------------
    // Constants
    // ----------------
    
    // The number of the oracle levels.
    LEVEL_MAX = 7;
    
    // If the "truth" level is 7 and RECLAIM_THRESHOLD is 2, the voters who
    // voted for 5, 6, 7, 8 and 9 can reclaim their deposited coins. Other
    // voters lose their deposited coins.
    RECLAIM_THRESHOLD = 1;
    
    // The lost deposited coins and the coins minted by ACB are distributed to
    // the voters who voted for the "truth" level as a reward. The
    // PROPORTIONAL_REWARD_RATE of the reward is distributed to the voters in
    // proportion to the coins they deposited. The rest of the reward is
    // distributed to the voters evenly.
    PROPORTIONAL_REWARD_RATE = 80; // 80%

    // ----------------
    // Attributes
    // ----------------

    // The oracle creates three Epoch objects and uses them in a
    // round-robin manner (commit => reveal => reclaim).
    for (uint epoch_index = 0; epoch_index < 3; epoch_index++) {
      for (uint level = 0; level < LEVEL_MAX; level++) {
        epochs_[epoch_index].votes.push(Vote(0, 0, false, false));
      }
      epochs_[epoch_index].deposit_account =
          address(uint160(uint(keccak256(abi.encode(
              "deposit_account_address", epoch_index)))));
      epochs_[epoch_index].reward_account =
          address(uint160(uint(keccak256(abi.encode(
              "reward_account_address", epoch_index)))));
      epochs_[epoch_index].reward_total = 0;
    }
    epochs_[0].phase = Phase.COMMIT;
    epochs_[1].phase = Phase.RECLAIM;
    epochs_[2].phase = Phase.REVEAL;
    
    // The epoch timestamp increases monotonically (3, 4, 5, ...). The Epoch
    // object at |epoch_timestamp_ % 3| is in the commit phase. The Epoch object
    // at |(epoch_timestamp_ - 1) % 3| is in the reveal phase. The Epoch object
    // at |(epoch_timestamp_ - 2) % 3| is in the reclaim phase. Start with 3
    // because 0 in the commit entry is not distinguishable from an
    // uninitialized commit entry in Solidity.
    epoch_timestamp_ = 3;
  }

  // Do commit.
  //
  // Parameters
  // ----------------
  // |coin|: JohnLawCoin.
  // |sender|: The voter's account.
  // |committed_hash|: The committed hash.
  // |deposit|: The amount of deposited coins.
  //
  // Returns
  // ----------------
  // True if the commit succeeded. False otherwise.
  function commit(JohnLawCoin coin, address sender,
                  bytes32 committed_hash, uint deposit)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[epoch_timestamp_.mod(3)];
    require(epoch.phase == Phase.COMMIT,
            "commit: 1");
    if (coin.balanceOf(sender) < deposit) {
      return false;
    }
    // One voter can commit only once per epoch.
    if (epoch.commits[sender].epoch_timestamp == epoch_timestamp_) {
      return false;
    }

    // Create a commit entry.
    epoch.commits[sender] = Commit(
        committed_hash, deposit, LEVEL_MAX, Phase.COMMIT, epoch_timestamp_);
    require(epoch.commits[sender].phase == Phase.COMMIT,
            "commit: 2");

    // Move the deposited coins to the deposit account.
    coin.move(sender, epoch.deposit_account, deposit);
    emit CommitEvent(sender, committed_hash, deposit);
    return true;
  }

  // Do reveal.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |revealed_level|: The voter reveals the level they used in the commit
  // phase.
  // |revealed_salt|: The voter reveals the salt they used in the commit
  // phase.
  //
  // Returns
  // ----------------
  // True if the reveal succeeded. False otherwise.
  function reveal(address sender, uint revealed_level, uint revealed_salt)
      public onlyOwner returns (bool) {
    Epoch storage epoch = epochs_[(epoch_timestamp_.sub(1)).mod(3)];
    require(epoch.phase == Phase.REVEAL,
            "reveal: 1");
    if (revealed_level < 0 || LEVEL_MAX <= revealed_level) {
      return false;
    }
    if (epoch.commits[sender].epoch_timestamp != epoch_timestamp_.sub(1)) {
      // The corresponding commit was not found.
      return false;
    }
    // One voter can reveal only once per epoch.
    if (epoch.commits[sender].phase != Phase.COMMIT) {
      return false;
    }
    epoch.commits[sender].phase = Phase.REVEAL;

    // Check if the committed hash matches the revealed level and salt.
    bytes32 reveal_hash = hash(
        sender, revealed_level, revealed_salt);
    bytes32 committed_hash = epoch.commits[sender].committed_hash;
    if (committed_hash != reveal_hash) {
      return false;
    }

    // Update the commit entry with the revealed level and salt.
    epoch.commits[sender].revealed_level = revealed_level;

    // Count votes.
    epoch.votes[revealed_level].deposit =
        epoch.votes[revealed_level].deposit.add(epoch.commits[sender].deposit);
    epoch.votes[revealed_level].count =
        epoch.votes[revealed_level].count.add(1);
    emit RevealEvent(sender, revealed_level, revealed_salt);
    return true;
  }

  // Do reclaim.
  //
  // Parameters
  // ----------------
  // |coin|: JohnLawCoin.
  // |sender|: The voter's account.
  //
  // Returns
  // ----------------
  // The amount of reclaimed coins.
  function reclaim(JohnLawCoin coin, address sender)
      public onlyOwner returns (uint) {
    Epoch storage epoch = epochs_[(epoch_timestamp_.sub(2)).mod(3)];
    require(epoch.phase == Phase.RECLAIM,
            "reclaim: 1");
    if (epoch.commits[sender].epoch_timestamp != epoch_timestamp_.sub(2)){
      // The corresponding commit was not found.
      return 0;
    }
    // One voter can reclaim only once per epoch.
    if (epoch.commits[sender].phase != Phase.REVEAL) {
      return 0;
    }

    epoch.commits[sender].phase = Phase.RECLAIM;
    uint deposit = epoch.commits[sender].deposit;
    uint revealed_level = epoch.commits[sender].revealed_level;
    if (revealed_level == LEVEL_MAX) {
      return 0;
    }
    require(0 <= revealed_level && revealed_level < LEVEL_MAX,
            "reclaim: 2");

    if (!epoch.votes[revealed_level].should_reclaim) {
      return 0;
    }

    uint reclaim_amount = 0;
    require(epoch.votes[revealed_level].count > 0,
            "reclaim: 3");
    // Reclaim the deposited coins.
    coin.move(epoch.deposit_account, sender, deposit);
    reclaim_amount = reclaim_amount.add(deposit);

    if (epoch.votes[revealed_level].should_reward) {
      // The voter who voted for the "truth" level can receive the reward.
      //
      // The PROPORTIONAL_REWARD_RATE of the reward is distributed to the
      // voters in proportion to the coins they deposited. This incentivizes
      // voters who have more coins and thus should have more power on
      // determining the "truth" level to join the oracle game.
      //
      // The rest of the reward is distributed to the voters evenly. This
      // incentivizes more voters to join the oracle game.
      uint proportional_reward = 0;
      if (epoch.votes[revealed_level].deposit > 0) {
        proportional_reward =
            (uint(PROPORTIONAL_REWARD_RATE).mul(epoch.reward_total)
                 .mul(deposit))
                .div((uint(100).mul(epoch.votes[revealed_level].deposit)));
      }
      uint constant_reward =
          ((uint(100).sub(PROPORTIONAL_REWARD_RATE)).mul(epoch.reward_total))
          .div(uint(100).mul(epoch.votes[revealed_level].count));
      coin.move(epoch.reward_account,
                     sender,
                     proportional_reward.add(constant_reward));
      reclaim_amount = reclaim_amount.add(proportional_reward)
                       .add(constant_reward);
    }
    emit ReclaimEvent(sender, reclaim_amount);
    return reclaim_amount;
  }

  // Advance to the next phase. COMMIT => REVEAL, REVEAL => RECLAIM,
  // RECLAIM => COMMIT.
  //
  // Parameters
  // ----------------
  // |coin|: JohnLawCoin.
  // |mint|: The amount of coins to be supplied in the reclaim phase as the
  // reward.
  //
  // Returns
  // ----------------
  // None.
  function advance(JohnLawCoin coin, uint mint)
      public onlyOwner returns (uint) {
    // Step 1: Move the commit phase to the reveal phase.
    Epoch storage epoch = epochs_[epoch_timestamp_.mod(3)];
    require(epoch.phase == Phase.COMMIT,
            "advance: 1");
    epoch.phase = Phase.REVEAL;

    // Step 2: Move the reveal phase to the reclaim phase.
    epoch = epochs_[(epoch_timestamp_.sub(1)).mod(3)];
    require(epoch.phase == Phase.REVEAL,
            "advance: 2");

    uint mode_level = getModeLevel();
    if (0 <= mode_level && mode_level < LEVEL_MAX) {
      uint deposit_voted = 0;
      uint deposit_to_reclaim = 0;
      for (uint level = 0; level < LEVEL_MAX; level++) {
        require(epoch.votes[level].should_reclaim == false,
                "advance: 3");
        require(epoch.votes[level].should_reward == false,
                "advance: 4");
        deposit_voted = deposit_voted.add(epoch.votes[level].deposit);
        if ((mode_level < RECLAIM_THRESHOLD ||
             mode_level.sub(RECLAIM_THRESHOLD) <= level) &&
            level <= mode_level.add(RECLAIM_THRESHOLD)) {
          // Voters who voted for the oracle levels in [mode_level -
          // reclaim_threshold, mode_level + reclaim_threshold] are eligible
          // to reclaim the deposited coins. Other voters lose the deposited
          // coins.
          epoch.votes[level].should_reclaim = true;
          deposit_to_reclaim =
              deposit_to_reclaim.add(epoch.votes[level].deposit);
        }
      }

      // Voters who voted for the "truth" level are eligible to receive the
      // reward.
      epoch.votes[mode_level].should_reward = true;

      // Note: |deposit_voted| is equal to |balanceOf(epoch.deposit_account)|
      // only when all the voters who voted in the commit phase revealed
      // their votes correctly in the reveal phase.
      require(deposit_voted <= coin.balanceOf(epoch.deposit_account),
              "advance: 5");
      require(
          deposit_to_reclaim <= coin.balanceOf(epoch.deposit_account),
          "advance: 6");

      // The lost deposited coins are moved to the reward account.
      coin.move(
          epoch.deposit_account,
          epoch.reward_account,
          coin.balanceOf(epoch.deposit_account).sub(deposit_to_reclaim));
    }

    // Mint coins to the reward account.
    coin.mint(epoch.reward_account, mint);

    // Set the total amount of the reward.  The reward is distributed to the
    // voters who voted for the "truth" level.
    epoch.reward_total = coin.balanceOf(epoch.reward_account);
    epoch.phase = Phase.RECLAIM;

    // Step 3: Move the reclaim phase to the commit phase.
    epoch = epochs_[(epoch_timestamp_.sub(2)).mod(3)];
    require(epoch.phase == Phase.RECLAIM,
            "advance: 7");

    uint burned = (coin.balanceOf(epoch.deposit_account))
                  .add(coin.balanceOf(epoch.reward_account));
    // Burn the deposited coins.
    coin.burn(epoch.deposit_account, coin.balanceOf(epoch.deposit_account));
    // Burn the remaining reward.
    coin.burn(epoch.reward_account, coin.balanceOf(epoch.reward_account));

    // Initialize the epoch for the next commit phase.
    //
    // The mapping cannot be erased due to the restriction of Solidity.
    // epoch.commits = {}
    for (uint level = 0; level < LEVEL_MAX; level++) {
      epoch.votes[level] = Vote(0, 0, false, false);
    }
    require(coin.balanceOf(epoch.deposit_account) == 0,
            "advance: 8");
    require(coin.balanceOf(epoch.reward_account) == 0,
            "advance: 9");
    epoch.reward_total = 0;
    epoch.phase = Phase.COMMIT;

    // Advance the phase.
    epoch_timestamp_ = epoch_timestamp_.add(1);

    emit AdvancePhaseEvent(epoch_timestamp_, mint, burned);
    return burned;
  }

  // Return the mode of the oracle levels weighted by the deposited coins
  // (i.e., what level got the most deposited coins).
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // If there are multiple modes, return the mode that has the largest votes.
  // If there are multiple modes that has the largest votes, return the
  // smallest mode. If there are no votes, return LEVEL_MAX.
  function getModeLevel()
      public onlyOwner view returns (uint) {
    Epoch storage epoch = epochs_[(epoch_timestamp_.sub(1)).mod(3)];
    require(epoch.phase == Phase.REVEAL,
            "getModeLevel: 1");
    uint mode_level = LEVEL_MAX;
    uint max_deposit = 0;
    uint max_count = 0;
    for (uint level = 0; level < LEVEL_MAX; level++) {
      if (epoch.votes[level].count > 0 &&
          (mode_level == LEVEL_MAX ||
           max_deposit < epoch.votes[level].deposit ||
           (max_deposit == epoch.votes[level].deposit &&
            max_count < epoch.votes[level].count))){
        max_deposit = epoch.votes[level].deposit;
        max_count = epoch.votes[level].count;
        mode_level = level;
      }
    }
    return mode_level;
  }

  function revokeOwnership(JohnLawCoin coin)
      public onlyOwner {
    coin.transferOwnership(msg.sender);
  }

  // Public getter: Return LEVEL_MAX.
  function getLevelMax()
      public view returns (uint) {
    return LEVEL_MAX;
  }

  
  // Public getter: Return the Vote struct at |epoch_index| and |level|.
  function getVote(uint epoch_index, uint level)
      public view returns (uint, uint, bool, bool) {
    require(0 <= epoch_index && epoch_index <= 2,
            "get_vote: 1");
    require(0 <= level && level < epochs_[epoch_index].votes.length,
            "get_vote: 2");
    Vote memory vote = epochs_[epoch_index].votes[level];
    return (vote.deposit, vote.count, vote.should_reclaim, vote.should_reward);
  }

  // Public getter: Return the Commit struct at |epoch_index| and |account|.
  function getCommit(uint epoch_index, address account)
      public view returns (bytes32, uint, uint, Phase, uint) {
    require(0 <= epoch_index && epoch_index <= 2,
            "get_commit: 1");
    Commit memory entry = epochs_[epoch_index].commits[account];
    return (entry.committed_hash, entry.deposit, entry.revealed_level,
            entry.phase, entry.epoch_timestamp);
  }

  // Public getter: Return the Epoch struct at |epoch_index|.
  function getEpoch(uint epoch_index)
      public view returns (address, address, uint, Phase) {
    require(0 <= epoch_index && epoch_index <= 2,
            "get_epoch: 1");
    return (epochs_[epoch_index].deposit_account,
            epochs_[epoch_index].reward_account,
            epochs_[epoch_index].reward_total,
            epochs_[epoch_index].phase);
  }
  
  // Calculate the commit hash.
  //
  // Parameters
  // ----------------
  // |sender|: The voter's account.
  // |level|: The oracle level to vote.
  // |salt|: The salt used for the vote.
  //
  // Returns
  // ----------------
  // The calculated hash value.
  function hash(address sender, uint level, uint salt)
      public pure returns (bytes32) {
    return keccak256(abi.encode(sender, level, salt));
  }
}

//------------------------------------------------------------------------------
// Algorithmic Central Bank (ACB)
//
// ACB stabilizes the coin price with fully algorithmically defined monetary
// policies without holding any collateral. At a high-level, ACB works as
// follows:
//
// 1. ACB obtains the exchange rate between the coins and USD from the oracle.
// 2. If the exchange rate is 1.0, ACB does nothing.
// 3. If the exchange rate is larger than 1.0, ACB increases the coin supply by
//    proactively redeeming issued bonds. If that is not enough to supply
//    sufficient coins, ACB mints new coins. The minted coins are used as the
//    reward in the oracle.
// 4. If the exchange rate is smaller than 1.0, ACB decreases the coin supply by
//    issuing bonds.
//
//------------------------------------------------------------------------------
contract ACB is OwnableUpgradeable, PausableUpgradeable {
  using SafeMath for uint;
  using SignedSafeMath for int;
  using SafeCast for uint;
  using SafeCast for int;

  // Constants. The values are defined in initialize(). The values never
  // change during the contract execution but use 'internal' (instead of
  // 'constant') because tests wants to override them.
  uint internal BOND_REDEMPTION_PRICE;
  uint internal BOND_REDEMPTION_PERIOD;
  uint[] internal LEVEL_TO_EXCHANGE_RATE;
  uint internal EXCHANGE_RATE_DIVISOR;
  uint[] internal LEVEL_TO_BOND_PRICE;
  uint internal PHASE_DURATION;
  uint internal DEPOSIT_RATE;
  uint internal DUMPING_FACTOR;
  uint internal INITIAL_COIN_SUPPLY;

  // Attributes. See the comment in initialize().
  JohnLawCoin public coin_;
  JohnLawBond public bond_;
  int public bond_budget_;
  Oracle public oracle_;
  uint public oracle_level_;
  uint public current_epoch_start_;

  // Events.
  event CreateAccountEvent(address indexed);
  event VoteEvent(address indexed, bytes32, uint, uint,
                  bool, bool, uint, bool);
  event PurchaseBondsEvent(address indexed, uint, uint);
  event RedeemBondsEvent(address indexed, uint[], uint);
  event ControlSupplyEvent(int, int, uint);

  //----------------------------------------------------------------------------
  // initialize(), pause() and unpause() are the only functions the genesis
  // account has the privilege to call. This is needed for the genesis account
  // to upgrade the smart contract and fix bugs until it is in good shape.
  // The genesis account has no control about monetary protocols of the ACB.
  //----------------------------------------------------------------------------
  
  // Initializer.
  //
  // Parameters
  // ----------------
  // |oracle|: The oracle. The ownership needs to be transferred to the ACB.
  function initialize(Oracle oracle)
      public initializer {
    __Ownable_init();
    __Pausable_init();

    // ----------------
    // Constants
    // ----------------

    // The following table shows the mapping from the oracle levels to the
    // exchange rates and the bond prices. Voters can vote for one of the oracle
    // levels.
    //
    //  -------------------------------------------------------------
    //  | oracle level | exchange rate    | bond price              |
    //  |              |                  | (annual interest rate)  |
    //  -------------------------------------------------------------
    //  | 0            | 1 coin = 0.7 USD | 970 coins (14.1%)       |
    //  | 1            | 1 coin = 0.8 USD | 980 coins (9.16%)       |
    //  | 2            | 1 coin = 0.9 USD | 990 coins (4.46%)       |
    //  | 3            | 1 coin = 1.0 USD | 997 coins (1.31%)       |
    //  | 4            | 1 coin = 1.1 USD | 997 coins (1.31%)       |
    //  | 5            | 1 coin = 1.2 USD | 997 coins (1.31%)       |
    //  | 6            | 1 coin = 1.3 USD | 997 coins (1.31%)       |
    //  -------------------------------------------------------------
    //
    // In the bootstrap phase in which no currency exchanger supports the coin
    // <=> USD conversions, voters are expected to vote for the oracle level 4
    // (i.e., 1 coin = 1.1 USD). This helps increase the total coin supply
    // gradually in the bootstrap phase and incentivize early adopters. Once
    // currency exchangers support the conversions, voters are expected to vote
    // for the oracle level that corresponds to the exchange rate determined by
    // the currency exchangers.
    //
    // LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
    // exchange rates. The real exchange rate is obtained by dividing the values
    // by EXCHANGE_RATE_DIVISOR. For example, 11 corresponds to the exchange
    // rate of 1.1. This translation is needed to avoid using decimal numbers in
    // the smart contract.
    LEVEL_TO_EXCHANGE_RATE = [7, 8, 9, 10, 11, 12, 13];
    EXCHANGE_RATE_DIVISOR = 10;

    // LEVEL_TO_EXCHANGE_RATE is the mapping from the oracle levels to the
    // bond prices
    LEVEL_TO_BOND_PRICE = [970, 980, 990, 997, 997, 997, 997];

    // The bond redemption price and the redemption period.
    BOND_REDEMPTION_PRICE = 1000; // A bond is redeemed at 1000 USD.
    BOND_REDEMPTION_PERIOD = 84 * 24 * 60 * 60; // 12 weeks.

    // The duration of the commit / reveal / reclaim phase.
    PHASE_DURATION = 7 * 24 * 60 * 60; // 1 week.

    // The percentage of the coin balance the voter needs to deposit.
    DEPOSIT_RATE = 10; // 10%.

    // To avoid supplying / burning too many coins to / from the system in
    // one epoch, ACB multiplies a dumping factor to the expected amount of
    // coins to be supplied or burned calculated by the Quantum Theory of
    // Money.
    DUMPING_FACTOR = 10; // 10%.

    // The initial coin supply given to the genesis account.
    // It is important to give a substantial amount of coins to the genesis
    // account so that the genesis account can have power to determine the
    // exchange rate until the ecosystem stabilizes. When real-world currency
    // exchangers start converting the coins with USD and the oracle gets
    // enough honest voters to agree on the real exchange rate consistently,
    // the genesis account can lose its power by decreasing its coin balance.
    // This mechanism is mandatory to stabilize the exchange rate and bootstrap
    // the ecosystem successfully.
    INITIAL_COIN_SUPPLY = 2100000; // 2.1 M USD

    // ----------------
    // Attributes
    // ----------------

    // JohnLawCoin.
    coin_ = new JohnLawCoin();
    
    // JohnLawBond.
    bond_ = new JohnLawBond();
    
    // If |bond_budget| is positive, it indicates the number of bonds ACM
    // wants to sell to decrease the total coin supply. If |bond_budget_| is
    // negative, it indicates the number of bonds ACB wants to redeem to
    // increase the total coin supply.
    bond_budget_ = 0;
    
    // The timestamp that started the current epoch.
    current_epoch_start_ = 0;

    // The oracle to determine the current exchange rate between the coins and
    // USD.
    oracle_ = oracle;

    // The current oracle level.
    oracle_level_ = oracle.getLevelMax();

    require(LEVEL_TO_EXCHANGE_RATE.length == oracle.getLevelMax(),
            "constructor: 1");
    require(LEVEL_TO_BOND_PRICE.length == oracle.getLevelMax(),
            "constructor: 2");
    
    // Mint the initial coins in the genesis account.
    coin_.mint(msg.sender, INITIAL_COIN_SUPPLY);
  }

  // Pause the ACB in emergency cases.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // None.
  function pause()
      public whenNotPaused onlyOwner {
    _pause();
    coin_.pause();
  }

  // Unpause the ACB.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // None.
  function unpause()
      public whenPaused onlyOwner {
    _unpause();
    coin_.unpause();
  }

  // Vote to the oracle. The user can vote to the commit phase of the current
  // epoch, the reveal phase of the previous epoch and the reclaim phase of
  // the previous of the previous epoch at the same time.
  //
  // Parameters
  // ----------------
  // |committed_hash|: Voted to the commit phase of the current epoch.
  // |revealed_level|: Voted to the reveal phase of the previous epoch.
  // |revealed_salt|: Voted to the reveal phase of the previous epoch.
  //
  // Returns
  // ----------------
  // Returns a tuple of four values.
  //  - First value (boolean): Whether the vote to the commit phase succeeded
  //    or not.
  //  - Second value (boolean): Whether the vote to the reveal phase succeeded
  //    or not.
  //  - Third value (int): The amount of coins reclaimed in the reclaim phase.
  //  - Fourth value (boolean): Whether this vote resulted in a oracle phase
  //    update.
  function vote(bytes32 committed_hash, uint revealed_level, uint revealed_salt)
      public whenNotPaused returns (bool, bool, uint, bool) {
    address sender = msg.sender;

    // Temporarily transfer the ownership of JohnLawCoin to the oracle.
    coin_.transferOwnership(address(oracle_));
    
    bool phase_updated = false;
    if (getTimestamp() >= current_epoch_start_.add(PHASE_DURATION)) {
      // Start a new epoch.
      phase_updated = true;
      current_epoch_start_ = getTimestamp();
      
      uint mint = 0;
      oracle_level_ = oracle_.getModeLevel();
      if (oracle_level_ != oracle_.getLevelMax()) {
        require(0 <= oracle_level_ && oracle_level_ < oracle_.getLevelMax(),
                "vote: 1");
        // Translate the mode level to the exchange rate.
        uint exchange_rate = LEVEL_TO_EXCHANGE_RATE[oracle_level_];

        // Calculate the amount of coins to be supplied or burned in the system
        // based on the Quantum Theory of Money. If the exchnage rate is 1.1
        // (i.e., 1 coin = 1.1 USD), the total coin supply is increased by 10%.
        // If the exchange rate is 0.8 (i.e., 1 coin = 0.8 USD), the total coin
        // supply is decreased by 20%.
        int delta =
            coin_.totalSupply().toInt256()
            .mul(int(exchange_rate)
                     .sub(int(EXCHANGE_RATE_DIVISOR)))
            .div(int(EXCHANGE_RATE_DIVISOR));

        // To avoid increasing or decreasing too many coins in one epoch,
        // multiply the damping factor.
        delta = delta.mul(int(DUMPING_FACTOR)).div(100);

        // Increase or decrease the total coin supply.
        mint = _controlSupply(delta);
      }

      // Advance to the next phase.
      oracle_.advance(coin_, mint);
    }

    // Commit.
    //
    // The voter needs to deposit some coins. The voter can reclaim the
    // deposited coins later if the voter voted for the levels close to
    // the "truth" level determined by the oracle.
    bool commit_result = oracle_.commit(
        coin_, sender, committed_hash,
        coin_.balanceOf(sender).mul(DEPOSIT_RATE).div(100));
    
    // Reveal.
    bool reveal_result = oracle_.reveal(sender, revealed_level, revealed_salt);
    
    // Reclaim.
    uint reclaim_amount = oracle_.reclaim(coin_, sender);

    // Revoke the ownership of JohnLawCoin from the oracle.
    oracle_.revokeOwnership(coin_);
    
    emit VoteEvent(sender, committed_hash, revealed_level, revealed_salt,
                   commit_result, reveal_result, reclaim_amount, phase_updated);
    return (commit_result, reveal_result, reclaim_amount, phase_updated);
  }

  // Purchase bonds.
  //
  // Parameters
  // ----------------
  // |count|: The number of bonds to purchase.
  //
  // Returns
  // ----------------
  // The redemption timestamp of the purchased bonds if it succeeds.
  // 0 otherwise.
  function purchase_bonds(uint count)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    if (count <= 0) {
      return 0;
    }
    if (bond_budget_ < count.toInt256()) {
      // ACB does not have enough bonds to sell.
      return 0;
    }

    uint bond_price = LEVEL_TO_BOND_PRICE[oracle_.getLevelMax() - 1];
    if (0 <= oracle_level_ && oracle_level_ < oracle_.getLevelMax()) {
      bond_price = LEVEL_TO_BOND_PRICE[oracle_level_];
    }
    uint amount = bond_price.mul(count);
    if (coin_.balanceOf(sender) < amount) {
      // The user does not have enough coins to purchase the bonds.
      return 0;
    }

    // From now on, the bonds are identified by their redemption timestamp.
    uint redemption = getTimestamp().add(BOND_REDEMPTION_PERIOD);

    // Issue new bonds
    bond_.mint(sender, redemption, count);
    bond_budget_ = bond_budget_.sub(count.toInt256());
    require(bond_budget_ >= 0,
            "purchase_bonds: 2");
    require((bond_.totalSupply().toInt256()).add(bond_budget_) >= 0,
            "purchase_bonds: 3");
    require(bond_.balanceOf(sender, redemption) > 0,
            "purchase_bonds: 4");

    // Burn the corresponding coins.
    coin_.burn(sender, amount);

    emit PurchaseBondsEvent(sender, count, redemption);
    return redemption;
  }
  
  // Redeem bonds.
  //
  // If there is any error in the specified parameters, no bonds are redeemed.
  //
  // Parameters
  // ----------------
  // |redemptions|: The list of bonds the user wants to redeem. Bonds are
  // identified by their redemption timestamps.
  //
  // Returns
  // ----------------
  // The number of successfully redeemed bonds.
  function redeem_bonds(uint[] memory redemptions)
      public whenNotPaused returns (uint) {
    address sender = msg.sender;
    
    uint count_total = 0;
    for (uint i = 0; i < redemptions.length; i++) {
      uint redemption = redemptions[i];
      uint count = bond_.balanceOf(sender, redemption);
      if (redemption > getTimestamp()) {
        // If the bonds have not yet hit their redemption timestamp, ACB
        // accepts the redemption as long as |bond_budget_| is negative.
        if (bond_budget_ >= 0) {
          continue;
        }
        if (count > (-bond_budget_).toUint256()) {
          count = (-bond_budget_).toUint256();
        }
      }

      bond_budget_ = bond_budget_.add(count.toInt256());
      count_total = count_total.add(count);

      // Mint the corresponding coins to the user's balance.
      uint amount = count.mul(BOND_REDEMPTION_PRICE);
      coin_.mint(sender, amount);

      // Burn the redeemded bonds.
      bond_.burn(sender, redemption, count);
    }
    require((bond_.totalSupply().toInt256()).add(bond_budget_) >= 0,
            "redeem_bonds: 4");
    emit RedeemBondsEvent(sender, redemptions, count_total);
    return count_total;
  }

  // Increase or decrease the total coin supply.
  //
  // Parameters
  // ----------------
  // |delta|: If |delta| is positive, it indicates the amount of coins to be
  // supplied. If |delta| is negative, it indicates the amount of coins to be
  // burned.
  //
  // Returns
  // ----------------
  // The amount of coins that need to be newly minted by ACB.
  function _controlSupply(int delta)
      internal whenNotPaused returns (uint) {
    uint mint = 0;
    if (delta == 0) {
      // No change in the total coin supply.
      bond_budget_ = 0;
    } else if (delta > 0) {
      // Increase the total coin supply.
      uint count = delta.toUint256().div(BOND_REDEMPTION_PRICE);
      if (count <= bond_.totalSupply()) {
        // If there are sufficient bonds to redeem, increase the coin supply
        // by redeeming bonds.
        bond_budget_ = -count.toInt256();
      } else {
        // Otherwise, ACB needs to mint coins.
        bond_budget_ = -bond_.totalSupply().toInt256();
        mint = (count.sub(bond_.totalSupply())).mul(BOND_REDEMPTION_PRICE);
      }
      require(bond_budget_ <= 0, "_controlSupply: 1");
    } else {
      require(0 <= oracle_level_ && oracle_level_ < oracle_.getLevelMax(),
              "_controlSupply: 2");
      // Decrease the total coin supply. Issue new bonds to decrease the coin
      // supply.
      bond_budget_ = -delta.div(LEVEL_TO_BOND_PRICE[oracle_level_].toInt256());
      require(bond_budget_ >= 0, "_controlSupply: 3");
    }

    require((bond_.totalSupply().toInt256()).add(bond_budget_) >= 0,
            "_controlSupply: 4");
    emit ControlSupplyEvent(delta, bond_budget_, mint);
    return mint;
  }

  // Calculate the commit hash.
  //
  // Parameters
  // ----------------
  // |level|: The oracle level to vote.
  // |salt|: The salt used for the vote.
  //
  // Returns
  // ----------------
  // The calculated hash value.
  function hash(uint level, uint salt)
      public view returns (bytes32) {
    address sender = msg.sender;
    return oracle_.hash(sender, level, salt);
  }
  
  // Return the current timestamp in seconds.
  //
  // Parameters
  // ----------------
  // None.
  //
  // Returns
  // ----------------
  // The current timestamp in seconds.
  function getTimestamp()
      public virtual view returns (uint) {
    return block.timestamp;
  }

}
