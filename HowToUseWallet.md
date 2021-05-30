# Overview

This page explains how to use the [JohnLawCoin wallet](https://xharaken.github.io/john-law-coin/wallet/wallet.html). If you are not familiar with the basic concepts of JohnLawCoin (e.g., ACB, Oracle, voting, bonds), please read [the whitepaper](./docs/whitepaper.pdf).

JohnLawCoin is simple. You can only do the following operations with the wallet:

* Check the status of your account and the ACB
* Send coins
* Vote for the exchange rate
* Purchase bonds
* Redeem bonds

# Operations

## Check the status of your account and the ACB

You can check the status at the top of the wallet. This includes your coin balance, your bond balance, the current oracle level, the current bond price, the ACB's bond budget, when the current phase started etc. You can refer to the information when performing the operations explained below.

## Send coins

You can send coins to your friend.

A tax may be imposed on the coin transfer depending on the current oracle level. The mapping between the oracle level and the tax rate is set as follows:

| oracle level | exchange rate | tax rate |
| ---: | ---: | ---: |
| 0 | 1 coin = 0.6 USD | 30% |
| 1 | 1 coin = 0.7 USD | 20% |
| 2 | 1 coin = 0.8 USD | 12% |
| 3 | 1 coin = 0.9 USD | 5% |
| 4 | 1 coin = 1.0 USD | 0% |
| 5 | 1 coin = 1.1 USD | 0% |
| 6 | 1 coin = 1.2 USD | 0% |
| 7 | 1 coin = 1.3 USD | 0% |
| 8 | 1 coin = 1.4 USD | 0% |

For example, imagine the current oracle level is 2. If you send 100 coins, 12 coins are collected as a tax and 88 coins are transferred to your friend. The collected tax is burned by the ACB to decrease the total coin supply to move the exchange rate toward 1 coin = 1.0 USD.

## Vote for the exchange rate

Voting is probably the most complex concept of JohnLawCoin but what you need to do in practice is simple:

1. Look up the current JLC <=> USD exchange rate using some real-world currency exchanger. The current exchange rate is defined as the exchange rate at the point when the ACB's current phase started.
1. Vote for the oracle level that is the closest to the current exchange rate. In a bootstrap phase where no currency exchanger is available, vote for the oracle level 5.

Remember that 10% of your coin balance is deposited to the ACB when you vote. The ACB weights your vote by the amount of the deposited coins and determines the "truth" oracle level by weighted majority votes. Due to the weighting, the more coins you possess, the more power your vote has.

The deposited coins are returned to your wallet later only if 1) you voted for an oracle level that is within one level from the "truth" oracle level and 2) you vote in the next two phases in a row. Otherwise, you will lose the deposited coins.

In addition, you can get a reward later if 1) you voted for the "truth" oracle level and 2) you vote in the next two phases in a row. The more coins you deposited, the more reward you can get.

The detailed calculation is described the whitepaper, but in summary, **you just need to vote for the "truth" oracle level every phase (i.e., every week)**.

[Note for advanced readers: The vote operation commits a vote to the current phase, reveals a vote in the previous phase and reclaims coins deposited in the phase before the previous phase at the same time. If you forget to vote in the current phase, that also means 1) you forget to reveal your vote in the previous phase, losing the coins deposited to the previous phase, and 2) you forget to reclaim the coins you deposited in the phase before the previous phase. This is why you should keep voting every phase.]

[Note for advanced readers: If you intend to only reveal and reclaim your votes in the previous phases and do NOT intend to commit a vote in the current phase, choose "Do not vote". Then no coins are deposited to the ACB. This is useful when you want to stop keeping voting.]

## Purchase bonds

You can purchase bonds as long as the ACB's bond budget is positive. The bonds are designed as zero-coupon bonds. One bond is redeemed for 1000 coins on the redemption date (i.e., 12 weeks after the bond issurance). The bond issue price varies depending on the current oracle level:

| oracle level | exchange rate | bond issue price |
| ---: | ---: | ---: |
| 0 | 1 coin = 0.6 USD | 970 coins |
| 1 | 1 coin = 0.7 USD | 978 coins |
| 2 | 1 coin = 0.8 USD | 986 coins |
| 3 | 1 coin = 0.9 USD | 992 coins |
| 4 | 1 coin = 1.0 USD | 997 coins |
| 5 | 1 coin = 1.1 USD | 997 coins |
| 6 | 1 coin = 1.2 USD | 997 coins |
| 7 | 1 coin = 1.3 USD | 997 coins |
| 8 | 1 coin = 1.4 USD | 997 coins |

For example, imagine the current oracle level is 2. You can purchase one bond with 986 coins. You can redeem the bond for 1000 coins on the redemption date.

The ACB sets a positive bond budget when it needs to decrease the total coin supply by issuing bonds, moving the exchange rate toward 1 coin = 1.0 USD.

## Redeem bonds

You can redeem bonds whose redemption period is over. You can get 1000 coins by redeeming one bond.

You can also redeem bonds regardless of their redemption dates as long as the ACB's bond budget is negative. The ACB sets a negative bond budget when it needs to increase the total coin supply by redeeming bonds proactively, moving the exchange rate toward 1 coin = 1.0 USD.

# So... how can I get coins?

Initially you have no coins. You can earn coins by contributing to the voting and getting the reward.

When you have coins, you can increase the coins by purchasing and redeeming bonds.

Once real-world currency exchangers support the JLC <=> USD conversion, you can buy coins from the currency exchangers. You can also increase coins by performing arbitrage. When the exchange rate is 1 coin = 1.2 USD and you believe the ACB has the ability of moving the exchange rate to 1 coin = 1.0 USD, you can earn money by selling coins now and buying them back later. When the exchange rate is 1 coin = 0.8 USD and you believe the ACB has the ability of moving the exchange rate to 1 coin = 1.0 USD, you can earn money by buying coins now and selling them back later.

Remember that these activities are important not only to increase your coin balance but also to stabilize the exchange rate. The contribution to the voting helps the ACB determine the oracle level in a decentralized manner. The bond purchasing / redeeming helps the ACB adjust the total coin supply and thus move the exchange rate toward 1 coin = 1.0 USD. The arbitrage between JLC and USD helps move the exchange rate toward 1 coin = 1.0 USD. JohnLawCoin's incentive model is designed in a way in which user's behavior of pursuing their own self-interest helps stabilize the exchange rate.

[Note: JohnLawCoin does not conduct ICO (Initial Coin Offering) because the purpose is purely research, not profit.]

