import React, { useState, useEffect, useCallback } from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { useChainSwitcher } from '../hooks/useChainSwitcher';
import { passetHub } from '../utils/viem'; // For chain switching

interface PayerDashboardProps {
  walletAccount: string | null;
}

// ABI-aligned return type for getExpenseRequest
interface ExpenseRequestData {
  title: string;
  creator: `0x${string}`;
  payer: `0x${string}`;
  timestamp: bigint;
  readyToReview: boolean;
  fullyPaid: boolean;
  totalPaidAmount: bigint;
  itemCount: bigint;
}

// ABI-aligned return type for getAllExpenseItems
interface AllExpenseItemsData {
  ipfsHashes: string[];
  amounts: bigint[];
  categories: string[];
  paidStatus: boolean[];
  timestamps: bigint[];
}

interface ExpenseSummary {
  id: bigint;
  title: string;
  creator: `0x${string}`;
  itemCount: bigint;
  totalPaidAmount: bigint;
}

interface ExpenseItemDetail {
  ipfsHash: string;
  amount: bigint;
  category: string;
  paid: boolean;
  timestamp: bigint;
}

interface DetailedExpense extends ExpenseSummary {
  items: ExpenseItemDetail[];
  readyToReview: boolean;
  fullyPaid: boolean;
  payer: `0x${string}`;
}

const PayerDashboard: React.FC<PayerDashboardProps> = ({ walletAccount }) => {
  const { 
    getExpensesReadyForReview, 
    getExpenseRequest, 
    getAllExpenseItems,
    approveStableCoin,
    batchPayItems
  } = useExpenses();
  const { currentChainId, switchChain, isSwitching: isChainSwitching, getChainName } = useChainSwitcher();

  const [expenses, setExpenses] = useState<ExpenseSummary[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<DetailedExpense | null>(null);
  const [itemsToPay, setItemsToPay] = useState<bigint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'approving' | 'paying' | 'success' | 'error'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Log state on every render
  console.log('[PayerDashboard Render] isLoading:', isLoading, 'expenses.length:', expenses.length, 'selectedExpense:', !!selectedExpense, 'walletAccount:', !!walletAccount, 'currentChainId:', currentChainId, 'error:', error);

  const buttonClass = "px-4 py-2 font-semibold text-sm bg-sky-500 text-white rounded-md shadow-sm hover:bg-sky-600 disabled:opacity-50";
  const secondaryButtonClass = "px-3 py-1.5 font-medium text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300";

  const fetchExpenses = useCallback(async () => {
    if (!walletAccount) {
      console.log('[fetchExpenses] Aborted: No walletAccount.');
      return;
    }
    console.log('[fetchExpenses] Starting...');
    setIsLoading(true);
    setError(null);

    if (currentChainId !== passetHub.id) {
      console.log(`[fetchExpenses] Incorrect network (current: ${currentChainId}). Attempting to switch to ${passetHub.id}`);
      try {
        await switchChain(passetHub.id);
        console.log('[fetchExpenses] Switch successful, useEffect should re-trigger fetch.');
      } catch (err) {
        const errorMsg = `Failed to switch to ${getChainName(passetHub.id)}. Please switch manually. Error: ${err instanceof Error ? err.message : String(err)}`;
        console.error('[fetchExpenses] Switch failed:', errorMsg);
        setError(errorMsg);
        setIsLoading(false);
      }
      return;
    }

    console.log('[fetchExpenses] Network is correct. Fetching expense IDs for payer:', walletAccount);
    try {
      const expenseIds = await getExpensesReadyForReview(walletAccount) as bigint[];
      console.log('[fetchExpenses] Fetched expenseIds:', expenseIds);

      const expenseDetailsPromises = expenseIds.map(async (id: bigint) => {
        const requestDetails = await getExpenseRequest(id) as ExpenseRequestData;
        return {
          id,
          title: requestDetails.title,
          creator: requestDetails.creator,
          itemCount: requestDetails.itemCount,
          totalPaidAmount: requestDetails.totalPaidAmount,
        } as ExpenseSummary;
      });
      const fetchedExpenses = await Promise.all(expenseDetailsPromises);
      console.log('[fetchExpenses] Processed fetchedExpenses:', fetchedExpenses);
      setExpenses(fetchedExpenses);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[fetchExpenses] Error fetching expense data:", errorMsg, err);
      setError(errorMsg);
      console.log('[fetchExpenses] Error occurred, error state set to:', errorMsg);
    } finally {
      setIsLoading(false);
      console.log('[fetchExpenses] Finished. setIsLoading to false.');
    }
  }, [walletAccount, getExpensesReadyForReview, getExpenseRequest, currentChainId, switchChain, getChainName]);

  useEffect(() => {
    console.log('[useEffect walletAccount, currentChainId] Triggered. Wallet:', !!walletAccount, 'ChainID:', currentChainId);
    if (walletAccount && currentChainId === passetHub.id) {
      console.log('[useEffect walletAccount, currentChainId] Conditions met, calling fetchExpenses.');
      fetchExpenses();
    } else if (walletAccount && currentChainId !== passetHub.id) {
      console.log('[useEffect walletAccount, currentChainId] Wallet connected but wrong chain, attempting switch via fetchExpenses.');
      fetchExpenses(); // This call will handle the switch attempt
    }
  }, [walletAccount, currentChainId, fetchExpenses]);

  const handleViewDetails = async (expenseId: bigint) => {
    setIsLoading(true);
    setError(null);
    setSelectedExpense(null);
    setItemsToPay([]);
    try {
      const requestDetails = await getExpenseRequest(expenseId) as ExpenseRequestData;
      const itemsRaw = await getAllExpenseItems(expenseId) as AllExpenseItemsData;
      
      const detailedItems: ExpenseItemDetail[] = [];
      if (itemsRaw && itemsRaw.ipfsHashes) {
        for (let i = 0; i < itemsRaw.ipfsHashes.length; i++) {
          detailedItems.push({
            ipfsHash: itemsRaw.ipfsHashes[i],
            amount: itemsRaw.amounts[i],
            category: itemsRaw.categories[i],
            paid: itemsRaw.paidStatus[i],
            timestamp: itemsRaw.timestamps[i],
          });
        }
      }

      setSelectedExpense({
        id: expenseId,
        title: requestDetails.title,
        creator: requestDetails.creator,
        payer: requestDetails.payer,
        itemCount: requestDetails.itemCount,
        totalPaidAmount: requestDetails.totalPaidAmount,
        readyToReview: requestDetails.readyToReview,
        fullyPaid: requestDetails.fullyPaid,
        items: detailedItems,
      });
    } catch (err) {
      console.error("Error fetching expense details:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleItemToPay = (itemIndex: bigint) => {
    setItemsToPay(prev => 
      prev.includes(itemIndex) ? prev.filter(idx => idx !== itemIndex) : [...prev, itemIndex]
    );
  };

  const calculateTotalToPay = () => {
    if (!selectedExpense) return BigInt(0);
    return itemsToPay.reduce((sum, itemIndex) => {
      const item = selectedExpense.items[Number(itemIndex)];
      if (item && !item.paid) {
        return sum + item.amount;
      }
      return sum;
    }, BigInt(0));
  };

  const handlePayment = async () => {
    if (!selectedExpense || itemsToPay.length === 0 || !walletAccount) {
      setPaymentError("No items selected or expense/wallet not available.");
      return;
    }
    if (currentChainId !== passetHub.id) {
      alert(`Please switch to the ${getChainName(passetHub.id)} network to make payments.`);
      try {
        await switchChain(passetHub.id);
      } catch (err) {
        setPaymentError(`Failed to switch to ${getChainName(passetHub.id)}. Error: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    setPaymentStep('approving');
    setPaymentError(null);
    const totalToPay = calculateTotalToPay();
    const totalToPayString = (Number(totalToPay) / 10**6).toString();

    try {
      alert("Please approve the MUSD token spending in your wallet.");
      const approveHash = await approveStableCoin(totalToPayString);
      console.log("Approval transaction hash:", approveHash);
      alert(`Approval submitted (Tx: ${approveHash.substring(0,10)}...). Please wait a moment before the next step.`);
      
      await new Promise(resolve => setTimeout(resolve, 5000)); 

      setPaymentStep('paying');
      alert("Approval likely successful. Now, please confirm the payment transaction in your wallet.");

      const actualItemIdsForContract: bigint[] = itemsToPay.map(index => BigInt(index));

      const payHash = await batchPayItems(selectedExpense.id, actualItemIdsForContract, totalToPayString);
      console.log("Payment transaction hash:", payHash);
      alert(`Payment submitted! Tx: ${payHash.substring(0,10)}...`);
      
      setPaymentStep('success');
      await handleViewDetails(selectedExpense.id);
      await fetchExpenses();
      setItemsToPay([]);

      setTimeout(() => setPaymentStep('idle'), 5000);

    } catch (err) {
      console.error("Payment process error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setPaymentError(`Payment failed: ${errorMsg}`);
      setPaymentStep('error');
    }
  };
  
  if (!walletAccount) {
    return <div className="p-4 text-center text-slate-600">Please connect your wallet to view payer dashboard.</div>;
  }
  
  if (currentChainId !== passetHub.id && !isChainSwitching && !isLoading) {
     return (
      <div className="p-4 text-center">
        <p className="text-slate-600 mb-4">
          Payer dashboard operates on the {getChainName(passetHub.id)} network.
        </p>
        <button
          onClick={() => switchChain(passetHub.id)}
          className={buttonClass}
          disabled={isChainSwitching}
        >
          {isChainSwitching ? `Switching to ${getChainName(passetHub.id)}...` : `Switch to ${getChainName(passetHub.id)}`}
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h2 className="text-2xl font-bold text-slate-700 mb-6">Payer Dashboard</h2>
      
      {isLoading && !selectedExpense && <p>Loading expenses...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!selectedExpense ? (
        <>
          <h3 className="text-xl font-semibold text-slate-600 mb-4">Expenses Ready for Your Review</h3>
          {console.log('[Render Check - No Expenses Msg] expenses.length:', expenses.length, '!isLoading:', !isLoading, 'Combined Condition:', (expenses.length === 0 && !isLoading))}
          {(expenses.length === 0 && !isLoading) && <p>No expenses are currently ready for your review.</p>}
          <div className="space-y-4">
            {expenses.map(exp => (
              <div key={exp.id.toString()} className="bg-white shadow rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-lg text-sky-700">{exp.title}</h4>
                    <p className="text-sm text-slate-500">Creator: {exp.creator.substring(0,6)}...{exp.creator.substring(exp.creator.length - 4)}</p>
                    <p className="text-sm text-slate-500">Items: {exp.itemCount.toString()}</p>
                  </div>
                  <button onClick={() => handleViewDetails(exp.id)} className={buttonClass}>
                    View & Pay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white shadow rounded-lg p-6">
          <button onClick={() => { setSelectedExpense(null); setPaymentStep('idle'); setPaymentError(null); }} className={`${secondaryButtonClass} mb-4`}>
            &larr; Back to List
          </button>
          <h3 className="text-xl font-bold text-slate-700 mb-1">{selectedExpense.title}</h3>
          <p className="text-sm text-slate-500">Expense ID: {selectedExpense.id.toString()}</p>
          <p className="text-sm text-slate-500">Creator: {selectedExpense.creator}</p>
          <p className="text-sm text-slate-500">Status: {selectedExpense.fullyPaid ? 'Fully Paid' : selectedExpense.readyToReview ? 'Ready for Review' : 'Pending'}</p>
          <p className="text-sm text-slate-500 mb-4">Total Paid So Far: {(Number(selectedExpense.totalPaidAmount) / 10**6).toFixed(2)} MUSD</p>

          {isLoading && <p>Loading details...</p>}

          <h4 className="text-lg font-semibold text-slate-600 mt-4 mb-2">Items:</h4>
          {selectedExpense.items.length === 0 && <p>No items found for this expense.</p>}
          <div className="space-y-3">
            {selectedExpense.items.map((item, index) => (
              <div key={index} className={`p-3 rounded border ${item.paid ? 'bg-green-50 border-green-200' : itemsToPay.includes(BigInt(index)) ? 'bg-sky-50 border-sky-300' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-700">
                      {item.category || 'Uncategorized'}: {(Number(item.amount) / 10**6).toFixed(2)} MUSD
                    </p>
                    <p className="text-xs text-slate-500">IPFS: {item.ipfsHash.substring(0, 15)}...</p>
                    <p className="text-xs text-slate-400">Added: {new Date(Number(item.timestamp) * 1000).toLocaleDateString()}</p>
                  </div>
                  {!item.paid && (
                    <button 
                      onClick={() => handleToggleItemToPay(BigInt(index))}
                      className={`${itemsToPay.includes(BigInt(index)) ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white text-xs px-2 py-1 rounded`}
                    >
                      {itemsToPay.includes(BigInt(index)) ? 'Deselect' : 'Select to Pay'}
                    </button>
                  )}
                  {item.paid && <span className="text-xs font-semibold text-green-600">PAID</span>}
                </div>
              </div>
            ))}
          </div>

          {(!selectedExpense.fullyPaid && itemsToPay.length > 0) && (
            <div className="mt-6 pt-4 border-t border-slate-200">
              <p className="text-lg font-semibold">
                Total to Pay for Selected Items: {(Number(calculateTotalToPay()) / 10**6).toFixed(2)} MUSD
              </p>
              <button 
                onClick={handlePayment} 
                className={`${buttonClass} mt-3 w-full md:w-auto`}
                disabled={paymentStep === 'approving' || paymentStep === 'paying'}
              >
                {paymentStep === 'approving' && 'Approving MUSD...'}
                {paymentStep === 'paying' && 'Processing Payment...'}
                {(paymentStep !== 'approving' && paymentStep !== 'paying') && 'Approve & Pay Selected Items'}
              </button>
              {paymentError && <p className="text-red-500 mt-2 text-sm">Error: {paymentError}</p>}
              {paymentStep === 'success' && <p className="text-green-500 mt-2 text-sm">Payment successful!</p>}
            </div>
          )}
           {selectedExpense.fullyPaid && (
            <p className="mt-6 text-green-600 font-semibold">This expense is fully paid.</p>
           )}
        </div>
      )}
    </div>
  );
};

export default PayerDashboard; 