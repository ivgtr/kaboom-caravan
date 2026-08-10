import { describe, expect, it } from 'vitest';
import type { EnemyTypeId } from '../game/data/ids';
import {
  ENEMY_MOTION_ART,
  getMotionFrameSource,
  getPlayerRigPartSource,
  MOTION_POSE_CELLS,
} from './animationAssets';

describe('character motion assets', () => {
  it('assigns a motion sheet to every enemy type', () => {
    const enemyTypeIds: EnemyTypeId[] = [
      'basic',
      'rusher',
      'heavy',
      'artillery',
      'bomber',
      'kawaii-fortress',
    ];
    expect(Object.keys(ENEMY_MOTION_ART).sort()).toEqual(enemyTypeIds.sort());
    for (const asset of Object.values(ENEMY_MOTION_ART)) {
      expect(asset.source).toMatch(/^\/assets\/animation\/.+_v002\.png$/);
      expect(asset.groundAnchor).toBeGreaterThanOrEqual(0.85);
      expect(asset.groundAnchor).toBeLessThanOrEqual(0.92);
    }
  });

  it('maps the four semantic poses to fixed sheet quadrants', () => {
    expect(MOTION_POSE_CELLS).toEqual({
      idle: [0, 0],
      move: [1, 0],
      anticipation: [0, 1],
      release: [1, 1],
    });
    expect(getMotionFrameSource(1024, 1024, 'release')).toEqual([
      512, 512, 512, 512,
    ]);
    expect(getPlayerRigPartSource(1024, 1024, 'smoke-medium')).toEqual([
      0, 512, 512, 512,
    ]);
  });
});
