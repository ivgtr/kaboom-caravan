import { getRiskTier } from './distance';
import type { BreakthroughState, CombatEvent, SimulationState } from './types';

export const BREAKTHROUGH = {
  maximumCharge: 100,
  durationSeconds: 4,
  hitIntervalSeconds: 0.75,
  parryCharge: 25,
  fireRateMultiplier: 1.75,
  coolingMultiplier: 2.5,
  frontlineRecovery: 8,
} as const;

/** Position is evaluated at impact: advancing must expose the caravan. */
export function getBreakthroughHitCharge(position: number): number {
  switch (getRiskTier(position)) {
    case 'safe':
      return 0;
    case 'frontline':
      return 6;
    case 'danger':
      return 9;
    case 'enemy-territory':
      return 12;
  }
}

export function hasBreakthroughThreat(state: SimulationState): boolean {
  return (
    state.enemies.some((enemy) => enemy.hitPoints > 0) ||
    state.enemyProjectiles.length > 0
  );
}

export function canActivateBreakthrough(state: SimulationState): boolean {
  return (
    state.status === 'active' &&
    state.player.hitPoints > 0 &&
    state.breakthrough.charge >= BREAKTHROUGH.maximumCharge &&
    state.breakthrough.remainingSeconds === 0 &&
    hasBreakthroughThreat(state)
  );
}

/** Run before combat resolution so a deliberate activation can stop an attack. */
export function prepareBreakthrough(
  state: SimulationState,
  requested: boolean,
  deltaSeconds: number,
): { state: SimulationState; events: CombatEvent[] } {
  const breakthrough = {
    ...state.breakthrough,
    remainingSeconds: Math.max(
      0,
      state.breakthrough.remainingSeconds - deltaSeconds,
    ),
    hitChargeCooldown: Math.max(
      0,
      state.breakthrough.hitChargeCooldown - deltaSeconds,
    ),
  };
  if (!requested || !canActivateBreakthrough(state)) {
    return { state: { ...state, breakthrough }, events: [] };
  }
  return {
    state: {
      ...state,
      breakthrough: {
        charge: 0,
        remainingSeconds: BREAKTHROUGH.durationSeconds,
        hitChargeCooldown: 0,
      },
      player: {
        ...state.player,
        weaponHeat: {
          primary: { heat: 0, overheated: false },
          secondary: { heat: 0, overheated: false },
        },
        primaryCooldown: 0,
        secondaryCooldown: 0,
      },
      frontline: {
        ...state.frontline,
        position: Math.min(
          80,
          state.frontline.position + BREAKTHROUGH.frontlineRecovery,
        ),
      },
      enemyProjectiles: [],
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        position: Math.min(120, enemy.position + (enemy.bossPhase ? 4 : 14)),
        attackWindupRemaining: undefined,
        contactCooldown: Math.max(enemy.contactCooldown, 0.65),
      })),
    },
    events: [{ type: 'breakthrough-activated' }],
  };
}

/** One hit award per window, not per pellet, target or damage point. */
export function earnBreakthroughCharge(
  state: BreakthroughState,
  events: readonly CombatEvent[],
  playerPosition: number,
): { breakthrough: BreakthroughState; events: CombatEvent[] } {
  if (state.remainingSeconds > 0) return { breakthrough: state, events: [] };
  const hitCharge = getBreakthroughHitCharge(playerPosition);
  const earnedHit =
    hitCharge > 0 &&
    state.hitChargeCooldown === 0 &&
    events.some((event) => event.type === 'projectile-hit' && event.damage > 0);
  const earnedParry = events.some((event) => event.type === 'attack-parried');
  const charge = Math.min(
    BREAKTHROUGH.maximumCharge,
    state.charge +
      (earnedHit ? hitCharge : 0) +
      (earnedParry ? BREAKTHROUGH.parryCharge : 0),
  );
  return {
    breakthrough: {
      ...state,
      charge,
      hitChargeCooldown: earnedHit
        ? BREAKTHROUGH.hitIntervalSeconds
        : state.hitChargeCooldown,
    },
    events:
      state.charge < BREAKTHROUGH.maximumCharge &&
      charge === BREAKTHROUGH.maximumCharge
        ? [{ type: 'breakthrough-ready' }]
        : [],
  };
}
