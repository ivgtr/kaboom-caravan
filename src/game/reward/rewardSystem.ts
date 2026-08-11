import type { ModuleId, WeaponId } from '../data/ids';
import { MODULE_DEFINITIONS } from '../data/moduleDefinitions';
import { WEAPON_DEFINITIONS } from '../data/weaponDefinitions';
import { createSeededRandom, type RandomSource } from '../simulation/random';
import type { BuildState } from '../simulation/types';
import {
  getWeaponLevel,
  getWeaponUpgradeSummary,
  isWeaponEquipped,
  MAX_WEAPON_LEVEL,
  type WeaponLevel,
} from '../build/weaponUpgrade';

export type RewardRarity = 'common' | 'rare' | 'epic';

export type RewardChoice =
  | {
      id: string;
      type: 'weapon';
      weaponId: WeaponId;
      displayName: string;
      description: string;
      rarity: RewardRarity;
      currentLevel: WeaponLevel;
      nextLevel: WeaponLevel;
      isUpgrade: boolean;
    }
  | {
      id: string;
      type: 'module';
      moduleId: ModuleId;
      displayName: string;
      description: string;
      rarity: RewardRarity;
    };

const SPECIAL_MODULES = new Set<ModuleId>([
  'heat-recycler',
  'capacitor',
  'magnetic-armor',
  'explosive-magazine',
]);

function rewardSeed(
  seed: number,
  encounterIndex: number,
  rerollIndex: number,
): number {
  return (
    (seed ^
      Math.imul(encounterIndex + 1, 0x9e3779b1) ^
      Math.imul(rerollIndex + 1, 0x85ebca6b)) >>>
    0
  );
}

function weightedPick<T>(
  items: readonly T[],
  weight: (item: T) => number,
  random: RandomSource,
): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let cursor = random.next() * total;
  for (const item of items) {
    cursor -= weight(item);
    if (cursor <= 0) return item;
  }
  return items.at(-1)!;
}

function rewardRarity(
  treasureValue: number,
  riskMultiplier: number,
  random: RandomSource,
): RewardRarity {
  const quality = treasureValue * 0.035 + (riskMultiplier - 1) * 0.12;
  const roll = random.next() + quality;
  if (roll >= 1.18) return 'epic';
  if (roll >= 0.72) return 'rare';
  return 'common';
}

function weaponChoice(
  weaponId: WeaponId,
  build: BuildState,
  rarity: RewardRarity,
): RewardChoice {
  const definition = WEAPON_DEFINITIONS[weaponId];
  const currentLevel = getWeaponLevel(build, weaponId);
  const isUpgrade = isWeaponEquipped(build, weaponId);
  const levelGain =
    rarity === 'epic' ? 2 : rarity === 'rare' ? 1 : isUpgrade ? 1 : 0;
  const nextLevel = Math.min(
    MAX_WEAPON_LEVEL,
    currentLevel + levelGain,
  ) as WeaponLevel;
  return {
    id: `weapon:${weaponId}`,
    type: 'weapon',
    weaponId,
    displayName: definition.displayName,
    description:
      isUpgrade || nextLevel > 1
        ? getWeaponUpgradeSummary(weaponId, nextLevel)
        : definition.description,
    rarity,
    currentLevel,
    nextLevel,
    isUpgrade,
  };
}

function moduleChoice(moduleId: ModuleId, rarity: RewardRarity): RewardChoice {
  const definition = MODULE_DEFINITIONS[moduleId];
  return {
    id: `module:${moduleId}`,
    type: 'module',
    moduleId,
    displayName: definition.displayName,
    description: definition.description,
    rarity,
  };
}

export function generateRewardChoices(
  seed: number,
  encounterIndex: number,
  build: BuildState,
  riskMultiplier: number,
  treasureValue = 0,
  rerollIndex = 0,
): RewardChoice[] {
  const random = createSeededRandom(
    rewardSeed(seed, encounterIndex, rerollIndex),
  );
  const availableWeapons = (
    Object.keys(WEAPON_DEFINITIONS) as WeaponId[]
  ).filter(
    (weaponId) =>
      !isWeaponEquipped(build, weaponId) ||
      getWeaponLevel(build, weaponId) < MAX_WEAPON_LEVEL,
  );
  const availableModules = (
    Object.keys(MODULE_DEFINITIONS) as ModuleId[]
  ).filter((moduleId) => !build.moduleIds.includes(moduleId));

  const firstWeapon = weightedPick(
    availableWeapons,
    (weaponId) => (isWeaponEquipped(build, weaponId) ? 1.8 : 1),
    random,
  );
  const firstModule = weightedPick(
    availableModules,
    (moduleId) => (SPECIAL_MODULES.has(moduleId) ? riskMultiplier : 1),
    random,
  );
  const remaining = [
    ...availableWeapons
      .filter((weaponId) => weaponId !== firstWeapon)
      .map((weaponId) =>
        weaponChoice(
          weaponId,
          build,
          rewardRarity(treasureValue, riskMultiplier, random),
        ),
      ),
    ...availableModules
      .filter((moduleId) => moduleId !== firstModule)
      .map((moduleId) =>
        moduleChoice(
          moduleId,
          rewardRarity(treasureValue, riskMultiplier, random),
        ),
      ),
  ];
  const third = weightedPick(
    remaining,
    (choice) =>
      choice.type === 'module' && SPECIAL_MODULES.has(choice.moduleId)
        ? riskMultiplier
        : 1,
    random,
  );

  return [
    weaponChoice(
      firstWeapon,
      build,
      rewardRarity(treasureValue, riskMultiplier, random),
    ),
    moduleChoice(
      firstModule,
      rewardRarity(treasureValue, riskMultiplier, random),
    ),
    third,
  ];
}
