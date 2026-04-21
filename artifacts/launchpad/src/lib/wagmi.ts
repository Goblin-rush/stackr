import { http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { createConfig } from '@privy-io/wagmi';

export const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http('https://ethereum.publicnode.com'),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
