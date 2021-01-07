const TokenSupply = artifacts.require("TokenSupply");
const TokenHolder = artifacts.require("TokenHolder");

contract("TokenUnittest", function (accounts) {
  it("test", async function () {
    return assert.isTrue(true);
  });

  it("TokenSupply and TokenHolder", async function () {
    supply = await TokenSupply.new();
    assert.equal(await supply.amount_(), 0);

    holder1 = await TokenHolder.new(supply.address);
    assert.equal(await holder1.amount_(), 0);

    // mint
    let receipt;
    let args;
    receipt = await supply.mint(holder1.address, 10);
    args = receipt.logs.filter(e => e.event == 'MintEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 10);
    assert.equal(await supply.amount_(), 10);
    assert.equal(await holder1.amount_(), 10);

    receipt = await supply.mint(holder1.address, 20);
    args = receipt.logs.filter(e => e.event == 'MintEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 20);
    assert.equal(await supply.amount_(), 30);
    assert.equal(await holder1.amount_(), 30);

    receipt = await supply.mint(holder1.address, 0);
    args = receipt.logs.filter(e => e.event == 'MintEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 0);
    assert.equal(await supply.amount_(), 30);
    assert.equal(await holder1.amount_(), 30);

    await should_throw(async () => {
      await supply.mint(holder1.address, -1);
    }, "out-of-bounds");

    // burn
    receipt = await supply.burn(holder1.address, await holder1.amount_());
    args = receipt.logs.filter(e => e.event == 'BurnEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 30);
    assert.equal(await supply.amount_(), 0);
    assert.equal(await holder1.amount_(), 0);

    receipt = await supply.burn(holder1.address, await holder1.amount_());
    args = receipt.logs.filter(e => e.event == 'BurnEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 0);
    assert.equal(await supply.amount_(), 0);
    assert.equal(await holder1.amount_(), 0);

    await supply.mint(holder1.address, 10);
    assert.equal(await supply.amount_(), 10);
    assert.equal(await holder1.amount_(), 10);

    receipt = await supply.burn(holder1.address, 1);
    args = receipt.logs.filter(e => e.event == 'BurnEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 1);
    assert.equal(await supply.amount_(), 9);
    assert.equal(await holder1.amount_(), 9);

    receipt = await supply.burn(holder1.address, 5);
    args = receipt.logs.filter(e => e.event == 'BurnEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 5);
    assert.equal(await supply.amount_(), 4);
    assert.equal(await holder1.amount_(), 4);

    receipt = await supply.burn(holder1.address, 0);
    args = receipt.logs.filter(e => e.event == 'BurnEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 0);
    assert.equal(await supply.amount_(), 4);
    assert.equal(await holder1.amount_(), 4);

    await should_throw(async () => {
      await supply.burn(holder1.address, 5);
    }, "burn:");

    await should_throw(async () => {
      await supply.burn(holder1.address, -1);
    }, "out-of-bounds");

    receipt = await supply.burn(holder1.address, 4);
    args = receipt.logs.filter(e => e.event == 'BurnEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 4);
    assert.equal(await supply.amount_(), 0);
    assert.equal(await holder1.amount_(), 0);

    receipt = await supply.burn(holder1.address, 0);
    args = receipt.logs.filter(e => e.event == 'BurnEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], 0);
    assert.equal(await supply.amount_(), 0);
    assert.equal(await holder1.amount_(), 0);

    await should_throw(async () => {
      await supply.burn(holder1.address, 1);
    }, "burn:");

    // send_to
    holder1 = await TokenHolder.new(supply.address);
    holder2 = await TokenHolder.new(supply.address);
    await supply.mint(holder1.address, 100);
    await supply.mint(holder2.address, 100);
    assert.equal(await supply.amount_(), 200);
    assert.equal(await holder1.amount_(), 100);
    assert.equal(await holder2.amount_(), 100);

    receipt = await supply.send_to(holder2.address, holder1.address, 50);
    args = receipt.logs.filter(e => e.event == 'SendToEvent')[0].args;
    assert.equal(args[0], holder2.address);
    assert.equal(args[1], holder1.address);
    assert.equal(args[2], 50);
    assert.equal(await supply.amount_(), 200);
    assert.equal(await holder1.amount_(), 150);
    assert.equal(await holder2.amount_(), 50);

    receipt = await supply.send_to(holder2.address, holder1.address, 0);
    args = receipt.logs.filter(e => e.event == 'SendToEvent')[0].args;
    assert.equal(args[0], holder2.address);
    assert.equal(args[1], holder1.address);
    assert.equal(args[2], 0);
    assert.equal(await supply.amount_(), 200);
    assert.equal(await holder1.amount_(), 150);
    assert.equal(await holder2.amount_(), 50);

    receipt = await supply.send_to(holder2.address, holder1.address, 50);
    args = receipt.logs.filter(e => e.event == 'SendToEvent')[0].args;
    assert.equal(args[0], holder2.address);
    assert.equal(args[1], holder1.address);
    assert.equal(args[2], 50);
    assert.equal(await supply.amount_(), 200);
    assert.equal(await holder1.amount_(), 200);
    assert.equal(await holder2.amount_(), 0);

    receipt = await supply.send_to(holder1.address, holder2.address, 50);
    args = receipt.logs.filter(e => e.event == 'SendToEvent')[0].args;
    assert.equal(args[0], holder1.address);
    assert.equal(args[1], holder2.address);
    assert.equal(args[2], 50);
    assert.equal(await supply.amount_(), 200);
    assert.equal(await holder1.amount_(), 150);
    assert.equal(await holder2.amount_(), 50);

    await should_throw(async () => {
      await supply.send_to(holder2.address, holder1.address, -1);
    }, "out-of-bounds");

    await should_throw(async () => {
      await supply.send_to(holder2.address, holder1.address, 51);
    }, "send_to:");

    await should_throw(async () => {
      await supply.send_to(holder1.address, holder1.address, 10);
    }, "send_to:");

    await should_throw(async () => {
      await supply.send_to(holder2.address, holder2.address, 10);
    }, "send_to:");

  });

  it("Ownable", async function () {
    supply = await TokenSupply.new();
    supply2 = await TokenSupply.new();
    holder1 = await TokenHolder.new(supply.address);
    holder2 = await TokenHolder.new(supply2.address);

    await should_throw(async () => {
      await supply.mint(holder1.address, 10, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await supply2.mint(holder2.address, 10, {from: accounts[1]});
    }, "Ownable");

    await supply.mint(holder1.address, 10);
    await supply2.mint(holder2.address, 10);

    await should_throw(async () => {
      await supply2.mint(holder1.address, 20);
    }, "Ownable");

    await should_throw(async () => {
      await supply.mint(holder2.address, 20);
    }, "Ownable");

    await should_throw(async () => {
      await supply.send_to(holder1.address, holder2.address, 1);
    }, "Ownable");

    await should_throw(async () => {
      await supply.send_to(holder2.address, holder1.address, 1);
    }, "Ownable");

    await should_throw(async () => {
      await supply2.send_to(holder1.address, holder2.address, 1);
    }, "Ownable");

    await should_throw(async () => {
      await supply2.send_to(holder2.address, holder1.address, 1);
    }, "Ownable");

    await should_throw(async () => {
      await supply.burn(holder2.address, 0);
    }, "Ownable");

    await should_throw(async () => {
      await supply2.burn(holder1.address, 0);
    }, "Ownable");

    await should_throw(async () => {
      await supply.burn(holder1.address, 10, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await supply2.burn(holder2.address, 10, {from: accounts[1]});
    }, "Ownable");

    await supply.burn(holder1.address, 10);
    await supply2.burn(holder2.address, 10);

    await should_throw(async () => {
      await holder1.set_amount(1);
    }, "Ownable");

    await should_throw(async () => {
      await holder1.set_amount(1, {from: accounts[1]});
    }, "Ownable");

    await should_throw(async () => {
      await holder2.set_amount(1);
    }, "Ownable");

    await should_throw(async () => {
      await holder2.set_amount(1, {from: accounts[1]});
    }, "Ownable");

    holder1 = await TokenHolder.new(accounts[1]);
    await holder1.set_amount(1, {from: accounts[1]});
    assert.equal(await holder1.amount_(), 1);

  });
});

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
