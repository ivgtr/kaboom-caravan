import { describe, expect, it } from 'vitest';
import { ENEMY_DEATH_VFX_ART, getEnemyDeathVfxSource } from './deathVfxAssets';

describe('enemy death VFX assets', () => {
  it('registers one reusable pair sheet', () => {
    expect(ENEMY_DEATH_VFX_ART.source).toBe(
      '/assets/vfx/vfx_enemy_death_pair_v001.png',
    );
    expect(ENEMY_DEATH_VFX_ART.bossCoreScale).toBeGreaterThan(
      ENEMY_DEATH_VFX_ART.puffScale,
    );
  });

  it('crops centered square cells', () => {
    expect(getEnemyDeathVfxSource(1024, 512, 'puff')).toEqual([0, 0, 512, 512]);
    expect(getEnemyDeathVfxSource(1024, 512, 'boss-core')).toEqual([
      512, 0, 512, 512,
    ]);
  });
});
