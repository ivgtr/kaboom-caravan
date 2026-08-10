import type { ModuleId, WeaponId } from '../data/ids';
import { MODULE_DEFINITIONS } from '../data/moduleDefinitions';
import { WEAPON_DEFINITIONS } from '../data/weaponDefinitions';
import { createSeededRandom, type RandomSource } from '../simulation/random';
import type { BuildState } from '../simulation/types';

export type RewardChoice =
  | {
      id: string;
      type: 'weapon';
      weaponId: WeaponId;
      displayName: string;
      description: string;
    }
  | {
      id: string;
      type: 'module';
      moduleId: ModuleId;
      displayName: string;
      description: string;
    };

const SPECIAL_MODULES = new Set<ModuleId>([
  'heat-recycler',
  'capacitor',
  'magnetic-armor',
  'explosive-magazine',
]);

function rewardSeed(seed: number, encounterIndex: number): number {
  return (seed ^ Math.imul(encounterIndex + 1, 0x9e3779b1)) >>> 0;
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

function weaponChoice(weaponId: WeaponId): RewardChoice {
  const definition = WEAPON_DEFINITIONS[weaponId];
  return {
    id: `weapon:${weaponId}`,
    type: 'weapon',
    weaponId,
    displayName: definition.displayName,
    description: definition.description,
  };
}

function moduleChoice(moduleId: ModuleId): RewardChoice {
  const definition = MODULE_DEFINITIONS[moduleId];
  return {
    id: `module:${moduleId}`,
    type: 'module',
    moduleId,
    displayName: definition.displayName,
    description: definition.description,
  };
}

export function generateRewardChoices(
  seed: number,
  encounterIndex: number,
  build: BuildState,
  riskMultiplier: number,
): RewardChoice[] {
  const random = createSeededRandom(rewardSeed(seed, encounterIndex));
  const availableWeapons = (
    Object.keys(WEAPON_DEFINITIONS) as WeaponId[]
  ).filter(
    (weaponId) =>
      weaponId !== build.primaryWeaponId &&
      weaponId !== build.secondaryWeaponId,
  );
  const availableModules = (
    Object.keys(MODULE_DEFINITIONS) as ModuleId[]
  ).filter((moduleId) => !build.moduleIds.includes(moduleId));

  const firstWeapon = weightedPick(availableWeapons, () => 1, random);
  const firstModule = weightedPick(
    availableModules,
    (moduleId) => (SPECIAL_MODULES.has(moduleId) ? riskMultiplier : 1),
    random,
  );
  const remaining = [
    ...availableWeapons
      .filter((weaponId) => weaponId !== firstWeapon)
      .map(weaponChoice),
    ...availableModules
      .filter((moduleId) => moduleId !== firstModule)
      .map(moduleChoice),
  ];
  const third = weightedPick(
    remaining,
    (choice) =>
      choice.type === 'module' && SPECIAL_MODULES.has(choice.moduleId)
        ? riskMultiplier
        : 1,
    random,
  );

  return [weaponChoice(firstWeapon), moduleChoice(firstModule), third];
}
