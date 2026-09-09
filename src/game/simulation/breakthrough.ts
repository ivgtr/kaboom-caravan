import { createEnemy } from '../combat/createEnemy';
import type { EnemyTypeId } from '../data/ids';
import { getRiskTier } from './distance';
import type {
  BreakthroughState,
  CombatEvent,
  EnemyState,
  SimulationState,
} from './types';

export const BREAKTHROUGH = {
  maximumCharge: 100,
  durationSeconds: 4,
  hitIntervalSeconds: 0.75,
  parryCharge: 25,
  // DEATH RIDE is intentionally extreme: the player gets a short weapons spike
  // in exchange for immediately adding another attack beat to the battlefield.
  fireRateMultiplier: 3.25,
  coolingMultiplier: 5,
  displacement: 10,
  bossDisplacement: 3,
  counterchargeTypes: ['rusher', 'bomber', 'basic', 'artillery'] as const,
  counterchargeOffsets: [20, 28, 36, 44] as const,
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
    !state.breakthrough.committed &&
    state.breakthrough.charge >= BREAKTHROUGH.maximumCharge &&
    state.breakthrough.remainingSeconds === 0 &&
    hasBreakthroughThreat(state)
  );
}

function applyEliteEncounter(enemy: EnemyState, elite: boolean): EnemyState {
  if (!elite) return enemy;
  return {
    ...enemy,
    elite: true,
    hitPoints: enemy.hitPoints * 1.45,
    contactDamage: enemy.contactDamage * 1.2,
    attackDamage: enemy.attackDamage * 1.2,
    frontlinePressure: enemy.frontlinePressure * 1.25,
  };
}

function createCountercharge(state: SimulationState): EnemyState[] {
  return BREAKTHROUGH.counterchargeTypes.map((typeId, index) => {
    const offset = BREAKTHROUGH.counterchargeOffsets[index]!;
    const position = Math.min(118, state.player.position + offset);
    const enemy = createEnemy(
      typeId as EnemyTypeId,
      `death-ride-${state.tick}-${index + 1}`,
      position,
    );
    return applyEliteEncounter(enemy, state.eliteEncounter);
  });
}

/**
 * DEATH RIDE replaces the old safe panic button.
 *
 * Activation still gives a tiny instant displacement so an objective can be
 * cracked open, but it no longer deletes incoming shots, interrupts windups or
 * repairs the frontline. Instead it injects a four-enemy countercharge close to
 * the caravan. The player receives an extreme four-second fire/cooling window
 * and has to cash that advantage in immediately. Any survivors stay on the
 * field after the burst, so a bad activation makes the battle permanently worse.
 */
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

  const countercharge = createCountercharge(state);
  return {
    state: {
      ...state,
      breakthrough: {
        charge: 0,
        remainingSeconds: BREAKTHROUGH.durationSeconds,
        hitChargeCooldown: 0,
        committed: true,
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
      // Existing enemies are shoved just enough to create a firing lane. Unlike
      // the old breakthrough, their attacks are NOT cancelled and bullets stay.
      enemies: [
        ...state.enemies.map((enemy) => ({
          ...enemy,
          position: Math.min(
            120,
            enemy.position +
              (enemy.bossPhase
                ? BREAKTHROUGH.bossDisplacement
                : BREAKTHROUGH.displacement),
          ),
        })),
        ...countercharge,
      ],
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
      !state.committed &&
      state.charge < BREAKTHROUGH.maximumCharge &&
      charge === BREAKTHROUGH.maximumCharge
        ? [{ type: 'breakthrough-ready' }]
        : [],
  };
}
