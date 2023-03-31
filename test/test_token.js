const _deploy_contracts = require("../migrations/2_deploy_contracts");
const truffleAssert = require("truffle-assertions"); // npm truffle-assertions
const BigNumber = require("bignumber.js"); // npm install bignumber.js
var assert = require("assert");

var EventToken = artifacts.require("../contracts/EventToken.sol");

contract("EventToken", function (accounts) {
    before(async () => {
        eventTokenInstance = await EventToken.deployed();
    });
    
    console.log("Testing EventToken Functions contract");

    it("Mint Event Token", async () => {
        let totalSupplyBefore = await eventTokenInstance.getCurrentSupply({from: accounts[1]});
        await eventTokenInstance.mintToken(5000000, accounts[1]);
        let totalSupplyAfter = await eventTokenInstance.getCurrentSupply({from: accounts[1]});
        let totalSupplyAdded = totalSupplyAfter - totalSupplyBefore;
        assert.equal(await eventTokenInstance.checkEventToken({from: accounts[1]}), 100);
        assert.equal(totalSupplyAdded, 100);
    });

    it("Burn Event Token", async () => {
        let totalSupplyBefore = await eventTokenInstance.getCurrentSupply({from: accounts[1]});
        await eventTokenInstance.burnToken(100, accounts[1]);
        let totalSupplyAfter = await eventTokenInstance.getCurrentSupply({from: accounts[1]});
        let totalSupplyRemoved = totalSupplyBefore - totalSupplyAfter;
        assert.equal(await eventTokenInstance.checkEventToken({from: accounts[1]}), 0);
        assert.equal(totalSupplyRemoved, 100);
    });
})