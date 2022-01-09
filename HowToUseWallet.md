# Overview

This page explains how to use the [JohnLawCoin wallet](https://xharaken.github.io/john-law-coin/wallet/wallet.html). If you are not familiar with the basic concepts of JohnLawCoin (e.g., ACB, Oracle, voting, bonds, open market operation), please read [the overview slide](https://docs.google.com/presentation/d/115iIoL1q3oUpxEU7WHOL8CKSk6ZocKHOOPQDM6B83P4/edit#slide=id.g3fd63888d1_0_7) or [the whitepaper](./docs/whitepaper.pdf).

JohnLawCoin is simple. You can only do the following operations with the wallet:

* Transfer coins
* Vote for the JLC <-> USD exchange rate
* Purchase and sell coins
* Purchase and redeem bonds

# Operations

You can check the status of your account and the ACB at the top of the wallet. This includes your coin balance, your bond balance, the current JLC <-> USD exchange rate, the current bond budget etc. Please refer to the information when performing the operations explained below.

## Transfer coins

You can transfer coins to your friend. 1% of the transferred coins is collected as a *tax*. For example, when you transfer 100 coins to your friend, 99 coins are delivered to your friend. The collected tax is used as a reward for the voters.

## Vote for the exchange rate

*Voting* is probably the most complex concept of JohnLawCoin but what you need to do in practice is simple:

1. Look up the current JLC <-> USD exchange rate using some real-world currency exchanger (e.g., Uniswap). The current exchange rate is defined as the exchange rate at the point when the current *epoch* started.
1. Vote for the *oracle level* that is the closest to the current exchange rate. In a bootstrap phase where no currency exchanger is available, vote for the oracle level 5 (1 JLC = 1.1 USD).

10% of your coin balance is deposited to the ACB when you vote. The ACB weighs your vote by the amount of the deposited coins and determines the "truth" oracle level by the weighted majority votes. Due to the weighting, the more coins you possess, the more power your vote has.

Let N be the current epoch ID. The coins you deposited at epoch N are returned to your wallet at epoch N+2 only when 1) you voted for an oracle level that is within one level from the "truth" oracle level at epoch N and 2) you vote at epoch N+1 and epoch N+2. Otherwise, you will lose the deposited coins.

In addition, you can get a *reward* at epoch N+2 when 1) you voted for the "truth" oracle level at epoch N and 2) you vote at epoch N+1 and epoch N+2. The more coins you deposited, the more reward you can get. The reward is funded by the tax collected in epoch N-1.

The detailed calculation is described in the whitepaper, but in summary, **you just need to vote for the "truth" oracle level every epoch**. The epoch duration is set to 1 week.

*[Note for advanced readers: The vote operation commits a vote to epoch N, reveals a vote at epoch N-1 and reclaims coins you deposited at epoch N-2 at the same time. If you forget to vote at epoch N, that also means 1) you forget to reveal your vote at epoch N-1, losing the coins you deposited at epoch N-1, and 2) you forget to reclaim the coins you deposited at epoch N-2. This is why you should keep voting every epoch.]*

*[Note for advanced readers: If you intend to only reveal and reclaim your votes in the previous epochs and do NOT intend to commit a vote in the current epoch, choose "Do not vote". Then no coins are deposited to the ACB. This is useful when you want to stop voting.]*

## Purchase and sell coins

The ACB implements an *open market operation* to increase / decrease the total coin supply. When the exchange rate is higher than 1 JLC = 1.0 USD, the open market operation sells JLC and purchases MATIC to increase the total coin supply. When the exchange rate is 1 JLC = 0.6 USD or lower, the open market operation sells MATIC and purchases JLC to decrease the total coin supply. The open market operation is controlled by the *coin budget*.

You can sell MATIC and purchase JLC when the coin budget is positive. You can sell JLC and purchase MATIC when the coin budget is negative.

The open market operation is implemented as a Dutch auction. When the coin budget is positive, the price (MATIC / JLC) is lowered until the coin budget goes down to zero. When the coin budget is negative, the price (MATIC / JLC) is raised until the coin budget goes up to zero.

## Purchase and redeem bonds

When the exchange rate is lower than 1 JLC = 1.0 USD, the ACB issues *bonds* to decrease the total coin supply. When the exchange rate is higher than 1 JLC = 1.0 USD, the ACB redeems bonds to increase the total coin supply. The bond operation is controlled by the *bond budget*.

You can purchase bonds when the bond budget is positive. The bonds are designed as zero-coupon bonds. The bond price is 996 coins / bond. A bond becomes redeemable 12 weeks after the issurance and can be redeemed for 1000 coins. The bond is expired 14 weeks after the issurance.

You can redeem bonds after the redemption dates. You can also redeem bonds (regardless of the redemption dates) when the bond budget is nevative.

# So... how can I get coins?

Initially you have zero coins. There are two ways to increase your coins from zero:

1. Contribute to the voting and earn the reward.
1. Pay MATIC and purchase coins using the open market operation.

When you have coins, there are multiple ways to increase your coins:

1. Contribute to the voting and earn the reward; the more coins you possess, the more reward you can earn.
1. Pay MATIC and purchase coins using the open market operation.
1. Purchase and redeem bonds (996 coins become 1000 coins after 12 weeks).

Once real-world currency exchangers support the JLC <-> USD conversion, you can purchase coins from the currency exchangers. You can also increase your coins by performing arbitrage. When the exchange rate is 1 JLC = 1.2 USD and you believe that the ACB has the ability of adjusting the exchange rate to 1 JLC = 1.0 USD, you can earn money by selling coins now and buying them back later. When the exchange rate is 1 JLC = 0.8 USD and you believe that the ACB has the ability of adjusting the exchange rate to 1 JLC = 1.0 USD, you can earn money by buying coins now and selling them back later. You can also perform arbitrage using the open market operation.

Remember that these activities are important not only to increase your coins but also to stabilize the exchange rate. The contribution to the voting helps the ACB determine the exchange rate in a decentralized manner. The bond purchasing / redeeming and the open market operation helps the ACB adjust the total coin supply and thus move the exchange rate toward 1 JLC = 1.0 USD. The arbitrage between JLC and USD helps move the exchange rate toward 1 JLC = 1.0 USD. JohnLawCoin's incentive model is designed in a way in which user's behavior of pursuing their own self-interest helps stabilize the exchange rate.

Note that JohnLawCoin does not conduct ICO (Initial Coin Offering) because the purpose is purely research, not profit.

*[Note for advanced readers: If you are interested in connecting to the smart contracts directly without using the wallet, see [this page](./HowToUseConsole.md).]*
