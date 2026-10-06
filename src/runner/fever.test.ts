import { describe, expect, it } from 'vitest';
import { collectPickup, landingBlast, stepCombat } from './combat';
import {
  AWAKENING_DURATION,
  MAX_AWAKENING_TIME,
  SLOT_BOOST_CAP,
  SLOT_BOOST_DECAY,
  stepFeverWorld,
  awardScore,
  JACKPOT_FREEZE,
  MAX_REEL_QUEUE,
  MAX_SCORE,
  openChest,
  registerDestruction,
  REEL_FIRST_REVEAL,
  stepFeverUI,
  updateMultiplier,
} from './fever';
import { getSpeed, jumpTempo, MAX_BURST_SPEED, MAX_SPEED } from './pacing';
import {
  clearJumpInput,
  createRunner,
  generateTerrain,
  GRAVITY,
  JUMP_VELOCITY,
  pauseRunner,
  releaseJump,
  requestJump,
  resumeRunner,
  startRunner,
  stepRunner,
} from './simulation';
import { FIXED_DT, type RunnerState } from './types';
import { platformsJoin } from './terrain';

function arena(seed = 42): RunnerState {
  const state = createRunner(seed);
  state.platforms = [{ id: 1, x: -1000, width: 1_000_000, top: 0 }];
  state.generatedUntil = 999000;
  state.pickups = [];
  state.rivals = [];
  state.obstacles = [];
  state.effects = [];
  state.shots = [];
  startRunner(state);
  return state;
}
function advance(state: RunnerState, seconds: number) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) stepRunner(state);
}
function chest(state: RunnerState) {
  collectPickup(state, {
    id: state.nextId++,
    kind: 'chest',
    x: state.distance,
    y: 20,
    taken: false,
  });
}
function jackpot(state: RunnerState) {
  state.fever.random = 1; // The actual xorshift roll is below the published 3.5% threshold.
  chest(state);
  expect(state.fever.reel?.jackpot).toBe(true);
}
function crate(state: RunnerState, x: number, top = 0) {
  const body = {
    id: state.nextId++,
    x,
    top,
    width: 34,
    height: 30,
    hp: 2,
    maxHp: 2,
    destroyed: false,
    hit: 0,
    golden: false,
  };
  state.obstacles.push(body);
  return body;
}

describe('real chest reels and a bounded cascade', () => {
  it('rolls reproducible one-to-three rewards with genuine seed variation', () => {
    const sequences: string[] = [];
    for (const seed of [1, 7, 42, 84, 991, 123456]) {
      const a = arena(seed),
        b = arena(seed);
      openChest(a);
      openChest(b);
      expect(a.fever.reel).toEqual(b.fever.reel);
      expect(a.fever.reel!.rewards.length).toBeGreaterThanOrEqual(1);
      expect(a.fever.reel!.rewards.length).toBeLessThanOrEqual(3);
      sequences.push(JSON.stringify(a.fever.reel!.rewards));
    }
    expect(new Set(sequences).size).toBeGreaterThan(2);
  });
  it('applies each actual result only as its corresponding reel reveals', () => {
    const state = arena();
    state.fever.random = 991;
    chest(state);
    expect(state.fever.reel!.jackpot).toBe(false);
    const results = structuredClone(state.fever.reel!.rewards);
    stepFeverUI(state, REEL_FIRST_REVEAL - 0.001);
    expect(
      Object.values(state.fever.abilities).reduce((a, b) => a + b, 0),
    ).toBe(0);
    stepFeverUI(state, 0.001);
    expect(state.fever.reel!.revealed).toBe(1);
    expect(state.fever.abilities[results[0]!.kind]).toBe(1);
    const rewardCue = structuredClone(state.fever.rewardCue);
    expect(rewardCue?.value).toBeGreaterThan(0);
    registerDestruction(state, 0, 0);
    expect(state.fever.event?.kind).toBe('chain');
    expect(state.fever.rewardCue).toEqual(rewardCue);
    stepFeverUI(state, 2);
    for (const kind of ['boost', 'slam', 'gold', 'magnet'] as const)
      expect(state.fever.abilities[kind]).toBe(
        results.filter((r) => r.kind === kind).length,
      );
  });
  it('keeps each reveal visible when a backlog arrives late in an active roll', () => {
    const state = arena();
    jackpot(state);
    const reel = state.fever.reel!;
    stepFeverUI(state, 1.38);
    expect(reel.revealed).toBe(2);
    openChest(state);
    openChest(state);
    const cadence = reel.revealInterval;
    stepFeverUI(state, 0.02);
    expect(state.fever.reel).toBe(reel);
    expect(reel.revealed).toBe(2);
    expect(reel.revealInterval).toBe(cadence);
    stepFeverUI(state, 0.52);
    expect(reel.revealed).toBe(3);
    expect(state.fever.reel).toBe(reel);
    expect(state.fever.event?.kind).toBe('reward');
    stepFeverUI(state, 0.4);
    expect(state.fever.reel).toBe(reel);
  });
  it('keeps loot rolls independent from generation and never changes already-generated roads', () => {
    const a = arena(84),
      b = arena(84);
    // Terrain generation consumes its own stream and nextId, never loot entropy.
    a.random ^= 0x12345678;
    openChest(a);
    openChest(b);
    expect(a.fever.reel?.rewards).toEqual(b.fever.reel?.rewards);
    const x = createRunner(84),
      y = createRunner(84);
    y.fever.abilities.boost = 20;
    y.fever.abilities.gold = 20;
    for (let i = 0; i < 10; i++) openChest(y);
    expect(x.random).toBe(y.random);
    const original = structuredClone(y.platforms);
    generateTerrain(y, 20000);
    const geometry = (s: RunnerState) =>
      s.platforms.map(({ x, width, top, endTop }) => ({
        x,
        width,
        top,
        endTop,
      }));
    expect(geometry(x)).toEqual(
      original.map(({ x, width, top, endTop }) => ({ x, width, top, endTop })),
    );
    expect(y.platforms.slice(0, original.length)).toEqual(original);
  });
  it('merges saturated reward batches without dropping any rolled rewards', () => {
    const state = arena();
    for (let i = 0; i < 30; i++) openChest(state);
    expect(state.chestsOpened).toBe(30);
    expect(state.fever.queue).toHaveLength(MAX_REEL_QUEUE);
    const tail = state.fever.queue.at(-1)!;
    expect(tail.rewards.length).toBeLessThanOrEqual(4);
    expect(tail.merged).toBe(28);
    const rewards = [state.fever.reel!, ...state.fever.queue].flatMap(
      (r) => r.rewards,
    );
    expect(rewards.reduce((sum, r) => sum + r.count, 0)).toBeGreaterThanOrEqual(
      30,
    );
    advance(state, 12);
    expect(state.fever.queue).toHaveLength(0);
    expect(state.fever.reel).toBeNull();
  });
});

describe('synchronized jackpot freeze and input edges', () => {
  it('halts world time, movement, physics and combat for exactly 0.65 seconds', () => {
    const state = arena();
    requestJump(state);
    advance(state, 0.05);
    state.weapon = { id: 'machine', level: 1, cooldown: 1 };
    jackpot(state);
    const before = {
      time: state.time,
      distance: state.distance,
      y: state.player.y,
      vy: state.player.vy,
      cooldown: state.weapon.cooldown,
    };
    advance(state, JACKPOT_FREEZE);
    expect({
      time: state.time,
      distance: state.distance,
      y: state.player.y,
      vy: state.player.vy,
      cooldown: state.weapon.cooldown,
    }).toEqual(before);
    expect(state.fever.freeze).toBeLessThan(1e-9);
    expect(state.fever.clock).toBeCloseTo(0.7);
    stepRunner(state);
    expect(state.distance).toBeGreaterThan(before.distance);
    expect(state.time).toBeCloseTo(before.time + FIXED_DT);
  });
  it('preserves a freeze-time press and release as exactly one short jump', () => {
    const state = arena();
    jackpot(state);
    expect(requestJump(state)).toBe(true);
    expect(requestJump(state)).toBe(false);
    releaseJump(state);
    expect(state.jumps).toBe(0);
    advance(state, 0.7);
    expect(state.jumps).toBe(1);
    expect(state.player.holding).toBe(false);
    expect(state.player.vy).toBeLessThan(300);
  });
  it('defers airborne release until freeze ends without mutating a frozen arc', () => {
    const state = arena();
    requestJump(state);
    jackpot(state);
    const vy = state.player.vy;
    releaseJump(state);
    advance(state, 0.4);
    expect(state.player.vy).toBe(vy);
    advance(state, 0.3);
    expect(state.player.vy).toBeLessThan(300);
    expect(state.jumps).toBe(1);
  });
  it('clears queued input on blur/pause and pauses the reel clock too', () => {
    const state = arena();
    jackpot(state);
    requestJump(state);
    pauseRunner(state);
    const clock = state.fever.clock;
    advance(state, 1);
    expect(state.fever.clock).toBe(clock);
    expect(state.fever.queuedJump).toBe(false);
    resumeRunner(state);
    advance(state, 0.7);
    expect(state.jumps).toBe(0);
    clearJumpInput(state);
    expect(state.fever.queuedRelease).toBe(false);
  });
});

describe('stacked real speed and stable faster jumps', () => {
  it('keeps actual permanent speed growing after all twenty booster levels', () => {
    const state = arena();
    state.fever.abilities.boost = 20;
    state.distance = 60000;
    advance(state, 2);
    expect(state.speed).toBeGreaterThan(1000);
    const before = state.distance;
    advance(state, 1);
    expect(state.distance - before).toBeGreaterThan(1000);
    expect(state.peakSpeed).toBe(state.speed);
  });
  it('captures airborne tempo so a mid-jump reward never snaps the arc', () => {
    const a = arena(),
      b = arena();
    requestJump(a);
    requestJump(b);
    advance(a, 0.1);
    advance(b, 0.1);
    b.fever.abilities.boost = 12;
    advance(a, 0.2);
    advance(b, 0.2);
    expect(b.player.jumpTempo).toBe(1);
    expect(b.player.y).toBeCloseTo(a.player.y, 9);
    expect(b.player.vy).toBeCloseTo(a.player.vy, 9);
  });
  it('shortens next-jump airtime while keeping jump height physical and stable', () => {
    const state = arena();
    state.fever.abilities.boost = 12;
    requestJump(state);
    const tempo = state.player.jumpTempo;
    expect(tempo).toBe(jumpTempo(12));
    expect(state.player.vy ** 2 / (2 * GRAVITY * tempo ** 2)).toBeCloseTo(
      JUMP_VELOCITY ** 2 / (2 * GRAVITY),
    );
    advance(state, 0.45);
    expect(state.player.grounded).toBe(true);
  });
});

describe('destruction, gold and multiplier feedback', () => {
  it('makes the landing bomb damage real nearby bodies without hitting distant heights', () => {
    const state = arena();
    state.fever.abilities.slam = 2;
    const near = crate(state, 250),
      high = crate(state, 50, 500),
      speedReach = crate(state, 400),
      far = crate(state, 900);
    landingBlast(state);
    expect(near.destroyed).toBe(true);
    expect(high.destroyed).toBe(false);
    expect(far.destroyed).toBe(false);
    expect(state.fever.chain).toBe(1);
    expect(state.scoreParts.combat).toBeGreaterThan(0);
    expect(speedReach.destroyed).toBe(false);
    const slowRadius = state.effects.find(
      (effect) => effect.kind === 'slam',
    )!.radius!;
    state.speed = 1650;
    landingBlast(state);
    expect(speedReach.destroyed).toBe(true);
    const fastRadius = state.effects
      .filter((effect) => effect.kind === 'slam')
      .at(-1)!.radius!;
    expect(fastRadius - slowRadius).toBe(140);
    expect(high.destroyed).toBe(false);
    expect(far.destroyed).toBe(false);
  });
  it('turns gold-infected destruction into an earned chest, never recursive bodies', () => {
    const state = arena();
    state.fever.abilities.gold = 1;
    state.fever.abilities.slam = 8;
    for (let i = 0; i < 5; i++) crate(state, 90 + 45 * i);
    stepCombat(state, FIXED_DT);
    expect(state.obstacles.every((o) => o.golden)).toBe(true);
    landingBlast(state);
    expect(
      state.pickups.filter((p) => p.kind === 'chest' && p.earned),
    ).toHaveLength(1);
    const score = state.score;
    landingBlast(state);
    expect(state.score).toBe(score);
    expect(state.obstacles).toHaveLength(5);
  });
  it('multiplies actual speed, destruction chain, ability synergy and RUSH/HYPER', () => {
    const state = arena();
    state.speed = 990;
    state.fever.abilities = { boost: 5, slam: 2, gold: 2, magnet: 1 };
    updateMultiplier(state);
    const base = state.fever.multiplier;
    for (let i = 0; i < 5; i++) registerDestruction(state, 0, 0);
    expect(state.fever.rushTime).toBeGreaterThan(0);
    expect(state.fever.multiplier).toBeGreaterThan(base * 4);
    for (let i = 0; i < 7; i++) registerDestruction(state, 0, 0);
    expect(state.fever.hyperTime).toBeGreaterThan(0);
    expect(state.fever.multiplier).toBeGreaterThan(base * 15);
    expect(state.bestChain).toBe(12);
  });
  it('lets inactivity break the chain and expire the real timed modes', () => {
    const state = arena();
    for (let i = 0; i < 12; i++) registerDestruction(state, 0, 0);
    advance(state, 9);
    expect(state.fever.chain).toBe(0);
    expect(state.fever.hyperTime).toBe(0);
    expect(state.fever.rushTime).toBe(0);
  });
  it('keeps score finite and a faithful category total even at numeric saturation', () => {
    const state = arena();
    awardScore(state, NaN);
    awardScore(state, Infinity);
    expect(state.score).toBe(0);
    awardScore(state, MAX_SCORE, 'combat');
    awardScore(state, MAX_SCORE, 'travel');
    expect(state.score).toBe(MAX_SCORE);
    expect(Object.values(state.scoreParts).reduce((a, b) => a + b, 0)).toBe(
      state.score,
    );
  });
  it('continuously catches a physical body crossed completely at extreme speed', () => {
    const state = arena();
    state.shield = 0;
    state.distance = 300;
    const target = crate(state, 150);
    stepCombat(state, 0.1, 0, 0);
    expect(target.destroyed).toBe(false);
    expect(state.status).toBe('over');
  });
  it('makes boosters ram real targets for points instead of unavoidable contact death', () => {
    const state = arena();
    state.fever.abilities.boost = 6;
    state.speed = getSpeed(0, 6);
    state.shield = 0;
    state.distance = 300;
    const target = crate(state, 150);
    stepCombat(state, 0.1, 0, 0);
    expect(target.destroyed).toBe(true);
    expect(state.status).toBe('running');
    expect(state.scoreParts.combat).toBeGreaterThan(0);
  });
  it('attracts a nearby chest with stacked magnet and never double-collects it', () => {
    const state = arena();
    state.fever.abilities.magnet = 5;
    state.pickups.push({ id: 99, kind: 'chest', x: 270, y: 85, taken: false });
    advance(state, 0.8);
    expect(state.chestsOpened).toBe(1);
    advance(state, 1);
    expect(state.chestsOpened).toBe(1);
  });
  it('bounds a two-minute max-stack cascade without recursive growth or stalled play', () => {
    const state = createRunner(42);
    state.fever.abilities = { boost: 20, slam: 20, gold: 20, magnet: 20 };
    startRunner(state);
    for (let tick = 0; tick < 120 * 120 && state.status === 'running'; tick++) {
      if (state.player.grounded && state.fever.freeze === 0) {
        releaseJump(state);
        let index = state.platforms.findIndex(
          (p) => state.distance >= p.x && state.distance <= p.x + p.width,
        );
        if (index >= 0) {
          while (
            state.platforms[index + 1] &&
            platformsJoin(state.platforms[index]!, state.platforms[index + 1]!)
          )
            index++;
          const road = state.platforms[index]!;
          if (road.x + road.width - state.distance <= state.speed * 0.09)
            requestJump(state);
        }
      }
      stepRunner(state);
      expect(state.fever.queue.length).toBeLessThanOrEqual(MAX_REEL_QUEUE);
      expect(state.effects.length).toBeLessThanOrEqual(64);
      expect(state.pickups.length).toBeLessThan(140);
      expect(state.obstacles.length + state.rivals.length).toBeLessThan(100);
    }
    expect(state.status, JSON.stringify(state.failure)).toBe('running');
    expect(state.distance).toBeGreaterThan(120000);
    expect(state.chestsOpened).toBeGreaterThan(70);
    expect(Number.isFinite(state.score)).toBe(true);
  });
});

describe('every reel stop kicks, including bounded MAX awakenings', () => {
  function reveal(
    state: RunnerState,
    kind: 'boost' | 'slam' | 'gold' | 'magnet',
    count = 1,
  ) {
    state.fever.reel = {
      id: state.nextId++,
      rewards: [{ kind, count }],
      revealed: 0,
      elapsed: 0,
      revealInterval: 0.55,
      jackpot: false,
      merged: 1,
    };
    stepFeverUI(state, REEL_FIRST_REVEAL);
  }
  it('three visible slots produce three physical pulses and no invisible queue debt', () => {
    const state = arena();
    state.fever.reel = {
      id: 99,
      rewards: [
        { kind: 'slam', count: 1 },
        { kind: 'gold', count: 1 },
        { kind: 'magnet', count: 1 },
      ],
      revealed: 0,
      elapsed: 0,
      revealInterval: 0.55,
      jackpot: false,
      merged: 1,
    };
    advance(state, REEL_FIRST_REVEAL);
    for (let stop = 1; stop <= 3; stop++) {
      expect(state.fever.slotKickSerial).toBe(stop);
      expect(state.fever.slotBoost).toBeGreaterThan(180);
      const before = state.speed;
      advance(state, 0.15);
      expect(state.speed).toBeGreaterThan(before + 35);
      expect(state.fever.slotBoost).toBeLessThanOrEqual(SLOT_BOOST_CAP);
      if (stop < 3) advance(state, 0.4);
    }
    advance(state, 4);
    expect(state.fever.slotBoost).toBe(0);
    expect(state.speed).toBeLessThan(getSpeed(state.distance) + 1);
  });
  it('crossing MAX, duplicate MAX and saturated merged counts all awaken without runaway timers', () => {
    const state = arena();
    state.fever.abilities.slam = 19;
    reveal(state, 'slam', 3);
    expect(state.fever.abilities.slam).toBe(20);
    expect(state.fever.awakening.slam).toBeGreaterThan(AWAKENING_DURATION);
    expect(state.fever.awakeningSerial.slam).toBe(1);
    const before = state.fever.awakening.slam;
    stepFeverWorld(state, 1);
    reveal(state, 'slam', 999);
    expect(state.fever.awakening.slam).toBeGreaterThan(before);
    expect(state.fever.awakening.slam).toBe(MAX_AWAKENING_TIME);
    expect(state.fever.awakeningSerial.slam).toBe(2);
    expect(state.fever.slotBoost).toBeLessThanOrEqual(SLOT_BOOST_CAP);
    stepFeverWorld(state, MAX_AWAKENING_TIME);
    expect(state.fever.awakening.slam).toBe(0);
    expect(state.fever.slotBoost).toBe(0);
  });
  it('can exceed permanent speed at MAX while keeping midair acceleration and braking smooth', () => {
    const state = arena();
    state.distance = 150000;
    state.fever.abilities.boost = 20;
    state.speed = getSpeed(state.distance, 20);
    reveal(state, 'boost');
    stepFeverWorld(state, 0.2);
    expect(state.speed).toBeGreaterThan(MAX_SPEED);
    expect(state.speed).toBeLessThanOrEqual(MAX_BURST_SPEED);
    state.player.grounded = false;
    const before = state.speed;
    state.fever.slotBoost = SLOT_BOOST_CAP;
    stepFeverWorld(state, FIXED_DT);
    expect(Math.abs(state.speed - before)).toBeLessThanOrEqual(
      220 * FIXED_DT + 1e-8,
    );
    state.fever.slotBoost = 0;
    state.fever.awakening.boost = 0;
    const fast = state.speed;
    stepFeverWorld(state, FIXED_DT);
    expect(fast - state.speed).toBeLessThanOrEqual(220 * FIXED_DT + 1e-8);
    expect(Math.exp(-SLOT_BOOST_DECAY * 0.25)).toBeLessThan(0.26);
  });
  it('preserves bounded boost and awakening timers through FREEZE and pause', () => {
    const state = arena();
    state.fever.abilities.gold = 20;
    reveal(state, 'gold');
    const awake = state.fever.awakening.gold;
    const boost = state.fever.slotBoost;
    state.fever.freeze = 0.5;
    advance(state, 0.4);
    expect(state.fever.awakening.gold).toBe(awake);
    expect(state.fever.slotBoost).toBe(boost);
    pauseRunner(state);
    advance(state, 1);
    expect(state.fever.awakening.gold).toBe(awake);
    resumeRunner(state);
    advance(state, 1);
    expect(state.fever.awakening.gold).toBeLessThan(awake);
  });
  it('caps simultaneous golden destruction at one chest and banks at most one next chest', () => {
    const state = arena();
    state.fever.abilities.gold = 20;
    for (let i = 0; i < 100; i++) registerDestruction(state, i * 4, 20, true);
    expect(state.pickups.filter((p) => p.kind === 'chest')).toHaveLength(1);
    expect(state.fever.goldCharge).toBe(2);
    stepFeverWorld(state, 0.7);
    registerDestruction(state, 450, 20, true);
    expect(state.pickups.filter((p) => p.kind === 'chest')).toHaveLength(2);
  });
});
