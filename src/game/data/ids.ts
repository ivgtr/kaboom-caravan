export type WeaponId =
  | 'machine-cannon'
  | 'scatter-cannon'
  | 'flamethrower'
  | 'rocket-launcher'
  | 'railgun'
  | 'mine-launcher';

export type ModuleId =
  | 'cooling-fan'
  | 'generator'
  | 'ammo-box'
  | 'armor'
  | 'shield-generator'
  | 'radar'
  | 'heat-recycler'
  | 'capacitor'
  | 'magnetic-armor'
  | 'explosive-magazine';

export type WeaponTag =
  | 'ballistic'
  | 'projectile'
  | 'close-range'
  | 'long-range'
  | 'fire'
  | 'heat'
  | 'explosive'
  | 'energy'
  | 'deployable';

export type EnemyTypeId =
  'basic' | 'rusher' | 'heavy' | 'artillery' | 'bomber' | 'kawaii-fortress';

export type EnemyBehaviorId =
  | 'advance'
  | 'rush'
  | 'heavyAdvance'
  | 'stopAndShoot'
  | 'suicideRush'
  | 'bossFortress';

export type WaveId = 'prototype-wave' | 'mixed-wave' | 'boss-wave';
