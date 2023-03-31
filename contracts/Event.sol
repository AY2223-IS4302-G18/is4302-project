pragma solidity ^0.5.0;

import "./DateTime.sol";
import "./Ticket.sol";

contract Event {

    Ticket ticketContract;

    constructor(Ticket ticketAddress) public {
        ticketContract = ticketAddress;
    }

    enum bidState { close, open, buy }

    struct eventObj {
        string title;
        string venue;
        uint256 dateAndTime;
        uint256 capacity;
        uint256 ticketsLeft;
        uint256 nxtTicket;
        uint256 priceOfTicket;
        address seller;
        bidState state;
        uint256 firstTicketId;
        uint256[] returnedTickets;
    }

    uint256 public numEvents = 0;
    mapping(uint256 => eventObj) public events;

    function createEvent(
        string memory title,
        string memory venue,
        uint256 year, uint256 month, uint256 day, uint256 hour, uint256 minute, uint256 second,
        uint256 capacity,
        uint256 ticketsLeft,
        uint256 priceOfTicket,
        address seller
    ) public returns (uint256) {
        require(DateTime.timestampFromDateTime(year, month, day, hour, minute, second) > now, "Invalid Date and Time");

        eventObj memory newEvent = eventObj(
            title,
            venue,
            DateTime.timestampFromDateTime(year, month, day, hour, minute, second),
            capacity,
            ticketsLeft,
            0,
            priceOfTicket,
            seller,
            bidState.close,
            0,
            new uint256[](0)
        );

        uint256 newEventId = numEvents++;
        events[newEventId] = newEvent;

        // Generate Tickets
        uint256 firstTicketId = generateEventTickets(msg.sender, newEventId, priceOfTicket, Ticket.category.standard, ticketsLeft);

        setEventFirstTicketId(newEventId, firstTicketId);

        return newEventId;
    }

    modifier validEventId(uint256 eventId) {
        require(eventId < numEvents);
        _;
    }

    function isEventIdValid(uint256 eventId) public view returns(bool) {
        return eventId < numEvents;
    }

    function generateEventTickets(address owner, uint256 eventId, uint256 price, Ticket.category cat, uint256 numOfTickets) public validEventId(eventId) returns (uint256) {
        uint256 firstTicketId;

        firstTicketId = ticketContract.add(owner, eventId, price, cat, 0);
        for (uint256 i = 1; i < numOfTickets; i++) {
            ticketContract.add(owner, eventId, price, cat, i);
        }

        events[eventId].ticketsLeft = numOfTickets;
        events[eventId].nxtTicket = firstTicketId;

        return firstTicketId;
    } 

    function grantTicket(uint256 _eventId, address _grantTo) external returns (uint256) {
        require(events[_eventId].ticketsLeft > 0, "Insufficient tickets to grant");

        uint256 tktId;
        uint256 nReturned = events[_eventId].returnedTickets.length;

        if (nReturned == 0) {
            tktId = events[_eventId].nxtTicket;
            events[_eventId].nxtTicket++;
        } else {
            tktId = events[_eventId].returnedTickets[nReturned-1];
            events[_eventId].returnedTickets.pop();
        }
        ticketContract.transferTicket(tktId, _grantTo);
        events[_eventId].ticketsLeft--;
        return tktId;
    }

    function returnTicket(uint256 _tktId) external {
        require(ticketContract.getTicketOwner(_tktId) != msg.sender, "Ticket already returned");
        uint256 eventId = ticketContract.getTicketEvent(_tktId);
        
        ticketContract.transferTicket(events[eventId].nxtTicket, msg.sender);
        events[eventId].returnedTickets.push(_tktId);
        events[eventId].ticketsLeft++;
    }

    function getEventTitle(uint256 eventId) public view validEventId(eventId) returns (string memory) {
        return events[eventId].title;
    }

    function getEventVenue(uint256 eventId) public view validEventId(eventId) returns (string memory) {
        return events[eventId].venue;
    }

    function getEventDateAndTime(uint256 eventId) public view validEventId(eventId) returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        return DateTime.timestampToDateTime(events[eventId].dateAndTime);
    }

    function getEventCapacity(uint256 eventId) public view validEventId(eventId) returns (uint256) {
        return events[eventId].capacity;
    }

    function getEventTicketsLeft(uint256 eventId) public view validEventId(eventId) returns (uint256) {
        return events[eventId].ticketsLeft;
    }

    function getEventTicketPrice(uint256 eventId) public view validEventId(eventId) returns (uint256) {
        return events[eventId].priceOfTicket;
    }
    
    function getEventSeller(uint256 eventId) public view validEventId(eventId) returns (address) {
        return events[eventId].seller;
    }


    function endEvent(uint256 eventId) public validEventId(eventId) {
        // return of deposit value done at Platform
        // only call this function at Platform
        delete events[eventId];
    }
    
    function getEventBidState(uint256 eventId) public view validEventId(eventId) returns (bidState) {
        return events[eventId].state;
    }

    function setEventBidState(uint256 eventId, bidState bstate) public validEventId(eventId) {
        events[eventId].state = bstate;
    }

    function getEventFirstTicketId(uint256 eventId) public view validEventId(eventId) returns (uint256) {
        return events[eventId].firstTicketId;
    }

    function setEventFirstTicketId(uint256 eventId, uint256 ticketId) public validEventId(eventId) {
        events[eventId].firstTicketId = ticketId;
    }

    function getLatestEventId() public view returns (uint256) {
        return numEvents - 1;
    }
}

