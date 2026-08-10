import type { EnemyProjectileVisualId } from '../game/simulation/types';

export type EnemyVfxPose = 'projectile' | 'impact';

export interface EnemyVfxAsset {
  source: string;
  projectileScale: number;
  impactScale: number;
  flightHeightRatio: number;
}

export const ENEMY_VFX_ART: Readonly<
  Record<EnemyProjectileVisualId, EnemyVfxAsset>
> = {
  spore: {
    source: '/assets/vfx/vfx_enemy_spore_pair_v001.png',
    projectileScale: 0.78,
    impactScale: 0.9,
    flightHeightRatio: 0.075,
  },
  'boss-core': {
    source: '/assets/vfx/vfx_enemy_boss_core_pair_v001.png',
    projectileScale: 0.94,
    impactScale: 1.08,
    flightHeightRatio: 0.1,
  },
  'boss-burst': {
    source: '/assets/vfx/vfx_enemy_boss_burst_pair_v001.png',
    projectileScale: 1.08,
    impactScale: 1.28,
    flightHeightRatio: 0.1,
  },
};

export function getEnemyVfxSource(
  imageWidth: number,
  imageHeight: number,
  pose: EnemyVfxPose,
): readonly [x: number, y: number, width: number, height: number] {
  const cellWidth = imageWidth / 2;
  const squareSize = Math.min(cellWidth, imageHeight);
  return [
    pose === 'projectile' ? 0 : cellWidth,
    (imageHeight - squareSize) / 2,
    squareSize,
    squareSize,
  ];
}
