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
    Auction auctionContract;

    event BidCommenced (uint256 eventId);
    event BidPlaced (uint256 eventId, address buyer, uint256 tokenBid);
    event BidClosed (uint256 eventId);
    event TransferToBuyerSuccessful(address to, uint256 amount);

    mapping(address => uint256) sellerDepositedValue;

    // Platform can only exist if other contracts are created first
    constructor(Account accountAddr, EventToken eventTokenAddr, Event eventAddr, Auction auctionAddr) public {
        accountContract = accountAddr;
        eventTokenContract = eventTokenAddr;
        eventContract = eventAddr;
        auctionContract = auctionAddr;
    }

    struct bidInfo {
        uint256 quantity;
        uint256 pricePerTicket;
        uint256 tokenPerTicket;
        uint256 firstIndexForEventBiddings; // For ease of updating bid
    }

    mapping(uint256 => uint256) public eventTopBid; // eventId => topBid
    mapping(uint256 => mapping(uint256 => address[])) public eventBiddings; // eventId => (tokenBid => addressArray) 
    mapping(address => mapping(uint256 => bidInfo)) public addressBiddings; // address => (eventId => bidInfo)

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

        uint256 newEventId = eventContract.createEvent(title, venue, year, month, day,hour,minute, second, 
        capacity, ticketsLeft,priceOfTicket,seller);

        return newEventId;
    }

    // Commence bidding for event
    function commenceBidding(uint256 eventId) public {
        require(msg.sender == eventContract.getEventSeller(eventId), "Only seller can commence bidding");
        require(eventContract.getEventBidState(eventId) == Event.bidState.close, "Event already open for bidding");

        eventContract.setEventBidState(eventId, Event.bidState.open);
        emit BidCommenced(eventId);
    }

    // Bid for ticket
    function placeBid(uint256 eventId, uint8 quantity, uint256 tokenBid) public payable isBuyer() {
        require(eventContract.getEventBidState(eventId) == Event.bidState.open, "Event not open for bidding");
        require(quantity <= 4, "You have passed the maximum bulk purchase limit");
        require(msg.value >= eventContract.getEventTicketPrice(eventId) * quantity, "Buyer has insufficient ETH");
        require(eventTokenContract.checkEventTokenOf(msg.sender) >= tokenBid * quantity, "Buyer has insufficient EventTokens");

        //TODO: Transfer tokenBid & ETH to contract
        //eventTokenContract.transferFrom(msg.sender, address(this), tokenBid * quantity);

    
        // Record eventBiddings
        uint256 firstIdx;
        for (uint8 i = 0; i < quantity; i++) {
            eventBiddings[eventId][tokenBid].push(msg.sender);
            if (i == 0) {
                firstIdx = eventBiddings[eventId][tokenBid].length - 1;
            }
        }

        // Record bidInfo for ease of future refund / update 
        bidInfo memory newBidInfo = bidInfo(quantity, eventContract.getEventTicketPrice(eventId), tokenBid, firstIdx);
        addressBiddings[msg.sender][eventId] = newBidInfo;
        
        // Update top bid
        if (tokenBid > eventTopBid[eventId]) {
            eventTopBid[eventId] = tokenBid;
        }
        emit BidPlaced(eventId, msg.sender, tokenBid);
    }

    // Close bidding and transfer tickets to top bidders
    function closeBidding(uint256 eventId) public {
        require(msg.sender == eventContract.getEventSeller(eventId), "Only seller can close bidding");
        require(eventContract.getEventBidState(eventId) == Event.bidState.open, "Event not open for bidding");

        uint256 bidAmount = eventTopBid[eventId];
        uint256 ticketsLeft = eventContract.getEventTicketsLeft(eventId);

        // Tickets given out starting from top bidders
        while (ticketsLeft != 0) {
            address[] memory bidderList = eventBiddings[eventId][bidAmount];
            for (uint256 i = 0; i < bidderList.length; i++) {
                if (bidderList[i] == address(0)) continue; 

                // TODO: transfer ticket to address @ bidderList[i]
                ticketsLeft--;

                if (ticketsLeft == 0) break;
            }
            if (bidAmount == 0) break;
            bidAmount--;
        }

        // TODO: Return unsuccessful bidders
        // returnBiddings()
        eventContract.setEventBidState(eventId, Event.bidState.close);
        emit BidClosed(eventId);
    }

    function updateBidding(uint256 eventId, uint8 quantity, uint256 tokenBid) public payable isBuyer() {

    }


    // Return unsuccessful bidders their corresponding ETH and tokens
    function returnBiddings() public {

    }

    /* Viewing the number of tickets left for an event */
    function viewTicketsLeft(uint256 eventId) public view returns (uint256) {
        return eventContract.getEventTicketsLeft(eventId);
    }

    /* Buyers buying tickets for an event */
    function buyTickets(uint256 eventId, uint8 quantity, uint256 price) public payable isBuyer() {
        require(quantity <= 4, "You have passed the maximum bulk purchase limit");

        /* Require eventid is a listed event */

        uint256 totalPrice = price * quantity;
        require(msg.value >= totalPrice, "Buyer has insufficient ETH to buy tickets");

        /* Map ticket id to an account */
        msg.sender.transfer(msg.value - totalPrice); // transfer remaining back to buyer
        emit TransferToBuyerSuccessful(msg.sender, msg.value - totalPrice);
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


}