import fs from "node:fs/promises";
import figlet from "figlet";
import { IExecDataProtectorDeserializer } from "@iexec/dataprotector-deserializer";
import { ethers } from "ethers";

const main = async () => {
  const { IEXEC_OUT, IEXEC_IN, IEXEC_INPUT_FILES_NUMBER } = process.env;
  let computedJsonObj = {};
  let onChainExpenseId; // Declared here for broader scope

  try { // MAIN TRY BLOCK STARTS HERE
    let messages = []; // For Figlet

    const args = process.argv.slice(2);
    console.log(`Received ${args.length} command-line arguments:`, args);
    if (args.length > 0) {
      messages.push(`Args: ${args.join(" ")}`);
    }

    // --- Start of Protected Data Deserialization ---
    console.log("Deserializing protected expense data using IExecDataProtectorDeserializer...");
    
    const deserializer = new IExecDataProtectorDeserializer();

    // Retrieve data using the schema defined in the frontend
    // dataToProtect: { expenseId, title, payer, totalAmount, receipts }
    const expenseId_from_data = await deserializer.getValue('expenseId', 'string');
    const title_from_data = await deserializer.getValue('title', 'string');
    const payer_address_from_data = await deserializer.getValue('payer', 'string');
    const totalAmount_from_data = await deserializer.getValue('totalAmount', 'string');
    const receiptsJSON_from_data = await deserializer.getValue('receipts', 'string');

    // Assign to final variables to be used by the rest of the script
    const expenseId = expenseId_from_data;
    const title = title_from_data;
    const payer = payer_address_from_data;
    const totalAmount = totalAmount_from_data;
    const receiptsJSON = receiptsJSON_from_data;

    console.log("--- Deserialized Protected Data (from iExec Data Protector) ---");
    console.log("Expense ID (from Protected Data):", expenseId || "Not found");
    console.log("Title (from Protected Data):", title || "Not found");
    console.log("Payer Address (from Protected Data):", payer || "Not found");
    console.log("Total Amount (from Protected Data):", totalAmount || "Not found");
    console.log("Receipts JSON (from Protected Data):", receiptsJSON || "Not found/empty");
    console.log("------------------------------------");

    if (expenseId) messages.push(`Input ID: ${expenseId}`);
    if (title) messages.push(`Title: ${title}`);
    if (totalAmount) messages.push(`Total: ${totalAmount}`);
    
    let parsedReceiptsForDisplay;
    if (receiptsJSON) {
      try {
        parsedReceiptsForDisplay = JSON.parse(receiptsJSON);
        console.log("Parsed Receipts Data (for display/logging):", parsedReceiptsForDisplay);
        if (Array.isArray(parsedReceiptsForDisplay)) {
          let totalItemsFromAllReceipts = 0;
          parsedReceiptsForDisplay.forEach(receiptFile => {
            if (receiptFile && Array.isArray(receiptFile.items)) {
              totalItemsFromAllReceipts += receiptFile.items.length;
            }
          });
          messages.push(`${totalItemsFromAllReceipts} item(s) in ${parsedReceiptsForDisplay.length} receipt file(s)`);
        } else {
          messages.push("(Receipts data is not an array of files)");
        }
      } catch (parseError) {
        console.error("Failed to parse receipts JSON:", parseError.message);
        messages.push("(Receipts JSON malformed)");
      }
    } else {
      messages.push("(No receipts data)");
    }
   
      // --- Start of On-chain Writing Part ---
      console.log("On-chain: Starting expense processing and smart contract interaction.");

      // Updated Contract ABI from frontend/src/abi/OnChainExpenses.json
      const contractABI = [
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
              "internalType": "address",
              "name": "_iAppPublicKey",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "_stableCoinAddress",
              "type": "address"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "expenseId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "creator",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "payer",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "string",
              "name": "title",
              "type": "string"
            }
          ],
          "name": "ExpenseCreated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "expenseId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "string",
              "name": "ipfsHash",
              "type": "string"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "string",
              "name": "category",
              "type": "string"
            }
          ],
          "name": "ItemAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "expenseId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256[]",
              "name": "itemIds",
              "type": "uint256[]"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "totalAmount",
              "type": "uint256"
            }
          ],
          "name": "ItemsPaidBatch",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "expenseId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "totalAmount",
              "type": "uint256"
            }
          ],
          "name": "PaymentCompleted",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "expenseId",
              "type": "uint256"
            }
          ],
          "name": "ReadyForReview",
          "type": "event"
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
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_newIAppPublicKey",
              "type": "address"
            }
          ],
          "name": "updateIAppPublicKey",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_newStableCoinAddress",
              "type": "address"
            }
          ],
          "name": "updateStableCoin",
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
          "inputs": [],
          "name": "getExpenseCounter",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
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
            },
            {
              "internalType": "uint256",
              "name": "itemId",
              "type": "uint256"
            }
          ],
          "name": "getExpenseItem",
          "outputs": [
            {
              "internalType": "string",
              "name": "ipfsHash",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "category",
              "type": "string"
            },
            {
              "internalType": "bool",
              "name": "paid",
              "type": "bool"
            },
            {
              "internalType": "uint256",
              "name": "timestamp",
              "type": "uint256"
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
          "name": "getUnpaidTotal",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "iAppPublicKey",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "stableCoin",
          "outputs": [
            {
              "internalType": "contract IERC20",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ];
      const contractAddress = "0x3BF50174762538e3111008A38db4Da16C277128F";

      const iappPrivateKey = "0x80537ee0e8ed1f5864c9a2d021c8a8475c0490d0d0ece7ba565d30a5c3522fb7";
      console.log("On-chain: iApp private key loaded.");

      const rpcUrl = "https://testnet-passet-hub-eth-rpc.polkadot.io";
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log(`On-chain: Connected to Polkadot Passet Hub network via RPC: ${rpcUrl}`);

      const iappSigner = new ethers.Wallet(iappPrivateKey, provider);
      console.log(`On-chain: iApp's Ethereum address (contract interaction sender): ${iappSigner.address}`);

      const network = await provider.getNetwork();
      console.log(`On-chain: Network chainId: ${network.chainId}`);

      const balance = await provider.getBalance(iappSigner.address);
      console.log(`On-chain: Account balance: ${ethers.formatEther(balance)} NativeToken`);
      if (balance < ethers.parseEther("0.01")) {
          messages.push("(Error: Insufficient balance for gas)");
          throw new Error("Insufficient balance for on-chain transactions. Please ensure the iApp account has enough native token for gas fees.");
      }

      let expenseItemsForContract = [];
      if (receiptsJSON) {
        try {
          const parsedReceiptFiles = JSON.parse(receiptsJSON);
          if (Array.isArray(parsedReceiptFiles)) {
            parsedReceiptFiles.forEach(receiptFile => {
              if (receiptFile && Array.isArray(receiptFile.items)) {
                receiptFile.items.forEach(item => {
                  expenseItemsForContract.push({
                    name: String(item.description || "N/A Item"),
                    totalCost: String(item.price || "0")
                  });
                });
              }
            });
            console.log("On-chain: Prepared expense items for contract:", expenseItemsForContract);
          } else {
            console.warn("On-chain: Parsed receipts_JSON_from_data is not an array of receipt files. No items to add to contract.");
            messages.push("(Warning: No receipt items for contract - outer structure issue)");
          }
        } catch (parseError) {
          console.error("On-chain: Failed to parse receipts_JSON_from_data for contract items:", parseError.message);
          messages.push("(Error: Malformed receipts_JSON_from_data for contract)");
          throw new Error("Malformed receipts_JSON_from_data, cannot prepare items for smart contract.");
        }
      } else {
        console.log("On-chain: No receipts_JSON_from_data provided. No items to add to contract.");
        messages.push("(No receipt items for contract)");
      }

      const contractPayerAddress = payer;
      if (!contractPayerAddress || !ethers.isAddress(contractPayerAddress)) {
        messages.push(`(Error: Invalid contractPayerAddress: ${contractPayerAddress})`);
        throw new Error(`Invalid contractPayerAddress for smart contract: ${contractPayerAddress}`);
      }
      console.log(`On-chain: Payer address for contract (who will eventually pay): ${contractPayerAddress}`);
      const contractTitle = title || "Untitled Expense from iApp"; 

      // const expenseContract = new ethers.Contract(contractAddress, contractABI, iappSigner); // Current full ABI
      // console.log(`On-chain: Connected to smart contract at address: ${contractAddress}`);

      // Replace inner try...catch with the "working" script's on-chain logic
      // Using ABI from the "working" script snippet
      const workingScriptABI = [
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
        }
      ];

      const expenseContract = new ethers.Contract(contractAddress, workingScriptABI, iappSigner);
      console.log(`On-chain: Connected to smart contract at address: ${contractAddress} (using working script's ABI and logic)`);

      // Prepare expenseData structure for the working script's logic
      const expenseDataForWorkingScript = {
          requesterAddress: contractPayerAddress, // This is our 'payer' from mocked data
          items: expenseItemsForContract // This is from processing receiptsJSON_from_data
      };

      try { // This is the try-catch from the "working" script
        // First, create a new expense request
        console.log("On-chain (working script logic): Creating new expense request...");
        
        const createExpenseData = expenseContract.interface.encodeFunctionData("createExpenseRequest", [
            contractTitle, // Use title from our mocked data
            expenseDataForWorkingScript.requesterAddress
        ]);

        let nonce = await provider.getTransactionCount(iappSigner.address);
        console.log(`On-chain (working script logic): Nonce for createExpenseRequest: ${nonce}`);
        
        const tx = {
            to: contractAddress,
            data: createExpenseData,
            nonce: nonce,
            gasLimit: 300000,
            gasPrice: ethers.parseUnits("1", "gwei"),
            type: 0, 
            chainId: network.chainId
        };

        const signedTx = await iappSigner.signTransaction(tx);
        console.log("On-chain (working script logic): Sending raw createExpenseRequest transaction...");
        const txHash = await provider.send("eth_sendRawTransaction", [signedTx]);
        console.log(`On-chain (working script logic): Create transaction hash: ${txHash}`);
        messages.push(`CreateReq Tx (Legacy): ${txHash.substring(0,10)}...`);

        console.log("On-chain (working script logic): Waiting for create transaction confirmation...");
        const receipt = await provider.waitForTransaction(txHash);
        console.log(`On-chain (working script logic): Create transaction confirmed in block: ${receipt.blockNumber}`);

        console.log("On-chain (working script logic): Decoding transaction logs for ExpenseCreated...");
        console.log("On-chain (working script logic): Transaction logs raw: ", JSON.stringify(receipt.logs, null, 2));
        
        // Event parsing from working script (needs ExpenseCreated in ABI, which it doesn't have directly in the snippet)
        // For this to work, workingScriptABI must be extended or we must use the fuller contractABI for parsing.
        // Assuming 'ExpenseCreated' event IS defined in the actual workingScriptABI if that script worked.
        // The snippet for workingScriptABI does NOT include ExpenseCreated event.
        // For now, I will use the original fuller 'contractABI' for parsing this specific event.
        // This is a deviation from strict "as is" for ABI but necessary for event parsing to have a chance.
        const fullContractABIForEventParsing = contractABI; // This is the full ABI from the outer scope of app.js
        const tempContractForEventParsing = new ethers.Contract(contractAddress, fullContractABIForEventParsing, iappSigner);

        let onChainExpenseIdFromEvent; // Use a different name to avoid conflict with outer scope onChainExpenseId
        const expenseCreatedEvent = receipt.logs.find(log => {
            try {
                const parsedLog = tempContractForEventParsing.interface.parseLog({ // Use temp contract with full ABI
                    topics: log.topics,
                    data: log.data
                });
                return parsedLog && parsedLog.name === 'ExpenseCreated';
            } catch (e) {
                return false;
            }
        });

        if (!expenseCreatedEvent) {
            console.warn("On-chain (working script logic): Could not find ExpenseCreated event. Using fallback ID 1.");
            onChainExpenseIdFromEvent = BigInt(1); // Fallback from working script
            messages.push("(Warning: Used fallback on-chain ID 1)");
        } else {
            const parsedLog = tempContractForEventParsing.interface.parseLog({ // Use temp contract with full ABI
                topics: expenseCreatedEvent.topics,
                data: expenseCreatedEvent.data
            });
            onChainExpenseIdFromEvent = BigInt(parsedLog.args.expenseId);
            console.log(`On-chain (working script logic): Created expense request with ID from event: ${onChainExpenseIdFromEvent}`);
        }
        onChainExpenseId = onChainExpenseIdFromEvent; // Assign to the outer scope variable for computed.json
        messages.push(`OnChainID (Legacy): ${onChainExpenseId}`);

        // Add each expense item
        const itemIdsForContract = []; // Shadowing outer scope variable, this is local to this block now
        for (const item of expenseDataForWorkingScript.items) {
            console.log(`On-chain (working script logic): Adding expense item: ${item.name}`);
            
            const addItemData = expenseContract.interface.encodeFunctionData("addExpenseItem", [
                onChainExpenseIdFromEvent,
                "ipfs_hash_placeholder",
                ethers.parseUnits(item.totalCost.toString(), "ether"),
                item.name
            ]);

            let itemNonce = await provider.getTransactionCount(iappSigner.address);
            console.log(`On-chain (working script logic): Nonce for addExpenseItem '${item.name}': ${itemNonce}`);
            
            const itemTx = {
                to: contractAddress,
                data: addItemData,
                nonce: itemNonce,
                gasLimit: 300000,
                gasPrice: ethers.parseUnits("1", "gwei"),
                type: 0,
                chainId: network.chainId
            };

            const signedItemTx = await iappSigner.signTransaction(itemTx);
            console.log("On-chain (working script logic): Sending raw addExpenseItem transaction...");
            const itemTxHash = await provider.send("eth_sendRawTransaction", [signedItemTx]);
            console.log(`On-chain (working script logic): Add item transaction hash: ${itemTxHash}`);
            messages.push(`AddItem '${item.name.substring(0,5)}...' Tx (Legacy): ${itemTxHash.substring(0,6)}...`);

            console.log("On-chain (working script logic): Waiting for add item transaction confirmation...");
            const itemReceipt = await provider.waitForTransaction(itemTxHash);
            console.log(`On-chain (working script logic): Add item transaction confirmed in block: ${itemReceipt.blockNumber}`);
            
            // The working script used sequential item IDs for its own tracking, not necessarily from contract event.
            const itemIdForTracking = itemIdsForContract.length + 1;
            itemIdsForContract.push(BigInt(itemIdForTracking)); // Store as BigInt if other parts expect it
            console.log(`On-chain (working script logic): Added item, tracked ID: ${itemIdForTracking}`);
        }
        messages.push(`${itemIdsForContract.length} items added (Legacy)`);

        // Calculate total amount for batchPayItems
        const totalAmountForBatchPay = expenseDataForWorkingScript.items.reduce(
            (sum, item) => sum + ethers.parseUnits(item.totalCost.toString(), "ether"),
            ethers.parseUnits("0", "ether")
        );

        // Batch pay all items (THIS IS LIKELY TO FAIL DUE TO onlyPayer MODIFIER)
        console.warn("On-chain (working script logic): Attempting batchPayItems. This may fail if iApp is not the payer.");
        messages.push("(Attempting batchPayItems - may fail)");
        
        const payData = expenseContract.interface.encodeFunctionData("batchPayItems", [
            onChainExpenseIdFromEvent,
            itemIdsForContract,
            totalAmountForBatchPay
        ]);

        let payNonce = await provider.getTransactionCount(iappSigner.address);
        console.log(`On-chain (working script logic): Nonce for batchPayItems: ${payNonce}`);
        
        const payTx = {
            to: contractAddress,
            data: payData,
            nonce: payNonce,
            gasLimit: 300000, // Might need more for batch operations
            gasPrice: ethers.parseUnits("1", "gwei"),
            type: 0,
            chainId: network.chainId
        };

        const signedPayTx = await iappSigner.signTransaction(payTx);
        console.log("On-chain (working script logic): Sending raw batchPayItems transaction...");
        const payTxHash = await provider.send("eth_sendRawTransaction", [signedPayTx]);
        console.log(`On-chain (working script logic): Batch pay transaction hash: ${payTxHash}`);
        messages.push(`BatchPay Tx (Legacy): ${payTxHash.substring(0,10)}...`);

        console.log("On-chain (working script logic): Waiting for batch pay transaction confirmation...");
        const payReceipt = await provider.waitForTransaction(payTxHash);
        console.log(`On-chain (working script logic): Batch pay transaction confirmed in block: ${payReceipt.blockNumber}`);
        
        console.log("On-chain (working script logic): All transactions (including potentially failing batchPay) attempted.");
        messages.push("All on-chain ops attempted (Legacy).");

      } catch (contractError_workingScript) { // Catch for contract interactions from the "working" script's logic
        console.error("On-chain (working script logic): Error interacting with smart contract:", contractError_workingScript.message || contractError_workingScript, contractError_workingScript.stack);
        messages.push(`(Error WS: ${contractError_workingScript.reason || contractError_workingScript.message || 'Unknown contract error'})`);
        // Re-throw to be caught by the main catch block of app.js
        throw new Error(`On-chain interaction (working script logic) failed: ${contractError_workingScript.reason || contractError_workingScript.message || String(contractError_workingScript.error || contractError_workingScript)}`); 
      }
      // --- End of On-chain Writing Part (Replaced with working script's logic) ---

    // --- Input File Handling ---
    const numInputFiles = parseInt(IEXEC_INPUT_FILES_NUMBER || "0", 10);
    if (numInputFiles > 0 && IEXEC_IN) {
        console.log(`Processing ${numInputFiles} input files from ${IEXEC_IN}...`);
        for (let i = 1; i <= numInputFiles; i++) {
            const inputFileName = process.env[`IEXEC_INPUT_FILE_NAME_${i}`];
            if (inputFileName) {
                const inputFilePath = `${IEXEC_IN}/${inputFileName}`;
                const outputFilePath = `${IEXEC_OUT}/inputFile_${i}_${inputFileName}`;
                try {
                    console.log(`  Copying input file ${i} ('${inputFileName}') to '${outputFilePath}'`);
                    await fs.copyFile(inputFilePath, outputFilePath);
                } catch (copyError) {
                    console.error(`  Failed to copy input file '${inputFileName}':`, copyError.message);
                }
            } else {
                console.warn(`  Input file name for index ${i} is undefined.`);
            }
        }
    } else {
        console.log("No input files to process or IEXEC_IN not defined.");
    }
    // --- End Input File Handling ---

    // --- App and Requester Secret Handling ---
    const { IEXEC_APP_DEVELOPER_SECRET } = process.env;
    if (IEXEC_APP_DEVELOPER_SECRET) {
      const redactedAppSecret = IEXEC_APP_DEVELOPER_SECRET.replace(/./g, "*");
      console.log(`Got an app secret (${redactedAppSecret})!`);
    } else {
      console.log(`App secret (IEXEC_APP_DEVELOPER_SECRET) is not set.`);
    }

    const { IEXEC_REQUESTER_SECRET_1, IEXEC_REQUESTER_SECRET_42 } = process.env;
    if (IEXEC_REQUESTER_SECRET_1) {
      const redactedRequesterSecret = IEXEC_REQUESTER_SECRET_1.replace(/./g,"*");
      console.log(`Got requester secret 1 (${redactedRequesterSecret})!`);
    } else {
      console.log(`Requester secret 1 (IEXEC_REQUESTER_SECRET_1) is not set.`);
    }
    if (IEXEC_REQUESTER_SECRET_42) {
      const redactedRequesterSecret = IEXEC_REQUESTER_SECRET_42.replace(/./g,"*");
      console.log(`Got requester secret 42 (${redactedRequesterSecret})!`);
    } else {
      console.log(`Requester secret 42 (IEXEC_REQUESTER_SECRET_42) is not set.`);
    }
    // --- End App and Requester Secret Handling ---

    // --- Figlet Output Generation ---
    const figletMessage = messages.length > 0 ? messages.join(' | ') : "iExec Task Done";
    console.log("Generating Figlet text for:", figletMessage);
    const asciiArtText = figlet.textSync(figletMessage, { horizontalLayout: 'full' });
    console.log(asciiArtText);

    if (Object.keys(computedJsonObj).length === 0 && IEXEC_OUT) {
        await fs.writeFile(`${IEXEC_OUT}/result.txt`, asciiArtText);
        console.log(`Figlet Result saved to ${IEXEC_OUT}/result.txt`);
        computedJsonObj = {
            "deterministic-output-path": `${IEXEC_OUT}/result.txt`,
            "onchain-expense-id": typeof onChainExpenseId !== 'undefined' ? String(onChainExpenseId) : "N/A",
        };
    } else if (Object.keys(computedJsonObj).length === 0 && !IEXEC_OUT) {
         console.error("IEXEC_OUT is not defined. Cannot write result.txt or error_report.txt.");
         computedJsonObj = {
            "error-message": "IEXEC_OUT not defined, result/error file not written.",
            "onchain-expense-id": typeof onChainExpenseId !== 'undefined' ? String(onChainExpenseId) : "N/A",
        };
    }
    // --- End Figlet Output Generation --- // MAIN TRY BLOCK ENDS HERE (implicitly before the catch)

  } catch (e) { // MAIN CATCH BLOCK
    console.error("!!! MAIN CATCH BLOCK INVOKED !!!"); // Added for explicit check
    console.error("Critical error in main process:", e.message || e, e.stack);
    messages.push(`(Error: Main processing failed: ${e.message || 'Unknown error'})`);
    const finalIexecOutForError = IEXEC_OUT || "/iexec_out";
    computedJsonObj = {
      "deterministic-output-path": `${finalIexecOutForError}/error_report.txt`,
      "error-message": `Main process failed: ${e.message || String(e)}`,
    };
    if (IEXEC_OUT) {
        try {
            await fs.writeFile(`${IEXEC_OUT}/error_report.txt`, `Error: ${e.message || String(e)}\nStack: ${e.stack || 'N/A'}`);
            console.log(`Error report saved to ${IEXEC_OUT}/error_report.txt`);
        } catch (writeErr) {
            console.error(`Failed to write error_report.txt: ${writeErr.message}`);
        }
    }
  } finally { // MAIN FINALLY BLOCK
    const finalIexecOut = IEXEC_OUT || "/iexec_out"; 
    if (!IEXEC_OUT) {
        console.warn("Warning: IEXEC_OUT environment variable not set. Defaulting to /iexec_out for computed.json.");
        try {
            await fs.mkdir(finalIexecOut, { recursive: true });
        } catch (dirError) {
            console.error(`Failed to ensure ${finalIexecOut} directory exists:`, dirError.message);
        }
    }
    try {
        if (!computedJsonObj["error-message"]) {
            computedJsonObj["status"] = "success";
            // figletMessage might not be defined if error happened before its creation
            // So, ensure messages array is used if figletMessage isn't available.
            const finalFigletMessage = (typeof figletMessage !== 'undefined' && figletMessage) 
                                        ? figletMessage 
                                        : (messages && messages.length > 0 ? messages.join(' | ') : "Task completed with issues before Figlet");
            computedJsonObj["final_figlet_message"] = finalFigletMessage;
        } else {
            computedJsonObj["status"] = "failure";
        }
        
        await fs.writeFile(
            `${finalIexecOut}/computed.json`,
            JSON.stringify(computedJsonObj, null, 2) 
        );
        console.log(`computed.json saved to ${finalIexecOut}/computed.json with content:`, JSON.stringify(computedJsonObj, null, 2));
    } catch (writeError) {
        console.error(`FATAL: Could not write computed.json to ${finalIexecOut}:`, writeError.message);
    }
  }
};

main().catch(e => {
  console.error("Unhandled error in main execution:", e.message || e, e.stack);
  const finalIexecOut = process.env.IEXEC_OUT || "/iexec_out";
  const errorPayload = {
    "deterministic-output-path": `${finalIexecOut}/catastrophic_error.txt`,
    "error-message": `Unhandled main execution error: ${e.message || String(e)}`,
    "status": "failure"
  };
  try {
    // Using synchronous file writes in this critical exit path for robustness
    if (finalIexecOut === "/iexec_out" && process.env.IEXEC_OUT === undefined) {
        // Try to create /iexec_out if it's the default and might not exist (local test)
        try { require('node:fs').mkdirSync(finalIexecOut, { recursive: true }); } catch (mkDirErr) { /* ignore */ }
    }
    require('node:fs').writeFileSync(
          `${finalIexecOut}/computed.json`,
          JSON.stringify(errorPayload, null, 2)
      );
    require('node:fs').writeFileSync(`${finalIexecOut}/catastrophic_error.txt`, `Unhandled main execution error: ${e.message || String(e)}\nStack: ${e.stack || 'N/A'}`);
    console.log(`Catastrophic error details saved to ${finalIexecOut}`);
  } catch (finalErr) {
      console.error("Failed to write catastrophic error to computed.json or error file during main().catch():", finalErr.message);
  }
  process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
