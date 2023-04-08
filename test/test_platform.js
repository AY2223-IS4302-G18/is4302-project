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
        // Add event token authentication
        truffleAssert.eventEmitted(
            await eventTokenInstance.addAuthorisedAddress(platformInstance.address), 
            'NewAuthorisedAddress');
        assert.equal(await eventTokenInstance.checkAuthorisedAddress(platformInstance.address), true);
        // end of add
            
        await truffleAssert.reverts(
            platformInstance.listEvent(
                "Harry Styles concert", "Stadium", 2024, 03, 21, 18, 00, 00, 5, 65, accounts[1], {from: accounts[1], value: 0}),
            "You are not a verified seller"
        );
    });

    it("Account(Seller) not verified at the start", async () => {
        var state = await accountInstance.viewAccountState.call(accounts[1]);
        var unverifiedStatus = await accountInstance.getUnverifiedStatus.call();
        await assert.strictEqual(state.toString(),unverifiedStatus.toString(),"Account is already verified.");
    });

    it("Account(Seller) is a verified organisations", async () => {
        // make account[0] certified to verify organisations
        let certify = await accountInstance.certifyAccount(accounts[0]);

        // Set account[1] to be verified using account[0]
        let verifyAccount5 = await accountInstance.verifyAccount(accounts[1], {from: accounts[0]});
        assert(await accountInstance.viewAccountState(accounts[1]), await accountInstance.getVerifiedStatus() );
        assert(await accountInstance.viewAccountVerifier(accounts[1]), accounts[0]);
    });

    it("Verify account(Seller)", async () => {
        await accountInstance.verifyAccount(accounts[1], {from: accounts[0]});
        var state = await accountInstance.viewAccountState.call(accounts[1]);
        var verifiedStatus = await accountInstance.getVerifiedStatus.call();
        await assert.strictEqual(state.toString(),verifiedStatus.toString(),"Account is not verified.");
    });

    it("Insufficient deposits to list event", async () => {
        await truffleAssert.reverts(
            platformInstance.listEvent(
                "Harry Styles concert", "Stadium", 2024, 03, 21, 18, 00, 00, 5, 65, accounts[1], {from: accounts[1], value: 0}),
            "Insufficient deposits. Need deposit minimum (capacity * priceOfTicket)/2 * 50000 wei to list event."
        );
    });

    it("Event listed successfully", async () => {
        await platformInstance.listEvent(
            "Harry Styles concert", "Stadium", 2024, 03, 21, 18, 00, 00, 5, 65, accounts[1], {from: accounts[1], value: oneEth});
        latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        var eventTitle = await eventInstance.getEventTitle(latestEventId);
        await assert.strictEqual(eventTitle.toString(),"Harry Styles concert","Event not listed");
    });

    it ("Incorrect Commence Bidding", async () => {
        // Not seller of event
        await truffleAssert.reverts(
            platformInstance.commenceBidding(latestEventId, {from: accounts[9]}),
            "Only seller can commence bidding"
        );

        // Invalid EventId
        await truffleAssert.reverts(
            platformInstance.commenceBidding(999, {from: accounts[1]}),
            "Invalid eventId"
        );
    })

    it ("Incorrect sequence of bidding", async () => {
        // Cant bid before bidding commenced
        await truffleAssert.reverts(
            platformInstance.placeBid(latestEventId, 1, 0, {from: accounts[2], value: oneEth}),
            "Event not open for bidding"
        );
    })

    it("Commence Bidding", async () => {
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");

        // enum bidState[1]
        let bidState = await eventInstance.getEventState(latestEventId);
        await assert.equal(bidState, 1, "Bidding not commenced");
    });

    it ("Incorrect Bid Placing", async () => {
        // Quantity 0
        await truffleAssert.reverts(
            platformInstance.placeBid(latestEventId, 0, 0, {from: accounts[2], value: oneEth}),
            "Quantity of tickets must be at least 1"
        );

        // Quantity > 4
        await truffleAssert.reverts(
            platformInstance.placeBid(latestEventId, 5, 0, {from: accounts[2], value: oneEth}),
            "You have passed the maximum bulk purchase limit"
        );

        // Insufficient ETH
        await truffleAssert.reverts(
            platformInstance.placeBid(latestEventId, 4, 0, {from: accounts[2], value: 1}),
            "Buyer has insufficient ETH"
        );

        // Insufficient EventTokens
        await truffleAssert.reverts(
            platformInstance.placeBid(latestEventId, 4, 50, {from: accounts[2], value: oneEth}),
            "Buyer has insufficient EventTokens"
        );
    })

    it("Place Bidding", async () => {
        let bidPlaced = await platformInstance.placeBid(latestEventId, 1, 0, {from: accounts[2], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced, "BidPlaced");
    });

    it ("Incorrect Close Bidding", async () => {
        // Not seller of event
        await truffleAssert.reverts(
            platformInstance.closeBidding(latestEventId, {from: accounts[9]}),
            "Only seller can close bidding"
        );

        // Invalid EventId
        await truffleAssert.reverts(
            platformInstance.commenceBidding(999, {from: accounts[1]}),
            "Invalid eventId"
        );
    })

    it("Close Bidding", async () => {
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");

        // enum bidState[2]
        let bidState = await eventInstance.getEventState(latestEventId);
        await assert.equal(bidState, 2, "Bidding not closed");
    });

    it("Buy Ticket", async () => {
        let buyTicket = await platformInstance.buyTickets(latestEventId, 1, {from: accounts[3], value: oneEth.dividedBy(4)});
        truffleAssert.eventEmitted(buyTicket, "BuyTicket");
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

    it("Return ETH back to buyer if msg.value > priceOfTickets", async () => {
        // Listing of event with 5 tickets
        await accountInstance.verifyAccount(accounts[1], {from: accounts[0]});
        await platformInstance.listEvent("Title 0", "Venue 0", 2024, 3, 11, 12, 30, 0, 5, 20, accounts[1], {from: accounts[1], value: oneEth.multipliedBy(4)});
        latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 0", title, "Failed to create event");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");

        // Close bidding
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");

        // Buy ticket
        let initialbalance = new BigNumber(await web3.eth.getBalance(accounts[3]));
        let buyTicket = await platformInstance.buyTickets(latestEventId, 1, {from: accounts[3], value: oneEth});
        truffleAssert.eventEmitted(buyTicket, "BuyTicket");
        let gasUsed = new BigNumber(buyTicket.receipt.gasUsed);
        let tx = await web3.eth.getTransaction(buyTicket.tx);
        let gasPrice = new BigNumber(tx.gasPrice);

        // Ensure ETH is returned
        let finalbalance = new BigNumber(await web3.eth.getBalance(accounts[3]));
        let priceOfTicket = new BigNumber(await eventInstance.getEventTicketPrice(latestEventId));
        await assert(finalbalance.isEqualTo(initialbalance.minus(gasPrice.multipliedBy(gasUsed)).minus(priceOfTicket)), "Did not return exceeded ETH back to buyer");
    });

    it("Test Priority System", async () => {
        // Listing of event with 5 tickets
        await platformInstance.listEvent("Title 1", "Venue 1", 2024, 3, 11, 12, 30, 0, 5, 20, accounts[1], {from: accounts[1], value: oneEth.multipliedBy(4)});
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

        // accounts[2] place bid for 1 ticket with 5 tokens each
        let bidPlaced1 = await platformInstance.placeBid(latestEventId, 1, 5, {from: accounts[2], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced1, "BidPlaced");

        // accounts[3] place bid for 2 ticket with 0 tokens each
        let bidPlaced2 = await platformInstance.placeBid(latestEventId, 2, 0, {from: accounts[3], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced2, "BidPlaced");

        // accounts[4] place bid for 3 tickets with 2 token each 
        let bidPlaced3 = await platformInstance.placeBid(latestEventId, 3, 2, {from: accounts[4], value: oneEth}); 
        truffleAssert.eventEmitted(bidPlaced3, "BidPlaced");

        // Ensure that account EventToken amount is consistent
        const acc2token1 = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[2]}));
        await assert(acc2token1.isEqualTo(BigNumber(0)), "EventToken not burned");
        const acc3token1 = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[3]}));
        await assert(acc3token1.isEqualTo(BigNumber(0)), "EventToken not burned");
        const acc4token1 = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[4]}));
        await assert(acc4token1.isEqualTo(BigNumber(0)), "EventToken not burned");
   
        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");

        // Ensure accurate ticket distribution
        let owner1 = await ticketInstance.getTicketOwner(10); // ticketId 10 belongs to accounts[2]
        assert.strictEqual(owner1, accounts[2]);
        let owner2 = await ticketInstance.getTicketOwner(11); // ticketId 11,12,13 belongs to accounts[4] 
        assert.strictEqual(owner2, accounts[4]);
        let owner3 = await ticketInstance.getTicketOwner(12); // ticketId 11,12,13 belongs to accounts[4] 
        assert.strictEqual(owner3, accounts[4]);
        let owner4 = await ticketInstance.getTicketOwner(13); // ticketId 11,12,13 belongs to accounts[4] 
        assert.strictEqual(owner4, accounts[4]);
        let owner5 = await ticketInstance.getTicketOwner(14); // ticketId 15 belongs to accounts[3] 
        assert.strictEqual(owner5, accounts[3]);

        // Seller ends event
        let sellerEnd = await platformInstance.sellerEndEvent(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(sellerEnd, "SellerEventEnd");

        // Owner confirms event ended and release sales and deposit to seller
        let ownerEnd = await platformInstance.endSuccessfulEvent(latestEventId, {from: accounts[0]});
        truffleAssert.eventEmitted(ownerEnd, "OwnerEventEnd");

        // Check that accounts recieved tokens earn from attending event
        const acc2token2 = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[2]}));
        await assert(acc2token2.isEqualTo(BigNumber(1)), "EventToken not minted");
        const acc3token2 = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[3]}));
        await assert(acc3token2.isEqualTo(BigNumber(1)), "EventToken not minted");
        const acc4token2 = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[4]}));
        await assert(acc4token2.isEqualTo(BigNumber(3)), "EventToken not minted");

    });

    it("Test Updating of Bid", async () => {
        // Listing of event with 1 ticket
        await platformInstance.listEvent("Title 2", "Venue 2", 2024, 3, 11, 12, 30, 0, 1, 20, accounts[1], {from: accounts[1], value: oneEth.multipliedBy(4)});
        let latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 2", title, "Failed to create event");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");
        
        // Generate token for accounts[2],[3] with 4,5 correspondingly due to them earning tokens from event end previously
        await eventTokenInstance.getTokenForTesting(accounts[2], 4, {from: accounts[0]});
        await eventTokenInstance.getTokenForTesting(accounts[3], 5, {from: accounts[0]});
        const acc2token = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[2]}));
        await assert(acc2token.isEqualTo(BigNumber(5)), "EventToken not minted");
        const acc3token = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[3]}));
        await assert(acc3token.isEqualTo(BigNumber(6)), "EventToken not minted");

        // accounts[3] place bid for 1 ticket with 0 tokens each
        let bidPlaced1 = await platformInstance.placeBid(latestEventId, 1, 0, {from: accounts[3], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced1, "BidPlaced");

        // accounts[2] place bid for 1 ticket with 5 tokens each
        let bidPlaced2 = await platformInstance.placeBid(latestEventId, 1, 5, {from: accounts[2], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced2, "BidPlaced");

        // accounts[3] update bid for 1 ticket with 6 tokens each
        let updateBid1 = await platformInstance.updateBid(latestEventId, 6, {from: accounts[3]});
        truffleAssert.eventEmitted(updateBid1, "BidUpdate");

        // Ensure that account EventToken amount is consistent
        const acc2token1 = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[2]}));
        await assert(acc2token1.isEqualTo(BigNumber(0)), "EventToken not burned");
        const acc3token1 = new BigNumber(await eventTokenInstance.checkEventToken({from: accounts[3]}));
        await assert(acc3token1.isEqualTo(BigNumber(0)), "EventToken not burned");
   
        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");

        // Ensure accurate ticket distribution
        let owner1 = await ticketInstance.getTicketOwner(15); // ticketId 15 belongs to accounts[3]
        assert.strictEqual(owner1, accounts[3]);

        // Seller ends event
        let sellerEnd = await platformInstance.sellerEndEvent(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(sellerEnd, "SellerEventEnd");

        // Owner confirms event ended and release sales and deposit to seller
        let ownerEnd = await platformInstance.endSuccessfulEvent(latestEventId, {from: accounts[0]});
        truffleAssert.eventEmitted(ownerEnd, "OwnerEventEnd");
    });

    it("Test Unsuccessful Bid Return ETH", async () => {
        // Listing of event with 1 ticket
        await platformInstance.listEvent("Title 3", "Venue 3", 2024, 3, 11, 12, 30, 0, 1, 20, accounts[1], {from: accounts[1], value: oneEth.multipliedBy(4)});
        let latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 3", title, "Failed to create event");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");

        // accounts[2] place bid for 1 ticket with 0 tokens each
        let bidPlaced1 = await platformInstance.placeBid(latestEventId, 1, 0, {from: accounts[2], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced1, "BidPlaced");

        // accounts[3] place bid for 1 ticket with 0 tokens each
        let initialbalance = new BigNumber(await web3.eth.getBalance(accounts[3]));
        let bidPlaced2 = await platformInstance.placeBid(latestEventId, 1, 0, {from: accounts[3], value: oneEth});
        let gasUsed = new BigNumber(bidPlaced2.receipt.gasUsed);
        let tx = await web3.eth.getTransaction(bidPlaced2.tx);
        let gasPrice = new BigNumber(tx.gasPrice);
        truffleAssert.eventEmitted(bidPlaced2, "BidPlaced");
   
        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");

        // Ensure accurate ticket distribution
        let owner1 = await ticketInstance.getTicketOwner(16); // ticketId 16 belongs to accounts[2]
        assert.strictEqual(owner1, accounts[2]);

        // Ensure ETH is returned to unsuccessful bidder accounts[3]
        let finalbalance = new BigNumber(await web3.eth.getBalance(accounts[3]));
        await assert(finalbalance.isEqualTo(initialbalance.minus(gasPrice.multipliedBy(gasUsed))), "Did not return ETH back to unsuccessful bidders");

        // Seller ends event
        let sellerEnd = await platformInstance.sellerEndEvent(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(sellerEnd, "SellerEventEnd");

        // Owner confirms event ended and release sales and deposit to seller
        let ownerEnd = await platformInstance.endSuccessfulEvent(latestEventId, {from: accounts[0]});
        truffleAssert.eventEmitted(ownerEnd, "OwnerEventEnd");
    });

    it("Test Successful Bid -> Refund Ticket -> Buy Ticket", async () => {
        // Listing of event with 1 ticket
        await platformInstance.listEvent("Title 4", "Venue 4", 2024, 3, 11, 12, 30, 0, 1, 20, accounts[1], {from: accounts[1], value: oneEth.multipliedBy(4)});
        let latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 4", title, "Failed to create event");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");

        // accounts[2] place bid for 1 ticket with 0 tokens each
        let bidPlaced1 = await platformInstance.placeBid(latestEventId, 1, 0, {from: accounts[2], value: oneEth});
        truffleAssert.eventEmitted(bidPlaced1, "BidPlaced");
   
        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");

        // Ensure accurate ticket distribution
        let owner1 = await ticketInstance.getTicketOwner(17); // ticketId 17 belongs to accounts[2]
        assert.strictEqual(owner1, accounts[2]);

        // accounts[2] transfer ticket to platform then refund ticket
        await ticketInstance.transferTicket(17, platformInstance.address, {from: accounts[2]});

        let initialbalance = new BigNumber(await web3.eth.getBalance(accounts[2]));
        let refundTicket1 = await platformInstance.refundTicket(17, {from: accounts[2]});
        truffleAssert.eventEmitted(refundTicket1, "RefundTicket");
        let gasUsed = new BigNumber(refundTicket1.receipt.gasUsed);
        let tx = await web3.eth.getTransaction(refundTicket1.tx);
        let gasPrice = new BigNumber(tx.gasPrice);

        // Ensure ETH is refunded to refunder accounts[2] at half price
        let finalbalance = new BigNumber(await web3.eth.getBalance(accounts[2]));
        let halfPriceOfTicket = new BigNumber(await eventInstance.getEventTicketPrice(latestEventId)).dividedBy(2);
        // Initial - GasFees + Refund = Final ====> Initial - GasFees = Final - Refund
        await assert((finalbalance.minus(halfPriceOfTicket)).isEqualTo((initialbalance.minus(gasPrice.multipliedBy(gasUsed)))), "Did not return ETH back to refunder");

        // accounts[3] buy ticket
        let buyTicket1 = await platformInstance.buyTickets(latestEventId, 1, {from: accounts[3], value: oneEth});
        truffleAssert.eventEmitted(buyTicket1, "BuyTicket");

        // Ensure accurate ticket distribution
        let owner2 = await ticketInstance.getTicketOwner(17); // ticketId 17 belongs to accounts[3]
        assert.strictEqual(owner2, accounts[3]);

        // Seller ends event
        let sellerEnd = await platformInstance.sellerEndEvent(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(sellerEnd, "SellerEventEnd");

        // Owner confirms event ended and release sales and deposit to seller
        let ownerEnd = await platformInstance.endSuccessfulEvent(latestEventId, {from: accounts[0]});
        truffleAssert.eventEmitted(ownerEnd, "OwnerEventEnd");
    });

    it("Only original seller can call 'sellerEndEvent' function after event successfully ended", async () => {
        await accountInstance.verifyAccount(accounts[8], {from: accounts[0]});

        // Listing of event
        await platformInstance.listEvent("Title 2", "Venue 2", 2024, 3, 11, 12, 30, 0, 5, 65, accounts[1], {from: accounts[1], value: oneEth});
        let latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 2", title, "Failed to create event");

        
        await truffleAssert.reverts(platformInstance.sellerEndEvent(latestEventId, {from: accounts[2]}),"You are not a verified seller");
        await truffleAssert.reverts(platformInstance.sellerEndEvent(latestEventId, {from: accounts[8]}),"Only original seller can end event");
        await truffleAssert.reverts(platformInstance.sellerEndEvent(latestEventId, {from: accounts[1]}),"Event not at buyAndRefund state");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");
        
        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");
        
        // accounts[3] buy tickets
        let buyTickets = await platformInstance.buyTickets(latestEventId, 4, {from: accounts[3], value: oneEth.dividedBy(4)});
        truffleAssert.eventEmitted(buyTickets, "BuyTicket");
        
        // Seller ends event
        let sellerEnd = await platformInstance.sellerEndEvent(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(sellerEnd, "SellerEventEnd");

        assert(await eventInstance.getEventState(latestEventId), eventInstance.getSellerEventEndState(), "Event not at right state");
    });

    it("Owner calls 'endSuccessfulEvent', seller deposits + 95% of ticket sales transferred to seller when event ends", async () => {
        // Listing of event
        await platformInstance.listEvent("Title 2", "Venue 2", 2024, 3, 11, 12, 30, 0, 5, 65, accounts[1], {from: accounts[1], value: oneEth});
        
        let latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 2", title, "Failed to create event");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");
        
        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");
        
        // accounts[3] buy tickets
        let buyTickets = await platformInstance.buyTickets(latestEventId, 4, {from: accounts[3], value: oneEth.dividedBy(4)});
        truffleAssert.eventEmitted(buyTickets, "BuyTicket");
        
        // Seller ends event
        let sellerEnd = await platformInstance.sellerEndEvent(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(sellerEnd, "SellerEventEnd");

        await truffleAssert.reverts(platformInstance.endSuccessfulEvent(latestEventId, {from: accounts[1]}),"Only owner can call this function");

        // Find initialSellerBalance before performing endEvent function
        let initialSellerBalance = new BigNumber(await web3.eth.getBalance(accounts[1]));
        
        // Owner confirms event ended and release sales and deposit to seller
        let ownerEnd = await platformInstance.endSuccessfulEvent(latestEventId, {from: accounts[0]});
        truffleAssert.eventEmitted(ownerEnd, "OwnerEventEnd");

        assert(await eventInstance.getEventState(latestEventId), eventInstance.getPlatformEventEnd(), "Event not at right state");

        let finalSellerBalance = new BigNumber(await web3.eth.getBalance(accounts[1]));

        // Seller takes 95% of ticket sales
        let sellerTicketSales = new BigNumber(95 * 4 * 65 * 50000 / 100);

        // initialSellerBalance + sellerTicketSales + depositedEth = finalSellerBalance
        initialSellerBalance = initialSellerBalance.plus(sellerTicketSales).plus(oneEth);

        await assert(
            finalSellerBalance.isEqualTo(initialSellerBalance),
            "Seller did not received right amount of Eth when event ended."
        )
    });

    it("Platform keeps 5% commission of ticket sales when event ends", async () => {
        let platformOriginalBalance = new BigNumber(await accountInstance.getBalance(platformInstance.address));
        
        // Listing of event
        await platformInstance.listEvent("Title 3", "Venue 3", 2024, 3, 11, 12, 30, 0, 5, 65, accounts[1], {from: accounts[1], value: oneEth});

        let latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 3", title, "Failed to create event");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");
        
        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");
        
        // accounts[3] buy tickets
        let buyTickets = await platformInstance.buyTickets(latestEventId, 4, {from: accounts[3], value: oneEth.dividedBy(4)});
        truffleAssert.eventEmitted(buyTickets, "BuyTicket");
        
        // Seller ends event
        let sellerEnd = await platformInstance.sellerEndEvent(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(sellerEnd, "SellerEventEnd");

        // Owner confirms event ended and release sales and deposit to seller
        let ownerEnd = await platformInstance.endSuccessfulEvent(latestEventId, {from: accounts[0]});
        truffleAssert.eventEmitted(ownerEnd, "OwnerEventEnd");

        let finalPlatformBalance = new BigNumber(await accountInstance.getBalance(platformInstance.address));

        let platformCommission = new BigNumber(5 * 4 * 65 * 50000/ 100);

        // platformOriginalBalance + sellerTicketSales + depositedEth = finalPlatformBalance
        platformOriginalBalance = platformOriginalBalance.plus(platformCommission);

        await assert(
            finalPlatformBalance.isEqualTo(platformOriginalBalance),
            "Seller did not received right amount of commission when event ended."
        )
    });

    it("Failed event, buyers refunded accordingly, platform keeps deposits", async () => {
        let platformOriginalBalance = new BigNumber(await accountInstance.getBalance(platformInstance.address));
        
        // Listing of event
        await platformInstance.listEvent("Title 3", "Venue 3", 2024, 3, 11, 12, 30, 0, 5, 65, accounts[1], {from: accounts[1], value: oneEth});

        let latestEventId = (await eventInstance.getLatestEventId()).toNumber();
        const title = await eventInstance.getEventTitle(latestEventId);
        await assert("Title 3", title, "Failed to create event");

        // Commence bidding
        let bidCommenced = await platformInstance.commenceBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidCommenced, "BidCommenced");
        
        // Close bid
        let bidClosed = await platformInstance.closeBidding(latestEventId, {from: accounts[1]});
        truffleAssert.eventEmitted(bidClosed, "BidClosed");

        let acc2OriginalBalance = new BigNumber(await accountInstance.getBalance(accounts[2]));
        let acc3OriginalBalance = new BigNumber(await accountInstance.getBalance(accounts[3]));

        // accounts[2] buy ticket
        let buy2 = await platformInstance.buyTickets(latestEventId, 1, {from: accounts[2], value: oneEth.dividedBy(4)});
        truffleAssert.eventEmitted(buy2, "BuyTicket");

        // Find gasFees for performing buyTickets function
        let gasUsed = new BigNumber(buy2.receipt.gasUsed);
        let tx = await web3.eth.getTransaction(buy2.tx);
        let gasPrice = new BigNumber(tx.gasPrice);
        let gasFees2 = gasPrice.multipliedBy(gasUsed);

        // accounts[3] buy tickets
        let buy3 = await platformInstance.buyTickets(latestEventId, 2, {from: accounts[3], value: oneEth.dividedBy(4)});
        truffleAssert.eventEmitted(buy3, "BuyTicket");

        // Find gasFees for performing buyTickets function
        gasUsed = new BigNumber(buy3.receipt.gasUsed);
        tx = await web3.eth.getTransaction(buy3.tx);
        gasPrice = new BigNumber(tx.gasPrice);
        gasFees3 = gasPrice.multipliedBy(gasUsed);

        // Owner end failed event, refunds ETH to buyers accordingly
        let ownerEnd = await platformInstance.endUnsuccessfulEvent(latestEventId, {from: accounts[0]});
        truffleAssert.eventEmitted(ownerEnd, "OwnerEventEnd");

        let acc2FinalBalance = new BigNumber(await accountInstance.getBalance(accounts[2]));
        let acc3FinalBalance = new BigNumber(await accountInstance.getBalance(accounts[3]));
        let finalPlatformBalance = new BigNumber(await accountInstance.getBalance(platformInstance.address));

        // acc3OriginalBalance - gasFees3 = acc3FinalBalance
        acc3OriginalBalance = acc3OriginalBalance.minus(gasFees3)
        // acc2OriginalBalance - gasFees2 = acc2FinalBalance
        acc2OriginalBalance = acc2OriginalBalance.minus(gasFees2);
        // platformOriginalBalance + depositedEth = finalPlatformBalance
        platformOriginalBalance = platformOriginalBalance.plus(oneEth);

        await assert(platformOriginalBalance.isEqualTo(finalPlatformBalance), "Platform did not receive seller's deposit.")
        await assert(acc2OriginalBalance.isEqualTo(acc2FinalBalance), "Buyer not refunded correctly.")
        await assert(acc3OriginalBalance.isEqualTo(acc3FinalBalance), "Buyer not refunded correctly.")
    });

})
