import {
  ALLY_BASE_X,
  ARMY_LIMIT,
  BASE_HP,
  ENEMY_BASE_X,
  ENEMY_LIMIT,
  PROFILES,
  RELICS,
  STAGES,
  STEP,
  TROOPS,
  type Kind,
  type Profile,
  type Relic,
  type Side,
  type Troop,
} from './definitions';

export interface Unit extends Profile {
  id: number;
  kind: Kind;
  side: Side;
  x: number;
  maxHp: number;
  cooldown: number;
  windup: number;
  aimX: number;
  aimBase: boolean;
  stagger: number;
  flash: number;
}
export interface Effect {
  id: number;
  x: number;
  type: 'hit' | 'blast' | 'cannon' | 'deploy';
  until: number;
}
export interface SiegeState {
  seed: number;
  rng: number;
  phase: 'draft' | 'combat' | 'won' | 'lost';
  stage: number;
  tick: number;
  battleTick: number;
  baseHp: number;
  fortHp: number;
  fortMaxHp: number;
  gold: number;
  economy: number;
  cannon: number;
  cooldowns: Record<Troop, number>;
  units: Unit[];
  effects: Effect[];
  nextId: number;
  relics: Relic[];
  choices: Relic[];
  wave: number;
  nextWave: Kind[];
  waveAt: number;
  counterattack: 'dormant' | 'warning' | 'deployed';
  counterattackAt: number;
  notice: string;
  noticeUntil: number;
  stats: {
    deployed: number;
    kills: number;
    peakArmy: number;
    maxBurst: number;
    cannons: number;
    earned: number;
  };
}
export type SiegeCommand =
  { type: 'deploy'; troop: Troop } | { type: 'invest' } | { type: 'cannon' };

const seconds = (value: number) => Math.round(value / STEP);
const clone = (s: SiegeState): SiegeState => ({
  ...s,
  units: s.units.map((u) => ({ ...u })),
  effects: [...s.effects],
  cooldowns: { ...s.cooldowns },
  stats: { ...s.stats },
  relics: [...s.relics],
  choices: [...s.choices],
  nextWave: [...s.nextWave],
});
const has = (s: SiegeState, relic: Relic) => s.relics.includes(relic);
export const wallet = (s: SiegeState) => 320 + s.economy * 170;
export const income = (s: SiegeState) =>
  (14 + s.economy * 7) *
  (has(s, 'salvage') ? 0.6 : 1) *
  (has(s, 'reactor') ? 0.8 : 1);
export const investmentCost = (s: SiegeState) => 90 + s.economy * 75;
export const armySize = (s: SiegeState) =>
  s.units.filter((u) => u.side === 'ally' && u.hp > 0).length;
export const cannonRate = (s: SiegeState) => 4 * (has(s, 'reactor') ? 2.2 : 1);

function random(s: SiegeState): number {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
function announce(s: SiegeState, message: string, duration = 3): void {
  s.notice = message;
  s.noticeUntil = s.tick + seconds(duration);
}
function effect(s: SiegeState, x: number, type: Effect['type']): void {
  s.effects.push({
    id: s.nextId++,
    x,
    type,
    until: s.tick + seconds(type === 'cannon' ? 0.55 : 0.35),
  });
  if (s.effects.length > 40) s.effects.shift();
}
function credit(s: SiegeState, amount: number): void {
  s.gold = Math.min(wallet(s), s.gold + amount);
  s.stats.earned += amount;
}
export function troopProfile(s: SiegeState, kind: Troop): Profile {
  const p = { ...PROFILES[kind] };
  if (has(s, 'swarm') && kind === 'wall') {
    p.batch = 3;
    p.hp *= 0.55;
    p.cost *= 1.2;
    p.recharge *= 1.4;
  }
  if (has(s, 'siege') && kind === 'mortar') {
    p.damage *= 2.5;
    p.splash *= 1.6;
    p.range += 10;
    p.interval *= 1.8;
  }
  if (has(s, 'titan')) {
    if (kind === 'titan') {
      p.hp *= 1.8;
      p.damage *= 1.6;
      p.cost *= 0.75;
    } else p.hp *= 0.7;
  }
  if (has(s, 'volatile')) p.hp *= 0.8;
  if (has(s, 'drums')) p.hp *= 0.8;
  if (has(s, 'glass') && kind === 'buggy') {
    p.damage *= 2;
    p.splash = 5;
    p.hp *= 0.45;
  }
  if (has(s, 'ram') && kind === 'wall') p.damage *= 6;
  p.cost = Math.ceil(p.cost);
  p.hp = Math.ceil(p.hp);
  return p;
}
export function deployBlock(s: SiegeState, troop: Troop): string | null {
  const p = troopProfile(s, troop);
  if (s.phase !== 'combat') return '戦闘外';
  if (armySize(s) + p.batch > ARMY_LIMIT) return '部隊上限';
  if (s.cooldowns[troop] > 0) return `${s.cooldowns[troop].toFixed(1)}秒`;
  if (s.gold < p.cost) return `あと${Math.ceil(p.cost - s.gold)}`;
  return null;
}
export function createSiegeRun(seed = 1): SiegeState {
  const normalized = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 || 1 : 1;
  return {
    seed: normalized,
    rng: normalized,
    phase: 'draft',
    stage: 0,
    tick: 0,
    battleTick: 0,
    baseHp: BASE_HP,
    fortHp: 500,
    fortMaxHp: 500,
    gold: 160,
    economy: 0,
    cannon: 100,
    cooldowns: { wall: 0, buggy: 0, mortar: 0, titan: 0 },
    units: [],
    effects: [],
    nextId: 1,
    relics: [],
    choices: ['swarm', 'siege', 'titan'],
    wave: 0,
    nextWave: ['grunt', 'runner'],
    waveAt: seconds(5),
    counterattack: 'dormant',
    counterattackAt: 0,
    notice: '',
    noticeUntil: 0,
    stats: {
      deployed: 0,
      kills: 0,
      peakArmy: 0,
      maxBurst: 0,
      cannons: 0,
      earned: 0,
    },
  };
}
export function chooseRelic(state: SiegeState, relic: Relic): SiegeState {
  if (
    state.phase !== 'draft' ||
    !state.choices.includes(relic) ||
    state.relics.includes(relic)
  )
    return state;
  const s = clone(state);
  s.relics.push(relic);
  s.choices = [];
  s.phase = 'combat';
  s.baseHp = Math.min(BASE_HP, s.baseHp + (s.stage > 0 ? 100 : 0));
  s.fortMaxHp = s.stage === STAGES.length - 1 ? 1500 : 500 + s.stage * 170;
  s.fortHp = s.fortMaxHp;
  s.battleTick = 0;
  s.gold = 160;
  s.economy = 0;
  s.cannon = 100;
  s.units = [];
  s.effects = [];
  s.wave = 0;
  s.cooldowns = { wall: 0, buggy: 0, mortar: 0, titan: 0 };
  s.nextWave = makeWave(s);
  s.waveAt = seconds(5);
  s.counterattack = 'dormant';
  s.counterattackAt = 0;
  announce(s, '壁で守る → 火力を貯める → 敵拠点を壊す', 5);
  return s;
}
function spawn(s: SiegeState, kind: Kind, side: Side, offset = 0): void {
  const p =
    side === 'ally' ? troopProfile(s, kind as Troop) : { ...PROFILES[kind] };
  if (side === 'enemy') {
    p.hp *= 1 + s.stage * 0.16;
    p.damage *= 1 + s.stage * 0.1;
  }
  const x = side === 'ally' ? 13 - offset : 87 + offset;
  s.units.push({
    ...p,
    id: s.nextId++,
    kind,
    side,
    x,
    hp: Math.ceil(p.hp),
    maxHp: Math.ceil(p.hp),
    cooldown: 0.3,
    windup: 0,
    aimX: x,
    aimBase: false,
    stagger: 0,
    flash: 0,
    cost: p.cost / p.batch,
  });
  if (side === 'ally') {
    s.stats.deployed++;
    effect(s, x, 'deploy');
  }
}
function makeWave(s: SiegeState): Kind[] {
  const wave: Kind[] = ['grunt', random(s) < 0.5 ? 'runner' : 'grunt'];
  if (s.wave % 3 === 2 || s.stage >= 2)
    wave.push(s.wave % 2 === 0 ? 'spitter' : 'brute');
  if (s.stage >= 3) wave.push('runner');
  if (s.stage === 5 && s.wave % 2 === 1) wave.push('brute');
  return wave;
}
function reinforcements(s: SiegeState, kinds: Kind[]): void {
  const limit =
    kinds.includes('commander') || s.counterattack === 'deployed'
      ? ENEMY_LIMIT
      : ENEMY_LIMIT - 1;
  let available =
    limit - s.units.filter((u) => u.side === 'enemy' && u.hp > 0).length;
  for (const [index, kind] of kinds.entries()) {
    if (available-- <= 0) break;
    spawn(s, kind, 'enemy', (index % 4) * 1.1);
  }
}
function hurt(s: SiegeState, unit: Unit, damage: number, knockback = 0): void {
  if (unit.hp <= 0) return;
  const previous = Math.floor((1 - unit.hp / unit.maxHp) * 3);
  unit.hp -= damage;
  unit.flash = 0.16;
  const crossed =
    Math.floor((1 - Math.max(0, unit.hp) / unit.maxHp) * 3) > previous;
  if (knockback > 0 || crossed) {
    const displacement =
      (knockback || 2.5) *
      (unit.kind === 'commander' || unit.kind === 'titan' ? 0.35 : 1);
    unit.x = Math.max(
      12,
      Math.min(
        89,
        unit.x + (unit.side === 'enemy' ? displacement : -displacement),
      ),
    );
    unit.stagger = knockback ? 0.65 : 0.22;
    unit.windup = 0;
  }
  effect(s, unit.x, 'hit');
}
function handleCommand(s: SiegeState, command: SiegeCommand): void {
  if (command.type === 'deploy') {
    if (deployBlock(s, command.troop)) return;
    const p = troopProfile(s, command.troop);
    s.gold -= p.cost;
    s.cooldowns[command.troop] = p.recharge;
    for (let i = 0; i < p.batch; i++) spawn(s, command.troop, 'ally', i * 0.45);
  } else if (command.type === 'invest') {
    if (s.economy >= 4 || s.gold < investmentCost(s)) return;
    s.gold -= investmentCost(s);
    s.economy++;
    announce(s, `補給Lv.${s.economy + 1} — 増援に使えた資金を未来へ投資`, 2);
  } else if (
    s.cannon >= 100 &&
    s.units.some((u) => u.side === 'enemy' && u.hp > 0)
  ) {
    s.cannon = 0;
    s.stats.cannons++;
    for (const enemy of s.units.filter((u) => u.side === 'enemy'))
      hurt(s, enemy, 75 + s.stage * 9, 10);
    effect(s, 50, 'cannon');
    announce(s, '母艦砲！ 敵の溜め攻撃を中断', 2);
  }
}
function collectDead(s: SiegeState): void {
  // Death explosions can kill more units. Each ID is processed once; no recursive spawns.
  const processed = new Set<number>();
  let kills = 0;
  for (;;) {
    const dead = s.units.filter((u) => u.hp <= 0 && !processed.has(u.id));
    if (!dead.length) break;
    for (const u of dead) {
      processed.add(u.id);
      if (u.side === 'enemy') {
        kills++;
        s.stats.kills++;
        credit(s, u.cost * (has(s, 'salvage') ? 2.5 : 1));
      } else if (has(s, 'volatile')) {
        const damage = Math.min(180, u.maxHp * 0.6 + u.cost);
        effect(s, u.x, 'blast');
        for (const enemy of s.units.filter(
          (e) => e.side === 'enemy' && Math.abs(e.x - u.x) <= 12 + e.radius,
        ))
          hurt(s, enemy, damage);
      }
    }
  }
  s.stats.maxBurst = Math.max(s.stats.maxBurst, kills);
  s.units = s.units.filter((u) => u.hp > 0);
}
function finish(s: SiegeState): boolean {
  // Mutual destruction is a loss. Never reward a convoy destroyed on the same tick.
  if (s.baseHp <= 0) {
    s.baseHp = 0;
    s.phase = 'lost';
    return true;
  }
  if (s.fortHp > 0) return false;
  s.fortHp = 0;
  if (s.stage === STAGES.length - 1) s.phase = 'won';
  else {
    s.stage++;
    s.phase = 'draft';
    const pool = (Object.keys(RELICS) as Relic[]).filter(
      (id) => !s.relics.includes(id),
    );
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random(s) * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    s.choices = pool.slice(0, 3);
  }
  return true;
}
/** Pure, fixed 30 Hz simulation. No wall clock, rendering, audio, or ambient RNG. */
export function stepSiege(
  state: SiegeState,
  commands: readonly SiegeCommand[] = [],
): SiegeState {
  if (state.phase !== 'combat') return state;
  const s = clone(state);
  if (finish(s)) return s;
  s.tick++;
  s.battleTick++;
  s.effects = s.effects.filter((e) => e.until > s.tick);
  credit(s, income(s) * STEP);
  s.cannon = Math.min(100, s.cannon + cannonRate(s) * STEP);
  for (const troop of TROOPS)
    s.cooldowns[troop] = Math.max(0, s.cooldowns[troop] - STEP);
  for (const command of commands.slice(0, 12)) handleCommand(s, command);
  collectDead(s);
  if (s.battleTick >= s.waveAt) {
    reinforcements(s, s.nextWave);
    s.wave++;
    s.waveAt += seconds(
      s.battleTick >= seconds(90) ? 4.5 : Math.max(6.5, 11 - s.stage * 0.6),
    );
    s.nextWave = makeWave(s);
  }
  if (s.battleTick === seconds(90))
    announce(s, '長期戦警報 — 敵の増援間隔が短縮！', 5);
  if (s.counterattack === 'warning' && s.battleTick >= s.counterattackAt) {
    reinforcements(s, [
      'commander',
      'runner',
      'runner',
      ...(s.stage >= 3 ? ['spitter' as const] : []),
    ]);
    s.counterattack = 'deployed';
    announce(s, '守備隊長、出陣！ 溜め攻撃は母艦砲で潰せ', 4);
  }
  const damage = new Map<number, number>();
  let allyBaseDamage = 0;
  let fortDamage = 0;
  // Compute all attacks before applying damage: neither side gains an array-order first strike.
  for (const u of s.units) {
    u.flash = Math.max(0, u.flash - STEP);
    u.cooldown = Math.max(0, u.cooldown - STEP);
    if (u.stagger > 0) {
      u.stagger = Math.max(0, u.stagger - STEP);
      continue;
    }
    const opponents = s.units
      .filter((e) => e.side !== u.side && e.hp > 0)
      .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x) || a.id - b.id);
    const baseX = u.side === 'ally' ? ENEMY_BASE_X : ALLY_BASE_X;
    const target = opponents[0];
    const targetBase =
      !target || Math.abs(baseX - u.x) < Math.abs(target.x - u.x);
    const targetX = targetBase ? baseX : target!.x;
    const reach = u.range + u.radius + (targetBase ? 3 : target!.radius);
    if (u.windup > 0) {
      u.windup = Math.max(0, u.windup - STEP);
      if (u.windup > 0) continue;
      if (u.aimBase && Math.abs(baseX - u.x) <= u.range + u.radius + 3) {
        if (u.side === 'ally') fortDamage += u.damage;
        else allyBaseDamage += u.damage;
        effect(s, baseX, 'blast');
      } else {
        const inReach = opponents.filter((e) =>
          u.range >= 20
            ? Math.abs(e.x - u.aimX) <= u.splash + e.radius &&
              Math.abs(e.x - u.x) >= (u.minimumRange ?? 0)
            : Math.abs(e.x - u.x) <= u.range + u.radius + e.radius,
        );
        const victims =
          u.splash > 0
            ? inReach.filter(
                (e) => Math.abs(e.x - u.aimX) <= u.splash + e.radius,
              )
            : inReach.slice(0, 1);
        for (const victim of victims)
          damage.set(victim.id, (damage.get(victim.id) ?? 0) + u.damage);
        if (u.splash > 0) effect(s, u.aimX, 'blast');
      }
      if (u.side === 'ally' && u.kind === 'wall' && has(s, 'ram'))
        damage.set(u.id, (damage.get(u.id) ?? 0) + 25);
      const neighbors =
        has(s, 'drums') && u.side === 'ally'
          ? s.units.filter(
              (a) =>
                a.side === 'ally' && a.id !== u.id && Math.abs(a.x - u.x) < 16,
            ).length
          : 0;
      u.cooldown = u.interval / Math.min(2.5, 1 + neighbors * 0.12);
    } else if (Math.abs(targetX - u.x) <= reach) {
      if (!targetBase && Math.abs(targetX - u.x) < (u.minimumRange ?? 0))
        continue;
      if (u.cooldown <= 0) {
        u.windup = u.kind === 'commander' ? 1.1 : u.range >= 20 ? 0.65 : 0.22;
        u.aimX = targetX;
        u.aimBase = targetBase;
      }
    } else {
      const direction = targetX > u.x ? 1 : -1;
      u.x +=
        direction *
        Math.min(u.speed * STEP, Math.max(0, Math.abs(targetX - u.x) - reach));
      u.x = Math.max(12, Math.min(89, u.x));
    }
  }
  for (const u of s.units) {
    const hit = damage.get(u.id);
    if (hit) hurt(s, u, hit);
  }
  s.baseHp -= allyBaseDamage;
  s.fortHp -= fortDamage;
  collectDead(s);
  s.stats.peakArmy = Math.max(s.stats.peakArmy, armySize(s));
  if (finish(s)) return s;
  if (s.counterattack === 'dormant' && s.fortHp <= s.fortMaxHp / 2) {
    s.counterattack = 'warning';
    s.counterattackAt = s.battleTick + seconds(3);
    announce(s, '敵拠点50%！ 3秒後、守備隊長が反撃', 3);
  }
  return s;
}
