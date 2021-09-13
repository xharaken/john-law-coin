// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

var _coin_contract = null;
var _bond_contract = null;
var _logging_contract = null;
var _oracle_contract = null;
var _bond_operation_contract = null;
var _open_market_operation_contract = null;
var _eth_pool_contract = null;
var _acb_contract = null;
var _web3 = null;
var _chain_id = null;
var _selected_address = null;
var BN = null;

// Functions to set up the wallet.

window.onload = async () => {
  try {
    $("message_box").innerHTML = "";
    showLoading($("account_info"), "Loading.");
    showLoading($("acb_info"), "Loading.");
    showLoading($("open_market_operation_info"), "Loading.");
    showLoading($("bond_list"), "Loading.");
    showLoading($("oracle_status"), "Loading.");
    showLoading($("logging_status"), "Loading.");
    
    $("vote_button").disabled = true;
    $("purchase_coins_button").disabled = true;
    $("sell_coins_button").disabled = true;
    $("purchase_bonds_button").disabled = true;
    $("redeem_bonds_button").disabled = true;
    
    if (typeof window.ethereum === 'undefined') {
      throw(
        "Please <a href='https://github.com/xharaken/john-law-coin/blob/main/HowToInstallMetamask.md' " +
          "target='_blank'>set up Metamask correctly</a>. " +
          "Click the Metamask extension and log in to the right account. " +
          "Then reload the wallet.");
    }
    
    ethereum.on("accountsChanged", (accounts) => {
      window.location.reload();
    });
    ethereum.on("chainChanged", (chainId) => {
      window.location.reload();
    });
    
    await ethereum.request({ method: 'eth_requestAccounts' });
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    if (accounts.length == 0) {
      throw(
        "Please <a href='https://github.com/xharaken/john-law-coin/blob/main/HowToInstallMetamask.md' " +
          "target='_blank'>set up Metamask correctly</a>. " +
          "Click the Metamask extension and log in to the right account. " +
          "Then reload the wallet.");
    }
    _selected_address = accounts[0];
    console.log("accounts:", accounts);
    console.log("_selected_address:", _selected_address);
    
    _chain_id = await ethereum.request({ method: 'eth_chainId' });
    console.log("_chain_id: ", _chain_id);
    if (_chain_id == 1) {
      throw(
        "JohnLawCoin is not yet launched to the Ethereum Mainnet. " +
          "Click the Metamask extension and choose the Ropsten Testnet.");
    } else if (_chain_id == 3) {
      $("network").innerHTML =
        "<span class='warning'>Note: You are connected to " +
        "the Ropsten Testnet. For testing purpose, the duration of one epoch " +
        "and the price auction interval are set to 1 min. " +
        "Please test whatever you want and give us feedback!</span>";
    } else if (_chain_id == 1337 || __chain_id == 1338) {
      $("network").innerHTML =
        "<span class='warning'>You are connected to " +
        "the local network.</span>";
    } else {
      $("network").innerHTML =
        "<span class='warning'>You are connected to " +
        "an unknown network.</span>";
    }
  } catch (error) {
    console.log(error);
    await showErrorMessage(
      "Couldn't connect to Ethereum.", error);
    return;
  }
  
  try {
    _web3 = new Web3(window.ethereum);
    console.log("_web3: ", _web3);
    BN = _web3.utils.BN;

    _acb_contract = await new _web3.eth.Contract(ACB_ABI, getACBAddress());
    console.log("ACB contract: ", _acb_contract);
    const bond_operation =
          await _acb_contract.methods.bond_operation_().call();
    _bond_operation_contract =
      await new _web3.eth.Contract(BOND_OPERATION_ABI, bond_operation);
    console.log("BondOperation contract: ", _bond_operation_contract);
    const coin = await _acb_contract.methods.coin_().call();
    _coin_contract = await new _web3.eth.Contract(JOHNLAWCOIN_ABI, coin);
    console.log("JohnLawCoin contract: ", _coin_contract);
    const bond = await _bond_operation_contract.methods.bond_().call();
    _bond_contract = await new _web3.eth.Contract(JOHNLAWBOND_ABI, bond);
    console.log("JohnLawBond contract: ", _bond_contract);
    const logging = await _acb_contract.methods.logging_().call();
    _logging_contract = await new _web3.eth.Contract(LOGGING_ABI, logging);
    console.log("Logging contract: ", _logging_contract);
    const oracle = await _acb_contract.methods.oracle_().call();
    _oracle_contract = await new _web3.eth.Contract(ORACLE_ABI, oracle);
    console.log("Oracle contract: ", _oracle_contract);
    const open_market_operation =
          await _acb_contract.methods.open_market_operation_().call();
    _open_market_operation_contract =
      await new _web3.eth.Contract(OPEN_MARKET_OPERATION_ABI,
                                   open_market_operation);
    console.log("OpenMarketOperation contract: ",
                _open_market_operation_contract);
    const eth_pool = await _acb_contract.methods.eth_pool_().call();
    _eth_pool_contract = await new _web3.eth.Contract(ETH_POOL_ABI, eth_pool);
    console.log("EthPool contract: ", _eth_pool_contract);
    
    console.log("selectedAddress: ", _selected_address);
  } catch (error) {
    console.log(error);
    await showErrorMessage(
      "Couldn't connect to the smart contracts.",
      "Please <a href='https://github.com/xharaken/john-law-coin/blob/main/HowToInstallMetamask.md' " +
        "target='_blank'>set up Metamask correctly</a>. " +
        "Click the Metamask extension and log in to the right account. " +
        "Then reload the wallet.");
    return;
  }
  
  $("send_coins_button").addEventListener("click", sendCoins);
  $("vote_button").addEventListener("click", vote);
  $("purchase_coins_button").addEventListener("click", purchaseCoins);
  $("sell_coins_button").addEventListener("click", sellCoins);
  $("purchase_bonds_button").addEventListener("click", purchaseBonds);
  $("redeem_bonds_button").addEventListener("click", redeemBonds);
  $("donate_button_001").addEventListener("click", donate001);
  $("donate_button_01").addEventListener("click", donate01);
  $("donate_button_1").addEventListener("click", donate1);
  await showAdvancedInfo();
  $("advanced_button").addEventListener("click", async (event) => {
    $("advanced_information").style.display = "block";
    event.preventDefault();
    await showAdvancedInfo();
    event.target.scrollIntoView({behavior: "smooth", block: "start"});
  });
  
  await reloadInfo();
};

// Functions to handle JohnLawCoin's operations.

async function sendCoins() {
  try {
    const address = $("send_coins_address").value;
    const amount = $("send_coins_amount").value;
    
    if (amount <= 0) {
      throw("You need to send at least one coin.");
    }
    const coin_balance =
          parseInt(await _coin_contract.methods.balanceOf(
            _selected_address).call());
    if (amount > coin_balance) {
      throw("You don't have enough coin balance to send the coins.")
    }
    
    const promise = _coin_contract.methods.transfer(address, amount).send(
      {from: _selected_address});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.TransferEvent) {
      throw(receipt);
    }
    const ret = receipt.events.TransferEvent.returnValues;
    const message = "Sent " + ret.amount + " coins to " + ret.receiver + ". " +
          "Paid " + ret.tax + " coins as a tax. The tax is used as a reward " +
          "for voters.";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    const transactionHash = extractTransactionHash(error);
    if (transactionHash) {
      await showErrorMessage(
        "Couldn't send coins.",
        "The transaction (<a href='" +
          getEtherScanURL() + "tx/" + transactionHash +
          "' target='_blank' rel='noopener noreferrer'>EtherScan</a>) " +
          "couldn't fulfill your order. This may happen due to timing " +
          "issues when the blockchain state changed between when you " +
          "ordered and when the transaction was processed " +
          "(e.g., your coin balance was enough when you ordered " +
          "but was not enough when the transaction was processed.) " +
          "This may also happen due to out of gas. Please try again.");
    } else {
      await showErrorMessage("Couldn't send coins.", error);
    }
    return;
  }
}

async function purchaseCoins() {
  try {
    const coin_amount = $("purchase_coins_amount").value;
    
    if (coin_amount <= 0) {
      throw("You need to purchase at least one coin.");
    }
    const coin_budget = parseInt(
      await _open_market_operation_contract.methods.coin_budget_().call());
    if (coin_budget <= 0) {
      throw("You cannot purchase coins when the coin budget is negative.");
    }
    if (coin_amount > coin_budget) {
      throw("The current coin budget is " + coin_budget +
            ". You cannot purchase coins exceeding the budget.");
    }
    const current_epoch_start =
          parseInt(await _acb_contract.methods.current_epoch_start_().call());
    const current_price =
          new BN(await _open_market_operation_contract.methods.getCurrentPrice(
            Math.trunc(Date.now() / 1000) - current_epoch_start).call());
    console.log("current_price:",
                _web3.utils.fromWei(current_price.toString()));
    const eth_amount = current_price.mul(new BN(coin_amount));
    const your_eth_balance =
          new BN(await _web3.eth.getBalance(_selected_address));
    if (eth_amount.gt(your_eth_balance)) {
      throw("You don't have enough ETH balance to purchase the coins.");
    }
    
    const promise = _acb_contract.methods.purchaseCoins().send(
      {from: _selected_address, value: eth_amount.toString()});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.PurchaseCoinsEvent) {
      throw(receipt);
    }
    const ret = receipt.events.PurchaseCoinsEvent.returnValues;
    const message = "Sold " + _web3.utils.fromWei(ret.eth_amount) +
          " ETH (" + ret.eth_amount + " wei) and purchased " +
          ret.coin_amount + " JLC. The amount of the purchased coins " +
          "can be different from the amount of the coins you specified " +
          "depending on the ETH / JLC price at the transaction timing.";
          "transaction was processed.";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    const transactionHash = extractTransactionHash(error);
    if (transactionHash) {
      await showErrorMessage(
        "Couldn't purchase coins.",
        "The transaction (<a href='" +
          getEtherScanURL() + "tx/" + transactionHash +
          "' target='_blank' rel='noopener noreferrer'>EtherScan</a>) " +
          "couldn't fulfill your order. This may happen due to timing " +
          "issues when the blockchain state changed between when you " +
          "ordered and when the transaction was processed " +
          "(e.g., the coin budget was enough when you ordered " +
          "but was not enough when the transaction was processed.) " +
          "Please try again.");
    } else {
      await showErrorMessage("Couldn't purchase coins.", error);
    }
    return;
  }
}

async function sellCoins() {
  try {
    const coin_amount = $("sell_coins_amount").value;
    
    if (coin_amount <= 0) {
      throw("You need to sell at least one coin.");
    }
    const coin_balance =
          parseInt(await _coin_contract.methods.balanceOf(
            _selected_address).call());
    if (coin_amount > coin_balance) {
      throw("You don't have enough coin balance to sell the coins.")
    }
    const coin_budget = parseInt(
      await _open_market_operation_contract.methods.coin_budget_().call());
    if (coin_budget >= 0) {
      throw("You cannot sell coins when the coin budget is positive.");
    }
    if (coin_amount > -coin_budget) {
      throw("The current coin budget is " + coin_budget +
            ". You cannot sell coins exceeding the budget.");
    }
    const current_epoch_start =
          parseInt(await _acb_contract.methods.current_epoch_start_().call());
    const current_price =
          new BN(await _open_market_operation_contract.methods.getCurrentPrice(
            Math.trunc(Date.now() / 1000) - current_epoch_start).call());
    const eth_amount = current_price.mul(new BN(coin_amount));
    const eth_balance =
          new BN(await _web3.eth.getBalance(_eth_pool_contract._address));
    if (eth_amount.gt(eth_balance)) {
      throw("The Open Market Operation does not have enough ETH to purchase " +
            "the JLC coins you specified. Check the current ETH / JLC price " +
            "and specify a lower value.");
    }
    
    const promise = _acb_contract.methods.sellCoins(coin_amount).send(
      {from: _selected_address});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.SellCoinsEvent) {
      throw(receipt);
    }
    const ret = receipt.events.SellCoinsEvent.returnValues;
    const message = "Sold " + ret.coin_amount +
          " JLC and purchased " + _web3.utils.fromWei(ret.eth_amount) +
          " ETH (" + ret.eth_amount + " wei).";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    const transactionHash = extractTransactionHash(error);
    if (transactionHash) {
      await showErrorMessage(
        "Couldn't sell coins.",
        "The transaction (<a href='" +
          getEtherScanURL() + "tx/" + transactionHash +
          "' target='_blank' rel='noopener noreferrer'>EtherScan</a>) " +
          "couldn't fulfill your order. This may happen due to timing " +
          "issues when the blockchain state changed between when you " +
          "ordered and when the transaction was processed " +
          "(e.g., the coin budget was enough when you ordered " +
          "but was not enough when the transaction was processed.) " +
          "Please try again.");
    } else {
      await showErrorMessage("Couldn't sell coins.", error);
    }
    return;
  }
}

async function purchaseBonds() {
  try {
    const amount = $("purchase_bonds_amount").value;
    
    if (amount <= 0) {
      throw("You need to purchase at least one bond.");
    }
    const bond_budget = parseInt(
      await _bond_operation_contract.methods.bond_budget_().call());
    if (amount > bond_budget) {
      throw("The current bond budget is " + bond_budget +
            ". You cannot purchase bonds exceeding the budget.");
    }
    const coin_balance =
          parseInt(await _coin_contract.methods.balanceOf(
            _selected_address).call());
    const bond_price =
          parseInt(await _bond_operation_contract.methods.BOND_PRICE().call());
    if (coin_balance < amount * bond_price) {
      throw("You don't have enough coin balance to purchase the bonds.");
    }
    const bond_redeemable_period = parseInt(
      await _bond_operation_contract.methods.BOND_REDEEMABLE_PERIOD().call());
    
    const promise = _acb_contract.methods.purchaseBonds(amount).send(
      {from: _selected_address});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.PurchaseBondsEvent) {
      throw(receipt);
    }
    const ret = receipt.events.PurchaseBondsEvent.returnValues;
    const message = "Purchased " + ret.purchased_bonds +
          " bonds. The bonds can be redeemed from epoch " +
          ret.redemption_epoch +
          " to epoch " +
          (parseInt(ret.redemption_epoch) + bond_redeemable_period - 1) + ".";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    const transactionHash = extractTransactionHash(error);
    if (transactionHash) {
      await showErrorMessage(
        "Couldn't purchase bonds.",
        "The transaction (<a href='" +
          getEtherScanURL() + "tx/" + transactionHash +
          "' target='_blank' rel='noopener noreferrer'>EtherScan</a>) " +
          "couldn't fulfill your order. This may happen due to timing " +
          "issues when the blockchain state changed between when you " +
          "ordered and when the transaction was processed " +
          "(e.g., the bond budget was enough when you ordered " +
          "but was not enough when the transaction was processed.) " +
          "Please try again.");
    } else {
      await showErrorMessage("Couldn't purchase bonds.", error);
    }
    return;
  }
}

async function redeemBonds() {
  try {
    const epoch_id = parseInt(
      await _oracle_contract.methods.epoch_id_().call());
    const bond_budget = -(parseInt(
      await _bond_operation_contract.methods.bond_budget_().call()));
    const redemption_count =
          parseInt(await _bond_contract.methods.
                   numberOfRedemptionEpochsOwnedBy(
                     _selected_address).call());
    let redemption_epochs = [];
    for (let index = 0; index < redemption_count; index++) {
      const redemption_epoch =
            parseInt(await _bond_contract.methods.
                     getRedemptionEpochOwnedBy(
                       _selected_address, index).call());
      redemption_epochs.push(redemption_epoch);
    }
    redemption_epochs =
      redemption_epochs.sort((a, b) => { return b - a; });
    console.log("redemption_epochs: ", redemption_epochs);
    
    let redeemable_epochs = [];
    let bond_count = 0;
    for (let redemption_epoch of redemption_epochs) {
      if (parseInt(redemption_epoch) <= epoch_id) {
        redeemable_epochs.push(redemption_epoch);
      } else if (bond_count < bond_budget) {
        redeemable_epochs.push(redemption_epoch);
        const balance =
              parseInt(await _bond_contract.methods.balanceOf(
                _selected_address, redemption_epoch).call());
        bond_count += balance;
      }
    }
    console.log("redeemable_epochs: ", redeemable_epochs);
    
    const promise = _acb_contract.methods.redeemBonds(
      redeemable_epochs).send({from: _selected_address});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.RedeemBondsEvent) {
      throw(receipt);
    }
    const ret = receipt.events.RedeemBondsEvent.returnValues;
    let message = "Redeemed " + ret.redeemed_bonds + " bonds.";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    const transactionHash = extractTransactionHash(error);
    if (transactionHash) {
      await showErrorMessage(
        "Couldn't redeem bonds.",
        "The transaction (<a href='" +
          getEtherScanURL() + "tx/" + transactionHash +
          "' target='_blank' rel='noopener noreferrer'>EtherScan</a>) " +
          "couldn't fulfill your order. This may happen due to timing " +
          "issues when the blockchain state changed between when you " +
          "ordered and when the transaction was processed " +
          "(e.g., the bond budget was enough when you ordered " +
          "but was not enough when the transaction was processed.) " +
          "Please try again.");
    } else {
      await showErrorMessage("Couldn't redeem bonds.", error);
    }
    return;
  }
}

async function vote() {
  try {
    const current_level = $("vote_oracle_level").value || LEVEL_MAX;
    
    const epoch_id = parseInt(
      await _oracle_contract.methods.epoch_id_().call());
    const current_epoch_id =
          (await getNextEpochStart()) < Date.now() ?
          epoch_id + 1 : epoch_id;
    console.log("epoch_id: ", epoch_id);
    console.log("current_epoch_id: ", current_epoch_id);
    
    const current_salt = await getSalt(current_epoch_id);
    console.log("current_salt: ", current_salt);
    const current_commit = await getCommit(current_epoch_id);
    const previous_commit = await getCommit(current_epoch_id - 1);
    
    if (current_commit.voted) {
      throw("You have already voted in the current epoch. " +
            "You can vote only once per epoch.");
    }
    
    const null_hash = await _acb_contract.methods.NULL_HASH().call();
    let previous_level = LEVEL_MAX;
    let previous_salt = 0;
    if (previous_commit.voted && previous_commit.hash != null_hash) {
      let found = false;
      let retry = 0;
      for (let previous_epoch_id = current_epoch_id;
           previous_epoch_id >= 0 && retry < 6 && !found;
           previous_epoch_id--) {
        previous_salt = await getSalt(previous_epoch_id);
        for (let level = 0; level < LEVEL_MAX; level++) {
          const hash = await _acb_contract.methods.encrypt(
            level, previous_salt).call({from: _selected_address});
          if (hash == previous_commit.hash) {
            previous_level = level;
            found = true;
            break;
          }
        }
        retry++;
      }
      if (!found) {
        const ret = confirm(
          "We couldn't find the oracle level and the salt that match " +
            "your previous vote. Please check that you are using " +
            "the same Ethereum account for the current vote and " +
            "the previous vote. This may also happen when your browser's " +
            "local storage is broken or cleared.\n\n" +
            "Do you want to forcibly proceed? Then you will lose " +
            "the coins you deposited in the previous vote.\n");
        if (!ret) {
          throw("Vote cancelled.");
        }
      }
    }
    console.log("previous_salt: ", previous_salt);
    console.log("previous_level: ", previous_level);
    
    const hash = current_level == LEVEL_MAX ? null_hash :
          await _acb_contract.methods.encrypt(
            current_level, current_salt).call(
              {from: _selected_address});
    const promise = _acb_contract.methods.vote(
      hash, previous_level, previous_salt).send(
        {from: _selected_address});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.VoteEvent) {
      throw(receipt);
    }
    const ret = receipt.events.VoteEvent.returnValues;
    const updated_epoch_id = parseInt(
      await _oracle_contract.methods.epoch_id_().call());
    const message = "Commit for epoch " + updated_epoch_id + ": " +
          (ret.commit_result ? 
           "Succeeded. You voted for the oracle level " + current_level +
           ". You deposited " + ret.deposited + " coins. " +
           "The coins will be reclaimed at epoch " + (updated_epoch_id + 2) +
           " as long as you vote at epoch " + (updated_epoch_id + 1) +
           " and epoch " + (updated_epoch_id + 2) + ".":
           "Failed. You can vote only once per epoch.") + "<br><br>" +
          "Reveal for epoch " + (updated_epoch_id - 1) + ": " +
          (ret.reveal_result ? 
           "Succeeded." :
           "Failed. Your vote in epoch " + (updated_epoch_id - 1) +
           " was not found.") + "<br><br>" +
          "Reclaim for epoch " + (updated_epoch_id - 2) + ": " +
          "Reclaimed " + ret.reclaimed + " coins. Got " +
          ret.rewarded + " coins as a reward.";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    const transactionHash = extractTransactionHash(error);
    if (transactionHash) {
      await showErrorMessage(
        "Couldn't vote.",
        "The transaction (<a href='" +
          getEtherScanURL() + "tx/" + transactionHash +
          "' target='_blank' rel='noopener noreferrer'>EtherScan</a>) " +
          "failed due to out of gas. Voting may require more gas than " +
          "what Metamask estimates. You can increase the gas limit when " +
          "you confirm the transaction. Please increase the gas limit " +
          "and try again.");
    } else {
      await showErrorMessage("Couldn't vote.", error);
    }
    return;
  }
}

async function donate001() {
  await donate("0.01");
}

async function donate01() {
  await donate("0.1");
}

async function donate1() {
  await donate("1");
}

async function donate(eth) {
  try {
    const amount = _web3.utils.toWei(eth);
    const promise = _web3.eth.sendTransaction(
      {from: _selected_address, to: getACBAddress(), value: amount});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    const message = "Donated " + eth + " ETH. Thank you very much!!";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    await showErrorMessage("Couldn't donate.", error);
    return;
  } 
}

// Functions to render HTML.

async function reloadInfo() {
  try {
    $("advanced_information").style.display = "none";
    
    let html = "";
    
    html += "<table><tr><td>Account address</td><td class='right'>" +
      "<a href='" + getEtherScanURL() + "address/" + _selected_address +
      "' target='_blank' rel='noopener noreferrer'>" +
      _selected_address + "</a></td></tr>";
    const coin_balance =
          parseInt(await _coin_contract.methods.balanceOf(
            _selected_address).call());
    html += "<tr><td>Coin balance</td><td class='right'>" +
      coin_balance + "</td></tr>";

    const bond_balance =
          parseInt(await _bond_contract.methods.numberOfBondsOwnedBy(
            _selected_address).call());
    html += "<tr><td>Bond balance</td><td class='right'>" +
      bond_balance + "</td></tr>";
    const your_eth_balance = await _web3.eth.getBalance(_selected_address);
    html += "<tr><td>ETH balance</td><td class='right'>" +
      _web3.utils.fromWei(your_eth_balance) + " ETH</td></tr>";
    const epoch_id =
          parseInt(await _oracle_contract.methods.epoch_id_().call());

    const current_commit = await getCommit(epoch_id);
    html += "<tr><td>Voted in the current epoch</td><td class='right'>" +
      (current_commit.voted ? "Done" : "Not yet") +
      "</td></tr></table>";
    showMessage($("account_info"), html);
    
    html = "<table><tr><td>Contract address</td><td class='right'>" +
      "<a href='" + getEtherScanURL() + "address/" + _acb_contract._address +
      "' target='_blank' rel='noopener noreferrer'>" +
      _acb_contract._address.toLowerCase() + "</a></td></tr>";
    html += "<tr><td>Total coin supply</td><td class='right'>" +
      (await _coin_contract.methods.totalSupply().call()) + "</td></tr>";
    html += "<tr><td>Total bond supply</td><td class='right'>" +
      (await _bond_contract.methods.totalSupply().call()) + "</td></tr>";
    const bond_budget = parseInt(
      await _bond_operation_contract.methods.bond_budget_().call());
    html += "<tr><td>Bond budget</td><td class='right'>" +
      bond_budget + "</td></tr>";

    const oracle_level =
          parseInt(await _acb_contract.methods.oracle_level_().call());
    html += "<tr><td>Current exchange rate</td><td class='right'>" +
      ((0 <= oracle_level && oracle_level < LEVEL_MAX) ?
       "1 JLC = " + EXCHANGE_RATES[oracle_level] +
       " USD (Oracle level = " + oracle_level + ")" :
       "Undefined (no vote was found)") + "</td></tr>";
    html += "<tr><td>Current epoch ID</td><td class='right'>" +
      parseInt(await _oracle_contract.methods.epoch_id_().call())
      + "</td></tr>";
    const current_epoch_start_ms =
          parseInt(
            await _acb_contract.methods.current_epoch_start_().call()) * 1000;
    html += "<tr><td>Current epoch started</td><td class='right'>" +
      getDateString(current_epoch_start_ms) + "</td></tr>";
    const next_epoch_start_ms = await getNextEpochStart();
    html += "<tr><td>Next epoch will start</td><td class='right'>" +
      getDateString(next_epoch_start_ms) + " plus/minus 5 mins</td></tr>";
    html += "<tr><td>Current time</td><td class='right'>" +
      getDateString(Date.now()) + "</td></tr>";
    showMessage($("acb_info"), html);
    
    const coin_budget = parseInt(
      await _open_market_operation_contract.methods.coin_budget_().call());
    const current_state =
          coin_budget > 0 ? "You can sell ETH and purchase JLC" :
          (coin_budget < 0 ? "You can sell JLC and purchase ETH" : "Closed");
    html = "<table><tr><td>Current state</td><td class='right'>" +
      current_state + "</a></td></tr>";
    html += "<tr><td>Coin budget</td><td class='right'>" +
      coin_budget + "</td></tr>";
    const eth_balance =
          await _web3.eth.getBalance(_eth_pool_contract._address);
    html += "<tr><td>ETH balance</td><td class='right'>" +
      _web3.utils.fromWei(eth_balance) + " ETH<br>" +
      "(" + eth_balance + " wei)</td></tr>";
    const eth_balance_2 =
      await _open_market_operation_contract.methods.eth_balance_().call();
    html += "<tr><td>ETH balance 2</td><td class='right'>" +
      _web3.utils.fromWei(eth_balance_2) + " ETH<br>" +
      "(" + eth_balance_2 + " wei)</td></tr>";
    const current_price =
          await _open_market_operation_contract.methods.getCurrentPrice(
            Math.trunc((Date.now() - current_epoch_start_ms) / 1000)).call();
    html += "<tr><td>Current price</td><td class='right'>" +
      "1 JLC = " + _web3.utils.fromWei(current_price) + " ETH<br>" +
      "(1 JLC = " + current_price + " wei)</td></tr>";
    const latest_price =
          await _open_market_operation_contract.methods.latest_price_().call();
    html += "<tr><td>Latest exchanged price</td><td class='right'>" +
      "1 JLC = " + _web3.utils.fromWei(latest_price) + " ETH<br>" +
      "(1 JLC = " + latest_price + " wei)</td></tr>";
    html += "<tr><td colspan=2 class='left' id='price_chart' " +
      "style='height: 200px; width: 600px'>" +
      "</td></tr>";
    html += "</table>";
    showMessage($("open_market_operation_info"), html);
    await showPriceChart();
    
    if (coin_budget > 0) {
      $("purchase_coins_button").disabled = false;
      $("purchase_coins_button_disabled").innerText = "";
    } else {
      $("purchase_coins_button").disabled = true;
      $("purchase_coins_button_disabled").innerText =
        " [You can purchase coins only when the coin budget " +
        "is positive. The current coin budget is " +
        coin_budget + ".]";
    }
    if (coin_budget < 0) {
      $("sell_coins_button").disabled = false;
      $("sell_coins_button_disabled").innerText = "";
    } else {
      $("sell_coins_button").disabled = true;
      $("sell_coins_button_disabled").innerText =
        " [You can sell coins only when the coin budget " +
        "is negative. The current coin budget is " +
        coin_budget + ".]";
    }
    
    if (bond_budget > 0) {
      $("purchase_bonds_button").disabled = false;
      $("purchase_bonds_button_disabled").innerText = "";
    } else {
      $("purchase_bonds_button").disabled = true;
      $("purchase_bonds_button_disabled").innerText =
        " [You can purchase bonds only when the bond budget " +
        "is positive. The current bond budget is " +
        bond_budget + ".]";
    }
    
    const next_epoch_id =
          next_epoch_start_ms < Date.now() ?
          epoch_id + 1 : epoch_id;
    console.log("next_epoch_id:", next_epoch_id);
    const next_commit = await getCommit(next_epoch_id);
    if (!next_commit.voted) {
      $("vote_button").disabled = false;
      $("vote_button_disabled").innerText = "";
    } else {
      $("vote_button").disabled = true;
      $("vote_button_disabled").innerText =
        " [You can vote only once per epoch. Please wait until the next " +
        "epoch starts. The next epoch will start around " +
        getDateString(next_epoch_start_ms) + ".]";
      setTimeout(async () => {
        const next_commit = await getCommit(epoch_id + 1);
        if (!next_commit.voted) {
          $("vote_button").disabled = false;
          $("vote_button_disabled").innerText = "";
        }
      }, next_epoch_start_ms - Date.now() + 10000);
    }
    
    let has_redeemable = false;
    let bond_list_html = "You have " + bond_balance + " bonds in total.";
    if (bond_balance > 0) {
      bond_list_html += "<br><br><table><tr><td>Redemption epoch</td>" +
        "<td># of bonds</td><td>Redeemable?</td></tr>";
      const redemption_count =
            parseInt(await _bond_contract.methods.
                     numberOfRedemptionEpochsOwnedBy(
                       _selected_address).call());
      let redemption_epochs = [];
      for (let index = 0; index < redemption_count; index++) {
        const redemption_epoch =
              parseInt(await _bond_contract.methods.
                       getRedemptionEpochOwnedBy(
                         _selected_address, index).call());
        redemption_epochs.push(redemption_epoch);
      }
      redemption_epochs =
        redemption_epochs.sort((a, b) => { return a - b; });
      
      const bond_redeemable_period = parseInt(
        await _bond_operation_contract.methods.BOND_REDEEMABLE_PERIOD().call());
      for (let redemption_epoch of redemption_epochs) {
        const balance =
              parseInt(await _bond_contract.methods.balanceOf(
                _selected_address, redemption_epoch).call());
        bond_list_html += "<tr><td>" + redemption_epoch +
          "</td><td class='right'>" + balance + "</td><td>" +
          (redemption_epoch <= epoch_id ?
           (epoch_id < redemption_epoch + bond_redeemable_period ?
            "Yes." : "No. The bonds are expired.") :
           "Yes when the bond budget is negative.") + "</td></tr>";
        if (redemption_epoch <= epoch_id) {
          has_redeemable = true;
        }
      }
      if (bond_budget < 0) {
        has_redeemable = true;
      }
      bond_list_html += "</table>";
    }
    showMessage($("bond_list"), bond_list_html);
    
    if (has_redeemable) {
      $("redeem_bonds_button").disabled = false;
      $("redeem_bonds_button_disabled").innerText = "";
    } else {
      $("redeem_bonds_button").disabled = true;
      $("redeem_bonds_button_disabled").innerText =
        " [You don't have any redeemable bonds.]";
    }
  } catch (error) {
    await showErrorMessage("Couldn't reload infomation.", error);
    return;
  }
}

async function showAdvancedInfo() {
  await showOracleStatus();
  await showLoggingStatus();
  await showHistoryChart();
}

async function showOracleStatus() {
  let html = "";
  const epoch_id =
        parseInt(await _oracle_contract.methods.epoch_id_().call());
  html += "<table><tr><td>epoch_id_</td><td class='right'>" +
    epoch_id + "</td></tr></table>";
  for (let index = 0; index < 3; index++) {
    html += "<br>Epoch " + index + "<br><table>";
    const ret = await _oracle_contract.methods.getEpoch(index).call();
    html += "<tr><td>deposited</td><td class='right'>" +
      (await _coin_contract.methods.balanceOf(ret[0]).call()) +
      "</td></tr>";
    html += "<tr><td>to_be_rewarded</td><td class='right'>" +
      (await _coin_contract.methods.balanceOf(ret[1]).call()) + "</td></tr>";
    html += "<tr><td>reward_total</td><td class='right'>" +
      ret[2] + "</td></tr>";
    html += "<tr><td>phase</td><td class='right'>" +
      getPhaseString(ret[3]) + "</td></tr>";
    for (let level = 0; level < LEVEL_MAX; level++) {
      const ret = await _oracle_contract.methods.getVote(index, level).call();
      html += "<tr><td>level " + level + "</td><td class='right'>";
      html += "deposit: " + ret[0] + ", count: " + ret[1] +
        ", reclaim: " + ret[2] + ", reward: " + ret[3];
      html += "</td></tr>";
    }
    html += "</table>";
  }
  showMessage($("oracle_status"), html);
}

async function showLoggingStatus() {
  let html = "";
  const current_epoch_id =
        parseInt(await _oracle_contract.methods.epoch_id_().call());
  for (let epoch_id of [current_epoch_id, current_epoch_id - 1]) {
    if (epoch_id <= 0) {
      continue;
    }
    const vote_log =
          await _logging_contract.methods.getVoteLog(epoch_id).call();
    const epoch_log =
          await _logging_contract.methods.getEpochLog(epoch_id).call();
    const bond_operation_log =
          await _logging_contract.methods.getBondOperationLog(epoch_id).call();
    const open_market_operation_log =
          await _logging_contract.methods.getOpenMarketOperationLog(
            epoch_id).call();
    html += epoch_id == current_epoch_id ? "Current" : "<br>Previous";
    html += "<br><table>";
    html += "<tr><td>commit_succeeded</td><td class='right'>" +
      vote_log[0] + "</td></tr>";
    html += "<tr><td>commit_failed</td><td class='right'>" +
      vote_log[1] + "</td></tr>";
    html += "<tr><td>reveal_succeeded</td><td class='right'>" +
      vote_log[2] + "</td></tr>";
    html += "<tr><td>reveal_failed</td><td class='right'>" +
      vote_log[3] + "</td></tr>";
    html += "<tr><td>reclaim_succeeded</td><td class='right'>" +
      vote_log[4] + "</td></tr>";
    html += "<tr><td>reward_succeeded</td><td class='right'>" +
      vote_log[5] + "</td></tr>";
    html += "<tr><td>deposited</td><td class='right'>" +
      vote_log[6] + "</td></tr>";
    html += "<tr><td>reclaimed</td><td class='right'>" +
      vote_log[7] + "</td></tr>";
    html += "<tr><td>rewarded</td><td class='right'>" +
      vote_log[8] + "</td></tr>";
    html += "<tr><td>minted_coins</td><td class='right'>" +
      epoch_log[0] + "</td></tr>";
    html += "<tr><td>burned_coins</td><td class='right'>" +
      epoch_log[1] + "</td></tr>";
    html += "<tr><td>coin_supply_delta</td><td class='right'>" +
      epoch_log[2] + "</td></tr>";
    html += "<tr><td>total_coin_supply</td><td class='right'>" +
      epoch_log[3] + "</td></tr>";
    html += "<tr><td>oracle_level</td><td class='right'>" +
      epoch_log[4] + "</td></tr>";
    html += "<tr><td>current_epoch_start</td><td class='right'>" +
      epoch_log[5] + "</td></tr>";
    html += "<tr><td>tax</td><td class='right'>" +
      epoch_log[6] + "</td></tr>";
    html += "<tr><td>bond_budget</td><td class='right'>" +
      bond_operation_log[0] + "</td></tr>";
    html += "<tr><td>total_bond_supply</td><td class='right'>" +
      bond_operation_log[1] + "</td></tr>";
    html += "<tr><td>valid_bond_supply</td><td class='right'>" +
      bond_operation_log[2] + "</td></tr>";
    html += "<tr><td>purchased_bonds</td><td class='right'>" +
      bond_operation_log[3] + "</td></tr>";
    html += "<tr><td>redeemed_bonds</td><td class='right'>" +
      bond_operation_log[4] + "</td></tr>";
    html += "<tr><td>expired_bonds</td><td class='right'>" +
      bond_operation_log[5] + "</td></tr>";
    html += "<tr><td>coin_budget</td><td class='right'>" +
      open_market_operation_log[0] + "</td></tr>";
    html += "<tr><td>exchanged_coins</td><td class='right'>" +
      open_market_operation_log[1] + "</td></tr>";
    html += "<tr><td>exchanged_eth</td><td class='right'>" +
      open_market_operation_log[2] + "</td></tr>";
    html += "<tr><td>eth_balance</td><td class='right'>" +
      open_market_operation_log[3] + "</td></tr>";
    html += "<tr><td>latest_price</td><td class='right'>" +
      open_market_operation_log[4] + "</td></tr>";
    html += "</table>"
  }
  showMessage($("logging_status"), html);
}

async function showHistoryChart() {
  let logs = {};
  logs["vote"] = [];
  logs["deposited_reclaimed_rewarded"] = [];
  logs["delta_minted_burned_tax"] = [];
  logs["total_coin_supply"] = [];
  logs["oracle_level"] = [];
  logs["total_valid_bond_supply"] = [];
  logs["purchased_redeemed_expired_with_budget"] = [];
  logs["exchanged_coins_with_budget"] = [];
  logs["exchanged_eth"] = [];
  logs["eth_balance"] = [];
  logs["latest_price"] = [];
  
  const current_epoch_id =
        parseInt(await _oracle_contract.methods.epoch_id_().call());
  for (let epoch_id = 4; epoch_id <= current_epoch_id; epoch_id++) {
    const vote_log =
          await _logging_contract.methods.getVoteLog(epoch_id).call();
    const epoch_log =
          await _logging_contract.methods.getEpochLog(epoch_id).call();
    const bond_operation_log =
          await _logging_contract.methods.getBondOperationLog(epoch_id).call();
    const open_market_operation_log =
          await _logging_contract.methods.getOpenMarketOperationLog(
            epoch_id).call();
    const date = new Date(parseInt(epoch_log[5]) * 1000);
    logs["vote"].push([date,
                       parseInt(vote_log[0]),
                       parseInt(vote_log[1]),
                       parseInt(vote_log[2]),
                       parseInt(vote_log[3]),
                       parseInt(vote_log[4]),
                       parseInt(vote_log[5])]);
    logs["deposited_reclaimed_rewarded"].push([date,
                                               parseInt(vote_log[6]),
                                               parseInt(vote_log[7]),
                                               parseInt(vote_log[8])]);
    logs["delta_minted_burned_tax"].push([date,
                                          parseInt(epoch_log[2]),
                                          parseInt(epoch_log[0]),
                                          parseInt(epoch_log[1]),
                                          parseInt(epoch_log[6])]);
    logs["total_coin_supply"].push([date, parseInt(epoch_log[3])]);
    logs["oracle_level"].push([date, parseInt(epoch_log[4])]);
    logs["total_valid_bond_supply"].push([date,
                                          parseInt(bond_operation_log[1]),
                                          parseInt(bond_operation_log[2])]);
    logs["purchased_redeemed_expired_with_budget"].push(
      [date,
       parseInt(bond_operation_log[0]),
       parseInt(bond_operation_log[3]),
       parseInt(bond_operation_log[4]),
       parseInt(bond_operation_log[5])]);
    logs["exchanged_coins_with_budget"].push([
      date,
      parseInt(open_market_operation_log[0]),
      parseInt(open_market_operation_log[1])]);
    logs["exchanged_eth"].push([date,
                                parseInt(open_market_operation_log[2])]);
    logs["eth_balance"].push([date,
                              parseInt(open_market_operation_log[3])]);
    logs["latest_price"].push([date,
                               parseInt(open_market_operation_log[4])]);
  }
  
  google.charts.load("current", {packages:["corechart"]});
  google.charts.setOnLoadCallback(drawHistoryChart);
  
  function drawHistoryChart() {
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "commit_succeeded");
      table.addColumn("number", "commit_failed");
      table.addColumn("number", "reveal_succeeded");
      table.addColumn("number", "reveal_failed");
      table.addColumn("number", "reclaim_succeeded");
      table.addColumn("number", "reward_succeeded");
      table.addRows(logs["vote"]);
      const options = {
        title: "Oracle: vote statistics",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_vote"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "deposited");
      table.addColumn("number", "reclaimed");
      table.addColumn("number", "rewarded");
      table.addRows(logs["deposited_reclaimed_rewarded"]);
      const options = {
        title: "Oracle: deposited / reclaimed / rewarded coins",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_deposited_reclaimed_rewarded"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "coin_supply_delta");
      table.addColumn("number", "minted_coins");
      table.addColumn("number", "burned_coins");
      table.addColumn("number", "tax");
      table.addRows(logs["delta_minted_burned_tax"]);
      const options = {
        title: "ACB: internal statistics",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_delta_minted_burned_tax"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "total_coin_supply");
      table.addRows(logs["total_coin_supply"]);
      const options = {
        title: "ACB: total coin supply",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_total_coin_supply"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "oracle_level");
      table.addRows(logs["oracle_level"]);
      const options = {
        title: "ACB: oracle level",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_oracle_level"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "total_bond_supply");
      table.addColumn("number", "valid_bond_supply");
      table.addRows(logs["total_valid_bond_supply"]);
      const options = {
        title: "BondOperation: total bond supply / valid bond supply",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_total_valid_bond_supply"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "bond_budget");
      table.addColumn("number", "purchased_bonds");
      table.addColumn("number", "redeemed_bonds");
      table.addColumn("number", "expired_bonds");
      table.addRows(logs["purchased_redeemed_expired_with_budget"]);
      const options = {
        title: "BondOperation: bond budget / purchased / redeemed / expired",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_purchased_redeemed_expired_with_budget"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "coin_budget");
      table.addColumn("number", "exchanged_coins");
      table.addRows(logs["exchanged_coins_with_budget"]);
      const options = {
        title: "OpenMarketOperation: coin budget / exchanged coins",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_exchanged_coins_with_budget"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "exchanged_eth");
      table.addRows(logs["exchanged_eth"]);
      const options = {
        title: "OpenMarketOperation: exchanged ETH",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_exchanged_eth"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "eth_balance");
      table.addRows(logs["eth_balance"]);
      const options = {
        title: "OpenMarketOperation: ETH balance",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_eth_balance"));
      chart.draw(table, options);
    }
    {
      const table = new google.visualization.DataTable();
      table.addColumn("datetime", "");
      table.addColumn("number", "latest_price");
      table.addRows(logs["latest_price"]);
      const options = {
        title: "OpenMarketOperation: ETH / JLC exchanged price",
        legend: {position: "bottom"}};
      const chart = new google.visualization.LineChart(
        $("chart_latest_price"));
      chart.draw(table, options);
    }
  }
}

async function showPriceChart() {
  const coin_budget = parseInt(
    await _open_market_operation_contract.methods.coin_budget_().call());
  if (coin_budget == 0) {
    if ($("price_chart")) {
      $("price_chart").remove();
    }
    return;
  }
  
  let prices = [];
  
  const price_change_interval = parseInt(
    await _open_market_operation_contract.methods.
      PRICE_CHANGE_INTERVAL().call());
  const price_change_percentage = parseInt(
    await _open_market_operation_contract.methods.
      PRICE_CHANGE_PERCENTAGE().call());
  const price_change_max = parseInt(
    await _open_market_operation_contract.methods.
      PRICE_CHANGE_MAX().call());
  const start_price = new BN(
    await _open_market_operation_contract.methods.start_price_().call());
  const epoch_duration =
        parseInt(await _acb_contract.methods.EPOCH_DURATION().call());
  const current_epoch_start =
        parseInt(await _acb_contract.methods.current_epoch_start_().call());
  
  let price = start_price;
  for (let interval = 0; ; interval++) {
    const begin = new Date((current_epoch_start +
                            interval * price_change_interval) * 1000);
    const end = new Date((current_epoch_start +
                          (interval + 1) * price_change_interval) * 1000);
    const now = new Date();
    
    prices.push([begin,
                 parseFloat(_web3.utils.fromWei(price.toString())), NaN]);
    prices.push([end,
                 parseFloat(_web3.utils.fromWei(price.toString())), NaN]);
    if (interval < price_change_max) {
      if (coin_budget > 0) {
        price = price.mul(new BN(100 - price_change_percentage)).
          div(new BN(100));
      } else if (coin_budget < 0) {
        price = price.mul(new BN(100 + price_change_percentage)).
          div(new BN(100));
      }
    }
    
    if (now < end &&
        new Date((current_epoch_start + epoch_duration) * 1000) < end) {
      break;
    }
  }
  
  let max_price =
      parseFloat(_web3.utils.fromWei(BN.max(start_price, price).toString()));
  let min_price =
      parseFloat(_web3.utils.fromWei(BN.min(start_price, price).toString()));
  max_price = max_price * 1.1;
  min_price = min_price * 0.9;
  prices.push([new Date(), NaN, min_price]);
  prices.push([new Date(), NaN, max_price]);
  
  google.charts.load("current", {packages: ["corechart"]});
  google.charts.setOnLoadCallback(drawPriceChart);
  
  function drawPriceChart() {
    const table = new google.visualization.DataTable();
    table.addColumn("datetime", "");
    table.addColumn("number", "price");
    table.addColumn("number", "current time");
    table.addRows(prices);
    const options = {
      title: "Price chart (ETH / JLC)",
      legend: {position: "bottom"},
      vAxis: {
        gridlines: {count: 16},
        viewWindow: {
          min: min_price,
          max: max_price
        }
      }
    };
    const chart = new google.visualization.LineChart($("price_chart"));
    chart.draw(table, options);
  }
}

function showLoading(div, message) {
  div.className = "loading";
  div.innerHTML = "";
  div.appendChild(document.createTextNode(message));
  const dots = document.createTextNode("");
  div.appendChild(dots);
  let count = 0;
  div.loadingTimer = setInterval(() => {
    dots.textContent += ".";
    count++;
    if (count % 6 == 0) {
      dots.textContent = "";
    }
  }, 1000);
}

function showMessage(div, html) {
  if (div.loadingTimer) {
    clearInterval(div.loadingTimer);
    div.loadingTimer = null;
    div.className = null;
  }
  div.innerHTML = html;
}

function showProcessingMessage() {
  let div = $("message_box");
  showLoading(div, "Transaction processing. This may take a few minutes.");
  document.body.scrollIntoView({behavior: "smooth", block: "start"});
}

async function showTransactionSuccessMessage(message, receipt) {
  let div = $("message_box");
  const html =
        "<span class='bold'>Transaction is complete.</span><br>" + message +
        "<br><br>" +
        "It will take some time to commit the transaction. " +
        "Check <a href='" + getEtherScanURL() + "tx/" +
        receipt.transactionHash +
        "' target='_blank' rel='noopener noreferrer'>EtherScan</a> " +
        "in a few minutes.<br>";
  showMessage(div, html);
  div.className = "success";
  document.body.scrollIntoView({behavior: "smooth", block: "start"});
  
  setTimeout(async () => {
    await reloadInfo();
  }, 3000);
}

async function showErrorMessage(message, object) {
  console.log("error: ", object);
  let div = $("message_box");
  div.className = "error";
  div.innerHTML = "<span class='bold'>Error</span>: " + message +
    "<br><br><span class='bold'>Details</span>: " +
    (typeof(object) == "string" ? object.toString() : JSON.stringify(object)) +
    "<br><br>If this is considered to be a bug of JohnLawCoin, " +
    "please file a bug " +
    "<a href='https://github.com/xharaken/john-law-coin/issues' " +
    "' target='_blank' rel='noopener noreferrer'>here</a>.";
  document.body.scrollIntoView({behavior: "smooth", block: "start"});
}

// Helper functions.

async function getCommit(epoch_id) {
  let target_oracle_contract = _oracle_contract;
  if (epoch_id < EPOCH_ID_THAT_UPGRADED_ORACLE) {
    target_oracle_contract =
      await new _web3.eth.Contract(ORACLE_ABI, OLD_ORACLE_ADDRESS);
  }
  const ret = await target_oracle_contract.methods.getCommit(
    epoch_id % 3, _selected_address).call();
  return {voted: ret[4] == epoch_id,
          hash: ret[4] == epoch_id ? ret[0] : ""};
}

async function getSalt(epoch_id) {
  const message = "Vote (Epoch ID = " + epoch_id + ")";
  const key = _selected_address + "-" + message;
  let salt = localStorage[key];
  if (salt) {
    return salt;
  }
  salt = await _web3.utils.sha3(await _web3.eth.personal.sign(
    message, _selected_address));
  localStorage[key] = salt;
  return salt;
}

async function getNextEpochStart() {
  const current_epoch_start_ms =
        parseInt(
          await _acb_contract.methods.current_epoch_start_().call()) * 1000;
  const epoch_duration_ms =
        parseInt(await _acb_contract.methods.EPOCH_DURATION().call()) * 1000;
  return current_epoch_start_ms + epoch_duration_ms;
}

function extractTransactionHash(error) {
  const matched = error.toString().match(/"transactionHash":\s*"([^"]+)"/);
  return matched ? matched[1] : null;
}

function getEtherScanURL() {
  let etherscan_address = "";
  if (_chain_id == 1) {
    etherscan_address = ETHERSCAN_ADDRESS_ON_MAINNET;
  } else if (_chain_id == 3) {
    etherscan_address = ETHERSCAN_ADDRESS_ON_ROPSTEN;
  }
  return etherscan_address;
}

function getACBAddress() {
  let acb_address = ACB_ADDRESS_ON_LOCAL;
  if (_chain_id == 1) {
    acb_address = ACB_ADDRESS_ON_MAINNET;
  } else if (_chain_id == 3) {
    acb_address = ACB_ADDRESS_ON_ROPSTEN;
  }
  return acb_address;
}

function getDateString(timestamp) {
  return (new Date(timestamp)).toLocaleString();
}

function getPhaseString(phase) {
  if (phase == 0) {
    return "COMMIT";
  } else if (phase == 1) {
    return "REVEAL";
  } else if (phase == 2) {
    return "RECLAIM";
  }
  return "";
}

function $(id) {
  return document.getElementById(id);
}
