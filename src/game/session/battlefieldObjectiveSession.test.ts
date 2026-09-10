import { describe, expect, it } from 'vitest';
import { createEnemy } from '../combat/createEnemy';
import {
  BATTLEFIELD_OBJECTIVES,
  createRouteChoices,
  type RouteType,
} from '../data/routeDefinitions';
import { generateRewardChoices } from '../reward/rewardSystem';
import {
  IDLE_COMMAND,
  SIMULATION_STEP_SECONDS as DT,
} from '../simulation/types';
import {
  createGameSession,
  rerollRewards,
  restartGameSession,
  selectReward,
  selectRoute,
  selectWeaponCacheReward,
  stepGameSession,
} from './GameSession';

function chooseRoute(type: RouteType, index = 3) {
  const session = createGameSession(42);
  session.phase = 'route';
  session.run.encounterIndex = index;
  session.run.vehicleHitPoints = 25;
  session.run.build.coreId = 'siege';
  session.routeChoices = createRouteChoices(index);
  return selectRoute(
    session,
    session.routeChoices.find((route) => route.type === type)!.id,
  );
}
function almostSecured(kind: 'repair' | 'salvage') {
  const session = chooseRoute(kind);
  session.combat.wave = undefined;
  session.combat.enemies = [
    { ...createEnemy('heavy', 'stationary', 95), speed: 0, hitPoints: 100000 },
  ];
  session.combat.player.position = BATTLEFIELD_OBJECTIVES[kind].position;
  session.combat.player.previousPosition = session.combat.player.position;
  session.combat.objective!.progressSeconds =
    BATTLEFIELD_OBJECTIVES[kind].holdSeconds - DT;
  return session;
}

describe('route objectives and session rewards', () => {
  it.each([3, 6])(
    'offers distinct risk/reward alternatives before encounter index %s',
    (index) => {
      const routes = createRouteChoices(index);
      expect(routes.map(({ type }) => type)).toEqual([
        'normal',
        'elite',
        'repair',
        'salvage',
      ]);
      expect(new Set(routes.map(({ id }) => id)).size).toBe(4);
      for (const route of routes) {
        expect(route.risk.length).toBeGreaterThan(0);
        expect(route.reward.length).toBeGreaterThan(0);
      }
    },
  );
  it('does not offer the equipment detour at the rewardless final battle', () => {
    expect(createRouteChoices(9).map(({ type }) => type)).toEqual([
      'normal',
      'repair',
    ]);
  });
  it.each(['normal', 'elite'] as const)(
    '%s uses the breakout objective without detour guards',
    (type) => {
      const session = chooseRoute(type);
      expect(session.combat.objective?.kind).toBe('breakout');
      expect(session.combat.enemies).toHaveLength(0);
      expect(session.run.objectivesAttempted).toBe(0);
      expect(session.combat.eliteEncounter).toBe(type === 'elite');
    },
  );
  it.each(['repair', 'salvage'] as const)(
    '%s adds exactly its guards but no upfront bonus',
    (kind) => {
      const session = chooseRoute(kind);
      expect(session.combat.enemies.map(({ typeId }) => typeId)).toEqual(
        BATTLEFIELD_OBJECTIVES[kind].guards,
      );
      expect(session.combat.player.hitPoints).toBe(40); // only common +15
      expect(session.run.vehicleHitPoints).toBe(25);
      expect(session.combat.treasureCollected).toBe(0);
      expect(session.run.treasureCollected).toBe(0);
      expect(session.run.rewardRerolls).toBe(0);
      expect(session.run.objectivesAttempted).toBe(1);
      expect(session.run.currentRoute).toBe(kind);
      const next = stepGameSession(session, IDLE_COMMAND, DT);
      expect(new Set(next.combat.enemies.map(({ id }) => id)).size).toBe(
        next.combat.enemies.length,
      );
    },
  );
  it('repairs during combat once and records the secured objective once', () => {
    const session = almostSecured('repair');
    const captured = stepGameSession(session, IDLE_COMMAND, DT);
    expect(captured.phase).toBe('combat');
    expect(captured.combat.player.hitPoints).toBe(80);
    expect(captured.run.objectivesSecured).toBe(1);
    const next = stepGameSession(captured, IDLE_COMMAND, DT);
    expect(next.combat.player.hitPoints).toBe(80);
    expect(next.run.objectivesSecured).toBe(1);
  });
  it('salvage opens one three-choice weapon cache and grants exactly two treasure', () => {
    const session = almostSecured('salvage');
    const captured = stepGameSession(session, IDLE_COMMAND, DT);
    expect(captured.phase).toBe('weapon-cache');
    expect(captured.rewardChoices).toHaveLength(3);
    expect(captured.rewardChoices.every(({ type }) => type === 'weapon')).toBe(
      true,
    );
    expect(captured.run.pendingWeaponCaches).toBe(1);
    expect(captured.combat.treasureCollected).toBe(2);
    expect(captured.run.objectivesSecured).toBe(1);
    expect(captured.combat.player.hitPoints).toBe(40);
    expect(stepGameSession(captured, IDLE_COMMAND, 30)).toBe(captured);
    const equipped = selectWeaponCacheReward(
      captured,
      captured.rewardChoices[0]!.id,
    );
    expect(equipped.phase).toBe('combat');
    expect(equipped.combat.objective).toEqual(captured.combat.objective);
    const next = stepGameSession(equipped, IDLE_COMMAND, DT);
    expect(next.phase).toBe('combat');
    expect(next.combat.treasureCollected).toBe(2);
    expect(next.run.objectivesSecured).toBe(1);
  });
  it('queues an ordinary weapon-cache pickup and objective reward from the same step', () => {
    const session = almostSecured('salvage');
    session.combat.loot = [
      {
        id: 'drop',
        kind: 'weapon-cache',
        position: 65,
        previousPosition: 65,
        ageSeconds: 0,
        value: 1,
      },
    ];
    const captured = stepGameSession(session, IDLE_COMMAND, DT);
    expect(captured.run.pendingWeaponCaches).toBe(2);
    const first = selectWeaponCacheReward(
      captured,
      captured.rewardChoices[0]!.id,
    );
    expect(first.phase).toBe('weapon-cache');
    expect(first.run.pendingWeaponCaches).toBe(1);
    const second = selectWeaponCacheReward(first, first.rewardChoices[0]!.id);
    expect(second.phase).toBe('combat');
    expect(second.run.pendingWeaponCaches).toBe(0);
    expect(second.run.objectivesSecured).toBe(1);
  });
  it('a full clear resolves the cache before battle rewards and totals treasure only once', () => {
    const session = almostSecured('salvage');
    session.combat.enemies = [];
    session.combat.player.position = 10;
    const captured = stepGameSession(session, IDLE_COMMAND, DT);
    expect(captured.phase).toBe('weapon-cache');
    expect(captured.combat.status).toBe('victory');
    const equipped = selectWeaponCacheReward(
      captured,
      captured.rewardChoices[0]!.id,
    );
    const reward = stepGameSession(equipped, IDLE_COMMAND, DT);
    expect(reward.phase).toBe('reward');
    expect(reward.run.treasureCollected).toBe(2);
    expect(reward.run.objectivesSecured).toBe(1);
    expect(stepGameSession(reward, IDLE_COMMAND, DT)).toBe(reward);
    const next = selectReward(reward, reward.rewardChoices[0]!.id);
    expect(next.phase).toBe('combat');
    expect(next.combat.objective?.kind).toBe('breakout');
    expect(next.run.objectivesAttempted).toBe(1);
    expect(next.run.objectivesSecured).toBe(1);
  });
  it('timeout gives no bonus, never blocks progression, and cannot be reclaimed', () => {
    let session = almostSecured('salvage');
    session.combat.player.position = 10;
    session.combat.objective!.remainingSeconds = DT;
    session = stepGameSession(session, IDLE_COMMAND, DT);
    expect(session.combat.objective?.status).toBe('lost');
    expect(session.phase).toBe('combat');
    session.combat.enemies = [];
    session = stepGameSession(session, IDLE_COMMAND, DT);
    expect(session.phase).toBe('reward');
    expect(session.run.treasureCollected).toBe(0);
    expect(session.run.objectivesSecured).toBe(0);
  });
  it.each([
    'garage',
    'route',
    'core-choice',
    'reward',
    'weapon-cache',
  ] as const)('freezes active occupation and deadlines during %s', (phase) => {
    const session = chooseRoute('repair');
    session.phase = phase;
    expect(stepGameSession(session, IDLE_COMMAND, 40)).toBe(session);
  });
  it('starting another run resets statistics and creates a fresh breakout', () => {
    const session = stepGameSession(almostSecured('repair'), IDLE_COMMAND, DT);
    const restarted = restartGameSession(session);
    expect(restarted.run.objectivesAttempted).toBe(0);
    expect(restarted.run.objectivesSecured).toBe(0);
    expect(restarted.combat.objective?.kind).toBe('breakout');
    expect(restarted.combat.objective?.status).toBe('active');
  });
  it('preserves the elite route quality bonus when rerolling', () => {
    const session = chooseRoute('elite');
    session.combat.status = 'victory';
    session.combat.frontline.rewardMultiplier = 1.5;
    const reward = stepGameSession(session, IDLE_COMMAND, DT);
    reward.run.rewardRerolls = 1;
    const rerolled = rerollRewards(reward);
    expect(rerolled.rewardChoices).toEqual(
      generateRewardChoices(
        reward.run.seed,
        reward.run.encounterIndex,
        reward.run.build,
        2.2,
        reward.run.lastEncounterTreasure,
        reward.run.rewardRerollIndex + 1,
      ),
    );
  });
});
