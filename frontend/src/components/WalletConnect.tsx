import React, { useState, useEffect } from "react";
import { useChainSwitcher } from "../hooks/useChainSwitcher";
import { passetHub } from "../utils/viem"; // For default target chain

interface WalletConnectProps {
  onConnect: (account: string) => void;
  className?: string;
}

interface ConnectError extends Error {
  code?: number;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ onConnect, className }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [targetChainId, setTargetChainId] = useState<number>(passetHub.id); // Default to Passet Hub

  const {
    currentChainId,
    switchChain,
    isSwitching,
    error: switchError,
    supportedChains,
    getChainName,
  } = useChainSwitcher();

  useEffect(() => {
    const checkConnection = async () => {
      const ethereum = window.ethereum;
      if (typeof window !== 'undefined' && ethereum) {
        try {
          const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[];
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            onConnect(accounts[0]);
          }
        } catch (err) {
          console.error('Error checking initial connection:', err);
          setConnectError('Failed to check initial wallet connection');
        }
      }
    };
    checkConnection();

    const ethereum = window.ethereum;
    if (typeof window !== 'undefined' && ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        const newAccount = accounts[0] || null;
        setAccount(newAccount);
        if (newAccount) {
          onConnect(newAccount);
        } else {
          console.log("Wallet disconnected");
        }
      };
      ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [onConnect]);

  const handleConnectWallet = async () => {
    const ethereum = window.ethereum;
    if (typeof window === 'undefined' || !ethereum) {
      setConnectError('MetaMask not detected! Please install MetaMask.');
      return;
    }
    setConnectError(null);
    try {
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];
      
      const newAccount = accounts[0];
      if (newAccount) { // Ensure account is not undefined
        setAccount(newAccount);
        onConnect(newAccount);

        if (currentChainId !== targetChainId) {
          await switchChain(targetChainId);
        }
      } else {
        setConnectError('Failed to get accounts. Please try again.');
      }
    } catch (err) {
      const typedError = err as ConnectError;
      console.error('Error connecting to wallet:', typedError);
      setConnectError(typedError.message || 'Failed to connect wallet. Please try again.');
    }
  };

  const handleSwitchChain = async () => {
    await switchChain(targetChainId);
  };

  const disconnectWallet = () => {
    setAccount(null);
  };

  const displayedError = connectError || switchError;
  const currentChainDisplayName = getChainName(currentChainId);
  const targetChainDisplayName = getChainName(targetChainId);

  return (
    <div className={`flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4 ${className || ''}`}>
      {displayedError && <p className="text-red-500 text-sm">Error: {displayedError}</p>}

      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">Chain: {currentChainDisplayName}</span>
        <select 
          value={targetChainId}
          onChange={(e) => setTargetChainId(Number(e.target.value))}
          disabled={isSwitching || !account} // Disable if not connected or switching
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-pink-500 focus:border-pink-500 p-1.5 disabled:opacity-70"
        >
          {supportedChains.map(chain => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
      </div>

      {!account ? (
        <button
          onClick={handleConnectWallet}
          disabled={isSwitching} // Only disable if actively switching during connect attempt (unlikely here)
          className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
        >
          {isSwitching && currentChainId === null ? 'Connecting...' : 'Connect Wallet'} 
        </button>
      ) : (
        <div className="flex items-center space-x-2">
          <span className="text-sm font-mono bg-pink-100 px-2 py-1 rounded-md text-pink-700">
            {`${account.substring(0, 6)}...${account.substring(account.length - 4)}`}
          </span>
          {currentChainId !== targetChainId && (
            <button
              onClick={handleSwitchChain}
              disabled={isSwitching}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition disabled:opacity-50"
            >
              {isSwitching ? 'Switching...' : `Switch to ${targetChainDisplayName}`}
            </button>
          )}
          <button
            onClick={disconnectWallet}
            className="bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg transition text-sm"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;