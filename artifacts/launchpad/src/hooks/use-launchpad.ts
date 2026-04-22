import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { FACTORY_V2_ADDRESS, FACTORY_V2_ABI } from '@/lib/contracts';

export function useCreateToken() {
  const { data: hash, isPending, writeContractAsync, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const createToken = async (
    name: string,
    symbol: string,
    metadataURI: string,
    devBuyEth?: string,
  ) => {
    if (!FACTORY_V2_ADDRESS) throw new Error('Factory not deployed');
    const value = devBuyEth && parseFloat(devBuyEth) > 0
      ? parseEther(devBuyEth as `${number}`)
      : undefined;
    return writeContractAsync({
      address: FACTORY_V2_ADDRESS,
      abi: FACTORY_V2_ABI,
      functionName: 'createToken',
      args: [name, symbol, metadataURI],
      value,
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
