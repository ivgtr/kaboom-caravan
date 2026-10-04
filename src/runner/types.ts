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
}
export interface Obstacle {
  id: number;
  x: number;
  width: number;
  height: number;
  top: number;
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
  kind: 'jump' | 'land' | 'pickup' | 'hit' | 'burst' | 'pass';
  life: number;
  maxLife: number;
  text?: string;
}
export interface Weapon {
  id: WeaponId;
  level: number;
  remaining: number;
  cooldown: number;
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
  notice: string;
  noticeTime: number;
}
export const PLAYER_WIDTH = 50;
export const PLAYER_HEIGHT = 36;
export const FIXED_DT = 1 / 120;
export const PIXELS_PER_METRE = 10;
