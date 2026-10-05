/** World pixels per second. Rewards add real velocity, not a HUD-only number. */
export const START_SPEED = 330;
export const CRUISE_SPEED = 510;
export const MAX_SPEED = 1650;
export const BOOST_SPEED = 125;
export const SPEED_RAMP_DISTANCE = 26000;
export const DOUBLE_BEAT_DISTANCE = 4500;

export function getSpeed(distance: number, boosts = 0): number {
  const progress = Math.min(1, Math.max(0, distance) / SPEED_RAMP_DISTANCE);
  return Math.min(
    MAX_SPEED,
    START_SPEED +
      (CRUISE_SPEED - START_SPEED) * (1 - (1 - progress) ** 3) +
      Math.max(0, boosts) * BOOST_SPEED,
  );
}
/** Faster hops keep their height and a real, continuous ballistic trajectory. */
export function jumpTempo(boosts: number): number {
  return Math.min(1.45, 1 + Math.max(0, boosts) * 0.055);
}
