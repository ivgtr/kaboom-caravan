import type { EnemyTypeId } from '../data/ids';

export type WantedRarity = 'common' | 'rare' | 'epic';

export const MAX_WANTED_LEVEL = 6;

const WANTED_GAIN: Record<WantedRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
};

const PURSUIT_BY_LEVEL: readonly (readonly EnemyTypeId[])[] = [
  [],
  ['rusher'],
  ['rusher', 'basic'],
  ['rusher', 'bomber'],
  ['rusher', 'bomber', 'basic'],
  ['rusher', 'bomber', 'artillery'],
  ['rusher', 'bomber', 'artillery', 'heavy'],
];

export function clampWantedLevel(level: number): number {
  return Math.max(0, Math.min(MAX_WANTED_LEVEL, Math.floor(level)));
}

export function wantedGainForRarity(rarity: WantedRarity): number {
  return WANTED_GAIN[rarity];
}

export function addWantedLevel(
  currentLevel: number,
  rarity: WantedRarity,
): number {
  return clampWantedLevel(currentLevel + wantedGainForRarity(rarity));
}

/**
 * Wanted pressure feeds back into reward quality. At the cap this contributes
 * +4.8 risk, enough to make rare/epic rewards common without guaranteeing them.
 */
export function wantedRewardRisk(level: number): number {
  return clampWantedLevel(level) * 0.8;
}

export function wantedPursuit(level: number): readonly EnemyTypeId[] {
  return PURSUIT_BY_LEVEL[clampWantedLevel(level)]!;
}

export function wantedRewardWarning(
  rarity: WantedRarity,
  currentLevel = 0,
): string {
  const current = clampWantedLevel(currentLevel);
  const next = addWantedLevel(current, rarity);
  if (current >= MAX_WANTED_LEVEL) {
    return `追跡熱 MAX ${MAX_WANTED_LEVEL}/${MAX_WANTED_LEVEL}：最凶の追撃が継続`;
  }
  return `追跡熱 ${current}→${next}/${MAX_WANTED_LEVEL}：次戦の追撃部隊が強化`;
}
