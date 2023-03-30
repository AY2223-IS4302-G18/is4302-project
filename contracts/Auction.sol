pragma solidity ^0.5.0;

contract Auction {

    address platform;

    struct Bidder {
        address id;
        uint256 bid;
    }

    struct Bidding {
        uint256 maxTickets;
        Bidder[] bidders;
        mapping(address => uint256) bidderList;
        mapping(address => uint8) ticketCount;
    }

    mapping(uint256 => Bidding) private biddings;

    /* Ensure caller is a Platform */
    modifier isPlatform() {
        require(msg.sender == platform);
        _;
    }

    function setPlatformAddress(address _platform) external {
        require(platform == address(0), "Changing platform address is not allowed");
        platform = _platform;
    }

    function createBidding(uint256 _eventId, uint256 _maxTickets) external {
        Bidding storage newBidding = biddings[_eventId];
        newBidding.maxTickets = _maxTickets;
    }

    function placeBid(uint256 _eventId, address _userAddr, uint256 _bid, uint8 _qty) public {
        Bidding storage currentBidding = biddings[_eventId];

        for (uint8 i = 0; i < _qty; i++){
            currentBidding.bidders.push(Bidder(_userAddr, _bid));
            insertBidder(currentBidding);
        }
        
        currentBidding.ticketCount[_userAddr] = _qty;

        while (currentBidding.bidders.length > currentBidding.maxTickets) {
            removeMinimum(currentBidding);
        }
    }

    function updateBid(uint256 _eventId, address _userAddr, uint256 _bid, uint8 _qty) public {
        Bidding storage currentBidding = biddings[_eventId];
        uint8 userTicketCount = currentBidding.ticketCount[_userAddr];

        if (userTicketCount > 0) {
           for (uint8 i = 0; i < currentBidding.bidders.length; i++){
                if (currentBidding.bidders[i].id == _userAddr) {
                    currentBidding.bidders[i].bid = _bid;
                    minHeapify(currentBidding, i);
                }
            }
        }

        for (uint8 i = userTicketCount; i < _qty; i++){
            currentBidding.bidders.push(Bidder(_userAddr, _bid));
            insertBidder(currentBidding);
        }
        
        currentBidding.ticketCount[_userAddr] = _qty;

        while (currentBidding.bidders.length > currentBidding.maxTickets) {
            removeMinimum(currentBidding);
        }
    }

    // function closeAuction(uint256 eventId) isPlatform() external {

    // }

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

}