/** Input-only deterministic replay for browser QA. Never patches live game state. */
import { RIVALS } from '../src/runner/definitions';
import {
  GRAVITY,
  createRunner,
  PLAYER_HALF_HITBOX,
  releaseJump,
  requestJump,
  startRunner,
  stepRunner,
} from '../src/runner/simulation';
import { platformTopAt, platformsJoin } from '../src/runner/terrain';
import { FIXED_DT, type RunnerState } from '../src/runner/types';

export interface ReplayInput {
  time: number;
  action: 'press' | 'release';
}
function roadEnd(state: RunnerState): number {
  let index = state.platforms.findIndex(
    (p) =>
      state.distance + PLAYER_HALF_HITBOX > p.x &&
      state.distance - PLAYER_HALF_HITBOX < p.x + p.width &&
      Math.abs(platformTopAt(p, state.distance) - state.player.y) < 1,
  );
  if (index < 0) return Infinity;
  while (
    state.platforms[index + 1] &&
    platformsJoin(state.platforms[index]!, state.platforms[index + 1]!)
  )
    index++;
  const road = state.platforms[index]!;
  return road.x + road.width;
}
export function replayInputs(
  state: RunnerState,
  collectWeapons = true,
): ReplayInput['action'][] {
  const actions: ReplayInput['action'][] = [];
  // This pilot watches the actual build. A boosted ram already destroys bodies;
  // hopping over those harmless targets can waste the next gap's takeoff window.
  // Dedicated interaction tests still cover presses/releases during FREEZE.
  if (state.fever.freeze > 0) return actions;
  const ramming = state.fever.abilities.boost > 0 && state.speed >= 480;
  const threats = [
    ...state.obstacles
      .filter((o) => !o.destroyed)
      .map((o) => ({ x: o.x, width: o.width, top: o.top + o.height })),
    ...state.rivals
      .filter((r) => !r.defeated)
      .map((r) => ({
        x: r.x,
        width: RIVALS[r.kind].width,
        top: r.y + RIVALS[r.kind].height,
      })),
  ]
    .filter((o) => o.x + o.width / 2 > state.distance - PLAYER_HALF_HITBOX)
    .sort((a, b) => a.x - b.x);
  const threat = ramming ? undefined : threats[0],
    speed = state.speed;
  if (state.player.grounded) {
    if (state.player.holding) actions.push('release');
    const weapon =
      collectWeapons &&
      state.pickups.find(
        (p) =>
          (p.kind === 'weapon' || p.kind === 'chest') &&
          !p.taken &&
          p.x > state.distance &&
          p.y - state.player.y > 60 &&
          p.x - state.distance < speed * 0.24,
      );
    if (
      weapon ||
      roadEnd(state) - state.distance <= speed * 0.09 ||
      (threat && threat.x - state.distance < speed * 0.24)
    )
      actions.push('press');
  } else if (state.player.airHops && state.player.vy < 0) {
    const nextRoad = state.platforms.find(
      (p, i) =>
        p.x > state.distance &&
        (i === 0 || !platformsJoin(state.platforms[i - 1]!, p)),
    );
    const collisionTime = threat
      ? Math.max(
          0,
          (threat.x + threat.width / 2 + PLAYER_HALF_HITBOX - state.distance) /
            speed,
        )
      : Infinity;
    const dangerAhead =
      threat &&
      collisionTime < 0.24 &&
      state.player.y +
        state.player.vy * collisionTime -
        0.5 * GRAVITY * state.player.jumpTempo ** 2 * collisionTime ** 2 <
        threat.top + 5;
    const faceTime = nextRoad
      ? Math.max(0, (nextRoad.x - PLAYER_HALF_HITBOX - state.distance) / speed)
      : Infinity;
    // Do not predict a fall through a deck already under the cart. Its landing
    // resets the arc before the following gap; recovering now would launch a
    // second unnecessary arc and can overshoot that otherwise safe deck.
    const deckBelow = state.platforms.some(
      (p) =>
        state.distance >= p.x &&
        state.distance < p.x + p.width &&
        state.player.y >= platformTopAt(p, state.distance),
    );
    const landingTooLow =
      !deckBelow &&
      nextRoad &&
      faceTime > 0 &&
      faceTime < 0.42 &&
      state.player.y +
        state.player.vy * faceTime -
        0.5 * GRAVITY * state.player.jumpTempo ** 2 * faceTime ** 2 <
        nextRoad.top + 3;
    if (dangerAhead || landingTooLow) {
      if (state.player.holding) actions.push('release');
      actions.push('press');
    }
  }
  return actions;
}
export function buildReplay(
  seed = 42,
  seconds = 45,
  collectWeapons = true,
  frameMs = 16,
): { inputs: ReplayInput[]; state: RunnerState; minimumLandingRunway: number } {
  const state = createRunner(seed),
    inputs: ReplayInput[] = [];
  startRunner(state);
  let elapsed = 0,
    accumulator = 0,
    minimumLandingRunway = Infinity;
  while (elapsed < seconds && state.status === 'running') {
    for (const action of replayInputs(state, collectWeapons)) {
      inputs.push({ time: elapsed, action });
      if (action === 'press') requestJump(state);
      else releaseJump(state);
    }
    elapsed = Math.round((elapsed + frameMs / 1000) * 1e9) / 1e9;
    accumulator += frameMs / 1000;
    while (accumulator >= FIXED_DT) {
      const airborne = !state.player.grounded;
      stepRunner(state);
      if (airborne && state.player.grounded)
        minimumLandingRunway = Math.min(
          minimumLandingRunway,
          (roadEnd(state) - state.distance) / state.speed,
        );
      accumulator -= FIXED_DT;
    }
  }
  return { inputs, state, minimumLandingRunway };
}

/** Deliver the same physical inputs at frame boundaries, then use the app's
 * 120Hz accumulator. Different refresh rates may add up to one frame of latency.
 */
export function replayAtRefresh(
  inputs: ReplayInput[],
  seconds: number,
  hz: number,
  seed = 42,
): RunnerState {
  const state = createRunner(seed);
  startRunner(state);
  let elapsed = 0,
    accumulator = 0,
    input = 0,
    ticks = 0;
  const totalTicks = Math.ceil(seconds / FIXED_DT);
  while (ticks < totalTicks && state.status === 'running') {
    while (inputs[input] && inputs[input]!.time <= elapsed + 1e-9) {
      if (inputs[input++]!.action === 'press') requestJump(state);
      else releaseJump(state);
    }
    elapsed += 1 / hz;
    accumulator += 1 / hz;
    while (accumulator + 1e-12 >= FIXED_DT && ticks < totalTicks) {
      stepRunner(state);
      accumulator -= FIXED_DT;
      ticks++;
    }
  }
  return state;
}
