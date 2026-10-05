export type WeaponId =
  'machine' | 'scatter' | 'rocket' | 'rail' | 'flame' | 'mine';
export type PickupKind = 'scrap' | 'weapon' | 'shield' | 'magnet';
export type RivalKind =
  'basic' | 'rusher' | 'heavy' | 'bomber' | 'artillery' | 'fortress';
export interface Platform {
  id: number;
  x: number;
  width: number;
  top: number;
  /** Omitted for a flat road; otherwise the top at x + width. */
  endTop?: number;
}
export interface Obstacle {
  id: number;
  x: number;
  width: number;
  height: number;
  top: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  hit: number;
}
export interface Pickup {
  id: number;
  x: number;
  y: number;
  kind: PickupKind;
  weapon?: WeaponId;
  taken: boolean;
}
export interface Rival {
  id: number;
  x: number;
  y: number;
  kind: RivalKind;
  hp: number;
  maxHp: number;
  speed: number;
  age: number;
  defeated: boolean;
  hit: number;
}
export interface Shot {
  id: number;
  x: number;
  y: number;
  endX: number;
  endY: number;
  life: number;
  weapon: WeaponId;
}
export interface Effect {
  id: number;
  x: number;
  y: number;
  kind:
    'jump' | 'recover' | 'land' | 'pickup' | 'hit' | 'burst' | 'guard' | 'pass';
  life: number;
  maxLife: number;
  text?: string;
}
export interface Weapon {
  id: WeaponId;
  level: number;
  cooldown: number;
}
export interface FailureEvidence {
  kind: 'no-input' | 'short' | 'overshot' | 'collision' | 'fall';
  x: number;
  y: number;
  takeoffX: number | null;
  takeoffY: number;
  targetX: number | null;
  targetY: number | null;
  targetEnd: number | null;
}
export interface RunnerState {
  seed: number;
  random: number;
  nextId: number;
  time: number;
  distance: number;
  speed: number;
  status: 'ready' | 'running' | 'paused' | 'over';
  reason: 'gap' | 'wall' | 'obstacle' | 'rival' | null;
  player: {
    y: number;
    vy: number;
    grounded: boolean;
    coyote: number;
    buffer: number;
    invulnerable: number;
    squash: number;
    holding: boolean;
    airHops: 0 | 1;
    lastJumpX: number | null;
    lastJumpY: number;
    flightJumped: boolean;
    flightTarget: Platform | null;
  };
  platforms: Platform[];
  obstacles: Obstacle[];
  pickups: Pickup[];
  rivals: Rival[];
  shots: Shot[];
  effects: Effect[];
  generatedUntil: number;
  chunk: number;
  jumps: number;
  scrap: number;
  passed: number;
  defeated: number;
  shield: number;
  magnet: number;
  weapon: Weapon | null;
  lastWeapon: WeaponId | null;
  weaponLevels: Partial<Record<WeaponId, number>>;
  runLevel: number;
  nextScrapLevel: number;
  failure: FailureEvidence | null;
  deathFeedback: string;
  notice: string;
  noticeTime: number;
}
export const PLAYER_WIDTH = 44;
export const PLAYER_HEIGHT = 36;
export const FIXED_DT = 1 / 120;
export const PIXELS_PER_METRE = 10;
