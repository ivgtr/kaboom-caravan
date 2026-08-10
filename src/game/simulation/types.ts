export const SIMULATION_HZ = 60;
export const SIMULATION_STEP_SECONDS = 1 / SIMULATION_HZ;

export type Movement = -1 | 0 | 1;

export interface PlayerCommand {
  move: Movement;
  firePrimary: boolean;
  fireSecondary: boolean;
  activateSkill: boolean;
}

export interface PlayerState {
  position: number;
  hitPoints: number;
  heat: number;
  energy: number;
  ammo: number;
  primaryCooldown: number;
}

export interface EnemyState {
  id: string;
  position: number;
  hitPoints: number;
}

export type CombatEvent =
  | { type: 'weapon-fired'; targetId?: string }
  | { type: 'enemy-killed'; enemyId: string };

export interface SimulationState {
  seed: number;
  tick: number;
  player: PlayerState;
  enemies: EnemyState[];
  events: CombatEvent[];
}

export const IDLE_COMMAND: PlayerCommand = {
  move: 0,
  firePrimary: false,
  fireSecondary: false,
  activateSkill: false,
};
