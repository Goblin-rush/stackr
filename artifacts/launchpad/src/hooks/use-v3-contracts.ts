import { useChainId } from 'wagmi';
import { getV3Contracts, type V3Contracts } from '@/lib/contracts';

/**
 * Returns the correct V3 contract addresses for the currently connected chain.
 * Falls back to Base mainnet if the chain is not supported.
 */
export function useV3Contracts(): V3Contracts {
  const chainId = useChainId();
  return getV3Contracts(chainId);
}
