import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ETH_FACTORY_V4_ADDRESS } from '@/lib/contracts';
import { V4_FACTORY_ABI } from '@/lib/v4-abi';

export function useCreateToken() {
  const { data: hash, isPending, writeContractAsync, error } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  /**
   * Deploy a new token + curve.
   * If `devBuyWei > 0n`, bundles an initial buy in the same tx via
   * `deployTokenWithBuy`. Otherwise calls the cheaper `deployToken`.
   */
  const createToken = async (
    name: string,
    symbol: string,
    metadataURI: string,
    devBuyWei: bigint = 0n,
  ) => {
    if (devBuyWei > 0n) {
      return writeContractAsync({
        address: ETH_FACTORY_V4_ADDRESS,
        abi: V4_FACTORY_ABI,
        functionName: 'deployTokenWithBuy',
        args: [name, symbol, metadataURI, 0n],
        value: devBuyWei,
      });
    }
    return writeContractAsync({
      address: ETH_FACTORY_V4_ADDRESS,
      abi: V4_FACTORY_ABI,
      functionName: 'deployToken',
      args: [name, symbol, metadataURI],
    });
  };

  return {
    createToken,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
    receipt,
  };
}
