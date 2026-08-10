import { describe, expect, it } from 'vitest';
import { createSimulation } from './createSimulation';
import { createSeededRandom } from './random';
import { stepSimulation } from './stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from './types';

describe('stepSimulation', () => {
  it('moves the player independently of render FPS', () => {
    let state = createSimulation();

    for (let tick = 0; tick < 60; tick += 1) {
      state = stepSimulation(
        state,
        { ...IDLE_COMMAND, move: 1 },
        SIMULATION_STEP_SECONDS,
      );
    }

    expect(state.tick).toBe(60);
    expect(state.player.position).toBeCloseTo(22);
  });

  it('fires at the closest enemy in range and emits presentation events', () => {
    const initial = createSimulation();
    initial.enemies[0]!.position = 40;

    const state = stepSimulation(
      initial,
      { ...IDLE_COMMAND, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(state.player.ammo).toBe(29);
    expect(state.enemies[0]!.hitPoints).toBe(20);
    expect(state.events).toContainEqual({
      type: 'weapon-fired',
      targetId: 'enemy-1',
    });
  });

  it('does not mutate the previous state', () => {
    const initial = createSimulation();
    const originalPosition = initial.enemies[0]!.position;

    stepSimulation(initial, IDLE_COMMAND, SIMULATION_STEP_SECONDS);

    expect(initial.enemies[0]!.position).toBe(originalPosition);
    expect(initial.tick).toBe(0);
  });
});

describe('createSeededRandom', () => {
  it('replays the same random sequence for the same seed', () => {
    const left = createSeededRandom(123);
    const right = createSeededRandom(123);

    expect([left.next(), left.next(), left.next()]).toEqual([
      right.next(),
      right.next(),
      right.next(),
    ]);
  });
});
