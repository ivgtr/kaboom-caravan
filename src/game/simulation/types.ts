export const SIMULATION_HZ = 60;
export const SIMULATION_STEP_SECONDS = 1 / SIMULATION_HZ;

export type EntityId = string;
export type Movement = -1 | 0 | 1;

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
}

export type CombatEvent =
  | { type: 'weapon-fired'; projectileId: EntityId }
  | {
      type: 'projectile-hit';
      projectileId: EntityId;
      targetId: EntityId;
      damage: number;
    }
  | { type: 'enemy-killed'; enemyId: EntityId }
  | { type: 'vehicle-hit'; sourceId: EntityId; damage: number };

export interface SimulationState {
  seed: number;
  tick: number;
  nextEntitySequence: number;
  player: PlayerState;
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
