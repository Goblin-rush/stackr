import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { injected, metaMask } from 'wagmi/connectors';

export const config = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [mainnet.id]: http('https://ethereum.publicnode.com'),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
