import { describe, expect, it } from 'vitest';
import { MVP_ENCOUNTERS } from '../data/runDefinitions';
import { generateRewardChoices } from '../reward/rewardSystem';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from '../simulation/types';
import {
  createGameSession,
  restartGameSession,
  selectReward,
  stepGameSession,
} from './GameSession';

function completeCurrentCombat(session: ReturnType<typeof createGameSession>) {
  return stepGameSession(
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
});

describe('game session', () => {
  it('starts a ten-encounter run in combat', () => {
    const session = createGameSession(42);

    expect(MVP_ENCOUNTERS).toHaveLength(10);
    expect(session.phase).toBe('combat');
    expect(session.run.encounterIndex).toBe(0);
    expect(session.combat.wave?.id).toBe('prototype-wave');
  });

  it('moves from combat to reward and carries the selected module forward', () => {
    const reward = completeCurrentCombat(createGameSession(42));
    const moduleReward = reward.rewardChoices.find(
      (choice) => choice.type === 'module',
    )!;
    const next = selectReward(reward, moduleReward.id);

    expect(reward.phase).toBe('reward');
    expect(reward.rewardChoices).toHaveLength(3);
    expect(next.phase).toBe('combat');
    expect(next.run.encounterIndex).toBe(1);
    expect(next.run.build.moduleIds).toContain(
      moduleReward.type === 'module' ? moduleReward.moduleId : '',
    );
    expect(next.combat.player.hitPoints).toBe(87);
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
    expect(restarted.phase).toBe('combat');
    expect(restarted.run.seed).toBe(11);
    expect(restarted.run.encounterIndex).toBe(0);
    expect(restarted.run.build.moduleIds).toEqual([]);
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
