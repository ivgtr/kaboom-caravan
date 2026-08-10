import type { EnemyTypeId } from '../game/data/ids';
import { runtimeAssetUrl } from '../runtimeAssets';

export type CharacterMotionPose = 'idle' | 'move' | 'anticipation' | 'release';

export type PlayerRigPart = 'smoke-small' | 'smoke-medium' | 'smoke-large';

export interface CharacterMotionAsset {
  source: string;
  /** Y position of the ground line within a single normalized frame. */
  groundAnchor: number;
  displayScale: number;
}

export const MOTION_POSE_CELLS: Readonly<
  Record<CharacterMotionPose, readonly [column: number, row: number]>
> = {
  idle: [0, 0],
  move: [1, 0],
  anticipation: [0, 1],
  release: [1, 1],
};

export const PLAYER_CHASSIS_ART = {
  source: runtimeAssetUrl('assets/animation/veh_player_chassis_v005.png'),
  groundAnchor: 0.843,
  displayScale: 1,
  /** Local coordinates relative to the center X and ground Y of the sprite. */
  wheelAnchors: [
    [-0.3166, -0.0805],
    [0.0332, -0.0805],
  ],
  markerOrbit: 0.027,
  /** Rear rail slots first, then the roof auxiliary cradle. */
  moduleMounts: [
    { x: -0.42, y: -0.415, scale: 0.145, rotation: -3 },
    { x: -0.42, y: -0.325, scale: 0.145, rotation: 2 },
    { x: -0.42, y: -0.235, scale: 0.145, rotation: -2 },
    { x: -0.34, y: -0.655, scale: 0.15, rotation: 0 },
  ],
} as const;

export const PLAYER_RIG_ART = {
  source: runtimeAssetUrl('assets/animation/veh_player_rig_parts_v003.png'),
  cells: {
    'smoke-small': [1, 0],
    'smoke-medium': [0, 1],
    'smoke-large': [1, 1],
  },
} as const satisfies {
  source: string;
  cells: Readonly<Record<PlayerRigPart, readonly [number, number]>>;
};

export const ENEMY_MOTION_ART: Readonly<
  Record<EnemyTypeId, CharacterMotionAsset>
> = {
  basic: {
    source: runtimeAssetUrl('assets/animation/enm_basic_motion_v002.png'),
    groundAnchor: 0.88,
    displayScale: 1,
  },
  rusher: {
    source: runtimeAssetUrl('assets/animation/enm_rusher_motion_v002.png'),
    groundAnchor: 0.87,
    displayScale: 1.08,
  },
  heavy: {
    source: runtimeAssetUrl('assets/animation/enm_heavy_motion_v002.png'),
    groundAnchor: 0.88,
    displayScale: 1.08,
  },
  artillery: {
    source: runtimeAssetUrl('assets/animation/enm_artillery_motion_v002.png'),
    groundAnchor: 0.9,
    displayScale: 1.05,
  },
  bomber: {
    source: runtimeAssetUrl('assets/animation/enm_bomber_motion_v002.png'),
    groundAnchor: 0.89,
    displayScale: 1,
  },
  'kawaii-fortress': {
    source: runtimeAssetUrl(
      'assets/animation/enm_kawaii_fortress_motion_v002.png',
    ),
    groundAnchor: 0.88,
    displayScale: 1.08,
  },
};

export function getMotionFrameSource(
  imageWidth: number,
  imageHeight: number,
  pose: CharacterMotionPose,
): readonly [x: number, y: number, width: number, height: number] {
  const frameWidth = imageWidth / 2;
  const frameHeight = imageHeight / 2;
  const [column, row] = MOTION_POSE_CELLS[pose];
  return [column * frameWidth, row * frameHeight, frameWidth, frameHeight];
}

export function getPlayerRigPartSource(
  imageWidth: number,
  imageHeight: number,
  part: PlayerRigPart,
): readonly [x: number, y: number, width: number, height: number] {
  const cellWidth = imageWidth / 2;
  const cellHeight = imageHeight / 2;
  const [column, row] = PLAYER_RIG_ART.cells[part];
  return [column * cellWidth, row * cellHeight, cellWidth, cellHeight];
}
