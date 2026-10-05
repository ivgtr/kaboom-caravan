import { describe, expect, it } from 'vitest';
import { RIVALS } from './definitions';
import {
  DOUBLE_BEAT_DISTANCE,
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

/** Input-only pilot: hop hazards, reserve the second press for a low approach. */
function fullPilot(state: RunnerState): void {
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
  const threat = threats[0];
  if (state.player.grounded) {
    releaseJump(state);
    if (
      roadEnd(state) - state.distance <= getSpeed(state.distance) * 0.12 ||
      (threat && threat.x - state.distance < getSpeed(state.distance) * 0.24)
    )
      requestJump(state);
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
            getSpeed(state.distance),
        )
      : Infinity;
    const dangerAhead =
      threat &&
      collisionTime < 0.24 &&
      state.player.y +
        state.player.vy * collisionTime -
        0.5 * GRAVITY * collisionTime ** 2 <
        threat.top + 5;
    const faceTime = nextRoad
      ? Math.max(
          0,
          (nextRoad.x - PLAYER_HALF_HITBOX - state.distance) /
            getSpeed(state.distance),
        )
      : Infinity;
    const landingTooLow =
      nextRoad &&
      faceTime > 0 &&
      faceTime < 0.42 &&
      state.player.y +
        state.player.vy * faceTime -
        0.5 * GRAVITY * faceTime ** 2 <
        nextRoad.top + 3;
    if (dangerAhead || landingTooLow) {
      releaseJump(state);
      requestJump(state);
    }
  }
}

describe('responsive one-button movement', () => {
  it('accelerates briskly then tapers smoothly into a bounded 520px/s cruise', () => {
    expect(getSpeed(-100)).toBe(START_SPEED);
    expect(getSpeed(0)).toBe(330);
    expect(getSpeed(SPEED_RAMP_DISTANCE / 2)).toBe(496.25);
    expect(getSpeed(SPEED_RAMP_DISTANCE)).toBe(MAX_SPEED);
    expect(getSpeed(1e9)).toBe(MAX_SPEED);
    let previousGain = Infinity;
    for (let x = 1000; x <= SPEED_RAMP_DISTANCE; x += 1000) {
      const gain = getSpeed(x) - getSpeed(x - 1000);
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThan(previousGain);
      previousGain = gain;
    }
    expect(
      getSpeed(SPEED_RAMP_DISTANCE) - getSpeed(SPEED_RAMP_DISTANCE - 1),
    ).toBeLessThan(1e-8);
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

describe('complete endless course', () => {
  it('has an early simple gap and genuinely seeded opening variation', () => {
    const a = createRunner(42),
      b = createRunner(84),
      replay = createRunner(42);
    expect(a).toEqual(replay);
    expect(a.platforms).not.toEqual(b.platforms);
    const edge = a.platforms[0]!.x + a.platforms[0]!.width;
    expect(edge / getSpeed(0)).toBeGreaterThan(1.5);
    expect(edge / getSpeed(0)).toBeLessThan(1.9);
    expect(a.platforms[1]!.top).toBe(0);
    expect(a.platforms[1]!.width).toBeGreaterThan(480);
    expect(
      a.pickups.some((p) => p.kind === 'weapon' && p.x < 300 && p.y < 40),
    ).toBe(true);
    expect(a.rivals.some((r) => r.x < edge)).toBe(true);
  });
  it('alternates low hops, held drops and broad double beats without stacking steep combat', () => {
    for (const seed of [1, 7, 42, 991]) {
      const state = createRunner(seed);
      generateTerrain(state, 70000);
      let doubleCount = 0,
        slopeCount = 0,
        longCount = 0,
        lowCount = 0;
      for (let i = 1; i < state.platforms.length; i++) {
        const p = state.platforms[i]!,
          prev = state.platforms[i - 1]!;
        for (const height of [p.top, p.endTop ?? p.top]) {
          expect(height).toBeGreaterThanOrEqual(TERRAIN_MIN_HEIGHT);
          expect(height).toBeLessThanOrEqual(TERRAIN_MAX_HEIGHT);
        }
        const slope = Math.abs((p.endTop ?? p.top) - p.top) / p.width;
        if (slope > 0.25) {
          slopeCount++;
          expect(p.width).toBe(200);
          expect(
            state.rivals.some((r) => r.x >= p.x && r.x <= p.x + p.width),
          ).toBe(false);
        }
        if (platformsJoin(prev, p)) continue;
        expect(p.width).toBeGreaterThanOrEqual(300);
        const edge = prev.x + prev.width;
        const gapTime = (p.x - edge) / getSpeed(edge);
        if (gapTime > 0.5) {
          longCount++;
          expect(p.top).toBeLessThanOrEqual(prev.endTop ?? prev.top);
        } else if (gapTime < 0.33) lowCount++;
        if (
          state.platforms[i + 1] &&
          !platformsJoin(p, state.platforms[i + 1]!) &&
          p.width / getSpeed(p.x) < 1.1
        ) {
          doubleCount++;
          expect(p.x).toBeGreaterThan(DOUBLE_BEAT_DISTANCE);
          expect(p.width / getSpeed(p.x)).toBeGreaterThanOrEqual(0.959);
          expect(state.platforms[i + 1]!.width).toBeGreaterThanOrEqual(620);
          expect(
            state.rivals.some((r) => r.x >= p.x && r.x <= p.x + p.width),
          ).toBe(false);
        }
      }
      expect(doubleCount).toBeGreaterThan(0);
      expect(slopeCount).toBeGreaterThan(0);
      expect(longCount).toBeGreaterThan(0);
      expect(lowCount).toBeGreaterThan(longCount);
    }
  });
  it('keeps required beats between 1.2 and 3.7 seconds with a slower battle contrast', () => {
    const state = createRunner(42);
    generateTerrain(state, 70000);
    const edges = state.platforms.flatMap((p, i) =>
      state.platforms[i + 1] && !platformsJoin(p, state.platforms[i + 1]!)
        ? [p.x + p.width]
        : [],
    );
    const durations = edges
      .slice(1)
      .map((edge, i) => (edge - edges[i]!) / getSpeed(edges[i]!));
    expect(Math.min(...durations)).toBeGreaterThan(1.2);
    expect(Math.max(...durations)).toBeLessThan(3.7);
    expect(durations.some((t) => t < 1.4)).toBe(true);
    expect(durations.some((t) => t > 3.4)).toBe(true);
  });
  it('introduces rival classes gradually then keeps easier encounters between fortress fights', () => {
    const state = createRunner(42);
    generateTerrain(state, 70000);
    const mainKinds = state.obstacles.map(
      (crate) =>
        state.rivals.find((r) => Math.abs(r.x - crate.x - 80) < 0.001)!.kind,
    );
    const cycle = [
      'basic',
      'rusher',
      'heavy',
      'bomber',
      'artillery',
      'fortress',
    ];
    expect(mainKinds.slice(0, 6)).toEqual(cycle);
    expect(mainKinds.slice(6, 12)).toEqual(cycle);
    for (const rival of state.rivals.filter((r) => r.x > 1000)) {
      let index = state.platforms.findIndex(
        (p) => rival.x >= p.x && rival.x <= p.x + p.width,
      );
      while (
        state.platforms[index + 1] &&
        platformsJoin(state.platforms[index]!, state.platforms[index + 1]!)
      )
        index++;
      const road = state.platforms[index]!;
      const runway =
        road.x + road.width - rival.x - RIVALS[rival.kind].width / 2;
      expect(runway / getSpeed(road.x + road.width)).toBeGreaterThan(1.05);
    }
  });
  it('preserves generated terrain when extending its prefix', () => {
    const state = createRunner(41),
      old = structuredClone(state.platforms);
    generateTerrain(state, 9000);
    expect(state.platforms.slice(0, old.length)).toEqual(old);
  });
  it('carries eight seeded routes through early, middle and capped speed with three takeoff timings', () => {
    for (const seed of [1, 2, 7, 42, 84, 991, 12345, 0xffffffff]) {
      for (const lead of [0.08, 0.12, 0.16]) {
        const state = createRunner(seed);
        generateTerrain(state, 70000);
        // Terrain proof uses no power-ups, recovery hop, invulnerability, or position resets.
        state.rivals = [];
        state.obstacles = [];
        state.pickups = [];
        state.shield = 0;
        startRunner(state);
        let tightestDecision = Infinity;
        while (state.distance < 65000 && state.status === 'running') {
          terrainPilot(state, lead);
          const airborne = !state.player.grounded;
          stepRunner(state);
          if (airborne && state.player.grounded)
            tightestDecision = Math.min(
              tightestDecision,
              (roadEnd(state) - state.distance) / getSpeed(state.distance) -
                lead,
            );
        }
        // Full holds also leave time to deliberately release and press again.
        expect(tightestDecision).toBeGreaterThan(0.4);
        expect(
          state.status,
          JSON.stringify({
            seed,
            lead,
            x: state.distance,
            failure: state.failure,
            platforms: state.platforms.slice(0, 5),
          }),
        ).toBe('running');
        expect({
          seed,
          lead,
          status: state.status,
          reason: state.reason,
          x: state.distance,
          failure: state.failure,
        }).toMatchObject({ seed, lead, status: 'running', reason: null });
        expect(state.distance).toBeGreaterThan(65000);
        expect(state.jumps).toBeGreaterThan(45);
        expect(state.player.airHops).toBe(1);
      }
    }
  }, 20000);
  it('lets 50ms low taps take the short trails through a complete carried route', () => {
    for (const seed of [7, 42, 991]) {
      const state = createRunner(seed);
      generateTerrain(state, 50000);
      state.rivals = [];
      state.obstacles = [];
      state.pickups = [];
      state.shield = 0;
      startRunner(state);
      let lowReleases = 0;
      while (state.distance < 45000 && state.status === 'running') {
        const held = state.player.holding;
        terrainPilot(state, 0.12, true);
        if (held && !state.player.grounded && !state.player.holding)
          lowReleases++;
        stepRunner(state);
      }
      expect(state.status, JSON.stringify(state.failure)).toBe('running');
      expect(lowReleases).toBeGreaterThan(10);
      expect(state.player.airHops).toBe(1);
    }
  });
  it('makes long drops ask for a hold while short gaps accept either a tap or hold', () => {
    const course = createRunner(42);
    generateTerrain(course, 45000);
    for (const long of [false, true]) {
      const index = course.platforms.findIndex((road, i) => {
        const prev = course.platforms[i - 1];
        if (!prev || platformsJoin(prev, road) || road.x < SPEED_RAMP_DISTANCE)
          return false;
        const time = (road.x - prev.x - prev.width) / MAX_SPEED;
        return long ? time > 0.5 : time < 0.33;
      });
      const target = course.platforms[index]!,
        prev = course.platforms[index - 1]!;
      for (const tap of [true, false]) {
        const state = arena();
        state.platforms = [prev, target];
        state.distance = prev.x + prev.width - MAX_SPEED * 0.12;
        state.player.y = platformTopAt(prev, state.distance);
        requestJump(state);
        advance(state, 0.05);
        if (tap) releaseJump(state);
        advance(state, 0.82);
        expect(state.status).toBe(long && tap ? 'over' : 'running');
        if (!(long && tap)) expect(state.player.grounded).toBe(true);
        expect(state.player.airHops).toBe(1);
      }
    }
  });
});

it('replays 80 seconds of physical 16ms input through cap at 60, 120 and 144Hz', () => {
  for (const collect of [true, false]) {
    const { state, inputs, minimumLandingRunway } = buildReplay(
      42,
      80,
      collect,
    );
    expect(
      state.status,
      JSON.stringify({
        collect,
        time: state.time,
        x: state.distance,
        failure: state.failure,
      }),
    ).toBe('running');
    expect(state.distance).toBeGreaterThan(SPEED_RAMP_DISTANCE);
    expect(inputs.length).toBeGreaterThan(60);
    // Greedy optional gear jumps must also leave a readable next decision.
    expect(minimumLandingRunway).toBeGreaterThan(0.54);
    if (collect)
      expect(Object.keys(state.weaponLevels).length).toBeGreaterThan(2);
    for (const hz of [60, 120, 144]) {
      const replay = replayAtRefresh(inputs, 80, hz);
      expect(
        replay.status,
        JSON.stringify({
          collect,
          hz,
          x: replay.distance,
          failure: replay.failure,
        }),
      ).toBe('running');
      expect(Math.abs(replay.distance - state.distance)).toBeLessThan(
        MAX_SPEED * FIXED_DT * 2,
      );
      expect(replay.jumps).toBe(state.jumps);
    }
  }
});

describe('integrated movement and combat routes', () => {
  it('survives every mixed encounter without weapons or shielding', () => {
    for (const seed of [1, 3, 42, 84, 991]) {
      const state = createRunner(seed);
      generateTerrain(state, 50000);
      state.pickups = [];
      state.shield = 0;
      startRunner(state);
      while (state.distance < 45000 && state.status === 'running') {
        fullPilot(state);
        stepRunner(state);
      }
      expect(
        state.status,
        JSON.stringify({
          seed,
          x: state.distance,
          reason: state.reason,
          failure: state.failure,
          nearby: state.platforms.slice(0, 6),
        }),
      ).toBe('running');
      expect(state.shield).toBe(0);
      expect(state.weapon).toBeNull();
    }
  });
  it('makes the first gun useful before the first gap and preserves it while running low', () => {
    const state = createRunner(42);
    startRunner(state);
    while (state.distance < 2500 && state.status === 'running') {
      fullPilot(state);
      stepRunner(state);
    }
    expect(state.status).toBe('running');
    expect(state.defeated).toBeGreaterThan(0);
    expect(state.weapon?.id).toBe('machine');
  });
});

describe('observed failure feedback', () => {
  it('identifies a no-input fall only when no jump was made on that flight', () => {
    const state = createRunner(42);
    startRunner(state);
    advance(state, 3);
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
