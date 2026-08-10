import type { EnemyTypeId, WaveId } from './ids';

export interface WaveSpawnDefinition {
  atSeconds: number;
  enemyTypeId: EnemyTypeId;
}

export interface WaveDefinition {
  id: WaveId;
  displayName: string;
  spawns: readonly WaveSpawnDefinition[];
}

export const WAVE_DEFINITIONS: Readonly<Record<WaveId, WaveDefinition>> = {
  'prototype-wave': {
    id: 'prototype-wave',
    displayName: '基本侵攻',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'basic' },
      { atSeconds: 1.5, enemyTypeId: 'basic' },
      { atSeconds: 3, enemyTypeId: 'rusher' },
    ],
  },
  'mixed-wave': {
    id: 'mixed-wave',
    displayName: '複合侵攻',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy' },
      { atSeconds: 1, enemyTypeId: 'artillery' },
      { atSeconds: 2.5, enemyTypeId: 'bomber' },
    ],
  },
  'boss-wave': {
    id: 'boss-wave',
    displayName: '移動要塞',
    spawns: [{ atSeconds: 0, enemyTypeId: 'kawaii-fortress' }],
  },
  'battle-01-wave': {
    id: 'battle-01-wave',
    displayName: '最初の侵攻',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'basic' },
      { atSeconds: 1.8, enemyTypeId: 'basic' },
      { atSeconds: 3.2, enemyTypeId: 'basic' },
      { atSeconds: 4.6, enemyTypeId: 'basic' },
    ],
  },
  'battle-02-wave': {
    id: 'battle-02-wave',
    displayName: '高速接近',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'rusher' },
      { atSeconds: 1.4, enemyTypeId: 'rusher' },
      { atSeconds: 2.8, enemyTypeId: 'basic' },
      { atSeconds: 4.2, enemyTypeId: 'rusher' },
      { atSeconds: 5.4, enemyTypeId: 'basic' },
    ],
  },
  'battle-03-wave': {
    id: 'battle-03-wave',
    displayName: '基本防衛線',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'basic' },
      { atSeconds: 1, enemyTypeId: 'basic' },
      { atSeconds: 2, enemyTypeId: 'rusher' },
      { atSeconds: 3, enemyTypeId: 'basic' },
      { atSeconds: 4, enemyTypeId: 'rusher' },
      { atSeconds: 5, enemyTypeId: 'basic' },
      { atSeconds: 6, enemyTypeId: 'rusher' },
      { atSeconds: 6.8, enemyTypeId: 'basic' },
    ],
  },
  'battle-04-wave': {
    id: 'battle-04-wave',
    displayName: '重装の影',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy' },
      { atSeconds: 1, enemyTypeId: 'basic' },
      { atSeconds: 2, enemyTypeId: 'basic' },
      { atSeconds: 3.5, enemyTypeId: 'rusher' },
      { atSeconds: 5, enemyTypeId: 'heavy' },
      { atSeconds: 6, enemyTypeId: 'rusher' },
    ],
  },
  'battle-05-wave': {
    id: 'battle-05-wave',
    displayName: '遠距離砲撃',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'artillery' },
      { atSeconds: 1.2, enemyTypeId: 'basic' },
      { atSeconds: 3, enemyTypeId: 'artillery' },
      { atSeconds: 4.5, enemyTypeId: 'rusher' },
      { atSeconds: 5.5, enemyTypeId: 'basic' },
      { atSeconds: 6.3, enemyTypeId: 'bomber' },
      { atSeconds: 7.2, enemyTypeId: 'artillery' },
    ],
  },
  'battle-06-wave': {
    id: 'battle-06-wave',
    displayName: '爆走注意',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'bomber' },
      { atSeconds: 1.4, enemyTypeId: 'rusher' },
      { atSeconds: 2.1, enemyTypeId: 'basic' },
      { atSeconds: 2.8, enemyTypeId: 'bomber' },
      { atSeconds: 4, enemyTypeId: 'heavy' },
      { atSeconds: 5.5, enemyTypeId: 'artillery' },
      { atSeconds: 6.4, enemyTypeId: 'basic' },
      { atSeconds: 7.2, enemyTypeId: 'rusher' },
    ],
  },
  'battle-07-wave': {
    id: 'battle-07-wave',
    displayName: '複合侵攻I',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy' },
      { atSeconds: 0.8, enemyTypeId: 'artillery' },
      { atSeconds: 1.5, enemyTypeId: 'basic' },
      { atSeconds: 2.2, enemyTypeId: 'rusher' },
      { atSeconds: 3.4, enemyTypeId: 'bomber' },
      { atSeconds: 4.6, enemyTypeId: 'artillery' },
      { atSeconds: 5.4, enemyTypeId: 'basic' },
      { atSeconds: 6.2, enemyTypeId: 'bomber' },
    ],
  },
  'battle-08-wave': {
    id: 'battle-08-wave',
    displayName: '複合侵攻II',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'artillery' },
      { atSeconds: 0.5, enemyTypeId: 'artillery' },
      { atSeconds: 1.8, enemyTypeId: 'heavy' },
      { atSeconds: 3, enemyTypeId: 'bomber' },
      { atSeconds: 4.2, enemyTypeId: 'rusher' },
      { atSeconds: 5.2, enemyTypeId: 'rusher' },
      { atSeconds: 6.2, enemyTypeId: 'heavy' },
      { atSeconds: 7, enemyTypeId: 'basic' },
      { atSeconds: 7.8, enemyTypeId: 'rusher' },
    ],
  },
  'battle-09-wave': {
    id: 'battle-09-wave',
    displayName: '要塞前衛',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy' },
      { atSeconds: 0.5, enemyTypeId: 'basic' },
      { atSeconds: 1, enemyTypeId: 'heavy' },
      { atSeconds: 2, enemyTypeId: 'artillery' },
      { atSeconds: 2.5, enemyTypeId: 'rusher' },
      { atSeconds: 3, enemyTypeId: 'bomber' },
      { atSeconds: 4, enemyTypeId: 'rusher' },
      { atSeconds: 5, enemyTypeId: 'artillery' },
      { atSeconds: 6, enemyTypeId: 'heavy' },
      { atSeconds: 6.5, enemyTypeId: 'basic' },
      { atSeconds: 7, enemyTypeId: 'rusher' },
      { atSeconds: 7.5, enemyTypeId: 'bomber' },
    ],
  },
  'battle-10-wave': {
    id: 'battle-10-wave',
    displayName: 'カワイイ・フォートレス',
    spawns: [{ atSeconds: 0, enemyTypeId: 'kawaii-fortress' }],
  },
};
