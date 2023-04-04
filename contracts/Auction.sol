pragma solidity ^0.5.0;

import "./Event.sol";

contract Auction {

    address platformContract;
    Event eventContract;

    constructor(Event eventAddress) public {
        eventContract = eventAddress;
    }

    struct Bidder {
        address id;
        uint256 bid;
    }

    struct Bidding {
        uint256 maxTickets;
        uint256 nBidders;
        Bidder[] bidders;
        mapping(address => uint256) bidderList;
        mapping(address => uint8) ticketCount;
        mapping(address => uint8) initialCount;
    }

    mapping(uint256 => Bidding) private biddings;
    mapping(uint256 => bool) private biddingOpen;

    /* Ensure caller is a Platform */
    modifier isPlatform() {
        require(msg.sender == platformContract);
        _;
    }

    /* Ensure bidding is open */
    modifier isOpen(uint256 _eventId) {
        require(biddingOpen[_eventId]);
        _;
    }

    /* Ensure bidding is closed */
    modifier isClosed(uint256 _eventId) {
        require(!biddingOpen[_eventId]);
        _;
    }

    function setPlatformAddress(address _platform) external {
        require(platformContract == address(0), "Changing platform address is not allowed");
        platformContract = _platform;
    }

    function createBidding(uint256 _eventId, uint256 _maxTickets) external {
        Bidding storage newBidding = biddings[_eventId];
        newBidding.maxTickets = _maxTickets;
        newBidding.nBidders = 0;
        biddingOpen[_eventId] = true;
    }

    function placeBid(uint256 _eventId, address _userAddr, uint256 _bid, uint8 _qty) isOpen(_eventId) external {
        Bidding storage currentBidding = biddings[_eventId];
        require(currentBidding.ticketCount[_userAddr] == 0, "User has already placed a bid");

        for (uint8 i = 0; i < _qty; i++){
            currentBidding.bidders.push(Bidder(_userAddr, _bid));
            insertBidder(currentBidding);
            currentBidding.nBidders++;
        }
        
        currentBidding.initialCount[_userAddr] = _qty;
        currentBidding.ticketCount[_userAddr] = _qty;
        currentBidding.bidderList[_userAddr] = _bid;

        while (currentBidding.bidders.length > currentBidding.maxTickets) {
            removeMinimum(currentBidding);
            currentBidding.nBidders--;
        }
    }

    event updateVal(address _id, uint256 _bid);
    event initialQty(uint256 _bid);
    event eaddr(address addr, uint256 bid);
    function updateBid(uint256 _eventId, address _userAddr, uint256 _bid, uint8 _qty) isOpen(_eventId) external {
        Bidding storage currentBidding = biddings[_eventId];

        require(_bid > currentBidding.bidderList[_userAddr], "new bid has to be higher then current bid");

        uint8 userTicketCount = currentBidding.ticketCount[_userAddr];
        emit eaddr(_userAddr, 0);
        emit initialQty(_qty);
        emit updateVal(_userAddr, userTicketCount);
        if (userTicketCount > 0) {
           for (uint8 i = 0; i < currentBidding.bidders.length; i++){
                emit eaddr(currentBidding.bidders[i].id, currentBidding.bidders[i].bid);
                if (currentBidding.bidders[i].id == _userAddr) {
                    currentBidding.bidders[i].bid = _bid;
                    minHeapify(currentBidding, i);
                }
            }
        }

        getBidders(_eventId);

        for (uint8 i = userTicketCount; i < _qty; i++){
            currentBidding.bidders.push(Bidder(_userAddr, _bid));
            insertBidder(currentBidding);
            currentBidding.nBidders++;
        }
        
        currentBidding.ticketCount[_userAddr] = _qty;
        currentBidding.bidderList[_userAddr] = _bid;

        while (currentBidding.bidders.length > currentBidding.maxTickets) {
            removeMinimum(currentBidding);
            currentBidding.nBidders--;
        }
    }

    function closeAuction(uint256 _eventId) isPlatform() external {
        biddingOpen[_eventId] = false;
    }

    function grantTickets(uint256 _eventId) isPlatform() isClosed(_eventId) external {
        Bidding storage currentBidding = biddings[_eventId];

        for (uint256 i = 0; i < currentBidding.nBidders; i++){
            eventContract.grantTicket(_eventId, currentBidding.bidders[i].id);
        }
    }

    // TEST FUNCTION
    event bidVal(address _id, uint256 _bid);
    function getBidders(uint256 _eventId) public {
        Bidding storage currentBidding = biddings[_eventId];
        uint256 n = currentBidding.bidders.length;

        for (uint256 i = 0; i < n; i++){
            emit bidVal(currentBidding.bidders[i].id, currentBidding.bidders[i].bid);
        }
    }

    function insertBidder(Bidding storage _bidding) private {
        uint256 n = _bidding.bidders.length;
        
        uint256 cur = n-1;
        while (cur > 0 && _bidding.bidders[parent(cur)].bid > _bidding.bidders[cur].bid) {
            Bidder memory temp = _bidding.bidders[parent(cur)];
            _bidding.bidders[parent(cur)] = _bidding.bidders[cur];
            _bidding.bidders[cur] = temp;
            // Update the current index of element
            cur = parent(cur);
        }
    }

    function removeMinimum(Bidding storage _bidding) private {
        uint256 n = _bidding.bidders.length;
        if (n == 0) {
            return;
        }

        Bidder memory lastElement = _bidding.bidders[n-1];
        _bidding.bidders.pop();
        _bidding.ticketCount[_bidding.bidders[0].id]--;
        _bidding.bidders[0] = lastElement;
        minHeapify(_bidding, 0);
    }

    function minHeapify(Bidding storage _bidding, uint256 _index) private {        
        if (_bidding.bidders.length <= 1) {
            return;
        }

        uint256 left = left_child(_index); 
        uint256 right = right_child(_index); 

        uint256 smallest = _index;

        if (left < _bidding.bidders.length && _bidding.bidders[left].bid < _bidding.bidders[_index].bid) {
            smallest = left; 
        }
        
        if (right < _bidding.bidders.length && _bidding.bidders[right].bid < _bidding.bidders[smallest].bid) {
            smallest = right; 
        }

        if (smallest != _index) { 
            Bidder memory temp = _bidding.bidders[_index];
            _bidding.bidders[_index] = _bidding.bidders[smallest];
            _bidding.bidders[smallest] = temp;
            minHeapify(_bidding, smallest); 
        }

    }

    function parent(uint256 i) private pure returns (uint256) {
        return (i-1)/2;
    }

    function left_child(uint256 i) private pure returns (uint256) {
        return (2*i)+1;
    }

    function right_child(uint256 i) private pure returns (uint256) {
        return (2*i)+2;
    }

    function getFailedBids(uint256 _eventId, address _userAddr) public view returns (uint256) {
        return (biddings[_eventId].initialCount[_userAddr]-biddings[_eventId].ticketCount[_userAddr]);
    }

    function getCurrentBid(uint256 _eventId, address _userAddr) public view returns (uint256) {
        Bidding storage currentBidding = biddings[_eventId];
        return currentBidding.bidderList[_userAddr];
    }

    function getTicketInitialCount(uint256 _eventId, address _userAddr) public view returns (uint8) {
        Bidding storage currentBidding = biddings[_eventId];
        return currentBidding.initialCount[_userAddr];
    }

}