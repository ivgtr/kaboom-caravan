import { PLAYER_WIDTH, type Platform, type RunnerState } from './types';

/** The one terrain surface used by rendering, grounding and swept landings. */
export function platformTopAt(platform: Platform, worldX: number): number {
  const fraction = Math.min(
    1,
    Math.max(0, (worldX - platform.x) / platform.width),
  );
  return (
    platform.top + ((platform.endTop ?? platform.top) - platform.top) * fraction
  );
}

export function platformSlope(platform: Platform): number {
  return ((platform.endTop ?? platform.top) - platform.top) / platform.width;
}

export function platformsJoin(left: Platform, right: Platform): boolean {
  return (
    Math.abs(left.x + left.width - right.x) < 0.001 &&
    Math.abs((left.endTop ?? left.top) - right.top) < 0.001
  );
}

/** Centre support first, edge contact second; never invent a surface over a gap. */
export function supportingPlatform(state: RunnerState): Platform | undefined {
  const matches = (platform: Platform) =>
    state.distance + PLAYER_WIDTH * 0.36 > platform.x &&
    state.distance - PLAYER_WIDTH * 0.36 < platform.x + platform.width &&
    Math.abs(state.player.y - platformTopAt(platform, state.distance)) < 0.1;
  return (
    state.platforms.find(
      (platform) =>
        matches(platform) &&
        state.distance >= platform.x &&
        state.distance <= platform.x + platform.width,
    ) ?? state.platforms.find(matches)
  );
}

export function playerSurfaceSlope(state: RunnerState): number {
  const support = state.player.grounded ? supportingPlatform(state) : undefined;
  return support ? platformSlope(support) : 0;
}

/** Canvas angles: positive terrain rise leans the car counter-clockwise. */
export function playerTilt(state: RunnerState): number {
  return state.player.grounded
    ? -Math.atan(playerSurfaceSlope(state))
    : Math.max(-0.13, Math.min(0.17, -state.player.vy * 0.00028));
}

/** Transform the local roof muzzle through the same lean/squash as the sprite. */
export function playerMuzzle(state: RunnerState): { x: number; y: number } {
  const angle = playerTilt(state);
  const x = 6 * (1 + state.player.squash * 0.07);
  const y = 82 * (1 - state.player.squash * 0.1);
  return {
    x: state.distance + x * Math.cos(angle) + y * Math.sin(angle),
    y: state.player.y + y * Math.cos(angle) - x * Math.sin(angle),
  };
}
