import {
  WEAPON_DEFINITIONS,
  type WeaponDefinition,
} from '../data/weaponDefinitions';
import {
  derivePlayerStats,
  deriveWeaponDefinition,
} from '../build/derivedStats';
import { runBuildTriggers } from '../build/triggers';
import type { TriggerSignal } from '../build/types';
import { createEnemy } from '../combat/createEnemy';
import { stepEnemyBehaviors } from '../combat/enemyBehavior';
import { ENEMY_DEFINITIONS } from '../data/enemyDefinitions';
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
import { advanceWave, completeWaveIfCleared } from '../wave/waveSystem';

const PLAYER_MIN_POSITION = 0;
const PLAYER_MAX_POSITION = 80;
const OVERHEAT_THRESHOLD = 100;
const OVERHEAT_RECOVERY_THRESHOLD = 60;
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

function createProjectiles(
  state: SimulationState,
  position: number,
  definition: WeaponDefinition,
  sequence: number,
): ProjectileState[] {
  const projectileCount = definition.behavior === 'scatter' ? 3 : 1;
  return Array.from({ length: projectileCount }, (_, index) => ({
    id: `projectile-${sequence + index}`,
    ownerId: state.player.id,
    previousPosition: position,
    position,
    originPosition: position,
    velocity:
      definition.behavior === 'mine'
        ? 0
        : definition.projectileSpeed * (1 - index * 0.08),
    radius:
      definition.behavior === 'flame'
        ? 3
        : definition.behavior === 'mine'
          ? 2
          : definition.behavior === 'railgun'
            ? 0.35
            : 0.2,
    damage: definition.damage,
    maximumRange: definition.maximumRange,
    weaponId: definition.id,
    optimalRangeMinimum: definition.optimalRangeMinimum,
    optimalRangeMaximum: definition.optimalRangeMaximum,
    offRangeDamageMultiplier: definition.offRangeDamageMultiplier,
    behavior: definition.behavior,
    remainingHits:
      definition.behavior === 'flame'
        ? 5
        : definition.behavior === 'railgun'
          ? 3
          : 1,
    hitEnemyIds: [],
    explosionRadius: definition.behavior === 'rocket' ? 7 : 0,
    ageSeconds: 0,
    maximumAgeSeconds:
      definition.behavior === 'mine'
        ? 12
        : definition.behavior === 'flame'
          ? 0.65
          : 4,
  }));
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
      ageSeconds: projectile.ageSeconds + deltaSeconds,
    };
    const collisionTargets = nextEnemies
      .filter(
        (enemy) =>
          enemy.hitPoints > 0 &&
          !movedProjectile.hitEnemyIds.includes(enemy.id) &&
          segmentIntersectsCircle1d(
            movedProjectile.previousPosition,
            movedProjectile.position,
            enemy.position,
            enemy.radius + movedProjectile.radius,
          ),
      )
      .sort((left, right) => left.position - right.position)
      .slice(
        0,
        movedProjectile.behavior === 'railgun' ||
          movedProjectile.behavior === 'flame'
          ? movedProjectile.remainingHits
          : 1,
      );

    if (collisionTargets.length > 0) {
      const target = collisionTargets[0]!;
      const impactedEnemies =
        movedProjectile.behavior === 'rocket'
          ? nextEnemies.filter(
              (enemy) =>
                enemy.hitPoints > 0 &&
                Math.abs(enemy.position - target.position) <=
                  movedProjectile.explosionRadius + enemy.radius,
            )
          : collisionTargets;

      for (const impactedEnemy of impactedEnemies) {
        const traveledDistance = Math.abs(
          impactedEnemy.position - movedProjectile.originPosition,
        );
        const distanceMultiplier = getDistanceDamageMultiplier(
          traveledDistance,
          {
            optimalMinimum: movedProjectile.optimalRangeMinimum,
            optimalMaximum: movedProjectile.optimalRangeMaximum,
            offRangeDamageMultiplier: movedProjectile.offRangeDamageMultiplier,
          },
        );
        const damage = resolveDamage(
          movedProjectile.damage * distanceMultiplier,
          impactedEnemy.armor,
        );
        nextEnemies = nextEnemies.map((enemy) =>
          enemy.id === impactedEnemy.id
            ? { ...enemy, hitPoints: enemy.hitPoints - damage }
            : enemy,
        );
        events.push({
          type: 'projectile-hit',
          projectileId: projectile.id,
          targetId: impactedEnemy.id,
          weaponId: projectile.weaponId,
          damage,
        });
      }

      const remainingHits =
        movedProjectile.remainingHits - collisionTargets.length;
      if (
        remainingHits > 0 &&
        movedProjectile.behavior !== 'rocket' &&
        movedProjectile.behavior !== 'mine'
      ) {
        remainingProjectiles.push({
          ...movedProjectile,
          remainingHits,
          hitEnemyIds: [
            ...movedProjectile.hitEnemyIds,
            ...collisionTargets.map(({ id }) => id),
          ],
        });
      }
      continue;
    }

    if (
      Math.abs(movedProjectile.position - movedProjectile.originPosition) <=
        movedProjectile.maximumRange &&
      movedProjectile.ageSeconds <= movedProjectile.maximumAgeSeconds
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
  projectiles: ProjectileState[];
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

  if (!canFire) return { projectiles: [], ammo, energy, heat, cooldown };

  return {
    projectiles: createProjectiles(
      state,
      state.player.position + (definition.behavior === 'mine' ? 8 : 2.8),
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
  const playerStats = derivePlayerStats(state.build);
  const primaryDefinition = deriveWeaponDefinition(
    WEAPON_DEFINITIONS[state.build.primaryWeaponId],
    state.build,
  );
  const secondaryDefinition = deriveWeaponDefinition(
    WEAPON_DEFINITIONS[state.build.secondaryWeaponId],
    state.build,
  );
  let playerPosition = clamp(
    state.player.position + command.move * playerStats.moveSpeed * deltaSeconds,
    PLAYER_MIN_POSITION,
    PLAYER_MAX_POSITION,
  );
  let playerHitPoints = Math.min(
    state.player.hitPoints,
    playerStats.maximumHitPoints,
  );
  let primaryCooldown = Math.max(
    0,
    state.player.primaryCooldown - deltaSeconds,
  );
  let secondaryCooldown = Math.max(
    0,
    state.player.secondaryCooldown - deltaSeconds,
  );
  let skillCooldown = Math.max(0, state.player.skillCooldown - deltaSeconds);
  let ammo = Math.min(state.player.ammo, playerStats.maximumAmmo);
  let energy = Math.min(
    playerStats.maximumEnergy,
    state.player.energy + playerStats.energyPerSecond * deltaSeconds,
  );
  let heat = Math.max(
    0,
    state.player.heat - playerStats.coolingPerSecond * deltaSeconds,
  );
  let overheated = state.player.overheated;
  let enemies = state.enemies;
  let projectiles = state.projectiles;
  let nextEntitySequence = state.nextEntitySequence;
  let wave = state.wave;

  if (wave) {
    const waveResult = advanceWave(wave, deltaSeconds, nextEntitySequence);
    wave = waveResult.wave;
    enemies = [...enemies, ...waveResult.spawnedEnemies];
    nextEntitySequence = waveResult.nextEntitySequence;
    events.push(...waveResult.events);
  }

  const behaviorResult = stepEnemyBehaviors(
    enemies,
    playerPosition,
    state.player.radius,
    playerStats.armor,
    playerHitPoints,
    deltaSeconds,
  );
  enemies = behaviorResult.enemies;
  playerHitPoints = behaviorResult.playerHitPoints;
  events.push(...behaviorResult.events);

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
    const result = fire(primaryDefinition, primaryCooldown);
    ammo = result.ammo;
    energy = result.energy;
    heat = result.heat;
    primaryCooldown = result.cooldown;
    if (result.projectiles.length > 0) {
      const firedProjectile = result.projectiles[0]!;
      projectiles = [...projectiles, ...result.projectiles];
      nextEntitySequence += result.projectiles.length;
      events.push({
        type: 'weapon-fired',
        projectileId: firedProjectile.id,
        weaponId: firedProjectile.weaponId,
      });
    }
  }

  if (command.fireSecondary) {
    const result = fire(secondaryDefinition, secondaryCooldown);
    ammo = result.ammo;
    energy = result.energy;
    heat = result.heat;
    secondaryCooldown = result.cooldown;
    if (result.projectiles.length > 0) {
      const firedProjectile = result.projectiles[0]!;
      projectiles = [...projectiles, ...result.projectiles];
      nextEntitySequence += result.projectiles.length;
      events.push({
        type: 'weapon-fired',
        projectileId: firedProjectile.id,
        weaponId: firedProjectile.weaponId,
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

  const killedEnemies = enemies.filter((enemy) => enemy.hitPoints <= 0);
  for (const enemy of killedEnemies) {
    events.push({ type: 'enemy-killed', enemyId: enemy.id });
  }
  enemies = enemies.filter((enemy) => enemy.hitPoints > 0);

  const reinforcements: EnemyState[] = [];
  enemies = enemies.map((enemy) => {
    if (enemy.typeId !== 'kawaii-fortress' || !enemy.bossPhase) return enemy;
    const maximumHitPoints = ENEMY_DEFINITIONS['kawaii-fortress'].hitPoints;
    const nextPhase: 1 | 2 | 3 =
      enemy.hitPoints <= maximumHitPoints * 0.33
        ? 3
        : enemy.hitPoints <= maximumHitPoints * 0.66
          ? 2
          : 1;
    if (nextPhase <= enemy.bossPhase) return enemy;
    if (nextPhase === 2) {
      reinforcements.push(
        createEnemy('basic', `enemy-${nextEntitySequence}`, enemy.position + 7),
        createEnemy(
          'rusher',
          `enemy-${nextEntitySequence + 1}`,
          enemy.position + 11,
        ),
      );
      nextEntitySequence += 2;
    }
    events.push({
      type: 'boss-phase-changed',
      bossId: enemy.id,
      phase: nextPhase as 2 | 3,
    });
    return { ...enemy, bossPhase: nextPhase };
  });
  enemies = [...enemies, ...reinforcements];

  if (wave) {
    const completion = completeWaveIfCleared(wave, enemies);
    wave = completion.wave;
    if (completion.event) events.push(completion.event);
  }

  const triggerSignals: TriggerSignal[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'weapon-fired':
        triggerSignals.push({
          type: 'onFire',
          weaponTags: WEAPON_DEFINITIONS[event.weaponId].tags,
        });
        break;
      case 'projectile-hit':
        triggerSignals.push({
          type: 'onHit',
          weaponTags: WEAPON_DEFINITIONS[event.weaponId].tags,
        });
        break;
      case 'enemy-killed':
        triggerSignals.push({ type: 'onKill' });
        break;
      case 'vehicle-hit':
        triggerSignals.push({ type: 'onDamage' });
        break;
      case 'overheated':
        triggerSignals.push({ type: 'onOverheat' });
        break;
      case 'wave-started':
        triggerSignals.push({ type: 'onWaveStart' });
        break;
      case 'wave-completed':
        triggerSignals.push({ type: 'onWaveEnd' });
        break;
      default:
        break;
    }
  }
  if (state.player.ammo > 0 && ammo === 0) {
    triggerSignals.push({ type: 'onAmmoEmpty' });
  }
  if (state.player.energy > 0 && energy === 0) {
    triggerSignals.push({ type: 'onEnergyEmpty' });
  }
  const triggerResult = runBuildTriggers(
    state.build,
    triggerSignals,
    { ammo, energy, heat, hitPoints: playerHitPoints },
    {
      ammo: playerStats.maximumAmmo,
      energy: playerStats.maximumEnergy,
      heat: OVERHEAT_THRESHOLD,
      hitPoints: playerStats.maximumHitPoints,
    },
  );
  ammo = triggerResult.resources.ammo;
  energy = triggerResult.resources.energy;
  heat = triggerResult.resources.heat;
  playerHitPoints = triggerResult.resources.hitPoints;

  const pressure = enemies
    .filter(
      (enemy) =>
        enemy.position <= state.frontline.position + FRONTLINE_PRESSURE_RANGE,
    )
    .reduce((sum, enemy) => sum + enemy.frontlinePressure, 0);
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
  else if (
    enemies.length === 0 &&
    projectiles.length === 0 &&
    (!wave || wave.completed)
  ) {
    status = 'victory';
  }
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
      maxHitPoints: playerStats.maximumHitPoints,
      armor: playerStats.armor,
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
    ...(wave ? { wave } : {}),
    enemies,
    projectiles,
    events,
  };
}
