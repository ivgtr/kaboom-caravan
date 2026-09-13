import { describe, expect, it } from 'vitest';
import {
  ARMY_LIMIT,
  BASE_HP,
  ENEMY_LIMIT,
  PROFILES,
  RELICS,
  STEP,
  type Kind,
  type Relic,
  type Side,
  type Troop,
} from './definitions';
import {
  armySize,
  cannonRate,
  chooseRelic,
  createSiegeRun,
  deployBlock,
  income,
  investmentCost,
  stepSiege,
  troopProfile,
  wallet,
  type SiegeCommand,
  type SiegeState,
  type Unit,
} from './simulation';

const start = (relic: Relic = 'swarm', seed = 42) =>
  chooseRelic(createSiegeRun(seed), relic);
function unit(
  kind: Kind,
  side: Side,
  x: number,
  overrides: Partial<Unit> = {},
): Unit {
  const p = PROFILES[kind];
  return {
    ...p,
    id: side === 'ally' ? 500 : 501,
    kind,
    side,
    x,
    maxHp: p.hp,
    cooldown: 0,
    windup: 0,
    aimX: x,
    aimBase: false,
    stagger: 0,
    flash: 0,
    ...overrides,
  };
}
function advance(
  s: SiegeState,
  seconds: number,
  commands: readonly SiegeCommand[] = [],
): SiegeState {
  for (let i = 0; i < Math.round(seconds / STEP); i++)
    s = stepSiege(s, commands);
  return s;
}
function empty(relic: Relic = 'swarm'): SiegeState {
  return { ...start(relic), nextWave: [], waveAt: 1e9 };
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

describe('rogue siege: money buys armies, not shots', () => {
  it('starts with three genuinely different doctrines and rejects unoffered or duplicate choices', () => {
    const s = createSiegeRun(42);
    expect(s.choices).toEqual(['swarm', 'siege', 'titan']);
    expect(chooseRelic(s, 'volatile')).toBe(s);
    const picked = chooseRelic(s, 'swarm');
    expect(picked.phase).toBe('combat');
    expect(chooseRelic(picked, 'swarm')).toBe(picked);
    expect(s.relics).toEqual([]);
  });
  it.each([0, NaN, Infinity, -4294967296])(
    'normalizes unsafe/zero seed %s',
    (seed) => {
      expect(createSiegeRun(seed).rng).toBe(1);
    },
  );
  it('deploys a batch once, atomically consumes cash and cooldown, and ignores repeated commands', () => {
    const s = start();
    const command: SiegeCommand = { type: 'deploy', troop: 'wall' };
    const next = stepSiege(s, [command, command, command]);
    expect(armySize(next)).toBe(3);
    expect(next.gold).toBeCloseTo(
      160 + income(s) * STEP - troopProfile(s, 'wall').cost,
    );
    expect(next.cooldowns.wall).toBeGreaterThan(1);
    expect(next.stats.deployed).toBe(3);
  });
  it('cannot overspend, bypass a cooldown or partially deploy a batch at the army cap', () => {
    let s = empty();
    s.gold = 0;
    expect(armySize(stepSiege(s, [{ type: 'deploy', troop: 'titan' }]))).toBe(
      0,
    );
    s = empty();
    s.cooldowns.wall = 10;
    expect(deployBlock(s, 'wall')).not.toBeNull();
    s.cooldowns.wall = 0;
    s.units = Array.from({ length: ARMY_LIMIT - 1 }, (_, i) =>
      unit('wall', 'ally', 20, { id: 100 + i }),
    );
    const next = stepSiege(s, [{ type: 'deploy', troop: 'wall' }]);
    expect(armySize(next)).toBe(ARMY_LIMIT - 1);
    expect(next.gold).toBeCloseTo(s.gold + income(s) * STEP);
  });
  it('lets an empty wallet recover without spending hull HP', () => {
    const s = empty();
    s.gold = 0;
    const next = advance(s, 10);
    expect(next.gold).toBeCloseTo(140);
    expect(next.baseHp).toBe(BASE_HP);
  });
  it('investment sacrifices deployment money for income and capacity, capped at level five', () => {
    const s = empty();
    const next = stepSiege(s, [{ type: 'invest' }]);
    expect(next.gold).toBeCloseTo(160 + 14 * STEP - 90);
    expect(income(next)).toBe(21);
    expect(wallet(next)).toBe(490);
    expect(investmentCost(next)).toBe(165);
    next.economy = 4;
    next.gold = wallet(next);
    expect(stepSiege(next, [{ type: 'invest' }]).economy).toBe(4);
    expect(advance(next, 10).gold).toBe(wallet(next));
  });
  it('computes all relic tradeoffs without mutating shared profiles', () => {
    const s = empty();
    expect(troopProfile(s, 'wall').batch).toBe(3);
    expect(troopProfile(s, 'wall').hp).toBeLessThan(PROFILES.wall.hp);
    s.relics = ['siege'];
    expect(troopProfile(s, 'mortar').damage).toBe(PROFILES.mortar.damage * 2.5);
    expect(troopProfile(s, 'mortar').interval).toBe(
      PROFILES.mortar.interval * 1.8,
    );
    s.relics = ['titan'];
    expect(troopProfile(s, 'titan').hp).toBe(1008);
    expect(troopProfile(s, 'titan').cost).toBe(225);
    expect(troopProfile(s, 'buggy').hp).toBe(63);
    s.relics = ['glass', 'drums', 'volatile'];
    expect(troopProfile(s, 'buggy').hp).toBeLessThan(30);
    expect(troopProfile(s, 'buggy').splash).toBe(5);
    s.relics = ['salvage', 'reactor'];
    expect(income(s)).toBeCloseTo(14 * 0.6 * 0.8);
    expect(cannonRate(s)).toBeCloseTo(8.8);
    expect(PROFILES.wall.batch).toBe(1);
  });
  it('a mortar cannot fire through its close-range blind spot', () => {
    const s = empty('siege');
    s.units = [
      unit('mortar', 'ally', 40, { ...troopProfile(s, 'mortar') }),
      unit('brute', 'enemy', 48, { cooldown: 20, speed: 0 }),
    ];
    const next = advance(s, 2);
    expect(next.units.find((u) => u.side === 'enemy')?.hp).toBe(
      PROFILES.brute.hp,
    );
    expect(next.units.find((u) => u.side === 'ally')?.windup).toBe(0);
  });
  it('a protected mortar can hit several targets at the locked impact point', () => {
    const s = empty('siege');
    s.units = [
      unit('mortar', 'ally', 35, { windup: STEP, aimX: 62 }),
      unit('grunt', 'enemy', 62, { hp: 40, speed: 0 }),
      unit('runner', 'enemy', 65, { id: 502, hp: 40, speed: 0 }),
    ];
    const next = stepSiege(s);
    expect(next.stats.kills).toBe(2);
    expect(next.stats.maxBurst).toBe(2);
  });
  it('salvage credits a kill only once and volatile deaths can cause bounded multi-kills', () => {
    const s = empty();
    s.relics = ['volatile', 'salvage'];
    s.gold = 0;
    s.units = [
      unit('wall', 'ally', 50, { hp: 0 }),
      unit('grunt', 'enemy', 51, { hp: 40, speed: 0 }),
      unit('runner', 'enemy', 52, { id: 502, hp: 40, speed: 0 }),
    ];
    const next = stepSiege(s);
    expect(next.units).toHaveLength(0);
    expect(next.stats.kills).toBe(2);
    expect(next.gold).toBeCloseTo(
      income(s) * STEP + (PROFILES.grunt.cost + PROFILES.runner.cost) * 2.5,
    );
    expect(stepSiege(next).stats.kills).toBe(2);
  });
  it('nearby allies accelerate parade attacks but still pay the HP tradeoff', () => {
    const s = empty();
    s.relics = ['drums'];
    s.units = [
      unit('buggy', 'ally', 40, { windup: STEP, aimX: 50 }),
      unit('wall', 'ally', 39, { id: 503 }),
      unit('brute', 'enemy', 50, { cooldown: 99, speed: 0 }),
    ];
    const next = stepSiege(s);
    expect(next.units[0]!.cooldown).toBeCloseTo(PROFILES.buggy.interval / 1.12);
    expect(troopProfile(s, 'wall').hp).toBe(104);
  });
  it('one-way rocket walls damage themselves rather than becoming free DPS', () => {
    const s = empty();
    s.relics = ['ram'];
    s.units = [
      unit('wall', 'ally', 60, { windup: STEP, aimX: 64 }),
      unit('brute', 'enemy', 64, { cooldown: 99 }),
    ];
    expect(stepSiege(s).units[0]!.hp).toBe(PROFILES.wall.hp - 25);
  });
  it('cannon is deliberate, interrupts telegraphs, pushes but does not damage the fort', () => {
    const s = empty();
    s.units = [unit('commander', 'enemy', 40, { windup: 0.5, aimX: 20 })];
    const next = stepSiege(s, [{ type: 'cannon' }, { type: 'cannon' }]);
    expect(next.cannon).toBe(0);
    expect(next.stats.cannons).toBe(1);
    expect(next.units[0]!.windup).toBe(0);
    expect(next.units[0]!.x).toBeGreaterThan(40);
    expect(next.units[0]!.hp).toBe(PROFILES.commander.hp - 75);
    expect(next.fortHp).toBe(s.fortHp);
  });
  it('does not waste cannon charge on an empty battlefield or permit early firing', () => {
    const s = empty();
    expect(stepSiege(s, [{ type: 'cannon' }]).cannon).toBe(100);
    s.cannon = 50;
    s.units = [unit('grunt', 'enemy', 80)];
    expect(stepSiege(s, [{ type: 'cannon' }]).stats.cannons).toBe(0);
  });
  it('shows a three-second counterattack warning and spawns the commander only once', () => {
    const s = empty();
    s.fortHp = s.fortMaxHp / 2;
    let next = stepSiege(s);
    expect(next.counterattack).toBe('warning');
    next = advance(next, 2.9);
    expect(next.units).toHaveLength(0);
    next = advance(next, 0.1);
    expect(next.counterattack).toBe('deployed');
    expect(next.units.filter((u) => u.kind === 'commander')).toHaveLength(1);
    next = advance(next, 4);
    expect(next.units.filter((u) => u.kind === 'commander')).toHaveLength(1);
  });
  it('reserves an enemy slot for the promised commander without deleting an existing enemy', () => {
    const s = empty();
    s.fortHp = 250;
    s.nextWave = Array(40).fill('brute');
    s.waveAt = 1;
    let next = stepSiege(s);
    expect(next.units).toHaveLength(ENEMY_LIMIT - 1);
    const ids = next.units.map((u) => u.id);
    next = advance(next, 3);
    expect(next.units).toHaveLength(ENEMY_LIMIT);
    expect(ids.every((id) => next.units.some((u) => u.id === id))).toBe(true);
    expect(next.units.some((u) => u.kind === 'commander')).toBe(true);
  });
  it('emptying the lane does not win, but destroying the fort wins with enemies still alive', () => {
    const s = empty();
    expect(stepSiege(s).phase).toBe('combat');
    s.fortHp = 0;
    s.units = [unit('commander', 'enemy', 50)];
    const next = stepSiege(s);
    expect(next.phase).toBe('draft');
    expect(next.stage).toBe(1);
    expect(next.units).toHaveLength(1);
    expect(next.choices).toHaveLength(3);
    expect(new Set(next.choices).size).toBe(3);
    expect(next.choices).not.toContain('swarm');
  });
  it('hull destruction takes priority over mutual fort destruction', () => {
    const s = empty();
    s.fortHp = 0;
    s.baseHp = 0;
    const next = stepSiege(s);
    expect(next.phase).toBe('lost');
    expect(next.stage).toBe(0);
  });
  it('finishes the sixth fort instead of offering a seventh battle', () => {
    const s = empty();
    s.stage = 5;
    s.fortHp = 0;
    expect(stepSiege(s).phase).toBe('won');
  });
  it('carries the run build, seed, damage and statistics, not the winning army or economy', () => {
    const s = empty();
    s.baseHp = 211;
    s.fortHp = 0;
    s.economy = 4;
    s.gold = 777;
    s.stats.kills = 7;
    s.units = [unit('wall', 'ally', 80)];
    const draft = stepSiege(s);
    const next = chooseRelic(draft, draft.choices[0]!);
    expect(next.baseHp).toBe(311);
    expect(next.relics).toHaveLength(2);
    expect(next.gold).toBe(160);
    expect(next.economy).toBe(0);
    expect(next.units).toHaveLength(0);
    expect(next.stats.kills).toBe(7);
    expect(next.seed).toBe(s.seed);
    expect(next.battleTick).toBe(0);
    expect(next.cannon).toBe(100);
  });
  it.each(['draft', 'won', 'lost'] as const)(
    'freezes every resource and command while %s',
    (phase) => {
      const s = { ...start(), phase };
      expect(stepSiege(s, [{ type: 'deploy', troop: 'wall' }])).toBe(s);
    },
  );
  it('does not mutate deeply frozen input state, commands, or shared definitions', () => {
    const s = freeze(start());
    const commands = freeze([{ type: 'deploy', troop: 'wall' }] as const);
    expect(() => stepSiege(s, commands)).not.toThrow();
    expect(s.units).toHaveLength(0);
    expect(s.gold).toBe(160);
  });
  it('uses simulation time for escalating reinforcement pressure, bounded actors and effects', () => {
    let s = empty();
    s.nextWave = ['brute'];
    s.waveAt = 1;
    s.battleTick = 2699;
    s = stepSiege(s);
    expect(s.notice).toContain('長期戦');
    expect(s.nextWave.length).toBeGreaterThan(0);
    for (let i = 0; i < 2000 && s.phase === 'combat'; i++) {
      s = stepSiege(s, [{ type: 'deploy', troop: 'wall' }, { type: 'cannon' }]);
      expect(s.effects.length).toBeLessThanOrEqual(40);
      expect(armySize(s)).toBeLessThanOrEqual(ARMY_LIMIT);
      expect(
        s.units.filter((u) => u.side === 'enemy').length,
      ).toBeLessThanOrEqual(ENEMY_LIMIT);
    }
  });
});
export function bot(s: SiegeState): SiegeCommand[] {
  const cmds: SiegeCommand[] = [];
  const allies = s.units.filter((u) => u.side === 'ally');
  const enemies = s.units.filter((u) => u.side === 'enemy');
  const pressure = enemies.some((u) => u.x < 35);
  if (
    s.cannon >= 100 &&
    (enemies.some((u) => u.kind === 'commander' && u.windup > 0) ||
      enemies.length >= 5 ||
      pressure)
  )
    cmds.push({ type: 'cannon' });
  const counts = (k: Troop) => allies.filter((u) => u.kind === k).length;
  if (
    s.economy < 2 &&
    s.gold >= investmentCost(s) &&
    !pressure &&
    (allies.length >= 3 || s.battleTick < 60)
  )
    return [...cmds, { type: 'invest' }];
  const isTitan = s.relics.includes('titan');
  const target: Troop[] = [];
  if (
    counts('wall') < (isTitan ? 1 : 3) &&
    (enemies.some((u) => u.x < 67) || allies.length === 0)
  )
    target.push('wall');
  if (isTitan && counts('titan') < 2) target.push('titan');
  if (counts('mortar') < (s.relics.includes('siege') ? 3 : 2))
    target.push('mortar');
  if (counts('buggy') < 2) target.push('buggy');
  target.push('titan', 'wall', 'mortar', 'buggy');
  // Wait for the desired expensive unit, rather than wasting its budget on cheap spam.
  const choice = target.find((t) => s.cooldowns[t] === 0);
  if (choice && !deployBlock(s, choice))
    cmds.push({ type: 'deploy', troop: choice });
  return cmds;
}
function run(
  seed: number,
  doctrine: Relic,
  policy:
    | 'mixed'
    | 'idle'
    | 'wall'
    | 'buggy'
    | 'mortar'
    | 'titan'
    | 'all'
    | 'invest' = 'mixed',
) {
  let s = start(doctrine, seed);
  for (
    let i = 0;
    i < 30 * 900 && s.phase !== 'lost' && s.phase !== 'won';
    i++
  ) {
    if (s.phase === 'draft')
      s = chooseRelic(
        s,
        s.choices.find((r) =>
          ['volatile', 'drums', 'siege', 'titan', 'swarm', 'salvage'].includes(
            r,
          ),
        ) ?? s.choices[0]!,
      );
    let commands: SiegeCommand[] = [];
    if (s.tick % 6 === 0) {
      if (policy === 'mixed') commands = bot(s);
      else if (policy === 'all')
        commands = (['wall', 'buggy', 'mortar', 'titan'] as Troop[]).map(
          (troop) => ({ type: 'deploy', troop }),
        );
      else if (policy === 'invest') commands = [{ type: 'invest' }];
      else if (policy !== 'idle')
        commands = [{ type: 'deploy', troop: policy }];
    }
    s = stepSiege(s, commands);
  }
  return s;
}
describe('full run contracts, not evidence of subjective fun', () => {
  it.each(['swarm', 'siege', 'titan'] as Relic[])(
    '%s has a legitimate six-fort route for three seeds; replay is deterministic',
    (doctrine) => {
      for (const seed of [1, 42, 2026]) {
        const first = run(seed, doctrine);
        const replay = run(seed, doctrine);
        expect(first.phase).toBe('won');
        expect(first.stage).toBe(5);
        expect(first.relics).toHaveLength(6);
        expect(first).toEqual(replay);
        expect(first.stats.deployed).toBeGreaterThan(30);
        expect(first.stats.cannons).toBeGreaterThan(0);
      }
    },
  );
  it.each([
    'idle',
    'wall',
    'buggy',
    'mortar',
    'titan',
    'all',
    'invest',
  ] as const)(
    '%s spam is not a universal policy across three seeds and doctrines',
    (policy) => {
      const outcomes = (['swarm', 'siege', 'titan'] as Relic[]).flatMap(
        (doctrine) =>
          [1, 42, 2026].map((seed) => run(seed, doctrine, policy).phase),
      );
      expect(outcomes).toContain('lost');
    },
  );
  it('all nine relics point to original art paths', () => {
    expect(Object.keys(RELICS)).toHaveLength(9);
    for (const relic of Object.values(RELICS))
      expect(relic.art).toMatch(/^assets\//);
  });
});
