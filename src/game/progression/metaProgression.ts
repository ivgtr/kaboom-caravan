import type { LoadoutId } from '../data/loadoutDefinitions';
import type { GameSessionState } from '../session/GameSession';

const STORAGE_KEY = 'kaboom-caravan:progression:v1';
const SAVE_VERSION = 1;
const HISTORY_LIMIT = 10;

export interface RunRecord {
  completedAt: string;
  result: 'victory' | 'defeat';
  loadoutId: LoadoutId;
  elapsedCombatTicks: number;
  encountersCompleted: number;
  treasureCollected: number;
  enemiesDefeated: number;
  parries: number;
  damageDealt: number;
}

export interface MetaProgression {
  version: 1;
  totalRuns: number;
  totalTreasure: number;
  bestVictoryTicks?: number;
  unlockedLoadouts: LoadoutId[];
  history: RunRecord[];
}

export const DEFAULT_META_PROGRESSION: MetaProgression = {
  version: SAVE_VERSION,
  totalRuns: 0,
  totalTreasure: 0,
  unlockedLoadouts: ['standard', 'close-range'],
  history: [],
};

export function loadMetaProgression(): MetaProgression {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_META_PROGRESSION);
    const parsed = JSON.parse(raw) as Partial<MetaProgression>;
    if (parsed.version !== SAVE_VERSION) {
      return structuredClone(DEFAULT_META_PROGRESSION);
    }
    return {
      ...DEFAULT_META_PROGRESSION,
      ...parsed,
      unlockedLoadouts: Array.from(
        new Set([
          'standard' as const,
          'close-range' as const,
          ...(parsed.unlockedLoadouts ?? []),
        ]),
      ),
      history: (parsed.history ?? []).slice(0, HISTORY_LIMIT),
    };
  } catch {
    return structuredClone(DEFAULT_META_PROGRESSION);
  }
}

export function recordCompletedRun(
  meta: MetaProgression,
  session: GameSessionState,
): MetaProgression {
  const result = session.phase === 'victory' ? 'victory' : 'defeat';
  const record: RunRecord = {
    completedAt: new Date().toISOString(),
    result,
    loadoutId: session.run.loadoutId,
    elapsedCombatTicks: session.run.elapsedCombatTicks,
    encountersCompleted:
      session.run.encounterIndex + (session.phase === 'victory' ? 1 : 0),
    treasureCollected: session.run.treasureCollected,
    enemiesDefeated: session.run.enemiesDefeated,
    parries: session.run.parries,
    damageDealt: Math.round(session.run.damageDealt),
  };
  const totalTreasure = meta.totalTreasure + record.treasureCollected;
  const unlockExplosive = result === 'victory' || totalTreasure >= 15;
  const unlockedLoadouts = unlockExplosive
    ? Array.from(new Set([...meta.unlockedLoadouts, 'explosive' as const]))
    : meta.unlockedLoadouts;
  const next: MetaProgression = {
    ...meta,
    totalRuns: meta.totalRuns + 1,
    totalTreasure,
    unlockedLoadouts,
    history: [record, ...meta.history].slice(0, HISTORY_LIMIT),
    ...(result === 'victory'
      ? {
          bestVictoryTicks: Math.min(
            meta.bestVictoryTicks ?? Number.POSITIVE_INFINITY,
            record.elapsedCombatTicks,
          ),
        }
      : {}),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing and storage quotas must not block starting another run.
  }
  return next;
}
