import type { RivalKind, WeaponId } from './types';

export interface WeaponDefinition {
  label: string;
  color: string;
  description: string;
  range: number;
  cadence: number;
  /** A successful scatter breach earns one faster follow-up volley. */
  breachCadence?: number;
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
    label: '連射銃',
    color: '#ffdc74',
    description: '前方へ連射。ライバルも木箱も素早く削る',
    range: 430,
    cadence: 0.18,
    damage: 1,
  },
  scatter: {
    label: '散弾砲',
    color: '#ffa36b',
    description: '近距離の5発散弾。撃破すると素早く次弾',
    range: 260,
    cadence: 0.72,
    breachCadence: 0.46,
    damage: 3,
  },
  rocket: {
    label: 'ロケット',
    color: '#ff7e87',
    description: '遠くから爆発。近くの敵と木箱を巻き込む',
    range: 570,
    cadence: 1.12,
    damage: 4,
  },
  rail: {
    label: '貫通砲',
    color: '#b9a1ff',
    description: '一直線に貫通。並んだ敵と木箱をまとめて撃つ',
    range: 700,
    cadence: 0.92,
    damage: 2.5,
  },
  flame: {
    label: '火炎放射',
    color: '#ffbd63',
    description: '短い扇形を焼き払う。近くの群れに強い',
    range: 210,
    cadence: 0.1,
    damage: 0.8,
  },
  mine: {
    label: '近接ボム',
    color: '#8ce8c5',
    description: '前後の近い相手に自動起爆。飛び越した敵にも',
    range: 135,
    cadence: 0.85,
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
    label: '泥はねバギー',
    color: '#a7cd72',
    width: 40,
    height: 30,
    hp: 2,
    pace: 0.22,
  },
  rusher: {
    label: '突撃バギー',
    color: '#f1bb6e',
    width: 36,
    height: 30,
    hp: 2,
    pace: 0.28,
  },
  heavy: {
    label: '鉄ガエル',
    color: '#9cacc9',
    width: 52,
    height: 40,
    hp: 4,
    pace: 0.19,
  },
  bomber: {
    label: 'ボムビートル',
    color: '#f38f81',
    width: 44,
    height: 34,
    hp: 3,
    pace: 0.2,
  },
  artillery: {
    label: '砂ぼこり砲',
    color: '#bba1d9',
    width: 50,
    height: 38,
    hp: 4,
    pace: 0.2,
  },
  fortress: {
    label: '豆タンク',
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
