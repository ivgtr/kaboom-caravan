import type {
  EnemyBehaviorId,
  EnemyTypeId,
  ModuleId,
  WeaponId,
  WaveId,
} from '../data/ids';
import type { WeaponBehavior } from '../data/weaponDefinitions';

export const SIMULATION_HZ = 60;
export const SIMULATION_STEP_SECONDS = 1 / SIMULATION_HZ;

export type EntityId = string;
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
  velocity: number;
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
  typeId: EnemyTypeId;
  behaviorId: EnemyBehaviorId;
  previousPosition: number;
  position: number;
  radius: number;
  hitPoints: number;
  armor: number;
  speed: number;
  contactDamage: number;
  contactCooldown: number;
  attackRange: number;
  attackDamage: number;
  attackWindupSeconds: number;
  attackCooldownSeconds: number;
  frontlinePressure: number;
  bossPhase?: 1 | 2 | 3;
  entryDestinationPosition?: number;
  attackWindupRemaining?: number;
}

export type EnemyProjectileVisualId = 'spore' | 'boss-core' | 'boss-burst';

export interface EnemyProjectileState {
  id: EntityId;
  ownerId: EntityId;
  previousPosition: number;
  position: number;
  velocity: number;
  radius: number;
  damage: number;
  ageSeconds: number;
  maximumAgeSeconds: number;
  visualId: EnemyProjectileVisualId;
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
  behavior: WeaponBehavior;
  remainingHits: number;
  hitEnemyIds: EntityId[];
  explosionRadius: number;
  ageSeconds: number;
  maximumAgeSeconds: number;
}

export interface FrontlineState {
  position: number;
  pressure: number;
  riskTier: RiskTier;
  rewardMultiplier: number;
}

export interface BuildState {
  primaryWeaponId: WeaponId;
  secondaryWeaponId: WeaponId;
  moduleIds: ModuleId[];
}

export interface WaveState {
  id: WaveId;
  elapsedSeconds: number;
  nextSpawnIndex: number;
  started: boolean;
  completed: boolean;
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
      weaponId: WeaponId;
      damage: number;
    }
  | {
      type: 'enemy-killed';
      enemyId: EntityId;
      enemyTypeId: EnemyTypeId;
    }
  | { type: 'vehicle-hit'; sourceId: EntityId; damage: number }
  | { type: 'overheated' }
  | { type: 'cooled' }
  | { type: 'skill-activated'; skillId: 'emergency-boost' }
  | { type: 'enemy-attack-windup'; enemyId: EntityId }
  | {
      type: 'enemy-contact-released';
      enemyId: EntityId;
      enemyTypeId: EnemyTypeId;
      contactPosition: number;
    }
  | { type: 'enemy-attacked'; enemyId: EntityId }
  | {
      type: 'enemy-projectile-fired';
      enemyId: EntityId;
      projectileId: EntityId;
      visualId: EnemyProjectileVisualId;
    }
  | {
      type: 'enemy-projectile-hit';
      sourceId: EntityId;
      projectileId: EntityId;
      visualId: EnemyProjectileVisualId;
      damage: number;
    }
  | { type: 'wave-started'; waveId: WaveId }
  | { type: 'wave-completed'; waveId: WaveId }
  | { type: 'boss-phase-changed'; bossId: EntityId; phase: 2 | 3 }
  | { type: 'combat-ended'; result: Exclude<CombatStatus, 'active'> };

export interface SimulationState {
  seed: number;
  tick: number;
  nextEntitySequence: number;
  status: CombatStatus;
  build: BuildState;
  player: PlayerState;
  frontline: FrontlineState;
  wave?: WaveState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  enemyProjectiles: EnemyProjectileState[];
  events: CombatEvent[];
}

export const IDLE_COMMAND: PlayerCommand = {
  move: 0,
  firePrimary: false,
  fireSecondary: false,
  activateSkill: false,
};
