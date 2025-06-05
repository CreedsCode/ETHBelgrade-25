import React from 'react';
import WalletConnect from './WalletConnect'; // Assuming WalletConnect.tsx is in the same directory

// Define AppView in NavBar as well, or import from App.tsx if App.tsx exports it
// For simplicity here, defining it if not complexly shared
type AppView = 'submitExpense' | 'payerDashboard';

interface NavBarProps {
  onWalletConnect: (account: string) => void;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

const NavBar: React.FC<NavBarProps> = ({ onWalletConnect, currentView, setCurrentView }) => {
  const navButtonClass = (viewName: AppView) => 
    `px-3 py-2 rounded-md text-sm font-medium transition-colors 
    ${currentView === viewName 
      ? 'bg-sky-600 text-white' 
      : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`;

  return (
    <nav className="bg-gray-800 text-white p-4 shadow-md">
      <div className="container mx-auto flex items-center justify-between">
        {/* Logo or App Name - Placeholder */}
        <div className="text-xl font-semibold">
          <button onClick={() => setCurrentView('submitExpense')} className="hover:text-gray-300">
            On-Chain Expenser
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setCurrentView('submitExpense')} 
            className={navButtonClass('submitExpense')}            
          >
            Submit Expense
          </button>
          <button 
            onClick={() => setCurrentView('payerDashboard')} 
            className={navButtonClass('payerDashboard')}
          >
            Payer Dashboard
          </button>
        </div>

        {/* Wallet Connector and Chain Info */}
        <div className="flex items-center space-x-4">
          <WalletConnect onConnect={onWalletConnect} className="text-white" />
          {/* className="text-white" is passed to ensure WalletConnect's internal text elements adapt if they don't have explicit color */}
        </div>

        {/* Future Navigation Links - Placeholder 
        <div className="hidden md:flex space-x-4">
          <a href="/items" className="hover:text-gray-300">Items</a>
          <a href="/profile" className="hover:text-gray-300">Profile</a>
        </div>
        */}
      </div>
    </nav>
  );
};

export default NavBar; 