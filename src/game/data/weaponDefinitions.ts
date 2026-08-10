import type { WeaponId, WeaponTag } from './ids';

export type WeaponBehavior =
  'projectile' | 'scatter' | 'flame' | 'rocket' | 'railgun' | 'mine';

export interface WeaponDefinition {
  id: WeaponId;
  displayName: string;
  description: string;
  behavior: WeaponBehavior;
  tags: readonly WeaponTag[];
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
  assetId: string;
}

export const WEAPON_DEFINITIONS: Readonly<Record<WeaponId, WeaponDefinition>> =
  {
    'machine-cannon': {
      id: 'machine-cannon',
      displayName: '機関砲',
      description: '中距離で安定する低消費の連射武器。',
      behavior: 'projectile',
      tags: ['ballistic', 'projectile'],
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
      assetId: 'wpn_machine_cannon',
    },
    'scatter-cannon': {
      id: 'scatter-cannon',
      displayName: '散弾砲',
      description: '接近して複数弾を叩き込む近距離武器。',
      behavior: 'scatter',
      tags: ['ballistic', 'projectile', 'close-range'],
      damage: 7,
      cooldownSeconds: 0.8,
      projectileSpeed: 55,
      maximumRange: 26,
      optimalRangeMinimum: 4,
      optimalRangeMaximum: 18,
      offRangeDamageMultiplier: 0.35,
      ammoCost: 2,
      energyCost: 3,
      heatGenerated: 14,
      assetId: 'wpn_scatter_cannon',
    },
    flamethrower: {
      id: 'flamethrower',
      displayName: '火炎放射器',
      description: '至近距離を焼き払い、Heatを積極的に利用する。',
      behavior: 'flame',
      tags: ['fire', 'heat', 'close-range'],
      damage: 7,
      cooldownSeconds: 0.15,
      projectileSpeed: 38,
      maximumRange: 18,
      optimalRangeMinimum: 2,
      optimalRangeMaximum: 14,
      offRangeDamageMultiplier: 0.4,
      ammoCost: 1,
      energyCost: 2,
      heatGenerated: 10,
      assetId: 'wpn_flamethrower',
    },
    'rocket-launcher': {
      id: 'rocket-launcher',
      displayName: 'ロケットランチャー',
      description: '中長距離へ高威力の爆発弾を発射する。',
      behavior: 'rocket',
      tags: ['explosive', 'projectile'],
      damage: 30,
      cooldownSeconds: 1.35,
      projectileSpeed: 45,
      maximumRange: 64,
      optimalRangeMinimum: 22,
      optimalRangeMaximum: 56,
      offRangeDamageMultiplier: 0.45,
      ammoCost: 3,
      energyCost: 8,
      heatGenerated: 18,
      assetId: 'wpn_rocket_launcher',
    },
    railgun: {
      id: 'railgun',
      displayName: 'レールガン',
      description: '高消費だが長距離で最大性能を発揮する。',
      behavior: 'railgun',
      tags: ['energy', 'long-range', 'projectile'],
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
      assetId: 'wpn_railgun',
    },
    'mine-launcher': {
      id: 'mine-launcher',
      displayName: '地雷射出機',
      description: '後退しながら敵の進路を制御する設置武器。',
      behavior: 'mine',
      tags: ['explosive', 'deployable'],
      damage: 34,
      cooldownSeconds: 1.5,
      projectileSpeed: 22,
      maximumRange: 20,
      optimalRangeMinimum: 6,
      optimalRangeMaximum: 18,
      offRangeDamageMultiplier: 0.65,
      ammoCost: 2,
      energyCost: 5,
      heatGenerated: 9,
      assetId: 'wpn_mine_launcher',
    },
  };
