import type { WeaponId } from '../game/data/ids';
import { runtimeAssetUrl } from '../runtimeAssets';

export type VfxFamily = 'ballistic' | 'energy' | 'fire' | 'explosive';
export type VfxPose = 'muzzle' | 'impact';
export type BoostTrailPose = 'stream' | 'surge';
export type ParryVfxPose = 'ready' | 'success';

export interface VfxFamilyAsset {
  source: string;
  /** Horizontal origin of the weapon muzzle within the left cell. */
  muzzleOriginX: number;
  muzzleScale: number;
  impactScale: number;
}

export const MINE_VFX_ART = {
  source: runtimeAssetUrl('assets/vfx/vfx_mine_deployable_v001.png'),
  minimumWidth: 46,
  maximumWidth: 76,
  viewportHeightRatio: 0.11,
  groundOffset: 2,
  deploySeconds: 0.24,
} as const;

export const BOOST_TRAIL_ART = {
  source: runtimeAssetUrl('assets/vfx/vfx_boost_trail_pair_v001.png'),
  frameSeconds: 0.1,
  displayScale: 1.06,
} as const;

export const PARRY_VFX_ART = {
  source: runtimeAssetUrl('assets/vfx/vfx_parry_pair_v001.png'),
  readyScale: 1.22,
  successScale: 1.45,
} as const;

export const VFX_ART: Readonly<Record<VfxFamily, VfxFamilyAsset>> = {
  ballistic: {
    source: runtimeAssetUrl('assets/vfx/vfx_ballistic_pair_v001.png'),
    muzzleOriginX: 0.68,
    muzzleScale: 0.82,
    impactScale: 0.82,
  },
  energy: {
    source: runtimeAssetUrl('assets/vfx/vfx_energy_pair_v001.png'),
    muzzleOriginX: 0.25,
    muzzleScale: 1.02,
    impactScale: 1,
  },
  fire: {
    source: runtimeAssetUrl('assets/vfx/vfx_fire_pair_v001.png'),
    muzzleOriginX: 0.3,
    muzzleScale: 1.08,
    impactScale: 0.96,
  },
  explosive: {
    source: runtimeAssetUrl('assets/vfx/vfx_explosive_pair_v001.png'),
    muzzleOriginX: 0.32,
    muzzleScale: 1,
    impactScale: 1.28,
  },
};

export const WEAPON_VFX_FAMILY: Readonly<Record<WeaponId, VfxFamily>> = {
  'machine-cannon': 'ballistic',
  'scatter-cannon': 'ballistic',
  flamethrower: 'fire',
  'rocket-launcher': 'explosive',
  railgun: 'energy',
  'mine-launcher': 'explosive',
};

export function getVfxSource(
  imageWidth: number,
  imageHeight: number,
  pose: VfxPose,
): readonly [x: number, y: number, width: number, height: number] {
  return getPairVfxSource(imageWidth, imageHeight, pose === 'muzzle' ? 0 : 1);
}

export function getBoostTrailSource(
  imageWidth: number,
  imageHeight: number,
  pose: BoostTrailPose,
): readonly [x: number, y: number, width: number, height: number] {
  return getPairVfxSource(imageWidth, imageHeight, pose === 'stream' ? 0 : 1);
}

export function getParryVfxSource(
  imageWidth: number,
  imageHeight: number,
  pose: ParryVfxPose,
): readonly [x: number, y: number, width: number, height: number] {
  return getPairVfxSource(imageWidth, imageHeight, pose === 'ready' ? 0 : 1);
}

function getPairVfxSource(
  imageWidth: number,
  imageHeight: number,
  cellIndex: 0 | 1,
): readonly [x: number, y: number, width: number, height: number] {
  const cellWidth = imageWidth / 2;
  const squareSize = Math.min(cellWidth, imageHeight);
  const x = cellIndex * cellWidth;
  const y = (imageHeight - squareSize) / 2;
  return [x, y, squareSize, squareSize];
}
