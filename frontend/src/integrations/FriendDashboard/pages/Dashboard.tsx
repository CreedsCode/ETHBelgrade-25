import React from 'react';
import PaymentTable from '../components/PaymentTable';
import { DollarSign } from 'lucide-react';

const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <div className="max-w-4xl w-full">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center mb-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white mr-2">
              <DollarSign size={24} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Tracker</h1>
          </div>
          <p className="text-gray-600 max-w-xl mx-auto">
            Track and monitor payment data across your decentralized knowledge graph
          </p>
        </header>
        
        <PaymentTable />
      </div>
    </div>
  );
};

export default Dashboard; 