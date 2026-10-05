/** Distance is world pixels (10px = 1m). Keep physics, cues and audio in sync. */
export const START_SPEED = 330;
export const MAX_SPEED = 520;
export const SPEED_RAMP_DISTANCE = 34000;
export const DOUBLE_BEAT_DISTANCE = 4500;

/** A brisk early pickup that tapers continuously to cruising speed at 3400m. */
export function getSpeed(distance: number): number {
  const progress = Math.min(1, Math.max(0, distance) / SPEED_RAMP_DISTANCE);
  return START_SPEED + (MAX_SPEED - START_SPEED) * (1 - (1 - progress) ** 3);
}
