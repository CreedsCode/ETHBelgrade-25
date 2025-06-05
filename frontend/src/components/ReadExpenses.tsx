import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import OnChainExpensesABI from '../abi/OnChainExpenses.json';

interface ExpenseItem {
  ipfsHash: string;
  amount: bigint;
  category: string;
  paid: boolean;
  timestamp: bigint;
}

interface ExpenseRequest {
  id: number;
  title: string;
  creator: string;
  payer: string;
  timestamp: bigint;
  readyToReview: boolean;
  fullyPaid: boolean;
  totalPaidAmount: bigint;
  itemCount: bigint;
}

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// Create a public client
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
});

export default function ReadExpenses() {
  const [address, setAddress] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [expenseItems, setExpenseItems] = useState<{ [key: number]: ExpenseItem[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get connected wallet address
  useEffect(() => {
    const getAddress = async () => {
      try {
        const accounts = await window.ethereum?.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
        }
      } catch (err) {
        console.error('Error getting wallet address:', err);
        setError('Failed to connect wallet');
      }
    };

    getAddress();
  }, []);

  // Fetch expenses for the current user (as creator)
  const fetchCreatorExpenses = async () => {
    if (!address) return;

    try {
      const expenseIds = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: OnChainExpensesABI,
        functionName: 'getCreatorExpenses',
        args: [address],
      });

      const expensePromises = (expenseIds as bigint[]).map(async (id) => {
        const expense = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: OnChainExpensesABI,
          functionName: 'getExpenseRequest',
          args: [id],
        });

        const [title, creator, payer, timestamp, readyToReview, fullyPaid, totalPaidAmount, itemCount] = expense as [string, string, string, bigint, boolean, boolean, bigint, bigint];

        return {
          id: Number(id),
          title,
          creator,
          payer,
          timestamp,
          readyToReview,
          fullyPaid,
          totalPaidAmount,
          itemCount,
        };
      });

      const fetchedExpenses = await Promise.all(expensePromises);
      setExpenses(fetchedExpenses);

      // Fetch items for each expense
      const itemsPromises = fetchedExpenses.map(async (expense) => {
        const items = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: OnChainExpensesABI,
          functionName: 'getAllExpenseItems',
          args: [BigInt(expense.id)],
        });

        const [ipfsHashes, amounts, categories, paidStatus, timestamps] = items as [string[], bigint[], string[], boolean[], bigint[]];

        return {
          id: expense.id,
          items: ipfsHashes.map((hash, index) => ({
            ipfsHash: hash,
            amount: amounts[index],
            category: categories[index],
            paid: paidStatus[index],
            timestamp: timestamps[index],
          })),
        };
      });

      const fetchedItems = await Promise.all(itemsPromises);
      const itemsMap = fetchedItems.reduce((acc, { id, items }) => {
        acc[id] = items;
        return acc;
      }, {} as { [key: number]: ExpenseItem[] });

      setExpenseItems(itemsMap);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  // Fetch expenses ready for review (as payer)
  const fetchPayerExpenses = async () => {
    if (!address) return;

    try {
      const expenseIds = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: OnChainExpensesABI,
        functionName: 'getExpensesReadyForReview',
        args: [address],
      });

      const expensePromises = (expenseIds as bigint[]).map(async (id) => {
        const expense = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: OnChainExpensesABI,
          functionName: 'getExpenseRequest',
          args: [id],
        });

        const [title, creator, payer, timestamp, readyToReview, fullyPaid, totalPaidAmount, itemCount] = expense as [string, string, string, bigint, boolean, boolean, bigint, bigint];

        return {
          id: Number(id),
          title,
          creator,
          payer,
          timestamp,
          readyToReview,
          fullyPaid,
          totalPaidAmount,
          itemCount,
        };
      });

      const fetchedExpenses = await Promise.all(expensePromises);
      setExpenses(fetchedExpenses);

      // Fetch items for each expense
      const itemsPromises = fetchedExpenses.map(async (expense) => {
        const items = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: OnChainExpensesABI,
          functionName: 'getAllExpenseItems',
          args: [BigInt(expense.id)],
        });

        const [ipfsHashes, amounts, categories, paidStatus, timestamps] = items as [string[], bigint[], string[], boolean[], bigint[]];

        return {
          id: expense.id,
          items: ipfsHashes.map((hash, index) => ({
            ipfsHash: hash,
            amount: amounts[index],
            category: categories[index],
            paid: paidStatus[index],
            timestamp: timestamps[index],
          })),
        };
      });

      const fetchedItems = await Promise.all(itemsPromises);
      const itemsMap = fetchedItems.reduce((acc, { id, items }) => {
        acc[id] = items;
        return acc;
      }, {} as { [key: number]: ExpenseItem[] });

      setExpenseItems(itemsMap);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      fetchCreatorExpenses();
      fetchPayerExpenses();
    }
  }, [address]);

  if (loading) {
    return <div className="text-center p-4">Loading expenses...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Your Expenses</h2>
      
      {expenses.length === 0 ? (
        <p>No expenses found</p>
      ) : (
        <div className="space-y-4">
          {expenses.map((expense) => (
            <div key={expense.id} className="border rounded-lg p-4">
              <h3 className="text-xl font-semibold">{expense.title}</h3>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <p>Creator: {expense.creator}</p>
                  <p>Payer: {expense.payer}</p>
                  <p>Status: {expense.readyToReview ? 'Ready for Review' : 'Pending'}</p>
                  <p>Fully Paid: {expense.fullyPaid ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p>Total Paid: {expense.totalPaidAmount.toString()} MUSD</p>
                  <p>Items: {expense.itemCount.toString()}</p>
                  <p>Created: {new Date(Number(expense.timestamp) * 1000).toLocaleString()}</p>
                </div>
              </div>

              {expenseItems[expense.id] && (
                <div className="mt-4">
                  <h4 className="font-semibold">Expense Items:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {expenseItems[expense.id].map((item, index) => (
                      <div key={index} className="border rounded p-2">
                        <p>Category: {item.category}</p>
                        <p>Amount: {item.amount.toString()} MUSD</p>
                        <p>Status: {item.paid ? 'Paid' : 'Unpaid'}</p>
                        <p>IPFS Hash: {item.ipfsHash}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 