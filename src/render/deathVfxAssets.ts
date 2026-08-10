import { runtimeAssetUrl } from '../runtimeAssets';

export type EnemyDeathVfxPose = 'puff' | 'boss-core';

export const ENEMY_DEATH_VFX_ART = {
  source: runtimeAssetUrl('assets/vfx/vfx_enemy_death_pair_v001.png'),
  puffScale: 0.92,
  bossCoreScale: 1.18,
} as const;

export function getEnemyDeathVfxSource(
  imageWidth: number,
  imageHeight: number,
  pose: EnemyDeathVfxPose,
): readonly [x: number, y: number, width: number, height: number] {
  const cellWidth = imageWidth / 2;
  const squareSize = Math.min(cellWidth, imageHeight);
  return [
    pose === 'puff' ? 0 : cellWidth,
    (imageHeight - squareSize) / 2,
    squareSize,
    squareSize,
  ];
}
