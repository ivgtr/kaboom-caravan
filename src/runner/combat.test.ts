import { describe, expect, it } from 'vitest';
import {
  awardScrap,
  AWAKENED_BOOST_PULSE_RADIUS,
  AWAKENED_BOOST_RADIUS,
  BOMBER_BLAST_DAMAGE,
  BOMBER_BLAST_RADIUS,
  collectPickup,
  landingBlast,
  MAX_WEAPON_LEVEL,
  rivalWarningDistance,
  RIVAL_WARNING_LEAD_TIME,
  RIVAL_WARNING_TIME,
  stepCombat,
} from './combat';
import { RIVALS, WEAPONS, WEAPON_ORDER } from './definitions';
import { stepFeverWorld } from './fever';
import { createRunner, startRunner, stepRunner } from './simulation';
import { platformTopAt } from './terrain';
import {
  FIXED_DT,
  PLAYER_WIDTH,
  type AbilityId,
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
    expect(
      state.effects.filter((effect) => effect.kind === 'guard'),
    ).toHaveLength(1);
    expect(
      state.effects.find((effect) => effect.kind === 'guard')?.maxLife,
    ).toBe(0.22);
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

describe('rival encounter roles', () => {
  it('holds an oncoming rusher still for its full warning before charging', () => {
    const state = arena();
    state.platforms = [{ id: 1, x: -200, width: 1200, top: 0 }];
    const target = rival(state, 350);
    target.kind = 'rusher';
    target.age = 0;
    target.speed = -100;
    for (let tick = 0; tick < 95; tick++) stepCombat(state, FIXED_DT);
    expect(target.age).toBeLessThan(RIVAL_WARNING_TIME);
    expect(target.x).toBe(350);
    expect(target.speed).toBe(0);
    stepCombat(state, 0.11);
    expect(target.x).toBeLessThan(344);
    expect(target.speed).toBeLessThan(0);
    expect(state.status).toBe('running');
  });

  it('shows an active rusher approach before the ordinary gun can erase it', () => {
    for (const speed of [330, 1650]) {
      const state = arena('machine');
      state.speed = speed;
      state.platforms = [{ id: 1, x: -200, width: 10000, top: 0 }];
      const initialX = rivalWarningDistance(speed, 'rusher');
      const target = rival(state, initialX, 0, RIVALS.rusher.hp);
      target.kind = 'rusher';
      target.age = 0;
      while (target.age <= RIVAL_WARNING_TIME) {
        const oldX = state.distance;
        state.distance += speed * FIXED_DT;
        stepCombat(state, FIXED_DT, oldX);
      }
      expect(target.speed).toBeLessThan(0);
      expect(target.x - state.distance).toBeGreaterThan(WEAPONS.machine.range);
      expect(target.hp).toBe(RIVALS.rusher.hp);
      for (let tick = 0; tick < 120 && !target.defeated; tick++) {
        const oldX = state.distance;
        state.distance += speed * FIXED_DT;
        stepCombat(state, FIXED_DT, oldX);
      }
      expect(target.defeated).toBe(true);
      expect(initialX - target.x).toBeGreaterThan(-target.speed * 0.3);
      expect(state.status).toBe('running');
    }
  });

  it('patrols across joined slopes in both directions but stops at a real gap', () => {
    for (const direction of [-1, 1]) {
      const state = arena();
      state.platforms = [
        { id: 1, x: 0, width: 300, top: 0, endTop: 90 },
        { id: 2, x: 300, width: 300, top: 90, endTop: 30 },
      ];
      state.player.y = 200;
      const target = rival(state, direction > 0 ? 290 : 310);
      target.speed = direction * 100;
      stepCombat(state, 0.2);
      expect(target.x).toBe(direction > 0 ? 310 : 290);
      const road = state.platforms[direction > 0 ? 1 : 0]!;
      expect(target.y).toBe(platformTopAt(road, target.x));
      stepCombat(state, 10);
      expect(target.x).toBe(direction > 0 ? 520 : 80);
      expect(target.y).toBe(
        platformTopAt(state.platforms[direction > 0 ? 1 : 0]!, target.x),
      );
    }
  });

  it('sweeps moving bodies relative to the player, including an oncoming pass', () => {
    const state = arena();
    state.platforms = [{ id: 1, x: -500, width: 1500, top: 0 }];
    const target = rival(state, 100);
    target.kind = 'rusher';
    stepCombat(state, 2);
    expect(target.x).toBeLessThan(-40);
    expect(state.reason).toBe('rival');
  });

  it('chains bomber blasts through real nearby bodies once, with a bounded radius', () => {
    const state = arena('machine');
    const first = rival(state, 200, 0, 1);
    first.kind = 'bomber';
    const second = rival(state, 350, 0, 3);
    second.kind = 'bomber';
    const chainTarget = rival(state, 500, 0, 2);
    const armor = rival(state, 530, 0, RIVALS.fortress.hp);
    armor.kind = 'fortress';
    const high = rival(state, 205, 220, 2);
    const far = rival(state, 800, 0, 2);
    const box = crate(state, 240, 2);
    stepCombat(state, FIXED_DT);
    expect(first.defeated && second.defeated && chainTarget.defeated).toBe(
      true,
    );
    expect(box.destroyed).toBe(true);
    expect(armor.hp).toBe(RIVALS.fortress.hp - BOMBER_BLAST_DAMAGE);
    expect(high.hp).toBe(2);
    expect(far.hp).toBe(2);
    expect(state.defeated).toBe(3);
    expect(state.fever.chain).toBe(4);
    expect(state.scrap).toBe(11);
    expect(
      state.effects.filter((effect) => effect.radius === BOMBER_BLAST_RADIUS),
    ).toHaveLength(2);
  });

  it('lets a landing detonate a golden bomber and carry infection into its chain', () => {
    const state = arena();
    state.fever.abilities.gold = 1;
    const first = rival(state, 40, 0, 1);
    first.kind = 'bomber';
    first.golden = true;
    const next = rival(state, 190, 0, 2);
    landingBlast(state);
    expect(first.defeated).toBe(true);
    expect(next.defeated).toBe(true);
    expect(next.golden).toBe(true);
    expect(state.fever.goldCharge).toBe(2);
    expect(state.fever.chain).toBe(2);
  });

  it('makes armor a tougher scrap target while preserving a full-speed boost breach', () => {
    const state = arena('machine');
    const heavy = rival(state, 200, 0, RIVALS.heavy.hp);
    heavy.kind = 'heavy';
    stepCombat(state, FIXED_DT);
    expect(heavy.hp).toBe(5);
    expect(heavy.defeated).toBe(false);
    state.fever.abilities.boost = 1;
    state.speed = 480;
    const fortress = rival(state, 0, 0, RIVALS.fortress.hp);
    fortress.kind = 'fortress';
    stepCombat(state, FIXED_DT);
    expect(fortress.defeated).toBe(true);
    expect(state.scrap).toBe(RIVALS.fortress.scrap);
    expect(state.pickups).toHaveLength(0);
    expect(state.status).toBe('running');
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
});

function awaken(state: RunnerState, ability: AbilityId): void {
  state.fever.abilities[ability] = 20;
  state.fever.awakening[ability] = 3;
  state.fever.awakeningSerial[ability]++;
}

describe('temporary MAX reward combat awakenings', () => {
  it('gives BOOST real ahead-of-contact reach, with a bounded height and distance', () => {
    const state = arena();
    state.speed = 480;
    state.fever.abilities.boost = 20;
    const front = rival(state, 400, 0, 100);
    const high = rival(state, 400, 310, 100);
    const far = crate(state, 600, 100);
    stepCombat(state, FIXED_DT);
    expect(front.hp).toBe(100);
    awaken(state, 'boost');
    stepCombat(state, FIXED_DT);
    expect(front.defeated).toBe(true);
    expect(high.hp).toBe(100);
    expect(far.hp).toBe(100);
    expect(state.player.invulnerable).toBe(0);
    expect(
      state.effects.some(
        (effect) => effect.radius === AWAKENED_BOOST_PULSE_RADIUS,
      ),
    ).toBe(true);
    const sustained = crate(state, 280, 100);
    stepCombat(state, FIXED_DT);
    expect(sustained.destroyed).toBe(true);
    expect(
      state.effects.some((effect) => effect.radius === AWAKENED_BOOST_RADIUS),
    ).toBe(true);
  });

  it('retriggers a fresh BOOST pulse once per MAX draw and removes extra reach at expiry', () => {
    const state = arena();
    awaken(state, 'boost');
    stepCombat(state, FIXED_DT);
    const nextGroup = rival(state, 420, 0, 100);
    stepCombat(state, FIXED_DT);
    expect(nextGroup.defeated).toBe(false);
    state.fever.awakeningSerial.boost++;
    stepCombat(state, FIXED_DT);
    expect(nextGroup.defeated).toBe(true);
    const score = state.score;
    stepCombat(state, FIXED_DT);
    expect(state.score).toBe(score);
    stepFeverWorld(state, 3.1);
    const after = crate(state, 280, 100);
    stepCombat(state, FIXED_DT);
    expect(after.destroyed).toBe(false);
    expect(state.fever.awakening.boost).toBe(0);
  });

  it('keeps the rusher telegraph and defers awakening pulses through FREEZE', () => {
    const state = arena();
    awaken(state, 'boost');
    const rushing = rival(state, 250, 0, 3);
    rushing.kind = 'rusher';
    rushing.age = 0;
    const front = crate(state, 420);
    state.fever.freeze = 0.3;
    stepCombat(state, 0.3);
    expect(front.destroyed).toBe(false);
    expect(state.fever.awakeningSeen.boost).toBe(0);
    state.fever.freeze = 0;
    stepCombat(state, FIXED_DT);
    expect(front.destroyed).toBe(true);
    expect(rushing.defeated).toBe(false);
    stepCombat(state, RIVAL_WARNING_TIME);
    expect(rushing.defeated).toBe(true);
  });

  it('does not let awakened BOOST survive a real missing-road fall', () => {
    const state = arena();
    awaken(state, 'boost');
    state.platforms = [{ id: 1, x: -100, width: 500, top: 0 }];
    state.generatedUntil = 100000;
    state.speed = 1400;
    for (let frame = 0; frame < 300 && state.status === 'running'; frame++)
      stepRunner(state, FIXED_DT);
    expect(state.status).toBe('over');
    expect(state.reason).toBe('gap');
  });

  it('adds actual forward SLAM blast points while damaging each overlapping body only once', () => {
    const state = arena();
    state.fever.abilities.slam = 20;
    const distant = rival(state, 1100, 0, 20);
    const high = rival(state, 1100, 600, 20);
    landingBlast(state);
    expect(distant.defeated).toBe(false);
    state.effects = [];
    const overlap = rival(state, 500, 0, 1000);
    awaken(state, 'slam');
    landingBlast(state);
    expect(distant.defeated).toBe(true);
    expect(high.defeated).toBe(false);
    expect(overlap.hp).toBeCloseTo(1000 - 46 * 1.8, 8);
    const blasts = state.effects.filter((effect) => effect.kind === 'slam');
    expect(blasts).toHaveLength(4);
    expect(new Set(blasts.map((blast) => blast.x)).size).toBe(4);
    expect(state.fever.chain).toBe(1);
  });

  it('charges one extra physical SLAM echo per fresh MAX reveal and consumes it only on landing', () => {
    const state = arena();
    awaken(state, 'slam');
    const firstEcho = crate(state, 1600);
    const beyond = crate(state, 1900);
    stepCombat(state, FIXED_DT);
    expect(firstEcho.destroyed).toBe(false);
    expect(state.fever.awakeningSeen.slam).toBe(0);
    landingBlast(state);
    expect(firstEcho.destroyed).toBe(true);
    expect(beyond.destroyed).toBe(false);
    expect(state.fever.awakeningSeen.slam).toBe(1);
    state.effects = [];
    const secondEcho = crate(state, 1600);
    landingBlast(state);
    expect(secondEcho.destroyed).toBe(false);
    expect(
      state.effects.filter((effect) => effect.kind === 'slam'),
    ).toHaveLength(3);
    // The duration remains unchanged: this draw has a distinct physical benefit
    // even if the temporary effect was already at its maximum duration.
    state.fever.awakening.slam = 6;
    state.fever.awakeningSerial.slam++;
    stepCombat(state, FIXED_DT);
    expect(secondEcho.destroyed).toBe(false);
    expect(state.fever.awakeningSeen.slam).toBe(1);
    state.effects = [];
    landingBlast(state);
    expect(secondEcho.destroyed).toBe(true);
    expect(beyond.destroyed).toBe(false);
    expect(
      state.effects.filter((effect) => effect.kind === 'slam'),
    ).toHaveLength(4);
    expect(state.fever.awakeningSeen.slam).toBe(2);
    expect(state.fever.chain).toBe(2);
    const thirdEcho = crate(state, 1600);
    state.effects = [];
    landingBlast(state);
    expect(thirdEcho.destroyed).toBe(false);
    expect(
      state.effects.filter((effect) => effect.kind === 'slam'),
    ).toHaveLength(3);
  });

  it('expires SLAM chains and never rewards an already-destroyed chain twice', () => {
    const state = arena();
    awaken(state, 'slam');
    const a = crate(state, 950),
      b = crate(state, 1150);
    landingBlast(state);
    expect(a.destroyed && b.destroyed).toBe(true);
    const score = state.score;
    const scrap = state.scrap;
    landingBlast(state);
    expect(state.score).toBe(score);
    expect(state.scrap).toBe(scrap);
    stepFeverWorld(state, 3.1);
    state.effects = [];
    const after = crate(state, 1100);
    landingBlast(state);
    expect(after.destroyed).toBe(false);
    expect(
      state.effects.filter((effect) => effect.kind === 'slam'),
    ).toHaveLength(1);
  });

  it('converts a real GOLD group immediately on every MAX draw, with bounded sustained spread', () => {
    const state = arena();
    state.fever.abilities.gold = 20;
    const ordinary = crate(state, 800);
    const sustained = crate(state, 1000);
    const pulse = crate(state, 1600);
    const far = crate(state, 1900);
    stepCombat(state, FIXED_DT);
    expect(ordinary.golden).toBe(true);
    expect(sustained.golden).not.toBe(true);
    awaken(state, 'gold');
    stepCombat(state, FIXED_DT);
    expect(sustained.golden).toBe(true);
    expect(pulse.golden).toBe(true);
    expect(far.golden).not.toBe(true);
    const nextGroup = crate(state, 1600);
    stepCombat(state, FIXED_DT);
    expect(nextGroup.golden).not.toBe(true);
    state.fever.awakeningSerial.gold++;
    stepCombat(state, FIXED_DT);
    expect(nextGroup.golden).toBe(true);
    expect(state.obstacles).toHaveLength(5);
    expect(state.pickups).toHaveLength(0);
    stepFeverWorld(state, 3.1);
    const after = crate(state, 1000);
    stepCombat(state, FIXED_DT);
    expect(after.golden).not.toBe(true);
  });

  it('applies a fresh GOLD group transformation before a same-tick landing can destroy it', () => {
    const state = arena();
    state.fever.abilities.slam = 20;
    awaken(state, 'gold');
    const landingTarget = crate(state, 500);
    const pulseTarget = crate(state, 1600);
    landingBlast(state);
    expect(landingTarget.destroyed).toBe(true);
    expect(landingTarget.golden).toBe(true);
    expect(pulseTarget.golden).toBe(true);
    expect(state.fever.goldCharge).toBe(1);
    expect(state.fever.awakeningSeen.gold).toBe(
      state.fever.awakeningSerial.gold,
    );
  });

  it('makes awakened GOLD kills infect farther existing bodies without generating new ones', () => {
    for (const awakened of [false, true]) {
      const state = arena();
      state.fever.abilities.gold = 20;
      if (awakened) {
        awaken(state, 'gold');
        // This group enters after the initial pulse, isolating kill infection.
        state.fever.awakeningSeen.gold = state.fever.awakeningSerial.gold;
      }
      const first = rival(state, 40, 0, 1);
      first.golden = true;
      const next = rival(state, 900, 0, 2);
      const beyond = crate(state, 1200);
      landingBlast(state);
      expect(first.defeated).toBe(true);
      expect(next.golden === true).toBe(awakened);
      expect(beyond.golden).not.toBe(true);
      expect(state.rivals).toHaveLength(2);
      expect(state.obstacles).toHaveLength(1);
      expect(state.fever.chain).toBe(1);
    }
  });

  it('bounds an awakened GOLD plus SLAM clear to one earned chest and no deferred kill flood', () => {
    const state = arena();
    awaken(state, 'gold');
    awaken(state, 'slam');
    for (let index = 0; index < 40; index++) crate(state, 40 + index * 25);
    landingBlast(state);
    expect(state.obstacles.every((body) => body.destroyed && body.golden)).toBe(
      true,
    );
    expect(state.fever.chain).toBe(40);
    expect(state.pickups.filter((pickup) => pickup.earned)).toHaveLength(1);
    expect(state.fever.goldCharge).toBeLessThanOrEqual(2);
    const scrap = state.scrap;
    stepFeverWorld(state, 1);
    landingBlast(state);
    expect(state.scrap).toBe(scrap);
    expect(state.obstacles).toHaveLength(40);
    expect(state.pickups.filter((pickup) => pickup.earned)).toHaveLength(1);
  });

  it('resolves a large bomber chain without recursion, duplicate rewards, or body spawning', () => {
    const state = arena('machine');
    const count = 600;
    for (let index = 0; index < count; index++) {
      const target = rival(state, 200 + index * 150, 0, index === 0 ? 1 : 3);
      target.kind = 'bomber';
    }
    stepCombat(state, FIXED_DT);
    expect(state.defeated).toBe(count);
    expect(state.fever.chain).toBe(count);
    expect(state.scrap).toBe(count * RIVALS.bomber.scrap);
    expect(state.rivals).toHaveLength(count);
    expect(state.pickups).toHaveLength(0);
    expect(state.effects.length).toBeLessThanOrEqual(64);
    expect(Number.isFinite(state.score)).toBe(true);
    const score = state.score;
    stepCombat(state, FIXED_DT);
    expect(state.score).toBe(score);
  });
});
