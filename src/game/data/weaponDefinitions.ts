import type { WeaponId } from '../simulation/types';

export interface WeaponDefinition {
  id: WeaponId;
  displayName: string;
  damage: number;
  cooldownSeconds: number;
  projectileSpeed: number;
  maximumRange: number;
  optimalRangeMinimum: number;
  optimalRangeMaximum: number;
  offRangeDamageMultiplier: number;
  ammoCost: number;
  energyCost: number;
  heatGenerated: number;
}

export const WEAPON_DEFINITIONS: Readonly<Record<WeaponId, WeaponDefinition>> =
  {
    'machine-cannon': {
      id: 'machine-cannon',
      displayName: '機関砲',
      damage: 10,
      cooldownSeconds: 0.25,
      projectileSpeed: 60,
      maximumRange: 42,
      optimalRangeMinimum: 12,
      optimalRangeMaximum: 38,
      offRangeDamageMultiplier: 0.55,
      ammoCost: 1,
      energyCost: 2,
      heatGenerated: 8,
    },
    railgun: {
      id: 'railgun',
      displayName: 'レールガン',
      damage: 42,
      cooldownSeconds: 2.2,
      projectileSpeed: 120,
      maximumRange: 78,
      optimalRangeMinimum: 30,
      optimalRangeMaximum: 72,
      offRangeDamageMultiplier: 0.35,
      ammoCost: 2,
      energyCost: 32,
      heatGenerated: 24,
    },
  };
