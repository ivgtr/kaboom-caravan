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

// Combat is paced as short attack beats with room to recover between them.
// Each beat asks the player to collapse a small group quickly instead of
// enduring a constant drip-feed of single enemies.
export const WAVE_DEFINITIONS: Readonly<Record<WaveId, WaveDefinition>> = {
  'prototype-wave': {
    id: 'prototype-wave',
    displayName: '基本侵攻',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'basic' },
      { atSeconds: 0.4, enemyTypeId: 'basic' },
      { atSeconds: 2.6, enemyTypeId: 'rusher' },
    ],
  },
  'mixed-wave': {
    id: 'mixed-wave',
    displayName: '複合侵攻',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy' },
      { atSeconds: 0.35, enemyTypeId: 'artillery' },
      { atSeconds: 2.8, enemyTypeId: 'bomber' },
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
      { atSeconds: 0.35, enemyTypeId: 'basic' },
      { atSeconds: 2.4, enemyTypeId: 'basic' },
      { atSeconds: 2.75, enemyTypeId: 'basic' },
    ],
  },
  'battle-02-wave': {
    id: 'battle-02-wave',
    displayName: '高速接近',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'rusher' },
      { atSeconds: 0.35, enemyTypeId: 'rusher' },
      { atSeconds: 2.3, enemyTypeId: 'basic' },
      { atSeconds: 2.65, enemyTypeId: 'rusher' },
      { atSeconds: 4.8, enemyTypeId: 'basic' },
    ],
  },
  'battle-03-wave': {
    id: 'battle-03-wave',
    displayName: '基本防衛線',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'basic' },
      { atSeconds: 0.3, enemyTypeId: 'basic' },
      { atSeconds: 0.65, enemyTypeId: 'rusher' },
      { atSeconds: 2.7, enemyTypeId: 'basic' },
      { atSeconds: 3, enemyTypeId: 'rusher' },
      { atSeconds: 3.35, enemyTypeId: 'basic' },
      { atSeconds: 5.5, enemyTypeId: 'rusher' },
      { atSeconds: 5.8, enemyTypeId: 'basic' },
    ],
  },
  'battle-04-wave': {
    id: 'battle-04-wave',
    displayName: '重装の影',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy' },
      { atSeconds: 0.35, enemyTypeId: 'basic' },
      { atSeconds: 0.7, enemyTypeId: 'basic' },
      { atSeconds: 3.4, enemyTypeId: 'heavy' },
      { atSeconds: 3.8, enemyTypeId: 'rusher' },
      { atSeconds: 4.15, enemyTypeId: 'rusher' },
    ],
  },
  'battle-05-wave': {
    id: 'battle-05-wave',
    displayName: '遠距離砲撃',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'artillery' },
      { atSeconds: 0.35, enemyTypeId: 'basic' },
      { atSeconds: 2.7, enemyTypeId: 'bomber' },
      { atSeconds: 3, enemyTypeId: 'artillery' },
      { atSeconds: 3.35, enemyTypeId: 'rusher' },
      { atSeconds: 5.7, enemyTypeId: 'artillery' },
      { atSeconds: 6, enemyTypeId: 'basic' },
    ],
  },
  'battle-06-wave': {
    id: 'battle-06-wave',
    displayName: '爆走注意',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'bomber' },
      { atSeconds: 0.35, enemyTypeId: 'rusher' },
      { atSeconds: 0.7, enemyTypeId: 'basic' },
      { atSeconds: 2.8, enemyTypeId: 'heavy' },
      { atSeconds: 3.1, enemyTypeId: 'bomber' },
      { atSeconds: 5.1, enemyTypeId: 'artillery' },
      { atSeconds: 5.4, enemyTypeId: 'basic' },
      { atSeconds: 5.7, enemyTypeId: 'rusher' },
    ],
  },
  'battle-07-wave': {
    id: 'battle-07-wave',
    displayName: '複合侵攻I',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy' },
      { atSeconds: 0.3, enemyTypeId: 'artillery' },
      { atSeconds: 0.65, enemyTypeId: 'basic' },
      { atSeconds: 2.7, enemyTypeId: 'rusher' },
      { atSeconds: 3, enemyTypeId: 'bomber' },
      { atSeconds: 5.2, enemyTypeId: 'artillery' },
      { atSeconds: 5.5, enemyTypeId: 'basic' },
      { atSeconds: 5.8, enemyTypeId: 'bomber' },
    ],
  },
  'battle-08-wave': {
    id: 'battle-08-wave',
    displayName: '複合侵攻II',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'artillery' },
      { atSeconds: 0.3, enemyTypeId: 'artillery' },
      { atSeconds: 0.7, enemyTypeId: 'heavy' },
      { atSeconds: 2.8, enemyTypeId: 'bomber' },
      { atSeconds: 3.1, enemyTypeId: 'rusher' },
      { atSeconds: 3.4, enemyTypeId: 'rusher' },
      { atSeconds: 5.7, enemyTypeId: 'heavy' },
      { atSeconds: 6, enemyTypeId: 'basic' },
      { atSeconds: 6.3, enemyTypeId: 'rusher' },
    ],
  },
  'battle-09-wave': {
    id: 'battle-09-wave',
    displayName: '要塞前衛',
    spawns: [
      { atSeconds: 0, enemyTypeId: 'heavy' },
      { atSeconds: 0.25, enemyTypeId: 'basic' },
      { atSeconds: 0.5, enemyTypeId: 'heavy' },
      { atSeconds: 2.4, enemyTypeId: 'artillery' },
      { atSeconds: 2.65, enemyTypeId: 'rusher' },
      { atSeconds: 2.9, enemyTypeId: 'bomber' },
      { atSeconds: 3.15, enemyTypeId: 'rusher' },
      { atSeconds: 5.2, enemyTypeId: 'artillery' },
      { atSeconds: 5.45, enemyTypeId: 'heavy' },
      { atSeconds: 5.7, enemyTypeId: 'basic' },
      { atSeconds: 5.95, enemyTypeId: 'rusher' },
      { atSeconds: 6.2, enemyTypeId: 'bomber' },
    ],
  },
  'battle-10-wave': {
    id: 'battle-10-wave',
    displayName: 'カワイイ・フォートレス',
    spawns: [{ atSeconds: 0, enemyTypeId: 'kawaii-fortress' }],
  },
};
