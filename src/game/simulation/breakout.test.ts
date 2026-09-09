import { describe, expect, it } from 'vitest';
import { createEnemy } from '../combat/createEnemy';
import { BATTLEFIELD_OBJECTIVES } from '../data/routeDefinitions';
import { createWaveSimulation } from './createSimulation';
import { stepSimulation } from './stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS as DT } from './types';

describe('BREAKOUT core loop', () => {
  it('turns normal encounters into timed physical breakouts', () => {
    const state = createWaveSimulation(1, 'battle-01-wave');
    expect(state.objective?.kind).toBe('breakout');
    expect(state.objective?.remainingSeconds).toBe(
      BATTLEFIELD_OBJECTIVES.breakout.deadlineSeconds,
    );
  });

  it('does not let a full clear replace driving through the blockade', () => {
    const state = createWaveSimulation(1, 'battle-01-wave');
    state.wave = {
      ...state.wave!,
      started: true,
      completed: true,
      nextSpawnIndex: 99,
    };
    state.enemies = [];
    state.projectiles = [];
    state.enemyProjectiles = [];
    state.loot = [];

    const result = stepSimulation(state, IDLE_COMMAND, DT);

    expect(result.status).toBe('active');
    expect(result.objective?.status).toBe('active');
    expect(
      result.events.some(
        (event) => event.type === 'combat-ended' && event.result === 'victory',
      ),
    ).toBe(false);
  });

  it('wins by holding the exit even while enemies remain alive', () => {
    const state = createWaveSimulation(1, 'battle-01-wave');
    state.wave = undefined;
    state.enemies = [
      {
        ...createEnemy('heavy', 'left-behind', 95),
        speed: 0,
        hitPoints: 100000,
      },
    ];
    state.player.position = BATTLEFIELD_OBJECTIVES.breakout.position;
    state.player.previousPosition = state.player.position;
    state.objective!.progressSeconds =
      BATTLEFIELD_OBJECTIVES.breakout.holdSeconds - DT;

    const result = stepSimulation(state, IDLE_COMMAND, DT);

    expect(result.objective?.status).toBe('secured');
    expect(result.status).toBe('victory');
    expect(result.enemies).toHaveLength(1);
    expect(result.events).toContainEqual({ type: 'breakout-completed' });
    expect(result.events.at(-1)).toEqual({
      type: 'combat-ended',
      result: 'victory',
    });
  });

  it('fails the encounter when the caravan never reaches the blockade', () => {
    const state = createWaveSimulation(1, 'battle-01-wave');
    state.wave = undefined;
    state.enemies = [
      {
        ...createEnemy('heavy', 'distant', 95),
        speed: 0,
        hitPoints: 100000,
      },
    ];
    state.objective!.remainingSeconds = DT;

    const result = stepSimulation(state, IDLE_COMMAND, DT);

    expect(result.objective?.status).toBe('lost');
    expect(result.status).toBe('defeat');
    expect(result.player.hitPoints).toBeGreaterThan(0);
    expect(result.events).toContainEqual({ type: 'breakout-failed' });
    expect(result.events.at(-1)).toEqual({
      type: 'combat-ended',
      result: 'defeat',
    });
  });

  it('keeps the final fortress as a kill encounter instead of another exit timer', () => {
    const state = createWaveSimulation(1, 'battle-10-wave');
    expect(state.objective).toBeUndefined();
  });
});
