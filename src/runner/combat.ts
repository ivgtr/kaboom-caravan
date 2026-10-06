import { RIVALS, WEAPONS } from './definitions';
import { START_SPEED } from './pacing';
import {
  awardScore,
  feverEvent,
  openChest,
  registerDestruction,
} from './fever';
import {
  platformsJoin,
  platformTopAt,
  playerMuzzle,
  playerTilt,
} from './terrain';
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
export const BOMBER_BLAST_RADIUS = 190;
export const BOMBER_BLAST_DAMAGE = 6;
export const AWAKENED_BOOST_RADIUS = 155;
export const AWAKENED_BOOST_PULSE_RADIUS = 245;
export const AWAKENED_GOLD_RADIUS = 1120;
export const AWAKENED_GOLD_PULSE_RADIUS = 1750;
const HALF_PLAYER = PLAYER_WIDTH / 2;
const MAX_CONTACT_DISTANCE =
  HALF_PLAYER +
  Math.max(...Object.values(RIVALS).map((rival) => rival.width / 2));
function rusherChargeSpeed(speed: number): number {
  return Math.max(75, Math.min(140, speed * 0.22));
}

/** Give every body a real-time approach window as the road accelerates. */
export function rivalWarningDistance(
  speed: number,
  kind: Rival['kind'] = 'basic',
): number {
  const ordinary = Math.max(
    500,
    speed * RIVAL_WARNING_LEAD_TIME + MAX_CONTACT_DISTANCE,
  );
  // A rusher must finish its full warning before the ordinary machine gun can
  // erase it. Reserve 0.3s of visible oncoming motion before entering gun range.
  return kind === 'rusher'
    ? Math.max(
        ordinary,
        speed * RIVAL_WARNING_TIME +
          WEAPONS.machine.range +
          (speed + rusherChargeSpeed(speed)) * 0.3,
      )
    : ordinary;
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
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.scrap = Math.min(1_000_000, state.scrap + amount);
  awardScore(state, amount * 12, 'loot');
  let grew = false;
  while (state.scrap >= state.nextScrapLevel && state.runLevel < 100) {
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
  if (pickup.kind === 'chest') {
    openChest(state);
    effect(state, 'chest', pickup.x, pickup.y, 'CHEST!');
    return;
  }
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

/** Kill accounting is atomic; each defeated bomber adds one finite blast job. */
function damageBody(
  state: RunnerState,
  target: Target,
  damage: number,
  blasts: { x: number; y: number }[],
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
  const reward = target.rival ? RIVALS[target.rival.kind].scrap : 2;
  awardScrap(state, reward);
  registerDestruction(state, target.x, target.y, entity.golden);
  effect(
    state,
    entity.golden ? 'gold' : 'burst',
    target.x,
    target.y,
    `+${Math.round(80 * state.fever.multiplier)}`,
  );
  if (entity.golden && state.fever.abilities.gold > 0) {
    // Infection visits existing bodies only. Destruction never creates another body.
    const radius =
      state.fever.awakening.gold > 0
        ? 1000
        : 260 + Math.min(20, state.fever.abilities.gold) * 16;
    for (const next of activeTargets(state)) {
      if (Math.hypot(next.x - target.x, next.y - target.y) <= radius) {
        const body = next.rival ?? next.obstacle;
        if (body) body.golden = true;
      }
    }
  }
  if (target.rival?.kind === 'bomber') {
    effect(state, 'burst', target.x, target.y, 'CHAIN BLAST');
    state.effects[state.effects.length - 1]!.radius = BOMBER_BLAST_RADIUS;
    // Infection precedes the explosion, preserving real golden chain rewards.
    blasts.push({ x: target.x, y: target.y });
  }
}

function damageTarget(
  state: RunnerState,
  target: Target,
  damage: number,
): void {
  const blasts: { x: number; y: number }[] = [];
  damageBody(state, target, damage, blasts);
  // No recursive calls: every job belongs to one already-defeated real bomber.
  // Each body can earn rewards once even when multiple blast areas overlap.
  for (let index = 0; index < blasts.length; index++) {
    const blast = blasts[index]!;
    for (const next of activeTargets(state)) {
      if (Math.hypot(next.x - blast.x, next.y - blast.y) <= BOMBER_BLAST_RADIUS)
        damageBody(state, next, BOMBER_BLAST_DAMAGE, blasts);
    }
  }
}

/** MAX BOOST reaches ahead of contact but never touches terrain or jump physics. */
function awakenedBoost(state: RunnerState, fresh: boolean): void {
  const radius = fresh ? AWAKENED_BOOST_PULSE_RADIUS : AWAKENED_BOOST_RADIUS;
  const x = state.distance + (fresh ? 220 : 160);
  const y = state.player.y + PLAYER_HEIGHT / 2;
  const targets = activeTargets(state).filter(
    (target) =>
      target.x >= state.distance &&
      Math.hypot(target.x - x, target.y - y) <= radius &&
      // A bonus cannot silently erase a rusher before its established telegraph.
      !(
        target.rival?.kind === 'rusher' && target.rival.age < RIVAL_WARNING_TIME
      ),
  );
  if (fresh || targets.length > 0) {
    effect(state, 'burst', x, y, 'MAX BOOST');
    state.effects[state.effects.length - 1]!.radius = radius;
  }
  for (const target of targets) {
    const body = target.rival ?? target.obstacle;
    if (body) damageTarget(state, target, body.hp);
  }
}

/** Each fresh draw transforms the group now present, even during a prior awakening. */
function goldenWave(state: RunnerState, fresh: boolean): void {
  const radius = fresh
    ? AWAKENED_GOLD_PULSE_RADIUS
    : state.fever.awakening.gold > 0
      ? AWAKENED_GOLD_RADIUS
      : 600 + Math.min(20, state.fever.abilities.gold) * 12;
  for (const target of activeTargets(state)) {
    if (
      Math.hypot(target.x - state.distance, target.y - state.player.y) <= radius
    ) {
      const body = target.rival ?? target.obstacle;
      if (body && !body.golden) {
        body.golden = true;
        if (fresh) effect(state, 'gold', target.x, target.y);
      }
    }
  }
  if (fresh)
    effect(state, 'gold', state.distance, state.player.y + 24, 'MAX GOLD');
}

/** Follow every connected slope, stopping short of a real ledge, in either direction. */
function moveRival(state: RunnerState, rival: Rival, dt: number): void {
  let road = state.platforms.find(
    (platform) =>
      rival.x >= platform.x && rival.x <= platform.x + platform.width,
  );
  if (!road) return;
  const destination = rival.x + rival.speed * dt;
  const forward = rival.speed >= 0;
  // A generated island can have several short, joined terrain segments. The
  // eighty-pixel safety margin belongs only to its open ends, never each seam.
  for (let segment = 0; segment <= state.platforms.length; segment++) {
    const next = state.platforms.find((platform) =>
      forward ? platformsJoin(road!, platform) : platformsJoin(platform, road!),
    );
    const edge = forward ? road.x + road.width : road.x;
    const crossesEdge = forward ? destination > edge : destination < edge;
    if (next && crossesEdge) {
      road = next;
      continue;
    }
    rival.x = next
      ? destination
      : forward
        ? Math.min(destination, Math.max(rival.x, edge - 80))
        : Math.max(destination, Math.min(rival.x, edge + 80));
    rival.y = platformTopAt(road, rival.x);
    return;
  }
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

/** Landing, not a timer, triggers the build's area attack. */
export function landingBlast(state: RunnerState): void {
  const f = state.fever;
  // Physics can land before stepCombat in the reward's first world tick. Apply
  // the newly earned group conversion before that landing destroys its bodies.
  if (
    f.abilities.gold > 0 &&
    f.awakening.gold > 0 &&
    f.awakeningSerial.gold > f.awakeningSeen.gold
  ) {
    goldenWave(state, true);
    f.awakeningSeen.gold = f.awakeningSerial.gold;
  }
  const level = f.abilities.slam;
  const awakened = level > 0 && f.awakening.slam > 0;
  const charged = awakened && f.awakeningSerial.slam > f.awakeningSeen.slam;
  const speedFactor = Math.max(0, Math.min(4, state.speed / START_SPEED - 1));
  const radius =
    level > 0 ? 235 + Math.min(12, level) * 32 + speedFactor * 35 : 68;
  const damage =
    (level > 0 ? (6 + level * 2) * (1 + speedFactor * 0.12) : 2) *
    (awakened ? 1.8 : 1);
  const blasts = [{ x: state.distance, y: state.player.y, radius }];
  if (awakened) {
    f.awakeningSeen.slam = f.awakeningSerial.slam;
    // Every fresh MAX draw charges the next actual landing with one extra echo.
    // Coalesced draws never exceed four centers or fire without landing input.
    // These finite steps follow the road; overlapping areas damage each body once.
    for (const step of charged ? [1, 2, 3] : [1, 2]) {
      const x = state.distance + radius * 0.78 * step;
      const platform = state.platforms.find(
        (road) => x >= road.x && x <= road.x + road.width,
      );
      blasts.push({
        x,
        y: platform ? platformTopAt(platform, x) : state.player.y,
        radius: Math.min(360, radius * 0.58),
      });
    }
  }
  if (level > 0) {
    for (const blast of blasts) {
      effect(
        state,
        'slam',
        blast.x,
        blast.y,
        charged
          ? 'MAX LANDING ECHO'
          : awakened
            ? 'MAX LANDING CHAIN'
            : `LANDING BOMB ×${level}`,
      );
      state.effects[state.effects.length - 1]!.radius = blast.radius;
    }
    feverEvent(
      state,
      'slam',
      charged
        ? 'MAX LANDING ECHO'
        : awakened
          ? 'MAX LANDING CHAIN'
          : 'LANDING BOMB',
      radius,
    );
  }
  for (const target of activeTargets(state)) {
    if (
      blasts.some(
        (blast) =>
          Math.hypot(target.x - blast.x, target.y - blast.y) <= blast.radius,
      )
    )
      damageTarget(state, target, damage);
  }
}

/** Shields guard physical bodies only. Terrain falls/walls remain physics-owned. */
export function absorbContact(state: RunnerState): boolean {
  if (state.player.invulnerable > 0) return true;
  if (state.shield <= 0) return false;
  state.shield = 0;
  state.player.invulnerable = 1.25;
  notice(state, 'シールドが守った！ スクラップで回復');
  effect(state, 'guard', state.distance, state.player.y + 24);
  const flash = state.effects[state.effects.length - 1]!;
  flash.life = flash.maxLife = 0.22;
  return true;
}

function endRun(state: RunnerState, reason: 'rival' | 'obstacle'): void {
  state.status = 'over';
  state.reason = reason;
  state.player.buffer = 0;
  effect(state, 'burst', state.distance, state.player.y + 18);
}

/** Called after movement and pickups. Fire before contact lets a gun save a lane. */
export function stepCombat(
  state: RunnerState,
  dt: number,
  oldX = state.distance,
  oldY = state.player.y,
): void {
  if (state.status !== 'running' || state.fever.freeze > 0) return;
  const f = state.fever;
  const freshGold =
    f.awakening.gold > 0 && f.awakeningSerial.gold > f.awakeningSeen.gold;
  if (f.abilities.gold > 0) goldenWave(state, freshGold);
  f.awakeningSeen.gold = f.awakeningSerial.gold;
  const sweptBody = (
    x: number,
    y: number,
    width: number,
    height: number,
    previousX = x,
    previousY = y,
  ): boolean => {
    const reach = width / 2 + HALF_PLAYER;
    const start = oldX - previousX;
    const end = state.distance - x;
    const travel = end - start;
    if (Math.abs(travel) < 1e-9 && Math.abs(start) > reach) return false;
    const first = travel === 0 ? 0 : (-reach - start) / travel;
    const last = travel === 0 ? 1 : (reach - start) / travel;
    const enter = Math.max(0, Math.min(first, last));
    const leave = Math.min(1, Math.max(first, last));
    if (enter > leave) return false;
    const startFeet = oldY - previousY;
    const feetTravel = state.player.y - y - startFeet;
    const feet = startFeet + feetTravel * enter;
    const endFeet = startFeet + feetTravel * leave;
    return (
      Math.min(feet, endFeet) < height - 1 &&
      Math.max(feet, endFeet) + PLAYER_HEIGHT > 2
    );
  };
  for (const obstacle of state.obstacles)
    obstacle.hit = Math.max(0, obstacle.hit - dt);
  const previousRivals = new Map<number, { x: number; y: number }>();
  for (const rival of state.rivals) {
    if (
      rival.x - state.distance <=
      rivalWarningDistance(state.speed, rival.kind)
    )
      rival.age += dt;
    rival.hit = Math.max(0, rival.hit - dt);
    if (rival.defeated) continue;
    previousRivals.set(rival.id, { x: rival.x, y: rival.y });
    if (rival.kind === 'rusher') {
      // Let the warning finish before the oncoming motion starts. At top speed
      // the charge remains bounded rather than erasing the player's jump window.
      rival.speed =
        rival.age >= RIVAL_WARNING_TIME ? -rusherChargeSpeed(state.speed) : 0;
      moveRival(
        state,
        rival,
        Math.min(dt, Math.max(0, rival.age - RIVAL_WARNING_TIME)),
      );
    } else moveRival(state, rival, dt);
  }
  if (f.awakening.boost > 0)
    awakenedBoost(state, f.awakeningSerial.boost > f.awakeningSeen.boost);
  f.awakeningSeen.boost = f.awakeningSerial.boost;
  fireWeapon(state, dt);
  for (const obstacle of state.obstacles) {
    if (obstacle.destroyed) continue;
    if (sweptBody(obstacle.x, obstacle.top, obstacle.width, obstacle.height)) {
      if (
        (state.fever.abilities.boost > 0 && state.speed >= 480) ||
        absorbContact(state)
      ) {
        damageTarget(
          state,
          {
            id: obstacle.id,
            x: obstacle.x,
            y: obstacle.top + obstacle.height / 2,
            width: obstacle.width,
            height: obstacle.height,
            obstacle,
          },
          obstacle.hp,
        );
      } else {
        endRun(state, 'obstacle');
        return;
      }
    }
  }
  for (const rival of state.rivals) {
    if (rival.defeated || rival.age < RIVAL_WARNING_TIME) continue;
    const definition = RIVALS[rival.kind];
    const previous = previousRivals.get(rival.id)!;
    if (
      !sweptBody(
        rival.x,
        rival.y,
        definition.width,
        definition.height,
        previous.x,
        previous.y,
      )
    )
      continue;
    if (state.fever.abilities.boost > 0 && state.speed >= 480) {
      damageTarget(
        state,
        {
          id: rival.id,
          x: rival.x,
          y: rival.y + definition.height / 2,
          width: definition.width,
          height: definition.height,
          rival,
        },
        rival.hp,
      );
    } else if (!absorbContact(state)) {
      endRun(state, 'rival');
      return;
    }
  }
}
