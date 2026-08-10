import { ENEMY_DEFINITIONS } from '../data/enemyDefinitions';
import type { EnemyTypeId } from '../data/ids';
import type { EnemyState, EntityId } from '../simulation/types';

export function createEnemy(
  typeId: EnemyTypeId,
  id: EntityId,
  position: number,
): EnemyState {
  const definition = ENEMY_DEFINITIONS[typeId];
  return {
    id,
    typeId,
    behaviorId: definition.behaviorId,
    previousPosition: position,
    position,
    radius: definition.radius,
    hitPoints: definition.hitPoints,
    armor: definition.armor,
    speed: definition.speed,
    contactDamage: definition.contactDamage,
    contactCooldown: 0,
    attackRange: definition.attackRange,
    attackDamage: definition.attackDamage,
    attackCooldownSeconds: definition.attackCooldownSeconds,
    frontlinePressure: definition.frontlinePressure,
    ...(typeId === 'kawaii-fortress' ? { bossPhase: 1 as const } : {}),
  };
}
