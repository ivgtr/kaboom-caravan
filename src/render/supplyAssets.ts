import type { LootKind } from '../game/simulation/types';
import { runtimeAssetUrl } from '../runtimeAssets';

export const SUPPLY_ART: Readonly<Record<LootKind, string>> = {
  repair: runtimeAssetUrl('assets/supply/supply_repair_kit_v001.png'),
  ammo: runtimeAssetUrl('assets/supply/supply_ammo_crate_v001.png'),
  'weapon-cache': runtimeAssetUrl('assets/supply/supply_weapon_cache_v001.png'),
};
