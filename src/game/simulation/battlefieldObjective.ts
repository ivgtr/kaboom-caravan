import {
  BATTLEFIELD_OBJECTIVES,
  type RouteType,
} from '../data/routeDefinitions';
import type {
  BattlefieldObjectiveState,
  CombatEvent,
  EnemyState,
} from './types';

const EPSILON = 1e-9;

export function createBattlefieldObjective(
  route: RouteType,
): BattlefieldObjectiveState | undefined {
  if (route !== 'repair' && route !== 'salvage') return undefined;
  return {
    kind: route,
    status: 'active',
    progressSeconds: 0,
    remainingSeconds: BATTLEFIELD_OBJECTIVES[route].deadlineSeconds,
  };
}

export function isObjectiveContested(
  objective: BattlefieldObjectiveState,
  enemies: readonly EnemyState[],
): boolean {
  const { position, radius } = BATTLEFIELD_OBJECTIVES[objective.kind];
  return enemies.some(
    (enemy) =>
      enemy.hitPoints > 0 &&
      Math.abs(enemy.position - position) <= radius + enemy.radius + EPSILON,
  );
}

export function isInsideObjective(
  objective: BattlefieldObjectiveState,
  position: number,
): boolean {
  const definition = BATTLEFIELD_OBJECTIVES[objective.kind];
  // The caravan's center, not its sprite or collider, must enter the marked zone.
  return Math.abs(position - definition.position) <= definition.radius;
}

export function advanceBattlefieldObjective(
  objective: BattlefieldObjectiveState | undefined,
  context: {
    deltaSeconds: number;
    position: number;
    enemies: readonly EnemyState[];
    defeated: boolean;
    battlefieldCleared: boolean;
  },
): { objective: BattlefieldObjectiveState | undefined; event?: CombatEvent } {
  if (!objective || objective.status !== 'active') return { objective };
  if (context.defeated) {
    return {
      objective: { ...objective, status: 'lost' },
      event: { type: 'objective-lost', kind: objective.kind },
    };
  }
  const dt = context.deltaSeconds;
  if (!Number.isFinite(dt) || dt <= 0) return { objective };
  const definition = BATTLEFIELD_OBJECTIVES[objective.kind];
  const availableSeconds = Math.min(dt, objective.remainingSeconds);
  const capturing =
    isInsideObjective(objective, context.position) &&
    !isObjectiveContested(objective, context.enemies);
  const progressSeconds = Math.min(
    definition.holdSeconds,
    objective.progressSeconds + (capturing ? availableSeconds : 0),
  );
  const remainingSeconds = Math.max(0, objective.remainingSeconds - dt);
  // Clearing the entire scheduled wave and all hostile shots secures the site
  // without making the player wait beside an empty battlefield. A late clear
  // cannot recover an already-expired cache. Exact-deadline completion wins.
  const secured =
    progressSeconds + EPSILON >= definition.holdSeconds ||
    (context.battlefieldCleared && dt <= objective.remainingSeconds + EPSILON);
  if (secured) {
    return {
      objective: {
        ...objective,
        status: 'secured',
        progressSeconds: definition.holdSeconds,
        remainingSeconds,
      },
      event: { type: 'objective-secured', kind: objective.kind },
    };
  }
  if (remainingSeconds <= EPSILON) {
    return {
      objective: {
        ...objective,
        status: 'lost',
        progressSeconds,
        remainingSeconds: 0,
      },
      event: { type: 'objective-lost', kind: objective.kind },
    };
  }
  return { objective: { ...objective, progressSeconds, remainingSeconds } };
}

export function getObjectiveStatus(
  objective: BattlefieldObjectiveState,
  position: number,
  contested: boolean,
): string {
  if (objective.status === 'secured') return '回収成功';
  if (objective.status === 'lost') return '回収断念・敵を倒して進もう';
  if (contested) return '敵が範囲内！ 排除して確保';
  if (isInsideObjective(objective, position)) return '確保中・射撃も移動も可能';
  const center = BATTLEFIELD_OBJECTIVES[objective.kind].position;
  return position < center ? '前進して回収範囲へ →' : '← 後退して回収範囲へ';
}
