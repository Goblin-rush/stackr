import { useReadContracts, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { TOKEN_V2_ABI, CURVE_V2_ABI } from '@/lib/contracts';
import { maxUint256 } from 'viem';

export function useToken(tokenAddress: `0x${string}`, curveAddress?: `0x${string}`) {
  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { address: tokenAddress,  abi: TOKEN_V2_ABI,  functionName: 'name' },
      { address: tokenAddress,  abi: TOKEN_V2_ABI,  functionName: 'symbol' },
      { address: tokenAddress,  abi: TOKEN_V2_ABI,  functionName: 'totalSupply' },
      { address: curveAddress,  abi: CURVE_V2_ABI,  functionName: 'realEthRaised' },
      { address: tokenAddress,  abi: TOKEN_V2_ABI,  functionName: 'graduated' },
      { address: curveAddress,  abi: CURVE_V2_ABI,  functionName: 'progressBps' },
      { address: curveAddress,  abi: CURVE_V2_ABI,  functionName: 'currentPrice' },
      { address: curveAddress,  abi: CURVE_V2_ABI,  functionName: 'forceClosed' },
      { address: tokenAddress,  abi: TOKEN_V2_ABI,  functionName: 'uniswapPair' },
    ],
    query: { enabled: !!tokenAddress, refetchInterval: 8_000 },
  });

  const [
    nameRes, symbolRes, totalSupplyRes,
    realEthRaisedRes, graduatedRes, progressRes, currentPriceRes,
    forceClosedRes, uniswapPairRes,
  ] = data || [];

  return {
    name:          nameRes?.result as string | undefined,
    symbol:        symbolRes?.result as string | undefined,
    totalSupply:   totalSupplyRes?.result as bigint | undefined,
    realEthRaised: realEthRaisedRes?.result as bigint | undefined,
    graduated:     graduatedRes?.result as boolean | undefined,
    progress:      progressRes?.result as bigint | undefined,
    currentPrice:  currentPriceRes?.result as bigint | undefined,
    forceClosed:   forceClosedRes?.result as boolean | undefined,
    uniswapPair:   uniswapPairRes?.result as `0x${string}` | undefined,
    isLoading,
    refetch,
  };
}

export function useTokenBalance(tokenAddress: `0x${string}`, userAddress?: `0x${string}`) {
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'balanceOf', args: userAddress ? [userAddress] : undefined },
    ],
    query: { enabled: !!userAddress, refetchInterval: 10_000 },
  });
  return { data: data?.[0]?.result as bigint | undefined, refetch };
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

export function useTokenPreviewSell(
  curveAddress: `0x${string}` | undefined,
  tokenAmount: bigint,
  sellerAddress?: `0x${string}`,
) {
  const zeroAddr = '0x0000000000000000000000000000000000000000' as `0x${string}`;
  const seller = sellerAddress ?? zeroAddr;
  const { data } = useReadContracts({
    contracts: [
      { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'getSellAmount', args: [tokenAmount, seller] },
    ],
    query: { enabled: !!curveAddress && tokenAmount > 0n },
  });
  return { data: data?.[0]?.result as bigint | undefined };
}

/** Returns current token allowance granted by owner to spender. */
export function useTokenAllowance(
  tokenAddress: `0x${string}` | undefined,
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined,
) {
  const { data, refetch } = useReadContract({
    address: tokenAddress,
    abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!tokenAddress && !!owner && !!spender },
  });
  return { allowance: data as bigint | undefined, refetch };
}

/** Anti-snipe info: lastBuyAt (curve) + antiSnipeBpsFor (token) for a given user. */
export function useAntiSnipe(
  curveAddress: `0x${string}` | undefined,
  tokenAddress: `0x${string}` | undefined,
  userAddress: `0x${string}` | undefined,
) {
  const { data } = useReadContracts({
    contracts: [
      { address: curveAddress, abi: CURVE_V2_ABI, functionName: 'lastBuyAt', args: userAddress ? [userAddress] : undefined },
      { address: tokenAddress, abi: TOKEN_V2_ABI, functionName: 'antiSnipeBpsFor', args: userAddress ? [userAddress] : undefined },
    ],
    query: { enabled: !!curveAddress && !!tokenAddress && !!userAddress },
  });
  const lastBuyAt  = data?.[0]?.result as bigint | undefined;
  const extraBps   = data?.[1]?.result as bigint | undefined;
  return { lastBuyAt, extraBps };
}

export function useTokenTrade() {
  const { data: hash, isPending, writeContractAsync, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  return { writeContractAsync, isPending, isConfirming, isConfirmed, error, hash };
}

export { maxUint256 };
