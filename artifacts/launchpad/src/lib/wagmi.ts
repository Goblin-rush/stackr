import { http, fallback } from 'wagmi';
import { base } from 'wagmi/chains';
import { createConfig } from '@privy-io/wagmi';

const BASE_RPC_URL = import.meta.env.VITE_BASE_RPC_URL as string | undefined;

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: BASE_RPC_URL
      ? fallback([http(BASE_RPC_URL), http('https://mainnet.base.org')])
      : http('https://mainnet.base.org'),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
