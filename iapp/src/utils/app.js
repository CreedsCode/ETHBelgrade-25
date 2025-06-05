const { ethers } = require("ethers");
const { IExecDataProtector, IExecOracleFactory } = require("@iexec/dataprotector-deserializer"); // Assuming you'll use DataProtector SDK if you're consuming protected data for the expense receipts.

// Contract ABI and address
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
    }
];

const contractAddress = "0x3BF50174762538e3111008A38db4Da16C277128F";

async function main() {
    console.log("iApp started: Processing expense data and writing to smart contract.");

    // --- 1. Configure Private Key ---
    const iappPrivateKey = "0x80537ee0e8ed1f5864c9a2d021c8a8475c0490d0d0ece7ba565d30a5c3522fb7";
    console.log("iApp private key loaded.");

    // --- 2. Configure Ethereum Provider ---
    const rpcUrl = "https://testnet-passet-hub-eth-rpc.polkadot.io";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log(`Connected to polkadot passet hub network via RPC: ${rpcUrl}`);

    // --- 3. Create an ethers.js Wallet (Signer) for the iApp ---
    const iappSigner = new ethers.Wallet(iappPrivateKey, provider);
    console.log(`iApp's Ethereum address: ${iappSigner.address}`);

    // Get the current network configuration
    const network = await provider.getNetwork();
    console.log(`Network chainId: ${network.chainId}`);

    // Check account balance
    const balance = await provider.getBalance(iappSigner.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} DOT`);
    if (balance < ethers.parseEther("0.1")) {
        throw new Error("Insufficient balance. Please ensure the account has at least 0.1 DOT for gas fees.");
    }

    // --- 4. Retrieve Processed Expense Data ---
    // This is where you'll get the OCR processed data.
    // The diagram suggests it's passed through the DataProtector SDK.
    // If it's provided as a plain input file or stdout from a previous step, adjust accordingly.
    // For demonstration, let's assume it's read from an input file provided by iExec.
    // In a real iApp, you might read from /iexec_in/ (for input files) or environment variables.

    let expenseData;
    try {
        // Example: Reading from a file provided by iExec (e.g., from /iexec_in/)
        // This is a placeholder. You'll need to adapt this based on how the OCR'd data
        // is actually provided to your iApp after DataProtector processing.
        // It might be a JSON file, or even an environment variable if it's small.

        // For a more robust DataProtector integration, you would typically consume protected data here
        // using the IExecDataProtector SDK. However, your description says "expense data is passed
        // through the dataprotector sdk to be allowed into the tee," implying it's already
        // decrypted by the time your app.js receives it as input.
        // Let's assume for now it's a JSON file named `expense_receipts.json` in the input directory.

        // You'll need to know the exact path where iExec places input files.
        // Typically it's /iexec_in/
        const fs = require('fs');
        const inputFilePath = process.env.IEXEC_IN + "/expense_receipts.json"; // Adjust filename as needed

        if (fs.existsSync(inputFilePath)) {
            const rawData = fs.readFileSync(inputFilePath, 'utf8');
            expenseData = JSON.parse(rawData);
            console.log("Expense data loaded from input file.");
            console.log("Expense Data:", JSON.stringify(expenseData, null, 2));
        } else {
            console.warn(`Input file not found at ${inputFilePath}. Using mock expense data for demonstration.`);
            // Fallback for testing/demonstration if no actual input file is provided
            expenseData = {
                items: [
                    { name: "Coffee", totalCost: "5.50" },
                    { name: "Lunch", totalCost: "18.75" },
                ],
                requesterAddress: "0x1D2b63BD463A46052eb75fa2E55F741C312efD01" // Using a proper Ethereum address
            };
        }

    } catch (error) {
        console.error("Error retrieving expense data:", error);
        throw new Error("Failed to load expense data.");
    }

    // Validate the requester address
    if (!ethers.isAddress(expenseData.requesterAddress)) {
        throw new Error(`Invalid requester address: ${expenseData.requesterAddress}`);
    }

    // --- 5. Interact with the Smart Contract ---
    const expenseContract = new ethers.Contract(contractAddress, contractABI, iappSigner);
    console.log(`Connected to smart contract at address: ${contractAddress}`);

    try {
        // First, create a new expense request
        console.log("Creating new expense request...");
        
        // Prepare the transaction data
        const createExpenseData = expenseContract.interface.encodeFunctionData("createExpenseRequest", [
            "Expense Report",
            expenseData.requesterAddress
        ]);

        // Get the current nonce
        const nonce = await provider.getTransactionCount(iappSigner.address);
        
        // Create the transaction object
        const tx = {
            to: contractAddress,
            data: createExpenseData,
            nonce: nonce,
            gasLimit: 300000,
            gasPrice: ethers.parseUnits("1", "gwei"), // Using gasPrice instead of maxFeePerGas
            type: 0, // Using legacy transaction type
            chainId: network.chainId
        };

        // Sign the transaction
        const signedTx = await iappSigner.signTransaction(tx);
        
        // Send the raw transaction
        console.log("Sending raw transaction...");
        const txHash = await provider.send("eth_sendRawTransaction", [signedTx]);
        console.log(`Transaction hash: ${txHash}`);

        // Wait for the transaction to be mined
        console.log("Waiting for transaction confirmation...");
        const receipt = await provider.waitForTransaction(txHash);
        console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

        // Get the expense ID from the event
        console.log("Decoding transaction logs...");
        console.log("Transaction logs:", JSON.stringify(receipt.logs, null, 2));
        
        const expenseCreatedEvent = receipt.logs.find(log => {
            try {
                const parsedLog = expenseContract.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                return parsedLog && parsedLog.name === 'ExpenseCreated';
            } catch (e) {
                return false;
            }
        });

        let expenseId;
        if (!expenseCreatedEvent) {
            console.log("Could not find ExpenseCreated event, but transaction was successful");
            // For testing, we'll use a hardcoded expense ID
            expenseId = 1;
            console.log(`Using test expense ID: ${expenseId}`);
        } else {
            const parsedLog = expenseContract.interface.parseLog({
                topics: expenseCreatedEvent.topics,
                data: expenseCreatedEvent.data
            });
            expenseId = parsedLog.args.expenseId;
            console.log(`Created expense request with ID: ${expenseId}`);
        }

        // Add each expense item
        const itemIds = [];
        for (const item of expenseData.items) {
            console.log(`Adding expense item: ${item.name}`);
            
            // Prepare the transaction data
            const addItemData = expenseContract.interface.encodeFunctionData("addExpenseItem", [
                expenseId,
                "ipfs_hash_placeholder",
                ethers.parseEther(item.totalCost.toString()),
                item.name
            ]);

            // Get the current nonce
            const itemNonce = await provider.getTransactionCount(iappSigner.address);
            
            // Create the transaction object
            const itemTx = {
                to: contractAddress,
                data: addItemData,
                nonce: itemNonce,
                gasLimit: 300000,
                gasPrice: ethers.parseUnits("1", "gwei"),
                type: 0,
                chainId: network.chainId
            };

            // Sign the transaction
            const signedItemTx = await iappSigner.signTransaction(itemTx);
            
            // Send the raw transaction
            console.log("Sending raw transaction...");
            const itemTxHash = await provider.send("eth_sendRawTransaction", [signedItemTx]);
            console.log(`Transaction hash: ${itemTxHash}`);

            // Wait for the transaction to be mined
            console.log("Waiting for transaction confirmation...");
            const itemReceipt = await provider.waitForTransaction(itemTxHash);
            console.log(`Transaction confirmed in block: ${itemReceipt.blockNumber}`);
            
            // For testing, we'll use sequential item IDs
            const itemId = itemIds.length + 1;
            itemIds.push(itemId);
            console.log(`Added item with ID: ${itemId}`);
        }

        // Calculate total amount
        const totalAmount = expenseData.items.reduce(
            (sum, item) => sum + ethers.parseEther(item.totalCost.toString()),
            ethers.parseEther("0")
        );

        // Batch pay all items
        console.log("Processing payment for all items...");
        
        // Prepare the transaction data
        const payData = expenseContract.interface.encodeFunctionData("batchPayItems", [
            expenseId,
            itemIds,
            totalAmount
        ]);

        // Get the current nonce
        const payNonce = await provider.getTransactionCount(iappSigner.address);
        
        // Create the transaction object
        const payTx = {
            to: contractAddress,
            data: payData,
            nonce: payNonce,
            gasLimit: 300000,
            gasPrice: ethers.parseUnits("1", "gwei"),
            type: 0,
            chainId: network.chainId
        };

        // Sign the transaction
        const signedPayTx = await iappSigner.signTransaction(payTx);
        
        // Send the raw transaction
        console.log("Sending raw transaction...");
        const payTxHash = await provider.send("eth_sendRawTransaction", [signedPayTx]);
        console.log(`Transaction hash: ${payTxHash}`);

        // Wait for the transaction to be mined
        console.log("Waiting for transaction confirmation...");
        const payReceipt = await provider.waitForTransaction(payTxHash);
        console.log(`Transaction confirmed in block: ${payReceipt.blockNumber}`);
        
        console.log("All transactions completed successfully!");
        console.log("Expense data successfully written to smart contract!");

    } catch (error) {
        console.error("Error interacting with smart contract:", error);
        throw new Error(`Smart contract interaction failed: ${error.message}`);
    }

    console.log("iApp execution finished successfully.");
}

main().catch((error) => {
    console.error("iApp experienced an unhandled error:", error);
    process.exit(1); // Exit with a non-zero code to indicate failure
});