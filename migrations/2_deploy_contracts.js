const Event = artifacts.require("Event");
const Ticket = artifacts.require("Ticket");
const EventToken = artifacts.require("EventToken");
const Account = artifacts.require("Account");
const Platform = artifacts.require("Platform");
const Auction = artifacts.require("Auction");

module.exports = async (deployer, network, account) => {
    await deployer.deploy(EventToken)
    .then(function () {
        return deployer.deploy(Ticket)
    }).then(function () {
        return deployer.deploy(Event, Ticket.address)
    })
    .then(function () {
        return deployer.deploy(Account)
    })
    .then(function () {
        return deployer.deploy(Auction, Ticket.address)
    })
    .then(function () {
        return deployer.deploy(Platform, Account.address, EventToken.address, Event.address, Ticket.address, Auction.address)
    });

    auctionInstance = await Auction.deployed();
    await auctionInstance.setPlatformAddress(Platform.address);
};
