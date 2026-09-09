import { ENEMY_DEFINITIONS } from '../data/enemyDefinitions';
import { resolveDamage } from '../simulation/damage';
import type {
  CombatEvent,
  EnemyProjectileVisualId,
  EnemyState,
} from '../simulation/types';

export interface EnemyBehaviorResult {
  enemies: EnemyState[];
  playerHitPoints: number;
  events: CombatEvent[];
  rangedAttacks: EnemyRangedAttack[];
}

export interface EnemyRangedAttack {
  enemyId: string;
  originPosition: number;
  damage: number;
  projectileSpeed: number;
  projectileRadius: number;
  maximumAgeSeconds: number;
  visualId: EnemyProjectileVisualId;
}

interface PreparedEnemy {
  enemy: EnemyState;
  interrupted: boolean;
}

function prepareEnemyForStep(
  source: EnemyState,
  deltaSeconds: number,
): PreparedEnemy {
  const definition = ENEMY_DEFINITIONS[source.typeId];
  const normalFrontlinePressure =
    definition.frontlinePressure * (source.elite === true ? 1.25 : 1);
  const activeBreakSeconds = source.breakRemainingSeconds ?? 0;
  if (activeBreakSeconds > 0) {
    return {
      enemy: {
        ...source,
        previousPosition: source.position,
        contactCooldown: Math.max(0, source.contactCooldown - deltaSeconds),
        frontlinePressure: normalFrontlinePressure * 0.2,
        attackWindupRemaining: undefined,
        breakRemainingSeconds: Math.max(0, activeBreakSeconds - deltaSeconds),
      },
      interrupted: true,
    };
  }

  const maximumHitPoints =
    definition.hitPoints * (source.elite === true ? 1.45 : 1);
  const hitPointRatio = Math.max(0, source.hitPoints) / maximumHitPoints;
  const currentStage = source.breakStage ?? 0;
  let nextStage = currentStage;

  for (
    let thresholdIndex = currentStage;
    thresholdIndex < definition.breakThresholds.length;
    thresholdIndex += 1
  ) {
    if (hitPointRatio <= definition.breakThresholds[thresholdIndex]!) {
      nextStage = thresholdIndex + 1;
    }
  }

  if (nextStage === currentStage) {
    return {
      enemy: {
        ...source,
        frontlinePressure: normalFrontlinePressure,
        breakStage: currentStage,
        breakRemainingSeconds: 0,
      },
      interrupted: false,
    };
  }

  const crossedStages = nextStage - currentStage;
  const recoilMultiplier = 1 + Math.max(0, nextStage - 1) * 0.15;
  const durationMultiplier = nextStage > 1 ? 1.2 : 1;
  return {
    enemy: {
      ...source,
      previousPosition: source.position,
      position:
        source.position + definition.breakRecoilDistance * recoilMultiplier,
      armor: Math.max(
        0,
        source.armor - definition.breakArmorDamage * crossedStages,
      ),
      contactCooldown: Math.max(source.contactCooldown, 0.35),
      frontlinePressure: normalFrontlinePressure * 0.2,
      attackWindupRemaining: undefined,
      breakStage: nextStage,
      breakRemainingSeconds:
        definition.breakDurationSeconds * durationMultiplier,
    },
    interrupted: true,
  };
}

export function stepEnemyBehaviors(
  enemies: readonly EnemyState[],
  playerPosition: number,
  playerRadius: number,
  playerArmor: number,
  playerHitPoints: number,
  deltaSeconds: number,
): EnemyBehaviorResult {
  const nextEnemies: EnemyState[] = [];
  const events: CombatEvent[] = [];
  const rangedAttacks: EnemyRangedAttack[] = [];
  let hitPoints = playerHitPoints;

  for (const sourceEnemy of enemies) {
    const prepared = prepareEnemyForStep(sourceEnemy, deltaSeconds);
    const enemy = prepared.enemy;
    if (prepared.interrupted) {
      nextEnemies.push(enemy);
      continue;
    }

    const minimumPosition = playerPosition + playerRadius + enemy.radius;
    const attackCooldown = Math.max(0, enemy.contactCooldown - deltaSeconds);
    const distance = enemy.position - playerPosition;
    let nextPosition = enemy.position;

    const isRanged =
      enemy.behaviorId === 'stopAndShoot' ||
      enemy.behaviorId === 'bossFortress';
    if (isRanged && distance <= enemy.attackRange) {
      if (attackCooldown > 0) {
        nextEnemies.push({
          ...enemy,
          previousPosition: enemy.position,
          contactCooldown: attackCooldown,
        });
        continue;
      }
      if (enemy.attackWindupRemaining === undefined) {
        events.push({ type: 'enemy-attack-windup', enemyId: enemy.id });
        nextEnemies.push({
          ...enemy,
          previousPosition: enemy.position,
          contactCooldown: 0,
          attackWindupRemaining: enemy.attackWindupSeconds,
        });
        continue;
      }
      const windupRemaining = Math.max(
        0,
        enemy.attackWindupRemaining - deltaSeconds,
      );
      if (windupRemaining > 0) {
        nextEnemies.push({
          ...enemy,
          previousPosition: enemy.position,
          contactCooldown: 0,
          attackWindupRemaining: windupRemaining,
        });
        continue;
      }

      const phaseMultiplier = enemy.bossPhase === 3 ? 1.5 : 1;
      const isBoss = enemy.behaviorId === 'bossFortress';
      rangedAttacks.push({
        enemyId: enemy.id,
        // Both ranged sprites face left. The boss cannon projects farther from
        // its body than the artillery mushroom's cap-mounted muzzle.
        originPosition: enemy.position - enemy.radius * (isBoss ? 0.92 : 0.48),
        damage: enemy.attackDamage * phaseMultiplier,
        projectileSpeed: isBoss ? (enemy.bossPhase === 3 ? 26 : 20) : 18,
        projectileRadius: isBoss ? 0.8 : 0.55,
        maximumAgeSeconds: isBoss ? 4.5 : 4,
        visualId: isBoss
          ? enemy.bossPhase === 3
            ? 'boss-burst'
            : 'boss-core'
          : 'spore',
      });
      events.push({ type: 'enemy-attacked', enemyId: enemy.id });
      nextEnemies.push({
        ...enemy,
        previousPosition: enemy.position,
        contactCooldown:
          enemy.bossPhase === 3
            ? enemy.attackCooldownSeconds * 0.65
            : enemy.attackCooldownSeconds,
        attackWindupRemaining: undefined,
      });
      continue;
    }

    if (isRanged) {
      nextPosition = Math.max(
        minimumPosition,
        enemy.position - enemy.speed * deltaSeconds,
      );
      nextEnemies.push({
        ...enemy,
        previousPosition: enemy.position,
        position: nextPosition,
        contactCooldown: attackCooldown,
        attackWindupRemaining: undefined,
      });
      continue;
    }

    if (distance > enemy.radius + playerRadius) {
      const phaseSpeedMultiplier = enemy.bossPhase === 3 ? 2.2 : 1;
      nextPosition = Math.max(
        minimumPosition,
        enemy.position - enemy.speed * phaseSpeedMultiplier * deltaSeconds,
      );
      nextEnemies.push({
        ...enemy,
        previousPosition: enemy.position,
        position: nextPosition,
        contactCooldown: attackCooldown,
        attackWindupRemaining: undefined,
      });
      continue;
    }

    if (attackCooldown > 0) {
      nextEnemies.push({
        ...enemy,
        previousPosition: enemy.position,
        position: minimumPosition,
        contactCooldown: attackCooldown,
      });
      continue;
    }
    if (enemy.attackWindupRemaining === undefined) {
      events.push({ type: 'enemy-attack-windup', enemyId: enemy.id });
      nextEnemies.push({
        ...enemy,
        previousPosition: enemy.position,
        position: minimumPosition,
        contactCooldown: 0,
        attackWindupRemaining: enemy.attackWindupSeconds,
      });
      continue;
    }
    const windupRemaining = Math.max(
      0,
      enemy.attackWindupRemaining - deltaSeconds,
    );
    if (windupRemaining === 0) {
      const damage = resolveDamage(enemy.contactDamage, playerArmor);
      hitPoints = Math.max(0, hitPoints - damage);
      events.push({
        type: 'enemy-contact-released',
        enemyId: enemy.id,
        enemyTypeId: enemy.typeId,
        contactPosition: playerPosition + playerRadius,
      });
      events.push({ type: 'enemy-attacked', enemyId: enemy.id });
      events.push({ type: 'vehicle-hit', sourceId: enemy.id, damage });
      if (enemy.behaviorId === 'suicideRush') continue;
      nextEnemies.push({
        ...enemy,
        previousPosition: enemy.position,
        position: nextPosition,
        contactCooldown: enemy.attackCooldownSeconds,
        attackWindupRemaining: undefined,
      });
      continue;
    }

    nextEnemies.push({
      ...enemy,
      previousPosition: enemy.position,
      position: minimumPosition,
      contactCooldown: 0,
      attackWindupRemaining: windupRemaining,
    });
  }

  return {
    enemies: nextEnemies,
    playerHitPoints: hitPoints,
    events,
    rangedAttacks,
  };
}
