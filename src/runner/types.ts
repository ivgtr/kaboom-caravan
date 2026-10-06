export type WeaponId =
  'machine' | 'scatter' | 'rocket' | 'rail' | 'flame' | 'mine';
export type PickupKind = 'scrap' | 'weapon' | 'shield' | 'magnet' | 'chest';
export type AbilityId = 'boost' | 'slam' | 'gold' | 'magnet';
export interface FeverReward {
  kind: AbilityId;
  count: number;
}
export interface FeverReel {
  id: number;
  rewards: FeverReward[];
  revealed: number;
  elapsed: number;
  /** Locked when activated; late queue changes cannot skip a reveal. */
  revealInterval: number;
  jackpot: boolean;
  merged: number;
}
export interface FeverEvent {
  id: number;
  kind:
    | 'chest'
    | 'reward'
    | 'chain'
    | 'rush'
    | 'hyper'
    | 'jackpot'
    | 'slam'
    | 'gold';
  text: string;
  clock: number;
  value: number;
}
export interface FeverState {
  random: number;
  clock: number;
  freeze: number;
  rushTime: number;
  hyperTime: number;
  chain: number;
  chainTime: number;
  multiplier: number;
  goldCharge: number;
  goldChestCooldown: number;
  /** Decaying extra velocity target: each visible reel stop contributes one kick. */
  slotBoost: number;
  slotKickSerial: number;
  slotKickClock: number;
  /** World-time durations; duplicates extend and retrigger, with a hard ceiling. */
  awakening: Record<AbilityId, number>;
  awakeningSerial: Record<AbilityId, number>;
  awakeningSeen: Record<AbilityId, number>;
  abilities: Record<AbilityId, number>;
  reel: FeverReel | null;
  queue: FeverReel[];
  event: FeverEvent | null;
  /** Reward points survive unrelated combat/event notifications. */
  rewardCue: { id: number; value: number; clock: number; text: string } | null;
  queuedJump: boolean;
  queuedRelease: boolean;
}
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
  golden?: boolean;
  hit: number;
}
export interface Pickup {
  id: number;
  x: number;
  y: number;
  kind: PickupKind;
  weapon?: WeaponId;
  taken: boolean;
  earned?: boolean;
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
  golden?: boolean;
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
    | 'jump'
    | 'recover'
    | 'land'
    | 'pickup'
    | 'hit'
    | 'burst'
    | 'guard'
    | 'pass'
    | 'slam'
    | 'gold'
    | 'chest';
  life: number;
  maxLife: number;
  /** Physical radius at emission; visual impact size is independently bounded. */
  radius?: number;
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
  score: number;
  scoreParts: { travel: number; combat: number; loot: number; landing: number };
  bestChain: number;
  maxMultiplier: number;
  peakSpeed: number;
  chestsOpened: number;
  fever: FeverState;
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
    /** Tempo is captured at takeoff; upgrades never alter an existing arc. */
    jumpTempo: number;
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
  courseBag: number[];
  coursePhrase: number;
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
