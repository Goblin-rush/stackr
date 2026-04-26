import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet, metaMask } from 'wagmi/connectors';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

if (!projectId) {
  throw new Error('VITE_WALLETCONNECT_PROJECT_ID is required');
}

// Ethereum mainnet RPC. Hardcoded Alchemy endpoint because the wagmi/viem
// default (eth.merkle.io) is rate-limited and frequently fails to return
// account balances, leaving the trade widget stuck at "0.0000 ETH" even when
// the user is fully connected. Read-only key — safe to ship in the client
// bundle. The optional VITE_ETH_RPC_URL env var overrides this if set.
const MAINNET_RPC =
  (import.meta.env.VITE_ETH_RPC_URL as string | undefined) ||
  'https://eth-mainnet.g.alchemy.com/v2/-ukJuDymTWUsoMl6jc041';

// Bridge Phantom's EVM provider to window.ethereum so wagmi's injected
// connector can find it inside the Phantom mobile in-app browser when the
// user hasn't set Phantom as their default Ethereum wallet.
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

const APP_NAME = 'Stackr';
const APP_URL = 'https://www.stackr.fun';
const APP_ICON = 'https://www.stackr.fun/icon.png';
const APP_DESC = 'Token Launchpad on Ethereum';

export const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(MAINNET_RPC),
  },
  connectors: [
    // Catches generic window.ethereum + every EIP-6963 announced wallet
    // (Phantom, Rainbow, Trust, Brave, OKX, etc.).
    injected({ shimDisconnect: true }),
    // MetaMask SDK for mobile deep-linking when not running inside the
    // MetaMask in-app browser.
    metaMask({
      dappMetadata: { name: APP_NAME, url: APP_URL, iconUrl: APP_ICON },
    }),
    coinbaseWallet({
      appName: APP_NAME,
      appLogoUrl: APP_ICON,
    }),
    walletConnect({
      projectId,
      metadata: {
        name: APP_NAME,
        description: APP_DESC,
        url: APP_URL,
        icons: [APP_ICON],
      },
      // Built-in QR code modal — no external UI library needed.
      // CRITICAL: SIWX/SIWE is OFF (we never call .signMessage on connect).
      showQrModal: true,
    }),
  ],
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
