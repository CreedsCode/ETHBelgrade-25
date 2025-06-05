export const OnChainExpensesABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "expenseId",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "_ipfsHash",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "_amount",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "_category",
        "type": "string"
      }
    ],
    "name": "addExpenseItem",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "expenseId",
        "type": "uint256"
      },
      {
        "internalType": "uint256[]",
        "name": "itemIds",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256",
        "name": "totalAmount",
        "type": "uint256"
      }
    ],
    "name": "batchPayItems",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_title",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "_payer",
        "type": "address"
      }
    ],
    "name": "createExpenseRequest",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "expenseId",
        "type": "uint256"
      }
    ],
    "name": "getAllExpenseItems",
    "outputs": [
      {
        "internalType": "string[]",
        "name": "ipfsHashes",
        "type": "string[]"
      },
      {
        "internalType": "uint256[]",
        "name": "amounts",
        "type": "uint256[]"
      },
      {
        "internalType": "string[]",
        "name": "categories",
        "type": "string[]"
      },
      {
        "internalType": "bool[]",
        "name": "paidStatus",
        "type": "bool[]"
      },
      {
        "internalType": "uint256[]",
        "name": "timestamps",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      }
    ],
    "name": "getCreatorExpenses",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "expenseId",
        "type": "uint256"
      }
    ],
    "name": "getExpenseRequest",
    "outputs": [
      {
        "internalType": "string",
        "name": "title",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "payer",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "readyToReview",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "fullyPaid",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "totalPaidAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "itemCount",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "payer",
        "type": "address"
      }
    ],
    "name": "getExpensesReadyForReview",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "expenseId",
        "type": "uint256"
      }
    ],
    "name": "setReadyForReview",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const; 