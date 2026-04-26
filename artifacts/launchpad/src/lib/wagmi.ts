import { wagmiAdapter } from './appkit';

export const config = wagmiAdapter.wagmiConfig;

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
