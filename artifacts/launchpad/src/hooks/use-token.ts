import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { TOKEN_V2_ABI, CURVE_V2_ABI } from '@/lib/contracts';

export function useToken(tokenAddress: `0x${string}`, curveAddress?: `0x${string}`) {
  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'name' },
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'symbol' },
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'totalSupply' },
      { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'realEthRaised' },
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'graduated' },
      { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'getProgress' },
      { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'currentPrice' },
    ],
    query: { enabled: !!tokenAddress },
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
    refetch,
  };
}

export function useTokenBalance(tokenAddress: `0x${string}`, userAddress?: `0x${string}`) {
  const { data } = useReadContracts({
    contracts: [
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'balanceOf', args: userAddress ? [userAddress] : undefined },
    ],
    query: { enabled: !!userAddress },
  });
  return { data: data?.[0]?.result as bigint | undefined };
}

export function useTokenPreviewBuy(curveAddress: `0x${string}` | undefined, ethAmount: bigint) {
  const { data } = useReadContracts({
    contracts: [
      { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'getBuyAmount', args: [ethAmount] },
    ],
    query: { enabled: !!curveAddress && ethAmount > 0n },
  });
  return { data: data?.[0]?.result as bigint | undefined };
}

export function useTokenPreviewSell(curveAddress: `0x${string}` | undefined, tokenAmount: bigint) {
  const { data } = useReadContracts({
    contracts: [
      { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'getSellAmount', args: [tokenAmount] },
    ],
    query: { enabled: !!curveAddress && tokenAmount > 0n },
  });
  return { data: data?.[0]?.result as bigint | undefined };
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
    hash,
  };
}
