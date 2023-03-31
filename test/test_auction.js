const _deploy_contracts = require("../migrations/2_deploy_contracts");
const truffleAssert = require("truffle-assertions"); // npm truffle-assertions
var assert = require("assert");

var Auction = artifacts.require("../contracts/Auction.sol");

contract("Auction", function (accounts) {
    before(async () => {
        auctionInstance = await Auction.deployed();
    });
    
    console.log("Testing Auction contract");

    it("Platform address change", async () => {
        await truffleAssert.reverts(auctionInstance.setPlatformAddress(auctionInstance.address));        
    });
})
