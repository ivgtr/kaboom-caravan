import { RIVALS, WEAPONS } from './definitions';
import { platformTopAt, playerMuzzle, playerTilt } from './terrain';
import {
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  type Effect,
  type Obstacle,
  type Pickup,
  type Rival,
  type RunnerState,
  type WeaponId,
} from './types';

export const MAX_WEAPON_LEVEL = 3;
export const SCRAP_PER_LEVEL = 25;
export const MAGNET_DISTANCE = 1100;
export const RIVAL_WARNING_TIME = 0.8;
export const RIVAL_WARNING_LEAD_TIME = 1.05;
const HALF_PLAYER = PLAYER_WIDTH / 2;
const MAX_CONTACT_DISTANCE =
  HALF_PLAYER +
  Math.max(...Object.values(RIVALS).map((rival) => rival.width / 2));
/** Give every body a real-time approach window as the road accelerates. */
export function rivalWarningDistance(speed: number): number {
  return Math.max(500, speed * RIVAL_WARNING_LEAD_TIME + MAX_CONTACT_DISTANCE);
}

function effect(
  state: RunnerState,
  kind: Effect['kind'],
  x: number,
  y: number,
  text?: string,
): void {
  state.effects.push({
    id: state.nextId++,
    kind,
    x,
    y,
    life: 0.6,
    maxLife: 0.6,
    text,
  });
  if (state.effects.length > 64)
    state.effects.splice(0, state.effects.length - 64);
}

function notice(state: RunnerState, text: string): void {
  state.notice = text;
  state.noticeTime = 2.6;
}

/** Scrap is cumulative. Every source advances the same visible run-level meter. */
export function awardScrap(state: RunnerState, amount: number): void {
  state.scrap += amount;
  let grew = false;
  while (state.scrap >= state.nextScrapLevel) {
    state.runLevel++;
    state.nextScrapLevel += SCRAP_PER_LEVEL + (state.runLevel - 1) * 10;
    state.shield = 1;
    grew = true;
  }
  if (grew) {
    notice(state, `改造${state.runLevel}段階！ 火力アップ・シールド回復`);
    effect(
      state,
      'pickup',
      state.distance,
      state.player.y + 54,
      `改造${state.runLevel}段階`,
    );
  }
}

/** Returning to a weapon preserves its build; another copy always upgrades it. */
export function collectPickup(state: RunnerState, pickup: Pickup): void {
  if (pickup.taken) return;
  pickup.taken = true;
  if (pickup.kind === 'scrap') {
    awardScrap(state, 1);
    effect(state, 'pickup', pickup.x, pickup.y);
    return;
  }
  if (pickup.kind === 'weapon' && pickup.weapon) {
    const oldLevel = state.weaponLevels[pickup.weapon] ?? 0;
    const level = Math.min(MAX_WEAPON_LEVEL, oldLevel + 1);
    state.weaponLevels[pickup.weapon] = level;
    state.weapon = { id: pickup.weapon, level, cooldown: 0 };
    state.lastWeapon = pickup.weapon;
    const label = WEAPONS[pickup.weapon].label;
    if (oldLevel === MAX_WEAPON_LEVEL) {
      const runLevel = state.runLevel;
      awardScrap(state, 3);
      if (runLevel === state.runLevel)
        notice(state, `${label} Lv${level} · スクラップ +3`);
    } else {
      notice(state, `${label} Lv${level} · ${oldLevel ? '強化！' : '装備！'}`);
    }
  } else if (pickup.kind === 'shield') {
    state.shield = 1;
    notice(state, 'シールド回復 · 接触を1回ガード');
  } else if (pickup.kind === 'magnet') {
    state.magnet = MAGNET_DISTANCE;
    notice(state, 'スクラップ磁石！');
  }
  effect(state, 'pickup', pickup.x, pickup.y, state.notice);
}

interface Target {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rival?: Rival;
  obstacle?: Obstacle;
}

function activeTargets(state: RunnerState): Target[] {
  return [
    ...state.rivals
      .filter((rival) => !rival.defeated)
      .map((rival) => ({
        id: rival.id,
        x: rival.x,
        y: rival.y + RIVALS[rival.kind].height / 2,
        width: RIVALS[rival.kind].width,
        height: RIVALS[rival.kind].height,
        rival,
      })),
    ...state.obstacles
      .filter((obstacle) => !obstacle.destroyed)
      .map((obstacle) => ({
        id: obstacle.id,
        x: obstacle.x,
        y: obstacle.top + obstacle.height / 2,
        width: obstacle.width,
        height: obstacle.height,
        obstacle,
      })),
  ];
}

function damageTarget(
  state: RunnerState,
  target: Target,
  damage: number,
): void {
  const entity = target.rival ?? target.obstacle;
  if (!entity || target.rival?.defeated || target.obstacle?.destroyed) return;
  entity.hp = Math.max(0, entity.hp - damage);
  entity.hit = 0.15;
  if (entity.hp > 0) {
    effect(state, 'hit', target.x, target.y);
    return;
  }
  if (target.rival) {
    target.rival.defeated = true;
    state.defeated++;
  } else if (target.obstacle) {
    target.obstacle.destroyed = true;
  }
  const reward = target.rival ? 3 : 2;
  awardScrap(state, reward);
  effect(state, 'burst', target.x, target.y, `+${reward}`);
}

/** Distance along a ray to an expanded target rectangle, or no intersection. */
function rayHit(
  origin: { x: number; y: number },
  angle: number,
  range: number,
  target: Target,
  radius = 2,
): number | undefined {
  let near = 0;
  let far = range;
  const axes = [
    [
      origin.x,
      Math.cos(angle),
      target.x - target.width / 2 - radius,
      target.x + target.width / 2 + radius,
    ],
    [
      origin.y,
      Math.sin(angle),
      target.y - target.height / 2 - radius,
      target.y + target.height / 2 + radius,
    ],
  ];
  for (const [start = 0, direction = 0, low = 0, high = 0] of axes) {
    if (Math.abs(direction) < 1e-8) {
      if (start < low || start > high) return undefined;
      continue;
    }
    const enter = (low - start) / direction;
    const exit = (high - start) / direction;
    near = Math.max(near, Math.min(enter, exit));
    far = Math.min(far, Math.max(enter, exit));
    if (near > far) return undefined;
  }
  return near;
}

/** Small aiming help, not homing: an airborne cart cannot shoot straight down. */
function aimAt(
  state: RunnerState,
  muzzle: { x: number; y: number },
  target: Target,
  weapon: WeaponId,
): number | undefined {
  const dx = target.x - muzzle.x;
  if (dx < 0) return undefined;
  const heading = -playerTilt(state);
  const alongRoad = muzzle.y + Math.tan(heading) * dx;
  const bottom = target.y - target.height / 2;
  // Rail sights follow a shared chassis line, not a tall target's roof. Keep
  // the real beam shallow enough to pierce the shorter body behind it, too.
  const aimTop =
    bottom +
    (weapon === 'rail' ? Math.min(26, target.height - 4) : target.height - 2);
  const aimY = Math.max(bottom + 2, Math.min(aimTop, alongRoad));
  const angle = Math.atan2(aimY - muzzle.y, Math.max(1, dx));
  const assist = state.player.grounded
    ? weapon === 'flame'
      ? 0.85
      : 0.6
    : weapon === 'flame'
      ? 0.7
      : weapon === 'scatter' || weapon === 'rocket'
        ? 0.48
        : 0.32;
  return Math.abs(angle - heading) <= assist ? angle : undefined;
}

function addShot(
  state: RunnerState,
  muzzle: { x: number; y: number },
  endX: number,
  endY: number,
  weapon: WeaponId,
): void {
  state.shots.push({
    id: state.nextId++,
    x: muzzle.x,
    y: muzzle.y,
    endX,
    endY,
    life: weapon === 'flame' ? 0.11 : weapon === 'mine' ? 0.24 : 0.16,
    weapon,
  });
  if (state.shots.length > 40) state.shots.splice(0, state.shots.length - 40);
}

function fireWeapon(state: RunnerState, dt: number): void {
  const weapon = state.weapon;
  if (!weapon) return;
  weapon.cooldown = Math.max(0, weapon.cooldown - dt);
  // Exact cadence multiples (notably 0.1s flame at 120Hz) must not lose a
  // whole tick to a floating-point remainder. Timers still use real seconds.
  if (weapon.cooldown > 1e-9) return;
  const definition = WEAPONS[weapon.id];
  const muzzle = playerMuzzle(state);
  const targets = activeTargets(state);
  const inRange = targets
    .filter((target) => {
      const dx = target.x - state.distance;
      if (weapon.id === 'mine')
        return (
          dx >= -120 &&
          dx <= definition.range &&
          Math.abs(target.y - (state.player.y + 16)) <= 75
        );
      return dx >= 12 && dx <= definition.range;
    })
    .sort((a, b) =>
      weapon.id === 'mine'
        ? Math.abs(a.x - state.distance) - Math.abs(b.x - state.distance)
        : a.x - b.x,
    );
  const first = inRange.find(
    (target) =>
      weapon.id === 'mine' ||
      aimAt(state, muzzle, target, weapon.id) !== undefined,
  );
  if (!first) return;
  const angle = aimAt(state, muzzle, first, weapon.id) ?? 0;
  const damage =
    definition.damage *
    (1 + (weapon.level - 1) * 0.45) *
    (1 + (state.runLevel - 1) * 0.18);
  const fireRate =
    1 + (weapon.level - 1) * 0.13 + Math.min(12, state.runLevel - 1) * 0.08;
  weapon.cooldown = definition.cadence / fireRate;

  if (weapon.id === 'scatter') {
    // Five independent pellets: a close target catches more; a staggered cluster
    // catches the fan. Each pellet stops at its first crate or rival.
    const hits = new Map<Target, number>();
    for (const spread of [-0.18, -0.09, 0, 0.09, 0.18]) {
      const pelletAngle = angle + spread;
      const hit = inRange
        .map((target) => ({
          target,
          distance: rayHit(muzzle, pelletAngle, definition.range, target, 3),
        }))
        .filter((candidate) => candidate.distance !== undefined)
        .sort((a, b) => a.distance! - b.distance!)[0];
      const distance = hit?.distance ?? definition.range;
      addShot(
        state,
        muzzle,
        muzzle.x + Math.cos(pelletAngle) * distance,
        muzzle.y + Math.sin(pelletAngle) * distance,
        weapon.id,
      );
      if (hit) hits.set(hit.target, (hits.get(hit.target) ?? 0) + damage / 3);
    }
    let breached = false;
    for (const [target, pelletDamage] of hits) {
      damageTarget(state, target, pelletDamage);
      breached ||= !!(target.rival?.defeated || target.obstacle?.destroyed);
    }
    // One earned follow-up after the entire volley, never a refund per pellet.
    // Armored survivors keep the ordinary, deliberate shotgun reload.
    if (breached && definition.breachCadence !== undefined)
      weapon.cooldown = definition.breachCadence / fireRate;
  } else if (weapon.id === 'rail') {
    // A single consistent beam; targets above/below the beam are not pierced.
    for (const target of inRange)
      if (rayHit(muzzle, angle, definition.range, target, 7) !== undefined)
        damageTarget(state, target, damage);
    addShot(
      state,
      muzzle,
      muzzle.x + Math.cos(angle) * definition.range,
      muzzle.y + Math.sin(angle) * definition.range,
      weapon.id,
    );
  } else if (weapon.id === 'flame') {
    // Sustained short cone can clear several nearby bodies at different heights.
    for (const target of inRange) {
      const targetAngle = Math.atan2(target.y - muzzle.y, target.x - muzzle.x);
      if (
        Math.abs(targetAngle - angle) <= 0.43 ||
        rayHit(muzzle, angle, definition.range, target, 8) !== undefined
      )
        damageTarget(state, target, damage);
    }
    for (const spread of [-0.25, 0, 0.25])
      addShot(
        state,
        muzzle,
        muzzle.x + Math.cos(angle + spread) * definition.range,
        muzzle.y + Math.sin(angle + spread) * definition.range,
        weapon.id,
      );
  } else if (weapon.id === 'rocket' || weapon.id === 'mine') {
    // Blast radius is genuinely two-dimensional, including nearby crates.
    const radius = (weapon.id === 'mine' ? 110 : 92) + (weapon.level - 1) * 10;
    for (const target of targets)
      if (Math.hypot(target.x - first.x, target.y - first.y) <= radius)
        damageTarget(state, target, damage);
    addShot(state, muzzle, first.x, first.y, weapon.id);
    effect(state, 'burst', first.x, first.y);
  } else {
    damageTarget(state, first, damage);
    addShot(state, muzzle, first.x, first.y, weapon.id);
  }
}

/** Shields guard physical bodies only. Terrain falls/walls remain physics-owned. */
export function absorbContact(state: RunnerState): boolean {
  if (state.player.invulnerable > 0) return true;
  if (state.shield <= 0) return false;
  state.shield = 0;
  state.player.invulnerable = 1.25;
  notice(state, 'シールドが守った！ スクラップで回復');
  effect(state, 'burst', state.distance, state.player.y + 20, 'ガード');
  return true;
}

function endRun(state: RunnerState, reason: 'rival' | 'obstacle'): void {
  state.status = 'over';
  state.reason = reason;
  state.player.buffer = 0;
  effect(state, 'burst', state.distance, state.player.y + 18);
}

/** Called after movement and pickups. Fire before contact lets a gun save a lane. */
export function stepCombat(state: RunnerState, dt: number): void {
  if (state.status !== 'running') return;
  for (const obstacle of state.obstacles)
    obstacle.hit = Math.max(0, obstacle.hit - dt);
  for (const rival of state.rivals) {
    if (rival.x - state.distance <= rivalWarningDistance(state.speed))
      rival.age += dt;
    rival.hit = Math.max(0, rival.hit - dt);
    if (rival.defeated) continue;
    const road = state.platforms.find(
      (platform) =>
        rival.x >= platform.x && rival.x <= platform.x + platform.width,
    );
    if (road) {
      // Never teleport a newly spawned target backward on a short platform.
      rival.x = Math.min(
        rival.x + rival.speed * dt,
        Math.max(rival.x, road.x + road.width - 80),
      );
      rival.y = platformTopAt(road, rival.x);
    }
  }
  fireWeapon(state, dt);
  for (const obstacle of state.obstacles) {
    if (obstacle.destroyed) continue;
    if (
      Math.abs(state.distance - obstacle.x) <
        HALF_PLAYER + obstacle.width / 2 &&
      state.player.y < obstacle.top + obstacle.height - 1 &&
      state.player.y + PLAYER_HEIGHT > obstacle.top + 2
    ) {
      if (absorbContact(state)) {
        obstacle.destroyed = true;
        obstacle.hp = 0;
        effect(state, 'burst', obstacle.x, obstacle.top + obstacle.height / 2);
      } else {
        endRun(state, 'obstacle');
        return;
      }
    }
  }
  for (const rival of state.rivals) {
    if (rival.defeated || rival.age < RIVAL_WARNING_TIME) continue;
    const definition = RIVALS[rival.kind];
    if (
      Math.abs(rival.x - state.distance) < definition.width / 2 + HALF_PLAYER &&
      state.player.y < rival.y + definition.height - 2 &&
      state.player.y + PLAYER_HEIGHT > rival.y + 3 &&
      !absorbContact(state)
    ) {
      endRun(state, 'rival');
      return;
    }
  }
}
