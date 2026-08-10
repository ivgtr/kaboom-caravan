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
};
