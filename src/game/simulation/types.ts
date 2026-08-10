export const SIMULATION_HZ = 60;
export const SIMULATION_STEP_SECONDS = 1 / SIMULATION_HZ;

export type EntityId = string;
export type WeaponId = 'machine-cannon' | 'railgun';
export type Movement = -1 | 0 | 1;
export type CombatStatus = 'active' | 'victory' | 'defeat';
export type RiskTier = 'safe' | 'frontline' | 'danger' | 'enemy-territory';

export interface PlayerCommand {
  move: Movement;
  firePrimary: boolean;
  fireSecondary: boolean;
  activateSkill: boolean;
}

export interface PlayerState {
  id: EntityId;
  previousPosition: number;
  position: number;
  radius: number;
  hitPoints: number;
  maxHitPoints: number;
  armor: number;
  heat: number;
  energy: number;
  ammo: number;
  primaryCooldown: number;
  secondaryCooldown: number;
  skillCooldown: number;
  overheated: boolean;
}

export interface EnemyState {
  id: EntityId;
  previousPosition: number;
  position: number;
  radius: number;
  hitPoints: number;
  armor: number;
  speed: number;
  contactDamage: number;
  contactCooldown: number;
}

export interface ProjectileState {
  id: EntityId;
  ownerId: EntityId;
  previousPosition: number;
  position: number;
  originPosition: number;
  velocity: number;
  radius: number;
  damage: number;
  maximumRange: number;
  weaponId: WeaponId;
  optimalRangeMinimum: number;
  optimalRangeMaximum: number;
  offRangeDamageMultiplier: number;
}

export interface FrontlineState {
  position: number;
  pressure: number;
  riskTier: RiskTier;
  rewardMultiplier: number;
}

export type CombatEvent =
  | {
      type: 'weapon-fired';
      projectileId: EntityId;
      weaponId: WeaponId;
    }
  | {
      type: 'projectile-hit';
      projectileId: EntityId;
      targetId: EntityId;
      damage: number;
    }
  | { type: 'enemy-killed'; enemyId: EntityId }
  | { type: 'vehicle-hit'; sourceId: EntityId; damage: number }
  | { type: 'overheated' }
  | { type: 'cooled' }
  | { type: 'skill-activated'; skillId: 'emergency-boost' }
  | { type: 'combat-ended'; result: Exclude<CombatStatus, 'active'> };

export interface SimulationState {
  seed: number;
  tick: number;
  nextEntitySequence: number;
  status: CombatStatus;
  player: PlayerState;
  frontline: FrontlineState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  events: CombatEvent[];
}

export const IDLE_COMMAND: PlayerCommand = {
  move: 0,
  firePrimary: false,
  fireSecondary: false,
  activateSkill: false,
};
