import { describe, expect, it } from 'vitest';
import {
  awardScrap,
  collectPickup,
  MAX_WEAPON_LEVEL,
  stepCombat,
} from './combat';
import { WEAPONS, WEAPON_ORDER } from './definitions';
import {
  createRunner,
  generateTerrain,
  startRunner,
  stepRunner,
} from './simulation';
import {
  FIXED_DT,
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

  it('makes later run levels measurably improve damage and cadence', () => {
    const first = arena('machine');
    const grown = arena('machine');
    awardScrap(grown, 60);
    const a = rival(first, 200);
    const b = rival(grown, 200);
    stepCombat(first, FIXED_DT);
    stepCombat(grown, FIXED_DT);
    expect(b.hp).toBeLessThan(a.hp);
    expect(grown.weapon!.cooldown).toBeLessThan(first.weapon!.cooldown);
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
    const state = arena('rail');
    const a = rival(state, 200);
    const b = rival(state, 360);
    const high = rival(state, 300, 100);
    stepCombat(state, FIXED_DT);
    expect(a.hp).toBeLessThan(10);
    expect(b.hp).toBeLessThan(10);
    expect(high.hp).toBe(10);
    expect(state.shots[0]!.endX).toBeGreaterThan(600);
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

  it.each(WEAPON_ORDER)(
    '%s is useful against a real generated crate/target lane',
    (weapon) => {
      const state = createRunner(42);
      generateTerrain(state, 12000);
      const firstCrate = state.obstacles[0]!;
      const road = state.platforms.find(
        (platform) =>
          firstCrate.x >= platform.x &&
          firstCrate.x <= platform.x + platform.width,
      )!;
      // Enter the authored lane on foot with the selected persistent weapon.
      state.distance = firstCrate.x - 255;
      state.player.y = road.top;
      state.pickups = state.pickups.filter((item) => item.kind === 'scrap');
      state.shield = 0;
      startRunner(state);
      equip(state, weapon);
      const target = state.rivals.find((item) => item.x > firstCrate.x)!;
      while (state.distance < firstCrate.x + 190 && state.status === 'running')
        stepRunner(state);
      expect(firstCrate.destroyed).toBe(true);
      expect(state.scrap).toBeGreaterThanOrEqual(2);
      expect(
        target.defeated,
        JSON.stringify({
          target,
          player: state.player,
          distance: state.distance,
          weapon: state.weapon,
          reason: state.reason,
          crate: firstCrate,
        }),
      ).toBe(true);
      expect(state.status).toBe('running');
    },
  );
});

describe('authored sloped target formations', () => {
  it.each(WEAPON_ORDER)(
    '%s can use the ramp encounter from the road',
    (weapon) => {
      const state = createRunner(42);
      generateTerrain(state, 14000);
      const target = state.rivals.find((item) =>
        state.platforms.some(
          (platform) =>
            platform.endTop !== undefined &&
            item.x >= platform.x &&
            item.x <= platform.x + platform.width,
        ),
      )!;
      expect(target).toBeDefined();
      const ramp = state.platforms.find(
        (platform) =>
          platform.endTop !== undefined &&
          target.x >= platform.x &&
          target.x <= platform.x + platform.width,
      )!;
      state.distance = ramp.x - 230;
      state.player.y = ramp.top;
      state.pickups = state.pickups.filter((item) => item.kind === 'scrap');
      state.shield = 0;
      startRunner(state);
      equip(state, weapon);
      while (state.distance < target.x + 65 && state.status === 'running')
        stepRunner(state);
      expect(
        target.defeated,
        JSON.stringify({
          weapon,
          target,
          reason: state.reason,
          x: state.distance,
        }),
      ).toBe(true);
      expect(state.status).toBe('running');
    },
  );
});
