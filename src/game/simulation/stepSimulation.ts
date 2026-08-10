import {
  WEAPON_DEFINITIONS,
  type WeaponDefinition,
} from '../data/weaponDefinitions';
import { segmentIntersectsCircle1d } from './collision';
import { resolveDamage } from './damage';
import {
  getDistanceDamageMultiplier,
  getRewardMultiplier,
  getRiskTier,
} from './distance';
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
const PASSIVE_COOLING_PER_SECOND = 12;
const PASSIVE_ENERGY_PER_SECOND = 10;
const OVERHEAT_THRESHOLD = 100;
const OVERHEAT_RECOVERY_THRESHOLD = 60;
const ENEMY_CONTACT_COOLDOWN_SECONDS = 1;
const FRONTLINE_PUSH_PER_KILL = 4;
const FRONTLINE_RETREAT_PER_ENEMY_PER_SECOND = 2.5;
const FRONTLINE_PRESSURE_RANGE = 35;
const FRONTLINE_MAXIMUM = 80;
const EMERGENCY_BOOST_ENERGY_COST = 25;
const EMERGENCY_BOOST_HEAT_VENT = 35;
const EMERGENCY_BOOST_DISTANCE = 12;
const EMERGENCY_BOOST_COOLDOWN_SECONDS = 6;

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

function createProjectile(
  state: SimulationState,
  position: number,
  definition: WeaponDefinition,
  sequence: number,
): ProjectileState {
  return {
    id: `projectile-${sequence}`,
    ownerId: state.player.id,
    previousPosition: position,
    position,
    originPosition: position,
    velocity: definition.projectileSpeed,
    radius: definition.id === 'railgun' ? 0.35 : 0.2,
    damage: definition.damage,
    maximumRange: definition.maximumRange,
    weaponId: definition.id,
    optimalRangeMinimum: definition.optimalRangeMinimum,
    optimalRangeMaximum: definition.optimalRangeMaximum,
    offRangeDamageMultiplier: definition.offRangeDamageMultiplier,
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
      const traveledDistance = Math.abs(
        target.position - movedProjectile.originPosition,
      );
      const distanceMultiplier = getDistanceDamageMultiplier(traveledDistance, {
        optimalMinimum: movedProjectile.optimalRangeMinimum,
        optimalMaximum: movedProjectile.optimalRangeMaximum,
        offRangeDamageMultiplier: movedProjectile.offRangeDamageMultiplier,
      });
      const damage = resolveDamage(
        movedProjectile.damage * distanceMultiplier,
        target.armor,
      );
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

interface FireResult {
  projectile?: ProjectileState;
  ammo: number;
  energy: number;
  heat: number;
  cooldown: number;
}

function tryFireWeapon(
  state: SimulationState,
  definition: WeaponDefinition,
  cooldown: number,
  ammo: number,
  energy: number,
  heat: number,
  sequence: number,
): FireResult {
  const canFire =
    cooldown === 0 &&
    !state.player.overheated &&
    ammo >= definition.ammoCost &&
    energy >= definition.energyCost;

  if (!canFire) return { ammo, energy, heat, cooldown };

  return {
    projectile: createProjectile(
      state,
      state.player.position + 2.8,
      definition,
      sequence,
    ),
    ammo: ammo - definition.ammoCost,
    energy: energy - definition.energyCost,
    heat: Math.min(OVERHEAT_THRESHOLD, heat + definition.heatGenerated),
    cooldown: definition.cooldownSeconds,
  };
}

export function stepSimulation(
  state: SimulationState,
  command: PlayerCommand,
  deltaSeconds: number,
): SimulationState {
  if (state.status !== 'active') {
    return { ...state, tick: state.tick + 1, events: [] };
  }

  const events: CombatEvent[] = [];
  let playerPosition = clamp(
    state.player.position + command.move * PLAYER_SPEED * deltaSeconds,
    PLAYER_MIN_POSITION,
    PLAYER_MAX_POSITION,
  );
  let playerHitPoints = state.player.hitPoints;
  let primaryCooldown = Math.max(
    0,
    state.player.primaryCooldown - deltaSeconds,
  );
  let secondaryCooldown = Math.max(
    0,
    state.player.secondaryCooldown - deltaSeconds,
  );
  let skillCooldown = Math.max(0, state.player.skillCooldown - deltaSeconds);
  let ammo = state.player.ammo;
  let energy = Math.min(
    100,
    state.player.energy + PASSIVE_ENERGY_PER_SECOND * deltaSeconds,
  );
  let heat = Math.max(
    0,
    state.player.heat - PASSIVE_COOLING_PER_SECOND * deltaSeconds,
  );
  let overheated = state.player.overheated;
  let enemies = moveEnemies(
    state.enemies,
    playerPosition,
    state.player.radius,
    deltaSeconds,
  );
  let projectiles = state.projectiles;
  let nextEntitySequence = state.nextEntitySequence;

  if (overheated && heat <= OVERHEAT_RECOVERY_THRESHOLD) {
    overheated = false;
    events.push({ type: 'cooled' });
  }

  if (
    command.activateSkill &&
    skillCooldown === 0 &&
    energy >= EMERGENCY_BOOST_ENERGY_COST
  ) {
    energy -= EMERGENCY_BOOST_ENERGY_COST;
    heat = Math.max(0, heat - EMERGENCY_BOOST_HEAT_VENT);
    playerPosition = Math.max(
      PLAYER_MIN_POSITION,
      playerPosition - EMERGENCY_BOOST_DISTANCE,
    );
    skillCooldown = EMERGENCY_BOOST_COOLDOWN_SECONDS;
    events.push({ type: 'skill-activated', skillId: 'emergency-boost' });
  }

  const fire = (definition: WeaponDefinition, cooldown: number): FireResult =>
    tryFireWeapon(
      {
        ...state,
        player: { ...state.player, position: playerPosition, overheated },
      },
      definition,
      cooldown,
      ammo,
      energy,
      heat,
      nextEntitySequence,
    );

  if (command.firePrimary) {
    const result = fire(WEAPON_DEFINITIONS['machine-cannon'], primaryCooldown);
    ammo = result.ammo;
    energy = result.energy;
    heat = result.heat;
    primaryCooldown = result.cooldown;
    if (result.projectile) {
      projectiles = [...projectiles, result.projectile];
      nextEntitySequence += 1;
      events.push({
        type: 'weapon-fired',
        projectileId: result.projectile.id,
        weaponId: result.projectile.weaponId,
      });
    }
  }

  if (command.fireSecondary) {
    const result = fire(WEAPON_DEFINITIONS.railgun, secondaryCooldown);
    ammo = result.ammo;
    energy = result.energy;
    heat = result.heat;
    secondaryCooldown = result.cooldown;
    if (result.projectile) {
      projectiles = [...projectiles, result.projectile];
      nextEntitySequence += 1;
      events.push({
        type: 'weapon-fired',
        projectileId: result.projectile.id,
        weaponId: result.projectile.weaponId,
      });
    }
  }

  if (!overheated && heat >= OVERHEAT_THRESHOLD) {
    overheated = true;
    events.push({ type: 'overheated' });
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

  const killedEnemies = enemies.filter((enemy) => enemy.hitPoints <= 0);
  for (const enemy of killedEnemies) {
    events.push({ type: 'enemy-killed', enemyId: enemy.id });
  }
  enemies = enemies.filter((enemy) => enemy.hitPoints > 0);

  const pressure = enemies.filter(
    (enemy) =>
      enemy.position <= state.frontline.position + FRONTLINE_PRESSURE_RANGE,
  ).length;
  const frontlinePosition = clamp(
    state.frontline.position +
      killedEnemies.length * FRONTLINE_PUSH_PER_KILL -
      pressure * FRONTLINE_RETREAT_PER_ENEMY_PER_SECOND * deltaSeconds,
    0,
    FRONTLINE_MAXIMUM,
  );
  const riskTier = getRiskTier(playerPosition);
  let status: SimulationState['status'] = 'active';
  if (playerHitPoints <= 0 || frontlinePosition <= 0) status = 'defeat';
  else if (enemies.length === 0 && projectiles.length === 0) status = 'victory';
  if (status !== 'active')
    events.push({ type: 'combat-ended', result: status });

  return {
    ...state,
    tick: state.tick + 1,
    nextEntitySequence,
    status,
    player: {
      ...state.player,
      previousPosition: state.player.position,
      position: playerPosition,
      hitPoints: playerHitPoints,
      ammo,
      energy,
      heat,
      primaryCooldown,
      secondaryCooldown,
      skillCooldown,
      overheated,
    },
    frontline: {
      position: frontlinePosition,
      pressure,
      riskTier,
      rewardMultiplier: getRewardMultiplier(riskTier),
    },
    enemies,
    projectiles,
    events,
  };
}
