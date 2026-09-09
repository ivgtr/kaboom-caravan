import { describe, expect, it } from 'vitest';
import { COMBAT_CORE_IDS } from '../data/combatCoreDefinitions';
import { generateRewardChoices, generateWeaponCacheChoices } from '../reward/rewardSystem';
import { createCombatCoreState } from '../simulation/combatCore';
import { IDLE_COMMAND } from '../simulation/types';
import { createGameSession, restartGameSession, rerollRewards, selectCombatCore, selectReward, selectRoute, selectWeaponCacheReward, stepGameSession } from './GameSession';
function firstClear(seed = 42) {
  const state = createGameSession(seed);
  state.combat.tick = 500;
  state.combat.status = 'victory';
  state.combat.player.hitPoints = 60;
  state.combat.treasureCollected = 4;
  state.combat.breakthrough.charge = 82;
  return stepGameSession(state, IDLE_COMMAND, 1 / 60);
}
describe('run-defining core choice', () => {
  it('offers a mandatory core AFTER the first victory without advancing or discarding the ordinary reward', () => {
    const state = firstClear();
    expect(state.phase).toBe('core-choice');
    expect(state.run.build.coreId).toBeUndefined();
    expect(state.run.encounterIndex).toBe(0);
    expect(state.rewardChoices).toEqual(generateRewardChoices(42, 0, state.run.build, state.combat.frontline.rewardMultiplier, 4, 0));
    expect(state.run.elapsedCombatTicks).toBe(501);
    expect(state.run.treasureCollected).toBe(4);
    expect(state.run.vehicleHitPoints).toBe(60);
    expect(state.run.breakthroughCharge).toBe(82);
    expect(selectReward(state, state.rewardChoices[0]!.id)).toBe(state);
    expect(rerollRewards(state)).toBe(state);
  });
  it.each(COMBAT_CORE_IDS)('selecting %s preserves rewards, seed, resources and all four module slots', (id) => {
    const state = firstClear();
    state.run.build.moduleIds = ['armor', 'radar', 'ammo-box', 'generator'];
    const previous = structuredClone(state);
    const reward = selectCombatCore(state, id);
    expect(state).toEqual(previous);
    expect(reward.phase).toBe('reward');
    expect(reward.rewardChoices).toBe(state.rewardChoices);
    expect(reward.run).toEqual({ ...state.run, build: { ...state.run.build, coreId: id } });
    expect(reward.combat.build).toEqual(reward.run.build);
    const next = selectReward(reward, reward.rewardChoices[0]!.id);
    expect(next.phase).toBe('combat');
    expect(next.run.encounterIndex).toBe(1);
    expect(next.run.build.coreId).toBe(id);
    expect(next.combat.build.coreId).toBe(id);
    expect(next.combat.core).toEqual(createCombatCoreState());
    expect(next.combat.breakthrough.charge).toBe(82);
    expect(selectCombatCore(next, 'relay')).toBe(next);
  });
  it('rejects forged core IDs and ignores selection outside the choice phase', () => {
    expect(() => selectCombatCore(firstClear(), 'invalid')).toThrow();
    const state = createGameSession();
    expect(selectCombatCore(state, 'counter')).toBe(state);
    const selected = selectCombatCore(firstClear(), 'siege');
    expect(selectCombatCore(selected, 'counter')).toBe(selected);
  });
  it('does not offer a core after defeat or subsequent battles', () => {
    for (const index of [1, 2, 8]) {
      const state = createGameSession();
      state.run.encounterIndex = index;
      state.combat.status = 'victory';
      expect(stepGameSession(state, IDLE_COMMAND, 1 / 60).phase).toBe('reward');
    }
    const state = createGameSession();
    state.combat.status = 'defeat';
    expect(stepGameSession(state, IDLE_COMMAND, 1 / 60).phase).toBe('defeat');
  });
  it.each(['core-choice', 'reward', 'weapon-cache', 'route', 'garage'] as const)('freezes all core timers and ignores firing in %s', (phase) => {
    const state = createGameSession();
    state.phase = phase;
    state.combat.core = { relaySlot: 'primary', relaySeconds: 2, siegeSeconds: 1, counterSeconds: 3 };
    expect(stepGameSession(state, { ...IDLE_COMMAND, firePrimary: true }, 30)).toBe(state);
  });
  it('keeps transient opportunities across a mid-combat weapon cache, but not the next battle/route', () => {
    let state = selectCombatCore(firstClear(), 'counter');
    state = selectReward(state, state.rewardChoices[0]!.id);
    state.phase = 'weapon-cache';
    state.run.pendingWeaponCaches = 1;
    state.rewardChoices = generateWeaponCacheChoices(42, 1, 4, state.run.build, 1);
    state.combat.core.counterSeconds = 2;
    const resumed = selectWeaponCacheReward(state, state.rewardChoices[0]!.id);
    expect(resumed.combat.core.counterSeconds).toBe(2);
    expect(resumed.run.build.coreId).toBe('counter');
    resumed.run.encounterIndex = 2;
    resumed.combat.status = 'victory';
    const reward = stepGameSession(resumed, IDLE_COMMAND, 1 / 60);
    const route = selectReward(reward, reward.rewardChoices[0]!.id);
    expect(route.phase).toBe('route');
    const next = selectRoute(route, route.routeChoices[0]!.id);
    expect(next.combat.build.coreId).toBe('counter');
    expect(next.combat.core).toEqual(createCombatCoreState());
    const restart = restartGameSession(next);
    expect(restart.run.build.coreId).toBeUndefined();
    expect(restart.combat.core).toEqual(createCombatCoreState());
  });
});
