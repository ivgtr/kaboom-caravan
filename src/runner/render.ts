import { WEAPONS } from './definitions';
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
  const bgOffset = (state.distance * 0.075) % (bgWidth * 2);
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
  // World milestones are scenery, not a finish line.
  const firstMark = Math.floor((camera - 100) / 1000) * 1000;
  for (
    let mark = Math.max(1000, firstMark);
    mark < camera + width + 100;
    mark += 1000
  ) {
    const platform = state.platforms.find(
      (p) => mark >= p.x + 60 && mark < p.x + p.width - 60,
    );
    if (!platform) continue;
    const x = sx(mark),
      y = ground - platformTopAt(platform, mark);
    ctx.fillStyle = '#43675b';
    ctx.fillRect(x - 2, y - 106, 4, 106);
    ctx.fillStyle = '#e9e5b7';
    ctx.beginPath();
    ctx.roundRect(x - 28, y - 110, 56, 29, 5);
    ctx.fill();
    ctx.font = '800 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3a645c';
    ctx.fillText(`${mark / 10}m`, x, y - 90);
  }
  for (const obstacle of state.obstacles) {
    const x = sx(obstacle.x),
      y = ground - obstacle.top;
    ctx.fillStyle = '#824f3f';
    ctx.strokeStyle = '#563d36';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(
      x - obstacle.width / 2,
      y - obstacle.height,
      obstacle.width,
      obstacle.height,
      4,
    );
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#edbd75';
    ctx.fillRect(
      x - obstacle.width / 2 + 4,
      y - obstacle.height + 4,
      obstacle.width - 8,
      7,
    );
    ctx.strokeStyle = '#dd995a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - obstacle.width / 2 + 6, y - 6);
    ctx.lineTo(x + obstacle.width / 2 - 6, y - obstacle.height + 12);
    ctx.stroke();
    ctx.strokeStyle = '#f5d29a';
    ctx.beginPath();
    ctx.moveTo(x - obstacle.width / 2 + 6, y - obstacle.height + 12);
    ctx.lineTo(x + obstacle.width / 2 - 6, y - 6);
    ctx.stroke();
  }
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    const x = sx(pickup.x),
      y = ground - pickup.y;
    if (x < -80 || x > width + 80) continue;
    const bob = reducedMotion ? 0 : Math.sin(state.time * 3.5 + pickup.id) * 3;
    if (pickup.kind === 'scrap') {
      ctx.save();
      ctx.translate(x, y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffc45a';
      ctx.strokeStyle = '#a76b33';
      ctx.lineWidth = 2;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.fillStyle = '#fff2a6';
      ctx.fillRect(-4, -4, 5, 5);
      ctx.restore();
    } else {
      const color = pickup.weapon ? WEAPONS[pickup.weapon].color : '#9fffe6';
      ellipse(ctx, x, y + 30, 24, 5, '#244d4738');
      ctx.fillStyle = '#193d4bdb';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - 27, y - 28 + bob, 54, 54, 12);
      ctx.fill();
      ctx.stroke();
      const img = pickup.weapon
        ? art.weapons[pickup.weapon]
        : pickup.kind === 'shield'
          ? art.shield
          : art.magnet;
      const h = (37 * img.height) / img.width;
      ctx.drawImage(img, x - 18.5, y - h / 2 + bob, 37, h);
      text(
        ctx,
        pickup.weapon
          ? `${WEAPONS[pickup.weapon].label}${state.weapon?.id === pickup.weapon ? (state.weapon.level === 3 ? ' ↻' : ' ↑') : ''}`
          : pickup.kind === 'shield'
            ? '+1'
            : 'MAG',
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
    const telegraph = rival.age < 1;
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
    if (rival.hit > 0 && !rival.defeated) {
      ctx.globalAlpha = 0.55;
      ellipse(ctx, x, y - 20, 24, 25, '#ffda83');
    }
    ctx.restore();
    if (!rival.defeated) {
      text(
        ctx,
        telegraph ? '!' : 'RIVAL',
        x,
        y - size - 13,
        telegraph ? 27 : 11,
        '#ffe097',
      );
      if (rival.hp < rival.maxHp) {
        ctx.fillStyle = '#244a48';
        ctx.fillRect(x - 17, y - size - 2, 34, 4);
        ctx.fillStyle = '#ffc460';
        ctx.fillRect(x - 17, y - size - 2, (34 * rival.hp) / rival.maxHp, 4);
      }
    }
  }
  for (const shot of state.shots) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, shot.life * 6);
    ctx.strokeStyle = WEAPONS[shot.weapon].color;
    ctx.lineWidth =
      shot.weapon === 'rail' ? 5 : shot.weapon === 'flame' ? 12 : 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx(shot.x), ground - shot.y);
    ctx.lineTo(sx(shot.endX), ground - shot.endY);
    ctx.stroke();
    if (shot.weapon !== 'rail')
      ellipse(ctx, sx(shot.endX), ground - shot.endY, 7, 7, '#fff4bd');
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
    ellipse(ctx, 0, 0, 42 - Math.min(15, clearance * 0.08), 7, '#163e4447');
    ctx.restore();
  }
  ctx.save();
  ctx.translate(anchor, foot);
  // Even reduced-motion mode retains the necessary ground angle. The wheels,
  // roof mount, shield and simulation's muzzle share this exact transform.
  ctx.rotate(playerTilt(state));
  const squash = state.player.squash;
  ctx.scale(1 + squash * 0.07, 1 - squash * 0.1);
  if (state.player.invulnerable <= 0 || Math.floor(state.time * 16) % 2 === 0)
    sprite(ctx, art.player, 0, 0, 100);
  if (state.weapon) sprite(ctx, art.weapons[state.weapon.id], -12, -64, 38);
  if (state.shield > 0) {
    ctx.strokeStyle = '#befff1a6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -36, 59, 47, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  for (const effect of state.effects) {
    const fraction = Math.max(0, effect.life / effect.maxLife);
    const x = sx(effect.x),
      y = ground - effect.y;
    ctx.save();
    ctx.globalAlpha = fraction;
    // Equipment already has one HUD notice; a second label would cover the
    // mounted weapon during high jumps on a short landscape screen.
    if (effect.text && effect.kind !== 'pickup')
      text(
        ctx,
        effect.text,
        x,
        y - (1 - fraction) * 30 - 45,
        16,
        effect.kind === 'hit' ? '#ffb58d' : '#fff0aa',
      );
    else if (effect.kind === 'jump' || effect.kind === 'land') {
      for (let i = 0; i < 5; i++)
        ellipse(
          ctx,
          x + (i - 2) * (10 + (1 - fraction) * 20),
          y - (1 - fraction) * 12,
          8 * fraction,
          5 * fraction,
          '#fff0bb',
        );
    } else {
      for (let i = 0; i < 7; i++) {
        const angle = (i * Math.PI * 2) / 7;
        ellipse(
          ctx,
          x + Math.cos(angle) * (1 - fraction) * 45,
          y + Math.sin(angle) * (1 - fraction) * 45,
          fraction * 5,
          fraction * 5,
          effect.kind === 'hit' ? '#ffab69' : '#ffdc79',
        );
      }
    }
    ctx.restore();
  }
  // A subtle vignette grounds the composition without covering the jump path.
  const bottom = ctx.createLinearGradient(0, height - 110, 0, height);
  bottom.addColorStop(0, '#12334200');
  bottom.addColorStop(1, '#123342a8');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, height - 110, width, 110);
}
