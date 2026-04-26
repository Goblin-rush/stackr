import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet, metaMask } from 'wagmi/connectors';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

if (!projectId) {
  throw new Error('VITE_WALLETCONNECT_PROJECT_ID is required');
}

// Mainnet RPC: prefer Alchemy via VITE_BASE_RPC_URL (despite the name, it's
// an Ethereum mainnet endpoint); fall back to a public RPC if missing.
// The default chain RPC (cloudflare-eth.com) is unreliable for balance reads.
const MAINNET_RPC =
  (import.meta.env.VITE_BASE_RPC_URL as string | undefined) ||
  'https://eth.llamarpc.com';

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
