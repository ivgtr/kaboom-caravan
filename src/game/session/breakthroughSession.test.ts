import { describe, expect, it } from 'vitest';
import {
  createGameSession,
  restartGameSession,
  selectReward,
  selectRoute,
  selectCombatCore,
  stepGameSession,
} from './GameSession';
import { IDLE_COMMAND } from '../simulation/types';

describe('banked breakthrough charge', () => {
  function clear(encounterIndex = 0) {
    const session = createGameSession();
    session.run.encounterIndex = encounterIndex;
    session.combat.breakthrough = {
      charge: 82,
      remainingSeconds: 0,
      hitChargeCooldown: 0.5,
    };
    session.combat.status = 'victory';
    const state = stepGameSession(session, IDLE_COMMAND, 1 / 60);
    return state.phase === 'core-choice'
      ? selectCombatCore(state, 'counter')
      : state;
  }

  it('carries earned charge through rewards, but not the hit cooldown', () => {
    const reward = clear();
    expect(reward.run.breakthroughCharge).toBe(82);
    const next = selectReward(reward, reward.rewardChoices[0]!.id);
    expect(next.phase).toBe('combat');
    expect(next.combat.breakthrough).toEqual({
      charge: 82,
      remainingSeconds: 0,
      hitChargeCooldown: 0,
    });
  });

  it('carries charge through route selection too', () => {
    const reward = clear(2);
    const route = selectReward(reward, reward.rewardChoices[0]!.id);
    expect(route.phase).toBe('route');
    const next = selectRoute(route, route.routeChoices[0]!.id);
    expect(next.combat.breakthrough.charge).toBe(82);
  });

  it('never carries an active burst to the next encounter', () => {
    const session = createGameSession();
    session.combat.breakthrough = {
      charge: 0,
      remainingSeconds: 3,
      hitChargeCooldown: 0,
    };
    session.combat.status = 'victory';
    const reward = selectCombatCore(
      stepGameSession(session, IDLE_COMMAND, 1 / 60),
      'counter',
    );
    const next = selectReward(reward, reward.rewardChoices[0]!.id);
    expect(next.combat.breakthrough).toEqual({
      charge: 0,
      remainingSeconds: 0,
      hitChargeCooldown: 0,
    });
  });

  it.each([
    'core-choice',
    'weapon-cache',
    'reward',
    'route',
    'garage',
  ] as const)('freezes the effect during %s', (phase) => {
    const session = createGameSession();
    session.phase = phase;
    session.combat.breakthrough.remainingSeconds = 3;
    expect(
      stepGameSession(
        session,
        { ...IDLE_COMMAND, activateBreakthrough: true },
        30,
      ),
    ).toBe(session);
  });

  it('resets charge on a new run rather than persisting a free special', () => {
    const session = clear();
    const restarted = restartGameSession(session);
    expect(restarted.run.breakthroughCharge).toBe(0);
    expect(restarted.combat.breakthrough.charge).toBe(0);
  });
});
