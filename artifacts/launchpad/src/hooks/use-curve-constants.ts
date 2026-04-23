// V3: no bonding curve. This hook now returns static V3 pool constants.
import { V3_BASE_TAX_BPS, V3_REWARD_BPS, V3_PLATFORM_BPS, V3_LP_FEE_BPS } from '@/lib/contracts';

export interface CurveConstants {
  baseTaxBps: number;
  rewardBps: number;
  platformBps: number;
  lpFeeBps: number;
  ready: boolean;
}

const V3_CONSTANTS: CurveConstants = {
  baseTaxBps:   V3_BASE_TAX_BPS,
  rewardBps:    V3_REWARD_BPS,
  platformBps:  V3_PLATFORM_BPS,
  lpFeeBps:     V3_LP_FEE_BPS,
  ready: true,
};

export function useCurveConstants(): CurveConstants {
  return V3_CONSTANTS;
}
