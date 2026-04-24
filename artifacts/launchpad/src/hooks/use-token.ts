import { useReadContracts, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { TOKEN_V3_ABI } from '@/lib/contracts';
import { maxUint256 } from 'viem';

export function useToken(tokenAddress: `0x${string}`, _curveAddress?: `0x${string}`) {
  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { address: tokenAddress, abi: TOKEN_V3_ABI, functionName: 'name' },
      { address: tokenAddress, abi: TOKEN_V3_ABI, functionName: 'symbol' },
      { address: tokenAddress, abi: TOKEN_V3_ABI, functionName: 'totalSupply' },
    ],
    query: { enabled: !!tokenAddress, refetchInterval: 30_000 },
  });

  const [nameRes, symbolRes, totalSupplyRes] = data || [];

  return {
    name:          nameRes?.result as string | undefined,
    symbol:        symbolRes?.result as string | undefined,
    totalSupply:   totalSupplyRes?.result as bigint | undefined,
    realEthRaised: undefined as bigint | undefined,
    graduated:     undefined as boolean | undefined,
    progress:      undefined as bigint | undefined,
    currentPrice:  undefined as bigint | undefined,
    forceClosed:   undefined as boolean | undefined,
    uniswapPair:   undefined as `0x${string}` | undefined,
    isLoading,
    refetch,
  };
}

export function useTokenBalance(tokenAddress: `0x${string}`, userAddress?: `0x${string}`, chainId?: number) {
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: tokenAddress, abi: TOKEN_V3_ABI, functionName: 'balanceOf', args: userAddress ? [userAddress] : undefined },
    ],
    query: { enabled: !!userAddress, refetchInterval: 10_000 },
    ...(chainId ? { chainId } : {}),
  });
  return { data: data?.[0]?.result as bigint | undefined, refetch };
}

export function useTokenPreviewBuy(_curveAddress: `0x${string}` | undefined, _ethAmount: bigint) {
  return { data: undefined as bigint | undefined };
}

export function useTokenPreviewSell(
  _curveAddress: `0x${string}` | undefined,
  _tokenAmount: bigint,
  _sellerAddress?: `0x${string}`,
) {
  return { data: undefined as bigint | undefined };
}

export function useTokenAllowance(
  tokenAddress: `0x${string}` | undefined,
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined,
) {
  const { data, refetch } = useReadContract({
    address: tokenAddress,
    abi: TOKEN_V3_ABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!tokenAddress && !!owner && !!spender },
  });
  return { allowance: data as bigint | undefined, refetch };
}

export function useAntiSnipe(
  _curveAddress: `0x${string}` | undefined,
  _tokenAddress: `0x${string}` | undefined,
  _userAddress: `0x${string}` | undefined,
) {
  return { lastBuyAt: undefined as bigint | undefined, extraBps: undefined as bigint | undefined };
}

export function useTokenTrade() {
  const { data: hash, isPending, writeContractAsync, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  return { writeContractAsync, isPending, isConfirming, isConfirmed, error, hash };
}

export { maxUint256 };
