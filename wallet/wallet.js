// Copyright 2021 Kentaro Hara
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var acb_contract = null;
var oracle_contract = null;
var logging_contract = null;
var coin_contract = null;
var bond_contract = null;
var web3 = null;

window.onload = async () => {
  if (typeof window.ethereum === 'undefined') {
    await showErrorMessage(
        "You need to install Metamask. See https://metamask.io/download.html.",
        null);
    return;
  }
  try {
    web3 = new Web3(window.ethereum);
    console.log(web3);
    acb_contract = await new web3.eth.Contract(ACB_ABI, ACB_ADDRESS);
    console.log(acb_contract);
    const oracle = await acb_contract.methods.oracle_().call();
    oracle_contract = await new web3.eth.Contract(ORACLE_ABI, oracle);
    console.log(oracle_contract);
    const logging = await acb_contract.methods.logging_().call();
    logging_contract = await new web3.eth.Contract(LOGGING_ABI, logging);
    console.log(logging_contract);
    const coin = await acb_contract.methods.coin_().call();
    coin_contract = await new web3.eth.Contract(JOHNLAWCOIN_ABI, coin);
    console.log(coin_contract);
    const bond = await acb_contract.methods.bond_().call();
    bond_contract = await new web3.eth.Contract(JOHNLAWBOND_ABI, bond);
    console.log(bond_contract);
  } catch (error) {
    console.log(error);
    await showErrorMessage("Cannot connect to the smart contracts.", error);
    return;
  }

  $("send_coins_button").addEventListener("click", sendCoins);
  $("purchase_bonds_button").addEventListener("click", purchaseBonds);
  $("redeem_bonds_button").addEventListener("click", redeemBonds);
  $("vote_button").addEventListener("click", vote);
  $("reload_button").addEventListener("click", async (event) => {
    event.preventDefault();
    await reloadInfo();
  });
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
    const receipt = await coin_contract.methods.transfer(address, amount).send(
        {from: ethereum.selectedAddress});
    console.log(receipt);
    if (!receipt.events.Transfer) {
      throw null;
    }
    const ret = receipt.events.Transfer.returnValues;
    const message = "Sent " + ret.value + " coins to " + ret.to + ".";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    console.log(error);
    await showErrorMessage("Couldn't send coins.", error);
    return;
  }
}

async function purchaseBonds() {
  try {
    const amount = $("purchase_bonds_amount").value;
    const bond_budget =
          parseInt(await acb_contract.methods.bond_budget_().call());
    if (amount > bond_budget) {
      await showErrorMessage(
          "The ACB's current bond budget is " + bond_budget +
            ". You cannot purchase bonds larger than this budget.", null);
      return;
    }
    const receipt =
          await acb_contract.methods.purchaseBonds(amount).send(
              {from: ethereum.selectedAddress});
    console.log(receipt);
    if (!receipt.events.PurchaseBondsEvent) {
      throw null;
    }
    const ret = receipt.events.PurchaseBondsEvent.returnValues;
    const message = "Purchased " + ret.count +
          " bonds. The redemption timestamp is " +
          getDateString(parseInt(ret.redemption_timestamp) * 1000) + ".";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    console.log(error);
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
    console.log(redemption_timestamps);

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
    console.log(redeemable_timestamps);

    const receipt = await acb_contract.methods.redeemBonds(
        redeemable_timestamps).send({from: ethereum.selectedAddress});
    console.log(receipt);
    if (!receipt.events.RedeemBondsEvent) {
      throw null;
    }
    const ret = receipt.events.RedeemBondsEvent.returnValues;
    let message = "Redeemed " + ret.count + " bonds.";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    console.log(error);
    await showErrorMessage("Couldn't redeem bonds.", error);
    return;
  }
}

async function vote() {
  try {
    const invalid_level = 100;
    const commit_level = $("vote_commit_level").value || invalid_level;
    const commit_salt = $("vote_commit_salt").value || 0;
    const reveal_level = $("vote_reveal_level").value || invalid_level;
    const reveal_salt = $("vote_reveal_salt").value || 0;

    const hash = commit_level == invalid_level ?
          await acb_contract.NULL_HASH() :
          await acb_contract.methods.hash(commit_level, commit_salt).call();
    const receipt = await acb_contract.methods.vote(
        hash, reveal_level, reveal_salt).send({from: ethereum.selectedAddress});
    console.log(receipt);
    if (!receipt.events.VoteEvent) {
      throw null;
    }
    const ret = receipt.events.VoteEvent.returnValues;
    const message =
          (ret.commit_result ? "Commit succeeded. You voted for the oracle " +
           "level " + commit_level + ". You deposited " + ret.deposited +
           " coins." :
           "Commit failed. You can vote only once per phase.") + "<br>" +
          (ret.reveal_result ? "Reveal succeeded." :
           "Reveal failed (probably because the specified oracle level " +
           "and/or the salt didn't match the oracle level and/or the salt " +
           "in your previous vote).") + "<br>" +
          "You reclaimed " + ret.reclaimed + " coins and got " +
           ret.rewarded + " coins as a reward.";
    await showTransactionSuccessMessage(message, receipt);
  } catch (error) {
    console.log(error);
    await showErrorMessage("Couldn't vote.", error);
    return;
  }
}

async function reloadInfo() {
  $("message_box").innerHTML = "";

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
        bond_balance + "</td></tr></table>";
    const epoch_timestamp =
          parseInt(await oracle_contract.methods.epoch_timestamp_().call());
    const commit = await oracle_contract.methods.getCommit(
        epoch_timestamp % 3, ethereum.selectedAddress).call();
    html += "<tr><td>Voted</td><td class='right'>" +
        (commit[0] == 0 ? "Not yet" : "Done") + "</td></tr></table>";
    $("account_info_loading").style.display = "none";
    $("account_info").innerHTML = html;

    html = "<table><tr><td>Contract address</td><td class='right'>" +
        ACB_ADDRESS + "</td></tr>";
    html += "<tr><td>Total coin supply</td><td class='right'>" +
        (await coin_contract.methods.totalSupply().call()) + "</td></tr>";
    html += "<tr><td>Total bond supply</td><td class='right'>" +
        (await bond_contract.methods.totalSupply().call()) + "</td></tr>";
    const bond_budget =
          parseInt(await acb_contract.methods.bond_budget_().call());
    html += "<tr><td>Bond budget</td><td class='right'>" +
        bond_budget + "</td></tr>";
    html += "<tr><td>Current time</td><td class='right'>" +
        getDateString(Date.now()) + "</td></tr>";
    const current_phase_start_ms =
          parseInt(
              await acb_contract.methods.current_phase_start_().call()) * 1000;
    html += "<tr><td>Current phase started</td><td class='right'>" +
        getDateString(current_phase_start_ms) + "</td></tr>";
    const phase_duration_ms =
          parseInt(await acb_contract.PHASE_DURATION()) * 1000;
    html += "<tr><td>Next phase will start</td><td class='right'>" +
        getDateString(current_phase_start_ms + phase_duration_ms) +
        "</td></tr>";
    html += "<tr><td>Oracle level</td><td class='right'>" +
        getOracleLevelString(
            parseInt(await acb_contract.methods.oracle_level_().call()))
        + "</td></tr>";
    $("acb_info_loading").style.display = "none";
    $("acb_info").innerHTML = html;

    if (bond_budget > 0) {
      $("purchase_bonds_button").disabled = false;
    } else {
      $("purchase_bonds_button").disabled = true;
      $("purchase_bonds_button_disabled").innerText =
          " [You can purchase bonds only when the ACB's bond budget " +
          "is positive. The current ACB's bond budget is " + bond_budget + ".]";
    }

    if (commit[0] == 0) {
      $("vote_button").disabled = false;
    } else {
      $("vote_button").disabled = true;
      $("vote_button_disabled").innerText =
          " [You can vote only once per phase. Please wait until the next " +
          "phase starts. The next phase will start around " +
          getDateString(current_phase_start_ms + phase_duration_ms) + ".]";
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
    $("bond_list").innerHTML = bond_list_html;
    $("bond_list_loading").style.display = "none";

    if (has_redeemable) {
      $("redeem_bonds_button").disabled = false;
    } else {
      $("redeem_bonds_button").disabled = true;
      $("redeem_bonds_button_disabled").innerText =
          " [You don't have any redeemable bonds.]";
    }
  } catch (error) {
    console.log(error);
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
  const epoch_timestamp =
        parseInt(await oracle_contract.methods.epoch_timestamp_().call());
  const level_max = parseInt(await oracle_contract.LEVEL_MAX());
  html += "<table><tr><td>epoch_timestamp_</td><td class='right'>" +
      epoch_timestamp + "</td></tr></table>";
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
    for (let level = 0; level < level_max; level++) {
      const ret = await oracle_contract.methods.getVote(index, level).call();
      html += "<tr><td>level " + level + "</td><td class='right'>";
      html += "deposit: " + ret[0] + ", count: " + ret[1] +
          ", reclaim: " + ret[2] + ", reward: " + ret[3];
      html += "</td></tr>";
    }
    html += "</table>";
  }
  $("oracle_status_loading").style.display = "none";
  $("oracle_status").innerHTML = html;
}

async function showLoggingStatus() {
  let html = "";
  const log_index =
        parseInt(await logging_contract.methods.log_index_().call());
  for (let index of [log_index, log_index - 1]) {
    if (index < 0) {
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
  $("logging_status_loading").style.display = "none";
  $("logging_status").innerHTML = html;
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
  for (let index = 0; index <= log_index; index++) {
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

async function showTransactionSuccessMessage(message, receipt) {
  await reloadInfo();
  let div = $("message_box");
  div.className = "success";
  div.innerHTML =
      "<span class='bold'>Transaction succeeded</span>:<br>" + message +
      "<br><br>" +
      "See the transaction in EtherScan.<br><br>" +
      "<a href='' id='transaction_log'>Show the transaction log.</a>";
  $("transaction_log").addEventListener("click", (event) => {
    $("transaction_log").remove();
    div.innerHTML += "<br>" + JSON.stringify(receipt);
    event.preventDefault();
  });
  document.body.scrollIntoView({behavior: "smooth", block: "start"});
}

async function showErrorMessage(message, object) {
  let div = $("message_box");
  div.className = "error";
  div.innerHTML =
      "<span class='bold'>Error</span>: " + message +
      (object ? "<br><br>" + object.toString() : "");
  document.body.scrollIntoView({behavior: "smooth", block: "start"});
}

function getDateString(timestamp) {
  return (new Date(timestamp)).toLocaleString();
}

function getOracleLevelString(level) {
  const exchange_rates = await acb_contract.LEVEL_TO_EXCHANGE_RATE();
  const exchange_rate_divisor = await acb_contract.EXCHANGE_RATE_DIVISOR();
  const bond_prices = await acb_contract.LEVEL_TO_BOND_PRICE();
  const tax_rates = await acb_contract.LEVEL_TO_TAX_RATE();
  const level_max = parseInt(await oracle_contract.LEVEL_MAX());
  if (0 <= level && level < level_max) {
    return level + " (1 coin = " +
        exchange_rates[level] / exchange_rate_divisor + " USD, " +
        "Bond issue price = " + bond_prices[level] + " coins, " +
        "Tax rate = " + tax_rates[level] + "%)";
  }
  return "undefined";
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
