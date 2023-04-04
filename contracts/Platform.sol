pragma solidity ^0.5.0;

import "./Account.sol";
import "./Event.sol";
import "./Ticket.sol";
import "./EventToken.sol";
import "./Auction.sol";

contract Platform {
    Account accountContract;
    EventToken eventTokenContract;
    Event eventContract;
    Ticket ticketContract;
    Auction auctionContract;

    event BidCommenced (uint256 eventId);
    event BidPlaced (uint256 eventId, address buyer, uint256 tokenBid);
    event BidUpdated (uint256 eventId, address buyer, uint256 tokenBid);
    event BidBuy (uint256 eventId);
    event TransferToBuyerSuccessful(address to, uint256 amount);

    mapping(address => uint256) sellerDepositedValue;
    address owner;
    address payable[] eventBidders;

    // Platform can only exist if other contracts are created first
    constructor(Account accountAddr, EventToken eventTokenAddr, Event eventAddr, Ticket ticketAddr, Auction auctionAddr) public {
        accountContract = accountAddr;
        eventTokenContract = eventTokenAddr;
        eventContract = eventAddr;
        ticketContract = ticketAddr;
        owner = msg.sender;
        auctionContract = auctionAddr;
    }

    /* Ensure caller is a buyer */
    modifier isBuyer() {
        require(accountContract.viewAccountState(msg.sender) == accountContract.getUnverifiedStatus());
        _;
    }

    /*Ensure caller is a verified seller*/
    modifier isOrganiser() {
        require(accountContract.viewAccountState(msg.sender) == accountContract.getVerifiedStatus(), "You are not a verified seller");
        _;
    }

    // list Event on Platform
    function listEvent(string memory title,
        string memory venue,
        uint256 year, uint256 month, uint256 day, uint256 hour, uint256 minute, uint256 second,
        uint256 capacity,
        uint256 ticketsLeft,
        uint256 priceOfTicket,
        address seller) public payable isOrganiser() returns (uint256) {

        // however msg.value here will not be sent to event contract. msg.value at event contract is 0.
        require(msg.value >= calMinimumDeposit(capacity,priceOfTicket) * 1 wei, "Insufficient deposits. Need deposit minimum (capacity * priceOfTicket)/2 * 50000 wei to list event.");

        uint256 newEventId = eventContract.createEvent(title, venue, year, month, day, hour, minute, second, capacity, ticketsLeft, priceOfTicket, seller);

        return newEventId;
    }

    // Commence bidding for event
    function commenceBidding(uint256 eventId) public {
        require(msg.sender == eventContract.getEventSeller(eventId), "Only seller can commence bidding");
        require(eventContract.getEventBidState(eventId) == Event.bidState.close, "Event already open for bidding");

        eventContract.setEventBidState(eventId, Event.bidState.open);
        
        uint256 nTickets = eventContract.getEventTicketsLeft(eventId);
        auctionContract.createBidding(eventId, nTickets);
        emit BidCommenced(eventId);
    }

    // Bid for ticket
    function placeBid(uint256 eventId, uint8 quantity, uint256 tokenBid) public payable isBuyer() {
        require(eventContract.getEventBidState(eventId) == Event.bidState.open, "Event not open for bidding");
        require(quantity > 0, "Quantity of tickets must be at least 1");
        require(quantity <= 4, "You have passed the maximum bulk purchase limit");
        require(msg.value >= eventContract.getEventTicketPrice(eventId) * quantity, "Buyer has insufficient ETH");
        require(eventTokenContract.checkEventTokenOf(msg.sender) >= tokenBid * quantity, "Buyer has insufficient EventTokens");
        
        uint256 ethCost = eventContract.getEventTicketPrice(eventId) * quantity;
        // Transfer tokenBid & ETH to contract
        if (tokenBid > 0) {
            require(eventTokenContract.checkAllowance(msg.sender, address(this)) >= tokenBid * quantity, "Buyer has not approved sufficient EventTokens");
            eventTokenContract.approvedTransferFrom(msg.sender, address(this), address(this), tokenBid * quantity);
        }
        eventBidders.push(msg.sender);
        auctionContract.placeBid(eventId, msg.sender, tokenBid, quantity);

        emit BidPlaced(eventId, msg.sender, tokenBid);
        msg.sender.transfer(msg.value - ethCost); // transfer remaining back to buyer
    }

    // Close bidding and transfer tickets to top bidders
    function closeBidding(uint256 eventId) public {
        require(msg.sender == eventContract.getEventSeller(eventId), "Only seller can close bidding");
        require(eventContract.getEventBidState(eventId) == Event.bidState.open, "Event not open for bidding");

        auctionContract.closeAuction(eventId);
        auctionContract.grantTickets(eventId);
        returnBiddings(eventId);

        eventContract.setEventBidState(eventId, Event.bidState.buy);
        emit BidBuy(eventId);
    }

    function updateBidding(uint256 eventId, uint256 tokenBid) public payable isBuyer() {
        uint256 curBid = auctionContract.getCurrentBid(eventId, msg.sender);
        uint8 qty = auctionContract.getTicketInitialCount(eventId, msg.sender);
        require(tokenBid > curBid, "new bid has to be higher then current bid");

        uint256 reqTokens = (tokenBid - curBid) * qty;
        require(eventTokenContract.checkAllowance(msg.sender, address(this)) >= reqTokens, "Buyer has not approved sufficient EventTokens");
        
        eventTokenContract.approvedTransferFrom(msg.sender, address(this), address(this), reqTokens);
        auctionContract.updateBid(eventId, msg.sender, tokenBid, qty);
        emit BidUpdated(eventId, msg.sender, tokenBid);
    }

    // Return unsuccessful bidders their corresponding ETH and tokens
    function returnBiddings(uint256 _eventId) private {
        for (uint256 i = 0; i < eventBidders.length; i++) {
            uint256 returnTik = auctionContract.getFailedBids(_eventId, eventBidders[i]);
            if (returnTik > 0) {
                // returnEth(address(uint168(eventBidders[i])), eventContract.getEventTicketPrice(_eventId)*returnTik);
                returnEth(eventBidders[i], eventContract.getEventTicketPrice(_eventId)*returnTik);
            }
        }
    }

    /* Viewing the number of tickets left for an event */
    function viewTicketsLeft(uint256 eventId) public view returns (uint256) {
        return eventContract.getEventTicketsLeft(eventId);
    }

    /* Buyers buying tickets for an event */
    function buyTickets(uint256 eventId, uint8 quantity) public payable isBuyer() {
        require(eventContract.getEventBidState(eventId) == Event.bidState.buy, "Event not open for buying");
        require(quantity > 0, "Quantity of tickets must be at least 1");
        require(quantity <= 4, "You have passed the maximum bulk purchase limit");
        require(eventContract.isEventIdValid(eventId) == true, "Invalid Event");
        require(eventContract.getEventTicketsLeft(eventId) >= quantity, "Not enough tickets");

        uint256 totalPrice = eventContract.getEventTicketPrice(eventId) * quantity;
        require(msg.value >= totalPrice, "Buyer has insufficient ETH to buy tickets");

        // Transfer ticket
        for (uint256 i = 0; i < quantity; i++) {
            eventContract.grantTicket(eventId, msg.sender);
        }

        msg.sender.transfer(msg.value - totalPrice); // transfer remaining back to buyer
        emit TransferToBuyerSuccessful(msg.sender, msg.value - totalPrice);
    }

    function refundTicket(uint256 ticketId) public payable isBuyer() {
        // Return money
        uint256 toReturn = eventContract.getEventTicketPrice(ticketId); 
        eventContract.returnTicket(ticketId);
        returnEth(msg.sender, toReturn);
    }

    function endEvent(uint256 eventId) public isOrganiser() {
        address seller = eventContract.getEventSeller(eventId);
        require(seller == msg.sender, "Only original seller can end event");
        eventContract.endEvent(eventId);
        msg.sender.transfer(sellerDepositedValue[seller]);
    }

    function calMinimumDeposit(uint256 capacity, uint256 priceOfTicket) public pure returns(uint256){
        // 1USD = 50,000 wei
        return (capacity * priceOfTicket)/2 * 50000;
    }

    function returnEth(address payable _to, uint256 _val) public payable {
        _to.transfer(_val);
    }

    function getBidders(uint256 _eventId) public {
        auctionContract.getBidders(_eventId);
    }

}