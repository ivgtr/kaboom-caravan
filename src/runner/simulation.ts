import { RIVALS, WEAPON_ORDER } from './definitions';
import { collectPickup, stepCombat } from './combat';
import { platformTopAt, platformsJoin } from './terrain';
import { DOUBLE_BEAT_DISTANCE, getSpeed } from './pacing';
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

export const GRAVITY = 1550;
export const JUMP_VELOCITY = 575;
export const RECOVERY_VELOCITY = 430;
export const RELEASE_VELOCITY = 300;
export const COYOTE_TIME = 0.09;
export const JUMP_BUFFER_TIME = 0.1;
export const JUMP_AIRTIME = (2 * JUMP_VELOCITY) / GRAVITY;
export const GENERATION_AHEAD = 2500;
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
function jumpArc(
  state: RunnerState,
  edge: number,
  top: number,
  low = false,
): void {
  const speed = getSpeed(edge);
  // The low trail follows a 50ms tap; a longer trail invites a held descent.
  const times = low ? [0.17, 0.3, 0.43] : [0.24, 0.43, 0.62];
  for (const time of times) {
    const afterRelease = time - 0.05;
    const height = low
      ? JUMP_VELOCITY * 0.05 -
        0.5 * GRAVITY * 0.05 ** 2 +
        RELEASE_VELOCITY * afterRelease -
        0.5 * GRAVITY * afterRelease ** 2
      : JUMP_VELOCITY * time - 0.5 * GRAVITY * time * time;
    addPickup(state, edge + speed * (time - 0.12), top + height + 17, 'scrap');
  }
}
function pairWeapon(seed: number, chunk: number): WeaponId {
  // A repeated pair makes upgrades discoverable, but a new route changes loadouts.
  return (
    WEAPON_ORDER[
      (Math.floor(chunk / 4) + (seed % WEAPON_ORDER.length)) %
        WEAPON_ORDER.length
    ] ?? 'machine'
  );
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
function equipmentLane(
  state: RunnerState,
  start: number,
  top: number,
  speed: number,
  raised = false,
): void {
  const weapon = pairWeapon(state.seed, state.chunk);
  addPickup(state, start + speed * 0.78, top + 88, 'weapon', weapon);
  // Leave time to land after selecting a gun, then fire or hop the cluster.
  const kinds: RivalKind[] = [
    'basic',
    'rusher',
    'heavy',
    'bomber',
    'artillery',
    'fortress',
  ];
  const encounter =
    Math.floor(state.chunk / 6) * 2 + (state.chunk % 6 === 4 ? 1 : 0);
  const kind = kinds[encounter % kinds.length]!;
  const targetTop = raised ? boundedHeight(top + 24) : top;
  addCrate(state, start + speed * 1.48, targetTop);
  addRival(state, start + speed * 1.48 + 80, targetTop, kind);
  if (state.chunk > 4)
    addRival(state, start + speed * 1.48 + 150, targetTop, 'basic');
  scrapLine(state, start + speed * 0.36, top, 3);
  scrapLine(state, start + speed * 2.5, top, 3);
  if (state.chunk % 6 === 4)
    addPickup(state, start + speed * 2.55, top + 25, 'shield');
  if (state.chunk % 10 === 8)
    addPickup(state, start + speed * 2.55, top + 25, 'magnet');
}
function boundedHeight(value: number): number {
  return Math.max(TERRAIN_MIN_HEIGHT, Math.min(TERRAIN_MAX_HEIGHT, value));
}

/** Time-shaped phrases alternate low hops, held drops, battles and a double beat. */
export function generateTerrain(
  state: RunnerState,
  target = state.distance + GENERATION_AHEAD,
): void {
  while (state.generatedUntil < target) {
    const edge = state.generatedUntil;
    const previous = state.platforms[state.platforms.length - 1]!;
    const top = platformTopAt(previous, edge);
    const speed = getSpeed(edge);
    const roll = random(state);
    const first = state.chunk === 0;
    const phrase = state.chunk % 6;
    const double = phrase === 5 && edge >= DOUBLE_BEAT_DISTANCE;
    const descending = phrase === 3;
    const low = first || phrase === 0 || phrase === 1 || double;
    const gapTime = low
      ? 0.28 + roll * 0.035
      : descending
        ? 0.53 + roll * 0.04
        : 0.37 + roll * 0.055;
    const rise = low
      ? 0
      : descending
        ? roll < 0.5
          ? -40
          : -24
        : [0, 24, 32][Math.floor(random(state) * 3)]!;
    const nextTop = boundedHeight(top + rise);
    const start = edge + speed * gapTime;
    const laneSpeed = getSpeed(start);
    jumpArc(state, edge, top, low);
    if (double) {
      // A deliberate second beat after learning. Both full holds and low taps
      // leave a real grounded decision window; recovery is never compulsory.
      const landing = Math.max(330, laneSpeed * 0.96);
      addPlatform(state, start, landing, nextTop);
      scrapLine(state, start + laneSpeed * 0.3, nextTop, 3);
      const nextEdge = start + landing;
      const exit = nextEdge + getSpeed(nextEdge) * 0.3;
      const exitWidth = Math.max(620, getSpeed(exit) * 1.5);
      addPlatform(state, exit, exitWidth, nextTop);
      jumpArc(state, nextEdge, nextTop, true);
      scrapLine(state, exit + laneSpeed * 0.35, nextTop, 4);
      state.generatedUntil = exit + exitWidth;
    } else if (phrase === 1) {
      // A breathing hill keeps its physical slope. No enemy stacks on its crest.
      const landing = Math.max(300, laneSpeed * 0.8);
      const rampWidth = 200;
      const rampEnd = boundedHeight(nextTop + (roll < 0.5 ? 64 : -48));
      const exitWidth = Math.max(330, laneSpeed * 0.85);
      addPlatform(state, start, landing, nextTop);
      addPlatform(state, start + landing, rampWidth, nextTop, rampEnd);
      addPlatform(state, start + landing + rampWidth, exitWidth, rampEnd);
      scrapLine(state, start + laneSpeed * 0.3, nextTop, 3);
      for (let i = 0; i < 3; i++)
        addPickup(
          state,
          start + landing + 45 + 55 * i,
          nextTop + ((rampEnd - nextTop) * (45 + 55 * i)) / rampWidth + 24,
          'scrap',
        );
      scrapLine(state, start + landing + rampWidth + 100, rampEnd, 3);
      state.generatedUntil = start + landing + rampWidth + exitWidth;
    } else if (phrase === 2 || phrase === 4) {
      const width = laneSpeed * 3.1;
      const raised = phrase === 4;
      if (raised) {
        const bump = boundedHeight(nextTop + 24);
        const upStart = laneSpeed * 1.02;
        const downStart = laneSpeed * 1.99;
        addPlatform(state, start, upStart, nextTop);
        addPlatform(state, start + upStart, 120, nextTop, bump);
        addPlatform(
          state,
          start + upStart + 120,
          downStart - upStart - 120,
          bump,
        );
        addPlatform(state, start + downStart, 120, bump, nextTop);
        addPlatform(
          state,
          start + downStart + 120,
          width - downStart - 120,
          nextTop,
        );
      } else addPlatform(state, start, width, nextTop);
      equipmentLane(state, start, nextTop, laneSpeed, raised);
      state.generatedUntil = start + width;
    } else {
      const width = first
        ? 490 + random(state) * 70
        : laneSpeed *
          (descending
            ? 1.82 + random(state) * 0.18
            : 1.48 + random(state) * 0.2);
      addPlatform(state, start, width, nextTop);
      scrapLine(state, start + laneSpeed * 0.35, nextTop, 4);
      // Holding is required for the longer drop, then the high pickup is optional.
      if (descending)
        addPickup(
          state,
          start + laneSpeed * 0.72,
          nextTop + 88,
          'weapon',
          pairWeapon(state.seed, state.chunk),
        );
      state.generatedUntil = start + width;
    }
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
  state.generatedUntil = 570 + random(state) * 50;
  addPlatform(state, -500, state.generatedUntil + 500, 0);
  scrapLine(state, 95, 0, 3);
  addPickup(state, 260, 24, 'weapon', 'machine');
  addRival(state, 475, 0);
  scrapLine(state, 340, 0, 3);
  generateTerrain(state);
  return state;
}
export function clearJumpInput(state: RunnerState): void {
  state.player.holding = false;
  state.player.buffer = 0;
  if (!state.player.grounded && state.player.vy > RELEASE_VELOCITY)
    state.player.vy = RELEASE_VELOCITY;
}
export function startRunner(state: RunnerState): void {
  if (state.status !== 'ready') return;
  state.status = 'running';
  clearJumpInput(state);
  notice(state, '長押しで遠くへ · 空中でもう一度でリカバリー');
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
  player.vy = recovery
    ? RECOVERY_VELOCITY
    : player.holding
      ? JUMP_VELOCITY
      : RELEASE_VELOCITY;
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
  if (state.player.vy > RELEASE_VELOCITY) state.player.vy = RELEASE_VELOCITY;
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
      const height = y + vy * start - 0.5 * GRAVITY * start ** 2 - top;
      if (height < -0.00001) continue; // No snapping from below or up a wall.
      const relativeVy = vy - GRAVITY * start - riseRate;
      const root =
        (relativeVy +
          Math.sqrt(relativeVy ** 2 + 2 * GRAVITY * Math.max(0, height))) /
        GRAVITY;
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
    return freeY + freeVy * flight - 0.5 * GRAVITY * flight ** 2;
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
    player.vy = freeVy - GRAVITY * duration;
    const landing = sweptLanding(
      state,
      oldX + speed * freeStart,
      freeY,
      freeVy,
      speed,
      duration,
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
  state.speed = getSpeed(state.distance);
  const travel = state.speed * dt,
    oldX = state.distance;
  state.distance += travel;
  state.noticeTime = Math.max(0, state.noticeTime - dt);
  state.magnet = Math.max(0, state.magnet - travel);
  for (const effect of state.effects) effect.life -= dt;
  state.effects = state.effects.filter((effect) => effect.life > 0);
  for (const shot of state.shots) shot.life -= dt;
  state.shots = state.shots.filter((shot) => shot.life > 0);
  generateTerrain(state);
  stepPhysics(state, dt, oldX);
  if (state.status !== 'running') return;
  for (const pickup of state.pickups) {
    const dx = pickup.x - state.distance,
      dy = pickup.y - (state.player.y + PLAYER_HEIGHT / 2);
    const magnet =
      pickup.kind === 'scrap' &&
      state.magnet > 0 &&
      dx * dx + dy * dy < 130 * 130;
    if (!pickup.taken && (magnet || (Math.abs(dx) < 32 && Math.abs(dy) < 28)))
      collectPickup(state, pickup);
  }
  stepCombat(state, dt);
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
    stepFixed(state, step);
    remaining -= step;
  }
}
