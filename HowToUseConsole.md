# Overview

This page explains how to connect to the smart contracts directly using `truffle console`. The page assumes you have installed [Truffle](https://www.trufflesuite.com/truffle) and understand the basics of `truffle console`.

The APIs exposed by JohnLawCoin are simple. You can only do the following operations:

* Transfer coins.
* Vote on the oracle.
* Purchase and sell coins.
* Purchase and redeem bonds.

The JohnLawCoin wallet is implemented on top of the APIs. If you want to implement an even nicer wallet, why not? :)

# Transfer coins

The JohnLawCoin contract is implemented as [ERC20 tokens](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/). You can transfer coins using ERC20-compatible wallets. Or you can directly use the ERC20 token APIs:

```
truffle> acb = await ACB.at(<<the address of the ACB contract>>)  # Get the ACB contract.
truffle> coin = await JohnLawCoin.at(await acb.coin_())  # Get the JohnLawCoin contract.
truffle> (await coin.balanceOf(<<your address>>)).toNumber()  # Print your coin balance.
120
truffle> await coin.transfer(<<your friend address>>, 100)  # Send 100 coins to your friend.
truffle> (await coin.balanceOf(<<your address>>)).toNumber()  # Print your coin balance.
20
```

Note that 1% of the transferred coins is collected as a tax.

# Vote on the oracle

The ACB adjusts the total coin supply every epoch based on the exchange rate obtained from the oracle. The oracle is a fully decentralized mechanism to agree on the exchange rate.

You can vote for the exchange rate using `vote()`. `vote()` does the following three things:

1. Vote for the exchange rate in the current epoch N. 10% of your coin balance is deposited to the oracle.
1. Reveal your vote in the epoch N-1.
1. Reclaim the deposited coins and get a reward for your vote in the epoch N-2.

You can call `vote()` only once an epoch. The epoch duration is set to one week. You are expected to look up the current exchange rate using real-world currency exchangers and vote for the oracle level that is the closest to the exchange rate. If no currency exchanger is available (this is the case in a bootstrap phase), you should vote for the oracle level 5.

| oracle level | exchange rate |
| ---: | ---: |
| 0 | 1 coin = 0.6 USD |
| 1 | 1 coin = 0.7 USD |
| 2 | 1 coin = 0.8 USD |
| 3 | 1 coin = 0.9 USD |
| 4 | 1 coin = 1.0 USD |
| 5 | 1 coin = 1.1 USD |
| 6 | 1 coin = 1.2 USD |
| 7 | 1 coin = 1.3 USD |
| 8 | 1 coin = 1.4 USD |

Strictly speaking, the current exchange rate is defined as the exchange rate at the point when the current epoch started. You can get the timestamp by calling `acb.current_epoch_start_()`:

```
truffle> (await acb.current_epoch_start_()).toNumber()
1612274145
```

Once you get the oracle level to vote, you need to create a hash of it:

```
truffle> hash = await acb.encrypt(5, 1234)  # Create a hash for the oracle level 5.
```

The first parameter is the oracle level. The second parameter is a salt number (256 bit) to protect your vote. You must keep the salt number secret until you reveal it in the next epoch. You must use different salt numbers every time.

Now you can call `vote()` with the hash. 10% of your coin balance is deposited to the oracle:

```
truffle> tx = await acb.vote(hash, 4, 1111)  # Vote on the oracle
```

The first parameter is the hash to be voted in the current epoch N. The second parameter is the oracle level you voted for in the epoch N-1. The third parameter is the salt number you used in the epoch N-1. The second parameter and the third parameter reveal your vote in the epoch N-1.

You can confirm the transaction in the receipt:

```
truffle> tx.receipt.logs.filter(e => e.event == 'VoteEvent')[0].args
Result {
__length__: 10,
  sender: '0xe158C06AB0BeD2E7D99891ADC9Db91349737cA92',  # Your account address.
  committed_hash: '0x92f0d76c0188b69a563de1710a620c858e30b589ac77d0cfded2155c21d2a83e',  # The hash you committed.
  revealed_level: BN {
    negative: 0,
    words: [ 4, <1 empty item> ],  # The oracle level you revealed.
    length: 1,
    red: null
  },
  revealed_salt: BN {
    negative: 0,
    words: [ 1111, <1 empty item> ],  # The salt number you revealed.
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
    words: [ 209998, <1 empty item> ],  # The coins reclaimed from the oracle.
    length: 1,
    red: null
  },
  rewarded: BN {
    negative: 0,
    words: [ 21000, <1 empty item> ],  # The reward you obtained.
    length: 1,
    red: null
  },
  epoch_updated: true
}
```

# Purchase and sell coins

The ACB implements an open market operation. It increases the total coin supply by selling JLC and purchasing ETH when the oracle level is 5 or above. It decreases the total coin supply by selling ETH and purchasing JLC when the oracle level is 0. The coin budget is controlled by the OpenMarketOperation contract. You can query the coin budget as follows:

```
truffle> open_market_operation = await OpenMarketOperation.at(await acb.open_market_operation_())  # Get the OpenMarketOperation contract.
truffle> (await open_market_operation.coin_budget_()).toNumber()
275000  # The OpenMarketOperation can sell 275000 JLC coins.
```

If the coin budget is positive, it indicates the amount of JLC the OpenMarketOperation can sell. The price (JLC / ETH) is lowered until the coin budget goes down to zero. You can query the current price as follows:

```
truffle> current_epoch_start = (await acb.current_epoch_start_()).toNumber()
truffle> elapsed_time = parseInt(Date.now() / 1000) - current_epoch_start
truffle> (await open_market_operation.getCurrentPrice(elapsed_time)).toNumber()
1129  # 1 JLC = 1129 ETH wei.
```

You can purchase JLC as follows:

```
truffle> coin = await JohnLawCoin.at(await acb.coin_())
truffle> (await coin.balanceOf(<<your address>>)).toNumber()
1700  # Your coin balance.
truffle> tx = await acb.purchaseCoins({value: 2258})  # Pay 2258 ETH wei.
truffle> tx.receipt.logs.filter(e => e.event == "PurchaseCoinsEvent")[0].args
Result {
  ...
  eth_amount: BN {
    negative: 0,
    words: [ 2258, <1 empty item> ],  # You paid 2258 ETH wei.
    length: 1,
    red: null
  },
  coin_amount: BN {
    negative: 0,
    words: [ 2, <1 empty item> ],  # You got 2 JLC coins.
    length: 1,
    red: null
  }
}
truffle> (await open_market_operation.coin_budget_()).toNumber()
274998  # The coin budget decreased by 2.
truffle> (await coin.balanceOf(<<your address>>)).toNumber()
1702  # Your coin balance increased by 2.
```

You need to call `purchaseCoins()` with some ETH. The OpenMarketOperation purchases the ETH and sells JLC at the current price. If the OpenMarketOperation does not have enough JLC to sell, the remaining ETH is returned to your wallet.

If the coin budget is negative, it indicates the amount of JLC the OpenMarketOperation can purchase.

You can sell JLC as follows:

```
truffle> (await open_market_operation.coin_budget_()).toNumber()
-275112  # The OpenMarketOperation can purchase 275112 JLC coins.
truffle> (await coin.balanceOf(<<your address>>)).toNumber()
1702  # Your coin balance.
truffle> tx = await acb.sellCoins(2)  # Sell 2 coins.
truffle> tx.receipt.logs.filter(e => e.event == "SellCoinsEvent")[0].args
Result {
  ...
  eth_amount: BN {
    negative: 0,
    words: [ 2540, <1 empty item> ],  # You got 2540 ETH wei.
    length: 1,
    red: null
  },
  coin_amount: BN {
    negative: 0,
    words: [ 2, <1 empty item> ],  # You paid 2 JLC coins.
    length: 1,
    red: null
  }
}
truffle> (await open_market_operation.coin_budget_()).toNumber()
-275110  # The coin budget increased by 2.
truffle> (await coin.balanceOf(<<your address>>)).toNumber()
1704  # Your coin balance decreased by 2.
```

The parameter of `sellCoins()` is the amount of JLC coins you pay. The OpenMarketOperation purchases the JLC and sells ETH at the current price. If the OpenMarketOperation does not have enough ETH to sell, the remaining JLC is returned to your wallet.

You can query the balance of the ETH pool as follows:

```
truffle> web3.eth.getBalance(open_market_operation.address)
28540000000000
```

# Purchase and redeem bonds

The ACB decreases the total coin supply by issuing bonds when the oracle level is 3 or below. The ACB increases the total coin supply by redeeming bonds when the oracle level is 5 or above. The bond budget is controlled by the BondOperation contract. You can query the bond budget as follows:

```
truffle> bond_operation = await BondOperation.at(await acb.bond_operation_())  # Get the BondOperation contract.
truffle> (await bond_operation.bond_budget_()).toNumber()
21  # The ACB can issue 21 bonds.
```

If the bond budget is positive, it indicates the number of bonds the ACB can issue. You can purchase the bonds as follows:

```
truffle> tx = await acb.purchaseBonds(2)  # Purchase 2 bonds.
truffle> tx.receipt.logs.filter(e => e.event == "PurchaseBondsEvent")[0].args
Result {
  ...
  purchased_bonds: BN {
    negative: 0,
    words: [ 2, <1 empty item> ],  # Purchased 2 bonds.
    length: 1,
    red: null
  },
  redemption_epoch: BN {
    negative: 0,
    words: [ 18, <1 empty item> ],  # The bonds become redeemable at epoch 18.
    length: 1,
    red: null
  }
}
truffle> (await bond_operation.bond_budget_()).toNumber()
19  # The bond budget decreased by 2.
```

The parameter of `purchaseBonds()` is the number of bonds you want to purchase. `purchaseBonds()` returns the redemption epoch of the bonds you purchased. As a result, your coin balance decreases.

You can query the bonds you own:

```
truffle> bond = await JohnLawBond.at(await bond_operation.bond_()) # Get the JohnLawBond contract.
truffle> (await bond.balanceOf(<<your address>>, 18)).toNumber()
2  # You have 2 bonds that become redeemable at epoch 18.
```

You can iterate the redemption epochs of the bonds you own:

```
truffle> address = <<your address>>
truffle> await acb.purchaseBonds(10)  # Purchase 10 more bonds
truffle> (await bond.numberOfRedemptionEpochsOwnedBy(address)).toNumber()
2
truffle> (await bond.getRedemptionEpochOwnedBy(address, 0)).toNumber()  # Index 0
18
truffle> (await bond.balanceOf(address, 18)).toNumber()
2  # You have 2 bonds that become redeemable at epoch 18.
truffle> (await bond.getRedemptionEpochOwnedBy(address, 1)).toNumber()  # Index 1
19
truffle> (await bond.balanceOf(address, 19)).toNumber()
10  # You have 10 bonds that become redeemable at epoch 18.
```

If the bond budget is negative, it indicates the number of bonds the ACB can redeem regardless of their redemption epochs (so you are incentivized to redeem as many bonds as possible when the bond budget is negative). You can redeem your bonds as follows:

```
truffle> (await bond_operation.bond_budget_()).toNumber()
-14  # The ACB can redeem 14 bonds.
truffle> tx = await acb.redeemBonds([18, 19])  # Redeem the bonds you own.
truffle> tx.receipt.logs.filter(e => e.event == "RedeemBondsEvent")[0].args
Result {
  ...
  redeemed_bonds: BN {
    negative: 0,
    words: [ 12, <1 empty item> ],  # 2 + 10 = 12 bonds are redeemed.
    length: 1,
    red: null
  },
  expired_bonds: BN {
    negative: 0,
    words: [ 0, <1 empty item> ],  # No bonds are expired.
    length: 1,
    red: null
  }
}
truffle> (await bond_operation.bond_budget_()).toNumber()
-2  # The bond budget increased by 12.
```

The parameter of `redeemBonds()` is an array of redemption epochs of the bonds you want to redeem. `redeemBonds()` returns the total number of bonds that have been successfully redeemed. As a result of redeeming, your coin balance increases. Note that bonds are expired 2 epochs after their redemption epochs.

For more details, see the comments in [the smart contract](https://github.com/xharaken/john-law-coin/blob/main/contracts/JohnLawCoin.sol).

