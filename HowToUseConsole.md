# Overview

This page explains how to connect to the smart contracts directly using `truffle console`. The page assumes you have installed [Truffle](https://www.trufflesuite.com/truffle) and understand the basics of `truffle console`.

APIs exposed by JohnLawCoin are simple. You can only do the following operations:

* [A] Store and transfer coins.
* [B] Vote on the oracle.
* [C] Purchase and redeem bonds.

This means that you have only three ways to get coins; [A] get the coins from someone else (e.g., currency exchanger), [B] contribute to the oracle and get a reward, and [C] get an interest rate by holding bonds. Let's take a look at the three operations one by one.

# [A] Store and transfer coins

The JohnLawCoin contract is implemented as [ERC20 tokens](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/). You can store and transfer your coins using ERC20-compatible wallets or directly using ERC20 token APIs:

```bash
truffle> acb = await ACB.at(<<the address of the ACB contract>>)  # Get the ACB contract.
truffle> coin = await JohnLawCoin.at(await acb.coin_())  # Get the JohnLawCoin contract.
truffle> (await coin.balanceOf(<<your address>>)).toNumber()  # Print your coin balance.
120
truffle> await coin.transfer(<<your friend address>>, 20)  # Send 20 coins to your friend.
truffle> (await coin.balanceOf(<<your address>>)).toNumber()  # Print your coin balance.
100
```

# [B] Vote on the oracle

The ACB adjusts the total coin supply every week based on the exchange rate obtained from the oracle. The oracle is a fully decentralized mechanism to agree on the exchange rate of that week.

You can vote on the exchange rate using `vote()`. `vote()` does the following three things:

1. Vote on this week's exchange rate.
1. Reveal the last week's vote.
1. Get a reward for the vote of the week before last.

You can call `vote()` only once a week. You are expected to look up the current exchange rate using real-world currency exchangers and vote for the oracle level that corresponds to the exchange rate.

|  exchange rate  |  oracle level  |
| ---- | ---- |
|  1 coin = 0.6 USD  |  0  |
|  1 coin = 0.7 USD  |  1  |
|  1 coin = 0.8 USD  |  2  |
|  1 coin = 0.9 USD  |  3  |
|  1 coin = 1.0 USD  |  4  |
|  1 coin = 1.1 USD  |  5  |
|  1 coin = 1.2 USD  |  6  |
|  1 coin = 1.3 USD  |  7  |
|  1 coin = 1.4 USD  |  8  |

Strictly speaking, the current exchange rate means the exchange rate at the point when the current week started. You can get the timestamp by calling `acb.current_phase_start_()`:

```bash
truffle> (await acb.current_phase_start_()).toNumber()
1612274145
```

If no currency exchangers exist (this is the case in a bootstrap phase), you are expected to vote for the oracle level 5. This rule is described in [the smart contract](./contracts/JohnLawCoin.sol).
 
Once you get the oracle level to vote, you need to create a hash of it. If you want to vote for the oracle level 5, you can create a hash as follows:

```bash
truffle> hash = await acb.hash(5, 1234)
```

The first parameter is the oracle level. The second parameter is a salt to keep your vote secret. You must keep the salt secret until you reveal it next week. You must use different salts every time.

Then you call `vote()` with the hash:

```bash
truffle> tx = await acb.vote(hash, 4, 1111)  # Vote on the oracle
```

The first parameter is the hash to be voted this week. The second parameter is the oracle level you used last week. The third parameter is the salt you used last week. The second parameter and the third parameter reveal the last week's vote. If the reveal is done correctly, you can get a reward for the last week's vote when you call `vote()` next week.

Let's look at the transaction receipt:

```bash
truffle> tx.receipt.logs.filter(e => e.event == 'VoteEvent')[0].args
Result {
  '0': '0x089062a669c3cCcC24D1AF1992E5Bd65A094d582',
  '1': '0xb608c1664f884225bff5f2abd2ca04def766ab39a8c9499d2374ea00767554b8',
  '2': BN {
    negative: 0,
    words: [ 4, <1 empty item> ],
    length: 1,
    red: null
  },
  '3': BN {
    negative: 0,
    words: [ 1111, <1 empty item> ],
    length: 1,
    red: null
  },
  '4': true,  # Whether this week's vote succeeded or not.
  '5': true,  # Whether the reveal of the last week's vote succeeded or not.
  '6': BN {
    negative: 0,
    words: [ 25710, <1 empty item> ],  # The reward for the vote of the week before last + the coins you deposited the week before last.
    length: 1,
    red: null
  },
  '7': true,
  __length__: 8
}

```

As a result, your coin balance increases by 25710 coins:

```bash
truffle> (await coin.balanceOf(<<your address>>)).toNumber()
25810
```

Remember that you can get the reward only when you voted for the "truth" oracle level (that got the largest votes weighted by the voter's coin balance). Also, remember that 10% of your coin balance is deposited to the oracle when you voted. The deposited coins are returned to your coin balance only when you voted for the "truth" oracle level or its surroundings (e.g., if the "truth" oracle level is 5, voters who voted for 4, 5 and 6 can reclaim their deposited coins; other voters lose their deposited coins). Therefore, you are incentivized to vote for the "truth" oracle level.

# [C] Purchase and redeem bonds

The ACB decreases the total coin supply by issuing bonds when the oracle level is 3 or below. The ACB increases the total coin supply by redeeming bonds (and providing a reward to the oracle if redeeming bonds is not enough to supply necessary coins) when the oracle level is 5 or above.

You can query the ACB's bond budget as follows:

```bash
truffle> (await acb.bond_budget_()).toNumber()
21  # The ACB can issue 21 bonds.
```

If the ACB's bond budget is positive, it indicates the number of bonds the ACB can issue. You can purchase the bonds as follows:

```bash
truffle> tx = await acb.purchaseBonds(2)  # Purchase 2 bonds.
truffle> tx.receipt.logs.filter(e => e.event == "PurchaseBondsEvent")[0].args
Result {
  '0': '0x9916C69697d8a61D9597bCdBCa6B3470aaB09eDF',
  '1': BN {
    negative: 0,
    words: [ 2, <1 empty item> ],
    length: 1,
    red: null
  },
  '2': BN {
    negative: 0,
    words: [ 8913530, 24, <1 empty item> ],  # The redemption timestamp of the bonds you purchased. This corresponds to 1619526266 (see below).
    length: 2,
    red: null
  },
  __length__: 3
}
truffle> tx.receipt.logs.filter(e => e.event == "PurchaseBondsEvent")[0].args[2].toNumber()
1619526266
truffle> (await acb.bond_budget_()).toNumber()
19  # The ACB's bond budget decreased by 2.
```

The parameter of `purchaseBonds()` is the number of bonds you want to purchase. `purchaseBonds()` returns the redemption timestamp of the bonds you purchased. As a result, your coin balance decreases. As described in [the smart contract](./contracts/JohnLawCoin.sol), the bond issue price changes depending on the current oracle level (to reflect the risk of holding bonds).

You can query the bonds you own:

```bash
truffle> bond = await JohnLawBond.at(await acb.bond_()) # Get the JohnLawBond contract.
truffle> (await bond.balanceOf(<<your address>>, 1619526266)).toNumber()
2  # You have 2 bonds whose redemption timestamp is 1619526266.
truffle> (await acb.getTimestamp()).toNumber() # Print the current timestamp.
1612268666  # This means that your bonds are not yet redeemable.
```

You can iterate the redemption timestamps of all the bonds you own:

```bash
truffle> acb.purchaseBonds(10)  # Purchase 10 more bonds
truffle> await bond.numberOfRedemptionTimestampsOwnedBy(<<your address>>)).toNumber()
2
truffle> (await bond.getRedemptionTimestampOwnedBy(<<your address>>, 0)).toNumber()  # Index 0
1619526266
truffle> (await bond.balanceOf(<<your address>>, 1619526266)).toNumber()
2  # You have 2 bonds whose redemption timestamp is 1619526266.
truffle> (await bond.getRedemptionTimestampOwnedBy(<<your address>>, 1)).toNumber()  # Index 1
1619528123
truffle> (await bond.balanceOf(<<your address>>, 1619528123)).toNumber()
10  # You have 10 bonds whose redemption timestamp is 1619528123.
```

If the ACB's bond budget is negative, it indicates the number of bonds the ACB can redeem regardless of their redemption timestamps (so you are incentivized to redeem as many bonds as possible when the ACB's bond budget is negative). You can redeem your bonds as follows:

```bash
truffle> (await acb.bond_budget_()).toNumber()
-14  # The ACB can redeem 14 bonds.
truffle> tx = await acb.redeemBonds([1619526266, 1619528123])  # Redeem bonds whose timestamps are 1619526266 or 1619528123.
truffle> tx.receipt.logs.filter(e => e.event == "RedeemBondsEvent")[
0].args
Result {
  '0': '0x9916C69697d8a61D9597bCdBCa6B3470aaB09eDF',
  '1': [
    BN { negative: 0, words: [Array], length: 2, red: null },
    BN { negative: 0, words: [Array], length: 2, red: null }
  ],
  '2': BN {
    negative: 0,
    words: [ 12, <1 empty item> ],  # 2 + 10 = 12 bonds are redeemed.
    length: 1,
    red: null
  },
  __length__: 3
}
truffle> (await acb.bond_budget_()).toNumber()
-2  # The ACB's bond budget increased by 12.
```

The parameter of `redeemBonds()` is a list of redemption timestamps of the bonds you want to redeem. `redeemBonds()` returns the total number of bonds that were successfully redeemded. As a result of redeeming, your coin balance increases. One bond is redeemed for 1000 coins (regardless of the redemption timestamps).

Note that you can redeem bonds that passed their redemption timestamp anytime regardless of the ACB's bond budget. You can redeem bonds that have not yet hit their redemption timestamp only when the ACB's bond budget is negative.

For more details, see comments in [the smart contract](./contracts/JohnLawCoin.sol).

