import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';

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

export const config = createConfig(
  getDefaultConfig({
    chains: [mainnet],
    transports: {
      [mainnet.id]: http(),
    },
    walletConnectProjectId: projectId,
    appName: 'Stackr',
    appDescription: 'Token Launchpad on Ethereum',
    appUrl: 'https://www.stackr.fun',
    appIcon: 'https://www.stackr.fun/icon.png',
  }),
);

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
