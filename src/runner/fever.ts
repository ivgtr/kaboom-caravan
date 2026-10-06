import { getSpeed, MAX_BURST_SPEED, START_SPEED } from './pacing';
import type {
  AbilityId,
  FeverEvent,
  FeverReel,
  FeverState,
  RunnerState,
} from './types';

export const JACKPOT_FREEZE = 0.65;
export const JACKPOT_CHANCE = 0.035;
export const MAX_ABILITY_LEVEL = 20;
export const MAX_SCORE = 999_999_999_999;
export const MAX_REEL_QUEUE = 2;
export const REEL_FIRST_REVEAL = 0.65;
export const REEL_REVEAL_INTERVAL = 0.55;
export const REEL_LINGER = 0.7;
export const SLOT_KICK_SPEED = 200;
export const SLOT_BOOST_CAP = 360;
/** Exponential falloff gives dense 0.25s reveals a fresh acceleration edge. */
export const SLOT_BOOST_DECAY = 5.5;
export const AWAKENING_DURATION = 2.8;
export const MAX_AWAKENING_TIME = 5.6;
export const GOLD_CHEST_COOLDOWN = 0.7;
export const ABILITY_LABELS: Record<AbilityId, string> = {
  boost: 'BOOST',
  slam: 'LANDING BOMB',
  gold: 'GOLD INFECTION',
  magnet: 'MAGNET',
};
export function createFever(seed = 1): FeverState {
  let mixed = Math.imul(seed ^ (seed >>> 16), 0x7feb352d);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
  mixed ^= mixed >>> 16;
  return {
    random: mixed >>> 0 || 1,
    clock: 0,
    freeze: 0,
    rushTime: 0,
    hyperTime: 0,
    chain: 0,
    chainTime: 0,
    multiplier: 1,
    goldCharge: 0,
    goldChestCooldown: 0,
    slotBoost: 0,
    slotKickSerial: 0,
    slotKickClock: -100,
    awakening: { boost: 0, slam: 0, gold: 0, magnet: 0 },
    awakeningSerial: { boost: 0, slam: 0, gold: 0, magnet: 0 },
    awakeningSeen: { boost: 0, slam: 0, gold: 0, magnet: 0 },
    abilities: { boost: 0, slam: 0, gold: 0, magnet: 0 },
    reel: null,
    queue: [],
    event: null,
    rewardCue: null,
    queuedJump: false,
    queuedRelease: false,
  };
}
/** A separate deterministic stream from presentation; every result is actually used. */
export function feverRandom(state: RunnerState): number {
  let value = state.fever.random | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.fever.random = value >>> 0;
  return state.fever.random / 4294967296;
}
export function feverEvent(
  state: RunnerState,
  kind: FeverEvent['kind'],
  text: string,
  value = 0,
): void {
  state.fever.event = {
    id: state.nextId++,
    kind,
    text,
    value,
    clock: state.fever.clock,
  };
}
export function updateMultiplier(state: RunnerState): void {
  const f = state.fever;
  const active = Object.values(f.abilities).filter((level) => level > 0).length;
  const speed = Math.max(1, state.speed / START_SPEED);
  const chain = 1 + Math.min(100, f.chain) * 0.24;
  const synergy =
    1 +
    active * 0.3 +
    Math.min(
      40,
      Object.values(f.abilities).reduce((a, b) => a + b, 0),
    ) *
      0.08;
  f.multiplier = Math.min(
    9999,
    speed * chain * synergy * (f.hyperTime > 0 ? 5 : f.rushTime > 0 ? 2.5 : 1),
  );
  state.maxMultiplier = Math.max(state.maxMultiplier, f.multiplier);
}
export function awardScore(
  state: RunnerState,
  base: number,
  part: keyof RunnerState['scoreParts'] = 'loot',
): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  updateMultiplier(state);
  const value = Math.min(
    MAX_SCORE - state.score,
    base * state.fever.multiplier,
  );
  state.score += value;
  state.scoreParts[part] += value;
  return Math.round(value);
}
function startReel(state: RunnerState, reel: FeverReel): void {
  state.fever.reel = reel;
  reel.revealInterval =
    state.fever.queue.length > 0 ? 0.25 : REEL_REVEAL_INTERVAL;
  if (reel.jackpot) {
    state.fever.freeze = JACKPOT_FREEZE;
    feverEvent(state, 'jackpot', 'JACKPOT // FREEZE', reel.rewards.length);
  } else feverEvent(state, 'chest', 'CHEST OPEN', reel.rewards.length);
}
/** Counts and ability identities are rolled once on collection, never rerolled for UI. */
export function openChest(state: RunnerState): void {
  state.chestsOpened++;
  const jackpot = feverRandom(state) < JACKPOT_CHANCE;
  const roll = feverRandom(state);
  const count = jackpot ? 3 : roll < 0.52 ? 1 : roll < 0.88 ? 2 : 3;
  const rewards: FeverReel['rewards'] = [];
  for (let i = 0; i < count; i++) {
    const roll = feverRandom(state);
    const kind: AbilityId =
      roll < 0.4
        ? 'boost'
        : roll < 0.65
          ? 'slam'
          : roll < 0.86
            ? 'gold'
            : 'magnet';
    rewards.push({ kind, count: 1 });
  }
  const reel: FeverReel = {
    id: state.nextId++,
    rewards,
    revealed: 0,
    elapsed: 0,
    revealInterval: REEL_REVEAL_INTERVAL,
    jackpot,
    merged: 1,
  };
  awardScore(state, 100);
  if (!state.fever.reel) startReel(state, reel);
  else if (state.fever.queue.length < MAX_REEL_QUEUE)
    state.fever.queue.push(reel);
  else {
    // Saturated cascades coalesce by ability, keeping at most four reveals.
    // No rewards are discarded, and a backlog never becomes ten modal waits.
    const tail = state.fever.queue[state.fever.queue.length - 1]!;
    const combined = [...tail.rewards, ...rewards];
    tail.rewards = [];
    for (const reward of combined) {
      const existing = tail.rewards.find((entry) => entry.kind === reward.kind);
      if (existing)
        existing.count = Math.min(999, existing.count + reward.count);
      else tail.rewards.push(reward);
    }
    tail.jackpot ||= jackpot;
    tail.merged = Math.min(999, tail.merged + 1);
  }
}
function applyReward(state: RunnerState, kind: AbilityId, count: number): void {
  const f = state.fever;
  const previous = f.abilities[kind];
  f.abilities[kind] = Math.min(MAX_ABILITY_LEVEL, previous + count);
  // One visible stop means one kick, even when a backlog coalesces many rewards.
  // Count slightly strengthens that kick without creating an invisible speed debt.
  f.slotBoost = Math.min(
    SLOT_BOOST_CAP,
    f.slotBoost + SLOT_KICK_SPEED + Math.min(80, 20 * Math.log2(count)),
  );
  f.slotKickSerial++;
  f.slotKickClock = f.clock;
  const overflow = Math.max(0, previous + count - MAX_ABILITY_LEVEL);
  if (overflow > 0) {
    f.awakening[kind] = Math.min(
      MAX_AWAKENING_TIME,
      f.awakening[kind] +
        AWAKENING_DURATION +
        Math.min(1.5, 0.35 * Math.sqrt(overflow)),
    );
    f.awakeningSerial[kind]++;
  }
  // Growth also gives a short collision cushion while the new power comes online.
  state.player.invulnerable = Math.max(state.player.invulnerable, 0.45);
  if (kind === 'magnet') state.magnet = 1;
  const points = awardScore(state, 150 * count);
  feverEvent(
    state,
    'reward',
    overflow > 0
      ? `${ABILITY_LABELS[kind]} AWAKEN!`
      : `${ABILITY_LABELS[kind]} +${Math.min(count, MAX_ABILITY_LEVEL - previous)}`,
    points,
  );
  const previousCue = f.rewardCue;
  f.rewardCue = {
    id: f.event!.id,
    value:
      points +
      (previousCue && f.clock - previousCue.clock <= 0.1
        ? previousCue.value
        : 0),
    clock: f.clock,
    text: f.event!.text,
  };
  state.notice = `${ABILITY_LABELS[kind]} Lv.${f.abilities[kind]}`;
  state.noticeTime = 1;
}
/** UI time alone progresses in FREEZE. Return the part of dt available to the world. */
export function stepFeverUI(state: RunnerState, dt: number): number {
  const f = state.fever;
  f.clock += dt;
  const frozen = Math.min(dt, f.freeze);
  f.freeze = Math.max(0, f.freeze - dt);
  const reel = f.reel;
  if (reel) {
    reel.elapsed += dt;
    const congested = reel.revealInterval < REEL_REVEAL_INTERVAL;
    const firstReveal = reel.jackpot
      ? JACKPOT_FREEZE + 0.16
      : REEL_FIRST_REVEAL;
    const interval = reel.revealInterval;
    while (
      reel.revealed < reel.rewards.length &&
      reel.elapsed + 1e-9 >= firstReveal + reel.revealed * interval
    ) {
      const reward = reel.rewards[reel.revealed++]!;
      applyReward(state, reward.kind, reward.count);
    }
    const duration =
      firstReveal +
      (reel.rewards.length - 1) * interval +
      (congested ? 0.3 : REEL_LINGER);
    if (reel.elapsed >= duration) {
      f.reel = null;
      const next = f.queue.shift();
      if (next) startReel(state, next);
    }
  }
  return f.freeze > 0 && frozen === 0 ? 0 : dt - frozen;
}
export function stepFeverWorld(state: RunnerState, dt: number): void {
  const f = state.fever;
  f.chainTime = Math.max(0, f.chainTime - dt);
  if (f.chainTime === 0) f.chain = 0;
  f.rushTime = Math.max(0, f.rushTime - dt);
  f.hyperTime = Math.max(0, f.hyperTime - dt);
  f.goldChestCooldown = Math.max(0, f.goldChestCooldown - dt);
  f.slotBoost *= Math.exp(-SLOT_BOOST_DECAY * dt);
  if (f.slotBoost < 0.5) f.slotBoost = 0;
  for (const kind of Object.keys(f.awakening) as AbilityId[])
    f.awakening[kind] = Math.max(0, f.awakening[kind] - dt);
  // Bound both acceleration and braking. A reel reward cannot jerk an existing
  // landing arc sideways, and an expired pulse cannot snap speed back down.
  const target = Math.min(
    MAX_BURST_SPEED,
    getSpeed(state.distance, f.abilities.boost) +
      f.slotBoost +
      (f.awakening.boost > 0 ? 110 : 0),
  );
  const acceleration = state.player.grounded ? 780 : 220;
  const braking = state.player.grounded ? 560 : 220;
  state.speed += Math.max(
    -braking * dt,
    Math.min(target - state.speed, acceleration * dt),
  );
  state.peakSpeed = Math.max(state.peakSpeed, state.speed);
  awardScore(state, dt * 24, 'travel');
}
/** Every destroyed real body advances one chain. Gold requires real kills to make a chest. */
export function registerDestruction(
  state: RunnerState,
  x: number,
  y: number,
  golden = false,
): void {
  const f = state.fever;
  f.chain = Math.min(9999, f.chain + 1);
  f.chainTime = 3.8;
  state.bestChain = Math.max(state.bestChain, f.chain);
  if (f.chain >= 12) {
    const entered = f.hyperTime <= 0;
    f.hyperTime = 7;
    f.rushTime = 8;
    if (entered) feverEvent(state, 'hyper', 'HYPER FEVER', f.chain);
  } else if (f.chain >= 5) {
    const entered = f.rushTime <= 0;
    f.rushTime = 6;
    if (entered) feverEvent(state, 'rush', 'RUSH', f.chain);
  } else feverEvent(state, 'chain', `${f.chain} CHAIN`, f.chain);
  awardScore(state, golden ? 240 : 80, 'combat');
  if (golden && f.abilities.gold > 0) {
    const needed = Math.max(2, 5 - Math.floor(f.abilities.gold / 6));
    // Bank at most the next chest: a giant blast never creates a deferred flood.
    f.goldCharge = Math.min(needed, f.goldCharge + 1);
    if (f.goldCharge >= needed && f.goldChestCooldown <= 0) {
      f.goldCharge -= needed;
      if (
        state.pickups.filter((p) => !p.taken && p.kind === 'chest').length < 8
      ) {
        f.goldChestCooldown = GOLD_CHEST_COOLDOWN;
        state.pickups.push({
          id: state.nextId++,
          x: Math.max(state.distance + 65, x),
          y: y + 20,
          kind: 'chest',
          taken: false,
          earned: true,
        });
        feverEvent(state, 'gold', 'GOLD → CHEST', needed);
      }
    }
  }
}
