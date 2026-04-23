import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { base } from '@reown/appkit/networks';

export function WrongNetworkBanner() {
  const { isConnected } = useAccount();
  const chainId         = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === base.id) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-red-600 px-4 py-2 text-sm font-medium text-white">
      <span>Wrong network — please switch to Base mainnet</span>
      <button
        onClick={() => switchChain({ chainId: base.id })}
        disabled={isPending}
        className="rounded border border-white/40 px-3 py-0.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Switching…' : 'Switch to Base'}
      </button>
    </div>
  );
}
