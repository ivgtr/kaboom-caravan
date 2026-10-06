import { describe, expect, it } from 'vitest';
import { buildReplay } from '../../tests/runner-replay';
import { MAX_BURST_SPEED, getSpeed } from './pacing';
import { REEL_FIRST_REVEAL, REEL_REVEAL_INTERVAL } from './fever';
import {
  COURSE_MOTIFS,
  PLAYER_HALF_HITBOX,
  createRunner,
  generateTerrain,
  releaseJump,
  requestJump,
  startRunner,
  stepRunner,
} from './simulation';
import { platformTopAt, platformsJoin } from './terrain';
import { FIXED_DT, type RunnerState } from './types';

function nextSection(state: RunnerState): number {
  generateTerrain(state, state.generatedUntil + 1);
  return state.coursePhrase;
}
function roadEnd(state: RunnerState): number {
  let index = state.platforms.findIndex(
    (road) =>
      state.distance + PLAYER_HALF_HITBOX > road.x &&
      state.distance - PLAYER_HALF_HITBOX < road.x + road.width &&
      Math.abs(platformTopAt(road, state.distance) - state.player.y) < 1,
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
function clearArena(): RunnerState {
  const state = createRunner(42);
  state.platforms = [{ id: 1, x: -500, width: 100000, top: 0 }];
  state.generatedUntil = 99500;
  state.pickups = [];
  state.rivals = [];
  state.obstacles = [];
  startRunner(state);
  return state;
}

describe('weighted authored course sections', () => {
  it('is seeded, repeat-aware and no longer a rigid six-section shuffle', () => {
    const sequences: number[][] = [];
    let repeats = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const a = createRunner(seed),
        b = createRunner(seed);
      const seen: number[] = [];
      for (let i = 0; i < 30; i++) {
        seen.push(nextSection(a));
        expect(nextSection(b)).toBe(seen[i]);
        expect(a.courseBag.slice(-Math.min(4, seen.length))).toEqual(
          seen.slice(-4),
        );
        expect(a.courseBag.length).toBeLessThanOrEqual(4);
        if (i > 0 && seen[i] === seen[i - 1]) repeats++;
      }
      expect(new Set(seen)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
      sequences.push(seen);
    }
    expect(new Set(sequences.map((s) => s.join(','))).size).toBe(24);
    expect(sequences.some((s) => new Set(s.slice(0, 6)).size < 6)).toBe(true);
    expect(repeats).toBeGreaterThan(0);
    expect(repeats / (24 * 29)).toBeLessThan(0.15);
  });

  it('nudges section probabilities toward builds while preserving every route', () => {
    const totals = [Array<number>(8).fill(0), Array<number>(8).fill(0)];
    let differences = 0;
    for (let seed = 1; seed <= 32; seed++) {
      const builds = [createRunner(seed), createRunner(seed)];
      builds[0]!.fever.abilities.slam = 20;
      builds[1]!.fever.abilities.magnet = 20;
      for (const state of builds) {
        state.time = 100;
        state.distance = 80000;
      }
      for (let i = 0; i < 40; i++) {
        const picks = builds.map(nextSection);
        picks.forEach((pick, build) => {
          totals[build]![pick] = totals[build]![pick]! + 1;
        });
        if (picks[0] !== picks[1]) differences++;
      }
    }
    expect(differences).toBeGreaterThan(150);
    for (const total of totals)
      expect(total.every((count) => count > 70)).toBe(true);
    expect(totals[0]![1]! + totals[0]![6]!).toBeGreaterThan(
      totals[1]![1]! + totals[1]![6]!,
    );
    expect(totals[1]![4]! + totals[1]![7]!).toBeGreaterThan(
      totals[0]![4]! + totals[0]![7]!,
    );
  });

  it('unlocks real downhill-blast and jump-treasure mixes and evolves them again', () => {
    for (const trigger of ['time', 'distance'] as const) {
      const state = createRunner(991);
      state[trigger] = trigger === 'time' ? 44.9 : 29999;
      for (let i = 0; i < 20; i++) expect(nextSection(state)).toBeLessThan(6);
      state[trigger] = trigger === 'time' ? 45 : 30000;
      const early: number[] = [];
      for (let i = 0; i < 60; i++) early.push(nextSection(state));
      expect(early).toContain(6);
      expect(early).toContain(7);
    }
    const state = createRunner(42);
    state.time = 95;
    const found = new Set<number>();
    for (let i = 0; i < 80 && found.size < 2; i++) {
      const start = state.generatedUntil;
      const phrase = nextSection(state);
      if (phrase < 6) continue;
      found.add(phrase);
      const roads = state.platforms.filter((p) => p.x > start);
      const rivals = state.rivals.filter((r) => r.x > start);
      const chests = state.pickups.filter(
        (p) => p.x > start && p.kind === 'chest',
      );
      expect(roads.some((p) => p.endTop! - p.top > 60)).toBe(true);
      expect(roads.some((p) => p.top - p.endTop! > 60)).toBe(true);
      expect(rivals.some((r) => r.kind === 'fortress')).toBe(true);
      if (phrase === 6) {
        expect(rivals.filter((r) => r.kind === 'bomber')).toHaveLength(2);
        const bomber = rivals.find((r) => r.kind === 'bomber')!;
        expect(
          state.obstacles.some((o) => Math.abs(o.x - bomber.x) < 100),
        ).toBe(true);
      } else {
        expect(chests).toHaveLength(2);
        for (const chest of chests) {
          const road = roads.find(
            (p) => chest.x >= p.x && chest.x <= p.x + p.width,
          )!;
          expect(chest.y - platformTopAt(road, chest.x)).toBeGreaterThan(130);
        }
      }
    }
    expect(found.size).toBe(2);
    expect(COURSE_MOTIFS).toHaveLength(8);
  });

  it('never edits already generated roads, enemies or treasure after build changes', () => {
    const state = createRunner(84);
    const prefix = structuredClone({
      platforms: state.platforms,
      rivals: state.rivals,
      obstacles: state.obstacles,
      pickups: state.pickups,
    });
    state.fever.abilities = { boost: 20, slam: 20, gold: 20, magnet: 20 };
    state.time = 100;
    state.distance = 80000;
    generateTerrain(state, state.generatedUntil + 5000);
    for (const key of ['platforms', 'rivals', 'obstacles', 'pickups'] as const)
      expect(state[key].slice(0, prefix[key].length)).toEqual(prefix[key]);
  });

  it.each([30, 60, 120])(
    'carries held jumps and continuous landings through late terrain at burst speed and %iHz input',
    (hz) => {
      for (const seed of [1, 7, 42, 991]) {
        const state = createRunner(seed);
        state.fever.abilities.boost = 20;
        state.time = 100;
        state.distance = 150000;
        state.platforms = [{ id: 1, x: 149500, width: 1200, top: 0 }];
        state.generatedUntil = 150700;
        state.speed = MAX_BURST_SPEED;
        generateTerrain(state, 205000);
        state.rivals = [];
        state.obstacles = [];
        state.pickups = [];
        startRunner(state);
        let landings = 0;
        while (state.distance < 200000 && state.status === 'running') {
          // Exercise the worst real speed envelope continuously, rather than
          // resetting the vehicle at each generated gap or hiding the slopes.
          state.fever.slotBoost = 360;
          if (state.player.grounded) {
            releaseJump(state);
            if (roadEnd(state) - state.distance <= state.speed * 0.09)
              requestJump(state);
          }
          const airborne = !state.player.grounded;
          stepRunner(state, 1 / hz);
          if (airborne && state.player.grounded) {
            landings++;
            expect(
              (roadEnd(state) - state.distance) / state.speed,
            ).toBeGreaterThan(0.2);
          }
        }
        expect(
          state.status,
          JSON.stringify({ seed, failure: state.failure }),
        ).toBe('running');
        expect(state.peakSpeed).toBeGreaterThan(1800);
        expect(landings).toBeGreaterThan(20);
        expect(state.speed).toBeGreaterThan(getSpeed(state.distance, 20));
      }
    },
  );

  it.each([7, 42, 84, 991])(
    'plays seed %i through late sections with actual inputs, loot and combat',
    (seed) => {
      // Fresh physical input at each cadence responds to the real route/build.
      // A frame of changed loot timing may legitimately alter future sections;
      // short open-loop cross-refresh fidelity is covered in simulation.test.
      for (const frameMs of [16, 1000 / 60]) {
        const { state, inputs } = buildReplay(seed, 180, true, frameMs);
        expect(
          state.status,
          JSON.stringify({
            seed,
            frameMs,
            time: state.time,
            distance: state.distance,
            failure: state.failure,
          }),
        ).toBe('running');
        expect(state.time).toBeGreaterThan(90);
        expect(state.distance).toBeGreaterThan(60000);
        expect(state.chestsOpened).toBeGreaterThan(20);
        expect(inputs.length).toBeGreaterThan(100);
      }
    },
  );
});

describe('awakened magnet sweeps', () => {
  it('repeats a real bounded impulse on fresh MAX reels while already active', () => {
    const state = clearArena();
    state.fever.abilities.magnet = 20;
    const revealMagnet = () => {
      state.fever.reel = {
        id: state.nextId++,
        rewards: [{ kind: 'magnet', count: 1 }],
        revealed: 0,
        elapsed: REEL_FIRST_REVEAL - FIXED_DT,
        revealInterval: REEL_REVEAL_INTERVAL,
        jackpot: false,
        merged: 1,
      };
      stepRunner(state);
    };
    state.pickups = [
      { id: 1000, kind: 'scrap', x: 1480, y: 250, taken: false },
    ];
    revealMagnet();
    expect(state.fever.awakeningSerial.magnet).toBe(1);
    expect(state.pickups[0]!.x).toBeLessThan(500);
    expect(state.fever.awakening.magnet).toBeGreaterThan(2.8);
    const secondLine = {
      id: 1001,
      kind: 'scrap' as const,
      x: state.distance + 1480,
      y: 250,
      taken: false,
    };
    const outOfRange = {
      id: 1002,
      kind: 'scrap' as const,
      x: state.distance + 1750,
      y: 250,
      taken: false,
    };
    state.pickups.push(secondLine, outOfRange);
    const originalX = secondLine.x;
    stepRunner(state);
    expect(secondLine.x).toBe(originalX); // Ongoing 1250 reach cannot catch it.
    revealMagnet();
    expect(state.fever.awakeningSerial.magnet).toBe(2);
    expect(state.fever.awakeningSeen.magnet).toBe(2);
    expect(secondLine.x - state.distance).toBeLessThan(500);
    expect(outOfRange.x).toBeGreaterThan(state.distance + 1600);
    expect(
      state.effects.filter((effect) => effect.text === 'MAX MAGNET'),
    ).toHaveLength(2);
    for (let i = 0; i < 30; i++) stepRunner(state);
    expect(state.scrap).toBe(2);
    expect(state.pickups.map((pickup) => pickup.id)).toEqual([1002]);
    // After the active period ends, the reveal remains consumed. A fresh line
    // outside normal max-level reach neither moves nor creates a third pulse.
    state.fever.awakening.magnet = FIXED_DT / 2;
    const expiredLine = {
      id: 1003,
      kind: 'scrap' as const,
      x: state.distance + 800,
      y: 180,
      taken: false,
    };
    state.pickups.push(expiredLine);
    const expiredX = expiredLine.x;
    stepRunner(state);
    expect(state.fever.awakening.magnet).toBe(0);
    expect(expiredLine.x).toBe(expiredX);
    expect(state.fever.awakeningSeen.magnet).toBe(2);
    expect(
      state.effects.filter((effect) => effect.text === 'MAX MAGNET'),
    ).toHaveLength(2);
  });

  it('sweeps all real pickups before a collected jackpot freezes the pickup loop', () => {
    const state = clearArena();
    state.fever.abilities.magnet = 20;
    state.fever.awakening.magnet = 3;
    state.fever.awakeningSerial.magnet = 1;
    state.fever.random = 1; // The public chest roll starts a real jackpot freeze.
    const chest = {
      id: 1000,
      kind: 'chest' as const,
      x: 15,
      y: 22,
      taken: false,
    };
    const far = {
      id: 1001,
      kind: 'scrap' as const,
      x: 1450,
      y: 200,
      taken: false,
    };
    state.pickups = [chest, far];
    stepRunner(state);
    expect(state.fever.freeze).toBeGreaterThan(0);
    expect(state.chestsOpened).toBe(1);
    expect(far.x).toBeLessThan(600);
    expect(state.fever.awakeningSeen.magnet).toBe(1);
    const frozenX = far.x;
    stepRunner(state, 0.25);
    expect(far.x).toBe(frozenX);
    while (state.fever.freeze > 1e-9) stepRunner(state);
    stepRunner(state);
    expect(far.x).toBeGreaterThan(350); // Normal pull, not a second 60% impulse.
    expect(state.fever.awakeningSeen.magnet).toBe(1);
    expect(
      state.effects.filter((effect) => effect.text === 'MAX MAGNET'),
    ).toHaveLength(1);
  });

  it('pulls genuine distant aerial scrap and earned chests beyond the normal max radius', () => {
    const normal = clearArena(),
      awakened = clearArena();
    for (const state of [normal, awakened]) {
      state.fever.abilities.magnet = 20;
      state.pickups = [
        { id: 1000, kind: 'scrap', x: 850, y: 180, taken: false },
        {
          id: 1001,
          kind: 'chest',
          x: 1000,
          y: 250,
          taken: false,
          earned: true,
        },
      ];
    }
    awakened.fever.awakening.magnet = 2.8;
    stepRunner(normal);
    stepRunner(awakened);
    expect(normal.pickups.map((p) => p.x)).toEqual([850, 1000]);
    expect(awakened.pickups[0]!.x).toBeLessThan(700);
    expect(awakened.pickups[1]!.x).toBeLessThan(800);
    for (let i = 0; i < 100; i++) stepRunner(awakened);
    expect(awakened.scrap).toBe(1);
    expect(awakened.chestsOpened).toBe(1);
    expect(awakened.pickups.filter((p) => !p.taken)).toHaveLength(0);
  });

  it('expires back to the bounded normal reach without spawning or duplicating pickups', () => {
    const state = clearArena();
    state.fever.abilities.magnet = 20;
    state.fever.awakening.magnet = FIXED_DT / 2;
    state.pickups = [{ id: 1000, kind: 'scrap', x: 750, y: 150, taken: false }];
    stepRunner(state);
    expect(state.fever.awakening.magnet).toBe(0);
    expect(state.pickups).toHaveLength(1);
    expect(state.pickups[0]!.x).toBe(750);
    expect(state.scrap).toBe(0);
  });
});
