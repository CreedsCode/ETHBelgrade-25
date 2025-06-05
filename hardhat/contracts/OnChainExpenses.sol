// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract OnChainExpenses {
    // Struct for individual expense items (one receipt = one item)
    struct ExpenseItem {
        string ipfsHash; // IPFS hash of receipt data/metadata
        uint256 amount; // Amount in ERC20 token units
        string category;
        bool paid;
        uint256 timestamp;
    }
    
    // Main expense request struct
    struct ExpenseRequest {
        string title;
        address creator;
        address payer;
        uint256 timestamp;
        bool readyToReview;
        bool fullyPaid;
        ExpenseItem[] items;
        uint256 totalPaidAmount;
    }
    
    // Private mapping: only accessible by creator, payer, and iApp
    mapping(uint256 => ExpenseRequest) private expenses;
    uint256 private expenseCounter;
    
    // iApp public key for verification
    address public iAppPublicKey;
    address public owner;
    
    // ERC20 stable coin for payments
    IERC20 public stableCoin;
    
    // Events
    event ExpenseCreated(uint256 indexed expenseId, address indexed creator, address indexed payer, string title);
    event ItemAdded(uint256 indexed expenseId, string ipfsHash, uint256 amount, string category);
    event ReadyForReview(uint256 indexed expenseId);
    event ItemsPaidBatch(uint256 indexed expenseId, uint256[] itemIds, uint256 totalAmount);
    event PaymentCompleted(uint256 indexed expenseId, uint256 totalAmount);
    
    constructor(address _iAppPublicKey, address _stableCoinAddress) {
        owner = msg.sender;
        iAppPublicKey = _iAppPublicKey;
        stableCoin = IERC20(_stableCoinAddress);
        expenseCounter = 0;
    }
    
    // Access control modifier
    modifier onlyAuthorized(uint256 expenseId) {
        require(
            msg.sender == expenses[expenseId].creator || 
            msg.sender == expenses[expenseId].payer || 
            msg.sender == iAppPublicKey ||
            msg.sender == owner,
            "Not authorized to access this expense"
        );
        _;
    }
    
    modifier onlyCreator(uint256 expenseId) {
        require(msg.sender == expenses[expenseId].creator, "Only creator can perform this action");
        _;
    }
    
    modifier onlyPayer(uint256 expenseId) {
        require(msg.sender == expenses[expenseId].payer, "Only payer can perform this action");
        _;
    }
    
    modifier onlyIApp() {
        require(msg.sender == iAppPublicKey, "Only iApp can perform this action");
        _;
    }
    
    // Create new expense request (called by frontend after user submits)
    function createExpenseRequest(
        string memory _title,
        address _payer
    ) external returns (uint256) {
        uint256 expenseId = expenseCounter++;
        
        ExpenseRequest storage newExpense = expenses[expenseId];
        newExpense.title = _title;
        newExpense.creator = msg.sender;
        newExpense.payer = _payer;
        newExpense.timestamp = block.timestamp;
        newExpense.readyToReview = false;
        newExpense.fullyPaid = false;
        newExpense.totalPaidAmount = 0;
        
        emit ExpenseCreated(expenseId, msg.sender, _payer, _title);
        return expenseId;
    }
    
    // Called by iApp to add detected expense items (one receipt = one item)
    function addExpenseItem(
        uint256 expenseId,
        string memory _ipfsHash,
        uint256 _amount,
        string memory _category
    ) external onlyIApp {
        require(expenseId < expenseCounter, "Invalid expense ID");
        
        ExpenseItem memory newItem = ExpenseItem({
            ipfsHash: _ipfsHash,
            amount: _amount,
            category: _category,
            paid: false,
            timestamp: block.timestamp
        });
        
        expenses[expenseId].items.push(newItem);
        emit ItemAdded(expenseId, _ipfsHash, _amount, _category);
    }
    
    // Creator marks expense as ready for payer review
    function setReadyForReview(uint256 expenseId) external onlyCreator(expenseId) {
        expenses[expenseId].readyToReview = true;
        emit ReadyForReview(expenseId);
    }
    
    // Payer selects items and pays in one batch transaction
    function batchPayItems(
        uint256 expenseId,
        uint256[] memory itemIds,
        uint256 totalAmount
    ) external onlyPayer(expenseId) {
        require(expenses[expenseId].readyToReview, "Expense not ready for review");
        require(itemIds.length > 0, "No items selected");
        
        uint256 calculatedTotal = 0;
        
        // Validate items and calculate total
        for (uint256 i = 0; i < itemIds.length; i++) {
            uint256 itemId = itemIds[i];
            require(itemId < expenses[expenseId].items.length, "Invalid item ID");
            require(!expenses[expenseId].items[itemId].paid, "Item already paid");
            
            calculatedTotal += expenses[expenseId].items[itemId].amount;
        }
        
        // Verify provided total matches calculated total
        require(totalAmount == calculatedTotal, "Total amount mismatch");
        
        // Check allowance and balance
        require(
            stableCoin.allowance(msg.sender, address(this)) >= totalAmount,
            "Insufficient allowance"
        );
        require(
            stableCoin.balanceOf(msg.sender) >= totalAmount,
            "Insufficient balance"
        );
        
        // Transfer tokens from payer to creator
        require(
            stableCoin.transferFrom(msg.sender, expenses[expenseId].creator, totalAmount),
            "Transfer failed"
        );
        
        // Mark items as paid
        for (uint256 i = 0; i < itemIds.length; i++) {
            expenses[expenseId].items[itemIds[i]].paid = true;
        }
        
        expenses[expenseId].totalPaidAmount += totalAmount;
        
        // Check if all items are paid
        bool allItemsPaid = true;
        for (uint256 i = 0; i < expenses[expenseId].items.length; i++) {
            if (!expenses[expenseId].items[i].paid) {
                allItemsPaid = false;
                break;
            }
        }
        
        if (allItemsPaid) {
            expenses[expenseId].fullyPaid = true;
        }
        
        emit ItemsPaidBatch(expenseId, itemIds, totalAmount);
        emit PaymentCompleted(expenseId, totalAmount);
    }
    
    // Getter functions with access control
    function getExpenseRequest(uint256 expenseId) 
        external 
        view 
        onlyAuthorized(expenseId) 
        returns (
            string memory title,
            address creator,
            address payer,
            uint256 timestamp,
            bool readyToReview,
            bool fullyPaid,
            uint256 totalPaidAmount,
            uint256 itemCount
        ) 
    {
        ExpenseRequest storage expense = expenses[expenseId];
        return (
            expense.title,
            expense.creator,
            expense.payer,
            expense.timestamp,
            expense.readyToReview,
            expense.fullyPaid,
            expense.totalPaidAmount,
            expense.items.length
        );
    }
    
    function getExpenseItem(uint256 expenseId, uint256 itemId) 
        external 
        view 
        onlyAuthorized(expenseId) 
        returns (
            string memory ipfsHash,
            uint256 amount,
            string memory category,
            bool paid,
            uint256 timestamp
        ) 
    {
        require(itemId < expenses[expenseId].items.length, "Invalid item ID");
        ExpenseItem storage item = expenses[expenseId].items[itemId];
        return (item.ipfsHash, item.amount, item.category, item.paid, item.timestamp);
    }
    
    // Get all items for an expense (for easier frontend integration)
    function getAllExpenseItems(uint256 expenseId)
        external
        view
        onlyAuthorized(expenseId)
        returns (
            string[] memory ipfsHashes,
            uint256[] memory amounts,
            string[] memory categories,
            bool[] memory paidStatus,
            uint256[] memory timestamps
        )
    {
        uint256 itemCount = expenses[expenseId].items.length;
        
        ipfsHashes = new string[](itemCount);
        amounts = new uint256[](itemCount);
        categories = new string[](itemCount);
        paidStatus = new bool[](itemCount);
        timestamps = new uint256[](itemCount);
        
        for (uint256 i = 0; i < itemCount; i++) {
            ExpenseItem storage item = expenses[expenseId].items[i];
            ipfsHashes[i] = item.ipfsHash;
            amounts[i] = item.amount;
            categories[i] = item.category;
            paidStatus[i] = item.paid;
            timestamps[i] = item.timestamp;
        }
    }
    
    // Get expenses ready for review (for payer frontend)
    function getExpensesReadyForReview(address payer) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory readyExpenses = new uint256[](expenseCounter);
        uint256 count = 0;
        
        for (uint256 i = 0; i < expenseCounter; i++) {
            if (expenses[i].payer == payer && expenses[i].readyToReview && !expenses[i].fullyPaid) {
                readyExpenses[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = readyExpenses[i];
        }
        
        return result;
    }
    
    // Get creator's expenses
    function getCreatorExpenses(address creator) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory creatorExpenses = new uint256[](expenseCounter);
        uint256 count = 0;
        
        for (uint256 i = 0; i < expenseCounter; i++) {
            if (expenses[i].creator == creator) {
                creatorExpenses[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = creatorExpenses[i];
        }
        
        return result;
    }
    
    // Calculate total unpaid amount for an expense
    function getUnpaidTotal(uint256 expenseId) 
        external 
        view 
        onlyAuthorized(expenseId) 
        returns (uint256) 
    {
        uint256 unpaidTotal = 0;
        for (uint256 i = 0; i < expenses[expenseId].items.length; i++) {
            if (!expenses[expenseId].items[i].paid) {
                unpaidTotal += expenses[expenseId].items[i].amount;
            }
        }
        return unpaidTotal;
    }
    
    // Admin functions
    function updateIAppPublicKey(address _newIAppPublicKey) external {
        require(msg.sender == owner, "Only owner can update iApp public key");
        iAppPublicKey = _newIAppPublicKey;
    }
    
    function updateStableCoin(address _newStableCoinAddress) external {
        require(msg.sender == owner, "Only owner can update stable coin");
        stableCoin = IERC20(_newStableCoinAddress);
    }
    
    function getExpenseCounter() external view returns (uint256) {
        return expenseCounter;
    }
} 