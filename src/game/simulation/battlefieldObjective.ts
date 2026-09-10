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

export function createBreakoutObjective(): BattlefieldObjectiveState {
  return {
    kind: 'breakout',
    status: 'active',
    progressSeconds: 0,
    remainingSeconds: BATTLEFIELD_OBJECTIVES.breakout.deadlineSeconds,
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
  return Math.abs(position - definition.position) <= definition.radius;
}

function lostEvent(
  objective: BattlefieldObjectiveState,
): CombatEvent | undefined {
  if (objective.kind === 'breakout') return undefined;
  return { type: 'objective-lost', kind: objective.kind };
}

function securedEvent(
  objective: BattlefieldObjectiveState,
): CombatEvent | undefined {
  if (objective.kind === 'breakout') return undefined;
  return { type: 'objective-secured', kind: objective.kind };
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
    const event = lostEvent(objective);
    return {
      objective: { ...objective, status: 'lost' },
      ...(event ? { event } : {}),
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

  // Detour sites can still resolve when the battlefield is fully clear. BREAKOUT
  // deliberately cannot: killing everything is no longer a substitute for
  // physically driving through the blockade.
  const secured =
    progressSeconds + EPSILON >= definition.holdSeconds ||
    (objective.kind !== 'breakout' &&
      context.battlefieldCleared &&
      dt <= objective.remainingSeconds + EPSILON);
  if (secured) {
    const event = securedEvent(objective);
    return {
      objective: {
        ...objective,
        status: 'secured',
        progressSeconds: definition.holdSeconds,
        remainingSeconds,
      },
      ...(event ? { event } : {}),
    };
  }
  if (remainingSeconds <= EPSILON) {
    const event = lostEvent(objective);
    return {
      objective: {
        ...objective,
        status: 'lost',
        progressSeconds,
        remainingSeconds: 0,
      },
      ...(event ? { event } : {}),
    };
  }
  return { objective: { ...objective, progressSeconds, remainingSeconds } };
}

export function getObjectiveStatus(
  objective: BattlefieldObjectiveState,
  position: number,
  contested: boolean,
): string {
  if (objective.kind === 'breakout') {
    if (objective.status === 'secured') return '突破成功・離脱！';
    if (objective.status === 'lost') return '封鎖された・遠征失敗';
    if (contested) return '出口を塞がれている！ 排除して前へ';
    if (isInsideObjective(objective, position)) return '突破中・この位置を維持！';
    return position < BATTLEFIELD_OBJECTIVES.breakout.position
      ? '敵を全滅させなくていい。出口へ前進 →'
      : '← 封鎖線へ戻れ';
  }

  if (objective.status === 'secured') return '回収成功';
  if (objective.status === 'lost') return '回収断念・敵を倒して進もう';
  if (contested) return '敵が範囲内！ 排除して確保';
  if (isInsideObjective(objective, position)) return '確保中・射撃も移動も可能';
  const center = BATTLEFIELD_OBJECTIVES[objective.kind].position;
  return position < center ? '前進して回収範囲へ →' : '← 後退して回収範囲へ';
}
