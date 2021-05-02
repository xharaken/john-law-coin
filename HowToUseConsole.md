# Overview

This page explains how to connect to the smart contracts directly using `truffle console`. The page assumes you have installed [Truffle](https://www.trufflesuite.com/truffle) and understand the basics of `truffle console`.

APIs exposed by JohnLawCoin are simple. You can only do the following operations:

* Transfer coins.
* Vote on the oracle.
* Purchase and redeem bonds.

The [JohnLawCoin wallet](https://xharaken.github.io/john-law-coin/wallet/wallet.html) is implemented using JohnLawCoin's APIs. You can implement an even nicer wallet using the APIs :)

# Transfer coins

The JohnLawCoin contract is implemented as [ERC20 tokens](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/). You can store and transfer coins using ERC20-compatible wallets. Or you can directly use the ERC20 token APIs:

```
truffle> acb = await ACB.at(<<the address of the ACB contract>>)  # Get the ACB contract.
truffle> coin = await JohnLawCoin.at(await acb.coin_())  # Get the JohnLawCoin contract.
truffle> (await coin.balanceOf(<<your address>>)).toNumber()  # Print your coin balance.
120
truffle> await coin.transfer(<<your friend address>>, 20)  # Send 20 coins to your friend.
truffle> (await coin.balanceOf(<<your address>>)).toNumber()  # Print your coin balance.
100
```

# Vote on the oracle

The ACB adjusts the total coin supply every phase based on the exchange rate obtained from the oracle. The oracle is a fully decentralized mechanism to agree on the exchange rate. The phase duration is set to one week.

You can vote on the exchange rate using `vote()`. `vote()` does the following three things:

1. Vote on the exchange rate in the current phase. 10% of your coin balance is deposited to the oracle.
1. Reveal the vote in the previous phase.
1. Reclaim the deposited coins and get a reward for the vote in the phase before the previous phase.

You can call `vote()` only once a phase. You are expected to look up the current exchange rate using real-world currency exchangers and vote for the oracle level that corresponds to the exchange rate. If no currency exchanger is available (this is the case in a bootstrap phase), you are expected to vote for the oracle level 5.

|  exchange rate  |  oracle level  |
| ---: | ---: |
|  1 coin = 0.6 USD  |  0  |
|  1 coin = 0.7 USD  |  1  |
|  1 coin = 0.8 USD  |  2  |
|  1 coin = 0.9 USD  |  3  |
|  1 coin = 1.0 USD  |  4  |
|  1 coin = 1.1 USD  |  5  |
|  1 coin = 1.2 USD  |  6  |
|  1 coin = 1.3 USD  |  7  |
|  1 coin = 1.4 USD  |  8  |

Strictly speaking, the current exchange rate is defined as the exchange rate at the point when the current phase started. You can get the timestamp by calling `acb.current_phase_start_()`:

```
truffle> (await acb.current_phase_start_()).toNumber()
1612274145
```

Once you get the oracle level to vote, you need to create a hash of it. You can create a hash as follows:

```
truffle> hash = await acb.hash(5, 1234)  # Create a hash for the oracle level 5.
```

The first parameter is the oracle level. The second parameter is a salt to protect your vote. You must keep the salt secret until you reveal it in the next phase. You must use different salts every time.

Now you call `vote()` with the hash. 10% of your coin balance is deposited to the oracle:

```
truffle> tx = await acb.vote(hash, 4, 1111)  # Vote on the oracle
```

The first parameter is the hash to be voted in the current phase. The second parameter is the oracle level you voted for in the previous phase. The third parameter is the salt you used in the previous phase. The second parameter and the third parameter reveal the vote in the previous phase. If the reveal is done correctly, the deposited coins are returned to your wallet and you can get a reward in the next phase.

You can look at the transaction receipt:

```
truffle> tx.receipt.logs.filter(e => e.event == 'VoteEvent')[0].args
Result {
__length__: 10,
  sender: '0xe158C06AB0BeD2E7D99891ADC9Db91349737cA92',  # Your account address.
  committed_hash: '0x92f0d76c0188b69a563de1710a620c858e30b589ac77d0cfded2155c21d2a83e',  # The hash you committed.
  revealed_level: BN {
    negative: 0,
    words: [ 5, <1 empty item> ],  # The oracle level you revealed.
    length: 1,
    red: null
  },
  revealed_salt: BN {
    negative: 0,
    words: [ 1234, <1 empty item> ],  # The salt you revealed.
    length: 1,
    red: null
  },
  commit_result: true,
  reveal_result: true,
  deposited: BN {
    negative: 0,
    words: [ 170098, <1 empty item> ],  # The coins deposited to the oracle.
    length: 1,
    red: null
  },
  reclaimed: BN {
    negative: 0,
    words: [ 209998, <1 empty item> ],  # The coins returned from the oracle. These are the coins you deposited in the phase before the previous phase.
    length: 1,
    red: null
  },
  rewarded: BN {
    negative: 0,
    words: [ 21000, <1 empty item> ],  # The reward you obtained.
    length: 1,
    red: null
  },
  phase_updated: true
}
```

# Purchase and redeem bonds

The ACB decreases the total coin supply by issuing bonds when the oracle level is 3 or below. The ACB increases the total coin supply by redeeming bonds (and minting a reward to the oracle if redeeming the issued bonds is not enough to supply necessary coins) when the oracle level is 5 or above.

You can query the ACB's bond budget as follows:

```
truffle> (await acb.bond_budget_()).toNumber()
21  # The ACB can issue 21 bonds.
```

If the ACB's bond budget is positive, it indicates the number of bonds the ACB can issue. You can purchase the bonds as follows:

```
truffle> tx = await acb.purchaseBonds(2)  # Purchase 2 bonds.
truffle> tx.receipt.logs.filter(e => e.event == "PurchaseBondsEvent")[0].args
Result {
  __length__: 3,
  sender: '0xe158C06AB0BeD2E7D99891ADC9Db91349737cA92',
  count: BN {
    negative: 0,
    words: [ 2, <1 empty item> ],  # The number of bonds you purchased.
    length: 1,
    red: null
  },
  redemption_timestamp: BN {
    negative: 0,
    words: [ 15485453, 24, <1 empty item> ],  # The redemption timestamp of the purchased bonds. This corresponds to 1626098189 (see below).
    length: 2,
    red: null
  }
}
truffle> tx.receipt.logs.filter(e => e.event == "PurchaseBondsEvent")[0].args[2].toNumber()
1626098189
truffle> (await acb.bond_budget_()).toNumber()
19  # The ACB's bond budget decreased by 2.
```

The parameter of `purchaseBonds()` is the number of bonds you want to purchase. `purchaseBonds()` returns the redemption timestamp of the bonds you purchased. As a result, your coin balance decreases. Remember that the bond issue price varies depending on the oracle levels (to reflect the risk of holding bonds).

You can query the bonds you own:

```
truffle> bond = await JohnLawBond.at(await acb.bond_()) # Get the JohnLawBond contract.
truffle> (await bond.balanceOf(<<your address>>, 1626098189)).toNumber()
2  # You have 2 bonds whose redemption timestamp is 1626098189.
truffle> (await acb.getTimestamp()).toNumber() # Print the current timestamp.
1618840589  # This means that your bonds are not yet redeemable.
```

You can iterate the redemption timestamps of all the bonds you own:

```
truffle> address = <<your address>>
truffle> acb.purchaseBonds(10)  # Purchase 10 more bonds
truffle> (await bond.numberOfRedemptionTimestampsOwnedBy(address)).toNumber()
2
truffle> (await bond.getRedemptionTimestampOwnedBy(address, 0)).toNumber()  # Index 0
1626098189
truffle> (await bond.balanceOf(address, 1626098189)).toNumber()
2  # You have 2 bonds whose redemption timestamp is 1626098189.
truffle> (await bond.getRedemptionTimestampOwnedBy(address, 1)).toNumber()  # Index 1
1626098437
truffle> (await bond.balanceOf(address, 1626098437)).toNumber()
10  # You have 10 bonds whose redemption timestamp is 1626098437.
```

If the ACB's bond budget is negative, it indicates the number of bonds the ACB can redeem regardless of their redemption timestamps (so you are incentivized to redeem as many bonds as possible when the ACB's bond budget is negative). You can redeem your bonds as follows:

```
truffle> (await acb.bond_budget_()).toNumber()
-14  # The ACB can redeem 14 bonds.
truffle> tx = await acb.redeemBonds([1626098189, 1626098437])  # Redeem bonds whose timestamps are 1626098189 and 1626098437.
truffle> tx.receipt.logs.filter(e => e.event == "RedeemBondsEvent")[0].args
Result {
  __length__: 2,
  sender: '0xe158C06AB0BeD2E7D99891ADC9Db91349737cA92',
  count: BN {
    negative: 0,
    words: [ 12, <1 empty item> ],  # 2 + 10 = 12 bonds are redeemed.
    length: 1,
    red: null
  }
}
truffle> (await acb.bond_budget_()).toNumber()
-2  # The ACB's bond budget increased by 12.
```

The parameter of `redeemBonds()` is a list of redemption timestamps of the bonds you want to redeem. `redeemBonds()` returns the total number of bonds that have been successfully redeemded. As a result of redeeming, your coin balance increases. One bond is redeemed for 1000 coins. Remember that you can redeem bonds that passed their redemption timestamp anytime regardless of the ACB's bond budget.

For more details, see the comments in [the smart contract](./contracts/JohnLawCoin.sol).

