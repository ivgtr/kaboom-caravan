import { describe, expect, it } from 'vitest';
import {
  CRUISE_SPEED,
  MAX_SPEED,
  SPEED_RAMP_DISTANCE,
  START_SPEED,
} from './pacing';
import { buildReplay, replayAtRefresh } from '../../tests/runner-replay';
import {
  COYOTE_TIME,
  GRAVITY,
  JUMP_VELOCITY,
  PLAYER_HALF_HITBOX,
  RECOVERY_VELOCITY,
  RELEASE_VELOCITY,
  TERRAIN_MAX_HEIGHT,
  TERRAIN_MIN_HEIGHT,
  clearJumpInput,
  createRunner,
  generateTerrain,
  getSpeed,
  jumpLandingTime,
  pauseRunner,
  releaseJump,
  requestJump,
  resumeRunner,
  startRunner,
  stepRunner,
} from './simulation';
import { platformTopAt, platformsJoin, playerMuzzle } from './terrain';
import { FIXED_DT, type RunnerState } from './types';

function arena(): RunnerState {
  const state = createRunner(7);
  state.platforms = [{ id: 1, x: -1000, width: 100000, top: 0 }];
  state.generatedUntil = 99000;
  state.obstacles = [];
  state.rivals = [];
  state.pickups = [];
  startRunner(state);
  return state;
}
function advance(state: RunnerState, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) stepRunner(state);
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
/** A modest early/late window, with carried landings rather than reset fixtures. */
function terrainPilot(state: RunnerState, lead: number, low = false): void {
  if (!state.player.grounded) {
    const target = state.player.flightTarget;
    const prev = target && state.platforms[state.platforms.indexOf(target) - 1];
    if (
      low &&
      state.player.holding &&
      target &&
      prev &&
      (target.x - prev.x - prev.width) / getSpeed(prev.x + prev.width) < 0.33 &&
      state.player.lastJumpX !== null &&
      state.distance - state.player.lastJumpX >=
        getSpeed(state.player.lastJumpX) * 0.05
    )
      releaseJump(state);
    return;
  }
  releaseJump(state);
  if (roadEnd(state) - state.distance <= getSpeed(state.distance) * lead)
    requestJump(state);
}

describe('responsive one-button movement', () => {
  it('spreads permanent growth across a long run and preserves gains at every booster level', () => {
    expect(getSpeed(-100)).toBe(START_SPEED);
    expect(getSpeed(0)).toBe(330);
    expect(getSpeed(SPEED_RAMP_DISTANCE / 2)).toBeCloseTo(
      330 + 570 * (1 - 0.5 ** 1.35),
    );
    expect(getSpeed(SPEED_RAMP_DISTANCE)).toBe(CRUISE_SPEED);
    expect(getSpeed(0, 6)).toBeGreaterThan(630);
    for (let level = 1; level <= 20; level++)
      expect(getSpeed(60000, level)).toBeGreaterThan(
        getSpeed(60000, level - 1),
      );
    expect(getSpeed(0, 1000)).toBe(MAX_SPEED);
    expect(getSpeed(1e9)).toBe(CRUISE_SPEED);
    let previousGain = Infinity;
    for (let x = 1000; x <= SPEED_RAMP_DISTANCE; x += 1000) {
      const gain = getSpeed(x) - getSpeed(x - 1000);
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThan(previousGain);
      previousGain = gain;
    }
    expect(
      getSpeed(SPEED_RAMP_DISTANCE) - getSpeed(SPEED_RAMP_DISTANCE - 1),
    ).toBeLessThan(0.001);
  });
  it('press jumps immediately, repeated held input does not jump again', () => {
    const state = arena();
    expect(requestJump(state)).toBe(true);
    expect(state.player.vy).toBe(JUMP_VELOCITY);
    expect(requestJump(state)).toBe(false);
    advance(state, 1);
    expect(state.jumps).toBe(1);
    expect(state.player.grounded).toBe(true);
    expect(requestJump(state)).toBe(false);
    releaseJump(state);
    expect(requestJump(state)).toBe(true);
  });
  it('release makes a low hop while holding gives the full arc', () => {
    const full = arena(),
      tap = arena();
    requestJump(full);
    requestJump(tap);
    advance(full, 0.05);
    advance(tap, 0.05);
    releaseJump(tap);
    expect(tap.player.vy).toBe(RELEASE_VELOCITY);
    let fullPeak = 0,
      tapPeak = 0;
    for (let i = 0; i < 110; i++) {
      stepRunner(full);
      stepRunner(tap);
      fullPeak = Math.max(fullPeak, full.player.y);
      tapPeak = Math.max(tapPeak, tap.player.y);
    }
    expect(fullPeak).toBeCloseTo(JUMP_VELOCITY ** 2 / (2 * GRAVITY), 1);
    expect(tapPeak).toBeLessThan(fullPeak * 0.65);
    expect(full.player.grounded).toBe(true);
  });
  it('one airborne recovery creates agency and is restored only on landing', () => {
    const state = arena();
    requestJump(state);
    advance(state, 0.2);
    releaseJump(state);
    expect(requestJump(state)).toBe(true);
    expect(state.player.vy).toBe(RECOVERY_VELOCITY);
    expect(state.player.airHops).toBe(0);
    releaseJump(state);
    expect(requestJump(state)).toBe(false);
    expect(state.jumps).toBe(2);
    advance(state, 0.2);
    clearJumpInput(state);
    advance(state, 1);
    expect(state.player.grounded).toBe(true);
    expect(state.player.airHops).toBe(1);
  });
  it('clears held and buffered input on interruption without unpausing', () => {
    const state = arena();
    requestJump(state);
    advance(state, 0.1);
    state.player.buffer = 0.1;
    pauseRunner(state);
    expect(state.player.holding).toBe(false);
    expect(state.player.buffer).toBe(0);
    const x = state.distance;
    advance(state, 1);
    expect(state.distance).toBe(x);
    expect(requestJump(state)).toBe(false);
    resumeRunner(state);
    advance(state, 1);
    expect(state.jumps).toBe(1);
  });
  it('coyote time permits a small late press; unrelated equal-height roads remain gaps', () => {
    const state = arena();
    state.platforms = [
      { id: 1, x: -500, width: 500, top: 0 },
      { id: 2, x: 150, width: 600, top: 0 },
    ];
    state.distance = PLAYER_HALF_HITBOX - 1;
    stepRunner(state);
    expect(state.player.grounded).toBe(false);
    expect(state.player.coyote).toBe(COYOTE_TIME);
    expect(requestJump(state)).toBe(true);
    advance(state, 0.8);
    expect(state.status).toBe('running');
    expect(state.player.grounded).toBe(true);
  });
  it('subdivides oversize frames and never snaps up an exposed wall', () => {
    const state = arena();
    state.platforms = [
      { id: 1, x: -500, width: 550, top: 0 },
      { id: 2, x: 50, width: 500, top: 80 },
    ];
    stepRunner(state, 0.25);
    expect(state.status).toBe('over');
    expect(state.reason).toBe('wall');
    expect(state.distance).toBeCloseTo(50 - PLAYER_HALF_HITBOX);
    expect(state.player.y).toBe(0);
  });
  it('muzzle matches the downsized vehicle and rotates with terrain', () => {
    const state = arena();
    expect(playerMuzzle(state)).toEqual({ x: 19, y: 60 });
    state.platforms = [{ id: 1, x: -100, width: 200, top: -30, endTop: 30 }];
    const muzzle = playerMuzzle(state);
    expect(muzzle.x).toBeLessThan(19);
    expect(muzzle.y).toBeGreaterThan(55);
  });
});

describe('boost-safe endless course', () => {
  it('opens a real chest near two seconds before the first readable gap', () => {
    const a = createRunner(42),
      b = createRunner(84);
    expect(a).toEqual(createRunner(42));
    expect(a.platforms).not.toEqual(b.platforms);
    startRunner(a);
    advance(a, 2);
    expect(a.chestsOpened).toBe(1);
    expect(a.fever.reel?.rewards.length).toBeGreaterThanOrEqual(1);
    expect(a.status).toBe('running');
    expect(a.distance).toBeLessThan(a.platforms[0]!.x + a.platforms[0]!.width);
  });
  it('keeps varied rising/falling phrases and bounded boosted landing decks', () => {
    for (const boosts of [0, 3, 6, 12]) {
      const state = createRunner(7);
      state.fever.abilities.boost = boosts;
      generateTerrain(state, 40000);
      for (const road of state.platforms) {
        expect(road.top).toBeGreaterThanOrEqual(TERRAIN_MIN_HEIGHT);
        expect(road.endTop ?? road.top).toBeLessThanOrEqual(TERRAIN_MAX_HEIGHT);
      }
      const islands = state.platforms.filter(
        (road, i) => i > 0 && !platformsJoin(state.platforms[i - 1]!, road),
      );
      const slopes = state.platforms.filter(
        (road) => Math.abs((road.endTop ?? road.top) - road.top) > 60,
      );
      expect(slopes.length).toBeGreaterThan(islands.length);
      expect(slopes.some((road) => road.endTop! > road.top)).toBe(true);
      expect(slopes.some((road) => road.endTop! < road.top)).toBe(true);
      expect(new Set(state.rivals.map((rival) => rival.kind))).toEqual(
        new Set(['basic', 'heavy', 'bomber', 'rusher', 'fortress']),
      );
      const lengths = new Set<number>();
      for (const island of islands) {
        let road = island,
          width = road.width;
        let index = state.platforms.indexOf(road);
        while (
          state.platforms[index + 1] &&
          platformsJoin(road, state.platforms[index + 1]!)
        ) {
          road = state.platforms[++index]!;
          width += road.width;
        }
        expect(width).toBeGreaterThanOrEqual(759.999);
        lengths.add(Math.round(width));
      }
      expect(lengths.size).toBeGreaterThanOrEqual(5);
    }
  });
  it('never rewrites a generated terrain prefix when collecting boosts', () => {
    const state = createRunner(41),
      old = structuredClone(state.platforms);
    state.fever.abilities.boost = 12;
    generateTerrain(state, 9000);
    expect(state.platforms.slice(0, old.length)).toEqual(old);
  });
  it('carries held jumps across seeded terrain at actual 330–1650 speeds', () => {
    for (const seed of [1, 7, 42, 991]) {
      for (const boosts of [0, 6, 12]) {
        const state = createRunner(seed);
        state.fever.abilities.boost = boosts;
        state.speed = getSpeed(0, boosts);
        generateTerrain(state, 45000);
        state.rivals = [];
        state.obstacles = [];
        state.pickups = [];
        startRunner(state);
        while (state.distance < 40000 && state.status === 'running') {
          if (state.player.grounded) {
            releaseJump(state);
            if (roadEnd(state) - state.distance < state.speed * 0.09)
              requestJump(state);
          }
          stepRunner(state);
        }
        expect(
          state.status,
          JSON.stringify({ seed, boosts, failure: state.failure }),
        ).toBe('running');
        expect(state.jumps).toBeGreaterThan(15);
      }
    }
  });
  it('keeps low taps viable on the short base-speed route', () => {
    const state = createRunner(7);
    generateTerrain(state, 20000);
    state.rivals = [];
    state.obstacles = [];
    state.pickups = [];
    startRunner(state);
    while (state.distance < 15000 && state.status === 'running') {
      terrainPilot(state, 0.08, true);
      stepRunner(state);
    }
    expect(state.status, JSON.stringify(state.failure)).toBe('running');
  });
  it('replays physical input consistently at 60, 120 and 144Hz', () => {
    const { state, inputs } = buildReplay(42, 35, true);
    expect(state.status, JSON.stringify(state.failure)).toBe('running');
    expect(state.chestsOpened).toBeGreaterThan(4);
    expect(state.score).toBeGreaterThan(10000);
    for (const hz of [60, 120, 144]) {
      const replay = replayAtRefresh(inputs, 35, hz);
      expect(
        replay.status,
        JSON.stringify({ hz, failure: replay.failure }),
      ).toBe('running');
      expect(replay.jumps).toBe(state.jumps);
      expect(Math.abs(replay.distance - state.distance)).toBeLessThan(
        MAX_SPEED * FIXED_DT * 3,
      );
    }
  });
});

describe('observed failure feedback', () => {
  it('identifies a no-input fall only when no jump was made on that flight', () => {
    const state = createRunner(42);
    startRunner(state);
    advance(state, 6);
    expect(state.status).toBe('over');
    expect(state.failure?.kind).toBe('no-input');
    expect(state.failure?.takeoffX).toBeNull();
    expect(state.failure?.targetX).toBeGreaterThan(600);
  });
  it('records a short jump at the actual landing face', () => {
    const state = arena();
    state.platforms = [
      { id: 1, x: -500, width: 600, top: 0 },
      { id: 2, x: 285, width: 600, top: 0 },
    ];
    state.distance = 80;
    requestJump(state);
    advance(state, 0.025);
    releaseJump(state);
    advance(state, 1);
    expect(state.status).toBe('over');
    expect(state.failure?.kind).toBe('short');
    expect(state.failure?.x).toBeCloseTo(285 - PLAYER_HALF_HITBOX);
    expect(state.failure?.targetX).toBe(285);
  });
  it('does not label an unclassified fall as a late jump', () => {
    const state = arena();
    state.platforms = [{ id: 1, x: -500, width: 550, top: 0 }];
    requestJump(state);
    advance(state, 1.8);
    expect(state.status).toBe('over');
    expect(state.failure?.kind).toBe('fall');
  });
  it('reports the missed original platform rather than a later exit face as overshot', () => {
    const state = arena();
    state.platforms = [
      { id: 1, x: -500, width: 600, top: 0 },
      { id: 2, x: 185, width: 30, top: 0 },
      { id: 3, x: 370, width: 600, top: 0 },
    ];
    state.distance = 90;
    requestJump(state);
    advance(state, 1.2);
    expect(state.status).toBe('over');
    expect(state.failure?.kind).toBe('overshot');
    expect(state.failure?.targetX).toBe(185);
    expect(state.failure?.targetEnd).toBe(215);
  });
  it('returns finite held-jump landing time only for reachable heights', () => {
    expect(jumpLandingTime(0)).toBeCloseTo((2 * JUMP_VELOCITY) / GRAVITY);
    expect(jumpLandingTime(200)).toBe(Infinity);
  });
});
