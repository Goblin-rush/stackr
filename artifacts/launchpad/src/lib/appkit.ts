import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet } from '@reown/appkit/networks';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

if (!projectId) {
  throw new Error('VITE_WALLETCONNECT_PROJECT_ID is required');
}

// Intercept Reown Cloud API responses and force-disable any server-driven
// authentication features. The Reown Cloud dashboard may have SIWX / One-Click
// Auth enabled, which AppKit reads via `remoteFeatures.reownAuthentication`
// and uses to auto-create a sign-in prompt after wallet connect. Phantom
// mobile in-app browser fails this prompt with "Error signing message".
//
// We patch the global fetch to strip `reownAuthentication`, `email`, and
// `socials` from any matching Reown / WalletConnect API responses BEFORE
// AppKit reads them, so SIWX is never initialized client-side regardless of
// the Cloud configuration.
if (typeof window !== 'undefined' && !(window as any).__reownPatched) {
  (window as any).__reownPatched = true;

  // Bridge Phantom's EVM provider to window.ethereum so the wagmi injected
  // connector can find it. Phantom mobile in-app browser only injects
  // window.phantom.ethereum unless the user has set Phantom as their default
  // Ethereum wallet (most users haven't), which means the standard injected
  // connector finds nothing and falls back to WalletConnect (broken in-app).
  const w: any = window;
  if (w.phantom?.ethereum && !w.ethereum) {
    try {
      w.ethereum = w.phantom.ethereum;
    } catch {
      /* read-only on some platforms */
    }
  }
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const input = args[0];
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const res = await origFetch(...args);
    if (
      url &&
      /(reown|walletconnect|web3modal)\.(com|org)/i.test(url) &&
      /(config|features|project)/i.test(url)
    ) {
      try {
        const cloned = res.clone();
        const data = await cloned.json();
        const strip = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          if ('reownAuthentication' in obj) obj.reownAuthentication = false;
          if ('email' in obj) obj.email = false;
          if ('socials' in obj) obj.socials = [];
        };
        strip(data);
        strip(data?.config);
        strip(data?.features);
        strip(data?.config?.features);
        strip(data?.remoteFeatures);
        return new Response(JSON.stringify(data), {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      } catch {
        return res;
      }
    }
    return res;
  };
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
    // Disable Sign-In With X (SIWX) / Reown Authentication. This prevents
    // AppKit from prompting users to sign a message after wallet connect.
    // Phantom mobile in-app browser fails this prompt with
    // "Error signing message". Setting this to false also overrides
    // remoteFeatures.reownAuthentication coming from the Reown Cloud
    // dashboard.
    reownAuthentication: false,
  },
  siwx: undefined,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#e63946',
    '--w3m-border-radius-master': '4px',
  },
});
