import type { WaveId } from './ids';

export interface EncounterDefinition {
  id: string;
  displayName: string;
  waveId: WaveId;
  isBoss: boolean;
}

export const MVP_ENCOUNTERS: readonly EncounterDefinition[] = [
  {
    id: 'battle-01',
    displayName: '最初の侵攻',
    waveId: 'prototype-wave',
    isBoss: false,
  },
  {
    id: 'battle-02',
    displayName: '高速接近',
    waveId: 'prototype-wave',
    isBoss: false,
  },
  {
    id: 'battle-03',
    displayName: '基本防衛線',
    waveId: 'prototype-wave',
    isBoss: false,
  },
  {
    id: 'battle-04',
    displayName: '重装の影',
    waveId: 'mixed-wave',
    isBoss: false,
  },
  {
    id: 'battle-05',
    displayName: '遠距離砲撃',
    waveId: 'mixed-wave',
    isBoss: false,
  },
  {
    id: 'battle-06',
    displayName: '爆走注意',
    waveId: 'mixed-wave',
    isBoss: false,
  },
  {
    id: 'battle-07',
    displayName: '複合侵攻I',
    waveId: 'mixed-wave',
    isBoss: false,
  },
  {
    id: 'battle-08',
    displayName: '複合侵攻II',
    waveId: 'mixed-wave',
    isBoss: false,
  },
  {
    id: 'battle-09',
    displayName: '要塞前衛',
    waveId: 'mixed-wave',
    isBoss: false,
  },
  {
    id: 'battle-10',
    displayName: 'カワイイ・フォートレス',
    waveId: 'boss-wave',
    isBoss: true,
  },
];
