import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet } from '@reown/appkit/networks';
import { ReownAuthentication } from '@reown/appkit-siwx';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

if (!projectId) {
  throw new Error('VITE_WALLETCONNECT_PROJECT_ID is required');
}

// Bridge Phantom's EVM provider to window.ethereum so the wagmi injected
// connector can find it. Phantom mobile in-app browser only injects
// window.phantom.ethereum unless the user has set Phantom as their default
// Ethereum wallet (most users haven't), which means the standard injected
// connector finds nothing and the modal falls back to WalletConnect (broken
// when running inside another wallet's in-app browser).
if (typeof window !== 'undefined') {
  const w: any = window;
  if (w.phantom?.ethereum && !w.ethereum) {
    try {
      w.ethereum = w.phantom.ethereum;
    } catch {
      /* read-only on some platforms */
    }
  }
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
  // Configure SIWX (Sign-In With X) as OPTIONAL. The Reown Cloud dashboard
  // has SIWX enabled, which AppKit auto-loads as ReownAuthentication. With
  // `required: false`, the wallet stays connected even if the user denies
  // or fails the sign prompt — important for Phantom mobile in-app browser
  // which throws "Error signing message" on the SIWX prompt. Users can still
  // trade without signing.
  siwx: new ReownAuthentication({ required: false }),
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#e63946',
    '--w3m-border-radius-master': '4px',
  },
});
