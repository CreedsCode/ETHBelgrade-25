import React, { useState, useEffect } from 'react';
import NavBar from './components/NavBar';

function App() {
  const [account, setAccount] = useState<string | null>(null);

  const handleConnect = (connectedAccount: string) => {
    setAccount(connectedAccount);
  };

  // Log account changes to acknowledge its use and for debugging
  useEffect(() => {
    if (account) {
      console.log("Wallet connected in App.tsx:", account);
    } else {
      console.log("Wallet disconnected in App.tsx.");
    }
  }, [account]);

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <NavBar onWalletConnect={handleConnect} />
      <main className="flex flex-col flex-grow justify-center items-center gap-4 py-10 px-4">
        <h1 className="text-2xl font-semibold text-center">
          Viem dApp - Passet Hub Smart Contracts
        </h1>
      </main>
    </div>
  );
}

export default App;
