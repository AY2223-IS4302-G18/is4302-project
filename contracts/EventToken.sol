pragma solidity ^0.5.0;

import "./ERC20.sol";

contract EventToken {
    ERC20 erc20Contract;
    //uint256 supplyLimit;
    uint256 currentSupply;
    uint256 basePriceOfToken;
    uint256 numberOfUsers;
    mapping (address => bool) UsersWithTokens;
    mapping(address => bool) allowedRecipient; // mapping of addresses that is able to recieve transfer of tokens from users
    mapping(address => bool) authorisedAddress; // mapping od addresses authorised to use certain functions
    address owner;

    event NewAllowedAddress(address _recipient);
    event NewAuthorisedAddress(address _address);
    event MintToken(address to, uint256 amount);
    event BurnToken(address to, uint256 amount);

    constructor() public {
        ERC20 e = new ERC20();
        erc20Contract = e;
        owner = msg.sender;
        currentSupply = 0;
        basePriceOfToken = 50000;
        allowedRecipient[owner] = true;
        authorisedAddress[owner] = true;
        numberOfUsers = 0;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "You do not have permission to do this");
        _;
    }

    modifier onlyAllowedRecipient(address _recipent) {
        require(allowedRecipient[_recipent], "This recipient is not part of allowed addresses to recieve token transfer");
        _;
    }

    modifier onlyAuthorisedAddress() {
        require(authorisedAddress[msg.sender], "You do not have permission to do this");
        _;
    }

    /**
     * Add address to be allowed recipient of transfer of tokens
     *
     * param address to add
     * 
     */
    function addAllowedRecipient(address _recipient) public onlyOwner {
        allowedRecipient[_recipient] = true;
        emit NewAllowedAddress(_recipient);
    }

    /**
     * Add address authorised to use certain functions
     *
     * param address to add
     * 
     */
    function addAuthorisedAddress(address _address) public onlyOwner {
        authorisedAddress[_address] = true;
        emit NewAuthorisedAddress(_address);
    }

    /**
     * Mint event tokens for address based on amount of wei
     *
     * param amount of token
     * param address to get token
     * 
     */
    function mintToken(uint256 amtOfWei, address _to) public onlyAuthorisedAddress {
        uint256 amtOfToken = amtOfWei / basePriceOfToken;
        erc20Contract.mint(_to, amtOfToken);
        currentSupply = currentSupply + amtOfToken;
        if (UsersWithTokens[_to] == false) { // New user
            numberOfUsers = numberOfUsers + 1;
            UsersWithTokens[_to] = true;
        }
        emit MintToken(_to, amtOfToken);
    }

    /**
     * Burn event tokens from address
     *
     * param amount of token
     * param address to get token
     * 
     */
     function burnToken(uint256 amtOfToken, address _from) public onlyAuthorisedAddress {
        erc20Contract.burn(_from, amtOfToken);
        currentSupply = currentSupply - amtOfToken;
        emit BurnToken(_from, amtOfToken);
    }

    /**
     * Transfer token from one address to another (Only allowed recipients are able to recieve tokens)
     *
     * param amount of tokens to bid
     * 
     */
    function transferFrom(address _from, address _to, uint256 _value) public onlyOwner {
        erc20Contract.transferFrom(_from, _to, _value);
    }

    /**
     * Approve token to be spendable by spender
     *
     * param address of spender
     * param value of token allowed to spend
     * 
     */
    function approveToken(address _spender, uint256 _value) public returns (bool) {
        return erc20Contract.approve(_spender, _value);
    }

    /**
     * Transfer token from address to address
     *
     * param address of owner to transfer from
     * param address of caller which is approved with allowance to transfer
     * param address of approved spender 
     * param value of token to transfer
     * 
     */
    function approvedTransferFrom(address _from, address _caller, address _to, uint256 _value) public {
        erc20Contract.approvedTransferFrom(_from, _caller, _to, _value);
    }

    /**
     * Check token allowance of approved spender
     *
     * param address of owner
     * param address of approved spender
     * 
     */
    function checkAllowance(address _owner, address _spender) public view returns (uint256) {
        return erc20Contract.allowance(_owner, _spender);
    }

    // For getting tokens for testing purposes [To be removed in production]
    function getTokenForTesting(address addr, uint256 amt) public onlyOwner {
        erc20Contract.mint(addr, amt);
    }

    // For checking of token credits
    function checkEventToken() public view returns(uint256) {
        return erc20Contract.balanceOf(msg.sender);
    }

    // For checking of token credits of address
    function checkEventTokenOf(address addr) public view returns(uint256) {
        return erc20Contract.balanceOf(addr);
    }

    // Check current amount of supply of tokens in the market
    function getCurrentSupply() public view returns (uint256) {
        return currentSupply;
    }

    // Check current amount of users in the market
    function getNumberOfUsers() public view returns (uint256) {
        return numberOfUsers;
    }

    // get base price of tokens
    function getBasePriceOfToken() public view returns (uint256) {
        return basePriceOfToken;
    }

}