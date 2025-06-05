import React from 'react';

const PayPage: React.FC = () => {
  return (
    <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
      <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-3xl font-bold text-slate-700 mb-6 text-center">Payment Page</h1>
        <p className="text-center text-slate-600">
          This is the placeholder for the payment functionality.
        </p>
        {/* Wallet connection and payment logic will go here */}
      </div>
    </main>
  );
};

export default PayPage; 