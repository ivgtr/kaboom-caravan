import type { SimulationState } from './types';

export function createSimulation(seed = 1): SimulationState {
  return {
    seed,
    tick: 0,
    nextEntitySequence: 1,
    status: 'active',
    build: {
      primaryWeaponId: 'machine-cannon',
      secondaryWeaponId: 'railgun',
      moduleIds: [],
    },
    player: {
      id: 'player',
      previousPosition: 10,
      position: 10,
      radius: 2.5,
      hitPoints: 100,
      maxHitPoints: 100,
      armor: 1,
      heat: 0,
      energy: 100,
      ammo: 30,
      primaryCooldown: 0,
      secondaryCooldown: 0,
      skillCooldown: 0,
      overheated: false,
    },
    frontline: {
      position: 25,
      pressure: 0,
      riskTier: 'safe',
      rewardMultiplier: 1,
    },
    enemies: [
      {
        id: 'enemy-1',
        previousPosition: 55,
        position: 55,
        radius: 1.5,
        hitPoints: 30,
        armor: 0,
        speed: 1.5,
        contactDamage: 8,
        contactCooldown: 0,
      },
      {
        id: 'enemy-2',
        previousPosition: 72,
        position: 72,
        radius: 1.5,
        hitPoints: 30,
        armor: 0,
        speed: 1.5,
        contactDamage: 8,
        contactCooldown: 0,
      },
    ],
    projectiles: [],
    events: [],
  };
}
