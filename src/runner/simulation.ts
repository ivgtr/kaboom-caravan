import { RIVALS } from './definitions';
import { collectPickup, landingBlast, stepCombat } from './combat';
import { awardScore, createFever, stepFeverUI, stepFeverWorld } from './fever';
import { platformTopAt, platformsJoin } from './terrain';
import { getSpeed, jumpTempo } from './pacing';
export { getSpeed } from './pacing';
import {
  FIXED_DT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  type Effect,
  type Pickup,
  type Platform,
  type RivalKind,
  type RunnerState,
  type WeaponId,
} from './types';
export {
  collectPickup,
  MAX_WEAPON_LEVEL,
  MAGNET_DISTANCE,
  RIVAL_WARNING_TIME,
} from './combat';

export const GRAVITY = 2100;
export const JUMP_VELOCITY = 580;
export const RECOVERY_VELOCITY = 440;
export const RELEASE_VELOCITY = 300;
export const COYOTE_TIME = 0.09;
export const JUMP_BUFFER_TIME = 0.1;
export const JUMP_AIRTIME = (2 * JUMP_VELOCITY) / GRAVITY;
export const GENERATION_AHEAD = 3400;
export const PLAYER_HALF_HITBOX = PLAYER_WIDTH / 2;
export const TERRAIN_MIN_HEIGHT = -48;
export const TERRAIN_MAX_HEIGHT = 112;
export const TERRAIN_DEATH_HEIGHT = -230;

/** Descending intersection of a held jump with a relative landing height. */
export function jumpLandingTime(rise: number): number {
  const discriminant = JUMP_VELOCITY ** 2 - 2 * GRAVITY * rise;
  return discriminant < 0
    ? Infinity
    : (JUMP_VELOCITY + Math.sqrt(discriminant)) / GRAVITY;
}
function random(state: RunnerState): number {
  let value = state.random | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.random = value >>> 0;
  return state.random / 4294967296;
}
function id(state: RunnerState): number {
  return state.nextId++;
}
function addEffect(
  state: RunnerState,
  kind: Effect['kind'],
  x: number,
  y: number,
  text?: string,
): void {
  state.effects.push({
    id: id(state),
    kind,
    x,
    y,
    life: 0.6,
    maxLife: 0.6,
    text,
  });
  if (state.effects.length > 48)
    state.effects.splice(0, state.effects.length - 48);
}
function notice(state: RunnerState, text: string): void {
  state.notice = text;
  state.noticeTime = 2.2;
}
function addPlatform(
  state: RunnerState,
  x: number,
  width: number,
  top: number,
  endTop?: number,
): Platform {
  const platform: Platform = {
    id: id(state),
    x,
    width,
    top,
    ...(endTop === undefined ? {} : { endTop }),
  };
  state.platforms.push(platform);
  return platform;
}
function addPickup(
  state: RunnerState,
  x: number,
  y: number,
  kind: Pickup['kind'],
  weapon?: WeaponId,
): void {
  state.pickups.push({ id: id(state), x, y, kind, weapon, taken: false });
}
function scrapLine(
  state: RunnerState,
  x: number,
  top: number,
  count = 3,
): void {
  for (let i = 0; i < count; i++)
    addPickup(state, x + 52 * i, top + 22, 'scrap');
}
function addRival(
  state: RunnerState,
  x: number,
  top: number,
  kind: RivalKind = 'basic',
  speed = 0,
): void {
  const definition = RIVALS[kind];
  state.rivals.push({
    id: id(state),
    x,
    y: top,
    kind,
    hp: definition.hp,
    maxHp: definition.hp,
    speed,
    age: 0,
    defeated: false,
    hit: 0,
  });
}
function addCrate(state: RunnerState, x: number, top: number): void {
  state.obstacles.push({
    id: id(state),
    x,
    top,
    width: 34,
    height: 30,
    hp: 2,
    maxHp: 2,
    destroyed: false,
    hit: 0,
  });
}
function boundedHeight(value: number): number {
  return Math.max(TERRAIN_MIN_HEIGHT, Math.min(TERRAIN_MAX_HEIGHT, value));
}

/** The first six motifs retain their authored hill/encounter identities. The
 * late mixes reuse those real slopes, with treasure and blast chains placed on
 * the part of the silhouette that makes them useful. courseBag is recent history,
 * not a bag: every unlocked motif remains possible on every new section.
 */
export const COURSE_MOTIFS = [
  'ridge-guard',
  'blast-basin',
  'staircase-duel',
  'chase-hollow',
  'twin-crest-cache',
  'long-crest-convoy',
  'downhill-blast',
  'jump-vaults',
] as const;
const COURSE_SILHOUETTES = [0, 1, 2, 3, 4, 5, 0, 4];

function courseEvolution(state: RunnerState): number {
  return Math.min(
    1,
    Math.max(0, (state.time - 45) / 75, (state.distance - 30000) / 75000),
  );
}

function nextCoursePhrase(state: RunnerState): number {
  const { boost, slam, gold, magnet } = state.fever.abilities;
  // Saturating bonuses gently favor a build without prescribing its route.
  const affinity = (level: number) => level / (level + 3);
  const biases = [
    affinity(boost) + affinity(slam),
    affinity(slam) + affinity(gold),
    affinity(boost),
    affinity(boost) + affinity(slam),
    affinity(magnet),
    affinity(gold),
    affinity(slam) + affinity(gold),
    affinity(magnet) + affinity(gold),
  ];
  const late = state.time >= 45 || state.distance >= 30000;
  const mixWeight = late ? 0.55 + courseEvolution(state) * 0.8 : 0;
  const bases = [1, 1, 0.9, 0.9, 1, 1, mixWeight, mixWeight];
  const previousShape = COURSE_SILHOUETTES[state.coursePhrase];
  const weights = bases.map((base, motif) => {
    const recent = state.courseBag.includes(motif);
    const repeat =
      COURSE_SILHOUETTES[motif] === previousShape ? 0.2 : recent ? 0.58 : 1.25;
    return base * repeat * (1 + 0.22 * biases[motif]!);
  });
  let draw = random(state) * weights.reduce((sum, weight) => sum + weight, 0);
  let selected = weights.length - 1;
  for (let motif = 0; motif < weights.length; motif++) {
    draw -= weights[motif]!;
    if (draw < 0) {
      selected = motif;
      break;
    }
  }
  state.coursePhrase = selected;
  state.courseBag.push(selected);
  if (state.courseBag.length > 4) state.courseBag.shift();
  return selected;
}

export function generateTerrain(
  state: RunnerState,
  target = state.distance + Math.max(GENERATION_AHEAD, state.speed * 3),
): void {
  while (state.generatedUntil < target) {
    const edge = state.generatedUntil;
    const previous = state.platforms[state.platforms.length - 1]!;
    const top = platformTopAt(previous, edge);
    const motif = nextCoursePhrase(state);
    const phrase = COURSE_SILHOUETTES[motif]!;
    const evolution = courseEvolution(state);
    const roll = random(state);
    const speed = getSpeed(edge);
    const landingDelta = [8, -28, 20, -36, 0, 12][phrase]!;
    const nextTop = boundedHeight(top + landingDelta);
    const gap = speed * [0.25, 0.34, 0.22, 0.38, 0.18, 0.29][phrase]!;
    const start = edge + gap;
    const high = 92 + roll * 20;
    const low = -30 - roll * 18;
    const middle = 22 + roll * 18;
    // Each pair is [horizontal length, endpoint height]. Entry aprons absorb a
    // boosted landing; the following slopes remain physical drive surfaces.
    const profiles: Array<Array<[number, number]>> = [
      [
        [210, nextTop],
        [310, high],
        [170, high],
        [310, low],
        [200, low],
      ],
      [
        [200, nextTop],
        [280, low],
        [280, low],
        [320, high],
        [190, high],
      ],
      [
        [200, nextTop],
        [240, middle],
        [160, middle],
        [240, high],
        [190, high],
        [240, middle],
      ],
      [
        [220, nextTop],
        [360, low],
        [210, low],
        [260, middle],
        [180, middle],
      ],
      [
        [210, nextTop],
        [240, high],
        [220, middle],
        [240, high],
        [230, low],
        [180, low],
      ],
      [
        [210, nextTop],
        [370, high],
        [220, high],
        [320, middle],
        [240, middle],
      ],
    ];
    let x = start;
    let height = nextTop;
    for (const [length, endTop] of profiles[phrase]!) {
      addPlatform(state, x, length, height, endTop);
      x += length;
      height = endTop;
    }
    const width = x - start;
    const deckAt = (worldX: number) => {
      const road = state.platforms.findLast(
        (p) => worldX >= p.x && worldX <= p.x + p.width,
      )!;
      return platformTopAt(road, worldX);
    };
    const rival = (offset: number, kind: RivalKind, pace = 0) => {
      const worldX = start + offset;
      addRival(state, worldX, deckAt(worldX), kind, pace);
    };
    const crate = (offset: number) => {
      const worldX = start + offset;
      addCrate(state, worldX, deckAt(worldX));
    };
    const chest = (offset: number, lift = 27, guaranteed = false) => {
      const worldX = start + offset;
      if (guaranteed || state.chunk % 2 === 0)
        addPickup(state, worldX, deckAt(worldX) + lift, 'chest');
      else
        for (const dx of [-36, 0, 36])
          addPickup(state, worldX + dx, deckAt(worldX + dx) + lift, 'scrap');
    };
    // Gap arcs and road coins follow the actual course instead of a flat row.
    for (const time of [0.1, 0.2, 0.32])
      addPickup(
        state,
        edge + speed * (time - 0.075),
        top + JUMP_VELOCITY * time - 0.5 * GRAVITY * time ** 2 + 18,
        'scrap',
      );
    for (let offset = 100; offset < width - 110; offset += 150) {
      const worldX = start + offset;
      addPickup(state, worldX, deckAt(worldX) + 23, 'scrap');
    }
    // Crests guard jump-line treasure; troughs group volatile enemies; open
    // approaches give a charging buggy its warning window and an escape arc.
    switch (motif) {
      case 0:
        rival(550, 'heavy');
        crate(630);
        chest(610, 84);
        rival(940, 'basic', 45);
        break;
      case 1:
        crate(495);
        rival(565, 'bomber');
        crate(635);
        rival(710, 'basic', 35);
        chest(980);
        break;
      case 2:
        rival(330, 'rusher');
        crate(630);
        rival(900, state.chunk > 5 ? 'fortress' : 'heavy');
        chest(1060, 72);
        break;
      case 3:
        rival(450, 'rusher');
        rival(745, 'bomber');
        crate(815);
        crate(880);
        chest(970);
        break;
      case 4:
        rival(480, 'heavy');
        chest(635, 82);
        rival(930, 'basic', 65);
        crate(1035);
        break;
      case 5:
        rival(420, 'basic', 65);
        rival(635, 'heavy');
        crate(890);
        rival(980, 'bomber');
        crate(1055);
        chest(1190);
        break;
      case 6:
        // A guarded crest leads into a bomber tucked among the downhill crates.
        // Later runs extend the same chain into the low landing/loot apron.
        rival(550, evolution >= 0.6 ? 'fortress' : 'heavy');
        crate(815);
        rival(875, 'bomber');
        crate(950);
        rival(1020, 'basic', 35);
        if (evolution > 0.35) {
          rival(1090, 'bomber');
          crate(1145);
        }
        chest(1130, 32, true);
        break;
      case 7:
        // Two genuine airborne treasure lines above separate crests. The
        // connected valley between them remains a generous landing runway.
        rival(400, 'heavy');
        chest(485, 142, true);
        crate(645);
        rival(820, evolution >= 0.6 ? 'fortress' : 'heavy');
        chest(905, 148, true);
        rival(1100, 'bomber');
        if (evolution > 0.35) {
          crate(1160);
          for (const offset of [525, 575, 855, 955]) {
            const worldX = start + offset;
            addPickup(state, worldX, deckAt(worldX) + 126, 'scrap');
          }
        }
        break;
    }
    state.generatedUntil = x;
    state.chunk++;
  }
}
export function createRunner(seed = 1): RunnerState {
  const normalizedSeed = Math.trunc(seed) >>> 0 || 0x6d2b79f5;
  const state: RunnerState = {
    seed: normalizedSeed,
    random: normalizedSeed,
    nextId: 1,
    time: 0,
    distance: 0,
    speed: getSpeed(0),
    score: 0,
    scoreParts: { travel: 0, combat: 0, loot: 0, landing: 0 },
    bestChain: 0,
    maxMultiplier: 1,
    peakSpeed: getSpeed(0),
    chestsOpened: 0,
    fever: createFever(normalizedSeed),
    status: 'ready',
    reason: null,
    player: {
      y: 0,
      vy: 0,
      grounded: true,
      coyote: COYOTE_TIME,
      buffer: 0,
      invulnerable: 0,
      squash: 0,
      holding: false,
      jumpTempo: 1,
      airHops: 1,
      lastJumpX: null,
      lastJumpY: 0,
      flightJumped: false,
      flightTarget: null,
    },
    platforms: [],
    obstacles: [],
    pickups: [],
    rivals: [],
    shots: [],
    effects: [],
    generatedUntil: 0,
    chunk: 0,
    courseBag: [],
    coursePhrase: -1,
    jumps: 0,
    scrap: 0,
    passed: 0,
    defeated: 0,
    shield: 1,
    magnet: 0,
    weapon: null,
    lastWeapon: null,
    weaponLevels: {},
    runLevel: 1,
    nextScrapLevel: 25,
    failure: null,
    deathFeedback: '',
    notice: '',
    noticeTime: 0,
  };
  // Mix the seed before the opening roll so nearby seeds visibly differ early.
  random(state);
  random(state);
  random(state);
  state.generatedUntil = 1230 + random(state) * 40;
  addPlatform(state, -500, state.generatedUntil + 500, 0);
  scrapLine(state, 80, 0, 3);
  addPickup(state, 230, 24, 'weapon', 'machine');
  addPickup(state, 650, 26, 'chest');
  addRival(state, 440, 0);
  for (let i = 0; i < 4; i++) addCrate(state, 760 + i * 52, 0);
  scrapLine(state, 520, 0, 3);
  generateTerrain(state);
  return state;
}
export function clearJumpInput(state: RunnerState): void {
  state.player.holding = false;
  state.player.buffer = 0;
  state.fever.queuedJump = false;
  state.fever.queuedRelease = false;
  if (
    !state.player.grounded &&
    state.player.vy > RELEASE_VELOCITY * state.player.jumpTempo
  )
    state.player.vy = RELEASE_VELOCITY * state.player.jumpTempo;
}
export function startRunner(state: RunnerState): void {
  if (state.status !== 'ready') return;
  state.status = 'running';
  clearJumpInput(state);
  notice(state, '宝箱 → 能力スタック → 破壊チェイン！');
  state.noticeTime = 3.5;
}
export function pauseRunner(state: RunnerState): void {
  if (state.status === 'running') state.status = 'paused';
  clearJumpInput(state);
}
export function resumeRunner(state: RunnerState): void {
  if (state.status !== 'paused') return;
  state.status = 'running';
  clearJumpInput(state);
}
function nextLanding(state: RunnerState, x: number): Platform | null {
  let support = state.platforms.find(
    (road) =>
      x >= road.x - PLAYER_HALF_HITBOX &&
      x < road.x + road.width + PLAYER_HALF_HITBOX,
  );
  if (!support) return state.platforms.find((road) => road.x > x) ?? null;
  let index = state.platforms.indexOf(support);
  while (
    state.platforms[index + 1] &&
    platformsJoin(support, state.platforms[index + 1]!)
  )
    support = state.platforms[++index]!;
  return state.platforms[index + 1] ?? null;
}
function jump(state: RunnerState, recovery = false): void {
  const player = state.player;
  if (!recovery) {
    player.lastJumpX = state.distance;
    player.lastJumpY = player.y;
    player.flightTarget = nextLanding(state, state.distance);
  }
  player.flightJumped = true;
  if (!recovery) player.jumpTempo = jumpTempo(state.fever.abilities.boost);
  player.vy =
    (recovery
      ? RECOVERY_VELOCITY
      : player.holding
        ? JUMP_VELOCITY
        : RELEASE_VELOCITY) * player.jumpTempo;
  if (recovery) player.airHops = 0;
  player.grounded = false;
  player.coyote = 0;
  player.buffer = 0;
  player.squash = -0.32;
  state.jumps++;
  addEffect(
    state,
    recovery ? 'recover' : 'jump',
    state.distance,
    player.y,
    recovery ? 'リカバリー' : undefined,
  );
}
/** A physical press is consumed once. A second airborne press is one recovery. */
export function requestJump(state: RunnerState): boolean {
  if (state.status !== 'running' || state.player.holding) return false;
  state.player.holding = true;
  if (state.fever.freeze > 0) {
    state.fever.queuedJump = true;
    state.fever.queuedRelease = false;
    return true;
  }
  if (state.player.grounded || state.player.coyote > 0) {
    jump(state);
    return true;
  }
  if (state.player.airHops > 0) {
    jump(state, true);
    return true;
  }
  state.player.buffer = JUMP_BUFFER_TIME;
  return false;
}
export function releaseJump(state: RunnerState): void {
  state.player.holding = false;
  if (state.fever.freeze > 0) {
    state.fever.queuedRelease = true;
    return;
  }
  if (state.player.vy > RELEASE_VELOCITY * state.player.jumpTempo)
    state.player.vy = RELEASE_VELOCITY * state.player.jumpTempo;
}
function recordFailure(state: RunnerState, impact?: Platform): void {
  if (state.failure) return;
  const player = state.player;
  const passedTarget =
    player.flightTarget &&
    state.distance - PLAYER_HALF_HITBOX >
      player.flightTarget.x + player.flightTarget.width &&
    player.y < platformTopAt(player.flightTarget, state.distance);
  const target = passedTarget
    ? player.flightTarget
    : (impact ?? player.flightTarget);
  let kind: NonNullable<RunnerState['failure']>['kind'] = 'fall';
  if (state.reason === 'obstacle' || state.reason === 'rival')
    kind = 'collision';
  else if (!player.flightJumped) kind = 'no-input';
  else if (passedTarget) kind = 'overshot';
  else if (impact && player.y < impact.top) kind = 'short';
  else if (
    target &&
    state.distance - PLAYER_HALF_HITBOX > target.x + target.width &&
    player.y < platformTopAt(target, state.distance)
  )
    kind = 'overshot';
  state.failure = {
    kind,
    x: state.distance,
    y: player.y,
    takeoffX: player.lastJumpX,
    takeoffY: player.lastJumpY,
    targetX: target?.x ?? null,
    targetY: target?.top ?? null,
    targetEnd: target ? target.x + target.width : null,
  };
  state.deathFeedback = {
    'no-input': 'ジャンプせずに足場を離れた · 崖の手前で押そう',
    short: '着地点の側面に接触 · 長押しか空中のもう一押しで距離を調整',
    overshot: '着地点の先まで飛び越えた · 早めに離すと低く跳べる',
    collision:
      state.reason === 'rival'
        ? 'ライバルに接触 · 撃つか、跳び越えよう'
        : '障害物に接触 · 武器で壊すか、跳び越えよう',
    fall: '足場に着地できなかった · 長押しと空中の一押しで調整',
  }[kind];
}
function endRun(
  state: RunnerState,
  reason: RunnerState['reason'],
  impact?: Platform,
): void {
  state.status = 'over';
  state.reason = reason;
  recordFailure(state, impact);
  clearJumpInput(state);
  addEffect(state, 'burst', state.distance, state.player.y + 18);
}

function supportAt(
  state: RunnerState,
  x: number,
  y: number,
): Platform | undefined {
  return state.platforms.find(
    (platform) =>
      x + PLAYER_HALF_HITBOX > platform.x &&
      x - PLAYER_HALF_HITBOX < platform.x + platform.width &&
      Math.abs(y - platformTopAt(platform, x)) < 0.1,
  );
}

/** Follow joined surfaces only. Nearby, equal-height islands are still gaps. */
function followSupport(
  state: RunnerState,
  from: Platform,
  x: number,
): Platform | undefined {
  let support = from;
  while (x >= support.x + support.width) {
    const next = state.platforms[state.platforms.indexOf(support) + 1];
    if (!next || !platformsJoin(support, next)) break;
    support = next;
  }
  return x - PLAYER_HALF_HITBOX < support.x + support.width
    ? support
    : undefined;
}

/** Earliest above-to-below intersection against the actual clamped top line. */
function sweptLanding(
  state: RunnerState,
  x: number,
  y: number,
  vy: number,
  speed: number,
  duration: number,
  gravity: number,
): { platform: Platform; time: number } | undefined {
  let result: { platform: Platform; time: number } | undefined;
  for (const platform of state.platforms) {
    const enter = Math.max(0, (platform.x - PLAYER_HALF_HITBOX - x) / speed);
    const leave = Math.min(
      duration,
      (platform.x + platform.width + PLAYER_HALF_HITBOX - x) / speed,
    );
    if (enter >= leave) continue;
    // Clamping at both ends makes the feet's support function piecewise linear.
    const times = [
      enter,
      (platform.x - x) / speed,
      (platform.x + platform.width - x) / speed,
      leave,
    ]
      .filter((time) => time >= enter && time <= leave)
      .sort((a, b) => a - b);
    for (let index = 0; index < times.length - 1; index++) {
      const start = times[index]!;
      const end = times[index + 1]!;
      if (end - start < 1e-9) continue;
      const top = platformTopAt(platform, x + speed * start);
      const riseRate =
        (platformTopAt(platform, x + speed * end) - top) / (end - start);
      const height = y + vy * start - 0.5 * gravity * start ** 2 - top;
      if (height < -0.00001) continue; // No snapping from below or up a wall.
      const relativeVy = vy - gravity * start - riseRate;
      const root =
        (relativeVy +
          Math.sqrt(relativeVy ** 2 + 2 * gravity * Math.max(0, height))) /
        gravity;
      // A just-abandoned edge is not a fresh landing on a disconnected road.
      if (root < 1e-9 && Math.abs(relativeVy) < 1e-9) continue;
      const time = start + root;
      if (time <= end + 1e-9 && (!result || time < result.time))
        result = { platform, time };
    }
  }
  return result;
}

function stepPhysics(state: RunnerState, dt: number, oldX: number): void {
  const player = state.player;
  const gravity = GRAVITY * player.jumpTempo ** 2;
  const oldY = player.y;
  const oldVy = player.vy;
  const wasGrounded = player.grounded;
  const oldSupport = wasGrounded ? supportAt(state, oldX, oldY) : undefined;
  const support = oldSupport
    ? followSupport(state, oldSupport, state.distance)
    : undefined;
  const speed = (state.distance - oldX) / dt;
  // A ledge holds only while the footprint overlaps it. Leaving starts a fresh
  // ballistic arc with zero vertical speed, never uphill momentum/crest launch.
  const freeStart = oldSupport
    ? support
      ? dt
      : Math.max(
          0,
          Math.min(
            dt,
            (oldSupport.x + oldSupport.width + PLAYER_HALF_HITBOX - oldX) /
              speed,
          ),
        )
    : 0;
  const freeY = oldSupport
    ? platformTopAt(oldSupport, oldX + speed * freeStart)
    : oldY;
  const freeVy = oldSupport ? 0 : oldVy;
  const feetAt = (time: number): number => {
    if (oldSupport && time <= freeStart) {
      const road =
        followSupport(state, oldSupport, oldX + speed * time) ?? oldSupport;
      return platformTopAt(road, oldX + speed * time);
    }
    const flight = time - freeStart;
    return freeY + freeVy * flight - 0.5 * gravity * flight ** 2;
  };
  player.buffer = Math.max(0, player.buffer - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.squash *= Math.exp(-dt * 15);

  // A seamless slope joint has no vertical face. Every exposed entry does;
  // compare feet at the exact front crossing, before resolving a roof landing.
  for (let index = 0; index < state.platforms.length; index++) {
    const platform = state.platforms[index]!;
    const previous = state.platforms[index - 1];
    if (previous && platformsJoin(previous, platform)) continue;
    if (
      oldX + PLAYER_HALF_HITBOX <= platform.x &&
      state.distance + PLAYER_HALF_HITBOX > platform.x
    ) {
      const crossingTime = (platform.x - oldX - PLAYER_HALF_HITBOX) / speed;
      const feet = feetAt(crossingTime);
      if (feet < platform.top - 0.001) {
        state.distance = platform.x - PLAYER_HALF_HITBOX;
        player.y = feet;
        endRun(
          state,
          platform.top >
            (previous
              ? platformTopAt(previous, previous.x + previous.width)
              : 0)
            ? 'wall'
            : 'gap',
          platform,
        );
        return;
      }
    }
  }

  if (support) {
    player.y = platformTopAt(support, state.distance);
    player.vy = 0;
    player.coyote = COYOTE_TIME;
  } else {
    player.grounded = false;
    if (wasGrounded) {
      player.lastJumpX = null;
      player.lastJumpY = freeY;
      player.flightJumped = false;
      player.flightTarget = nextLanding(state, oldX);
    }
    player.coyote = wasGrounded ? COYOTE_TIME : Math.max(0, player.coyote - dt);
    const duration = dt - freeStart;
    player.y = feetAt(dt);
    player.vy = freeVy - gravity * duration;
    const landing = sweptLanding(
      state,
      oldX + speed * freeStart,
      freeY,
      freeVy,
      speed,
      duration,
      gravity,
    );
    if (landing) {
      const road =
        followSupport(state, landing.platform, state.distance) ??
        landing.platform;
      player.y = platformTopAt(road, state.distance);
      player.vy = 0;
      player.grounded = true;
      player.airHops = 1;
      player.flightTarget = null;
      player.flightJumped = false;
      player.lastJumpX = null;
      player.lastJumpY = player.y;
      player.coyote = COYOTE_TIME;
      player.squash = 0.65;
      addEffect(state, 'land', state.distance, player.y);
      awardScore(state, 15, 'landing');
      landingBlast(state);
      if (player.buffer > 0) jump(state);
    }
  }

  if (player.y < TERRAIN_DEATH_HEIGHT) endRun(state, 'gap');
}

function prune(state: RunnerState): void {
  const behind = state.distance - 600;
  state.platforms = state.platforms.filter(
    (platform) => platform.x + platform.width > behind,
  );
  state.obstacles = state.obstacles.filter(
    (obstacle) => obstacle.x + obstacle.width / 2 > behind,
  );
  state.pickups = state.pickups.filter(
    (pickup) => !pickup.taken && pickup.x > state.distance - 120,
  );
  state.rivals = state.rivals.filter((rival) => {
    if (rival.x + RIVALS[rival.kind].width / 2 + 60 >= state.distance)
      return true;
    if (!rival.defeated) {
      state.passed++;
      addEffect(
        state,
        'pass',
        state.distance - 55,
        state.player.y + 38,
        '追い越し！',
      );
    }
    return false;
  });
}

function stepFixed(state: RunnerState, dt: number): void {
  state.time += dt;
  stepFeverWorld(state, dt);
  const travel = state.speed * dt,
    oldX = state.distance,
    oldY = state.player.y;
  state.distance += travel;
  state.noticeTime = Math.max(0, state.noticeTime - dt);
  state.magnet =
    state.fever.abilities.magnet > 0 ? 1 : Math.max(0, state.magnet - travel);
  for (const effect of state.effects) effect.life -= dt;
  state.effects = state.effects.filter((effect) => effect.life > 0);
  for (const shot of state.shots) shot.life -= dt;
  state.shots = state.shots.filter((shot) => shot.life > 0);
  generateTerrain(state);
  stepPhysics(state, dt, oldX);
  if (state.status !== 'running') return;
  const f = state.fever;
  if (f.awakeningSerial.magnet > f.awakeningSeen.magnet) {
    // Consume the fresh reveal before touching any chest: a jackpot can pause
    // collection mid-loop, but must neither miss the other pickups nor replay
    // this impulse after thawing. Each repeat reaches a new real reward line.
    f.awakeningSeen.magnet = f.awakeningSerial.magnet;
    if (f.awakening.magnet > 0) {
      for (const pickup of state.pickups) {
        if (
          pickup.taken ||
          (pickup.kind !== 'scrap' && pickup.kind !== 'chest')
        )
          continue;
        const dx = pickup.x - state.distance;
        const dy = pickup.y - (state.player.y + PLAYER_HEIGHT / 2);
        if (Math.hypot(dx, dy) >= 1600) continue;
        pickup.x -= dx * 0.6;
        pickup.y -= dy * 0.6;
      }
      addEffect(
        state,
        'pickup',
        state.distance,
        state.player.y + 24,
        'MAX MAGNET',
      );
    }
  }
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    const awakenedMagnet = state.fever.awakening.magnet > 0;
    const collectible = pickup.kind === 'scrap' || pickup.kind === 'chest';
    // Earned chests keep their catch-up reach, but must not mask an awakened
    // sweep. All pickups retain their identities and are collected only once.
    const radius = Math.max(
      pickup.kind === 'chest' && pickup.earned ? 220 : 0,
      collectible && awakenedMagnet
        ? 1250
        : collectible && state.fever.abilities.magnet > 0
          ? 180 + Math.min(20, state.fever.abilities.magnet) * 17
          : 0,
    );
    const dx = pickup.x - state.distance;
    const dy = pickup.y - (state.player.y + PLAYER_HEIGHT / 2);
    if (radius && Math.hypot(dx, dy) < radius) {
      const pull = Math.min(1, dt * (awakenedMagnet ? 28 : 14));
      pickup.x -= dx * pull;
      pickup.y -= dy * pull;
    }
    // Swept pickup segment: a very fast frame cannot jump over a chest/coin.
    const span = state.distance - oldX;
    const fraction =
      span > 0 ? Math.max(0, Math.min(1, (pickup.x - oldX) / span)) : 1;
    const closestX = oldX + span * fraction;
    const closestY =
      oldY + (state.player.y - oldY) * fraction + PLAYER_HEIGHT / 2;
    const reach = pickup.kind === 'chest' ? 44 : 32;
    if (
      Math.abs(pickup.x - closestX) < reach &&
      Math.abs(pickup.y - closestY) < (pickup.kind === 'chest' ? 92 : 28)
    ) {
      collectPickup(state, pickup);
      if (state.fever.freeze > 0) break;
    }
  }
  if (state.fever.freeze > 0) return;
  stepCombat(state, dt, oldX, oldY);
  if ((state.status as RunnerState['status']) === 'over') {
    recordFailure(state);
    clearJumpInput(state);
  }
  prune(state);
}

/** Mutates state. Oversized caller steps are subdivided to prevent tunnelling. */
export function stepRunner(state: RunnerState, dt = FIXED_DT): void {
  if (state.status !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  let remaining = Math.min(dt, 0.25);
  while (remaining > 1e-9 && state.status === 'running') {
    const step = Math.min(FIXED_DT, remaining);
    const worldStep = stepFeverUI(state, step);
    if (worldStep > 1e-9) {
      if (state.fever.queuedJump) {
        state.fever.queuedJump = false;
        const released = state.fever.queuedRelease;
        state.player.holding = true;
        if (state.player.grounded || state.player.coyote > 0) jump(state);
        else if (state.player.airHops > 0) jump(state, true);
        else state.player.buffer = JUMP_BUFFER_TIME;
        if (released) releaseJump(state);
      } else if (state.fever.queuedRelease) releaseJump(state);
      state.fever.queuedRelease = false;
      stepFixed(state, worldStep);
    }
    remaining -= step;
  }
}
