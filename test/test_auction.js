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

    it("Test minHeap", async () => {
        await auctionInstance.createBidding(0, 3);
        await auctionInstance.placeBid(0, accounts[1], 5);
        await auctionInstance.placeBid(0, accounts[1], 10);
        await auctionInstance.placeBid(0, accounts[1], 50);
        await auctionInstance.placeBid(0, accounts[1], 1);
        await auctionInstance.placeBid(0, accounts[1], 20);
        await auctionInstance.placeBid(0, accounts[1], 30);
        await auctionInstance.placeBid(0, accounts[1], 40);
        await auctionInstance.placeBid(0, accounts[1], 1);
        // console.log(">>>");
        // await auctionInstance.getBidders(0, 0);
        // await auctionInstance.getBidders(0, 1);
        // await auctionInstance.getBidders(0, 2);
        // print();
    });
})