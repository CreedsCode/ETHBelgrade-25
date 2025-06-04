import { createPublicClient, http, createWalletClient, custom } from 'viem'
import 'viem/window';


const transport = http('https://testnet-passet-hub-eth-rpc.polkadot.io')

// Configure the Passet Hub chain
export const passetHub = {
  id: 420420421,
  name: 'Passet Hub',
  network: 'passet-hub',
  nativeCurrency: {
    decimals: 18,
    name: 'PAS',
    symbol: 'PAS',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
    },
  },
} as const

export const iexec = {
  id: 134,
  name: 'iExec Sidechain',
  network: 'iexec',
  nativeCurrency: {
    decimals: 18,
    name: 'xRLC',
    symbol: 'xRLC',
  },
  rpcUrls: {
    default: {
      http: ["https://bellecour.iex.ec"],
    },
    public: {
      http: ["https://bellecour.iex.ec"],
    },
  },
  blockExplorers: {
    default: { name: "BlockScout", url: "https://blockscout-bellecour.iex.ec/" },
  },
} as const

// Array of all supported chains
export const supportedChains = [passetHub, iexec];

// Create a public client for reading data
export const publicClient = createPublicClient({
  chain: passetHub,
  transport
})

// Create a wallet client for signing transactions
export const getWalletClient = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return createWalletClient({
      chain: passetHub,
      transport: custom(window.ethereum),
      account,
    });
  }
  throw new Error('No Ethereum browser provider detected');
};