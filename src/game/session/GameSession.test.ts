import { describe, expect, it } from 'vitest';
import { MVP_ENCOUNTERS } from '../data/runDefinitions';
import { generateRewardChoices } from '../reward/rewardSystem';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from '../simulation/types';
import {
  createGarageSession,
  createGameSession,
  rerollRewards,
  restartGameSession,
  selectRoute,
  selectCombatCore,
  selectReward,
  selectWeaponCacheReward,
  startGameSession,
  stepGameSession,
} from './GameSession';

function completeCurrentCombat(session: ReturnType<typeof createGameSession>) {
  const resolved = stepGameSession(
    {
      ...session,
      combat: {
        ...session.combat,
        status: 'victory',
        player: { ...session.combat.player, hitPoints: 72 },
      },
    },
    IDLE_COMMAND,
    SIMULATION_STEP_SECONDS,
  );
  return resolved.phase === 'core-choice'
    ? selectCombatCore(resolved, 'counter')
    : resolved;
}

describe('reward generation', () => {
  it('returns three unique, replayable choices including a weapon and module', () => {
    const session = createGameSession(123);
    const left = generateRewardChoices(123, 0, session.run.build, 1.7);
    const right = generateRewardChoices(123, 0, session.run.build, 1.7);

    expect(left).toEqual(right);
    expect(left).toHaveLength(3);
    expect(new Set(left.map((choice) => choice.id)).size).toBe(3);
    expect(left.some((choice) => choice.type === 'weapon')).toBe(true);
    expect(left.some((choice) => choice.type === 'module')).toBe(true);
  });

  it('allows an equipped weapon to return as a deterministic upgrade', () => {
    const session = createGameSession(1);
    const upgrade = Array.from({ length: 100 }, (_, seed) =>
      generateRewardChoices(seed, 0, session.run.build, 1.7, 4),
    )
      .flat()
      .find((choice) => choice.type === 'weapon' && choice.isUpgrade);

    expect(upgrade).toBeDefined();
    expect(upgrade?.type === 'weapon' && upgrade.nextLevel).toBeGreaterThan(1);
  });
});

describe('game session', () => {
  it('starts a ten-encounter run in combat', () => {
    const session = createGameSession(42);

    expect(MVP_ENCOUNTERS).toHaveLength(10);
    expect(session.phase).toBe('combat');
    expect(session.run.encounterIndex).toBe(0);
    expect(session.run.elapsedCombatTicks).toBe(0);
    expect(session.run.lastEncounterTicks).toBe(0);
    expect(session.combat.wave?.id).toBe('battle-01-wave');
  });

  it('starts from the garage with the selected initial loadout', () => {
    const garage = createGarageSession(9);
    const started = startGameSession(garage, 'close-range');

    expect(garage.phase).toBe('garage');
    expect(started.phase).toBe('combat');
    expect(started.run.build.primaryWeaponId).toBe('scatter-cannon');
    expect(started.run.build.secondaryWeaponId).toBe('flamethrower');
  });

  it('moves from combat to reward and carries the selected module forward', () => {
    const reward = completeCurrentCombat(createGameSession(42));
    const moduleReward = reward.rewardChoices.find(
      (choice) => choice.type === 'module',
    )!;
    const next = selectReward(reward, moduleReward.id);

    expect(reward.phase).toBe('reward');
    expect(reward.rewardChoices).toHaveLength(3);
    expect(reward.run.elapsedCombatTicks).toBe(1);
    expect(reward.run.lastEncounterTicks).toBe(1);
    expect(next.phase).toBe('combat');
    expect(next.run.encounterIndex).toBe(1);
    expect(next.run.build.moduleIds).toContain(
      moduleReward.type === 'module' ? moduleReward.moduleId : '',
    );
    expect(next.combat.player.hitPoints).toBe(87);
  });

  it('replaces the oldest module when all four slots are occupied', () => {
    const session = createGameSession(42);
    session.run.build.moduleIds = [
      'cooling-fan',
      'generator',
      'ammo-box',
      'armor',
    ];
    const reward = completeCurrentCombat(session);
    const moduleReward = reward.rewardChoices.find(
      (choice) => choice.type === 'module',
    )!;
    const next = selectReward(reward, moduleReward.id);

    expect(next.run.build.moduleIds).toEqual([
      'generator',
      'ammo-box',
      'armor',
      moduleReward.type === 'module' ? moduleReward.moduleId : '',
    ]);
  });

  it('lets a weapon reward replace the selected weapon slot', () => {
    const reward = completeCurrentCombat(createGameSession(7));
    const weaponReward = reward.rewardChoices.find(
      (choice) => choice.type === 'weapon',
    )!;
    const next = selectReward(reward, weaponReward.id, 'primary');

    expect(next.run.build.primaryWeaponId).toBe(
      weaponReward.type === 'weapon' ? weaponReward.weaponId : '',
    );
  });

  it('upgrades an equipped weapon without changing its slot', () => {
    const session = createGameSession(7);
    session.phase = 'reward';
    session.rewardChoices = [
      {
        id: 'weapon:machine-cannon',
        type: 'weapon',
        weaponId: 'machine-cannon',
        displayName: '機関砲',
        description: '連射機構を高速化',
        rarity: 'common',
        currentLevel: 1,
        nextLevel: 2,
        isUpgrade: true,
      },
    ];
    const next = selectReward(session, 'weapon:machine-cannon');

    expect(next.run.build.primaryWeaponId).toBe('machine-cannon');
    expect(next.run.build.weaponLevels['machine-cannon']).toBe(2);
  });

  it('pauses combat for a collected weapon cache and resumes after equipping', () => {
    const session = createGameSession(17);
    session.combat.loot = [
      {
        id: 'weapon-cache-test',
        kind: 'weapon-cache',
        previousPosition: session.combat.player.position,
        position: session.combat.player.position,
        value: 1,
        ageSeconds: 0,
      },
    ];

    const paused = stepGameSession(
      session,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );
    const choice = paused.rewardChoices[0]!;
    const resumed = selectWeaponCacheReward(paused, choice.id, 'secondary');

    expect(paused.phase).toBe('weapon-cache');
    expect(paused.rewardChoices).toHaveLength(3);
    expect(paused.rewardChoices.every(({ type }) => type === 'weapon')).toBe(
      true,
    );
    expect(resumed.phase).toBe('combat');
    expect(resumed.run.encounterIndex).toBe(0);
    expect(resumed.run.pendingWeaponCaches).toBe(0);
    expect(resumed.combat.build).toEqual(resumed.run.build);
  });

  it('opens a final weapon cache before resolving battle victory', () => {
    const session = createGameSession(18);
    session.combat.enemies = [];
    session.combat.projectiles = [];
    session.combat.enemyProjectiles = [];
    if (session.combat.wave) session.combat.wave.completed = true;
    if (session.combat.objective?.kind === 'breakout') {
      session.combat.objective.status = 'secured';
    }
    session.combat.loot = [
      {
        id: 'last-weapon-cache',
        kind: 'weapon-cache',
        previousPosition: session.combat.player.position,
        position: session.combat.player.position,
        value: 1,
        ageSeconds: 0,
      },
    ];

    const paused = stepGameSession(
      session,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );
    const equipped = selectWeaponCacheReward(
      paused,
      paused.rewardChoices[0]!.id,
      'secondary',
    );
    const resolved = stepGameSession(
      equipped,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(paused.phase).toBe('weapon-cache');
    expect(paused.combat.status).toBe('victory');
    expect(equipped.phase).toBe('combat');
    expect(resolved.phase).toBe('core-choice');
    expect(selectCombatCore(resolved, 'counter').phase).toBe('reward');
  });

  it('offers route decisions and defers salvage benefits until capture', () => {
    const session = createGameSession(3);
    session.phase = 'reward';
    session.run.encounterIndex = 5;
    session.rewardChoices = [
      {
        id: 'module:armor',
        type: 'module',
        moduleId: 'armor',
        displayName: '追加装甲',
        description: '装甲',
        rarity: 'common',
      },
    ];
    const routed = selectReward(session, 'module:armor');
    const salvage = routed.routeChoices.find(({ type }) => type === 'salvage');
    const selected = salvage ? selectRoute(routed, salvage.id) : routed;

    expect(routed.phase).toBe('route');
    expect(routed.routeChoices).toHaveLength(4);
    expect(salvage).toBeDefined();
    expect(selected.phase).toBe('combat');
    expect(selected.run.treasureCollected).toBe(0);
    expect(selected.run.rewardRerolls).toBe(0);
    expect(selected.combat.objective?.kind).toBe('salvage');
  });

  it('spends a treasure reroll on a new deterministic reward set', () => {
    const session = createGameSession(8);
    session.phase = 'reward';
    session.run.rewardRerolls = 1;
    session.rewardChoices = generateRewardChoices(
      8,
      0,
      session.run.build,
      1,
      4,
    );
    const rerolled = rerollRewards(session);

    expect(rerolled.run.rewardRerolls).toBe(0);
    expect(rerolled.run.rewardRerollIndex).toBe(1);
    expect(rerolled.rewardChoices).not.toEqual(session.rewardChoices);
  });

  it('enters defeat, resets run state and advances the seed', () => {
    const session = createGameSession(10);
    session.run.build.moduleIds = ['armor'];
    const defeated = stepGameSession(
      { ...session, combat: { ...session.combat, status: 'defeat' } },
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );
    const restarted = restartGameSession(defeated);

    expect(defeated.phase).toBe('defeat');
    expect(restarted.phase).toBe('garage');
    expect(restarted.run.seed).toBe(11);
    expect(restarted.run.encounterIndex).toBe(0);
    expect(restarted.run.build.moduleIds).toEqual([]);
    expect(defeated.run.elapsedCombatTicks).toBe(1);
    expect(restarted.run.elapsedCombatTicks).toBe(0);
  });

  it('ends the run after the tenth encounter boss', () => {
    const session = createGameSession(99);
    session.run.encounterIndex = 9;
    session.combat.status = 'victory';
    const result = stepGameSession(
      session,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(result.phase).toBe('victory');
    expect(result.rewardChoices).toEqual([]);
  });
});
