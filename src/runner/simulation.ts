import { RIVALS, WEAPONS, WEAPON_ORDER } from './definitions';
import {
  FIXED_DT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  type Effect,
  type Pickup,
  type Platform,
  type Rival,
  type RivalKind,
  type RunnerState,
  type WeaponId,
} from './types';

export const GRAVITY = 1450;
export const JUMP_VELOCITY = 520;
export const COYOTE_TIME = 0.09;
export const JUMP_BUFFER_TIME = 0.1;
export const JUMP_AIRTIME = (2 * JUMP_VELOCITY) / GRAVITY;
export const WEAPON_DISTANCE = 1600;
export const MAGNET_DISTANCE = 1100;
export const MAX_WEAPON_LEVEL = 3;
export const RIVAL_WARNING_TIME = 1;
export const GENERATION_AHEAD = 2300;
export const PLAYER_HALF_HITBOX = PLAYER_WIDTH * 0.36;
export const TERRAIN_MIN_HEIGHT = -48;
export const TERRAIN_MAX_HEIGHT = 128;
export const TERRAIN_DEATH_HEIGHT = -220;
export const MIN_LANDING_RUN_TIME = 0.5;

/** Descending intersection of the fixed jump arc with a relative landing height. */
export function jumpLandingTime(rise: number): number {
  return (
    (JUMP_VELOCITY + Math.sqrt(JUMP_VELOCITY ** 2 - 2 * GRAVITY * rise)) /
    GRAVITY
  );
}

/** World pixels per second. Progress changes pace, never jump physics. */
export function getSpeed(distance: number): number {
  return 220 + 120 * Math.min(1, Math.max(0, distance) / 18000);
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
): Platform {
  const platform = { id: id(state), x, width, top };
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
    addPickup(state, x + 55 * i, top + 24, 'scrap');
}

function jumpArc(state: RunnerState, edge: number, top: number): void {
  const speed = getSpeed(edge);
  for (const time of [0.18, 0.36, 0.54]) {
    addPickup(
      state,
      edge + speed * (time - 0.15),
      top + JUMP_VELOCITY * time - 0.5 * GRAVITY * time * time + 14,
      'scrap',
    );
  }
}

function pairWeapon(seed: number, chunk: number): WeaponId {
  // Adjacent chunks share a seeded choice, even after old pickups prune.
  // Recovery-road triples guarantee upgrades locally; chunk pairs can be far apart.
  let value = (seed ^ Math.imul(Math.floor(chunk / 2) + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  value = (value ^ (value >>> 15)) >>> 0;
  return WEAPON_ORDER[value % WEAPON_ORDER.length] ?? 'machine';
}

function addEquipment(state: RunnerState, x: number, top: number): void {
  // Jump deliberately for a swap/upgrade; staying low preserves the current build.
  const weapon = pairWeapon(state.seed, state.chunk);
  addPickup(state, x, top + 100, 'weapon', weapon);
  scrapLine(state, x - 55, top, 3);
  if (state.chunk % 4 === 2) addPickup(state, x + 100, top + 25, 'shield');
  if (state.chunk % 7 === 5) addPickup(state, x + 100, top + 25, 'magnet');
}

interface TerrainBeat {
  top: number;
  plateau?: boolean;
  walkOff?: boolean;
}

// Choose a vertical phrase first; horizontal spacing follows its jump envelope.
// Each phrase returns to zero, so every boundary is safe in any seeded ordering.
const TERRAIN_PHRASES: readonly (readonly TerrainBeat[])[] = [
  [
    { top: 64 },
    { top: 128, plateau: true },
    { top: 64, walkOff: true },
    { top: 0 },
  ],
  [
    { top: 48 },
    { top: 96 },
    { top: 48 },
    { top: 112, plateau: true },
    { top: 64, walkOff: true },
    { top: 0 },
  ],
  [
    { top: -48, walkOff: true },
    { top: 16 },
    { top: 64, plateau: true },
    { top: 0, walkOff: true },
  ],
  [
    { top: 48 },
    { top: 0, walkOff: true },
    { top: -48, plateau: true },
    { top: 16 },
    { top: 0, walkOff: true },
  ],
];

/** Append authored, individually traversable chunks; never remove/rewrite terrain. */
export function generateTerrain(
  state: RunnerState,
  target = state.distance + GENERATION_AHEAD,
): void {
  while (state.generatedUntil < target) {
    const start = state.generatedUntil;
    const previous = state.platforms[state.platforms.length - 1];
    const top = previous?.top ?? 0;
    const speed = getSpeed(start);
    const stage = Math.min(5, Math.floor(start / 2400));
    const roll = random(state);
    const first = state.chunk === 0;
    const recovery = !first && state.chunk % 4 === 3;
    const crate = state.chunk > 1 && !recovery && stage >= 1 && roll < 0.22;

    if (first) {
      // Preserve a simple first jump and a generous landing to learn the controls.
      jumpArc(state, start, top);
      addPlatform(state, 980, 610, 0);
      state.generatedUntil = 1590;
      scrapLine(state, 1190, 0);
      addEquipment(state, 1310, 0);
    } else if (recovery) {
      // A full straight before and after a rival. Rivals stop well before its edge.
      const length = 1700;
      addPlatform(state, start, length, top);
      scrapLine(state, start + 100, top, 4);
      addEquipment(state, start + 300, top);
      // A local three-pickup build window survives even when vertical phrases
      // between other rewards exceed the weapon lifetime. Every jump is optional.
      const weapon = pairWeapon(state.seed, state.chunk);
      addPickup(state, start + 650, top + 100, 'weapon', weapon);
      addPickup(state, start + 1000, top + 100, 'weapon', weapon);
      if (stage >= 1) {
        const kinds: RivalKind[] = [
          'basic',
          'rusher',
          'heavy',
          'bomber',
          'artillery',
          'fortress',
        ];
        const unlocked = Math.min(kinds.length, stage + 1);
        const kind = kinds[Math.floor(random(state) * unlocked)] ?? 'basic';
        const definition = RIVALS[kind];
        state.rivals.push({
          id: id(state),
          x: start + 600,
          y: top,
          kind,
          hp: definition.hp,
          maxHp: definition.hp,
          speed: speed * definition.pace,
          age: 0,
          defeated: false,
          hit: 0,
        });
        scrapLine(state, start + 1320, top);
      }
      state.generatedUntil += length;
    } else if (crate) {
      const length = 920 + random(state) * 120;
      addPlatform(state, start, length, top);
      const x = start + 250;
      state.obstacles.push({
        id: id(state),
        x,
        width: 30 + stage * 2,
        height: 25 + stage,
        top,
      });
      addPickup(state, x + 15, top + 105, 'scrap');
      scrapLine(state, start + 480, top);
      addEquipment(state, start + length - 290, top);
      state.generatedUntil += length;
    } else {
      // The first phrase guarantees a visible 64 -> 128px climb immediately
      // after the learning landing; later phrases mix crests, stones and valleys.
      const phrase =
        TERRAIN_PHRASES[
          state.chunk === 1
            ? 0
            : Math.floor(random(state) * TERRAIN_PHRASES.length)
        ]!;
      let previousTop = top;
      for (const beat of phrase) {
        const edge = state.generatedUntil;
        const pace = getSpeed(edge);
        const rise = beat.top - previousTop;
        const flight = jumpLandingTime(rise);
        const gapTime =
          rise > 0
            ? Math.min(0.28, flight * (0.42 + random(state) * 0.04))
            : flight * (0.45 + random(state) * 0.04);
        const gap = beat.walkOff ? 0 : pace * gapTime;
        // A late, safe launch lands at most ~0.36s into these stones. The
        // remaining runway gives >0.5s grounded before the next launch window.
        const landingFlight = beat.walkOff
          ? Math.sqrt((-2 * rise) / GRAVITY) + PLAYER_HALF_HITBOX / pace
          : flight;
        const landingRun = Math.max(
          1.02,
          landingFlight -
            (beat.walkOff ? 0 : gapTime) +
            MIN_LANDING_RUN_TIME +
            0.16,
        );
        const landing = beat.plateau
          ? Math.max(660, pace * 2.15)
          : pace * (landingRun + random(state) * 0.06);
        if (gap > 0) jumpArc(state, edge, previousTop);
        addPlatform(state, edge + gap, landing, beat.top);
        state.generatedUntil = edge + gap + landing;
        if (beat.plateau) {
          // Optional jumps cannot be forced into a pickup by an adjacent climb
          // or drop: leave >=290px on both sides of the reward's flat road.
          addEquipment(state, edge + gap + landing / 2, beat.top);
        } else {
          scrapLine(state, edge + gap + landing * 0.45, beat.top, 2);
        }
        previousTop = beat.top;
      }
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
    },
    platforms: [],
    obstacles: [],
    pickups: [],
    rivals: [],
    shots: [],
    effects: [],
    generatedUntil: 900,
    chunk: 0,
    jumps: 0,
    scrap: 0,
    passed: 0,
    defeated: 0,
    shield: 1,
    magnet: 0,
    weapon: null,
    lastWeapon: null,
    notice: '',
    noticeTime: 0,
  };
  addPlatform(state, -500, 1400, 0);
  scrapLine(state, 200, 0, 4);
  addPickup(state, 490, 100, 'weapon', 'machine');
  scrapLine(state, 440, 0, 3);
  scrapLine(state, 630, 0, 3);
  generateTerrain(state);
  return state;
}

export function startRunner(state: RunnerState): void {
  if (state.status !== 'ready') return;
  state.status = 'running';
  state.player.buffer = 0;
  notice(state, '空中の武器へジャンプ');
  state.noticeTime = 4;
}

export function pauseRunner(state: RunnerState): void {
  if (state.status === 'running') state.status = 'paused';
  state.player.buffer = 0;
}

export function resumeRunner(state: RunnerState): void {
  if (state.status !== 'paused') return;
  state.status = 'running';
  state.player.buffer = 0;
}

function jump(state: RunnerState): void {
  const player = state.player;
  player.vy = JUMP_VELOCITY;
  player.grounded = false;
  player.coyote = 0;
  player.buffer = 0;
  player.squash = -0.16;
  state.jumps++;
  addEffect(state, 'jump', state.distance, player.y);
}

/** One press is one fixed jump. Airborne presses buffer, never double-jump. */
export function requestJump(state: RunnerState): boolean {
  if (state.status !== 'running') return false;
  state.player.buffer = JUMP_BUFFER_TIME;
  if (state.player.grounded || state.player.coyote > 0) {
    jump(state);
    return true;
  }
  return false;
}

export function collectPickup(state: RunnerState, pickup: Pickup): void {
  if (pickup.taken) return;
  pickup.taken = true;
  if (pickup.kind === 'scrap') {
    state.scrap++;
    addEffect(state, 'pickup', pickup.x, pickup.y);
    return;
  }
  if (pickup.kind === 'weapon' && pickup.weapon) {
    const same = state.weapon?.id === pickup.weapon;
    const level = same
      ? Math.min(MAX_WEAPON_LEVEL, (state.weapon?.level ?? 0) + 1)
      : 1;
    state.weapon = {
      id: pickup.weapon,
      level,
      remaining: WEAPON_DISTANCE,
      cooldown: 0,
    };
    state.lastWeapon = pickup.weapon;
    notice(
      state,
      `${WEAPONS[pickup.weapon].label} ${same ? `LV ${level}` : '装備！'}`,
    );
  } else if (pickup.kind === 'shield') {
    state.shield = 1;
    notice(state, 'シールド獲得');
  } else if (pickup.kind === 'magnet') {
    state.magnet = MAGNET_DISTANCE;
    notice(state, 'スクラップ磁石！');
  }
  addEffect(state, 'pickup', pickup.x, pickup.y, state.notice);
}

function endRun(state: RunnerState, reason: RunnerState['reason']): void {
  state.status = 'over';
  state.reason = reason;
  state.player.buffer = 0;
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
      Math.abs(y - platform.top) < 0.1,
  );
}

function stepPhysics(state: RunnerState, dt: number, oldX: number): void {
  const player = state.player;
  const oldY = player.y;
  const oldVy = player.vy;
  const wasGrounded = player.grounded;
  const support = wasGrounded
    ? supportAt(state, state.distance, oldY)
    : undefined;
  player.buffer = Math.max(0, player.buffer - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.squash *= Math.exp(-dt * 15);

  // Resolve a swept front-face crossing before considering a top landing.
  // Endpoint-only overlap would let a low/late jump enter a raised platform,
  // or snap onto its roof even though the feet hit its vertical face first.
  const travel = state.distance - oldX;
  for (const platform of state.platforms) {
    if (
      oldX + PLAYER_HALF_HITBOX <= platform.x &&
      state.distance + PLAYER_HALF_HITBOX > platform.x
    ) {
      const crossingTime =
        (dt * (platform.x - oldX - PLAYER_HALF_HITBOX)) / travel;
      const feetAtFace = support
        ? oldY
        : oldY + oldVy * crossingTime - 0.5 * GRAVITY * crossingTime ** 2;
      if (feetAtFace < platform.top - 0.001) {
        state.distance = platform.x - PLAYER_HALF_HITBOX;
        player.y = feetAtFace;
        const previous = state.platforms[state.platforms.indexOf(platform) - 1];
        // A missed ordinary hole remains a gap; raised entry faces are walls.
        endRun(state, platform.top > (previous?.top ?? 0) ? 'wall' : 'gap');
        return;
      }
    }
  }

  if (support) {
    player.y = support.top;
    player.vy = 0;
    player.coyote = COYOTE_TIME;
  } else {
    player.grounded = false;
    player.coyote = wasGrounded ? COYOTE_TIME : Math.max(0, player.coyote - dt);
    player.y += player.vy * dt - 0.5 * GRAVITY * dt * dt;
    player.vy -= GRAVITY * dt;
    if (player.vy <= 0) {
      const landing = state.platforms
        .filter(
          (platform) =>
            state.distance + PLAYER_HALF_HITBOX > platform.x &&
            state.distance - PLAYER_HALF_HITBOX < platform.x + platform.width &&
            oldY >= platform.top - 0.01 &&
            player.y <= platform.top,
        )
        .sort((a, b) => b.top - a.top)[0];
      if (landing) {
        player.y = landing.top;
        player.vy = 0;
        player.grounded = true;
        player.coyote = COYOTE_TIME;
        player.squash = 0.17;
        addEffect(state, 'land', state.distance, player.y);
        if (player.buffer > 0) jump(state);
      }
    }
  }

  for (const obstacle of state.obstacles) {
    if (
      state.distance + PLAYER_HALF_HITBOX > obstacle.x - obstacle.width / 2 &&
      state.distance - PLAYER_HALF_HITBOX < obstacle.x + obstacle.width / 2 &&
      player.y < obstacle.top + obstacle.height - 1 &&
      player.y + PLAYER_HEIGHT > obstacle.top + 2
    ) {
      endRun(state, 'obstacle');
      return;
    }
  }
  if (player.y < TERRAIN_DEATH_HEIGHT) endRun(state, 'gap');
}

function damageRival(state: RunnerState, rival: Rival, damage: number): void {
  if (rival.defeated) return;
  rival.hp = Math.max(0, rival.hp - damage);
  rival.hit = 0.15;
  if (rival.hp === 0) {
    rival.defeated = true;
    state.defeated++;
    state.scrap += 3;
    addEffect(state, 'burst', rival.x, rival.y + 20, '+3');
  } else {
    addEffect(state, 'hit', rival.x, rival.y + 20);
  }
}

function fireWeapon(state: RunnerState, dt: number): void {
  const weapon = state.weapon;
  if (!weapon) return;
  weapon.cooldown = Math.max(0, weapon.cooldown - dt);
  if (weapon.cooldown > 0) return;
  const definition = WEAPONS[weapon.id];
  const targets = state.rivals
    .filter(
      (rival) =>
        !rival.defeated &&
        rival.x >= state.distance - (weapon.id === 'mine' ? 95 : 12) &&
        rival.x - state.distance <= definition.range,
    )
    .sort((a, b) => a.x - b.x);
  const first = targets[0];
  if (!first) return;
  const scale = 1 + (weapon.level - 1) * 0.45;
  weapon.cooldown = definition.cadence / (1 + (weapon.level - 1) * 0.12);
  let hits = [first];
  if (weapon.id === 'rail' || weapon.id === 'flame') hits = targets;
  if (weapon.id === 'scatter')
    hits = targets.filter((target) => target.x - first.x <= 110).slice(0, 3);
  if (weapon.id === 'rocket' || weapon.id === 'mine') {
    hits = state.rivals.filter(
      (target) => !target.defeated && Math.abs(target.x - first.x) < 125,
    );
  }
  for (const target of hits)
    damageRival(state, target, definition.damage * scale);
  state.shots.push({
    id: id(state),
    x: state.distance + 6,
    y: state.player.y + 82,
    endX: weapon.id === 'rail' ? state.distance + definition.range : first.x,
    endY: first.y + RIVALS[first.kind].height / 2,
    life: weapon.id === 'flame' ? 0.11 : 0.16,
    weapon: weapon.id,
  });
  if (state.shots.length > 24) state.shots.splice(0, state.shots.length - 24);
}

function stepRivals(state: RunnerState, dt: number): void {
  for (const rival of state.rivals) {
    // Warnings begin in the shared portrait/landscape visible reaction window.
    if (rival.x - state.distance <= 500) rival.age += dt;
    rival.hit = Math.max(0, rival.hit - dt);
    if (rival.defeated) continue;
    const road = state.platforms.find(
      (platform) =>
        rival.x >= platform.x && rival.x <= platform.x + platform.width,
    );
    // Generated rivals stay on their recovery straight, far from the next hole.
    if (road)
      rival.x = Math.min(rival.x + rival.speed * dt, road.x + road.width - 360);
  }
  fireWeapon(state, dt);
  for (const rival of state.rivals) {
    if (
      rival.defeated ||
      rival.age < RIVAL_WARNING_TIME ||
      state.player.invulnerable > 0
    )
      continue;
    const definition = RIVALS[rival.kind];
    if (
      Math.abs(rival.x - state.distance) <
        definition.width / 2 + PLAYER_HALF_HITBOX &&
      state.player.y < rival.y + definition.height - 2 &&
      state.player.y + PLAYER_HEIGHT > rival.y + 3
    ) {
      if (state.shield > 0) {
        state.shield = 0;
        state.player.invulnerable = 1.25;
        notice(state, 'シールドが守った！');
        addEffect(
          state,
          'burst',
          state.distance,
          state.player.y + 20,
          'ガード',
        );
      } else {
        endRun(state, 'rival');
        return;
      }
    }
  }
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
  const travel = state.speed * dt;
  const oldX = state.distance;
  state.distance += travel;
  state.noticeTime = Math.max(0, state.noticeTime - dt);
  state.magnet = Math.max(0, state.magnet - travel);
  for (const effect of state.effects) effect.life -= dt;
  state.effects = state.effects.filter((effect) => effect.life > 0);
  for (const shot of state.shots) shot.life -= dt;
  state.shots = state.shots.filter((shot) => shot.life > 0);
  if (state.weapon) {
    state.weapon.remaining = Math.max(0, state.weapon.remaining - travel);
    if (state.weapon.remaining === 0) {
      state.weapon = null;
      notice(state, '武器終了 · 走り続けよう');
    }
  }
  generateTerrain(state);
  stepPhysics(state, dt, oldX);
  if (state.status !== 'running') return;
  for (const pickup of state.pickups) {
    const dx = pickup.x - state.distance;
    const dy = pickup.y - (state.player.y + PLAYER_HEIGHT / 2);
    const magnet =
      pickup.kind === 'scrap' &&
      state.magnet > 0 &&
      dx * dx + dy * dy < 130 * 130;
    if (!pickup.taken && (magnet || (Math.abs(dx) < 32 && Math.abs(dy) < 28)))
      collectPickup(state, pickup);
  }
  stepRivals(state, dt);
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
