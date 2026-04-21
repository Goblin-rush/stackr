import { http, fallback } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { createConfig } from '@privy-io/wagmi';

const ALCHEMY_URL = import.meta.env.VITE_ALCHEMY_RPC_URL as string | undefined;

export const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: ALCHEMY_URL
      ? fallback([http(ALCHEMY_URL), http('https://ethereum.publicnode.com')])
      : http('https://ethereum.publicnode.com'),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
