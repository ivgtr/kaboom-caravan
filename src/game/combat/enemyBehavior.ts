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

  for (const enemy of enemies) {
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
