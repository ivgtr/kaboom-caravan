import type { WeaponDefinition } from '../data/weaponDefinitions';
import { MODULE_DEFINITIONS } from '../data/moduleDefinitions';
import type { BuildState } from '../simulation/types';
import { evaluateModifiers } from './modifier';
import type {
  PlayerStat,
  PlayerStatModifier,
  WeaponStat,
  WeaponStatModifier,
} from './types';

export interface PlayerDerivedStats {
  moveSpeed: number;
  coolingPerSecond: number;
  energyPerSecond: number;
  maximumAmmo: number;
  maximumEnergy: number;
  maximumHitPoints: number;
  armor: number;
}

const BASE_PLAYER_STATS: PlayerDerivedStats = {
  moveSpeed: 12,
  coolingPerSecond: 12,
  energyPerSecond: 10,
  maximumAmmo: 30,
  maximumEnergy: 100,
  maximumHitPoints: 100,
  armor: 1,
};

function moduleModifiers(build: BuildState) {
  return build.moduleIds.flatMap(
    (moduleId) => MODULE_DEFINITIONS[moduleId].modifiers,
  );
}

export function derivePlayerStats(build: BuildState): PlayerDerivedStats {
  const modifiers = moduleModifiers(build).filter(
    (modifier): modifier is PlayerStatModifier => modifier.target === 'player',
  );
  const evaluate = (stat: PlayerStat) =>
    evaluateModifiers(
      BASE_PLAYER_STATS[stat],
      modifiers.filter((modifier) => modifier.stat === stat),
    );

  return {
    moveSpeed: evaluate('moveSpeed'),
    coolingPerSecond: evaluate('coolingPerSecond'),
    energyPerSecond: evaluate('energyPerSecond'),
    maximumAmmo: evaluate('maximumAmmo'),
    maximumEnergy: evaluate('maximumEnergy'),
    maximumHitPoints: evaluate('maximumHitPoints'),
    armor: Math.max(0, evaluate('armor')),
  };
}

export function deriveWeaponDefinition(
  definition: WeaponDefinition,
  build: BuildState,
): WeaponDefinition {
  const modifiers = moduleModifiers(build).filter(
    (modifier): modifier is WeaponStatModifier =>
      modifier.target === 'weapon' &&
      (!modifier.requiredTag || definition.tags.includes(modifier.requiredTag)),
  );
  const evaluate = (stat: WeaponStat) =>
    evaluateModifiers(
      definition[stat],
      modifiers.filter((modifier) => modifier.stat === stat),
    );

  return {
    ...definition,
    damage: evaluate('damage'),
    cooldownSeconds: Math.max(0.05, evaluate('cooldownSeconds')),
    maximumRange: Math.max(1, evaluate('maximumRange')),
    energyCost: Math.max(0, evaluate('energyCost')),
    heatGenerated: Math.max(0, evaluate('heatGenerated')),
  };
}
