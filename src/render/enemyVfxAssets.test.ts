import { describe, expect, it } from 'vitest';
import type { EnemyProjectileVisualId } from '../game/simulation/types';
import { ENEMY_VFX_ART, getEnemyVfxSource } from './enemyVfxAssets';

describe('enemy attack VFX assets', () => {
  it('assigns every hostile projectile visual to an integrated pair', () => {
    const ids: EnemyProjectileVisualId[] = ['spore', 'boss-core', 'boss-burst'];
    expect(Object.keys(ENEMY_VFX_ART).sort()).toEqual(ids.sort());
    for (const asset of Object.values(ENEMY_VFX_ART)) {
      expect(asset.source).toMatch(/_pair_v001\.png$/);
      expect(asset.projectileScale).toBeGreaterThan(0);
      expect(asset.impactScale).toBeGreaterThan(asset.projectileScale);
    }
  });

  it('crops square projectile and impact cells without distortion', () => {
    expect(getEnemyVfxSource(1024, 1024, 'projectile')).toEqual([
      0, 256, 512, 512,
    ]);
    expect(getEnemyVfxSource(1024, 1024, 'impact')).toEqual([
      512, 256, 512, 512,
    ]);
  });
});
