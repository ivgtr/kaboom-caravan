import { resolveDamage } from '../simulation/damage';
import type { CombatEvent, EnemyState } from '../simulation/types';

const ENEMY_ENTRY_SPEED = 8;

export interface EnemyBehaviorResult {
  enemies: EnemyState[];
  playerHitPoints: number;
  events: CombatEvent[];
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
  let hitPoints = playerHitPoints;

  for (const enemy of enemies) {
    const minimumPosition = playerPosition + playerRadius + enemy.radius;
    const attackCooldown = Math.max(0, enemy.contactCooldown - deltaSeconds);
    const distance = enemy.position - playerPosition;
    let nextPosition = enemy.position;

    if (
      enemy.entryDestinationPosition !== undefined &&
      enemy.position > enemy.entryDestinationPosition
    ) {
      const isRanged =
        enemy.behaviorId === 'stopAndShoot' ||
        enemy.behaviorId === 'bossFortress';
      const attackPosition = playerPosition + enemy.attackRange;
      const entryTarget = Math.max(
        enemy.entryDestinationPosition,
        isRanged ? attackPosition : minimumPosition,
      );
      nextPosition = Math.max(
        entryTarget,
        enemy.position - ENEMY_ENTRY_SPEED * deltaSeconds,
      );
      nextEnemies.push({
        ...enemy,
        previousPosition: enemy.position,
        position: nextPosition,
        contactCooldown: attackCooldown,
        entryDestinationPosition:
          nextPosition > entryTarget
            ? enemy.entryDestinationPosition
            : undefined,
      });
      continue;
    }

    if (
      (enemy.behaviorId === 'stopAndShoot' ||
        enemy.behaviorId === 'bossFortress') &&
      distance <= enemy.attackRange
    ) {
      if (attackCooldown === 0) {
        const phaseMultiplier = enemy.bossPhase === 3 ? 1.5 : 1;
        const damage = resolveDamage(
          enemy.attackDamage * phaseMultiplier,
          playerArmor,
        );
        hitPoints = Math.max(0, hitPoints - damage);
        events.push({ type: 'enemy-attacked', enemyId: enemy.id });
        events.push({ type: 'vehicle-hit', sourceId: enemy.id, damage });
        nextEnemies.push({
          ...enemy,
          previousPosition: enemy.position,
          contactCooldown:
            enemy.bossPhase === 3
              ? enemy.attackCooldownSeconds * 0.65
              : enemy.attackCooldownSeconds,
        });
        continue;
      }
    } else {
      const phaseSpeedMultiplier = enemy.bossPhase === 3 ? 2.2 : 1;
      nextPosition = Math.max(
        minimumPosition,
        enemy.position - enemy.speed * phaseSpeedMultiplier * deltaSeconds,
      );
    }

    const isTouching = nextPosition <= minimumPosition;
    if (isTouching && attackCooldown === 0) {
      const damage = resolveDamage(enemy.contactDamage, playerArmor);
      hitPoints = Math.max(0, hitPoints - damage);
      events.push({ type: 'vehicle-hit', sourceId: enemy.id, damage });
      if (enemy.behaviorId === 'suicideRush') continue;
      nextEnemies.push({
        ...enemy,
        previousPosition: enemy.position,
        position: nextPosition,
        contactCooldown: enemy.attackCooldownSeconds,
      });
      continue;
    }

    nextEnemies.push({
      ...enemy,
      previousPosition: enemy.position,
      position: nextPosition,
      contactCooldown: attackCooldown,
    });
  }

  return { enemies: nextEnemies, playerHitPoints: hitPoints, events };
}
