// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

var acb_contract = null;
var oracle_contract = null;
var logging_contract = null;
var coin_contract = null;
var bond_contract = null;
var web3 = null;

window.onload = async () => {
  $("message_box").innerHTML = "";
  showLoading($("account_info"), "Loading.");
  showLoading($("acb_info"), "Loading.");
  showLoading($("bond_list"), "Loading.");
  showLoading($("oracle_status"), "Loading.");
  showLoading($("logging_status"), "Loading.");
    
  if (typeof window.ethereum === 'undefined') {
    await showErrorMessage(
      "You need to install Metamask. See https://metamask.io/download.html.",
      null);
    return;
  }
  try {
    ethereum.on("accountsChanged", (accounts) => {
      window.location.reload();
    });
    ethereum.on("chainChanged", (chainId) => {
      window.location.reload();
    });
    
    web3 = new Web3(window.ethereum);
    console.log("web3: ", web3);
    
    const acb_address = await getACBAddress();
    acb_contract = await new web3.eth.Contract(ACB_ABI, acb_address);
    console.log("ACB contract: ", acb_contract);
    const oracle = await acb_contract.methods.oracle_().call();
    oracle_contract = await new web3.eth.Contract(ORACLE_ABI, oracle);
    console.log("Oracle contract: ", oracle_contract);
    const logging = await acb_contract.methods.logging_().call();
    logging_contract = await new web3.eth.Contract(LOGGING_ABI, logging);
    console.log("Logging contract: ", logging_contract);
    const coin = await acb_contract.methods.coin_().call();
    coin_contract = await new web3.eth.Contract(JOHNLAWCOIN_ABI, coin);
    console.log("JohnLawCoin contract: ", coin_contract);
    const bond = await acb_contract.methods.bond_().call();
    bond_contract = await new web3.eth.Contract(JOHNLAWBOND_ABI, bond);
    console.log("JohnLawBond contract: ", bond_contract);
    console.log("selectedAddress: ", ethereum.selectedAddress);
  } catch (error) {
    await showErrorMessage("Cannot connect to the smart contracts.", error);
    return;
  }
  
  $("send_coins_button").addEventListener("click", sendCoins);
  $("purchase_bonds_button").addEventListener("click", purchaseBonds);
  $("redeem_bonds_button").addEventListener("click", redeemBonds);
  $("vote_button").addEventListener("click", vote);
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

async function sendCoins() {
  try {
    const address = $("send_coins_address").value;
    const amount = $("send_coins_amount").value;
    
    if (amount <= 0) {
      await showErrorMessage("You need to send at least one coin.", null);
      return;
    }
    const coin_balance =
          parseInt(await coin_contract.methods.balanceOf(
            ethereum.selectedAddress).call());
    if (amount >= coin_balance) {
      await showErrorMessage("You don't have enough coin balance.", null);
      return;
    }
    
    const promise = coin_contract.methods.transfer(address, amount).send(
      {from: ethereum.selectedAddress});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.TransferEvent) {
      throw receipt;
    }
    const ret = receipt.events.TransferEvent.returnValues;
    const message = "Sent " + ret.amount + " coins to " + ret.to + ". " +
          "Paid " + ret.tax + " coins as a tax.";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    await showErrorMessage("Couldn't send coins.", error);
    return;
  }
}

async function purchaseBonds() {
  try {
    const amount = $("purchase_bonds_amount").value;
    
    if (amount <= 0) {
      await showErrorMessage("You need to purchase at least one bond.", null);
      return;
    }
    const bond_budget =
          parseInt(await acb_contract.methods.bond_budget_().call());
    if (amount > bond_budget) {
      await showErrorMessage(
        "The ACB's current bond budget is " + bond_budget +
          ". You cannot purchase bonds larger than this budget.", null);
      return;
    }
    const coin_balance =
          parseInt(await coin_contract.methods.balanceOf(
            ethereum.selectedAddress).call());
    let bond_price = BOND_PRICES[LEVEL_MAX - 1];
    const oracle_level =
          parseInt(await acb_contract.methods.oracle_level_().call());
    if (0 <= oracle_level && oracle_level < LEVEL_MAX) {
      bond_price = BOND_PRICES[oracle_level];
    }
    if (coin_balance < amount * bond_price) {
      await showErrorMessage(
        "You don't have enough coin balance to purchase the bonds.",
        null);
      return;
    }
    
    const promise = acb_contract.methods.purchaseBonds(amount).send(
      {from: ethereum.selectedAddress});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.PurchaseBondsEvent) {
      throw receipt;
    }
    const ret = receipt.events.PurchaseBondsEvent.returnValues;
    const message = "Purchased " + ret.count +
          " bonds. The redemption timestamp is " +
          getDateString(parseInt(ret.redemption_timestamp) * 1000) + ".";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    await showErrorMessage("Couldn't purchase bonds.", error);
    return;
  }
}

async function redeemBonds() {
  try {
    const bond_budget =
      -(parseInt(await acb_contract.methods.bond_budget_().call()));
    const redemption_count =
          parseInt(await bond_contract.methods.
                   numberOfRedemptionTimestampsOwnedBy(
                     ethereum.selectedAddress).call());
    let redemption_timestamps = [];
    for (let index = 0; index < redemption_count; index++) {
      const redemption_timestamp =
            parseInt(await bond_contract.methods.
                     getRedemptionTimestampOwnedBy(
                       ethereum.selectedAddress, index).call());
      redemption_timestamps.push(redemption_timestamp);
    }
    redemption_timestamps =
      redemption_timestamps.sort((a, b) => { return a - b; });
    console.log("redemption_timestamps: ", redemption_timestamps);
    
    let redeemable_timestamps = [];
    let bond_count = 0;
    for (let redemption_timestamp of redemption_timestamps) {
      if (parseInt(redemption_timestamp) * 1000 < Date.now()) {
        redeemable_timestamps.push(redemption_timestamp);
      } else if (bond_count < bond_budget) {
        redeemable_timestamps.push(redemption_timestamp);
        const balance =
              parseInt(await bond_contract.methods.balanceOf(
                ethereum.selectedAddress, redemption_timestamp).call());
        bond_count += balance;
      }
    }
    console.log("redeemable_timestamps: ", redeemable_timestamps);
    
    const promise = acb_contract.methods.redeemBonds(
      redeemable_timestamps).send({from: ethereum.selectedAddress});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.RedeemBondsEvent) {
      throw receipt;
    }
    const ret = receipt.events.RedeemBondsEvent.returnValues;
    let message = "Redeemed " + ret.count + " bonds.";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    await showErrorMessage("Couldn't redeem bonds.", error);
    return;
  }
}

async function getCommit(phase_id) {
  let target_oracle_contract = oracle_contract;
  if (phase_id < PHASE_ID_THAT_UPGRADED_ORACLE) {
    target_oracle_contract =
      await new web3.eth.Contract(ORACLE_ABI, OLD_ORACLE_ADDRESS);
  }
  const ret = await target_oracle_contract.methods.getCommit(
    phase_id % 3, ethereum.selectedAddress).call();
  return {voted: ret[4] == phase_id,
          hash: ret[4] == phase_id ? ret[0] : ""};
}

async function getSalt(phase_id) {
  const key = ethereum.selectedAddress + "-" + phase_id;
  let salt = localStorage[key];
  if (salt) {
    return salt;
  }
  salt = await web3.utils.sha3(await web3.eth.personal.sign(
    "You are voting (Phase ID = " + phase_id + ")",
    ethereum.selectedAddress));
  localStorage[key] = salt;
  return salt;
}

async function getNextPhaseStart() {
  const current_phase_start_ms =
        parseInt(
          await acb_contract.methods.current_phase_start_().call()) * 1000;
  const phase_duration_ms =
        parseInt(await acb_contract.methods.PHASE_DURATION().call()) * 1000;
  return current_phase_start_ms + phase_duration_ms;
}

async function vote() {
  try {
    const current_level = $("vote_oracle_level").value || LEVEL_MAX;
    
    const phase_id = parseInt(
      await oracle_contract.methods.phase_id_().call());
    const current_phase_id =
          (await getNextPhaseStart()) < Date.now() ?
          phase_id + 1 : phase_id;
    console.log("current_phase_id: ", current_phase_id);
    console.log("phase_id: ", phase_id);
    
    const current_salt = await getSalt(current_phase_id);
    console.log("current_salt: ", current_salt);
    const current_commit = await getCommit(current_phase_id);
    const previous_commit = await getCommit(current_phase_id - 1);
    
    if (current_commit.voted) {
      await showErrorMessage("You have already voted in this phase. " +
                             "You can vote only once per phase.");
      return;
    }
    
    const null_hash = await acb_contract.methods.NULL_HASH().call();
    let previous_level = LEVEL_MAX;
    let previous_salt = 0;
    if (previous_commit.voted && previous_commit.hash != null_hash) {
      let found = false;
      let retry = 0;
      for (let previous_phase_id = current_phase_id;
           previous_phase_id >= 0 && retry < 3 && !found;
           previous_phase_id--) {
        previous_salt = await getSalt(previous_phase_id);
        for (let level = 0; level < LEVEL_MAX; level++) {
          const hash = await acb_contract.methods.hash(
            level, previous_salt).call({from: ethereum.selectedAddress});
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
            "the same Ethereum address for the current vote and " +
            "the previous vote. This may also happen when your browser's " +
            "local storage is broken.\n\n" +
            "Do you want to forcibly proceed? Then you will lose " +
            "the deposited coins for your previous vote.\n");
        if (!ret) {
          await showErrorMessage("Vote cancelled.");
          return;
        }
      }
    }
    console.log("previous_salt: ", previous_salt);
    console.log("previous_level: ", previous_level);

    const hash = current_level == LEVEL_MAX ? null_hash :
          await acb_contract.methods.hash(current_level, current_salt).call(
            {from: ethereum.selectedAddress});
    const promise = acb_contract.methods.vote(
      hash, previous_level, previous_salt).send(
        {from: ethereum.selectedAddress});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    if (!receipt.events.VoteEvent) {
      throw receipt;
    }
    const ret = receipt.events.VoteEvent.returnValues;
    const message =
          (ret.commit_result ? "Commit succeeded. You voted for the oracle " +
           "level " + current_level + ". You deposited " + ret.deposited +
           " coins." :
           "Commit failed. You can vote only once per phase.") + "<br>" +
          (ret.reveal_result ? "Reveal succeeded." :
           "Reveal failed. Your vote in the previous phase was not found.") +
          "<br>" + "You reclaimed " + ret.reclaimed + " coins and got " +
          ret.rewarded + " coins as a reward.";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    await showErrorMessage("Couldn't vote.", error);
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
    const amount = web3.utils.toWei(eth);
    const acb_address = await getACBAddress();
    const promise = web3.eth.sendTransaction(
      {from: ethereum.selectedAddress, to: acb_address, value: amount});
    showProcessingMessage();
    const receipt = await promise;
    console.log("receipt: ", receipt);
    const message = "Donated " + amount + " weis. Thank you very much!!";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    await showErrorMessage("Couldn't donate.", error);
    return;
  } 
}

async function reloadInfo() {
  if (!ethereum.selectedAddress) {
    await showErrorMessage(
      "Please click the Metamask extension and log in. Then reload the page.",
      null);
    return;
  }
  
  try {
    let html = "";
    
    html += "<table><tr><td>Account address</td><td class='right'>" +
      ethereum.selectedAddress + "</td></tr>";
    const coin_balance =
          parseInt(await coin_contract.methods.balanceOf(
            ethereum.selectedAddress).call());
    html += "<tr><td>Coin balance</td><td class='right'>" +
      coin_balance + "</td></tr>";
    const bond_balance =
          parseInt(await bond_contract.methods.numberOfBondsOwnedBy(
            ethereum.selectedAddress).call());
    html += "<tr><td>Bond balance</td><td class='right'>" +
      bond_balance + "</td></tr>";
    const phase_id =
          parseInt(await oracle_contract.methods.phase_id_().call());
    const current_commit = await getCommit(phase_id);
    html += "<tr><td>Voted</td><td class='right'>" +
      (current_commit.voted ? "Done" : "Not yet") +
      "</td></tr></table>";
    showMessage($("account_info"), html);
    
    html = "<table><tr><td>Contract address</td><td class='right'>" +
      acb_contract._address.toLowerCase() + "</td></tr>";
    html += "<tr><td>Total coin supply</td><td class='right'>" +
      (await coin_contract.methods.totalSupply().call()) + "</td></tr>";
    html += "<tr><td>Total bond supply</td><td class='right'>" +
      (await bond_contract.methods.totalSupply().call()) + "</td></tr>";
    const bond_budget =
          parseInt(await acb_contract.methods.bond_budget_().call());
    html += "<tr><td>Bond budget</td><td class='right'>" +
      bond_budget + "</td></tr>";
    html += "<tr><td>Oracle level</td><td class='right'>" +
      getOracleLevelString(
        parseInt(await acb_contract.methods.oracle_level_().call()))
      + "</td></tr>";
    html += "<tr><td>Current phase ID</td><td class='right'>" +
      parseInt(await oracle_contract.methods.phase_id_().call())
      + "</td></tr>";
    const current_phase_start_ms =
          parseInt(
            await acb_contract.methods.current_phase_start_().call()) * 1000;
    html += "<tr><td>Current phase started</td><td class='right'>" +
      getDateString(current_phase_start_ms) + "</td></tr>";
    const next_phase_start_ms = await getNextPhaseStart();
    html += "<tr><td>Next phase will start</td><td class='right'>" +
      getDateString(next_phase_start_ms) + " plus/minus 5 mins</td></tr>";
    html += "<tr><td>Current time</td><td class='right'>" +
      getDateString(Date.now()) + "</td></tr>";
    showMessage($("acb_info"), html);
    
    if (bond_budget > 0) {
      $("purchase_bonds_button").disabled = false;
      $("purchase_bonds_button_disabled").innerText = "";
    } else {
      $("purchase_bonds_button").disabled = true;
      $("purchase_bonds_button_disabled").innerText =
        " [You can purchase bonds only when the ACB's bond budget " +
        "is positive. The current ACB's bond budget is " +
        bond_budget + ".]";
    }
    
    const next_phase_id =
          next_phase_start_ms < Date.now() ?
          phase_id + 1 : phase_id;
    console.log("next_phase_id:", next_phase_id);
    const next_commit = await getCommit(next_phase_id);
    if (!next_commit.voted) {
      $("vote_button").disabled = false;
      $("vote_button_disabled").innerText = "";
    } else {
      $("vote_button").disabled = true;
      $("vote_button_disabled").innerText =
        " [You can vote only once per phase. Please wait until the next " +
        "phase starts. The next phase will start around " +
        getDateString(next_phase_start_ms) + ".]";
    }
    
    let has_redeemable = false;
    let bond_list_html = "You have " + bond_balance + " bonds in total.";
    if (bond_balance > 0) {
      bond_list_html += "<br><br><table><tr><td>Redemption timestamp</td>" +
        "<td># of bonds</td><td>Redeemable?</td></tr>";
      const redemption_count =
            parseInt(await bond_contract.methods.
                     numberOfRedemptionTimestampsOwnedBy(
                       ethereum.selectedAddress).call());
      let redemption_timestamps = [];
      for (let index = 0; index < redemption_count; index++) {
        const redemption_timestamp =
              parseInt(await bond_contract.methods.
                       getRedemptionTimestampOwnedBy(
                         ethereum.selectedAddress, index).call());
        redemption_timestamps.push(redemption_timestamp);
      }
      redemption_timestamps =
        redemption_timestamps.sort((a, b) => { return a - b; });
      
      for (let redemption_timestamp of redemption_timestamps) {
        const balance =
              parseInt(await bond_contract.methods.balanceOf(
                ethereum.selectedAddress, redemption_timestamp).call());
        const redemption_timestamp_ms = parseInt(redemption_timestamp) * 1000;
        bond_list_html += "<tr><td>" + getDateString(redemption_timestamp_ms) +
          "</td><td class='right'>" + balance + "</td><td>" +
          (redemption_timestamp_ms < Date.now() ? "Yes" :
           "As long as the ACB's bond budget is negative") + "</td></tr>";
        if (redemption_timestamp_ms < Date.now()) {
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
    await showErrorMessage("Cannot reload infomation.", error);
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
  const phase_id =
        parseInt(await oracle_contract.methods.phase_id_().call());
  html += "<table><tr><td>phase_id_</td><td class='right'>" +
    phase_id + "</td></tr></table>";
  for (let index = 0; index < 3; index++) {
    html += "<br>Epoch " + index + "<br><table>";
    const ret = await oracle_contract.methods.getEpoch(index).call();
    html += "<tr><td>deposited</td><td class='right'>" +
      (await coin_contract.methods.balanceOf(ret[0]).call()) +
      "</td></tr>";
    html += "<tr><td>to_be_rewarded</td><td class='right'>" +
      (await coin_contract.methods.balanceOf(ret[1]).call()) + "</td></tr>";
    html += "<tr><td>reward_total</td><td class='right'>" +
      ret[2] + "</td></tr>";
    html += "<tr><td>phase</td><td class='right'>" +
      getPhaseString(ret[3]) + "</td></tr>";
    for (let level = 0; level < LEVEL_MAX; level++) {
      const ret = await oracle_contract.methods.getVote(index, level).call();
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
  const log_index =
        parseInt(await logging_contract.methods.log_index_().call());
  for (let index of [log_index, log_index - 1]) {
    if (index <= 0) {
      continue;
    }
    const vote_log =
          await logging_contract.methods.getVoteLog(index).call();
    const acb_log = await logging_contract.methods.getACBLog(index).call();
    html += index == log_index ? "Current" : "<br>Previous";
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
      acb_log[0] + "</td></tr>";
    html += "<tr><td>burned_coins</td><td class='right'>" +
      acb_log[1] + "</td></tr>";
    html += "<tr><td>coin_supply_delta</td><td class='right'>" +
      acb_log[2] + "</td></tr>";
    html += "<tr><td>bond_budget</td><td class='right'>" +
      acb_log[3] + "</td></tr>";
    html += "<tr><td>coin_total_supply</td><td class='right'>" +
      acb_log[4] + "</td></tr>";
    html += "<tr><td>bond_total_supply</td><td class='right'>" +
      acb_log[5] + "</td></tr>";
    html += "<tr><td>oracle_level</td><td class='right'>" +
      acb_log[6] + "</td></tr>";
    html += "<tr><td>current_phase_start</td><td class='right'>" +
      acb_log[7] + "</td></tr>";
    html += "<tr><td>burned_tax</td><td class='right'>" +
      acb_log[8] + "</td></tr>";
    html += "<tr><td>purchased_bonds</td><td class='right'>" +
      acb_log[9] + "</td></tr>";
    html += "<tr><td>redeemed_bonds</td><td class='right'>" +
      acb_log[10] + "</td></tr>";
    html += "</table>"
  }
  showMessage($("logging_status"), html);
}

async function showHistoryChart() {
  google.load("visualization", "1", {packages:["corechart"]});
  google.setOnLoadCallback(drawChart);
}

async function drawChart() {
  let logs = {};
  logs["vote"] = [];
  logs["deposited_reclaimed_rewarded"] = [];
  logs["minted_burned_tax"] = [];
  logs["coin_supply_delta"] = [];
  logs["bond_budget"] = [];
  logs["purchased_redeemed"] = [];
  logs["coin_total_supply"] = [];
  logs["bond_total_supply"] = [];
  logs["oracle_level"] = [];
  
  const log_index =
        parseInt(await logging_contract.methods.log_index_().call());
  for (let index = 1; index <= log_index; index++) {
    const vote_log =
          await logging_contract.methods.getVoteLog(index).call();
    const acb_log = await logging_contract.methods.getACBLog(index).call();
    const date = new Date(parseInt(acb_log[7]) * 1000);
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
    logs["minted_burned_tax"].push([date,
                                    parseInt(acb_log[0]),
                                    parseInt(acb_log[1]),
                                    parseInt(acb_log[8])]);
    logs["coin_supply_delta"].push([date, parseInt(acb_log[2])]);
    logs["bond_budget"].push([date, parseInt(acb_log[3])]);
    logs["purchased_redeemed"].push([date,
                                     parseInt(acb_log[9]),
                                     parseInt(acb_log[10])]);
    logs["coin_total_supply"].push([date, parseInt(acb_log[4])]);
    logs["bond_total_supply"].push([date, parseInt(acb_log[5])]);
    logs["oracle_level"].push([date, parseInt(acb_log[6])]);
  }
  
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
    const options = {title: "Oracle: vote statistics",
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
    const options = {title: "Oracle: deposited / reclaimed / rewarded coins",
                     legend: {position: "bottom"}};
    const chart = new google.visualization.LineChart(
      $("chart_deposited_reclaimed_rewarded"));
    chart.draw(table, options);
  }
  {
    const table = new google.visualization.DataTable();
    table.addColumn("datetime", "");
    table.addColumn("number", "minted_coins");
    table.addColumn("number", "burned_coins");
    table.addColumn("number", "burned_tax");
    table.addRows(logs["minted_burned_tax"]);
    const options = {title: "ACB: minted coins / burned coins / burned tax",
                     legend: {position: "bottom"}};
    const chart = new google.visualization.LineChart(
      $("chart_minted_burned_tax"));
    chart.draw(table, options);
  }
  {
    const table = new google.visualization.DataTable();
    table.addColumn("datetime", "");
    table.addColumn("number", "coin_supply_delta");
    table.addRows(logs["coin_supply_delta"]);
    const options = {title: "ACB: coin_supply_delta",
                     legend: {position: "bottom"}};
    const chart = new google.visualization.LineChart(
      $("chart_coin_supply_delta"));
    chart.draw(table, options);
  }
  {
    const table = new google.visualization.DataTable();
    table.addColumn("datetime", "");
    table.addColumn("number", "bond_budget");
    table.addRows(logs["bond_budget"]);
    const options = {title: "ACB: bond_budget",
                     legend: {position: "bottom"}};
    const chart = new google.visualization.LineChart(
      $("chart_bond_budget"));
    chart.draw(table, options);
  }
  {
    const table = new google.visualization.DataTable();
    table.addColumn("datetime", "");
    table.addColumn("number", "purchased_bonds");
    table.addColumn("number", "redeemed_bonds");
    table.addRows(logs["purchased_redeemed"]);
    const options = {title: "ACB: purchased / redeemed bonds",
                     legend: {position: "bottom"}};
    const chart = new google.visualization.LineChart(
      $("chart_purchased_redeemed"));
    chart.draw(table, options);
  }
  {
    const table = new google.visualization.DataTable();
    table.addColumn("datetime", "");
    table.addColumn("number", "coin_total_supply");
    table.addRows(logs["coin_total_supply"]);
    const options = {title: "ACB: coin_total_supply",
                     legend: {position: "bottom"}};
    const chart = new google.visualization.LineChart(
      $("chart_coin_total_supply"));
    chart.draw(table, options);
  }
  {
    const table = new google.visualization.DataTable();
    table.addColumn("datetime", "");
    table.addColumn("number", "bond_total_supply");
    table.addRows(logs["bond_total_supply"]);
    const options = {title: "ACB: bond_total_supply",
                     legend: {position: "bottom"}};
    const chart = new google.visualization.LineChart(
      $("chart_bond_total_supply"));
    chart.draw(table, options);
  }
  {
    const table = new google.visualization.DataTable();
    table.addColumn("datetime", "");
    table.addColumn("number", "oracle_level");
    table.addRows(logs["oracle_level"]);
    const options = {title: "oracle_level",
                     legend: {position: "bottom"}};
    const chart = new google.visualization.LineChart(
      $("chart_oracle_level"));
    chart.draw(table, options);
  }
}

function showLoading(div, message) {
  div.innerHTML = "";
  div.appendChild(document.createTextNode(message));
  const dots = document.createTextNode("");
  div.appendChild(dots);
  let count = 0;
  div.loadingTimer = setInterval(() => {
    dots.textContent += ".";
    count++;
    if (count % 4 == 0) {
      dots.textContent = "";
    }
  }, 1000);
}

function showMessage(div, html) {
  if (div.loadingTimer) {
    clearInterval(div.loadingTimer);
    div.loadingTimer = null;
  }
  div.innerHTML = html;
}

function showProcessingMessage() {
  let div = $("message_box");
  div.className = "success";
  showLoading(div, "Transaction processing. This may take a few minutes.");
  document.body.scrollIntoView({behavior: "smooth", block: "start"});
}

async function showTransactionSuccessMessage(message, receipt) {
  const etherscan_url = await getEtherScanURL();  
  let div = $("message_box");
  div.className = "success";
  const html =
        "<span class='bold'>Transaction succeeded</span>:<br>" + message +
        "<br><br>" +
        "It will take some time to commit the transaction. " +
        "Check <a href='" + etherscan_url + receipt.transactionHash +
        "' target='_blank' rel='noopener noreferrer'>EtherScan</a> " +
        "in a few minutes.<br>";
  showMessage(div, html);
  document.body.scrollIntoView({behavior: "smooth", block: "start"});

  setTimeout(async () => {
    await reloadInfo();
  }, 3000);
}

async function showErrorMessage(message, object) {
  console.log("error: ", object);
  const etherscan_url = await getEtherScanURL();  
  let div = $("message_box");
  div.className = "error";
  div.innerHTML = "<span class='bold'>Error</span>: " + message +
    (object ? "<br><br>Details: " +
     (object.transactionHash ?
      " Check the transaction in " +
      "<a href='" + etherscan_url + object.transactionHash +
      "' target='_blank' rel='noopener noreferrer'>EtherScan</a> " +
      "in a few minutes. The transaction may be marked as success but " +
      "it couldn't fulfill your order." : "") +
     "<br>" + object.toString() +
     "<br>" + JSON.stringify(object) : "");
  document.body.scrollIntoView({behavior: "smooth", block: "start"});
}

async function getEtherScanURL() {
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  console.log("chainId: ", chainId);
  let etherscan_address = "";
  if (chainId == 1) {
    etherscan_address = ETHERSCAN_ADDRESS_ON_MAINNET;
  } else if (chainId == 3) {
    etherscan_address = ETHERSCAN_ADDRESS_ON_ROPSTEN;
  }
  return etherscan_address;
}

async function getACBAddress() {
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  console.log("chainId: ", chainId);
  let acb_address = ACB_ADDRESS_ON_LOCAL;
  if (chainId == 1) {
    acb_address = ACB_ADDRESS_ON_MAINNET;
  } else if (chainId == 3) {
    acb_address = ACB_ADDRESS_ON_ROPSTEN;
  }
  return acb_address;
}

function getDateString(timestamp) {
  return (new Date(timestamp)).toLocaleString();
}

function getOracleLevelString(level) {
  if (0 <= level && level < LEVEL_MAX) {
    return "Oracle level = " + level +
      "<br>1 coin = " + EXCHANGE_RATES[level] + " USD" +
      "<br>Bond issue price = " + BOND_PRICES[level] + " coins" +
      "<br>Tax rate = " + TAX_RATES[level] + "%";
  } else if (level == LEVEL_MAX) {
    return "Oracle level = undefined (no vote was made)" +
      "<br>Bond issue price = " + BOND_PRICES[LEVEL_MAX - 1] + " coins" +
      "<br>Tax rate = 0%";
  }
  throw null;
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
