import type {
  EnemyBehaviorId,
  EnemyTypeId,
  ModuleId,
  WeaponId,
  WaveId,
} from '../data/ids';
import type { WeaponBehavior } from '../data/weaponDefinitions';
import type { WeaponLevel } from '../build/weaponUpgrade';
import type { CombatCoreId } from '../data/combatCoreDefinitions';

import type { BattlefieldObjectiveKind } from '../data/routeDefinitions';

export interface BattlefieldObjectiveState {
  kind: BattlefieldObjectiveKind;
  status: 'active' | 'secured' | 'lost';
  progressSeconds: number;
  remainingSeconds: number;
}

export const SIMULATION_HZ = 60;
export const SIMULATION_STEP_SECONDS = 1 / SIMULATION_HZ;

export type EntityId = string;
export type Movement = -1 | 0 | 1;
export type CombatStatus = 'active' | 'victory' | 'defeat';
export type RiskTier = 'safe' | 'frontline' | 'danger' | 'enemy-territory';
export type WeaponSlot = 'primary' | 'secondary';

export interface WeaponHeatState {
  heat: number;
  overheated: boolean;
}

export interface WeaponHeatStates {
  primary: WeaponHeatState;
  secondary: WeaponHeatState;
}

export interface PlayerCommand {
  move: Movement;
  firePrimary: boolean;
  fireSecondary: boolean;
  activateSkill: boolean;
  boost: boolean;
  activateBreakthrough: boolean;
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
  weaponHeat: WeaponHeatStates;
  energy: number;
  ammo: number;
  primaryCooldown: number;
  secondaryCooldown: number;
  skillCooldown: number;
  parryWindowSeconds: number;
  boosting: boolean;
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
  elite?: boolean;
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

export interface CombatCoreState {
  relaySlot: WeaponSlot | null;
  relaySeconds: number;
  siegeSeconds: number;
  counterSeconds: number;
}

export interface BreakthroughState {
  charge: number;
  remainingSeconds: number;
  hitChargeCooldown: number;
}

export interface FrontlineState {
  position: number;
  pressure: number;
  riskTier: RiskTier;
  rewardMultiplier: number;
}

export interface BuildState {
  coreId?: CombatCoreId;
  primaryWeaponId: WeaponId;
  secondaryWeaponId: WeaponId;
  weaponLevels: Partial<Record<WeaponId, WeaponLevel>>;
  moduleIds: ModuleId[];
}

export type LootKind = 'repair' | 'ammo' | 'weapon-cache';

export interface LootState {
  id: EntityId;
  kind: LootKind;
  previousPosition: number;
  position: number;
  value: number;
  ageSeconds: number;
}

export interface WaveState {
  id: WaveId;
  elapsedSeconds: number;
  nextSpawnIndex: number;
  started: boolean;
  completed: boolean;
}

export type CombatEvent =
  | { type: 'objective-secured'; kind: BattlefieldObjectiveKind }
  | { type: 'objective-lost'; kind: BattlefieldObjectiveKind }
  | { type: 'core-ready'; coreId: CombatCoreId }
  | { type: 'core-triggered'; coreId: CombatCoreId; slot: WeaponSlot }
  | { type: 'breakthrough-ready' }
  | { type: 'breakthrough-activated' }
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
  | {
      type: 'loot-dropped';
      lootId: EntityId;
      kind: LootKind;
      position: number;
      value: number;
    }
  | {
      type: 'loot-collected';
      lootId: EntityId;
      kind: LootKind;
      value: number;
    }
  | { type: 'vehicle-hit'; sourceId: EntityId; damage: number }
  | { type: 'overheated'; slot: WeaponSlot; weaponId: WeaponId }
  | { type: 'cooled'; slot: WeaponSlot; weaponId: WeaponId }
  | { type: 'skill-activated'; skillId: 'reactive-parry' }
  | { type: 'boost-started'; direction: Exclude<Movement, 0> }
  | {
      type: 'attack-parried';
      sourceId: EntityId;
      attackKind: 'contact' | 'projectile';
      counterDamage: number;
    }
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
  breakthrough: BreakthroughState;
  core: CombatCoreState;
  wave?: WaveState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  enemyProjectiles: EnemyProjectileState[];
  loot: LootState[];
  treasureCollected: number;
  eliteEncounter: boolean;
  objective?: BattlefieldObjectiveState;
  events: CombatEvent[];
}

export const IDLE_COMMAND: PlayerCommand = {
  move: 0,
  firePrimary: false,
  fireSecondary: false,
  activateSkill: false,
  boost: false,
  activateBreakthrough: false,
};
