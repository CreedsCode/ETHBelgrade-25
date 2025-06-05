import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ChangeEvent, DragEvent } from 'react'; // Type-only imports
import Tesseract from 'tesseract.js'; 
import type { RecognizeResult, LoggerMessage } from 'tesseract.js'; // Added LoggerMessage
import NavBar from './components/NavBar'; // For Wallet Integration
import { useExpenses } from './hooks/useExpenses';
import { decodeEventLog, type Log, type TransactionReceipt, type Hash, type Hex, encodeEventTopics } from 'viem';
import OnChainExpensesABI from './abi/OnChainExpenses.json';
import { IExecDataProtector, type DataObject } from '@iexec/dataprotector'; // Added iExec DataProtector import
import { useChainSwitcher } from './hooks/useChainSwitcher'; // Import useChainSwitcher
import { iexec, passetHub } from './utils/viem'; // Import iexec and passetHub chain config

const CONTRACT_ADDRESS = "0x3BF50174762538e3111008A38db4Da16C277128F";

// Removed custom EthereumProvider interface and global Window augmentation
// Types from viem/EIP-1193 should handle window.ethereum

interface BlockscoutLog {
  address: {
    hash: string;
  };
  block_hash: string;
  block_number: number;
  data: string;
  index: number;
  topics: string[];
  transaction_hash: string;
}

interface BlockscoutResponse {
  items: BlockscoutLog[];
}

// Define types for better maintainability
interface ReceiptItem {
  id: string;
  description: string;
  quantity: string; // Or number, if strictly numeric
  price: string;    // Or number
}

interface UploadedReceipt {
  id: string;
  fileName: string;
  imageUrl: string;
  total: string; // Or number, if strictly numeric
  itemDetails: ReceiptItem[];
  isCollapsed: boolean;
  isProcessing: boolean;
  extractedText?: string; // Store raw extracted text for debugging or re-parsing
  ocrFailed?: boolean; // Flag to indicate OCR failure
}

type OcrQueueItem = string; // Just the ID

interface ExpenseCreatedEvent {
  eventName: 'ExpenseCreated';
  args: {
    expenseId: bigint;
    creator: `0x${string}`;
    payer: `0x${string}`;
    title: string;
  };
}

// Define types for submission steps and data for protection
type SubmissionStep = 
  | 'idle' 
  | 'validatingPassetHub'
  | 'submittingToPassetHub' 
  | 'switchingToIexec' 
  | 'protectingOnIexec' 
  | 'completed' 
  | 'error';

interface PreparedDataForProtection {
  expenseId: number;
  dataToProtect: DataObject;
  title: string;
}

// Interface for errors that might have a code property
interface ErrorWithCode extends Error {
  code?: number;
}

function App() {
  // Wallet State
  const [walletAccount, setWalletAccount] = useState<string | null>(null);
  const handleWalletConnect = useCallback((account: string) => {
    setWalletAccount(account);
  }, []);
   useEffect(() => {
    if (walletAccount) {
      // console.log("Wallet account state in App.tsx:", walletAccount);
    }
  }, [walletAccount]);

  // Chain Switcher Hook
  const { currentChainId, switchChain, isSwitching: isChainSwitching, error: chainError, getChainName } = useChainSwitcher();

  // State for the main form inputs
  const [requestAddress, setRequestAddress] = useState<string>('');
  const [title, setTitle] = useState<string>('');

  // Receipts and OCR Queue
  const [uploadedReceipts, setUploadedReceipts] = useState<UploadedReceipt[]>([]);
  const [ocrQueue, setOcrQueue] = useState<OcrQueueItem[]>([]);
  const [currentOcrProcessId, setCurrentOcrProcessId] = useState<string | null>(null);

  // UI related states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isAnyOcrLoading = !!currentOcrProcessId;

  // iExec DataProtector SDK instance
  const [dataProtector, setDataProtector] = useState<IExecDataProtector | null>(null);

  // Submission Flow State
  const [submissionStep, setSubmissionStep] = useState<SubmissionStep>('idle');
  const [preparedDataForProtection, setPreparedDataForProtection] = useState<PreparedDataForProtection | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const uploadedReceiptsRef = useRef(uploadedReceipts);
  useEffect(() => {
    uploadedReceiptsRef.current = uploadedReceipts;
  }, [uploadedReceipts]);

  const grandTotal = uploadedReceipts.reduce((sum, receipt) => {
    const receiptTotal = parseFloat(receipt.total?.replace('$', '').replace(',', '.') || '0');
    return sum + receiptTotal;
  }, 0).toFixed(2);

  useEffect(() => {
    if (!currentOcrProcessId && ocrQueue.length > 0) {
      const nextReceiptId = ocrQueue[0];
      const receiptToProcess = uploadedReceipts.find(r => r.id === nextReceiptId);

      if (receiptToProcess && receiptToProcess.imageUrl) {
        setUploadedReceipts(prev => prev.map(r =>
          r.id === nextReceiptId ? { ...r, isProcessing: true } : r
        ));
        setCurrentOcrProcessId(nextReceiptId);
        performOCR(nextReceiptId, receiptToProcess.imageUrl);
      } else {
        if (!receiptToProcess) {
          console.warn(`Receipt ID ${nextReceiptId} in OCR queue but not found in uploadedReceipts. Removing from queue.`);
        } else {
          console.warn(`Receipt ID ${nextReceiptId} found but missing imageUrl. Removing from queue.`);
        }
        setOcrQueue(prev => prev.filter(id => id !== nextReceiptId));
      }
    }
  }, [ocrQueue, currentOcrProcessId, uploadedReceipts]);

  // Initialize iExec DataProtector SDK when wallet is connected AND on the correct chain (Bellecour)
  useEffect(() => {
    if (walletAccount && window.ethereum && currentChainId === iexec.id) {
      try {
        const protector = new IExecDataProtector(window.ethereum);
        setDataProtector(protector);
        console.log("iExec DataProtector SDK instantiated successfully on Bellecour chain.");
      } catch (error) {
        console.error("Failed to instantiate iExec DataProtector SDK:", error);
        setDataProtector(null);
      }
    } else {
      setDataProtector(null);
      if (walletAccount && currentChainId !== iexec.id) {
        console.warn(`Wallet connected, but not on iExec Bellecour chain (current: ${currentChainId}). DataProtector SDK not initialized.`);
      }
    }
  }, [walletAccount, currentChainId]); // Add currentChainId as a dependency

  // Effect for handling steps after PassetHub submission (chain switch and iExec protection)
  useEffect(() => {
    const performProtectionSteps = async () => {
      if (submissionStep === 'switchingToIexec' && preparedDataForProtection) {
        if (currentChainId !== iexec.id) {
          console.log("Attempting to switch to iExec Bellecour for data protection...");
          try {
            await switchChain(iexec.id);
          } catch (err) {
            console.error("Error during switch to iExec Bellecour:", err);
            setSubmissionError("Failed to switch to iExec Bellecour. Please switch manually and try again.");
            setSubmissionStep('error');
          }
        } else {
          console.log("Successfully on iExec Bellecour. Proceeding to protection step.");
          setSubmissionStep('protectingOnIexec');
        }
      } else if (submissionStep === 'protectingOnIexec' && preparedDataForProtection && currentChainId === iexec.id) {
        if (!dataProtector) {
          console.warn("DataProtector SDK not yet initialized on Bellecour. Waiting...");
          setTimeout(performProtectionSteps, 30000); // Re-check in 10s
          return;
        }

        console.log("DataProtector SDK ready. Protecting data on iExec Bellecour...");
        try {
          const { dataToProtect, title: dataTitle, expenseId } = preparedDataForProtection;
          alert("Please approve the next transaction in MetaMask to protect your expense data on the iExec network."); // Proactive alert
          const protectedDataResult = await dataProtector.core.protectData({
            data: dataToProtect,
            name: `Expense Report: ${dataTitle} (PassetHub ID: ${expenseId})`, // Clarify origin of ID
          });
          console.log('Data protected on iExec:', protectedDataResult);
          alert(`Expense submitted (ID: ${expenseId}) and data protected on iExec!\nProtected Data Address: ${protectedDataResult.address}`);
          
          setSubmissionStep('completed');
          setRequestAddress('');
          setTitle('');
          setUploadedReceipts([]);
          setPreparedDataForProtection(null);
          setSubmissionError(null);
          setTimeout(() => setSubmissionStep('idle'), 2000);

        } catch (protectError) {
          console.error("Error protecting data with iExec DataProtector:", protectError);
          let message = `Data protection on iExec FAILED.`;
          // Type assertion to ErrorWithCode to safely access .code
          if (protectError instanceof Error && (protectError as ErrorWithCode).code === 4001) {
            message = "Transaction to protect data was rejected in MetaMask. Please try submitting again and approve the transaction.";
          } else if (protectError instanceof Error) {
            message += ` ${protectError.message}`;
          } else {
            message += ` ${String(protectError)}`;
          }
          setSubmissionError(message);
          setSubmissionStep('error');
        }
      }
    };

    // Only run performProtectionSteps if we are in a relevant step
    if (submissionStep === 'switchingToIexec' || submissionStep === 'protectingOnIexec') {
        performProtectionSteps();
    }
  }, [submissionStep, preparedDataForProtection, currentChainId, dataProtector, switchChain]);

  const processFiles = async (files: FileList) => {
    const newReceipts: UploadedReceipt[] = Array.from(files).map(file => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const imageUrl = URL.createObjectURL(file);
      return {
        id,
        fileName: file.name,
        imageUrl,
        total: '',
        itemDetails: [],
        isCollapsed: false,
        isProcessing: false,
      };
    });

    setUploadedReceipts(prevReceipts => [...prevReceipts, ...newReceipts]);
    setOcrQueue(prevQueue => [...prevQueue, ...newReceipts.map(r => r.id)]);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      processFiles(event.target.files);
      event.target.value = ''; // Clear input
    }
  };

  const commonDragEventPrevent = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    commonDragEventPrevent(event);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    commonDragEventPrevent(event);
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    commonDragEventPrevent(event);
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    commonDragEventPrevent(event);
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      processFiles(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  };

  const performOCR = async (receiptId: string, imageUrl: string) => {
    try {
      const result = await Tesseract.recognize(
        imageUrl,
        'eng',
        {
          logger: (m: LoggerMessage) => console.log(`OCR Progress (${receiptId}):`, m.status, Math.round(m.progress * 100) + '%'),
        }
      ) as unknown as RecognizeResult;
      
      const extractedText = result.data.text;
      console.log(`OCR Raw Text for ${receiptId}:`, extractedText);

      // Basic parsing - can be significantly improved
      const lines = extractedText.split('\n');
      let detectedTotal = '';
      const items: ReceiptItem[] = [];
      
      // Example: Look for lines that might contain 'Total' or a currency symbol and numbers
      const totalKeywords = ['total', 'sum', 'celkem', 'amount'];
      const itemRegex = /(.+?)\s+(\$?\d+\.\d{2})/; // Very basic item parsing

      lines.forEach((line: string, index: number) => {
        const lowerLine = line.toLowerCase();
        let isTotalLine = false;
        for (const keyword of totalKeywords) {
          if (lowerLine.includes(keyword)) {
            const match = line.match(/\$?(\d+\.\d{2})/);
            if (match && match[1]) {
              detectedTotal = match[1];
              isTotalLine = true;
              break;
            }
          }
        }

        if (!isTotalLine) {
            const itemMatch = line.match(itemRegex);
            if (itemMatch) {
                items.push({ id: `item-${receiptId}-${index}`, description: itemMatch[1].trim(), quantity: '1', price: itemMatch[2] });
            } else if (line.trim().length > 0 && items.length < 10) { // Fallback for non-matching lines as potential items
                // items.push({ id: `item-${receiptId}-${index}`, description: line.trim(), quantity: '1', price: '0.00' });
            }
        }
      });
      if (!detectedTotal && items.length > 0) { // If no explicit total, sum item prices
        detectedTotal = items.reduce((acc, item) => acc + parseFloat(item.price.replace('$', '') || '0'), 0).toFixed(2);
      }


      setUploadedReceipts(prev => prev.map(r =>
        r.id === receiptId ? { ...r, total: detectedTotal, itemDetails: items, isProcessing: false, extractedText, ocrFailed: false } : r
      ));
    } catch (error) {
      console.error(`Error during OCR for ${receiptId}:`, error);
      setUploadedReceipts(prev => prev.map(r =>
        r.id === receiptId ? { ...r, total: 'Error', itemDetails: [], isProcessing: false, extractedText: "OCR Failed", ocrFailed: true } : r
      ));
    } finally {
      // Move to the next item in the queue
      setOcrQueue(prevQueue => prevQueue.filter(id => id !== receiptId));
      // If this was the one being processed, clear currentOcrProcessId
      if (currentOcrProcessId === receiptId) {
        setCurrentOcrProcessId(null);
      }
    }
  };

  const handleItemDetailChange = (receiptId: string, itemId: string, field: keyof ReceiptItem, value: string) => {
    setUploadedReceipts(prev => prev.map(r =>
      r.id === receiptId ? {
        ...r,
        itemDetails: r.itemDetails.map(item =>
          item.id === itemId ? { ...item, [field]: value } : item
        )
      } : r
    ));
  };
  
  // Recalculate total when item details change
  useEffect(() => {
    let hasAnyTotalChanged = false;
    const updatedReceipts = uploadedReceipts.map(receipt => {
      const oldTotal = receipt.total;
      let newTotal = oldTotal;

      if (receipt.itemDetails && receipt.itemDetails.length > 0) {
        newTotal = receipt.itemDetails.reduce((sum, item) => {
          const price = parseFloat(item.price?.replace('$', '').replace(',', '.') || '0');
          return sum + price;
        }, 0).toFixed(2);
      } else if (receipt.itemDetails && receipt.itemDetails.length === 0) {
        newTotal = '0.00'; // Reset to 0 if all items are removed
      }

      if (oldTotal !== newTotal) {
        hasAnyTotalChanged = true;
        return { ...receipt, total: newTotal };
      }
      return receipt;
    });

    if (hasAnyTotalChanged) {
      setUploadedReceipts(updatedReceipts);
    }
  }, [uploadedReceipts]);

  const handleCollapseToggle = (receiptId: string) => {
    setUploadedReceipts(prev => prev.map(r =>
      r.id === receiptId ? { ...r, isCollapsed: !r.isCollapsed } : r
    ));
  };
  
  const handleRemoveReceipt = (receiptId: string) => {
    setUploadedReceipts(prev => prev.filter(r => r.id !== receiptId));
    // Also remove from OCR queue if it's there
    setOcrQueue(prev => prev.filter(id => id !== receiptId));
    // If it was being processed, stop it
    if (currentOcrProcessId === receiptId) {
        setCurrentOcrProcessId(null); 
        // Tesseract doesn't have a direct cancel for current job via this API structure easily.
        // The 'finally' block in performOCR will try to move to next.
    }
  };

  const handleAddItem = (receiptId: string) => {
    setUploadedReceipts(prev => prev.map(r =>
      r.id === receiptId ? {
        ...r,
        itemDetails: [
          ...r.itemDetails,
          { id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, description: '', quantity: '1', price: '0.00' }
        ]
      } : r
    ));
  };

  const handleRequestAddressChange = (event: ChangeEvent<HTMLInputElement>) => setRequestAddress(event.target.value);
  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value);
  
  const { createExpenseRequest } = useExpenses();

  const handleSubmitRequest = async () => {
    setSubmissionError(null); // Clear previous errors

    if (!walletAccount) {
      alert("Please connect your wallet first.");
      return;
    }
    if (uploadedReceipts.length === 0 || !title || !requestAddress || uploadedReceipts.some(r => !r.total || r.total === '0.00' || r.itemDetails.length === 0 || r.itemDetails.some(item => !item.description || !item.price))) {
      alert("Please fill all fields, ensure all receipts have items with descriptions/prices, and valid totals.");
      return;
    }

    setSubmissionStep('validatingPassetHub');

    if (currentChainId !== passetHub.id) {
      alert("Please switch to the Passet Hub network to submit the expense transaction.");
      try {
        setSubmissionStep('idle'); // Allow user to re-initiate after switching
        await switchChain(passetHub.id);
        // User will need to click submit again after chain switch is confirmed by WalletConnect/NavBar UI
      } catch (err) {
        console.error("Error during switch to Passet Hub:", err);
        setSubmissionError("Failed to switch to Passet Hub. Please switch manually and try again.");
        setSubmissionStep('error');
      }
      return;
    }

    setSubmissionStep('submittingToPassetHub');
    try {
      const hash = await createExpenseRequest(title, requestAddress) as Hash;
      console.log("Expense request created on Passet Hub with hash:", hash);

      // ... (Blockscout polling logic - this needs to be robust)
      // For simplicity, assuming direct event retrieval or a more robust polling mechanism exists here
      // This example will simplify the event retrieval part for brevity in this refactor
      let receiptFromAPI: TransactionReceipt | null = null;
      let attempts = 0;
      const maxAttempts = 120; 
      while (!receiptFromAPI && attempts < maxAttempts) {
        try {
          const response = await fetch(`https://blockscout-passet-hub.parity-testnet.parity.io/api/v2/addresses/${CONTRACT_ADDRESS}/logs`);
          const data = await response.json() as BlockscoutResponse;
          const log = data.items.find((log: BlockscoutLog) => log.transaction_hash === hash);
          if (log) {
            receiptFromAPI = { 
              logs: [{ 
                address: log.address.hash as `0x${string}`, 
                topics: log.topics as Hex[], // Cast to Hex[]
                data: log.data as Hex,       // Cast to Hex
                blockNumber: BigInt(log.block_number), 
                blockHash: log.block_hash as `0x${string}`, 
                transactionHash: log.transaction_hash as `0x${string}`, 
                logIndex: BigInt(log.index) 
              }] 
            } as unknown as TransactionReceipt;
            break;
          }
        } catch (errFetchLogs) { // Used errFetchLogs
            console.error('Error fetching logs from Blockscout:', errFetchLogs); 
            // Optionally, break or retry fewer times if Blockscout is consistently failing
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (!receiptFromAPI) throw new Error('Passet Hub transaction not confirmed or logs not found after 120 seconds');

      // Use encodeEventTopics to get the expected topic0 for ExpenseCreated
      const topicsForExpenseCreated = encodeEventTopics({
        abi: OnChainExpensesABI,
        eventName: 'ExpenseCreated'
      });

      if (!topicsForExpenseCreated || topicsForExpenseCreated.length === 0 || !topicsForExpenseCreated[0]) {
        throw new Error('Could not derive topic for ExpenseCreated event from ABI.');
      }
      const expectedEventTopic = topicsForExpenseCreated[0];

      const expenseCreatedEvent = receiptFromAPI.logs.find((log: Log) => {
        return log.topics[0] === expectedEventTopic;
      });

      if (!expenseCreatedEvent) throw new Error('ExpenseCreated event not found on Passet Hub');
      
      const decodedData = decodeEventLog({
        abi: OnChainExpensesABI,
        data: expenseCreatedEvent.data,
        topics: expenseCreatedEvent.topics,
        strict: false 
      }) as unknown as ExpenseCreatedEvent;

      if (!decodedData.args || typeof decodedData.args.expenseId === 'undefined') throw new Error('Failed to decode expenseId from Passet Hub event');
      
      const expenseId = Number(decodedData.args.expenseId);
      console.log('Extracted expenseId from Passet Hub:', expenseId);

      const dataToProtect: DataObject = {
        expenseId: expenseId.toString(), // Ensure primitive types for top-level keys if possible
        title,
        payer: requestAddress,
        totalAmount: grandTotal,
        receipts: JSON.stringify(uploadedReceipts.map(receipt => ({
          fileName: receipt.fileName,
          total: receipt.total,
          items: receipt.itemDetails.map(item => ({ description: item.description, quantity: item.quantity, price: item.price }))
        })))
      } as unknown as DataObject;

      setPreparedDataForProtection({ expenseId, dataToProtect, title });
      setSubmissionStep('switchingToIexec'); // Trigger next phase via useEffect

    } catch (error) {
      console.error("Error submitting expense to Passet Hub:", error);
      setSubmissionError(`Failed during Passet Hub transaction: ${error instanceof Error ? error.message : String(error)}`);
      setSubmissionStep('error');
    }
  };
  

  // Tailwind classes for common elements
  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none";
  const buttonClass = "px-4 py-2 font-semibold text-sm bg-sky-500 text-white rounded-md shadow-sm hover:bg-sky-600 disabled:opacity-50";
  const secondaryButtonClass = "px-3 py-1.5 font-medium text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300";

  const getButtonText = () => {
    if (isChainSwitching) return `Switching to ${getChainName(currentChainId === passetHub.id ? iexec.id : passetHub.id)}...`;
    switch (submissionStep) {
      case 'idle': return 'Submit Expense Request';
      case 'validatingPassetHub':
        if (currentChainId !== passetHub.id) return `Switch to ${getChainName(passetHub.id)} to Submit`;
        return 'Validating...';
      case 'submittingToPassetHub': return 'Submitting to Passet Hub...';
      case 'switchingToIexec': return 'Switching to iExec Bellecour...';
      case 'protectingOnIexec': 
        if (currentChainId !== iexec.id) return `Switch to ${getChainName(iexec.id)} to Protect`;
        if (!dataProtector) return `Initializing on ${getChainName(iexec.id)}...`;
        return 'Protecting Data on iExec...';
      case 'completed': return 'Submitted & Protected!';
      case 'error': return 'Error Occurred - Retry Submission';
      default: return 'Submit Expense Request';
    }
  };

  const isSubmitButtonDisabled = () => {
    if (isChainSwitching || !walletAccount || uploadedReceipts.length === 0) return true;
    if (submissionStep === 'submittingToPassetHub' ||
        submissionStep === 'switchingToIexec' ||
        submissionStep === 'completed') return true;
    if (submissionStep === 'validatingPassetHub' && currentChainId !== passetHub.id) return true;
    if (submissionStep === 'protectingOnIexec') {
      return currentChainId !== iexec.id || !dataProtector;
    } 
    // For 'idle' and 'error' states, the button should generally be enabled 
    // (unless other conditions like !walletAccount make it disabled)
    // The initial checks (isChainSwitching, !walletAccount, etc.) cover these.
    return false; // Default to not disabled if none of the above conditions met
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-800 font-sans">
      <NavBar onWalletConnect={handleWalletConnect} />

      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
          <h1 className="text-3xl font-bold text-slate-700 mb-6 text-center">On-Chain Expense Reporter</h1>

          {/* Request Details Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div>
              <label htmlFor="requestAddress" className="block text-sm font-medium text-slate-700">Request To Address</label>
              <input type="text" id="requestAddress" value={requestAddress} onChange={handleRequestAddressChange} className={inputClass} placeholder="0x123..." disabled={submissionStep !== 'idle' && submissionStep !== 'error'} />
            </div>
      <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-700">Expense Title</label>
              <input type="text" id="title" value={title} onChange={(e) => handleTitleChange(e)} className={inputClass} placeholder="e.g., Team Dinner Q3" disabled={submissionStep !== 'idle' && submissionStep !== 'error'} />
            </div>
      </div>

          {/* File Upload Section */}
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 ease-in-out
                        ${isDragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 hover:border-slate-400'}
                        ${(submissionStep !== 'idle' && submissionStep !== 'error') || isAnyOcrLoading ? 'opacity-70 cursor-not-allowed' : ''}`
          }
            onDragOver={(submissionStep === 'idle' || submissionStep === 'error') && !isAnyOcrLoading ? handleDragOver : undefined}
            onDragEnter={(submissionStep === 'idle' || submissionStep === 'error') && !isAnyOcrLoading ? handleDragEnter : undefined}
            onDragLeave={(submissionStep === 'idle' || submissionStep === 'error') && !isAnyOcrLoading ? handleDragLeave : undefined}
            onDrop={(submissionStep === 'idle' || submissionStep === 'error') && !isAnyOcrLoading ? handleDrop : undefined}
            onClick={() => (submissionStep === 'idle' || submissionStep === 'error') && !isAnyOcrLoading && document.getElementById('fileUpload')?.click()}
          >
            <input type="file" id="fileUpload" multiple onChange={handleImageChange} className="hidden" disabled={(submissionStep !== 'idle' && submissionStep !== 'error') || isAnyOcrLoading} />
            {/* Always show the upload prompt, remove the global spinner from here */}
            <p className="text-slate-500">Drag & drop receipt images here, or click to select files.</p>
            {(ocrQueue.length > 0 || currentOcrProcessId) && (
              <p className="text-xs text-slate-400 mt-2">
                {ocrQueue.length + (currentOcrProcessId ? 1 : 0)} item(s) currently in OCR process.
              </p>
            )}
          </div>

          {/* Uploaded Receipts Section */}
          {uploadedReceipts.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-slate-700 mb-4">Uploaded Receipts</h2>
              <div className="space-y-4">
                {uploadedReceipts.map((receipt) => (
                  <div key={receipt.id} className={`bg-slate-50 p-4 rounded-lg shadow ${(submissionStep !== 'idle' && submissionStep !== 'error') ? 'opacity-70' : ''}`}>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-slate-600 truncate w-3/4" title={receipt.fileName}>{receipt.fileName}</h3>
                      <div className="flex items-center space-x-2">
                        {receipt.isProcessing && (
                             <svg className="animate-spin h-4 w-4 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg>
                        )}
                        <span className="text-sm font-bold text-slate-700">Total: ${receipt.total || '0.00'}</span>
                        <button onClick={() => (submissionStep === 'idle' || submissionStep === 'error') && handleCollapseToggle(receipt.id)} className={secondaryButtonClass} disabled={(submissionStep !== 'idle' && submissionStep !== 'error')}>
                          {receipt.isCollapsed ? 'Expand' : 'Collapse'}
                        </button>
                        <button onClick={() => (submissionStep === 'idle' || submissionStep === 'error') && handleRemoveReceipt(receipt.id)} className="text-red-500 hover:text-red-700 font-medium text-xs" disabled={(submissionStep !== 'idle' && submissionStep !== 'error')}>Remove</button>
                      </div>
                    </div>
                    {!receipt.isCollapsed && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        {receipt.ocrFailed ? (
                          // OCR Failed View
                          <div>
                            <p className="text-red-500 font-semibold mb-2">OCR Failed. Please enter details manually.</p>
                            <div className="mb-4">
                                <img src={receipt.imageUrl} alt={receipt.fileName} className="max-w-xs max-h-48 rounded border border-slate-300"/>
                            </div>
                            <div className="mb-3">
                                <span className="text-sm font-medium text-slate-700">Currency: </span>
                                <span className="text-sm text-slate-600">USD (Fixed)</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2 text-xs font-medium text-slate-500">
                              <div>Item Description</div>
                              <div>Quantity</div>
                              <div>Price ($)</div>
                            </div>
                            {receipt.itemDetails.map((item) => (
                              <div key={item.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center mb-1">
                                <input type="text" value={item.description} onChange={(e) => handleItemDetailChange(receipt.id, item.id, 'description', e.target.value)} className={`${inputClass} text-xs p-1`} placeholder="Item name" disabled={(submissionStep !== 'idle' && submissionStep !== 'error')}/>
                                <input type="text" value={item.quantity} onChange={(e) => handleItemDetailChange(receipt.id, item.id, 'quantity', e.target.value)} className={`${inputClass} text-xs p-1 w-1/2 md:w-full`} placeholder="1" disabled={(submissionStep !== 'idle' && submissionStep !== 'error')}/>
                                <input type="text" value={item.price} onChange={(e) => handleItemDetailChange(receipt.id, item.id, 'price', e.target.value)} className={`${inputClass} text-xs p-1 w-1/2 md:w-full`} placeholder="0.00" disabled={(submissionStep !== 'idle' && submissionStep !== 'error')}/>
                              </div>
                            ))}
                            <button onClick={() => (submissionStep === 'idle' || submissionStep !== 'error') && handleAddItem(receipt.id)} className={`${secondaryButtonClass} mt-2`} disabled={(submissionStep !== 'idle' && submissionStep !== 'error')}>
                              Add Item
                            </button>
                          </div>
                        ) : (
                          // OCR Succeeded or Pending View (Original item display)
                          <div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2 text-xs font-medium text-slate-500">
                              <div>Item Description</div>
                              <div>Quantity</div>
                              <div>Price ($)</div>
                            </div>
                            {receipt.itemDetails.map((item) => (
                              <div key={item.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center mb-1">
                                <input type="text" value={item.description} onChange={(e) => handleItemDetailChange(receipt.id, item.id, 'description', e.target.value)} className={`${inputClass} text-xs p-1`} disabled={(submissionStep !== 'idle' && submissionStep !== 'error')}/>
                                <input type="text" value={item.quantity} onChange={(e) => handleItemDetailChange(receipt.id, item.id, 'quantity', e.target.value)} className={`${inputClass} text-xs p-1 w-1/2 md:w-full`} disabled={(submissionStep !== 'idle' && submissionStep !== 'error')}/>
                                <input type="text" value={item.price} onChange={(e) => handleItemDetailChange(receipt.id, item.id, 'price', e.target.value)} className={`${inputClass} text-xs p-1 w-1/2 md:w-full`} disabled={(submissionStep !== 'idle' && submissionStep !== 'error')}/>
                              </div>
                            ))}
                          </div>
                        )}
                         {receipt.extractedText && (
                            <details className="mt-2 text-xs">
                                <summary className="cursor-pointer text-slate-400 hover:text-slate-600">View raw OCR text</summary>
                                <pre className="mt-1 p-2 bg-slate-200 rounded text-slate-600 max-h-32 overflow-auto">{receipt.extractedText}</pre>
                            </details>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grand Total & Submit Section */}
          {uploadedReceipts.length > 0 && (
            <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col items-end">
              <p className="text-2xl font-bold text-slate-700 mb-4">Grand Total: ${grandTotal}</p>
              <button
                onClick={submissionStep === 'error' ? () => { setSubmissionStep('idle'); setSubmissionError(null); } : handleSubmitRequest}
                className={`${buttonClass} w-full md:w-auto`}
                disabled={isSubmitButtonDisabled()}
              >
                {getButtonText()}
              </button>
               {!walletAccount && <p className="text-xs text-red-500 mt-1">Wallet not connected.</p>}
               {submissionError && <p className="text-xs text-red-500 mt-1">Error: {submissionError}</p>}
               {chainError && !submissionError && <p className="text-xs text-red-500 mt-1">Chain Switch Error: {chainError}</p>}
            </div>
          )}
        </div>
      </main>

      <footer className="text-center p-4 text-xs text-slate-500 border-t border-slate-200 bg-slate-100">
        <p>&copy; {new Date().getFullYear()} On-Chain Expensing. All rights reserved (not really).</p>
      </footer>
    </div>
  );
}

export default App;
