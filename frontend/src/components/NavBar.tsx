import React from 'react';
import WalletConnect from './WalletConnect'; // Assuming WalletConnect.tsx is in the same directory

interface NavBarProps {
  onWalletConnect: (account: string) => void;
  // Add any other props NavBar might need, e.g., for navigation links
}

const NavBar: React.FC<NavBarProps> = ({ onWalletConnect }) => {
  return (
    <nav className="bg-gray-800 text-white p-4 shadow-md">
      <div className="container mx-auto flex items-center justify-between">
        {/* Logo or App Name - Placeholder */}
        <div className="text-xl font-semibold">
          <a href="/">MyDApp</a>
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