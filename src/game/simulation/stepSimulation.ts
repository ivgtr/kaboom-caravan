import type {
  CombatEvent,
  EnemyState,
  PlayerCommand,
  SimulationState,
} from './types';

const PLAYER_SPEED = 12;
const ENEMY_SPEED = 1.5;
const PLAYER_MIN_POSITION = 0;
const PLAYER_MAX_POSITION = 80;
const PRIMARY_RANGE = 40;
const PRIMARY_DAMAGE = 10;
const PRIMARY_COOLDOWN_SECONDS = 0.25;
const PRIMARY_HEAT = 8;
const PASSIVE_COOLING_PER_SECOND = 12;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function findTarget(
  enemies: EnemyState[],
  playerPosition: number,
): EnemyState | undefined {
  return enemies
    .filter(
      (enemy) =>
        enemy.position >= playerPosition &&
        enemy.position - playerPosition <= PRIMARY_RANGE,
    )
    .sort((left, right) => left.position - right.position)[0];
}

export function stepSimulation(
  state: SimulationState,
  command: PlayerCommand,
  deltaSeconds: number,
): SimulationState {
  const events: CombatEvent[] = [];
  const playerPosition = clamp(
    state.player.position + command.move * PLAYER_SPEED * deltaSeconds,
    PLAYER_MIN_POSITION,
    PLAYER_MAX_POSITION,
  );
  const primaryCooldown = Math.max(
    0,
    state.player.primaryCooldown - deltaSeconds,
  );
  let ammo = state.player.ammo;
  let heat = Math.max(
    0,
    state.player.heat - PASSIVE_COOLING_PER_SECOND * deltaSeconds,
  );
  let enemies = state.enemies.map((enemy) => ({
    ...enemy,
    position: Math.max(0, enemy.position - ENEMY_SPEED * deltaSeconds),
  }));
  let nextCooldown = primaryCooldown;

  if (command.firePrimary && primaryCooldown === 0 && ammo > 0 && heat < 100) {
    const target = findTarget(enemies, playerPosition);
    ammo -= 1;
    heat = Math.min(100, heat + PRIMARY_HEAT);
    nextCooldown = PRIMARY_COOLDOWN_SECONDS;
    events.push({ type: 'weapon-fired', targetId: target?.id });

    if (target) {
      enemies = enemies.map((enemy) =>
        enemy.id === target.id
          ? { ...enemy, hitPoints: enemy.hitPoints - PRIMARY_DAMAGE }
          : enemy,
      );
    }
  }

  for (const enemy of enemies) {
    if (enemy.hitPoints <= 0) {
      events.push({ type: 'enemy-killed', enemyId: enemy.id });
    }
  }

  return {
    ...state,
    tick: state.tick + 1,
    player: {
      ...state.player,
      position: playerPosition,
      ammo,
      heat,
      primaryCooldown: nextCooldown,
    },
    enemies: enemies.filter((enemy) => enemy.hitPoints > 0),
    events,
  };
}
