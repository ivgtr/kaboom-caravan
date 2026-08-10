import type { RiskTier } from './types';

export interface DistanceProfile {
  optimalMinimum: number;
  optimalMaximum: number;
  offRangeDamageMultiplier: number;
}

export function getDistanceDamageMultiplier(
  distance: number,
  profile: DistanceProfile,
): number {
  return distance >= profile.optimalMinimum &&
    distance <= profile.optimalMaximum
    ? 1
    : profile.offRangeDamageMultiplier;
}

export function getRiskTier(position: number): RiskTier {
  if (position < 25) return 'safe';
  if (position < 45) return 'frontline';
  if (position < 65) return 'danger';
  return 'enemy-territory';
}

export function getRewardMultiplier(riskTier: RiskTier): number {
  switch (riskTier) {
    case 'safe':
      return 1;
    case 'frontline':
      return 1.3;
    case 'danger':
      return 1.7;
    case 'enemy-territory':
      return 2.5;
  }
}
