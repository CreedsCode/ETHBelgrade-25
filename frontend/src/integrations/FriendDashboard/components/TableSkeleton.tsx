import React from 'react';

const TableSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse">
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
          {[...Array(3)].map((_, index) => (
            <tr key={index}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableSkeleton; 