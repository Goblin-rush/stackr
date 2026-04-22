import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { CURVE_V2_ABI, FACTORY_V2_ADDRESS, FACTORY_V2_ABI, V2_TARGET_REAL_ETH, V2_VIRTUAL_ETH } from '@/lib/contracts';

export interface CurveConstants {
  targetEth: number;
  virtualEthReserve: number;
  virtualTokenReserve: number;
  ready: boolean;
}

const FALLBACK: CurveConstants = {
  targetEth: Number(formatEther(V2_TARGET_REAL_ETH)),
  virtualEthReserve: Number(formatEther(V2_VIRTUAL_ETH)),
  virtualTokenReserve: 1_073_000_000,
  ready: false,
};

let cached: CurveConstants | null = null;

export function useCurveConstants(): CurveConstants {
  const client = usePublicClient();
  const [constants, setConstants] = useState<CurveConstants>(cached ?? FALLBACK);

  useEffect(() => {
    if (cached?.ready) { setConstants(cached); return; }
    if (!client || !FACTORY_V2_ADDRESS) return;

    (async () => {
      try {
        const total = (await client.readContract({
          address: FACTORY_V2_ADDRESS,
          abi: FACTORY_V2_ABI,
          functionName: 'allTokensLength',
        })) as bigint;

        if (total === 0n) return;

        const tokenAddr = (await client.readContract({
          address: FACTORY_V2_ADDRESS,
          abi: FACTORY_V2_ABI,
          functionName: 'allTokens',
          args: [0n],
        })) as `0x${string}`;

        const record = (await client.readContract({
          address: FACTORY_V2_ADDRESS,
          abi: FACTORY_V2_ABI,
          functionName: 'getRecord',
          args: [tokenAddr],
        })) as { curve: `0x${string}` };

        const curveAddr = record.curve;

        const results = await client.multicall({
          contracts: [
            { address: curveAddr, abi: CURVE_V2_ABI, functionName: 'virtualEthReserve' },
            { address: curveAddr, abi: CURVE_V2_ABI, functionName: 'virtualTokenReserve' },
            { address: curveAddr, abi: CURVE_V2_ABI, functionName: 'targetEth' },
          ],
          allowFailure: true,
        });

        const virtualEthBI = results[0].status === 'success' ? (results[0].result as bigint) : V2_VIRTUAL_ETH;
        const virtualTokBI = results[1].status === 'success' ? (results[1].result as bigint) : null;
        const targetEthBI  = results[2].status === 'success' ? (results[2].result as bigint) : V2_TARGET_REAL_ETH;

        const next: CurveConstants = {
          targetEth: Number(formatEther(targetEthBI)),
          virtualEthReserve: Number(formatEther(virtualEthBI)),
          virtualTokenReserve: virtualTokBI ? Number(formatEther(virtualTokBI)) : FALLBACK.virtualTokenReserve,
          ready: true,
        };

        cached = next;
        setConstants(next);
      } catch {
        setConstants({ ...FALLBACK, ready: true });
      }
    })();
  }, [client]);

  return constants;
}
