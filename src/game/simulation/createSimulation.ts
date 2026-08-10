import { createEnemy } from '../combat/createEnemy';
import type { WaveId } from '../data/ids';
import { createWaveState } from '../wave/waveSystem';
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
      createEnemy('basic', 'enemy-1', 55),
      createEnemy('basic', 'enemy-2', 72),
    ],
    projectiles: [],
    events: [],
  };
}

export function createWaveSimulation(
  seed: number,
  waveId: WaveId,
): SimulationState {
  return {
    ...createSimulation(seed),
    nextEntitySequence: 1,
    enemies: [],
    wave: createWaveState(waveId),
  };
}
