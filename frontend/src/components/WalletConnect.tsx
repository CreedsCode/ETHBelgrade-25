"use client";

import React, { useState, useEffect } from "react";
import { useChainSwitcher } from "../hooks/useChainSwitcher";
import { passetHub } from "../utils/viem";

interface WalletConnectProps {
  onConnect: (account: string) => void;
  className?: string;
}

interface ConnectErrorType extends Error {
  code?: number;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ onConnect, className }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [targetChainId, setTargetChainId] = useState<number>(passetHub.id);

  const {
    currentChainId,
    switchChain,
    isSwitching,
    error: hookError,
    supportedChains,
    getChainName,
  } = useChainSwitcher();

  useEffect(() => {
    const checkConnection = async () => {
      const ethereum = window.ethereum;
      if (typeof window !== 'undefined' && ethereum) {
        try {
          const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[];
          if (accounts.length > 0 && accounts[0]) {
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
          console.log("Wallet disconnected from WalletConnect component");
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
      if (newAccount) {
        setAccount(newAccount);
        onConnect(newAccount);
        if (currentChainId !== targetChainId) {
          await switchChain(targetChainId);
        }
      } else {
        setConnectError('Failed to retrieve accounts. Please try again.');
      }
    } catch (err) {
      const typedError = err as ConnectErrorType;
      console.error('Error connecting to wallet:', typedError);
      setConnectError(typedError.message || 'Failed to connect wallet. Please try again.');
    }
  };

  const handleSwitchChain = async () => {
    if (targetChainId === currentChainId) return;
    await switchChain(targetChainId);
  };

  const disconnectWallet = () => {
    setAccount(null);
  };

  const displayedError = connectError || hookError;
  const currentChainDisplayName = getChainName(currentChainId);
  const targetChainDisplayName = getChainName(targetChainId);

  return (
    <div className={`flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4 ${className || ''}`}>
      {displayedError && <p className="text-red-500 text-xs px-2 py-1 bg-red-100 rounded">Error: {displayedError}</p>}

      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium whitespace-nowrap">{currentChainDisplayName}</span>
        {account && (
          <select 
            value={targetChainId}
            onChange={(e) => setTargetChainId(Number(e.target.value))}
            disabled={isSwitching || !account} 
            className="bg-gray-700 border border-gray-600 text-white text-xs rounded-lg focus:ring-pink-500 focus:border-pink-500 p-1.5 disabled:opacity-70 max-w-[150px]"
          >
            {supportedChains.map(chain => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!account ? (
        <button
          onClick={handleConnectWallet}
          disabled={isSwitching && currentChainId === null} 
          className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition disabled:opacity-60 whitespace-nowrap"
        >
          {isSwitching && currentChainId === null ? 'Connecting...' : 'Connect Wallet'} 
        </button>
      ) : (
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono bg-pink-100 px-2 py-1 rounded-md text-pink-700 whitespace-nowrap">
            {`${account.substring(0, 6)}...${account.substring(account.length - 4)}`}
          </span>
          {currentChainId !== targetChainId && (
            <button
              onClick={handleSwitchChain}
              disabled={isSwitching}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition disabled:opacity-60 whitespace-nowrap"
            >
              {isSwitching ? 'Switching...' : `Switch to ${targetChainDisplayName}`}
            </button>
          )}
          <button
            onClick={disconnectWallet}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-3 rounded-lg transition text-sm whitespace-nowrap"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;