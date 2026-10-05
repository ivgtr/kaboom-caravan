import { START_SPEED, MAX_SPEED } from './pacing';
import { RIVALS, WEAPONS } from './definitions';
import { RIVAL_WARNING_TIME } from './combat';
import {
  ABILITY_LABELS,
  JACKPOT_FREEZE,
  MAX_ABILITY_LEVEL,
  REEL_FIRST_REVEAL,
} from './fever';
import type { RunnerArt } from './assets';
import {
  platformSlope,
  platformTopAt,
  platformsJoin,
  playerTilt,
  supportingPlatform,
} from './terrain';
import type { AbilityId, Platform, RunnerState } from './types';

export interface Viewport {
  width: number;
  height: number;
  scale: number;
  ground: number;
  anchor: number;
}
export function runnerViewport(
  width: number,
  height: number,
  speed = START_SPEED,
): Viewport {
  // Portrait keeps the same minimum reaction distance; landscape gets more sky, not faster physics.
  const ahead = Math.min(1.42, 1 + Math.max(0, speed - 440) / 1800);
  const worldWidth =
    Math.max(820, Math.min(2400, (width / height) * 570)) * ahead;
  const scale = width / worldWidth;
  const worldHeight = height / scale;
  return {
    width: worldWidth,
    height: worldHeight,
    scale,
    // Keep the entire -48..128px terrain band plus a full jump visible.
    // The camera never follows the hop, so the next landing stays still.
    ground: worldHeight * (width < height ? 0.69 : 0.8),
    anchor: Math.max(142, worldWidth * 0.15),
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
  art: RunnerArt,
  reducedMotion: boolean,
) {
  if (state.status !== 'running') return;
  const boost = state.fever.abilities.boost;
  if (boost > 0) {
    const pulse = reducedMotion ? 1 : 0.94 + Math.sin(state.time * 35) * 0.06;
    const width =
      (48 + Math.min(8, boost) * 10 + (state.fever.hyperTime > 0 ? 30 : 0)) *
      pulse;
    ctx.save();
    ctx.translate(-24, -22);
    ctx.scale(-1, 1);
    ctx.globalAlpha = reducedMotion ? 0.72 : 0.95;
    ctx.drawImage(art.fever.trail, 0, -width * 0.16, width, width * 0.32);
    ctx.restore();
    return;
  }
  if (reducedMotion) return;
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

const ABILITY_KEYS: AbilityId[] = ['boost', 'slam', 'gold', 'magnet'];
// Sound A loses power over this interval, then holds silence until FREEZE ends.
// Both phases read simulation time; pausing cannot advance the presentation.
const FREEZE_POWER_CUT = 0.16;

function displayScore(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function fittedText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  color = '#fff3bd',
) {
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  const fit = Math.min(1, maxWidth / Math.max(1, ctx.measureText(value).width));
  text(ctx, value, x, y, size * fit, color);
}

/** The painted cabinet lives in the sky. The road and the player's takeoff stay live. */
function renderFeverShow(
  ctx: CanvasRenderingContext2D,
  state: RunnerState,
  art: RunnerArt,
  view: Viewport,
  reducedMotion: boolean,
) {
  const f = state.fever;
  if (state.status === 'ready' || state.status === 'over') return;
  // The cabinet powers up with the release. Nothing glows over the black hold.
  if (f.freeze > 0) return;
  const rewardCue = f.rewardCue;
  const rewardAge = rewardCue ? f.clock - rewardCue.clock : 10;
  const showingAward = rewardCue !== null && rewardAge < 1;
  const reel = f.reel;
  const hyper = f.hyperTime > 0;
  const rush = f.rushTime > 0;
  const color = hyper ? '#ffb76a' : '#ffed94';
  const cabinetWidth = Math.min(
    view.width * 0.78,
    view.width - view.anchor - 76,
    Math.max(420, (view.ground - 170) * 2.8),
    1130,
  );
  const cabinetHeight =
    (cabinetWidth * art.fever.cabinet.height) / art.fever.cabinet.width;
  const cx = Math.min(view.width * 0.6, view.width - cabinetWidth / 2 - 16);
  const top = Math.max(
    20,
    Math.min(view.height * 0.14, view.ground - cabinetHeight - 155),
  );
  ctx.save();
  if (reel) {
    const entryAge = Math.max(
      0,
      reel.elapsed - (reel.jackpot ? JACKPOT_FREEZE : 0),
    );
    const entry = Math.min(1, entryAge / 0.22);
    const spring = reducedMotion
      ? 1
      : reel.jackpot
        ? 1 + 0.065 * (1 - entry) ** 3
        : 0.86 + Math.sin(entry * Math.PI * 0.6) * 0.147;
    ctx.translate(cx, top + cabinetHeight / 2);
    ctx.scale(spring, spring);
    ctx.translate(-cx, -top - cabinetHeight / 2);
    const left = cx - cabinetWidth / 2;
    const entryBurst = Math.max(0, 1 - entryAge / 0.65);
    if (entryBurst > 0) {
      ctx.save();
      // One painted gold burst on power-up, never a screen flash or a pulse.
      ctx.globalAlpha = reducedMotion ? entryBurst * 0.28 : entryBurst;
      const burstSize =
        cabinetWidth *
        (reducedMotion
          ? 0.57
          : reel.jackpot
            ? 0.74 + (1 - entryBurst) * 0.12
            : 0.58 + entryAge * 0.15);
      sprite(ctx, art.fever.burst, cx, top + cabinetHeight * 0.94, burstSize);
      ctx.restore();
    }
    ctx.save();
    if (reel.jackpot && entryBurst > 0) {
      // Follow the actual painted brass silhouette instead of adding a frame.
      ctx.shadowColor = '#ffc957';
      ctx.shadowBlur = (reducedMotion ? 7 : 24) * entryBurst;
    }
    ctx.drawImage(art.fever.cabinet, left, top, cabinetWidth, cabinetHeight);
    ctx.restore();
    const count = reel.rewards.length;
    const title = reel.jackpot
      ? 'JACKPOT'
      : hyper
        ? 'HYPER TREASURE'
        : rush
          ? 'RUSH TREASURE'
          : reel.merged > 1
            ? 'TREASURE CASCADE'
            : count >= 3
              ? 'TRIPLE TREASURE'
              : count === 2
                ? 'DOUBLE TREASURE'
                : 'TREASURE CHANCE';
    fittedText(
      ctx,
      title,
      cx,
      top + cabinetHeight * 0.334,
      cabinetWidth * 0.034,
      cabinetWidth * 0.215,
      '#fff4bf',
    );
    const windowLeft = left + cabinetWidth * 0.226;
    const windowTop = top + cabinetHeight * 0.415;
    const windowWidth = cabinetWidth * 0.548;
    const windowHeight = cabinetHeight * 0.302;
    const slotWidth = windowWidth / count;
    const iconSize = Math.min(windowHeight * 0.88, slotWidth * 0.7);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(windowLeft, windowTop, windowWidth, windowHeight, 9);
    ctx.clip();
    for (let i = 0; i < count; i++) {
      const reward = reel.rewards[i]!;
      const slotX = windowLeft + slotWidth * (i + 0.5);
      const settled = i < reel.revealed;
      if (i > 0) {
        ctx.fillStyle = '#b9dbd32b';
        ctx.fillRect(
          windowLeft + i * slotWidth - 0.75,
          windowTop + 8,
          1.5,
          windowHeight - 16,
        );
      }
      const sinceReveal =
        reel.elapsed -
        ((reel.jackpot ? JACKPOT_FREEZE + 0.16 : REEL_FIRST_REVEAL) +
          i * reel.revealInterval);
      if (settled) {
        const land = reducedMotion
          ? 1
          : 1 + Math.max(0, 1 - sinceReveal / 0.25) * 0.22;
        const actualSize = iconSize * land;
        ctx.save();
        ctx.shadowColor = '#ffcf50';
        ctx.shadowBlur = reducedMotion ? 4 : 12;
        sprite(
          ctx,
          art.fever.abilities[reward.kind],
          slotX,
          windowTop + windowHeight * 0.94,
          actualSize,
        );
        ctx.restore();
        if (reward.count > 1 || f.abilities[reward.kind] >= MAX_ABILITY_LEVEL)
          text(
            ctx,
            f.abilities[reward.kind] >= MAX_ABILITY_LEVEL
              ? 'MAX'
              : `+${reward.count}`,
            slotX + iconSize * 0.37,
            windowTop + windowHeight * 0.37,
            iconSize * 0.35,
            '#fffce0',
          );
      } else if (reducedMotion) {
        sprite(
          ctx,
          reel.jackpot ? art.fever.goldenChest : art.fever.chest,
          slotX,
          windowTop + windowHeight * 0.94,
          iconSize,
        );
      } else {
        const step = windowHeight * 1.04;
        const roll = reel.elapsed * (7.8 + i * 1.2) + i * 0.7;
        const phase = roll % 1;
        for (let j = -1; j <= 1; j++) {
          const index =
            (((Math.floor(roll) + j + i) % ABILITY_KEYS.length) +
              ABILITY_KEYS.length) %
            ABILITY_KEYS.length;
          const image = art.fever.abilities[ABILITY_KEYS[index]!];
          const base = windowTop + windowHeight * 0.92 + (j + phase) * step;
          ctx.globalAlpha = 0.85;
          sprite(ctx, image, slotX, base, iconSize * 0.93);
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    const latest = reel.rewards[Math.max(0, reel.revealed - 1)]!;
    const caption =
      reel.revealed === 0
        ? 'WHAT WILL YOU GET?'
        : f.abilities[latest.kind] >= MAX_ABILITY_LEVEL
          ? `${ABILITY_LABELS[latest.kind]} MAX → SCORE`
          : `${ABILITY_LABELS[latest.kind]}  +${latest.count}`;
    fittedText(
      ctx,
      caption,
      cx,
      top + cabinetHeight * 0.921,
      cabinetWidth * 0.036,
      cabinetWidth * 0.275,
      reel.revealed > 0 ? '#c6fff0' : '#fff4bd',
    );
    if (reel.revealed > 0 && !showingAward) {
      const level = f.abilities[latest.kind];
      const rank =
        level >= MAX_ABILITY_LEVEL
          ? 'MAXIMUM POWER'
          : level >= 5
            ? 'SUPER RANK UP'
            : 'RANK UP';
      fittedText(
        ctx,
        `${rank}  Lv.${level}`,
        cx,
        top + cabinetHeight + 28,
        cabinetWidth * 0.043,
        cabinetWidth * 0.75,
        '#ffe28b',
      );
    } else if (!showingAward) {
      fittedText(
        ctx,
        `${count} ${count === 1 ? 'REWARD' : 'REWARDS'} · AUTO OPEN`,
        cx,
        top + cabinetHeight + 26,
        cabinetWidth * 0.027,
        cabinetWidth * 0.75,
        '#fff2c6',
      );
    }
    if (f.queue.length > 0)
      fittedText(
        ctx,
        `NEXT ×${f.queue.reduce((sum, next) => sum + next.merged, 0)}`,
        left + cabinetWidth * 0.86,
        top + cabinetHeight * 0.96,
        cabinetWidth * 0.023,
        cabinetWidth * 0.16,
        '#fff9cf',
      );
  } else if (hyper || rush) {
    const y = Math.max(100, Math.min(view.height * 0.24, view.ground - 225));
    ctx.save();
    ctx.globalAlpha = reducedMotion ? 0.17 : 0.22;
    sprite(ctx, art.fever.burst, cx, y + 80, Math.min(440, view.width * 0.47));
    ctx.restore();
    text(
      ctx,
      hyper ? 'HYPER FEVER' : 'RUSH!',
      cx,
      y,
      Math.min(86, view.width * 0.086),
      color,
    );
    text(
      ctx,
      `${f.chain} CHAIN   ×${f.multiplier.toFixed(1)}`,
      cx,
      y + 41,
      Math.min(37, view.width * 0.04),
      '#fff1c0',
    );
  }
  if (rewardCue && showingAward) {
    const y = top + cabinetHeight + 81;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - rewardAge) * 4);
    const pop = reducedMotion ? 1 : 1 + Math.max(0, 0.18 - rewardAge) * 1.1;
    fittedText(
      ctx,
      `+${displayScore(rewardCue.value)}`,
      cx,
      Math.min(view.ground - 90, y - rewardAge * 18),
      Math.min(86, view.width * 0.08) * pop,
      view.width - view.anchor - 65,
      '#fff6b4',
    );
    ctx.restore();
  }
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
  const frozen = state.fever.freeze > 0;
  const powerCut = frozen
    ? Math.min(1, (JACKPOT_FREEZE - state.fever.freeze) / FREEZE_POWER_CUT)
    : 0;
  if (frozen) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    // A real black, held frame after one power-down. No timers, residual
    // cabinet lights, bright sky, scrolling reels or repeated flashes.
    if (powerCut >= 1) return;
  }
  ctx.save();
  if (frozen && !reducedMotion) {
    // Collapse the actual painted scene into a dim horizontal slit. This is
    // confined to the stopped world; normal takeoff/landing geometry returns
    // exactly at release. Reduced motion only uses the fade below.
    const compression = Math.max(0.002, (1 - powerCut) ** 2.5);
    ctx.translate(0, height * 0.48 * (1 - compression));
    ctx.scale(1, compression);
  }
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
  if (state.fever.hyperTime > 0 || state.fever.rushTime > 0) {
    const warmth = ctx.createLinearGradient(0, 0, 0, ground);
    warmth.addColorStop(
      0,
      state.fever.hyperTime > 0 ? '#a247534d' : '#db87452c',
    );
    warmth.addColorStop(0.68, '#ffc24910');
    warmth.addColorStop(1, '#ffd27000');
    ctx.fillStyle = warmth;
    ctx.fillRect(0, 0, width, ground);
  }
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
      obstacle.golden ? art.fever.goldenCrate : art.crate,
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
    if (pickup.kind === 'chest') {
      const size = pickup.earned ? 59 : 52;
      const image = pickup.earned ? art.fever.goldenChest : art.fever.chest;
      const h = (size * image.height) / image.width;
      ctx.save();
      ctx.shadowColor = pickup.earned ? '#ffc642' : '#a1ffe8';
      ctx.shadowBlur = reducedMotion ? 3 : 8;
      ctx.drawImage(image, x - size / 2, y - h / 2 + bob, size, h);
      ctx.restore();
      text(
        ctx,
        pickup.earned ? 'GOLD' : 'CHEST',
        x,
        y - h / 2 - 7 + bob,
        14,
        '#fff0a8',
      );
    } else if (pickup.kind === 'scrap') {
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
    sprite(
      ctx,
      (rival.golden ? art.fever.goldenRivals : art.rivals)[rival.kind][pose]!,
      x,
      y + bounce,
      size,
      true,
    );
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
  // The painted landing blast reaches the actual attack radius, below the car.
  // Keep its height low so a fast slam never hides the next takeoff silhouette.
  for (const effect of state.effects) {
    if (effect.kind !== 'slam') continue;
    const fraction = Math.max(0, effect.life / effect.maxLife);
    const diameter = (effect.radius ?? 150) * 2;
    const size = diameter * (reducedMotion ? 1 : 0.58 + (1 - fraction) * 0.42);
    const blastHeight = Math.min(88, size * 0.2);
    ctx.save();
    ctx.globalAlpha = fraction * (reducedMotion ? 0.45 : 0.72);
    ctx.drawImage(
      art.fever.burst,
      sx(effect.x) - size / 2,
      ground - effect.y - blastHeight * 0.74,
      size,
      blastHeight,
    );
    ctx.restore();
  }
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
  const growth =
    1 +
    Math.min(
      0.2,
      Object.values(state.fever.abilities).reduce(
        (sum, level) => sum + level,
        0,
      ) * 0.008,
    );
  ctx.scale((1 + squash * 0.07) * growth, (1 - squash * 0.1) * growth);
  renderExhaust(ctx, state, art, reducedMotion);
  // A soft grace-period pulse keeps the body and wheel contact legible.
  // The guard spark and HUD already communicate the hit; never hide the car.
  ctx.globalAlpha =
    state.player.invulnerable > 0 && !reducedMotion
      ? 0.875 + Math.sin(state.time * Math.PI * 12) * 0.125
      : 1;
  // Wheelbase, rather than the long front overhang, is centred on collision.
  sprite(ctx, art.player, 10, 0, 68);
  if (state.fever.abilities.boost > 0)
    sprite(ctx, art.fever.abilities.boost, -17, -20, 27);
  if (state.fever.abilities.slam > 0)
    sprite(ctx, art.fever.abilities.slam, 16, -15, 16);
  if (state.fever.abilities.magnet > 0)
    sprite(ctx, art.fever.abilities.magnet, 42, -11, 16);
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
    if (effect.kind === 'slam') {
      if (effect.text)
        text(
          ctx,
          effect.text,
          x + 30,
          y - 64 - (1 - fraction) * 32,
          31,
          '#fff0a8',
        );
    } else if (effect.kind === 'gold') {
      const size = 54 + (1 - fraction) * 36;
      ctx.globalAlpha = fraction * 0.85;
      sprite(ctx, art.fever.abilities.gold, x, y + size * 0.4, size);
    } else if (effect.kind === 'chest') {
      const size = 85 + (1 - fraction) * 28;
      sprite(ctx, art.fever.openChest, x, y + 25 - (1 - fraction) * 35, size);
      if (effect.text) text(ctx, effect.text, x, y - size - 5, 25, '#fff0a8');
    } else if (effect.kind === 'guard') {
      // A directional flash only when contact consumes a guard, never an aura.
      const size = reducedMotion ? 32 : 44;
      ctx.globalAlpha = Math.min(1, fraction * 1.8);
      sprite(ctx, art.effects.guard, x + 27, y + 17, size);
    } else if (effect.kind === 'hit' || effect.kind === 'burst') {
      const image = art.effects[effect.kind];
      const size =
        (effect.kind === 'hit' ? 24 : 64) *
        (reducedMotion ? 1 : 0.85 + (1 - fraction) * 0.15);
      ctx.globalAlpha = fraction * fraction;
      sprite(ctx, image, x, y + (size * image.height) / image.width / 2, size);
      if (effect.text) {
        ctx.globalAlpha = fraction;
        text(
          ctx,
          effect.text,
          x,
          y - (1 - fraction) * 42 - 40,
          effect.kind === 'burst' ? 23 : 16,
          '#fff0aa',
        );
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
  renderFeverShow(ctx, state, art, view, reducedMotion);
  ctx.restore();
  if (frozen) {
    ctx.save();
    // Monotonic loss of light, with no white flash at either boundary.
    ctx.globalAlpha = 1 - (1 - powerCut) ** 1.4;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
