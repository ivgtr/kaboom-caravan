import { describe, expect, it } from 'vitest';
import { createWaveSimulation } from './createSimulation';
import { stepSimulation } from './stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from './types';
import {
  ACTION_TIME_RULES,
  getActionTimeScale,
  isActionTimeCommitted,
  withActionTime,
} from './actionTime';

describe('ACTION TIME', () => {
  it('crawls while observing and returns to 1x for meaningful actions', () => {
    expect(getActionTimeScale(withActionTime(IDLE_COMMAND))).toBe(
      ACTION_TIME_RULES.idleTimeScale,
    );

    for (const command of [
      { ...IDLE_COMMAND, move: 1 as const },
      { ...IDLE_COMMAND, firePrimary: true },
      { ...IDLE_COMMAND, fireSecondary: true },
      { ...IDLE_COMMAND, activateSkill: true },
      { ...IDLE_COMMAND, activateBreakthrough: true },
    ]) {
      expect(isActionTimeCommitted(command)).toBe(true);
      expect(getActionTimeScale(withActionTime(command))).toBe(1);
    }
  });

  it('does not wake the world for a stationary boost button by itself', () => {
    const command = { ...IDLE_COMMAND, boost: true };
    expect(isActionTimeCommitted(command)).toBe(false);
    expect(getActionTimeScale(withActionTime(command))).toBe(
      ACTION_TIME_RULES.idleTimeScale,
    );
  });

  it('changes actual wave pacing when a live command opts into ACTION TIME', () => {
    const simulateOneRealSecond = (acting: boolean) => {
      let state = createWaveSimulation(123, 'battle-01-wave');
      const command = withActionTime({
        ...IDLE_COMMAND,
        move: acting ? 1 : 0,
      });
      for (let tick = 0; tick < 60; tick += 1) {
        state = stepSimulation(state, command, SIMULATION_STEP_SECONDS);
      }
      return state.wave?.elapsedSeconds ?? 0;
    };

    expect(simulateOneRealSecond(false)).toBeCloseTo(
      ACTION_TIME_RULES.idleTimeScale,
      5,
    );
    expect(simulateOneRealSecond(true)).toBeCloseTo(1, 5);
  });

  it('keeps direct simulation commands at normal speed unless they opt in', () => {
    expect(getActionTimeScale(IDLE_COMMAND)).toBe(1);
  });
});
