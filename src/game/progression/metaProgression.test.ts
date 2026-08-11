import { beforeEach, describe, expect, it } from 'vitest';
import { createGameSession } from '../session/GameSession';
import {
  DEFAULT_META_PROGRESSION,
  loadMetaProgression,
  recordCompletedRun,
} from './metaProgression';

describe('meta progression', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => Array.from(values.keys())[index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, String(value)),
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
  });

  it('records a victory, best time and the explosive loadout unlock', () => {
    const session = createGameSession(42, 'close-range');
    session.phase = 'victory';
    session.run.encounterIndex = 9;
    session.run.elapsedCombatTicks = 6_000;
    session.run.treasureCollected = 8;
    session.run.enemiesDefeated = 44;
    session.run.parries = 5;
    session.run.damageDealt = 12_345.4;

    const saved = recordCompletedRun(DEFAULT_META_PROGRESSION, session);
    const loaded = loadMetaProgression();

    expect(saved.totalRuns).toBe(1);
    expect(saved.bestVictoryTicks).toBe(6_000);
    expect(saved.unlockedLoadouts).toContain('explosive');
    expect(saved.history[0]).toMatchObject({
      result: 'victory',
      loadoutId: 'close-range',
      encountersCompleted: 10,
      treasureCollected: 8,
      enemiesDefeated: 44,
      parries: 5,
      damageDealt: 12_345,
    });
    expect(loaded).toEqual(saved);
  });

  it('unlocks the explosive loadout after collecting fifteen treasures', () => {
    const session = createGameSession(7);
    session.phase = 'defeat';
    session.run.treasureCollected = 15;

    const saved = recordCompletedRun(DEFAULT_META_PROGRESSION, session);

    expect(saved.unlockedLoadouts).toContain('explosive');
    expect(saved.bestVictoryTicks).toBeUndefined();
  });
});
