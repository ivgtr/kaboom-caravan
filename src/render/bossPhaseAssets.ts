import { runtimeAssetUrl } from '../runtimeAssets';

export type BossPhase = 1 | 2 | 3;

export const BOSS_PHASE_AURA_ART = {
  source: runtimeAssetUrl('assets/animation/boss_phase_aura_v001.png'),
  scaleByPhase: {
    1: 0.33,
    2: 0.45,
    3: 0.58,
  },
  alphaByPhase: {
    1: 0.58,
    2: 0.74,
    3: 0.88,
  },
  rotationSpeedByPhase: {
    1: 0.18,
    2: 0.5,
    3: 0.9,
  },
} as const;

export function getBossPhaseAuraSource(
  imageWidth: number,
  imageHeight: number,
  phase: BossPhase,
): readonly [x: number, y: number, width: number, height: number] {
  const cellWidth = imageWidth / 3;
  const squareSize = Math.min(cellWidth, imageHeight);
  return [
    cellWidth * (phase - 1),
    (imageHeight - squareSize) / 2,
    squareSize,
    squareSize,
  ];
}
