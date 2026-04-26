import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet } from '@reown/appkit/networks';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

if (!projectId) {
  throw new Error('VITE_WALLETCONNECT_PROJECT_ID is required');
}

export const networks = [mainnet] as [typeof mainnet, ...typeof mainnet[]];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  defaultNetwork: mainnet,
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
  },
  // Explicitly disable Sign-In With X (SIWX) / One-Click Auth so users are
  // not prompted to sign a message after connecting. Phantom mobile in-app
  // browser fails on this prompt with "Error signing message".
  siwx: undefined,
  enableWalletGuide: false,
  enableWallets: true,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#e63946',
    '--w3m-border-radius-master': '4px',
  },
});
