import { parseEther } from 'viem';
import { getWalletClient } from '../utils/viem';
import OnChainExpensesABI from '../abi/OnChainExpenses.json';
import ERC20ABI from '../abi/ERC20.json';

const CONTRACT_ADDRESS = "0x3BF50174762538e3111008A38db4Da16C277128F";
const STABLE_COIN_ADDRESS = "0x4e23D8ff1187047854957eaD3c3432aDD6d2dB75";

export function useExpenses() {
  // Create new expense request
  const createExpenseRequest = async (title: string, payer: string) => {
    try {
      const walletClient = await getWalletClient();
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: OnChainExpensesABI,
        functionName: 'createExpenseRequest',
        args: [title, payer],
      });

      return hash;
    } catch (error) {
      console.error('Error creating expense request:', error);
      throw error;
    }
  };

  // Mark expense as ready for review
  const setReadyForReview = async (expenseId: number) => {
    try {
      const walletClient = await getWalletClient();
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: OnChainExpensesABI,
        functionName: 'setReadyForReview',
        args: [BigInt(expenseId)],
      });

      return hash;
    } catch (error) {
      console.error('Error setting expense ready for review:', error);
      throw error;
    }
  };

  // Approve stable coin spending
  const approveStableCoin = async (amount: string) => {
    try {
      const walletClient = await getWalletClient();
      
      const hash = await walletClient.writeContract({
        address: STABLE_COIN_ADDRESS as `0x${string}`,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, parseEther(amount)],
      });

      return hash;
    } catch (error) {
      console.error('Error approving stable coin:', error);
      throw error;
    }
  };

  // Batch pay items
  const batchPayItems = async (expenseId: number, itemIds: number[], totalAmount: string) => {
    try {
      const walletClient = await getWalletClient();
      
      // First approve the stable coin spending
      await approveStableCoin(totalAmount);
      
      // Then batch pay the items
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: OnChainExpensesABI,
        functionName: 'batchPayItems',
        args: [
          BigInt(expenseId),
          itemIds.map(id => BigInt(id)),
          parseEther(totalAmount)
        ],
      });

      return hash;
    } catch (error) {
      console.error('Error batch paying items:', error);
      throw error;
    }
  };

  return {
    createExpenseRequest,
    setReadyForReview,
    batchPayItems,
  };
} 