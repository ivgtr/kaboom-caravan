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
    waveId: 'battle-01-wave',
    isBoss: false,
  },
  {
    id: 'battle-02',
    displayName: '高速接近',
    waveId: 'battle-02-wave',
    isBoss: false,
  },
  {
    id: 'battle-03',
    displayName: '基本防衛線',
    waveId: 'battle-03-wave',
    isBoss: false,
  },
  {
    id: 'battle-04',
    displayName: '重装の影',
    waveId: 'battle-04-wave',
    isBoss: false,
  },
  {
    id: 'battle-05',
    displayName: '遠距離砲撃',
    waveId: 'battle-05-wave',
    isBoss: false,
  },
  {
    id: 'battle-06',
    displayName: '爆走注意',
    waveId: 'battle-06-wave',
    isBoss: false,
  },
  {
    id: 'battle-07',
    displayName: '複合侵攻I',
    waveId: 'battle-07-wave',
    isBoss: false,
  },
  {
    id: 'battle-08',
    displayName: '複合侵攻II',
    waveId: 'battle-08-wave',
    isBoss: false,
  },
  {
    id: 'battle-09',
    displayName: '要塞前衛',
    waveId: 'battle-09-wave',
    isBoss: false,
  },
  {
    id: 'battle-10',
    displayName: 'カワイイ・フォートレス',
    waveId: 'battle-10-wave',
    isBoss: true,
  },
];
