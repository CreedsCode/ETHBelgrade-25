import { useState, useEffect, useCallback } from 'react';
import { passetHub, iexec, supportedChains } from '../utils/viem'; // Assuming viem.ts is in utils

// Updated ChainConfig to make blockExplorers optional at the type level if necessary,
// or rely on optional chaining for access.
// The individual chain objects (passetHub, iexec) define their own structure.
// supportedChains will have elements of these specific types.
type ChainConfig = typeof passetHub | typeof iexec;

interface ProviderError extends Error {
  code?: number;
}

interface UseChainSwitcherReturn {
  currentChainId: number | null;
  switchChain: (targetChainId: number) => Promise<void>;
  isSwitching: boolean;
  error: string | null;
  supportedChains: Readonly<ChainConfig[]>; // Make it readonly as it shouldn't be mutated
  getChainName: (chainId: number | null) => string;
}

export const useChainSwitcher = (): UseChainSwitcherReturn => {
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getChainFromProvider = useCallback(async (): Promise<number | null> => {
    const ethereum = window.ethereum;
    if (typeof window !== 'undefined' && ethereum) {
      try {
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' }) as string;
        const newChainId = parseInt(chainIdHex, 16);
        setCurrentChainId(newChainId);
        return newChainId;
      } catch (err) {
        console.error("Error fetching chainId:", err);
        setError("Failed to get current chain ID.");
      }
    }
    return null;
  }, []);

  useEffect(() => {
    getChainFromProvider();

    const ethereum = window.ethereum;
    if (typeof window !== 'undefined' && ethereum) {
      const handleChainChanged = (chainIdHex: string) => {
        setCurrentChainId(parseInt(chainIdHex, 16));
        setError(null);
      };

      const handleAccountsChanged = () => {
        getChainFromProvider(); 
      };
      
      ethereum.on('chainChanged', handleChainChanged);
      ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        ethereum.removeListener('chainChanged', handleChainChanged);
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [getChainFromProvider]);

  const switchChain = async (targetChainId: number): Promise<void> => {
    const ethereum = window.ethereum;
    if (typeof window === 'undefined' || !ethereum) {
      setError("Web3 provider is not available. Please install MetaMask or a similar extension.");
      return;
    }
    if (currentChainId === targetChainId) {
      setError(null);
      return;
    }

    setIsSwitching(true);
    setError(null);

    const chain = supportedChains.find((c: ChainConfig) => c.id === targetChainId);
    if (!chain) {
      setError(`Chain with ID ${targetChainId} is not supported.`);
      setIsSwitching(false);
      return;
    }

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (switchError) {
      const typedSwitchError = switchError as ProviderError;
      if (typedSwitchError.code === 4902) {
        try {
          const addChainParams: { 
            chainId: string;
            chainName: string;
            nativeCurrency: ChainConfig['nativeCurrency'];
            rpcUrls: string[]; // Ensure this is string[]
            blockExplorerUrls?: string[];
          } = {
            chainId: `0x${chain.id.toString(16)}`,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [...chain.rpcUrls.default.http], // Spread to create a mutable string[]
          };

          if ('blockExplorers' in chain && chain.blockExplorers?.default?.url) {
            addChainParams.blockExplorerUrls = [chain.blockExplorers.default.url];
          }

          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [addChainParams],
          });
        } catch (addError) {
          const typedAddError = addError as ProviderError;
          console.error("Error adding chain:", typedAddError);
          setError(`Failed to add chain ${chain.name}: ${typedAddError.message || 'Unknown error'}`);
        }
      } else {
        console.error("Error switching chain:", typedSwitchError);
        setError(`Failed to switch to chain ${chain.name}: ${typedSwitchError.message || 'Unknown error'}`);
      }
    } finally {
      setIsSwitching(false);
    }
  };
  
  const getChainName = (chainId: number | null): string => {
    if (chainId === null) return "Chain: N/A";
    const foundChain = supportedChains.find((c: ChainConfig) => c.id === chainId);
    return foundChain ? foundChain.name : "Unsupported Chain";
  };

  return { currentChainId, switchChain, isSwitching, error, supportedChains: supportedChains as Readonly<ChainConfig[]>, getChainName };
}; 