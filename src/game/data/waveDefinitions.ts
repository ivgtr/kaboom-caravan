import type { EnemyTypeId, WaveId } from './ids';

export interface WaveSpawnDefinition {
  atSeconds: number;
  enemyTypeId: EnemyTypeId;
  position: number;
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
      { atSeconds: 0, enemyTypeId: 'basic', position: 68 },
      { atSeconds: 1.5, enemyTypeId: 'basic', position: 74 },
      { atSeconds: 3, enemyTypeId: 'rusher', position: 80 },
    ],
  },
  'mixed-wave': {
    id: 'mixed-wave',
    displayName: '複合侵攻',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy', position: 72 },
      { atSeconds: 1, enemyTypeId: 'artillery', position: 80 },
      { atSeconds: 2.5, enemyTypeId: 'bomber', position: 84 },
    ],
  },
  'boss-wave': {
    id: 'boss-wave',
    displayName: '移動要塞',
    spawns: [{ atSeconds: 0, enemyTypeId: 'kawaii-fortress', position: 78 }],
  },
  'battle-01-wave': {
    id: 'battle-01-wave',
    displayName: '最初の侵攻',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'basic', position: 68 },
      { atSeconds: 1.8, enemyTypeId: 'basic', position: 74 },
    ],
  },
  'battle-02-wave': {
    id: 'battle-02-wave',
    displayName: '高速接近',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'rusher', position: 70 },
      { atSeconds: 1.4, enemyTypeId: 'rusher', position: 80 },
      { atSeconds: 2.8, enemyTypeId: 'basic', position: 84 },
    ],
  },
  'battle-03-wave': {
    id: 'battle-03-wave',
    displayName: '基本防衛線',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'basic', position: 66 },
      { atSeconds: 1, enemyTypeId: 'basic', position: 74 },
      { atSeconds: 2, enemyTypeId: 'rusher', position: 82 },
      { atSeconds: 3, enemyTypeId: 'basic', position: 86 },
    ],
  },
  'battle-04-wave': {
    id: 'battle-04-wave',
    displayName: '重装の影',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy', position: 70 },
      { atSeconds: 2, enemyTypeId: 'basic', position: 80 },
      { atSeconds: 3.5, enemyTypeId: 'rusher', position: 86 },
    ],
  },
  'battle-05-wave': {
    id: 'battle-05-wave',
    displayName: '遠距離砲撃',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'artillery', position: 76 },
      { atSeconds: 1.2, enemyTypeId: 'basic', position: 70 },
      { atSeconds: 3, enemyTypeId: 'artillery', position: 86 },
    ],
  },
  'battle-06-wave': {
    id: 'battle-06-wave',
    displayName: '爆走注意',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'bomber', position: 70 },
      { atSeconds: 1.4, enemyTypeId: 'rusher', position: 78 },
      { atSeconds: 2.8, enemyTypeId: 'bomber', position: 86 },
      { atSeconds: 4, enemyTypeId: 'heavy', position: 90 },
    ],
  },
  'battle-07-wave': {
    id: 'battle-07-wave',
    displayName: '複合侵攻I',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy', position: 72 },
      { atSeconds: 0.8, enemyTypeId: 'artillery', position: 84 },
      { atSeconds: 2.2, enemyTypeId: 'rusher', position: 78 },
      { atSeconds: 3.4, enemyTypeId: 'bomber', position: 90 },
    ],
  },
  'battle-08-wave': {
    id: 'battle-08-wave',
    displayName: '複合侵攻II',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'artillery', position: 86 },
      { atSeconds: 0.5, enemyTypeId: 'artillery', position: 78 },
      { atSeconds: 1.8, enemyTypeId: 'heavy', position: 72 },
      { atSeconds: 3, enemyTypeId: 'bomber', position: 88 },
      { atSeconds: 4.2, enemyTypeId: 'rusher', position: 92 },
    ],
  },
  'battle-09-wave': {
    id: 'battle-09-wave',
    displayName: '要塞前衛',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy', position: 70 },
      { atSeconds: 1, enemyTypeId: 'heavy', position: 82 },
      { atSeconds: 2, enemyTypeId: 'artillery', position: 90 },
      { atSeconds: 3, enemyTypeId: 'bomber', position: 86 },
      { atSeconds: 4, enemyTypeId: 'rusher', position: 94 },
    ],
  },
  'battle-10-wave': {
    id: 'battle-10-wave',
    displayName: 'カワイイ・フォートレス',
    spawns: [{ atSeconds: 0, enemyTypeId: 'kawaii-fortress', position: 78 }],
  },
};
