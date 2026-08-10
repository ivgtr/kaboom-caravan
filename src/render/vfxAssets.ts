import type { WeaponId } from '../game/data/ids';
import { runtimeAssetUrl } from '../runtimeAssets';

export type VfxFamily = 'ballistic' | 'energy' | 'fire' | 'explosive';
export type VfxPose = 'muzzle' | 'impact';

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
  const cellWidth = imageWidth / 2;
  const squareSize = Math.min(cellWidth, imageHeight);
  const x = pose === 'muzzle' ? 0 : cellWidth;
  const y = (imageHeight - squareSize) / 2;
  return [x, y, squareSize, squareSize];
}
