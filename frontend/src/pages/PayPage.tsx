import React, { useState, useCallback, useEffect } from 'react';
import NavBar from '../components/NavBar';
import { useExpenses } from '../hooks/useExpenses';
import { formatCurrency } from '../integrations/FriendDashboard/utils/formatters';
import { ethers } from 'ethers';

// Define interfaces based on contract return types
interface ExpenseRequestDetails {
  id: bigint; // We'll add the ID manually when processing
  title: string;
  creator: string; // address
  payer: string;   // address
  timestamp: bigint;
  readyToReview: boolean;
  fullyPaid: boolean;
  totalPaidAmount: bigint;
  itemCount: bigint;
}

// Placeholder for individual item details, will be expanded later
interface ExpenseItem {
  id: number; // Index-based ID from the array
  ipfsHash: string;
  amount: bigint;
  category: string;
  paid: boolean;
  timestamp: bigint;
}

const PayPage: React.FC = () => {
  const [payPageWalletAccount, setPayPageWalletAccount] = useState<string | null>(null);
  const { getExpensesReadyForReview, getExpenseRequest, getAllExpenseItems, approveStableCoin, batchPayItems } = useExpenses();

  const [expensesForPayer, setExpensesForPayer] = useState<ExpenseRequestDetails[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequestDetails | null>(null);
  const [selectedExpenseItems, setSelectedExpenseItems] = useState<ExpenseItem[]>([]);
  const [itemsToPay, setItemsToPay] = useState<bigint[]>([]); // Array of item indices (bigint for consistency if contract returns them as such for IDs)
  const [calculatedTotal, setCalculatedTotal] = useState<bigint>(BigInt(0));

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<'idle' | 'approving' | 'approved' | 'error' | 'allowance_sufficient'>('idle');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'paying' | 'paid' | 'error'>('idle');

  const handlePayPageWalletConnect = useCallback((account: string) => {
    setPayPageWalletAccount(account);
    console.log('Wallet connected on PayPage:', account);
  }, []);

  // Fetch expenses ready for review by the connected payer
  useEffect(() => {
    const fetchExpenses = async () => {
      if (!payPageWalletAccount) {
        setExpensesForPayer([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        console.log("Fetching expenses ready for review for payer:", payPageWalletAccount);
        const readyExpenseIds = await getExpensesReadyForReview(payPageWalletAccount);
        console.log("Ready expense IDs:", readyExpenseIds);

        if (readyExpenseIds && readyExpenseIds.length > 0) {
          const detailedExpensesPromises = readyExpenseIds.map(async (id: bigint) => {
            const details = await getExpenseRequest(id);
            // The getExpenseRequest returns a tuple (array), map it to our interface
            return {
              id: id, // Add the id here
              title: details[0],
              creator: details[1],
              payer: details[2],
              timestamp: details[3],
              readyToReview: details[4],
              fullyPaid: details[5],
              totalPaidAmount: details[6],
              itemCount: details[7],
            } as ExpenseRequestDetails;
          });
          const resolvedExpenses = await Promise.all(detailedExpensesPromises);
          setExpensesForPayer(resolvedExpenses.filter(exp => !exp.fullyPaid)); // Only show not fully paid
          console.log("Fetched detailed expenses for payer:", resolvedExpenses);
        } else {
          setExpensesForPayer([]);
        }
      } catch (err) {
        console.error("Error fetching expenses for payer:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpenses();
  }, [payPageWalletAccount, getExpensesReadyForReview, getExpenseRequest]); // Added dependencies

  // TODO: Add functions for selecting an expense, fetching its items, selecting items for payment, approve, and pay.

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-800 font-sans">
      <NavBar onWalletConnect={handlePayPageWalletConnect} />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
          <h1 className="text-3xl font-bold text-slate-700 mb-6 text-center">Payer Dashboard - Review & Pay Expenses</h1>
          
          {payPageWalletAccount ? (
            <p className="text-center text-green-500 mb-4">Wallet Connected: {payPageWalletAccount}</p>
          ) : (
            <p className="text-center text-red-500 mb-4">Please connect your wallet to view and pay expenses.</p>
          )}

          {isLoading && <p className="text-center text-blue-500">Loading expenses...</p>}
          {error && <p className="text-center text-red-500">Error: {error}</p>}

          {!isLoading && !error && payPageWalletAccount && (
            <div className="mt-6">
              <h2 className="text-2xl font-semibold text-slate-700 mb-4">Expenses Ready for Your Review ({expensesForPayer.length})</h2>
              {expensesForPayer.length === 0 ? (
                <p className="text-slate-500 text-center">No expenses are currently awaiting your review.</p>
              ) : (
                <div className="space-y-4">
                  {expensesForPayer.map((expense) => (
                    <div key={expense.id.toString()} className="bg-slate-50 p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                      <h3 className="text-xl font-semibold text-sky-700">{expense.title} (ID: {expense.id.toString()})</h3>
                      <p className="text-sm text-slate-600">Creator: {expense.creator}</p>
                      <p className="text-sm text-slate-600">Items: {expense.itemCount.toString()}</p>
                      <p className="text-sm text-slate-600">Total Paid: {formatCurrency(ethers.formatUnits(expense.totalPaidAmount, 6), 'USD', 'USD')} {/* Assuming 6 decimals for MUSD */}</p>
                      <p className="text-sm text-slate-600">Status: {expense.fullyPaid ? 'Fully Paid' : 'Pending Payment'}</p>
                      <button 
                        // onClick={() => handleSelectExpense(expense)} 
                        className="mt-2 px-3 py-1.5 text-xs font-medium bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50"
                        // disabled={isLoading || selectedExpense?.id === expense.id}
                      >
                        View Details & Pay
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TODO: Selected Expense Details Section */}
          {/* TODO: Approval and Payment Section */}

        </div>
      </main>
    </div>
  );
};

export default PayPage; 