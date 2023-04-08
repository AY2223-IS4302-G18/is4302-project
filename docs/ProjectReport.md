# Architecture & Design document

## Group members:

| Member Name | Admin Number |
| ---|---|
| Han Jun Ding | A0221230E |
| Sean Phang | |
| Tan Teck Hwee | |
| Teo Chin Kai Remus| A0217148E |
| Teo Phing Huei, Aeron | A0225860E |

## Introduction

The purpose of this project is to leverage on cutting-edge capabilities of blockchain technology to effectively tackle the problem of scalping in the context of popular events. We aim to utilise the blockchain technology to create a secure, transparent, and decentralized system that helps event organizers, ticketing agencies and consumers to effectively manage the sale and distribution of tickets without unfair competition.

## Motivation

The current challenges with the ticket sale systems are the existence of scalpers that benefits from the traditional ticketing sale system and the lack of authenticity and accountability of tickets. Even though these challenges are not completely preventable using blockchain, the team still sees the potential benefits of deploying such application of blockchain. For instance, the implementation of priority system to reduce the opportunities for scalpers from benefitting and provide more transparency of information from the verification of organisations to the transaction of tickets. 

## Glossary

| Name | Explanation |
| -- | -- |
| Buyer | User that purchases event tickets on the platform |
| Organiser | User that lists events on the platform |

## Contents

* [Architecture](#architecture)
* [Implementation](#implementation) 

## Architecture

![ArchitectureDiagram](diagrams/diagram_images/ArchitectureDiagram.png)

An overview of the main components and how different stakeholders and contracts intereact is explained in detail below.

`Platform.sol` is the main contract that Organisers or Buyers will interact with.

The main capabilities of `Platform.sol` is to:
* Allow Organisers to list events on the platform.
* Allow Buyers to bid after an event is listed and buy tickets upon successful bidding.

`Platform.sol` interacts with other contracts such as:

* `Account.sol` : conducts verification on whether an Organiser is a verified on the Platform to list events. It also certifies a set of trusted accounts to provide rights for them to verify Organisers.
* `Event.sol` : creation and storing of the event information & creation of tickets through `Ticket.sol`.

`EventTokenMarket.sol` along with `EventTokenMarketAlgorithm` are the contracts where buyers can trade tokens that will be used during the bidding ticket process.

## Implementation

### Accounts

#### Account Management

`Account.Sol` stores three main information for accounts.
1) **state** : whether an account is verified or not
2) **verifier** : the certifier that verified the account
3) **certified** : whether an account is certified to verify other address

These information are stored in a mapping where the key is the address and the value would be the account object.

The relevant getter and setter functions for these information are also included.

This structure ensures ease of obtaining any account information. Moreover, any new account is defaulted with an unverified state, verifier address of 0 and certified set to false. This prevents unverified account to list events or verify other accounts.

#### Account Validation

The team assumes that `Account.sol` is trusted and the accounts certified by `Account.sol` are also trusted.

`Account.sol` has the authoritity to determine whether an account is certified to conduct verification for an account. Only when an account is certified by `Account.sol`, the account can verify the authenticity of other accounts.

```
AccountContract.certifyAccount(address addr)
```
Example (Certifying account[1]):
```
AccountContract.certifyAccount(address(account[1]))
```

After `Account.sol` certifies a set of accounts to provide them with the responsibility to verify authenticity of accounts, they can verify accounts that allows the requested accounts to be able to list an event. When a certified account conducts checks and is sure that an account is authentic, the certified account's address is stored in the requester's account information because the status of an account is changed. However, the authentication process will be done off-chain.  

```
AccountContract.verifyAccount(address addr)
```
Example (Verifying account[2]):
```
AccountContract.verifyAccount(address(account[2]))
```

An example scenario of the validation process will be as follows:
1. `Account.sol` certifies *account[1]* that can verify other accounts. The trusted accounts will be the oracle.
2. *account[2]* wants to list an event on the platform and has requested to be verified. *account[1]* can now conduct background checks on the authenticity of *acccount[2]*. This process will be done off-chain
3. Upon successful verification, *account[1]* verifies *account[2]* and now *account[2]* can list on the platform.

The team understand that this solution is not a full-proof solution to the oracle problem. This is due to `Account.sol` being a single point of failure and an account is also certified by only one certifier without any cross-checking.

Improvements to this implementation would be implementing ASTRAEA with voting and certifying process. This involves multiple stakeholders in the validation process and ensures that the entire voting process is fair. Stakeholders will also be incentivised or penalised depending on their validation result and whether they are a voter or certifer. However, this idea would be pushed for future developments due to time constraints.

### Ticket Sale System
 Our application adopts a state machine model to represent different behavioural contract stages and use state transitions to control the execution flow of the program. There are 4 main phases in our ticketing sales system that every event listed on the platform will undergo.

1. Initial Phase
    * By default, when an event is listed on the platform, it will be initialized to this closed state which means that it is still not available to buyers.
2. Bidding Phase
    * Seller will be authorised to commence the start of the bidding phase for a listed event which will allow buyers to bid for tickets.
    * Buyers place & update bids such that ETH is used to pay for the price of tickets but the bidding for each ticket is using EventTokens. 
    * The seller can decide when to close the bidding phase such that when executed, the smart contract will perform an algorithm that will distribute tickets in a way to give priority to bidders that bidded with more EventTokens and automatically transfer tickets to successful bidders as well as return ETH back to unsuccessful bidders.
3. Buying & Refund Phase 
    * In this phase, buyers can perform normal purchasing of leftover available tickets and refunding of tickets is also possible through the platform. 
4. End Phase
    * This phase marks the end of a successful event where ETH will be released to seller.

#### Listing events
To list an event, the organiser has to specify the venue year, month, day, hour, minute, second, capacity, its address and ticket price details of the event to be held. 
```
PlatformContract.listEvent(string memory title,
        string memory venue,
        uint256 year, uint256 month, uint256 day, uint256 hour, uint256 minute, uint256 second,
        uint256 capacity,
        uint256 priceOfTicket,
        address seller)
```
Only a verified accounts can act as an organiser and list events on the platform. Organiser has to also make a deposit of half the total ticket sales (capacity * priceOfTicket / 2) to list an event. This is to prevent the organiser from irresponsibly creating and cancelling an event. 

The event details will then be passed to the event contract for the creation of the actual event object. Event tickets will also be generated and mapped to the newly created eventId.

#### Commence Bidding
Commence bidding function changes the event state to “bidding”, allowing buyers to start bidding for the ticket. Only the original organiser is allowed to commence bidding and event state must be “initial” when this function is called, after which event state will be changed to “bidding”.
```
eventContract.setEventState(eventId, Event.eventState.bidding);
```

#### Ticket bidding
Tickets will be available for bidding when the seller commences the start of the bidding phase. In this bidding phase, buyers will be able to place bids for an event by specifying the eventId, quantity, tokenBid parameters.  

```
PlatformContract.placeBid(uint256 eventId, uint256 quantity, uint256 tokenBid)
```

The following conditions must be met for a buyer to successfully bid for tickets to an event:  
1. Event must be a valid and ongoing, with event state set as “bidding".
2. Buyers can place a bid for a minimum of 1 ticket, and up to a maximum of 4 tickets. This is to prevent scalpers from bulk bidding event tickets.
3. Buyer can place a bid using a minimum of 0 EventTokens to use for bidding. If a buyers to bid using EventTokens, the buyer must have sufficient EventTokens specified in tokenBid parameter to place the bid as EventTokens are collected upon placing of bid.
4. Buyers must have sufficient ETH specified in msg.value to place the bid for desired amount of tickets as ETH is collected upon placing of bid.


Example (Placing a bid of 4 tickets using 5 tokenBids each for eventId 0):
```
PlatformContract.placeBid(0, 4, 5)
```

Although one account can only place a bid for a specific event once, there is an updateBid function available for buyers to update their biddings.  

#### Close Bidding
Buyers can continue to place and update bids up until the seller decides to close the bidding. On closure, our algorithm will automatically distribute tickets to successful bidders as well as return ETH back to unsuccesful bidders.

The algorithm logic for ticket distribution is as follows:
1. Starting from the highest token bid, transfer tickets to bidders break tie by first come first serve if bidders have the same token bid amount.
2. Continue transfering tickets until all tickets left for event have been given out and return ETH to unsucessful bidders or continue transfering tickets until all bidders have received tickets such that there are leftover tickets.
3. Update tickets left for event
4. Change event state to allow buying and refunding of tickets.

In this close bidding phase, only the seller who listed the event will be able to close bidding for an event by specifying the eventId. 
```
PlatformContract.closeBidding(uint256 eventId)
```
Example (Close bidding phase for eventId 0):
```
PlatformContract.closeBidding(0)
```  

#### Buying tickets
The buyTickets function is to allow buyers to buy the remaining, available (unsold or refunded) tickets after the bidding session has closed. 

```
PlatformContract.buyTickets(uint256 eventId, uint8 quantity)
```

The following conditions must be met for a buyer to successfully buy tickets to an event:
1. Event must be a valid and ongoing, with event state set as “buyAndRefund”
2. Buyers can buy a minimum of 1 ticket, and up to a maximum of 4 tickets. This is to prevent scalpers from bulk buying event tickets and reselling at a higher price.
3. Buyers can only buy tickets if there are still tickets available for sale.
4. Buyer has sufficient ETH to buy the desired amount of tickets

#### Ticket refund

### Event end
For simplicity of this project, the team only considered 2 possible ending outcomes for an event:
1. Successful event 

    For an event outcome to be considered 'successful', the actual event must have occured/ carried out successfully. After which, the seller is able to call *sellerEndEvent(uint256 eventId)* function. This function changes the event state to "sellerEventEnd" and informs the contract owner that event has ended successfully. Contract owner can then call *endSuccessfulEvent(uint256 eventId)* function to release the ticket sales and deposits to the seller. 

2. Unsuccessful event

    For an event outcome to be considered 'unsuccessful', the actual event did not take place. This can be due to organiser disappearing or running away before the actual event. In such scenario, contract owner can then call the *endUnsuccessfulEvent(uint256 eventId)*. This function refunds ETH to the buyers, who participated in the bidding and buying of tickets, accordingly. The deposits from the organiser will be kept by the platform as a form of penalty.

The purpose of the above methods is to prevent organisers from being irresponsible and scamming buyers through the "fake" event. Ticket sales and deposits will be managed by the platform and only released to the organiser after event ended successfully. 

Note: It is assumed here that the contract owner will be honest in verifying the actual event outcome and calling the appropriate ending function.

### Tokenomics