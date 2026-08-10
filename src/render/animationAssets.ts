import type { EnemyTypeId } from '../game/data/ids';

export type CharacterMotionPose = 'idle' | 'move' | 'anticipation' | 'release';

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

export const PLAYER_MOTION_ART: CharacterMotionAsset = {
  source: '/assets/animation/veh_player_motion_v002.png',
  groundAnchor: 0.89,
  displayScale: 1,
};

export const ENEMY_MOTION_ART: Readonly<
  Record<EnemyTypeId, CharacterMotionAsset>
> = {
  basic: {
    source: '/assets/animation/enm_basic_motion_v002.png',
    groundAnchor: 0.88,
    displayScale: 1,
  },
  rusher: {
    source: '/assets/animation/enm_rusher_motion_v002.png',
    groundAnchor: 0.87,
    displayScale: 1.08,
  },
  heavy: {
    source: '/assets/animation/enm_heavy_motion_v002.png',
    groundAnchor: 0.88,
    displayScale: 1.08,
  },
  artillery: {
    source: '/assets/animation/enm_artillery_motion_v002.png',
    groundAnchor: 0.9,
    displayScale: 1.05,
  },
  bomber: {
    source: '/assets/animation/enm_bomber_motion_v002.png',
    groundAnchor: 0.89,
    displayScale: 1,
  },
  'kawaii-fortress': {
    source: '/assets/animation/enm_kawaii_fortress_motion_v002.png',
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
