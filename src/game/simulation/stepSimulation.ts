import { segmentIntersectsCircle1d } from './collision';
import { resolveDamage } from './damage';
import type {
  CombatEvent,
  EnemyState,
  PlayerCommand,
  ProjectileState,
  SimulationState,
} from './types';

const PLAYER_SPEED = 12;
const PLAYER_MIN_POSITION = 0;
const PLAYER_MAX_POSITION = 80;
const PRIMARY_PROJECTILE_SPEED = 60;
const PRIMARY_RANGE = 40;
const PRIMARY_DAMAGE = 10;
const PRIMARY_COOLDOWN_SECONDS = 0.25;
const PRIMARY_HEAT = 8;
const PASSIVE_COOLING_PER_SECOND = 12;
const ENEMY_CONTACT_COOLDOWN_SECONDS = 1;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function moveEnemies(
  enemies: EnemyState[],
  playerPosition: number,
  playerRadius: number,
  deltaSeconds: number,
): EnemyState[] {
  return enemies.map((enemy) => {
    const contactPosition = playerPosition + playerRadius + enemy.radius;
    return {
      ...enemy,
      previousPosition: enemy.position,
      position: Math.max(
        contactPosition,
        enemy.position - enemy.speed * deltaSeconds,
      ),
      contactCooldown: Math.max(0, enemy.contactCooldown - deltaSeconds),
    };
  });
}

function createPrimaryProjectile(
  state: SimulationState,
  position: number,
): ProjectileState {
  return {
    id: `projectile-${state.nextEntitySequence}`,
    ownerId: state.player.id,
    previousPosition: position,
    position,
    originPosition: position,
    velocity: PRIMARY_PROJECTILE_SPEED,
    radius: 0.2,
    damage: PRIMARY_DAMAGE,
    maximumRange: PRIMARY_RANGE,
  };
}

interface ProjectileResult {
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  events: CombatEvent[];
}

function moveProjectiles(
  projectiles: ProjectileState[],
  enemies: EnemyState[],
  deltaSeconds: number,
): ProjectileResult {
  let nextEnemies = enemies;
  const remainingProjectiles: ProjectileState[] = [];
  const events: CombatEvent[] = [];

  for (const projectile of projectiles) {
    const movedProjectile = {
      ...projectile,
      previousPosition: projectile.position,
      position: projectile.position + projectile.velocity * deltaSeconds,
    };
    const target = nextEnemies
      .filter((enemy) =>
        segmentIntersectsCircle1d(
          movedProjectile.previousPosition,
          movedProjectile.position,
          enemy.position,
          enemy.radius + movedProjectile.radius,
        ),
      )
      .sort((left, right) => left.position - right.position)[0];

    if (target) {
      const damage = resolveDamage(movedProjectile.damage, target.armor);
      nextEnemies = nextEnemies.map((enemy) =>
        enemy.id === target.id
          ? { ...enemy, hitPoints: enemy.hitPoints - damage }
          : enemy,
      );
      events.push({
        type: 'projectile-hit',
        projectileId: projectile.id,
        targetId: target.id,
        damage,
      });
      continue;
    }

    if (
      Math.abs(movedProjectile.position - movedProjectile.originPosition) <=
      movedProjectile.maximumRange
    ) {
      remainingProjectiles.push(movedProjectile);
    }
  }

  return {
    enemies: nextEnemies,
    projectiles: remainingProjectiles,
    events,
  };
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
  let playerHitPoints = state.player.hitPoints;
  const primaryCooldown = Math.max(
    0,
    state.player.primaryCooldown - deltaSeconds,
  );
  let ammo = state.player.ammo;
  let heat = Math.max(
    0,
    state.player.heat - PASSIVE_COOLING_PER_SECOND * deltaSeconds,
  );
  let enemies = moveEnemies(
    state.enemies,
    playerPosition,
    state.player.radius,
    deltaSeconds,
  );
  let projectiles = state.projectiles;
  let nextCooldown = primaryCooldown;
  let nextEntitySequence = state.nextEntitySequence;

  if (command.firePrimary && primaryCooldown === 0 && ammo > 0 && heat < 100) {
    const projectile = createPrimaryProjectile(state, playerPosition + 2.8);
    projectiles = [...projectiles, projectile];
    ammo -= 1;
    heat = Math.min(100, heat + PRIMARY_HEAT);
    nextCooldown = PRIMARY_COOLDOWN_SECONDS;
    nextEntitySequence += 1;
    events.push({ type: 'weapon-fired', projectileId: projectile.id });
  }

  const projectileResult = moveProjectiles(projectiles, enemies, deltaSeconds);
  enemies = projectileResult.enemies;
  projectiles = projectileResult.projectiles;
  events.push(...projectileResult.events);

  enemies = enemies.map((enemy) => {
    const isTouchingPlayer =
      enemy.position <= playerPosition + state.player.radius + enemy.radius;
    if (!isTouchingPlayer || enemy.contactCooldown > 0) return enemy;

    const damage = resolveDamage(enemy.contactDamage, state.player.armor);
    playerHitPoints = Math.max(0, playerHitPoints - damage);
    events.push({ type: 'vehicle-hit', sourceId: enemy.id, damage });
    return { ...enemy, contactCooldown: ENEMY_CONTACT_COOLDOWN_SECONDS };
  });

  for (const enemy of enemies) {
    if (enemy.hitPoints <= 0) {
      events.push({ type: 'enemy-killed', enemyId: enemy.id });
    }
  }

  return {
    ...state,
    tick: state.tick + 1,
    nextEntitySequence,
    player: {
      ...state.player,
      previousPosition: state.player.position,
      position: playerPosition,
      hitPoints: playerHitPoints,
      ammo,
      heat,
      primaryCooldown: nextCooldown,
    },
    enemies: enemies.filter((enemy) => enemy.hitPoints > 0),
    projectiles,
    events,
  };
}
