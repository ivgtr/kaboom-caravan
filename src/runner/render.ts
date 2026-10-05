import { START_SPEED, MAX_SPEED } from './pacing';
import { RIVALS, WEAPONS } from './definitions';
import { RIVAL_WARNING_TIME } from './combat';
import type { RunnerArt } from './assets';
import {
  platformSlope,
  platformTopAt,
  platformsJoin,
  playerTilt,
  supportingPlatform,
} from './terrain';
import type { Platform, RunnerState } from './types';

export interface Viewport {
  width: number;
  height: number;
  scale: number;
  ground: number;
  anchor: number;
}
export function runnerViewport(width: number, height: number): Viewport {
  // Portrait keeps the same minimum reaction distance; landscape gets more sky, not faster physics.
  const worldWidth = Math.max(720, Math.min(2100, (width / height) * 540));
  const scale = width / worldWidth;
  const worldHeight = height / scale;
  return {
    width: worldWidth,
    height: worldHeight,
    scale,
    // Keep the entire -48..128px terrain band plus a full jump visible.
    // The camera never follows the hop, so the next landing stays still.
    ground: worldHeight * (width < height ? 0.64 : 0.8),
    anchor: 142,
  };
}

function sprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  flip = false,
) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(
    image,
    -width / 2,
    (-width * image.height) / image.width,
    width,
    (width * image.height) / image.width,
  );
  ctx.restore();
}
function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = '#fff9e9',
) {
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#163c49';
  ctx.strokeText(value, x, y);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function connectedRoads(platforms: readonly Platform[]): Platform[][] {
  const roads: Platform[][] = [];
  for (const platform of platforms) {
    const road = roads[roads.length - 1];
    const previous = road?.[road.length - 1];
    if (previous && platformsJoin(previous, platform)) road!.push(platform);
    else roads.push([platform]);
  }
  return roads;
}

const ROCK_REPEAT = 256;
const CAP_REPEAT = 512;
const CAP_DEPTH = 48;
interface TerrainPatterns {
  art: RunnerArt['terrain'];
  body: CanvasPattern;
  cap: CanvasPattern;
}
const terrainPatterns = new WeakMap<
  CanvasRenderingContext2D,
  TerrainPatterns
>();

function getTerrainPatterns(
  ctx: CanvasRenderingContext2D,
  art: RunnerArt['terrain'],
): TerrainPatterns {
  const cached = terrainPatterns.get(ctx);
  if (cached?.art === art) return cached;
  const patterns = {
    art,
    body: ctx.createPattern(art.body, 'repeat')!,
    cap: ctx.createPattern(art.cap, 'repeat-x')!,
  };
  patterns.cap.setTransform(
    new DOMMatrix().scale(
      CAP_REPEAT / art.cap.width,
      CAP_DEPTH / art.cap.height,
    ),
  );
  terrainPatterns.set(ctx, patterns);
  return patterns;
}

/** Tile painted rock inside the exact shared collision silhouette. */
function renderTerrain(
  ctx: CanvasRenderingContext2D,
  roads: readonly Platform[][],
  art: RunnerArt['terrain'],
  view: Viewport,
  camera: number,
) {
  const { width, height, ground } = view;
  const patterns = getTerrainPatterns(ctx, art);
  // Body UVs stay in world space, so rock size and phase never change on slopes.
  patterns.body.setTransform(
    new DOMMatrix([
      ROCK_REPEAT / art.body.width,
      0,
      0,
      ROCK_REPEAT / art.body.height,
      -camera,
      ground,
    ]),
  );
  for (const road of roads) {
    const first = road[0]!;
    const last = road[road.length - 1]!;
    const left = first.x - camera;
    const right = last.x + last.width - camera;
    if (left > width || right < 0) continue;
    const points = road.map((platform) => ({
      x: platform.x - camera,
      y: ground - platform.top,
    }));
    points.push({
      x: right,
      y: ground - platformTopAt(last, last.x + last.width),
    });
    const start = points[0]!;
    const end = points[points.length - 1]!;
    const topPath = () => {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < points.length; i++)
        ctx.lineTo(points[i]!.x, points[i]!.y);
    };
    ctx.save();
    topPath();
    ctx.lineTo(right, height);
    ctx.lineTo(left, height);
    ctx.closePath();
    ctx.clip();
    const fillLeft = Math.max(0, left);
    const fillRight = Math.min(width, right);
    const fillTop = Math.max(0, Math.min(...points.map((point) => point.y)));
    ctx.fillStyle = patterns.body;
    ctx.fillRect(fillLeft, fillTop, fillRight - fillLeft, height - fillTop);

    ctx.fillStyle = patterns.cap;
    for (const platform of road) {
      if (platform.x > camera + width || platform.x + platform.width < camera)
        continue;
      const slope = platformSlope(platform);
      ctx.save();
      // Map (world x, depth) onto the surface. Adjacent slopes share both the
      // horizontal texture phase and depth at their join, even at a crest.
      ctx.transform(
        1,
        -slope,
        0,
        1,
        -camera,
        ground - platform.top + slope * platform.x,
      );
      // A half-pixel overlap removes raster seams only between joined pieces.
      // The shared road clip still stops every image exactly at a real ledge.
      const capLeft = Math.max(platform.x - 0.5, camera);
      const capRight = Math.min(
        platform.x + platform.width + 0.5,
        camera + width,
      );
      ctx.fillRect(capLeft, 0, capRight - capLeft, CAP_DEPTH);
      ctx.restore();
    }

    // A restrained contact glint and edge shade keep small landings legible;
    // both are clipped inside the artwork, never above or across a real gap.
    topPath();
    ctx.strokeStyle = '#f5e4b766';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const edgeWidth = Math.min(3, (right - left) * 0.08);
    ctx.fillStyle = '#153d3b3d';
    ctx.fillRect(left, start.y, edgeWidth, height - start.y);
    ctx.fillRect(right - edgeWidth, end.y, edgeWidth, height - end.y);
    ctx.restore();
  }
}

/** Marks the actual last failed edge, without inventing a recommended arc. */
function renderFailure(
  ctx: CanvasRenderingContext2D,
  state: RunnerState,
  view: Viewport,
  camera: number,
) {
  if (state.status !== 'over' || !state.failure) return;
  const failure = state.failure;
  const sx = (x: number) => x - camera;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffc38e';
  ctx.fillStyle = '#ffc38e';
  if (failure.takeoffX !== null && failure.kind !== 'collision') {
    const x = sx(failure.takeoffX);
    const y = view.ground - failure.takeoffY;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(x, y - 3, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (
    failure.targetX !== null &&
    failure.targetY !== null &&
    failure.kind !== 'collision'
  ) {
    const x = sx(failure.targetX);
    const y = view.ground - failure.targetY;
    ctx.globalAlpha = 0.85;
    // A corner bracket highlights the real near edge, above the painted cap.
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 17);
    ctx.lineTo(x - 7, y - 7);
    ctx.lineTo(x + 23, y - 7);
    ctx.stroke();
    if (failure.kind === 'overshot' && failure.targetEnd !== null) {
      const end = sx(failure.targetEnd);
      const target = state.platforms.find(
        (platform) =>
          Math.abs(platform.x + platform.width - failure.targetEnd!) < 1,
      );
      const endY = target
        ? view.ground - platformTopAt(target, failure.targetEnd)
        : y;
      ctx.beginPath();
      ctx.moveTo(end - 23, endY - 7);
      ctx.lineTo(end + 7, endY - 7);
      ctx.lineTo(end + 7, endY + 17);
      ctx.stroke();
    }
  }
  const impactX = sx(failure.x);
  const impactY = view.ground - failure.y;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(impactX, impactY, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A few near-camera dust flecks establish speed while leaving landings clear. */
function renderForeground(
  ctx: CanvasRenderingContext2D,
  state: RunnerState,
  view: Viewport,
  reducedMotion: boolean,
) {
  if (reducedMotion || state.status !== 'running') return;
  const pace = Math.max(
    0,
    Math.min(1, (state.speed - START_SPEED) / (MAX_SPEED - START_SPEED)),
  );
  const span = view.width + 180;
  ctx.save();
  ctx.strokeStyle = '#f8df9a';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x =
      ((((i * 173.3 - state.distance * (1.15 + i * 0.027)) % span) + span) %
        span) -
      90;
    const y =
      view.ground +
      88 +
      ((i * 53) % Math.max(70, view.height - view.ground - 70));
    ctx.globalAlpha = 0.09 + (i % 3) * 0.025;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 9 + pace * 10, y - 1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Painted wheel positions, measured from the trimmed 897 × 667 chassis art. */
function renderWheelMotion(
  ctx: CanvasRenderingContext2D,
  distance: number,
  reducedMotion: boolean,
) {
  const angle = reducedMotion ? 0 : distance / 5.9;
  for (const x of [-13.54, 13.53]) {
    ctx.save();
    ctx.translate(x, -5.99);
    ctx.rotate(angle);
    ctx.strokeStyle = '#f9dea1bb';
    ctx.lineWidth = 0.85;
    // Draw only on the existing painted hub. No replacement wheels or chassis.
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.moveTo(1.2, 0);
      ctx.lineTo(3.1, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function renderExhaust(
  ctx: CanvasRenderingContext2D,
  state: RunnerState,
  reducedMotion: boolean,
) {
  if (state.status !== 'running' || reducedMotion) return;
  const lifting = !state.player.grounded && state.player.vy > 0;
  const held = lifting && state.player.holding;
  const pulse = 0.7 + Math.sin(state.time * 37) * 0.3;
  const length = held ? 21 : lifting ? 14 : 8;
  ctx.save();
  ctx.globalAlpha = held ? 0.8 : 0.45;
  const plume = ctx.createLinearGradient(-23, -24, -23 - length, -24);
  plume.addColorStop(0, held ? '#fff2bb' : '#acede3');
  plume.addColorStop(0.4, held ? '#ffa65f' : '#79bfc0');
  plume.addColorStop(1, '#79bfc000');
  ctx.fillStyle = plume;
  ctx.beginPath();
  ctx.moveTo(-23, -28);
  ctx.quadraticCurveTo(-29, -29, -23 - length * pulse, -25);
  ctx.quadraticCurveTo(-30, -22, -23, -23);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function renderShot(
  ctx: CanvasRenderingContext2D,
  shot: RunnerState['shots'][number],
  ground: number,
  camera: number,
  reducedMotion: boolean,
) {
  const x = shot.x - camera;
  const y = ground - shot.y;
  const endX = shot.endX - camera;
  const endY = ground - shot.endY;
  const color = WEAPONS[shot.weapon].color;
  ctx.save();
  ctx.globalAlpha = Math.min(1, shot.life * 8);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  if (shot.weapon === 'flame') {
    const gradient = ctx.createLinearGradient(x, y, endX, endY);
    gradient.addColorStop(0, '#fff1ad');
    gradient.addColorStop(0.6, '#ffb75fa8');
    gradient.addColorStop(1, '#ee744000');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = reducedMotion ? 6 : 10;
  } else {
    ctx.lineWidth =
      shot.weapon === 'rail' ? 4 : shot.weapon === 'scatter' ? 2.5 : 2;
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  if (shot.weapon === 'mine') {
    ctx.setLineDash([3, 5]);
    ctx.quadraticCurveTo((x + endX) / 2, Math.min(y, endY) - 32, endX, endY);
  } else if (shot.weapon === 'rocket') {
    ctx.setLineDash([8, 5]);
    ctx.lineTo(endX, endY);
  } else {
    ctx.lineTo(endX, endY);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  if (shot.weapon === 'rail') {
    ctx.strokeStyle = '#fff7ff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (shot.weapon === 'rocket' || shot.weapon === 'mine') {
    ellipse(ctx, endX, endY, shot.weapon === 'rocket' ? 5 : 4, 4, color);
    ellipse(ctx, endX, endY, 2, 2, '#fff2c6');
  }
  // A tiny flash locates the muzzle, including when the body leans on a ramp.
  ellipse(ctx, x, y, shot.weapon === 'scatter' ? 4 : 2.5, 2.5, '#fff4cb');
  ctx.restore();
}

export function renderRunner(
  ctx: CanvasRenderingContext2D,
  state: RunnerState,
  art: RunnerArt,
  view: Viewport,
  reducedMotion: boolean,
) {
  const { width, height, ground, anchor } = view;
  const camera = state.distance - anchor;
  const sx = (x: number) => x - camera;
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, '#49bde0');
  sky.addColorStop(0.68, '#bcebd6');
  sky.addColorStop(1, '#ffdf9c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const bgHeight = ground + 2;
  const sourceHeight = art.background.height * 0.65;
  const bgWidth = (bgHeight * art.background.width) / sourceHeight;
  const bgOffset =
    (state.distance * (reducedMotion ? 0.075 : 0.13)) % (bgWidth * 2);
  ctx.save();
  ctx.globalAlpha = 0.78;
  for (let i = -1; i < 4; i++) {
    const x = i * bgWidth - bgOffset;
    ctx.save();
    ctx.translate(x + (i % 2 ? bgWidth : 0), ground - bgHeight);
    if (i % 2) ctx.scale(-1, 1);
    ctx.drawImage(
      art.background,
      0,
      0,
      art.background.width,
      sourceHeight,
      0,
      0,
      bgWidth,
      bgHeight,
    );
    ctx.restore();
  }
  ctx.restore();
  // Cool ravine separates holes from the warm, solid road.
  const ravine = ctx.createLinearGradient(0, ground, 0, height);
  ravine.addColorStop(0, '#5b9184');
  ravine.addColorStop(0.15, '#356575');
  ravine.addColorStop(1, '#163c53');
  ctx.fillStyle = ravine;
  ctx.fillRect(0, ground - 2, width, height - ground + 2);
  const roads = connectedRoads(state.platforms);
  renderTerrain(ctx, roads, art.terrain, view, camera);
  for (const obstacle of state.obstacles) {
    if (obstacle.destroyed) continue;
    const x = sx(obstacle.x),
      y = ground - obstacle.top;
    ellipse(ctx, x, y + 1, obstacle.width * 0.47, 3, '#183e4438');
    // Keep the painted supply box inside the existing collision bounds.
    ctx.drawImage(
      art.crate,
      x - obstacle.width / 2,
      y - obstacle.height,
      obstacle.width,
      obstacle.height,
    );
  }
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    const x = sx(pickup.x),
      y = ground - pickup.y;
    if (x < -80 || x > width + 80) continue;
    const bob = reducedMotion ? 0 : Math.sin(state.time * 3.5 + pickup.id) * 3;
    if (pickup.kind === 'scrap') {
      // Keep the familiar guide spacing and footprint with actual salvage art.
      const size = 20;
      const h = (size * art.scrap.height) / art.scrap.width;
      ctx.drawImage(art.scrap, x - size / 2, y - h / 2 + bob, size, h);
    } else {
      const color = pickup.weapon ? WEAPONS[pickup.weapon].color : '#9fffe6';
      ellipse(ctx, x, y + 27, 20, 3, '#244d4730');
      const img = pickup.weapon
        ? art.weapons[pickup.weapon]
        : pickup.kind === 'shield'
          ? art.shield
          : art.magnet;
      const size = 45;
      const h = (size * img.height) / img.width;
      ctx.drawImage(img, x - size / 2, y - h / 2 + bob, size, h);
      text(
        ctx,
        pickup.weapon
          ? `${WEAPONS[pickup.weapon].label}${state.weapon?.id === pickup.weapon ? (state.weapon.level === 3 ? ' ↻' : ' ↑') : ''}`
          : pickup.kind === 'shield'
            ? '+1'
            : '磁石',
        x,
        y - 36 + bob,
        18,
        color,
      );
    }
  }
  for (const rival of state.rivals) {
    const x = sx(rival.x),
      y = ground - rival.y;
    if (x < -120 || x > width + 120) continue;
    const telegraph = rival.age < RIVAL_WARNING_TIME;
    const size = rival.kind === 'heavy' || rival.kind === 'fortress' ? 82 : 67;
    ellipse(ctx, x, y + 2, size * 0.4, 6, '#183e4438');
    ctx.save();
    ctx.globalAlpha = rival.defeated
      ? Math.max(0, rival.hit / 0.45)
      : telegraph
        ? 0.58
        : 1;
    const bounce = reducedMotion
      ? 0
      : Math.sin(rival.age * 16) * (rival.kind === 'rusher' ? 4 : 2);
    const pose = rival.defeated ? 3 : Math.floor(rival.age * 6) % 2;
    sprite(ctx, art.rivals[rival.kind][pose]!, x, y + bounce, size, true);
    ctx.restore();
    if (!rival.defeated) {
      // A high-speed warning may begin just outside portrait view. Keep the
      // active cue visible at the edge instead of counting unseen warning time.
      if (telegraph && rival.age > 0)
        text(
          ctx,
          '!',
          Math.min(x, width - 16),
          y - size - 13,
          27,
          RIVALS[rival.kind].color,
        );
      if (rival.hp < rival.maxHp) {
        ctx.fillStyle = '#244a48';
        ctx.fillRect(x - 17, y - size - 2, 34, 4);
        ctx.fillStyle = '#ffc460';
        ctx.fillRect(x - 17, y - size - 2, (34 * rival.hp) / rival.maxHp, 4);
      }
    }
  }
  for (const shot of state.shots)
    renderShot(ctx, shot, ground, camera, reducedMotion);
  const foot = ground - state.player.y;
  const support = state.player.grounded
    ? supportingPlatform(state)
    : state.platforms.find(
        (platform) =>
          state.distance >= platform.x &&
          state.distance <= platform.x + platform.width &&
          state.player.y >= platformTopAt(platform, state.distance),
      );
  if (support) {
    const top = platformTopAt(support, state.distance);
    const clearance = Math.max(0, state.player.y - top);
    ctx.save();
    // Keep the shadow on the actual stone, not suspended across either gap.
    const road = roads.find((segments) => segments.includes(support))!;
    const first = road[0]!;
    const last = road[road.length - 1]!;
    const left = first.x - camera;
    const right = last.x + last.width - camera;
    ctx.beginPath();
    ctx.moveTo(left, ground - first.top);
    for (const segment of road)
      ctx.lineTo(
        segment.x + segment.width - camera,
        ground - platformTopAt(segment, segment.x + segment.width),
      );
    ctx.lineTo(right, height);
    ctx.lineTo(left, height);
    ctx.closePath();
    ctx.clip();
    ctx.translate(anchor, ground - top + 3);
    ctx.rotate(-Math.atan(platformSlope(support)));
    ellipse(ctx, 0, 0, 23 - Math.min(9, clearance * 0.06), 4, '#163e4438');
    ctx.restore();
  }
  if (!reducedMotion && state.status === 'running' && state.player.grounded) {
    // Three short-lived contact wisps, behind the tires and above the surface.
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const phase = (state.distance / 31 + i / 3) % 1;
      ctx.globalAlpha = (1 - phase) * 0.24;
      ellipse(
        ctx,
        anchor - 18 - phase * 31,
        foot - 2 - phase * 5,
        3 + phase * 5,
        1.5 + phase * 2,
        '#f9e2b4',
      );
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(anchor, foot);
  // Contact, body, roof mount and the simulation muzzle share this transform.
  ctx.rotate(playerTilt(state));
  const squash = reducedMotion ? 0 : state.player.squash;
  ctx.scale(1 + squash * 0.07, 1 - squash * 0.1);
  renderExhaust(ctx, state, reducedMotion);
  // A soft grace-period pulse keeps the body and wheel contact legible.
  // The guard spark and HUD already communicate the hit; never hide the car.
  ctx.globalAlpha =
    state.player.invulnerable > 0 && !reducedMotion
      ? 0.875 + Math.sin(state.time * Math.PI * 12) * 0.125
      : 1;
  // Wheelbase, rather than the long front overhang, is centred on collision.
  sprite(ctx, art.player, 10, 0, 68);
  renderWheelMotion(ctx, state.distance, reducedMotion);
  if (state.weapon) {
    sprite(ctx, art.weapons[state.weapon.id], 6, -46, 29);
  }
  ctx.restore();
  for (const effect of state.effects) {
    const fraction = Math.max(0, effect.life / effect.maxLife);
    const x = sx(effect.x),
      y = ground - effect.y;
    ctx.save();
    ctx.globalAlpha = fraction;
    // Equipment already has one HUD notice; another label here would cover
    // the mounted weapon during high jumps on a short landscape screen.
    if (effect.kind === 'guard') {
      // A directional flash only when contact consumes a guard, never an aura.
      const size = reducedMotion ? 32 : 44;
      ctx.globalAlpha = Math.min(1, fraction * 1.8);
      sprite(ctx, art.effects.guard, x + 27, y + 17, size);
    } else if (effect.kind === 'hit' || effect.kind === 'burst') {
      const image = art.effects[effect.kind];
      const size =
        (effect.kind === 'hit' ? 24 : 42) *
        (reducedMotion ? 1 : 0.85 + (1 - fraction) * 0.15);
      ctx.globalAlpha = fraction * fraction;
      sprite(ctx, image, x, y + (size * image.height) / image.width / 2, size);
      if (effect.text) {
        ctx.globalAlpha = fraction;
        text(ctx, effect.text, x, y - (1 - fraction) * 30 - 35, 16, '#fff0aa');
      }
    } else if (
      effect.text &&
      effect.kind !== 'pickup' &&
      effect.kind !== 'recover'
    )
      text(ctx, effect.text, x, y - (1 - fraction) * 30 - 45, 16, '#fff0aa');
    else if (effect.kind === 'jump' || effect.kind === 'land') {
      const landing = effect.kind === 'land';
      const count = reducedMotion ? 1 : landing ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const offset = i - (count - 1) / 2;
        ellipse(
          ctx,
          x + offset * (12 + (1 - fraction) * 17),
          y - 2 - (reducedMotion ? 0 : (1 - fraction) * 6),
          (landing ? 7 : 4) * fraction,
          2.5 * fraction,
          '#fff0bb',
        );
      }
    } else if (effect.kind !== 'recover') {
      const count = reducedMotion ? 2 : 4;
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count;
        const spread = reducedMotion ? 5 : (1 - fraction) * 27;
        ellipse(
          ctx,
          x + Math.cos(angle) * spread,
          y + Math.sin(angle) * spread,
          fraction * 3.5,
          fraction * 3.5,
          '#ffdc79',
        );
      }
    }
    ctx.restore();
  }
  renderFailure(ctx, state, view, camera);
  renderForeground(ctx, state, view, reducedMotion);
  // A subtle vignette grounds the composition without covering the jump path.
  const bottom = ctx.createLinearGradient(0, height - 110, 0, height);
  bottom.addColorStop(0, '#12334200');
  bottom.addColorStop(1, '#123342a8');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, height - 110, width, 110);
}
