import React, { useState } from 'react';
import WalletConnect from './components/WalletConnect'; 

function App() {
  const [account, setAccount] = useState<string | null>(null);

  const handleConnect = (connectedAccount: string) => {
    setAccount(connectedAccount);
  };

  return (
    <section className="min-h-screen bg-white text-black flex flex-col justify-center items-center gap-4 py-10">
      <div>
        {account && <p>Connected to: {account}</p>}
      </div>
      <h1 className="text-2xl font-semibold text-center">
        Viem dApp - Passet Hub Smart Contracts
      </h1>
      <WalletConnect onConnect={handleConnect} />
    </section>
  );
}

export default App;
