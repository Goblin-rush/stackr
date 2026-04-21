import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { BONDING_CURVE_ABI } from '@/lib/contracts';
import { formatUnits } from 'viem';

export function useToken(address: `0x${string}`) {
  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { address, abi: BONDING_CURVE_ABI, functionName: 'name' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'symbol' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'totalSupply' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'realEthRaised' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'graduated' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'getProgress' },
      { address, abi: BONDING_CURVE_ABI, functionName: 'currentPrice' },
    ]
  });

  const [
    nameRes, symbolRes, totalSupplyRes,
    realEthRaisedRes, graduatedRes, progressRes, currentPriceRes
  ] = data || [];

  return {
    name: nameRes?.result as string | undefined,
    symbol: symbolRes?.result as string | undefined,
    totalSupply: totalSupplyRes?.result as bigint | undefined,
    realEthRaised: realEthRaisedRes?.result as bigint | undefined,
    graduated: graduatedRes?.result as boolean | undefined,
    progress: progressRes?.result as bigint | undefined,
    currentPrice: currentPriceRes?.result as bigint | undefined,
    isLoading,
    refetch
  };
}

export function useTokenBalance(tokenAddress: `0x${string}`, userAddress?: `0x${string}`) {
  return useReadContract({
    address: tokenAddress,
    abi: BONDING_CURVE_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress
    }
  });
}

export function useTokenPreviewBuy(address: `0x${string}`, ethAmount: bigint) {
  return useReadContract({
    address,
    abi: BONDING_CURVE_ABI,
    functionName: 'getBuyAmount',
    args: [ethAmount],
    query: {
      enabled: ethAmount > 0n
    }
  });
}

export function useTokenPreviewSell(address: `0x${string}`, tokenAmount: bigint) {
  return useReadContract({
    address,
    abi: BONDING_CURVE_ABI,
    functionName: 'getSellAmount',
    args: [tokenAmount],
    query: {
      enabled: tokenAmount > 0n
    }
  });
}

export function useTokenTrade() {
  const { data: hash, isPending, writeContractAsync, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    writeContractAsync,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash
  };
}
