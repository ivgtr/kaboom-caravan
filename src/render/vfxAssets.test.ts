import { describe, expect, it } from 'vitest';
import type { WeaponId } from '../game/data/ids';
import { getVfxSource, VFX_ART, WEAPON_VFX_FAMILY } from './vfxAssets';

describe('VFX assets', () => {
  it('assigns every weapon to one generated visual family', () => {
    const weapons: WeaponId[] = [
      'machine-cannon',
      'scatter-cannon',
      'flamethrower',
      'rocket-launcher',
      'railgun',
      'mine-launcher',
    ];
    expect(Object.keys(WEAPON_VFX_FAMILY).sort()).toEqual(weapons.sort());
    for (const family of Object.values(WEAPON_VFX_FAMILY)) {
      expect(VFX_ART[family]).toBeDefined();
    }
  });

  it('crops square muzzle and impact cells without distorting the pair sheet', () => {
    expect(getVfxSource(1024, 1024, 'muzzle')).toEqual([0, 256, 512, 512]);
    expect(getVfxSource(1024, 1024, 'impact')).toEqual([512, 256, 512, 512]);
  });
});
