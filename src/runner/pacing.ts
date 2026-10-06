/** World pixels per second. Slow permanent growth leaves room for reel kicks. */
export const START_SPEED = 330;
export const CRUISE_SPEED = 900;
export const MAX_SPEED = 1460;
export const MAX_BURST_SPEED = 1820;
export const BOOST_SPEED = 125;
export const SPEED_RAMP_DISTANCE = 150000;
export const DOUBLE_BEAT_DISTANCE = 4500;

export function getSpeed(distance: number, boosts = 0): number {
  const progress = Math.min(1, Math.max(0, distance) / SPEED_RAMP_DISTANCE);
  return Math.min(
    MAX_SPEED,
    START_SPEED +
      (CRUISE_SPEED - START_SPEED) * (1 - (1 - progress) ** 1.35) +
      Math.sqrt(Math.max(0, boosts)) * BOOST_SPEED,
  );
}
/** Every booster level improves the next hop; an airborne arc keeps its tempo. */
export function jumpTempo(boosts: number): number {
  return 1 + Math.min(20, Math.max(0, boosts)) * 0.0225;
}
