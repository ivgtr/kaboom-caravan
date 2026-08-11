import { describe, expect, it } from 'vitest';
import type { WeaponId } from '../game/data/ids';
import {
  BOOST_TRAIL_ART,
  getBoostTrailSource,
  getParryVfxSource,
  getVfxSource,
  MINE_VFX_ART,
  PARRY_VFX_ART,
  VFX_ART,
  WEAPON_VFX_FAMILY,
} from './vfxAssets';

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

  it('uses a dedicated grounded sprite for deployed mines', () => {
    expect(MINE_VFX_ART.source).toBe(
      '/assets/vfx/vfx_mine_deployable_v001.png',
    );
    expect(MINE_VFX_ART.minimumWidth).toBeLessThan(MINE_VFX_ART.maximumWidth);
  });

  it('crops both generated mobility frames from one stable pair sheet', () => {
    expect(BOOST_TRAIL_ART.source).toBe(
      '/assets/vfx/vfx_boost_trail_pair_v001.png',
    );
    expect(getBoostTrailSource(1024, 1024, 'stream')).toEqual([
      0, 256, 512, 512,
    ]);
    expect(getBoostTrailSource(1024, 1024, 'surge')).toEqual([
      512, 256, 512, 512,
    ]);
  });

  it('uses separate generated poses for parry timing and success', () => {
    expect(PARRY_VFX_ART.source).toBe('/assets/vfx/vfx_parry_pair_v001.png');
    expect(getParryVfxSource(1024, 1024, 'ready')).toEqual([0, 256, 512, 512]);
    expect(getParryVfxSource(1024, 1024, 'success')).toEqual([
      512, 256, 512, 512,
    ]);
  });
});
