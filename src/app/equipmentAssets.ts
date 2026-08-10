import type { ModuleId, WeaponId } from '../game/data/ids';

export const WEAPON_ART: Readonly<Record<WeaponId, string>> = {
  'machine-cannon': '/assets/equipment/wpn_machine_cannon_v001.png',
  'scatter-cannon': '/assets/equipment/wpn_scatter_cannon_v001.png',
  flamethrower: '/assets/equipment/wpn_flamethrower_v001.png',
  'rocket-launcher': '/assets/equipment/wpn_rocket_launcher_v001.png',
  railgun: '/assets/equipment/wpn_railgun_v001.png',
  'mine-launcher': '/assets/equipment/wpn_mine_launcher_v001.png',
};

export const MODULE_ART: Readonly<Record<ModuleId, string>> = {
  'cooling-fan': '/assets/equipment/mod_cooling_fan_v001.png',
  generator: '/assets/equipment/mod_generator_v001.png',
  'ammo-box': '/assets/equipment/mod_ammo_box_v001.png',
  armor: '/assets/equipment/mod_armor_v001.png',
  'shield-generator': '/assets/equipment/mod_shield_generator_v001.png',
  radar: '/assets/equipment/mod_radar_v001.png',
  'heat-recycler': '/assets/equipment/mod_heat_recycler_v001.png',
  capacitor: '/assets/equipment/mod_capacitor_v001.png',
  'magnetic-armor': '/assets/equipment/mod_magnetic_armor_v001.png',
  'explosive-magazine': '/assets/equipment/mod_explosive_magazine_v001.png',
};

export function getEquipmentArt(id: string): string | undefined {
  return WEAPON_ART[id as WeaponId] ?? MODULE_ART[id as ModuleId];
}
