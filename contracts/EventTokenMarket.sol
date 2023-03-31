pragma solidity ^0.5.0;
import "./EventToken.sol";
import "./EventTokenMarketAlgorithm.sol";

contract EventTokenMarket {

   EventToken eventTokenContract;                        // Our event token contract
   EventTokenMarketAlgorithm marketAlgorithmContract;    // Our event token algorithm contract
   uint256 public _comissionFeePercentage;               // What is the comission fee
   uint256 totalComissionFee;
   address _owner;                                       // Owner of event token market
   mapping(address => uint256[]) usersCurrentListing;     // Save history of user listing

   event SellOrderListed(uint256 orderId, address _seller, uint256 _quantity);
   event SellOrderDelisted(address _seller, uint256 sellOrderId);
   event BuyToken(address buyer, uint256 quantity, uint256 priceOfEachToken);

   modifier onlyOwner() {
         require(msg.sender == _owner, "You do not have permission to do this");
         _;
   }

   constructor(EventToken eventTokenAddress, uint256 comissionFeePercentage) public {
        eventTokenContract = eventTokenAddress;
        marketAlgorithmContract = new EventTokenMarketAlgorithm(address(this), eventTokenAddress);
        // Comission fee should be only from 1-100
        require(comissionFeePercentage > 0 && comissionFeePercentage < 101, "Comission Fee can only be from 1-100");
        _comissionFeePercentage = comissionFeePercentage;
        totalComissionFee = 0;
        _owner = msg.sender;
   }

   /**
     * Calculate comission fee based on comissionFeePercentage
     *
     * param purchase price of token
     * 
     */
   function getComissionFee(uint256 purchasePrice) public view returns(uint256){
      uint256 comissionFee = (purchasePrice / 100) * _comissionFeePercentage;
      return comissionFee;
   }

   /**
     * Allow user to list tokens to sell. Token price will be based on algo thus user can only list the amount of quantity.
     *
     * param amount of tokens to list
     * 
     */
   function list(uint256 _quantity) public {
      require(eventTokenContract.checkEventTokenOf(msg.sender) >= _quantity, "You do not have enough event tokens to sell");
      eventTokenContract.transferFrom(msg.sender, address(this), _quantity);
      uint256 sellOrderID = marketAlgorithmContract.addSellOrder(msg.sender, _quantity);
      usersCurrentListing[msg.sender].push(sellOrderID);
      emit SellOrderListed(sellOrderID, msg.sender, _quantity);
   }

   /**
     * Allow user to delist tokens to sell.
     *
     * param sell order id to delist
     * 
     */
   function unlist(uint256 sellOrderId) public {
      require(marketAlgorithmContract.isSellOrderSeller(msg.sender, sellOrderId), "You did not list this order");
      uint256 amountOfTokens = marketAlgorithmContract.removeSellOrder(sellOrderId);
      eventTokenContract.transferFrom(address(this), msg.sender, amountOfTokens);
      emit SellOrderDelisted(msg.sender, sellOrderId);
   }

   /**
     * Allow user to purchase tokens
     *
     * param amount of tokens to list
     * 
     */
   function purchaseTokens(uint256 _quantity) public payable {

      uint256[2] memory order = marketAlgorithmContract.getPriceOfBuyOrder(_quantity);
      uint256 quantity = order[0];         // Quantity of tokens that he can buy
      require(quantity > 0, "No tokens available to purchase");

      uint256 priceOfEachToken = order[1]; // Price of each token
      uint256 totalPrice = (quantity * priceOfEachToken); // 0 is quantity, 1 is price of each token
      require(msg.value >= totalPrice, "You do not have enough ether to purchase tokens");

      msg.sender.transfer(msg.value - totalPrice); // transfer remaining back to buyer

      // Perform purchase and send eth to sellers.
      uint256[] memory quantities;
      address[] memory sellers;
      uint256 startnum = 0;

      // This will return all quantities and sellers that sold tokens
      (quantities, sellers, startnum) = marketAlgorithmContract.buyTokens(order);

      for (uint256 i = 0; i < startnum; i++ ) {
         uint256 comissionFee = ((quantities[i] * priceOfEachToken) / _comissionFeePercentage); 
         uint256 priceToTransfer = (quantities[i] * priceOfEachToken) - comissionFee;
         address payable to = address(uint160(sellers[i]));
         to.transfer(priceToTransfer);
         // Store total commission fee
         totalComissionFee = totalComissionFee + comissionFee;
      }

      eventTokenContract.transferFrom(address(this), msg.sender, quantity);
      emit BuyToken(msg.sender, quantity, order[1]);

   }

   function withdrawComissionFee() public onlyOwner {
      address payable to = address(uint160(_owner));
      to.transfer(totalComissionFee);
      totalComissionFee = 0;
   }

   function checkCurrentPrice(uint256 _quantity) public view returns (uint256[2] memory) {
      return marketAlgorithmContract.getPriceOfBuyOrder(_quantity);
   }

   function checkCurrentSellOrder() public view returns(uint256[] memory) {
      return usersCurrentListing[msg.sender];
   }

   function getContractOwner() public view returns(address) {
      return _owner;
   }

}
