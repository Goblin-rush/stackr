import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { FACTORY_V3_ADDRESS, FACTORY_V3_ABI } from '@/lib/contracts';

export function useCreateToken() {
  const { data: hash, isPending, writeContractAsync, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const createToken = async (
    name: string,
    symbol: string,
    metadataURI: string,
    devBuyEth?: bigint,
  ) => {
    return writeContractAsync({
      address: FACTORY_V3_ADDRESS,
      abi: FACTORY_V3_ABI,
      functionName: 'createToken',
      args: [name, symbol, metadataURI],
      value: devBuyEth ?? 0n,
    });
  };

  return {
    createToken,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
  };
}
