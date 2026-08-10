import type { ModuleId, WeaponTag } from '../data/ids';
import type { NumericModifier } from './modifier';

export type PlayerStat =
  | 'moveSpeed'
  | 'coolingPerSecond'
  | 'energyPerSecond'
  | 'maximumAmmo'
  | 'maximumEnergy'
  | 'maximumHitPoints'
  | 'armor';

export type WeaponStat =
  | 'damage'
  | 'cooldownSeconds'
  | 'maximumRange'
  | 'energyCost'
  | 'heatGenerated';

export interface PlayerStatModifier extends NumericModifier {
  target: 'player';
  stat: PlayerStat;
}

export interface WeaponStatModifier extends NumericModifier {
  target: 'weapon';
  stat: WeaponStat;
  requiredTag?: WeaponTag;
}

export type BuildModifier = PlayerStatModifier | WeaponStatModifier;

export type TriggerType =
  | 'onFire'
  | 'onHit'
  | 'onKill'
  | 'onDamage'
  | 'onAmmoEmpty'
  | 'onEnergyEmpty'
  | 'onOverheat'
  | 'onWaveStart'
  | 'onWaveEnd';

export interface TriggerSignal {
  type: TriggerType;
  weaponTags?: readonly WeaponTag[];
}

export type TriggerResource = 'ammo' | 'energy' | 'heat' | 'hitPoints';

export type TriggerEffect =
  | {
      type: 'addResource';
      resource: TriggerResource;
      amount: number;
    }
  | {
      type: 'emitTrigger';
      trigger: TriggerType;
    };

export interface BuildTrigger {
  sourceId: string;
  event: TriggerType;
  requiredWeaponTag?: WeaponTag;
  effects: readonly TriggerEffect[];
}

export interface ModuleDefinition {
  id: ModuleId;
  displayName: string;
  description: string;
  assetId: string;
  modifiers: readonly BuildModifier[];
  triggers: readonly BuildTrigger[];
}
