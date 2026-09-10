import { createCombatCoreState } from './combatCore';
import { createEnemy } from '../combat/createEnemy';
import type { WaveId } from '../data/ids';
import { createWaveState } from '../wave/waveSystem';
import { createBreakoutObjective } from './battlefieldObjective';
import type { SimulationState } from './types';

const BREAKOUT_WAVES = new Set<WaveId>([
  'battle-01-wave',
  'battle-02-wave',
  'battle-03-wave',
  'battle-04-wave',
  'battle-05-wave',
  'battle-06-wave',
  'battle-07-wave',
  'battle-08-wave',
  'battle-09-wave',
]);

export function createSimulation(seed = 1): SimulationState {
  return {
    seed,
    tick: 0,
    nextEntitySequence: 1,
    status: 'active',
    build: {
      primaryWeaponId: 'machine-cannon',
      secondaryWeaponId: 'scatter-cannon',
      weaponLevels: { 'machine-cannon': 1, 'scatter-cannon': 1 },
      moduleIds: [],
    },
    player: {
      id: 'player',
      previousPosition: 10,
      position: 10,
      velocity: 0,
      radius: 2.5,
      hitPoints: 100,
      maxHitPoints: 100,
      armor: 1,
      weaponHeat: {
        primary: { heat: 0, overheated: false },
        secondary: { heat: 0, overheated: false },
      },
      energy: 100,
      ammo: 50,
      primaryCooldown: 0,
      secondaryCooldown: 0,
      skillCooldown: 0,
      parryWindowSeconds: 0,
      boosting: false,
    },
    frontline: {
      position: 25,
      pressure: 0,
      riskTier: 'safe',
      rewardMultiplier: 1,
    },
    breakthrough: { charge: 0, remainingSeconds: 0, hitChargeCooldown: 0 },
    core: createCombatCoreState(),
    enemies: [
      createEnemy('basic', 'enemy-1', 55),
      createEnemy('basic', 'enemy-2', 72),
    ],
    projectiles: [],
    enemyProjectiles: [],
    loot: [],
    treasureCollected: 0,
    eliteEncounter: false,
    events: [],
  };
}

export function createWaveSimulation(
  seed: number,
  waveId: WaveId,
): SimulationState {
  const simulation: SimulationState = {
    ...createSimulation(seed),
    nextEntitySequence: 1,
    enemies: [],
    wave: createWaveState(waveId),
  };
  if (BREAKOUT_WAVES.has(waveId)) {
    simulation.objective = createBreakoutObjective();
  }
  return simulation;
}
