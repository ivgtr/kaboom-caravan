import type { WeaponId } from './ids';

export type LoadoutId = 'standard' | 'close-range' | 'explosive';

export interface LoadoutDefinition {
  id: LoadoutId;
  displayName: string;
  tagline: string;
  primaryWeaponId: WeaponId;
  secondaryWeaponId: WeaponId;
  unlockId?: string;
}

export const LOADOUT_DEFINITIONS: Readonly<
  Record<LoadoutId, LoadoutDefinition>
> = {
  standard: {
    id: 'standard',
    displayName: 'スタンダード・キャラバン',
    tagline: '安定した連射と近距離迎撃',
    primaryWeaponId: 'machine-cannon',
    secondaryWeaponId: 'scatter-cannon',
  },
  'close-range': {
    id: 'close-range',
    displayName: 'ブレイズ・キャラバン',
    tagline: '接近して散弾と炎を浴びせる',
    primaryWeaponId: 'scatter-cannon',
    secondaryWeaponId: 'flamethrower',
  },
  explosive: {
    id: 'explosive',
    displayName: 'KABOOM・キャラバン',
    tagline: 'ロケットと地雷で敵群を粉砕',
    primaryWeaponId: 'rocket-launcher',
    secondaryWeaponId: 'mine-launcher',
    unlockId: 'loadout-explosive',
  },
};

export const LOADOUT_IDS = Object.keys(LOADOUT_DEFINITIONS) as LoadoutId[];
