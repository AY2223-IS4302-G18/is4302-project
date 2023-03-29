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
    // , uint256 _qty
    function placeBid(uint256 _eventId, address _userAddr, uint256 _bid) public {
        Bidding storage currentBidding = biddings[_eventId];

        if (currentBidding.bidderList[_userAddr] > 0) {
            // User already bid on event

        } else {
            // Add new user
            currentBidding.bidders.push(Bidder(_userAddr, _bid));
            insertBidder(currentBidding);
        }

        while (currentBidding.bidders.length > currentBidding.maxTickets) {
            removeMinimum(currentBidding);
        }
    }

    // function closeAuction(uint256 eventId) isPlatform() external {

    // }

    // TEST FUNCTION
    // event bidVal(uint256 _bid);
    // function getBidders(uint256 _eventId, uint256 idx) public {
    //     Bidding storage currentBidding = biddings[_eventId];
    //     uint256 val = currentBidding.bidders[idx].bid;
    //     emit bidVal(val);
    // }

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