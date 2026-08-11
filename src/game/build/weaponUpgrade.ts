import type { WeaponId } from '../data/ids';
import type { BuildState } from '../simulation/types';

export type WeaponLevel = 1 | 2 | 3;

export const MAX_WEAPON_LEVEL: WeaponLevel = 3;

export function getWeaponLevel(
  build: BuildState,
  weaponId: WeaponId,
): WeaponLevel {
  return build.weaponLevels[weaponId] ?? 1;
}

export function isWeaponEquipped(
  build: BuildState,
  weaponId: WeaponId,
): boolean {
  return (
    build.primaryWeaponId === weaponId || build.secondaryWeaponId === weaponId
  );
}

export function upgradeWeapon(
  build: BuildState,
  weaponId: WeaponId,
): BuildState {
  const current = getWeaponLevel(build, weaponId);
  if (current >= MAX_WEAPON_LEVEL) return build;
  return {
    ...build,
    weaponLevels: {
      ...build.weaponLevels,
      [weaponId]: (current + 1) as WeaponLevel,
    },
  };
}

export function rememberEquippedWeapon(
  build: BuildState,
  weaponId: WeaponId,
): BuildState {
  if (build.weaponLevels[weaponId]) return build;
  return {
    ...build,
    weaponLevels: { ...build.weaponLevels, [weaponId]: 1 },
  };
}

export function getWeaponUpgradeSummary(
  weaponId: WeaponId,
  level: WeaponLevel,
): string {
  const summaries: Record<WeaponId, readonly [string, string]> = {
    'machine-cannon': ['連射機構を高速化', 'Twin Shot機構を解禁'],
    'scatter-cannon': ['散弾を6発へ増加', '散弾を7発へ増加'],
    flamethrower: ['炎の持続Hitを延長', '炎の射程と威力を強化'],
    'rocket-launcher': ['爆発半径を拡大', '巨大な広域爆発へ進化'],
    railgun: ['貫通数と出力を強化', '貫通減衰のない超高出力化'],
    'mine-launcher': ['爆発半径を拡大', '2個のMineを同時展開'],
  };
  return summaries[weaponId][Math.max(0, level - 2)]!;
}
