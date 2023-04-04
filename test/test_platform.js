const _deploy_contracts = require("../migrations/2_deploy_contracts");
const truffleAssert = require("truffle-assertions"); // npm truffle-assertions
const BigNumber = require("bignumber.js"); // npm install bignumber.js
var assert = require("assert");
const oneEth = new BigNumber(1000000000000000000); // 1 eth

var Account = artifacts.require("../contracts/Account.sol");
var Event = artifacts.require("../contracts/Event.sol");
var Ticket = artifacts.require("../contracts/Ticket.sol");
var EventToken = artifacts.require("../contracts/EventToken.sol");
var Platform = artifacts.require("../contracts/Platform.sol");

contract("Platform", function (accounts) {
    before(async () => {
        accountInstance = await Account.deployed();
        ticketInstance = await Ticket.deployed();
        eventInstance = await Event.deployed();
        eventTokenInstance = await EventToken.deployed();
        platformInstance = await Platform.deployed();
    });
    
    /*
        Acccount Management:

        accounts[0] == contract owner
        accounts[1] == verified seller
        accounts[2] == buyer
        accounts[3] == buyer
        accounts[4] == buyer
    */

    console.log("Testing Platform contract");
    var latestEventId;

    it("Account(Seller) unable to list event if yet to be verified", async () => {
        await truffleAssert.reverts(
            platformInstance.listEvent(
                "Harry Styles concert", "Stadium", 2024, 03, 21, 18, 00, 00, 5, 5, 65, accounts[1], {from: accounts[1], value: 0}),
            "You are not a verified seller"
        );
    });

    it("Account(Seller) not verified at the start", async () => {
        var state = await accountInstance.viewAccountState.call(accounts[1]);
        var unverifiedStatus = await accountInstance.getUnverifiedStatus.call();
        await assert.strictEqual(state.toString(),unverifiedStatus.toString(),"Account is already verified.");
    });

    it("Verify account(Seller)", async () => {
        await accountInstance.verifyAccount(accounts[1]);
        var state = await accountInstance.viewAccountState.call(accounts[1]);
        var verifiedStatus = await accountInstance.getVerifiedStatus.call();
        await assert.strictEqual(state.toString(),verifiedStatus.toString(),"Account is not verified.");
    });

    it("Insufficient deposits to list event", async () => {
        await truffleAssert.reverts(
            platformInstance.listEvent(
                "Harry Styles concert", "Stadium", 2024, 03, 21, 18, 00, 00, 5, 5, 65, accounts[1], {from: accounts[1], value: 0}),
            "Insufficient deposits. Need deposit minimum (capacity * priceOfTicket)/2 * 50000 wei to list event."
        );
    });

    it("Event listed successfully", async () => {
        await platformInstance.listEvent(
            "Harry Styles concert", "Stadium", 2024, 03, 21, 18, 00, 00, 5, 5, 65, accounts[1], {from: accounts[1], value: oneEth});
        latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        var eventTitle = await eventInstance.getEventTitle(latestEventId);
        await assert.strictEqual(eventTitle.toString(),"Harry Styles concert","Event not listed");
    });

    it("List Event", async () => {
        await accountInstance.verifyAccount(accounts[1]);
        await platformInstance.listEvent("Title 0", "Venue 0", 2024, 3, 11, 12, 30, 0, 5, 5, 20, accounts[1], {from: accounts[1], value: oneEth.multipliedBy(4)});
        latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 0", title, "Failed to create event");
    });

    it("Commence Bidding", async () => {
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");
    });

    it("Place Bidding", async () => {
        let bidPlaced = await platformInstance.placeBid(latestEventId, 1, 0, {from: accounts[2], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced, "BidPlaced");
    });

    it("Close Bidding", async () => {
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidBuy");
    });

    it("Buy Ticket", async () => {
        let buyTicket = await platformInstance.buyTickets(latestEventId, 1, {from: accounts[3], value: oneEth.dividedBy(4)});
        truffleAssert.eventEmitted(buyTicket, "TransferToBuyerSuccessful");
    });

    it("Insufficent funds to buy tickets", async () => {
        await truffleAssert.reverts(
            platformInstance.buyTickets(latestEventId, 1, {from: accounts[3], value: 0}),
            "Buyer has insufficient ETH to buy tickets"
        );
    });

    it("Quantity exceeded", async () => {
        // Maximum ticket purchase limit is set to 4
        await truffleAssert.reverts(
            platformInstance.buyTickets(latestEventId, 10, {from: accounts[3], value: oneEth.dividedBy(4)}),
            "You have passed the maximum bulk purchase limit"
        );
    });

    it("Successful Payback to buyer", async () => {
        // let buyTicketProcess = await platformInstance.buyTickets(1, 3, 300, {from: accounts[1], value: 1000})
        // expectedReturn = 100;
        // let balance = await web3.eth.getBalance(accounts[0]);
        // console.log("this is the balance:",balance);
        // assert.strictEqual(balance , expectedReturn, "Incorrect payback");

        // not the best way
        let buyTicketProcess = await platformInstance.buyTickets(latestEventId, 3, {from: accounts[3], value: oneEth.dividedBy(4)})
        truffleAssert.eventEmitted(buyTicketProcess, 'TransferToBuyerSuccessful');
    });

    it("Test Priority System", async () => {
        // Listing of event with 5 tickets
        await platformInstance.listEvent("Title 1", "Venue 1", 2024, 3, 11, 12, 30, 0, 5, 5, 20, accounts[1], {from: accounts[1], value: oneEth.multipliedBy(4)});
        let latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 1", title, "Failed to create event");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");
        
        // Generate token for accounts[2],[3],[4] with 5,0,6 correspondingly
        await eventTokenInstance.getTokenForTesting(accounts[2], 5, {from: accounts[0]});
        await eventTokenInstance.getTokenForTesting(accounts[3], 0, {from: accounts[0]});
        await eventTokenInstance.getTokenForTesting(accounts[4], 6, {from: accounts[0]});
        const acc2token = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[2]}));
        await assert(acc2token.isEqualTo(BigNumber(5)), "EventToken not minted");
        const acc3token = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[3]}));
        await assert(acc3token.isEqualTo(BigNumber(0)), "EventToken not minted");
        const acc4token = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[4]}));
        await assert(acc4token.isEqualTo(BigNumber(6)), "EventToken not minted");

        // accounts[2] approve Platform contract to use 5 tokens and place bid for 1 ticket with 5 tokens each
        await eventTokenInstance.approveToken(platformInstance.address, 5, {from: accounts[2]}); 
        let acc2allowance = new BigNumber(await eventTokenInstance.checkAllowance(accounts[2], platformInstance.address, {from: accounts[2]}));
        await assert(acc2allowance.isEqualTo(BigNumber(5)), "EventToken not approved");
        let bidPlaced1 = await platformInstance.placeBid(latestEventId, 1, 5, {from: accounts[2], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced1, "BidPlaced");

        // accounts[3] place bid for 2 ticket with 0 tokens each
        let bidPlaced2 = await platformInstance.placeBid(latestEventId, 2, 0, {from: accounts[3], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced2, "BidPlaced");

        // accounts[4] approve Platfrom contract to use 6 tokens and place bid for 3 tickets with 2 token each 
        await eventTokenInstance.approveToken(platformInstance.address, 6, {from: accounts[4]}); 
        let acc4allowance = new BigNumber(await eventTokenInstance.checkAllowance(accounts[4], platformInstance.address, {from: accounts[4]}));
        await assert(acc4allowance.isEqualTo(BigNumber(6)), "EventToken not approved");
        let bidPlaced3 = await platformInstance.placeBid(latestEventId, 3, 2, {from: accounts[4], value: oneEth}); 
        truffleAssert.eventEmitted(bidPlaced3, "BidPlaced");

        // Ensure that platform EventToken amount is consistent
        const acc0token = new BigNumber(await eventTokenInstance.checkEventTokenOf(Platform.address, {from: accounts[0]}));
        await assert(acc0token.isEqualTo(BigNumber(11)), "EventToken not transfered to Platform");
   
        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidBuy");

        // Ensure accurate ticket distribution
        let ownerTickets = {}
        for (let i = 10; i <= 14; i++){
            let ownerId = await ticketInstance.getTicketOwner(i);
            typeof ownerTickets[ownerId] == "undefined" ? ownerTickets[ownerId]=1:ownerTickets[ownerId]+=1;
        }

        assert.strictEqual(ownerTickets[accounts[2]], 1);
        assert.strictEqual(ownerTickets[accounts[3]], 1);
        assert.strictEqual(ownerTickets[accounts[4]], 3);
    });

    it("Test Update System", async () => {
        let _title = "Update Test"
        let _venue = "venue"
        
        // Listing of event with 5 tickets
        await platformInstance.listEvent(_title, _venue, 2024, 3, 11, 12, 30, 0, 5, 5, 20, accounts[1], {from: accounts[1], value: oneEth.multipliedBy(4)});
        let latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert(_title, title, "Failed to create event");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");
        
        // Generate token for accounts[2],[3],[4] with 8,15,6 correspondingly
        await eventTokenInstance.getTokenForTesting(accounts[2], 8, {from: accounts[0]});
        await eventTokenInstance.getTokenForTesting(accounts[3], 15, {from: accounts[0]});
        await eventTokenInstance.getTokenForTesting(accounts[4], 6, {from: accounts[0]});
        const acc2token = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[2]}));
        await assert(acc2token.isEqualTo(BigNumber(8)), "EventToken not minted");
        const acc3token = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[3]}));
        await assert(acc3token.isEqualTo(BigNumber(15)), "EventToken not minted");
        const acc4token = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[4]}));
        await assert(acc4token.isEqualTo(BigNumber(6)), "EventToken not minted");

        // accounts[2] approve Platform contract to use 8 tokens and place bid for 2 ticket with 4 tokens each
        await eventTokenInstance.approveToken(platformInstance.address, 8, {from: accounts[2]}); 
        let acc2allowance = new BigNumber(await eventTokenInstance.checkAllowance(accounts[2], platformInstance.address, {from: accounts[2]}));
        await assert(acc2allowance.isEqualTo(BigNumber(8)), "EventToken not approved");
        let bidPlaced1 = await platformInstance.placeBid(latestEventId, 2, 4, {from: accounts[2], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced1, "BidPlaced");

        // accounts[3] approve Platform contract to use 6 tokens and place bid for 3 ticket with 2 tokens each
        await eventTokenInstance.approveToken(platformInstance.address, 6, {from: accounts[3]}); 
        let acc3allowance = new BigNumber(await eventTokenInstance.checkAllowance(accounts[3], platformInstance.address, {from: accounts[3]}));
        await assert(acc3allowance.isEqualTo(BigNumber(6)), "EventToken not approved");
        let bidPlaced2 = await platformInstance.placeBid(latestEventId, 3, 2, {from: accounts[3], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced2, "BidPlaced");

        // accounts[4] approve Platfrom contract to use 3 tokens and place bid for 1 tickets with 3 token each 
        await eventTokenInstance.approveToken(platformInstance.address, 3, {from: accounts[4]}); 
        let acc4allowance = new BigNumber(await eventTokenInstance.checkAllowance(accounts[4], platformInstance.address, {from: accounts[4]}));
        await assert(acc4allowance.isEqualTo(BigNumber(3)), "EventToken not approved");
        let bidPlaced3 = await platformInstance.placeBid(latestEventId, 1, 3, {from: accounts[4], value: oneEth}); 
        truffleAssert.eventEmitted(bidPlaced3, "BidPlaced");

        // Ensure that platform EventToken amount is consistent
        const acc0token = new BigNumber(await eventTokenInstance.checkEventTokenOf(Platform.address, {from: accounts[0]}));
        await assert(acc0token.isEqualTo(BigNumber(17+11)), "EventToken not transfered to Platform");

        await platformInstance.getBidders(latestEventId);

        // accounts[3] approve Platform contract to use 9 tokens and update bid for 3 ticket with 5 tokens each
        await eventTokenInstance.approveToken(platformInstance.address, 9, {from: accounts[3]}); 
        let acc3allowance2 = new BigNumber(await eventTokenInstance.checkAllowance(accounts[3], platformInstance.address, {from: accounts[3]}));
        await assert(acc3allowance2.isEqualTo(BigNumber(9)), "EventToken not approved");
        let bidUpdate1 = await platformInstance.updateBidding(latestEventId, 5, {from: accounts[3]});
        truffleAssert.eventEmitted(bidUpdate1, "BidUpdated");

        await platformInstance.getBidders(latestEventId);

        // accounts[4] approve Platform contract to use 3 tokens and update bid for 1 ticket with 6 tokens each
        await eventTokenInstance.approveToken(platformInstance.address, 3, {from: accounts[4]}); 
        let acc4allowance2 = new BigNumber(await eventTokenInstance.checkAllowance(accounts[4], platformInstance.address, {from: accounts[4]}));
        await assert(acc4allowance2.isEqualTo(BigNumber(3)), "EventToken not approved");
        let bidUpdate2 = await platformInstance.updateBidding(latestEventId, 6, {from: accounts[4]});
        truffleAssert.eventEmitted(bidUpdate2, "BidUpdated");

        await platformInstance.getBidders(latestEventId);

        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidBuy");

        // Ensure accurate ticket distribution
        let ownerTickets = {}
        for (let i = 15; i <= 19; i++){
            let ownerId = await ticketInstance.getTicketOwner(i);
            console.log(i+" | "+ownerId);
            typeof ownerTickets[ownerId] == "undefined" ? ownerTickets[ownerId]=1:ownerTickets[ownerId]+=1;
        }

        assert.strictEqual(ownerTickets[accounts[2]], 1);
        assert.strictEqual(ownerTickets[accounts[3]], 3);
        assert.strictEqual(ownerTickets[accounts[4]], 1);
    });

})