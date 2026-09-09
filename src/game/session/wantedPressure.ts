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

export function wantedRewardWarning(rarity: WantedRarity): string {
  const gain = wantedGainForRarity(rarity);
  return `追跡熱 +${gain}：次戦の追撃部隊が強化される`;
}
