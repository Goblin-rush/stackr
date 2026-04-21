import { useQuery } from '@tanstack/react-query';

export function useEthPrice() {
  return useQuery({
    queryKey: ['eth-price'],
    queryFn: async () => {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      if (!res.ok) throw new Error('Failed to fetch ETH price');
      const data = await res.json();
      return data.ethereum.usd as number;
    },
    staleTime: 60000,
  });
}
