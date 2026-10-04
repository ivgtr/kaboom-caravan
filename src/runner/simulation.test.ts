import { describe, expect, it } from 'vitest';
import { RIVALS, WEAPONS, WEAPON_ORDER } from './definitions';
import {
  COYOTE_TIME,
  GRAVITY,
  JUMP_AIRTIME,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  MAX_WEAPON_LEVEL,
  MIN_LANDING_RUN_TIME,
  TERRAIN_DEATH_HEIGHT,
  TERRAIN_MIN_HEIGHT,
  TERRAIN_MAX_HEIGHT,
  PLAYER_HALF_HITBOX,
  WEAPON_DISTANCE,
  collectPickup,
  createRunner,
  generateTerrain,
  getSpeed,
  jumpLandingTime,
  pauseRunner,
  requestJump,
  resumeRunner,
  startRunner,
  stepRunner,
} from './simulation';
import {
  FIXED_DT,
  type Pickup,
  type RunnerState,
  type WeaponId,
} from './types';

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
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++)
    stepRunner(state, FIXED_DT);
}

function pickup(
  state: RunnerState,
  kind: Pickup['kind'],
  weapon?: WeaponId,
): void {
  collectPickup(state, {
    id: state.nextId++,
    x: state.distance,
    y: 24,
    kind,
    weapon,
    taken: false,
  });
}

/** This player has no weapons, magnet or shield. It only presses the one jump button. */
function zeroGearPolicy(state: RunnerState): void {
  state.weapon = null;
  state.shield = 0;
  state.magnet = 0;
  state.pickups = state.pickups.filter((item) => item.kind === 'scrap');
  if (!state.player.grounded) return;
  const speed = getSpeed(state.distance);
  const support = state.platforms.find(
    (platform) =>
      state.distance + PLAYER_HALF_HITBOX > platform.x &&
      state.distance - PLAYER_HALF_HITBOX < platform.x + platform.width &&
      Math.abs(state.player.y - platform.top) < 1,
  );
  const edge = support ? support.x + support.width : Infinity;
  const next = state.platforms.find((platform) => platform.x >= edge - 0.1);
  const needsJump = next && (next.x > edge + 0.1 || next.top > state.player.y);
  const gapSoon = needsJump && edge - state.distance < speed * 0.14;
  const crateSoon = state.obstacles.some(
    (obstacle) =>
      obstacle.x > state.distance &&
      obstacle.x - state.distance <= speed * JUMP_AIRTIME * 0.5,
  );
  const rivalSoon = state.rivals.some(
    (rival) =>
      !rival.defeated &&
      rival.x > state.distance &&
      rival.x - state.distance <= (speed - rival.speed) * JUMP_AIRTIME * 0.5,
  );
  if (gapSoon || crateSoon || rivalSoon) requestJump(state);
}

describe('fixed one-button runner physics', () => {
  it('jumps immediately, has a fixed apex, and cannot double-jump', () => {
    const state = arena();
    expect(requestJump(state)).toBe(true);
    expect(state.player.vy).toBe(JUMP_VELOCITY);
    expect(state.jumps).toBe(1);
    let apex = 0;
    for (let frame = 0; frame < 88; frame++) {
      if (frame === 5) expect(requestJump(state)).toBe(false);
      stepRunner(state);
      apex = Math.max(apex, state.player.y);
    }
    expect(apex).toBeCloseTo(JUMP_VELOCITY ** 2 / (2 * GRAVITY), 0);
    expect(state.jumps).toBe(1);
    expect(state.player.grounded).toBe(true);
    expect(state.player.y).toBe(0);
    expect(state.player.vy).toBe(0);
  });

  it('gives a 90ms coyote window after leaving a ledge', () => {
    const state = arena();
    state.platforms = [{ id: 1, x: -500, width: 500, top: 0 }];
    state.distance = PLAYER_HALF_HITBOX;
    stepRunner(state);
    expect(state.player.grounded).toBe(false);
    expect(state.player.coyote).toBe(COYOTE_TIME);
    advance(state, 0.05);
    expect(requestJump(state)).toBe(true);
    expect(state.player.vy).toBe(JUMP_VELOCITY);
    const expired = arena();
    expired.platforms = [{ id: 1, x: -500, width: 500, top: 0 }];
    expired.distance = PLAYER_HALF_HITBOX;
    advance(expired, 0.12);
    expect(requestJump(expired)).toBe(false);
    expect(expired.jumps).toBe(0);
  });

  it.each([0, 64, -48])('buffers once when landing on a %ipx road', (top) => {
    const state = arena();
    state.platforms[0]!.top = top;
    state.player.y = top + 8;
    state.player.vy = -160;
    state.player.grounded = false;
    state.player.coyote = 0;
    expect(requestJump(state)).toBe(false);
    expect(state.player.buffer).toBe(JUMP_BUFFER_TIME);
    advance(state, 0.05);
    expect(state.jumps).toBe(1);
    expect(state.player.vy).toBeGreaterThan(480);
    expect(state.player.buffer).toBe(0);
    advance(state, 1);
    expect(state.jumps).toBe(1);
  });

  it('subdivides long frames rather than tunnelling through crates', () => {
    const state = arena();
    state.obstacles = [{ id: 9, x: 40, width: 30, top: 0, height: 28 }];
    stepRunner(state, 0.25);
    expect(state.status).toBe('over');
    expect(state.reason).toBe('obstacle');
  });

  it('stops at a rising face without snapping up, even with a shield or long frame', () => {
    const state = arena();
    state.platforms = [
      { id: 1, x: -500, width: 600, top: 0 },
      { id: 2, x: 100, width: 500, top: 64 },
    ];
    state.distance = 70;
    stepRunner(state, 0.25);
    expect(state.reason).toBe('wall');
    expect(state.distance + PLAYER_HALF_HITBOX).toBeCloseTo(100);
    expect(state.player.y).toBe(0);
    expect(state.shield).toBe(1);
  });

  it('uses feet at the swept face crossing to distinguish a late jump from a top landing', () => {
    const late = arena();
    late.platforms = [{ id: 2, x: 19, width: 500, top: 64 }];
    late.player = {
      ...late.player,
      y: 64.1,
      vy: -100,
      grounded: false,
      coyote: 0,
    };
    stepRunner(late);
    expect(late.reason).toBe('wall');
    expect(late.player.y).toBeLessThan(64);

    const missedGap = arena();
    missedGap.platforms = [
      { id: 1, x: -500, width: 500, top: 0 },
      { id: 2, x: 80, width: 500, top: 0 },
    ];
    missedGap.distance = 61;
    missedGap.player = {
      ...missedGap.player,
      y: -8,
      vy: -150,
      grounded: false,
      coyote: 0,
    };
    stepRunner(missedGap);
    expect(missedGap.reason).toBe('gap');

    const clear = arena();
    clear.platforms = [{ id: 2, x: 19, width: 500, top: 64 }];
    clear.player = {
      ...clear.player,
      y: 65,
      vy: -100,
      grounded: false,
      coyote: 0,
    };
    advance(clear, 0.05);
    expect(clear.status).toBe('running');
    expect(clear.player.y).toBe(64);
    expect(clear.player.grounded).toBe(true);
  });

  it('walks off a downstep, retains coyote input, and naturally lands in the valley', () => {
    const state = arena();
    state.platforms = [
      { id: 1, x: -500, width: 600, top: 128 },
      { id: 2, x: 100, width: 1000, top: -48 },
    ];
    state.player.y = 128;
    state.distance = 110;
    while (state.player.grounded) stepRunner(state);
    expect(state.player.coyote).toBe(COYOTE_TIME);
    expect(state.player.y).toBeGreaterThan(120);
    advance(state, 0.6);
    expect(state.status).toBe('running');
    expect(state.player.y).toBe(-48);
    expect(state.player.grounded).toBe(true);
    expect(state.jumps).toBe(0);
    expect(TERRAIN_DEATH_HEIGHT).toBeLessThan(-48 - 150);
  });

  it('caps speed and never changes the jump when equipment changes', () => {
    expect(getSpeed(-100)).toBe(220);
    expect(getSpeed(0)).toBe(220);
    expect(getSpeed(9000)).toBe(280);
    expect(getSpeed(18000)).toBe(340);
    expect(getSpeed(1e12)).toBe(340);
    for (const weapon of WEAPON_ORDER) {
      const state = arena();
      pickup(state, 'weapon', weapon);
      pickup(state, 'magnet');
      requestJump(state);
      expect(state.player.vy).toBe(JUMP_VELOCITY);
      expect(state.speed).toBe(220);
    }
  });
});

describe('lifecycle and fair failure rules', () => {
  it('does not move in ready, paused or over states, and clears buffered input', () => {
    const state = createRunner(9);
    stepRunner(state);
    expect(state.distance).toBe(0);
    expect(requestJump(state)).toBe(false);
    startRunner(state);
    advance(state, 0.2);
    const distance = state.distance;
    pauseRunner(state);
    expect(requestJump(state)).toBe(false);
    advance(state, 1);
    expect(state.distance).toBe(distance);
    state.player.buffer = 0.1;
    resumeRunner(state);
    expect(state.player.buffer).toBe(0);
    advance(state, 0.2);
    expect(state.distance).toBeGreaterThan(distance);
    expect(state.jumps).toBe(0);
    state.status = 'over';
    const snapshot = JSON.stringify(state);
    stepRunner(state);
    startRunner(state);
    resumeRunner(state);
    expect(JSON.stringify(state)).toBe(snapshot);
    const restart = createRunner(9);
    expect(restart.distance).toBe(0);
    expect(restart.jumps).toBe(0);
    expect(restart.shield).toBe(1);
    expect(restart.weapon).toBeNull();
  });

  it('ignores invalid time and never runs backwards', () => {
    const state = arena();
    const before = JSON.stringify(state);
    for (const time of [-1, 0, NaN, Infinity]) stepRunner(state, time);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('gives at least one second of rival warning, then consumes only one shield', () => {
    const state = arena();
    state.rivals = [
      {
        id: 2,
        x: 25,
        y: 0,
        kind: 'basic',
        hp: 2,
        maxHp: 2,
        speed: 0,
        age: 0,
        defeated: false,
        hit: 0,
      },
    ];
    stepRunner(state);
    expect(state.shield).toBe(1);
    expect(state.status).toBe('running');
    state.rivals[0]!.age = 1;
    stepRunner(state);
    expect(state.shield).toBe(0);
    expect(state.player.invulnerable).toBeGreaterThan(1);
    advance(state, 0.12);
    expect(state.status).toBe('running');
    expect(state.player.y).toBe(0);
    expect(state.player.vy).toBe(0);
  });

  it('starts rival telegraph age only after entering the visible reaction window', () => {
    const state = arena();
    state.rivals = [
      {
        id: 2,
        x: 1000,
        y: 0,
        kind: 'basic',
        hp: 2,
        maxHp: 2,
        speed: 0,
        age: 0,
        defeated: false,
        hit: 0,
      },
    ];
    advance(state, 1);
    expect(state.rivals[0]!.age).toBe(0);
    state.rivals[0]!.x = state.distance + 499;
    advance(state, 0.5);
    expect(state.rivals[0]!.age).toBeCloseTo(0.5);
    expect(state.shield).toBe(1);
  });

  it('ends on an unshielded rival or gap; shield cannot bypass a gap or crate', () => {
    const rival = arena();
    rival.shield = 0;
    rival.rivals = [
      {
        id: 2,
        x: 15,
        y: 0,
        kind: 'basic',
        hp: 2,
        maxHp: 2,
        speed: 0,
        age: 2,
        defeated: false,
        hit: 0,
      },
    ];
    stepRunner(rival);
    expect(rival.reason).toBe('rival');
    const gap = arena();
    gap.platforms = [];
    advance(gap, 1);
    expect(gap.reason).toBe('gap');
    expect(gap.shield).toBe(1);
    const crate = arena();
    crate.obstacles = [{ id: 3, x: 30, width: 30, height: 25, top: 0 }];
    advance(crate, 0.2);
    expect(crate.reason).toBe('obstacle');
    expect(crate.shield).toBe(1);
  });
});

describe('bounded equipment and automatic combat', () => {
  it('makes high weapons a deliberate jump choice and keeps a low weapon unchanged', () => {
    const low = arena();
    pickup(low, 'weapon', 'machine');
    low.pickups = [
      { id: 5, x: 95, y: 100, kind: 'weapon', weapon: 'rocket', taken: false },
    ];
    advance(low, 0.7);
    expect(low.weapon!.id).toBe('machine');
    expect(low.pickups[0]!.taken).toBe(false);
    const high = arena();
    high.pickups = [
      { id: 5, x: 95, y: 100, kind: 'weapon', weapon: 'rocket', taken: false },
    ];
    requestJump(high);
    advance(high, 0.5);
    expect(high.weapon!.id).toBe('rocket');
    expect(high.status).toBe('running');
  });

  it('keeps starter gear optional and guarantees a local three-level build window', () => {
    const choices = new Set<WeaponId | undefined>();
    for (let seed = 1; seed <= 24; seed++) {
      const state = createRunner(seed);
      const weapons = state.pickups.filter((item) => item.kind === 'weapon');
      expect(weapons[0]).toMatchObject({ x: 490, y: 100, weapon: 'machine' });
      expect(weapons[1]!.weapon).toBe(weapons[2]!.weapon);
      choices.add(weapons[1]!.weapon);
      for (const item of weapons) {
        const road = state.platforms.find(
          (platform) =>
            item.x >= platform.x && item.x <= platform.x + platform.width,
        )!;
        expect(item.y).toBe(road.top + 100);
      }
    }
    expect(choices.size).toBe(6);
    const state = createRunner(1);
    startRunner(state);
    while (state.distance < 410) stepRunner(state);
    requestJump(state);
    advance(state, 0.45);
    expect(state.weapon!.id).toBe('machine');

    const generated = createRunner(42);
    generateTerrain(generated, 100000);
    const recoveryRoads = generated.platforms.filter(
      (road) => road.width === 1700,
    );
    for (const road of recoveryRoads) {
      const gear = generated.pickups.filter(
        (item) =>
          item.kind === 'weapon' &&
          item.x > road.x &&
          item.x < road.x + road.width,
      );
      expect(gear.map((item) => Math.round(item.x - road.x))).toEqual([
        300, 650, 1000,
      ]);
      expect(new Set(gear.map((item) => item.weapon)).size).toBe(1);
      expect(350).toBeLessThan(WEAPON_DISTANCE);
      expect(350 / getSpeed(1e9) - JUMP_AIRTIME).toBeGreaterThan(0.3);
    }
    const road = recoveryRoads.find((item) => item.x > 18000)!;
    for (const kind of Object.keys(RIVALS) as (keyof typeof RIVALS)[]) {
      for (const takeGear of [false, true]) {
        const run = arena();
        // Match real generation: rivals begin moving while the road is still
        // 2300px ahead. The empty approach isolates this road's two input routes.
        run.distance = road.x - 2300;
        run.player.y = road.top;
        run.platforms = [
          { ...road, x: road.x - 3000, width: road.width + 3000 },
        ];
        run.generatedUntil = road.x + road.width + 10000;
        run.pickups = generated.pickups
          .filter(
            (item) =>
              item.kind === 'weapon' &&
              item.x > road.x &&
              item.x < road.x + road.width,
          )
          .map((item) => ({ ...item }));
        run.rivals = generated.rivals
          .filter((rival) => rival.x > road.x && rival.x < road.x + road.width)
          .map((rival) => ({
            ...rival,
            kind,
            hp: RIVALS[kind].hp,
            maxHp: RIVALS[kind].hp,
            speed: getSpeed(road.x) * RIVALS[kind].pace,
          }));
        run.shield = 0;
        while (
          run.status === 'running' &&
          run.distance < road.x + road.width - 150
        ) {
          const nextGear = takeGear
            ? run.pickups.find((item) => !item.taken && item.x > run.distance)
            : undefined;
          const rival = run.rivals.find(
            (item) => !item.defeated && item.x > run.distance,
          );
          if (
            run.player.grounded &&
            ((nextGear &&
              nextGear.x - run.distance <
                getSpeed(run.distance) * JUMP_AIRTIME * 0.5) ||
              (rival &&
                rival.x - run.distance <
                  (getSpeed(run.distance) - rival.speed) * JUMP_AIRTIME * 0.5))
          )
            requestJump(run);
          stepRunner(run);
        }
        expect(run.status).toBe('running');
        if (takeGear) expect(run.weapon?.level).toBe(3);
        else expect(run.weapon).toBeNull();
      }
    }
  });

  it('has exactly one weapon, upgrades to level 3, refreshes, and resets on a swap', () => {
    const state = arena();
    pickup(state, 'weapon', 'machine');
    advance(state, 0.2);
    expect(state.weapon!.remaining).toBeLessThan(WEAPON_DISTANCE);
    pickup(state, 'weapon', 'machine');
    expect(state.weapon!.level).toBe(2);
    expect(state.weapon!.remaining).toBe(WEAPON_DISTANCE);
    for (let i = 0; i < 10; i++) pickup(state, 'weapon', 'machine');
    expect(state.weapon!.level).toBe(MAX_WEAPON_LEVEL);
    pickup(state, 'weapon', 'rocket');
    expect(state.weapon!.id).toBe('rocket');
    expect(state.weapon!.level).toBe(1);
    state.weapon!.remaining = 1;
    stepRunner(state);
    expect(state.weapon).toBeNull();
    expect(state.lastWeapon).toBe('rocket');
  });

  it('caps shields at one and makes the magnet collect only scrap', () => {
    const state = arena();
    for (let i = 0; i < 10; i++) pickup(state, 'shield');
    expect(state.shield).toBe(1);
    pickup(state, 'magnet');
    state.pickups = [
      { id: 3, x: 100, y: 24, kind: 'scrap', taken: false },
      { id: 4, x: 100, y: 24, kind: 'weapon', weapon: 'rocket', taken: false },
      { id: 5, x: 100, y: 24, kind: 'shield', taken: false },
    ];
    stepRunner(state);
    expect(state.scrap).toBe(1);
    expect(state.weapon).toBeNull();
    expect(state.pickups).toHaveLength(2);
    expect(state.magnet).toBeLessThan(1100);
  });

  it('does not collect the same pickup twice', () => {
    const state = arena();
    const item: Pickup = { id: 5, x: 0, y: 24, kind: 'scrap', taken: false };
    collectPickup(state, item);
    collectPickup(state, item);
    expect(state.scrap).toBe(1);
  });

  it.each(WEAPON_ORDER)(
    '%s auto-fires with its own range, cadence and damage',
    (weapon) => {
      const state = arena();
      pickup(state, 'weapon', weapon);
      state.rivals = [
        {
          id: 2,
          x: WEAPONS[weapon].range * 0.7,
          y: 0,
          kind: 'fortress',
          hp: 50,
          maxHp: 50,
          speed: 0,
          age: 2,
          defeated: false,
          hit: 0,
        },
      ];
      stepRunner(state);
      expect(state.rivals[0]!.hp).toBeCloseTo(50 - WEAPONS[weapon].damage);
      expect(state.weapon!.cooldown).toBe(WEAPONS[weapon].cadence);
      expect(state.shots[0]!.weapon).toBe(weapon);
      expect(state.shield).toBe(1);
    },
  );

  it('pierces with the railgun and rewards a defeated rival separately from distance', () => {
    const state = arena();
    pickup(state, 'weapon', 'rail');
    state.rivals = [200, 350].map((x, index) => ({
      id: index + 2,
      x,
      y: 0,
      kind: 'basic',
      hp: 2,
      maxHp: 2,
      speed: 0,
      age: 2,
      defeated: false,
      hit: 0,
    }));
    stepRunner(state);
    expect(state.defeated).toBe(2);
    expect(state.scrap).toBe(6);
    expect(state.distance).toBeLessThan(2);
  });
});

describe('deterministic endless terrain', () => {
  it('starts with a four-second learning runway and a first gap at 900px', () => {
    const state = createRunner(1);
    expect(state.platforms[0]).toMatchObject({ x: -500, width: 1400, top: 0 });
    expect(state.platforms[1]!.x).toBe(980);
    startRunner(state);
    advance(state, 3.8);
    expect(state.status).toBe('running');
    expect(state.player.grounded).toBe(true);
  });

  it('reproduces seeded vertical phrases with analytically generous jump and re-jump windows', () => {
    for (let seed = 1; seed <= 64; seed++) {
      const state = createRunner(seed);
      const clone = createRunner(seed);
      generateTerrain(state, 100000);
      generateTerrain(clone, 100000);
      expect(state.platforms).toEqual(clone.platforms);
      expect(state.obstacles).toEqual(clone.obstacles);
      expect(state.rivals).toEqual(clone.rivals);
      expect(state.platforms[2]!.top).toBe(64);
      expect(state.platforms[2]!.x).toBeLessThan(1660);
      expect(state.platforms[3]!.top).toBe(128);
      const heights = new Set(state.platforms.map((platform) => platform.top));
      expect(Math.min(...heights)).toBe(TERRAIN_MIN_HEIGHT);
      expect(Math.max(...heights)).toBe(TERRAIN_MAX_HEIGHT);
      expect(heights.size).toBeGreaterThanOrEqual(7);
      for (let i = 1; i < state.platforms.length; i++) {
        const previous = state.platforms[i - 1]!;
        const next = state.platforms[i]!;
        const edge = previous.x + previous.width;
        const gap = next.x - edge;
        const rise = next.top - previous.top;
        expect(gap).toBeGreaterThanOrEqual(-0.00001);
        expect(rise).toBeLessThanOrEqual(64);
        expect(next.top).toBeGreaterThanOrEqual(TERRAIN_MIN_HEIGHT);
        expect(next.top).toBeLessThanOrEqual(TERRAIN_MAX_HEIGHT);
        if (gap <= 0.001 && rise <= 0) continue;
        const downTime = jumpLandingTime(rise);
        const upTime =
          rise > 0
            ? (JUMP_VELOCITY -
                Math.sqrt(JUMP_VELOCITY ** 2 - 2 * GRAVITY * rise)) /
              GRAVITY
            : 0;
        // Conservative full-foot clearance, two fixed-step safety ticks, and a
        // half-second ground reserve. Check both ends of this road's speed ramp.
        for (const speed of [getSpeed(edge), getSpeed(next.x + next.width)]) {
          const reserve = speed * (MIN_LANDING_RUN_TIME + 0.14);
          const earliest = Math.max(
            speed * (upTime + 2 * FIXED_DT) - gap + PLAYER_HALF_HITBOX,
            speed * downTime - gap - next.width + PLAYER_HALF_HITBOX + reserve,
            speed * 0.04,
          );
          const latest = Math.min(
            speed * (downTime - 2 * FIXED_DT) - gap - PLAYER_HALF_HITBOX,
            speed * 0.25,
          );
          expect(
            (latest - earliest) / speed,
            `rise ${rise}, gap ${gap}, speed ${speed}`,
          ).toBeGreaterThanOrEqual(0.12);
          // The policy's middle-of-window launch leaves a further 0.14s for
          // the next launch rather than counting coyote/buffer as the solution.
          const landingInRoad = speed * (downTime - 0.14) - gap;
          expect(
            (next.width - landingInRoad - PLAYER_HALF_HITBOX) / speed - 0.14,
          ).toBeGreaterThan(MIN_LANDING_RUN_TIME);
        }
      }
      for (const item of state.pickups.filter(
        (pickup) => pickup.kind === 'weapon',
      )) {
        const road = state.platforms.find(
          (platform) =>
            item.x >= platform.x && item.x <= platform.x + platform.width,
        )!;
        expect(item.y).toBe(road.top + 100);
        expect(item.x - road.x).toBeGreaterThanOrEqual(280);
        expect(road.x + road.width - item.x).toBeGreaterThanOrEqual(280 - 1e-6);
      }
      for (const obstacle of state.obstacles) {
        const road = state.platforms.find(
          (platform) =>
            obstacle.x >= platform.x &&
            obstacle.x <= platform.x + platform.width,
        )!;
        expect(obstacle.top).toBe(road.top);
        expect(obstacle.x - road.x).toBeGreaterThanOrEqual(250 - 1e-6);
        expect(road.x + road.width - obstacle.x).toBeGreaterThanOrEqual(500);
      }
      for (const rival of state.rivals) {
        const road = state.platforms.find(
          (platform) =>
            rival.x >= platform.x && rival.x < platform.x + platform.width,
        )!;
        expect(road.width).toBeGreaterThanOrEqual(1700);
        expect(rival.y).toBe(road.top);
        expect(rival.speed).toBeLessThan(getSpeed(rival.x));
        expect(RIVALS[rival.kind].height).toBeLessThan(45);
      }
    }
  });

  it('remains passable without equipment through every stage across 64 seeds', () => {
    for (let seed = 1; seed <= 64; seed++) {
      const state = createRunner(seed * 7927);
      startRunner(state);
      while (state.status === 'running' && state.distance < 36000) {
        zeroGearPolicy(state);
        stepRunner(state);
      }
      expect(
        state.status,
        `seed ${seed}, ${state.reason} at ${state.distance.toFixed(1)}px`,
      ).toBe('running');
      expect(state.jumps).toBeGreaterThan(25);
      expect(state.passed).toBeGreaterThan(3);
      expect(state.platforms.length).toBeLessThan(16);
      expect(state.pickups.length).toBeLessThan(60);
      expect(state.rivals.length).toBeLessThan(5);
      expect(state.effects.length).toBeLessThanOrEqual(48);
      expect(state.shots.length).toBeLessThanOrEqual(24);
    }
  }, 30000);

  it('produces identical gameplay for identical inputs and fixed steps', () => {
    const a = createRunner(8675309);
    const b = createRunner(8675309);
    startRunner(a);
    startRunner(b);
    for (let i = 0; i < 5000; i++) {
      zeroGearPolicy(a);
      zeroGearPolicy(b);
      stepRunner(a);
      stepRunner(b);
    }
    expect(a).toEqual(b);
  });
});
