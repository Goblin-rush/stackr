import { useAccount, useChainId } from 'wagmi';
import { SUPPORTED_CHAIN_IDS } from '@/lib/contracts';

export function WrongNetworkBanner() {
  const { isConnected } = useAccount();
  const chainId         = useChainId();

  const isSupported = (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
  if (!isConnected || isSupported) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-red-600 px-4 py-2 text-sm font-medium text-white">
      <span>Unsupported network — please switch to Ethereum mainnet</span>
    </div>
  );
}
