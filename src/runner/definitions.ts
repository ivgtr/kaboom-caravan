import type { RivalKind, WeaponId } from './types';

export interface WeaponDefinition {
  label: string;
  color: string;
  description: string;
  range: number;
  cadence: number;
  damage: number;
}

export const WEAPON_ORDER: WeaponId[] = [
  'machine',
  'scatter',
  'rocket',
  'rail',
  'flame',
  'mine',
];

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  machine: {
    label: 'MACHINE',
    color: '#ffdc74',
    description: '前方のライバルへすばやく連射',
    range: 430,
    cadence: 0.18,
    damage: 1,
  },
  scatter: {
    label: 'SCATTER',
    color: '#ffa36b',
    description: '近距離から強い一撃を放つ散弾',
    range: 260,
    cadence: 0.72,
    damage: 3,
  },
  rocket: {
    label: 'ROCKET',
    color: '#ff7e87',
    description: '遠くを狙う重い一発',
    range: 570,
    cadence: 1.5,
    damage: 4,
  },
  rail: {
    label: 'RAIL',
    color: '#b9a1ff',
    description: '遠くまで貫く一撃',
    range: 700,
    cadence: 1.08,
    damage: 2.5,
  },
  flame: {
    label: 'FLAME',
    color: '#ffbd63',
    description: '近距離を連続で焼き払う',
    range: 170,
    cadence: 0.1,
    damage: 0.65,
  },
  mine: {
    label: 'MINE',
    color: '#8ce8c5',
    description: 'すれ違う相手に爆弾を投げる',
    range: 125,
    cadence: 1.2,
    damage: 5,
  },
};

export interface RivalDefinition {
  label: string;
  color: string;
  width: number;
  height: number;
  hp: number;
  pace: number;
}

export const RIVALS: Record<RivalKind, RivalDefinition> = {
  basic: {
    label: 'MUDSKIPPER',
    color: '#a7cd72',
    width: 40,
    height: 30,
    hp: 2,
    pace: 0.22,
  },
  rusher: {
    label: 'ROAD GNASHER',
    color: '#f1bb6e',
    width: 36,
    height: 30,
    hp: 2,
    pace: 0.28,
  },
  heavy: {
    label: 'IRON TOAD',
    color: '#9cacc9',
    width: 52,
    height: 40,
    hp: 4,
    pace: 0.19,
  },
  bomber: {
    label: 'BOOM BUG',
    color: '#f38f81',
    width: 44,
    height: 34,
    hp: 3,
    pace: 0.2,
  },
  artillery: {
    label: 'DUST CANNON',
    color: '#bba1d9',
    width: 50,
    height: 38,
    hp: 4,
    pace: 0.2,
  },
  fortress: {
    label: 'TINY TANK',
    color: '#c3c786',
    width: 62,
    height: 44,
    hp: 6,
    pace: 0.18,
  },
};

export const PICKUP_LABELS = {
  scrap: 'スクラップ',
  weapon: '武器',
  shield: 'シールド',
  magnet: 'スクラップ磁石',
} as const;
