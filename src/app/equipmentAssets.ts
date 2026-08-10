import type { ModuleId, WeaponId } from '../game/data/ids';
import { runtimeAssetUrl } from '../runtimeAssets';

export const WEAPON_ART: Readonly<Record<WeaponId, string>> = {
  'machine-cannon': runtimeAssetUrl(
    'assets/equipment/wpn_machine_cannon_v001.png',
  ),
  'scatter-cannon': runtimeAssetUrl(
    'assets/equipment/wpn_scatter_cannon_v001.png',
  ),
  flamethrower: runtimeAssetUrl('assets/equipment/wpn_flamethrower_v001.png'),
  'rocket-launcher': runtimeAssetUrl(
    'assets/equipment/wpn_rocket_launcher_v001.png',
  ),
  railgun: runtimeAssetUrl('assets/equipment/wpn_railgun_v001.png'),
  'mine-launcher': runtimeAssetUrl(
    'assets/equipment/wpn_mine_launcher_v001.png',
  ),
};

export const MODULE_ART: Readonly<Record<ModuleId, string>> = {
  'cooling-fan': runtimeAssetUrl('assets/equipment/mod_cooling_fan_v001.png'),
  generator: runtimeAssetUrl('assets/equipment/mod_generator_v001.png'),
  'ammo-box': runtimeAssetUrl('assets/equipment/mod_ammo_box_v001.png'),
  armor: runtimeAssetUrl('assets/equipment/mod_armor_v001.png'),
  'shield-generator': runtimeAssetUrl(
    'assets/equipment/mod_shield_generator_v001.png',
  ),
  radar: runtimeAssetUrl('assets/equipment/mod_radar_v001.png'),
  'heat-recycler': runtimeAssetUrl(
    'assets/equipment/mod_heat_recycler_v001.png',
  ),
  capacitor: runtimeAssetUrl('assets/equipment/mod_capacitor_v001.png'),
  'magnetic-armor': runtimeAssetUrl(
    'assets/equipment/mod_magnetic_armor_v001.png',
  ),
  'explosive-magazine': runtimeAssetUrl(
    'assets/equipment/mod_explosive_magazine_v001.png',
  ),
};

export function getEquipmentArt(id: string): string | undefined {
  return WEAPON_ART[id as WeaponId] ?? MODULE_ART[id as ModuleId];
}
