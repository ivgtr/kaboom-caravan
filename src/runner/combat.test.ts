import { describe, expect, it } from 'vitest';
import {
  awardScrap,
  collectPickup,
  MAX_WEAPON_LEVEL,
  rivalWarningDistance,
  RIVAL_WARNING_LEAD_TIME,
  RIVAL_WARNING_TIME,
  stepCombat,
} from './combat';
import { RIVALS, WEAPONS, WEAPON_ORDER } from './definitions';
import { getSpeed } from './pacing';
import { platformTopAt, platformsJoin, playerMuzzle } from './terrain';
import {
  createRunner,
  generateTerrain,
  releaseJump,
  requestJump,
  startRunner,
  stepRunner,
} from './simulation';
import {
  FIXED_DT,
  PLAYER_WIDTH,
  type Obstacle,
  type Rival,
  type RunnerState,
  type WeaponId,
} from './types';

function arena(weapon?: WeaponId): RunnerState {
  const state = createRunner(4);
  startRunner(state);
  state.platforms = [];
  state.rivals = [];
  state.obstacles = [];
  state.pickups = [];
  state.effects = [];
  state.shield = 0;
  if (weapon) equip(state, weapon);
  return state;
}

function equip(state: RunnerState, weapon: WeaponId): void {
  collectPickup(state, {
    id: state.nextId++,
    x: state.distance,
    y: 24,
    kind: 'weapon',
    weapon,
    taken: false,
  });
}

function rival(state: RunnerState, x: number, y = 0, hp = 10): Rival {
  const target: Rival = {
    id: state.nextId++,
    x,
    y,
    kind: 'basic',
    hp,
    maxHp: hp,
    speed: 0,
    age: 2,
    defeated: false,
    hit: 0,
  };
  state.rivals.push(target);
  return target;
}

function crate(state: RunnerState, x: number, hp = 2): Obstacle {
  const target: Obstacle = {
    id: state.nextId++,
    x,
    top: 0,
    width: 30,
    height: 28,
    hp,
    maxHp: hp,
    destroyed: false,
    hit: 0,
  };
  state.obstacles.push(target);
  return target;
}

describe('persistent equipment and run growth', () => {
  it('banks each weapon rank through swaps and rewards capped duplicates', () => {
    const state = arena('machine');
    equip(state, 'machine');
    expect(state.weapon?.level).toBe(2);
    equip(state, 'rocket');
    expect(state.weapon?.level).toBe(1);
    equip(state, 'machine');
    expect(state.weapon?.level).toBe(MAX_WEAPON_LEVEL);
    expect(state.weaponLevels.rocket).toBe(1);
    equip(state, 'machine');
    expect(state.weapon?.level).toBe(MAX_WEAPON_LEVEL);
    expect(state.scrap).toBe(3);
  });

  it('does not remove equipment after travelling beyond the old expiry distance', () => {
    const state = arena('machine');
    state.platforms = [{ id: 1, x: -100, width: 100000, top: 0 }];
    state.generatedUntil = 99999;
    for (let frame = 0; frame < 1200; frame++) stepRunner(state, FIXED_DT);
    expect(state.distance).toBeGreaterThan(1600);
    expect(state.weapon?.id).toBe('machine');
    expect(state.weapon?.level).toBe(1);
  });

  it('levels at cumulative 25, 60, 105 scrap and refreshes the contact shield', () => {
    const state = arena();
    awardScrap(state, 24);
    expect(state.runLevel).toBe(1);
    expect(state.shield).toBe(0);
    awardScrap(state, 1);
    expect(state.runLevel).toBe(2);
    expect(state.nextScrapLevel).toBe(60);
    expect(state.shield).toBe(1);
    state.shield = 0;
    awardScrap(state, 35);
    expect(state.runLevel).toBe(3);
    expect(state.nextScrapLevel).toBe(105);
    expect(state.shield).toBe(1);
  });

  it('uses kill and crate rewards for growth, and never collects a pickup twice', () => {
    const state = arena('rocket');
    state.scrap = 22;
    rival(state, 200, 0, 1);
    crate(state, 250, 1);
    stepCombat(state, FIXED_DT);
    expect(state.scrap).toBe(27);
    expect(state.runLevel).toBe(2);
    expect(state.shield).toBe(1);
    const pickup = {
      id: 999,
      x: 0,
      y: 20,
      kind: 'scrap' as const,
      taken: false,
    };
    collectPickup(state, pickup);
    collectPickup(state, pickup);
    expect(state.scrap).toBe(28);
  });
});

describe('six useful weapon patterns', () => {
  it('rapid fire damages one front target at a time', () => {
    const state = arena('machine');
    const a = rival(state, 200);
    const b = rival(state, 260);
    stepCombat(state, FIXED_DT);
    expect(a.hp).toBe(10 - WEAPONS.machine.damage);
    expect(b.hp).toBe(10);
    expect(state.shots).toHaveLength(1);
  });

  it('scatter fires five stopping pellets and spreads into a staggered cluster', () => {
    const state = arena('scatter');
    const a = rival(state, 160);
    const b = rival(state, 230, 40);
    stepCombat(state, FIXED_DT);
    expect(a.hp).toBeLessThan(10);
    expect(b.hp).toBeLessThan(10);
    expect(state.shots).toHaveLength(5);
  });

  it('rockets splash nearby targets and crates but not unrelated elevated targets', () => {
    const state = arena('rocket');
    const a = rival(state, 200);
    const b = rival(state, 260);
    const high = rival(state, 200, 150);
    const box = crate(state, 230, 10);
    stepCombat(state, FIXED_DT);
    expect(a.hp).toBeLessThan(10);
    expect(b.hp).toBeLessThan(10);
    expect(box.hp).toBeLessThan(10);
    expect(high.hp).toBe(10);
  });

  it('rail pierces aligned bodies but leaves targets off the beam untouched', () => {
    for (const kind of ['basic', 'bomber', 'heavy', 'fortress'] as const) {
      const state = arena('rail');
      const a = rival(state, 200);
      a.kind = kind;
      const b = rival(state, 360);
      const high = rival(state, 300, 100);
      stepCombat(state, FIXED_DT);
      expect(a.hp, kind).toBeLessThan(10);
      expect(b.hp, `${kind} then a shorter basic`).toBeLessThan(10);
      expect(high.hp, kind).toBe(10);
      expect(state.shots).toHaveLength(1);
      expect(state.shots[0]!.endX).toBeGreaterThan(600);
    }
  });

  it('flame sweeps a close cone across multiple nearby heights', () => {
    const state = arena('flame');
    const a = rival(state, 100);
    const b = rival(state, 145, 40);
    const high = rival(state, 145, 160);
    const far = rival(state, 300);
    stepCombat(state, FIXED_DT);
    expect(a.hp).toBeLessThan(10);
    expect(b.hp).toBeLessThan(10);
    expect(high.hp).toBe(10);
    expect(far.hp).toBe(10);
  });

  it('a near bomb can hit a rival just passed behind the cart', () => {
    const state = arena('mine');
    const behind = rival(state, -70);
    const distant = rival(state, 200);
    stepCombat(state, FIXED_DT);
    expect(behind.hp).toBeLessThan(10);
    expect(distant.hp).toBe(10);
    expect(state.shots[0]!.endX).toBe(-70);
  });

  it('jump height changes aim instead of allowing vertical homing', () => {
    const state = arena('machine');
    state.player.y = 150;
    state.player.grounded = false;
    const low = rival(state, 200);
    stepCombat(state, FIXED_DT);
    expect(low.hp).toBe(10);
    expect(state.shots).toHaveLength(0);
    const high = rival(state, 210, 150);
    stepCombat(state, FIXED_DT);
    expect(high.hp).toBeLessThan(10);
    expect(low.hp).toBe(10);
  });
});

describe('breakable route obstacles and contact', () => {
  it('lets a gun break a crate for scrap before reaching it', () => {
    const state = arena('machine');
    const box = crate(state, 125, 1);
    stepCombat(state, FIXED_DT);
    expect(box.destroyed).toBe(true);
    expect(state.scrap).toBe(2);
    expect(state.status).toBe('running');
  });

  it('uses one shield for crate contact and ends the next unprotected contact', () => {
    const state = arena();
    state.shield = 1;
    const first = crate(state, 15);
    stepCombat(state, FIXED_DT);
    expect(first.destroyed).toBe(true);
    expect(state.shield).toBe(0);
    expect(state.status).toBe('running');
    state.player.invulnerable = 0;
    crate(state, 15);
    stepCombat(state, FIXED_DT);
    expect(state.reason).toBe('obstacle');
    expect(state.status).toBe('over');
  });

  it('allows an unarmed jump to clear the same crate and rival', () => {
    const state = arena();
    state.player.y = 70;
    state.player.grounded = false;
    crate(state, 5);
    rival(state, 5);
    stepCombat(state, FIXED_DT);
    expect(state.status).toBe('running');
    expect(state.shield).toBe(0);
  });

  it('does not teleport a rival backward near the end of a short road', () => {
    const state = arena();
    state.platforms = [{ id: 1, x: 0, width: 600, top: 0 }];
    const target = rival(state, 550);
    target.speed = 100;
    stepCombat(state, 0.1);
    expect(target.x).toBe(550);
  });
});

describe('weapons on generated roads with the actual mounted muzzle', () => {
  it('the opening weapon defeats the opening rival before the first jump', () => {
    const state = createRunner(42);
    startRunner(state);
    while (state.distance < 500 && state.status === 'running')
      stepRunner(state);
    expect(state.weapon?.id).toBe('machine');
    expect(state.defeated).toBe(1);
    expect(state.status).toBe('running');
    expect(state.shield).toBe(1);
  });
});

const stages = [
  ['opening', 0],
  ['middle', 14000],
  ['cap', 34000],
] as const;

/** Keep the authored road and bodies: no flat replacement or free shield. */
function encounter(terrain: 'flat' | 'hill', minimumDistance: number) {
  const state = createRunner(42);
  generateTerrain(state, minimumDistance + 14000);
  const match = state.obstacles.flatMap((box) => {
    if (box.x < minimumDistance) return [];
    let start = state.platforms.findIndex(
      (road) => box.x >= road.x && box.x <= road.x + road.width,
    );
    let end = start;
    while (
      start > 0 &&
      platformsJoin(state.platforms[start - 1]!, state.platforms[start]!)
    )
      start--;
    while (
      state.platforms[end + 1] &&
      platformsJoin(state.platforms[end]!, state.platforms[end + 1]!)
    )
      end++;
    const roads = state.platforms.slice(start, end + 1);
    const hill = roads.some((road) => road.endTop !== undefined);
    return hill === (terrain === 'hill') ? [{ box, roads }] : [];
  })[0]!;
  expect(match).toBeDefined();
  const start = match.roads[0]!.x;
  const last = match.roads.at(-1)!;
  const end = last.x + last.width;
  state.distance = Math.max(start + 8, match.box.x - 780);
  state.speed = getSpeed(state.distance);
  const road = match.roads.find(
    (item) => state.distance >= item.x && state.distance <= item.x + item.width,
  )!;
  state.player.y = platformTopAt(road, state.distance);
  state.pickups = [];
  state.rivals = state.rivals.filter(
    (item) => item.x >= start && item.x <= end,
  );
  state.obstacles = state.obstacles.filter(
    (item) => item.x >= start && item.x <= end,
  );
  state.shield = 0;
  startRunner(state);
  return {
    state,
    box: match.box,
    rivals: [...state.rivals],
    end: Math.max(...state.rivals.map((item) => item.x)) + 100,
  };
}

function advanceEncounter(state: RunnerState, end: number, dodge = false) {
  let volleys = 0;
  let firstShotAt: number | undefined;
  let sawSlopeShot = false;
  let lastShotId = 0;
  while (state.distance < end && state.status === 'running') {
    if (dodge && state.player.grounded) {
      releaseJump(state);
      const threat = [
        ...state.obstacles
          .filter((item) => !item.destroyed)
          .map((item) => ({ x: item.x, width: item.width })),
        ...state.rivals
          .filter((item) => !item.defeated)
          .map((item) => ({ x: item.x, width: RIVALS[item.kind].width })),
      ]
        .filter(
          (item) => item.x + item.width / 2 > state.distance - PLAYER_WIDTH / 2,
        )
        .sort((a, b) => a.x - b.x)[0];
      if (threat && threat.x - state.distance < state.speed * 0.24)
        requestJump(state);
    }
    stepRunner(state);
    const newShots = state.shots.filter((shot) => shot.id > lastShotId);
    if (newShots.length) {
      volleys++;
      firstShotAt ??= state.distance;
      lastShotId = Math.max(...newShots.map((shot) => shot.id));
      const muzzle = playerMuzzle(state);
      expect(newShots[0]!.x).toBeCloseTo(muzzle.x, 6);
      expect(newShots[0]!.y).toBeCloseTo(muzzle.y, 6);
      sawSlopeShot ||=
        state.player.grounded &&
        state.platforms.some(
          (road) =>
            road.endTop !== undefined &&
            state.distance >= road.x &&
            state.distance <= road.x + road.width,
        );
    }
  }
  return { volleys, firstShotAt, sawSlopeShot };
}

describe('generated combat opportunities through the speed progression', () => {
  it.each(WEAPON_ORDER)(
    '%s earns scrap on flat and sloped roads, with a jumping escape',
    (weapon) => {
      for (const [stage, minimumDistance] of stages) {
        for (const terrain of ['flat', 'hill'] as const) {
          const { state, box, rivals, end } = encounter(
            terrain,
            minimumDistance,
          );
          equip(state, weapon);
          const result = advanceEncounter(state, end);
          const diagnostic = () =>
            JSON.stringify({
              weapon,
              terrain,
              stage,
              speed: state.speed,
              box,
              result,
              reason: state.reason,
            });
          expect(box.destroyed, diagnostic()).toBe(true);
          expect(result.volleys, diagnostic()).toBeGreaterThan(0);
          expect(state.scrap, diagnostic()).toBeGreaterThanOrEqual(2);
          expect(state.weapon!.level).toBe(1);
          expect(state.runLevel).toBe(1);
          if (weapon === 'scatter') {
            expect(result.volleys, diagnostic()).toBeGreaterThanOrEqual(2);
            expect(
              rivals.some((rival) => rival.hp < rival.maxHp),
              diagnostic(),
            ).toBe(true);
          }
          if (weapon === 'rail')
            expect(state.defeated, diagnostic()).toBeGreaterThanOrEqual(1);
          if (weapon === 'machine' && terrain === 'hill' && stage === 'cap')
            expect(result.sawSlopeShot, diagnostic()).toBe(true);
          // Armor and trailing survivors remain reasons to jump or invest in
          // growth; short-range guns do not become automatic screen wipes.
          const escape = encounter(terrain, minimumDistance);
          equip(escape.state, weapon);
          advanceEncounter(escape.state, escape.end, true);
          expect(
            escape.state.status,
            JSON.stringify({
              weapon,
              terrain,
              stage,
              reason: escape.state.reason,
              x: escape.state.distance,
            }),
          ).toBe('running');
          expect(escape.state.shield).toBe(0);
        }
      }
    },
  );

  it('keeps the same generated flat and hill encounters escapable while unarmed', () => {
    for (const [stage, minimumDistance] of stages) {
      for (const terrain of ['flat', 'hill'] as const) {
        const { state, end } = encounter(terrain, minimumDistance);
        advanceEncounter(state, end, true);
        expect(
          state.status,
          JSON.stringify({
            stage,
            terrain,
            reason: state.reason,
            x: state.distance,
          }),
        ).toBe('running');
        expect(state.jumps).toBeGreaterThan(0);
        expect(state.weapon).toBeNull();
        expect(state.shield).toBe(0);
      }
    }
  });
});

describe('real-time combat windows', () => {
  it('fires a 0.1 second flame cadence on exactly twelve fixed ticks', () => {
    const state = arena('flame');
    rival(state, 150, 0, 100);
    stepCombat(state, FIXED_DT);
    expect(state.shots).toHaveLength(3);
    for (let tick = 0; tick < 11; tick++) stepCombat(state, FIXED_DT);
    expect(state.shots).toHaveLength(3);
    stepCombat(state, FIXED_DT);
    expect(state.shots).toHaveLength(6);
  });

  it('preserves real warning and harmless grace across candidate speed caps', () => {
    for (const speed of [330, 480, 520, 560]) {
      const state = arena();
      state.speed = speed;
      const target = rival(state, rivalWarningDistance(speed) + 1);
      target.kind = 'fortress';
      target.age = 0;
      stepCombat(state, FIXED_DT);
      expect(target.age).toBe(0);
      const contact = PLAYER_WIDTH / 2 + RIVALS.fortress.width / 2;
      expect(
        (rivalWarningDistance(speed) - contact) / speed,
      ).toBeGreaterThanOrEqual(RIVAL_WARNING_LEAD_TIME - 1e-9);
      state.distance = 2;
      stepCombat(state, FIXED_DT);
      expect(target.age).toBe(FIXED_DT);
      state.distance = target.x;
      target.age = RIVAL_WARNING_TIME - 2 * FIXED_DT;
      stepCombat(state, FIXED_DT);
      expect(state.status).toBe('running');
      stepCombat(state, FIXED_DT * 2);
      expect(state.status).toBe('over');
    }
  });

  it('grows all six weapons proportionately without losing their cadence identities', () => {
    for (const weapon of WEAPON_ORDER) {
      const base = arena(weapon);
      const grown = arena(weapon);
      equip(grown, weapon);
      equip(grown, weapon);
      awardScrap(grown, 60);
      const a = rival(base, 100, 0, 1000);
      const b = rival(grown, 100, 0, 1000);
      stepCombat(base, FIXED_DT);
      stepCombat(grown, FIXED_DT);
      expect((1000 - b.hp) / (1000 - a.hp)).toBeCloseTo(1.9 * 1.36, 8);
      expect(grown.weapon!.cooldown / base.weapon!.cooldown).toBeCloseTo(
        1 / 1.42,
        8,
      );
      expect(WEAPONS[weapon].range).toBeLessThanOrEqual(700);
    }
  });

  it('earns one fast scatter follow-up only after a real breach', () => {
    const armor = arena('scatter');
    rival(armor, 160, 0, 100);
    stepCombat(armor, FIXED_DT);
    expect(armor.weapon!.cooldown).toBe(WEAPONS.scatter.cadence);

    const breach = arena('scatter');
    const box = crate(breach, 160, 1);
    const target = rival(breach, 230, 40, 1);
    stepCombat(breach, FIXED_DT);
    expect(box.destroyed).toBe(true);
    expect(target.defeated).toBe(true);
    expect(breach.shots).toHaveLength(5);
    expect(breach.weapon!.cooldown).toBe(WEAPONS.scatter.breachCadence);

    const grown = arena('scatter');
    equip(grown, 'scatter');
    equip(grown, 'scatter');
    awardScrap(grown, 60);
    crate(grown, 160, 1);
    stepCombat(grown, FIXED_DT);
    expect(grown.weapon!.cooldown).toBeCloseTo(
      WEAPONS.scatter.breachCadence! / 1.42,
      8,
    );
  });

  it('retains actual, distinct firing opportunities at the three candidate caps', () => {
    const windows = [
      [480, [5, 1, 1, 2, 4, 1]],
      [520, [4, 1, 1, 2, 4, 1]],
      [560, [4, 1, 1, 2, 3, 1]],
    ] as const;
    for (const [speed, expected] of windows) {
      for (const [index, weapon] of WEAPON_ORDER.entries()) {
        const state = arena(weapon);
        state.speed = speed;
        state.platforms = [{ id: 1, x: -100, width: 2000, top: 0 }];
        rival(state, 800, 0, 1000);
        let volleys = 0;
        while (state.status === 'running') {
          state.distance += speed * FIXED_DT;
          state.shots = [];
          stepCombat(state, FIXED_DT);
          if (state.shots.length) volleys++;
        }
        expect(volleys, `${weapon} at ${speed}px/s`).toBe(expected[index]);
      }
    }
  });
});
