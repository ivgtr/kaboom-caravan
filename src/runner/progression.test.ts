import { expect, it } from 'vitest';
import { replayInputs } from '../../tests/runner-replay';
import { MAX_ABILITY_LEVEL } from './fever';
import { getSpeed, MAX_BURST_SPEED } from './pacing';
import {
  createRunner,
  releaseJump,
  requestJump,
  startRunner,
  stepRunner,
} from './simulation';
import { FIXED_DT } from './types';

it('keeps real late-run growth, post-MAX rewards and dense pulse variation after two minutes', () => {
  const state = createRunner(42);
  startRunner(state);
  let elapsed = 0,
    accumulator = 0,
    firstMax = 0,
    allMax = 0;
  let lateLow = Infinity,
    lateHigh = 0,
    cappedTicks = 0,
    lateTicks = 0;
  const baseline: number[] = [];
  while (elapsed < 180 && state.status === 'running') {
    for (const action of replayInputs(state)) {
      if (action === 'press') requestJump(state);
      else releaseJump(state);
    }
    elapsed = Math.round((elapsed + 0.016) * 1000) / 1000;
    accumulator += 0.016;
    while (accumulator >= FIXED_DT) {
      stepRunner(state);
      accumulator -= FIXED_DT;
      const levels = Object.values(state.fever.abilities);
      if (!firstMax && levels.some((level) => level === MAX_ABILITY_LEVEL))
        firstMax = elapsed;
      if (!allMax && levels.every((level) => level === MAX_ABILITY_LEVEL))
        allMax = elapsed;
      if (elapsed > 150) {
        lateLow = Math.min(lateLow, state.speed);
        lateHigh = Math.max(lateHigh, state.speed);
        lateTicks++;
        if (state.speed >= MAX_BURST_SPEED - 1) cappedTicks++;
      }
    }
    if (baseline.length < Math.floor(elapsed / 30))
      baseline.push(getSpeed(state.distance, state.fever.abilities.boost));
  }
  expect(state.status, JSON.stringify(state.failure)).toBe('running');
  expect(firstMax).toBeGreaterThan(30);
  expect(allMax).toBeGreaterThan(firstMax + 15);
  expect(allMax).toBeLessThan(150);
  expect(baseline[3]!).toBeGreaterThan(baseline[1]! + 200);
  expect(state.fever.slotKickSerial).toBeGreaterThan(180);
  for (const repeats of Object.values(state.fever.awakeningSerial))
    expect(repeats).toBeGreaterThan(5);
  expect(lateHigh - lateLow).toBeGreaterThan(100);
  expect(cappedTicks / lateTicks).toBeLessThan(0.05);
  expect(state.score).toBeGreaterThan(100_000_000);
});
