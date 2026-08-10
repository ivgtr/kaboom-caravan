import { describe, expect, it } from 'vitest';
import {
  getCameraShakeOffset,
  getEnemyHitStopDuration,
  getPlayerDamageShake,
} from './combatFeedback';

describe('combat feedback presentation', () => {
  it('keeps enemy hit stop brief and scales it with damage', () => {
    expect(getEnemyHitStopDuration(10, false)).toBeCloseTo(0.055);
    expect(getEnemyHitStopDuration(100, false)).toBe(0.08);
    expect(getEnemyHitStopDuration(100, true)).toBe(0.035);
  });

  it('scales player damage shake without exceeding its comfort cap', () => {
    expect(getPlayerDamageShake(8, false)).toEqual({
      durationSeconds: 0.1844,
      amplitudePixels: 3.92,
    });
    expect(getPlayerDamageShake(100, false)).toEqual({
      durationSeconds: 0.23,
      amplitudePixels: 8,
    });
    expect(getPlayerDamageShake(100, true)).toEqual({
      durationSeconds: 0.1,
      amplitudePixels: 1.3,
    });
  });

  it('decays camera shake to rest without moving after its duration', () => {
    const spec = getPlayerDamageShake(20, false);
    const initial = getCameraShakeOffset(0, spec, 0.7);
    const late = getCameraShakeOffset(spec.durationSeconds * 0.8, spec, 0.7);

    expect(Math.hypot(initial.x, initial.y)).toBeGreaterThan(
      Math.hypot(late.x, late.y),
    );
    expect(getCameraShakeOffset(spec.durationSeconds, spec, 0.7)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
