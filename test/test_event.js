const _deploy_contracts = require("../migrations/2_deploy_contracts");
const truffleAssert = require("truffle-assertions"); // npm truffle-assertions
const BigNumber = require("bignumber.js"); // npm install bignumber.js
var assert = require("assert");
//const oneEth = new BigNumber(1000000000000000000); // 1 eth

var Event = artifacts.require("../contracts/Event.sol");
var Ticket = artifacts.require("../contracts/Ticket.sol");

contract("Event", function (accounts) {
    before(async () => {
        ticketInstance = await Ticket.deployed();
        eventInstance = await Event.deployed();
    });
    
    console.log("Testing Event contract");

    it("Create Event", async () => {
        await eventInstance.createEvent("Title 0", "Venue 0", 2024, 3, 11, 12, 30, 0, 5, 5, 20, accounts[1], {from: accounts[1]});
        let latestEventId  = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert.equal("Title 0", title, "Failed to create event");
    });
})