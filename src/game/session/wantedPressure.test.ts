import { describe, expect, it } from 'vitest';
import {
  createGameSession,
  selectReward,
  selectWeaponCacheReward,
} from './GameSession';
import {
  MAX_WANTED_LEVEL,
  addWantedLevel,
  wantedPursuit,
  wantedRewardRisk,
  wantedRewardWarning,
} from './wantedPressure';
import type { RewardChoice } from '../reward/rewardSystem';

function moduleReward(rarity: 'common' | 'rare' | 'epic'): RewardChoice {
  return {
    id: 'module:armor',
    type: 'module',
    moduleId: 'armor',
    displayName: '追加装甲',
    description: 'test reward',
    rarity,
  };
}

describe('wanted pressure', () => {
  it('turns every accepted reward into future pursuit pressure', () => {
    const session = createGameSession(7);
    session.phase = 'reward';
    session.rewardChoices = [moduleReward('common')];

    const next = selectReward(session, 'module:armor');

    expect(next.run.wantedLevel).toBe(1);
    expect(next.phase).toBe('combat');
    expect(
      next.combat.enemies.map((enemy) => [enemy.id, enemy.typeId]),
    ).toContainEqual(['wanted-pursuer-1-0', 'rusher']);
  });

  it('makes rarer loot accelerate the hunt and caps it at six', () => {
    expect(addWantedLevel(0, 'common')).toBe(1);
    expect(addWantedLevel(1, 'rare')).toBe(3);
    expect(addWantedLevel(4, 'epic')).toBe(MAX_WANTED_LEVEL);
    expect(wantedPursuit(MAX_WANTED_LEVEL)).toEqual([
      'rusher',
      'bomber',
      'artillery',
      'heavy',
    ]);
  });

  it('feeds wanted pressure back into reward quality', () => {
    expect(wantedRewardRisk(0)).toBe(0);
    expect(wantedRewardRisk(3)).toBeCloseTo(2.4);
    expect(wantedRewardRisk(MAX_WANTED_LEVEL)).toBeCloseTo(4.8);
    expect(wantedRewardWarning('epic', 4)).toContain('追跡熱 4→6/6');
    expect(wantedRewardWarning('common', 6)).toContain('追跡熱 MAX 6/6');
  });

  it('also charges pursuit for weapons stolen from battlefield caches', () => {
    const session = createGameSession(13);
    session.phase = 'weapon-cache';
    session.run.pendingWeaponCaches = 1;
    session.rewardChoices = [
      {
        id: 'weapon:railgun',
        type: 'weapon',
        weaponId: 'railgun',
        displayName: 'レールガン',
        description: 'test cache',
        rarity: 'rare',
        currentLevel: 1,
        nextLevel: 2,
        isUpgrade: false,
      },
    ];

    const next = selectWeaponCacheReward(session, 'weapon:railgun', 'secondary');

    expect(next.run.wantedLevel).toBe(2);
    expect(next.phase).toBe('combat');
  });
});
