import type { SimulationState } from './types';

export function createSimulation(seed = 1): SimulationState {
  return {
    seed,
    tick: 0,
    player: {
      position: 10,
      hitPoints: 100,
      heat: 0,
      energy: 100,
      ammo: 30,
      primaryCooldown: 0,
    },
    enemies: [
      { id: 'enemy-1', position: 55, hitPoints: 30 },
      { id: 'enemy-2', position: 72, hitPoints: 30 },
    ],
    events: [],
  };
}
