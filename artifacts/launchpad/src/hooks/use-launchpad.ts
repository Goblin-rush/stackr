import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { FACTORY_ABI, FACTORY_ADDRESS } from '@/lib/contracts';

export function useCreateToken() {
  const { data: hash, isPending, writeContractAsync, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const createToken = async (name: string, symbol: string) => {
    return writeContractAsync({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'createToken',
      args: [name, symbol],
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
