import React, { useState, useEffect } from 'react';
import { fetchPaymentData } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import TableSkeleton from './TableSkeleton';
import { AlertCircle } from 'lucide-react';

interface PaymentData {
  payerAddress: string;
  totalPaid: string;
  paidExpenses: string;
}

const PaymentTable: React.FC = () => {
  const [paymentData, setPaymentData] = useState<PaymentData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await fetchPaymentData();
        setPaymentData(data);
        setError(null);
      } catch (err) {
        setError('Failed to load payment data. Please try again later.');
        console.error('Error fetching payment data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 w-full">
        <div className="flex items-center justify-center p-4 mb-4 text-red-800 bg-red-50 rounded-lg">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden w-full">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Payment Summary</h2>
        <p className="text-sm text-gray-500 mt-1">Overview of all payments and expenses</p>
      </div>
      
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payer Address
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Paid
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid Expenses
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paymentData.length > 0 ? (
                paymentData.map((item, index) => (
                  <tr 
                    key={index} 
                    className="hover:bg-blue-50 transition-colors duration-150 ease-in-out"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.payerAddress}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-medium">
                        {formatCurrency(item.totalPaid)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-medium">
                        {formatCurrency(item.paidExpenses)}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    No payment data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PaymentTable; 