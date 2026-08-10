import type { EnemyTypeId, ModuleId, WeaponId } from '../game/data/ids';
import {
  createPresentationSnapshot,
  interpolatePosition,
} from '../game/simulation/presentationSnapshot';
import type { SimulationState } from '../game/simulation/types';
import { MODULE_ART, WEAPON_ART } from '../app/equipmentAssets';
import { SpriteAssetManager } from './SpriteAssetManager';

const WORLD_MINIMUM = 0;
const WORLD_MAXIMUM = 100;
const WORLD_ART = {
  player: '/assets/world/veh_player_base_v001.png',
  background: '/assets/world/env_background_sunny_highway_v001.webp',
  road: '/assets/world/env_road_v001.webp',
} as const;
const ENEMY_ART: Readonly<Record<EnemyTypeId, string>> = {
  basic: '/assets/world/enm_basic_v001.png',
  rusher: '/assets/world/enm_rusher_v001.png',
  heavy: '/assets/world/enm_heavy_v001.png',
  artillery: '/assets/world/enm_artillery_v001.png',
  bomber: '/assets/world/enm_bomber_v001.png',
  'kawaii-fortress': '/assets/world/enm_kawaii_fortress_v001.png',
};
const ENEMY_COLORS: Record<EnemyTypeId, string> = {
  basic: '#72d6a0',
  rusher: '#e45c78',
  heavy: '#4d596f',
  artillery: '#8566ad',
  bomber: '#dc7d3f',
  'kawaii-fortress': '#d34f91',
};
const PROJECTILE_COLORS: Record<WeaponId, string> = {
  'machine-cannon': '#fff16a',
  'scatter-cannon': '#ffd166',
  flamethrower: '#ff7a3d',
  'rocket-launcher': '#ff9f1c',
  railgun: '#77e7ff',
  'mine-launcher': '#6d597a',
};

interface VisualEffect {
  kind: 'muzzle' | 'hit' | 'explosion' | 'smoke';
  worldPosition: number;
  ageSeconds: number;
  durationSeconds: number;
}

export class GameRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private lastProcessedTick = -1;
  private lastRenderTime = performance.now();
  private effects: VisualEffect[] = [];
  private readonly knownEntityPositions = new Map<string, number>();
  private readonly assets = new SpriteAssetManager();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    this.context = context;
    this.assets.preload([
      ...Object.values(WORLD_ART),
      ...Object.values(ENEMY_ART),
      ...Object.values(WEAPON_ART),
      ...Object.values(MODULE_ART),
    ]);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  render(state: SimulationState, alpha: number): void {
    const context = this.context;
    const snapshot = createPresentationSnapshot(state);
    const now = performance.now();
    const deltaSeconds = Math.min(0.05, (now - this.lastRenderTime) / 1000);
    this.lastRenderTime = now;
    this.updateEffects(state, deltaSeconds);
    const scale = window.devicePixelRatio || 1;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    this.drawEnvironment();
    this.drawFrontline(snapshot.frontlinePosition);

    const playerX = this.worldToScreen(
      interpolatePosition(snapshot.player, alpha),
    );
    this.drawCaravan(
      playerX,
      this.groundY,
      state.build.primaryWeaponId,
      state.build.secondaryWeaponId,
      state.build.moduleIds,
      state.player.overheated,
    );

    for (const enemy of snapshot.enemies) {
      const typeId = enemy.typeId ?? 'basic';
      this.drawMonster(
        this.worldToScreen(interpolatePosition(enemy, alpha)),
        this.groundY,
        typeId,
      );
    }

    for (const projectile of state.projectiles) {
      const x = this.worldToScreen(
        projectile.previousPosition +
          (projectile.position - projectile.previousPosition) * alpha,
      );
      const radius = projectile.behavior === 'flame' ? 7 : 3;
      context.beginPath();
      context.fillStyle = PROJECTILE_COLORS[projectile.weaponId];
      context.arc(x, this.groundY - 30, radius, 0, Math.PI * 2);
      context.fill();
    }
    this.drawEffects();

    this.knownEntityPositions.set(state.player.id, state.player.position);
    for (const enemy of state.enemies) {
      this.knownEntityPositions.set(enemy.id, enemy.position);
    }
  }

  dispose(): void {
    this.resizeObserver.disconnect();
  }

  private drawEnvironment(): void {
    const context = this.context;
    const background = this.assets.get(WORLD_ART.background);
    if (background) {
      this.drawImageCover(
        background,
        0,
        0,
        this.viewportWidth,
        this.viewportHeight,
      );
    } else {
      const sky = context.createLinearGradient(0, 0, 0, this.groundY);
      sky.addColorStop(0, '#77c8ef');
      sky.addColorStop(1, '#e7f5d0');
      context.fillStyle = sky;
      context.fillRect(0, 0, this.viewportWidth, this.groundY);
    }

    const road = this.assets.get(WORLD_ART.road);
    if (road) {
      const roadHeight = Math.max(150, this.viewportHeight * 0.35);
      this.drawImageCover(
        road,
        0,
        this.groundY - roadHeight * 0.2,
        this.viewportWidth,
        roadHeight,
      );
    } else {
      context.fillStyle = '#91b96e';
      context.fillRect(
        0,
        this.groundY - 12,
        this.viewportWidth,
        this.viewportHeight - this.groundY + 12,
      );
      context.fillStyle = '#e4bd83';
      context.fillRect(0, this.groundY - 4, this.viewportWidth, 62);
    }

    const zones: Array<[number, number, string]> = [
      [0, 25, 'rgb(184 201 138 / 35%)'],
      [25, 45, 'rgb(210 199 126 / 35%)'],
      [45, 65, 'rgb(217 165 110 / 35%)'],
      [65, 80, 'rgb(207 124 119 / 35%)'],
    ];
    for (const [minimum, maximum, color] of zones) {
      const left = this.worldToScreen(minimum);
      const right = this.worldToScreen(maximum);
      context.fillStyle = color;
      context.fillRect(left, this.groundY - 4, right - left, 62);
    }
  }

  private drawFrontline(position: number): void {
    const context = this.context;
    const x = this.worldToScreen(position);
    context.strokeStyle = '#fff4a3';
    context.lineWidth = 4;
    context.setLineDash([8, 6]);
    context.beginPath();
    context.moveTo(x, this.groundY - 92);
    context.lineTo(x, this.groundY + 48);
    context.stroke();
    context.setLineDash([]);
  }

  private drawCaravan(
    x: number,
    groundY: number,
    primaryWeaponId: WeaponId,
    secondaryWeaponId: WeaponId,
    moduleIds: ModuleId[],
    overheated: boolean,
  ): void {
    const context = this.context;
    const player = this.assets.get(WORLD_ART.player);
    if (player) {
      const width = Math.min(190, Math.max(118, this.viewportHeight * 0.25));
      const size = width;
      const left = x - size * 0.5;
      const top = groundY - size * 0.8;
      context.save();
      if (overheated) {
        context.shadowColor = '#ff5d5d';
        context.shadowBlur = 18;
        context.globalAlpha = 0.92;
      }
      context.drawImage(player, left, top, size, size);
      this.drawEquipmentSprite(
        WEAPON_ART[primaryWeaponId],
        x + width * 0.12,
        groundY - width * 0.58,
        width * 0.56,
        -4,
      );
      this.drawEquipmentSprite(
        WEAPON_ART[secondaryWeaponId],
        x + width * 0.02,
        groundY - width * 0.78,
        width * 0.34,
        2,
      );
      for (let index = 0; index < moduleIds.length; index += 1) {
        const column = index % 2;
        const row = Math.floor(index / 2);
        this.drawEquipmentSprite(
          MODULE_ART[moduleIds[index]!],
          x - width * (0.29 - column * 0.14),
          groundY - width * (0.55 - row * 0.14),
          width * 0.2,
          index % 2 === 0 ? -4 : 4,
        );
      }
      context.restore();
      return;
    }
    context.save();
    context.translate(x, groundY);

    if (overheated) {
      context.shadowColor = '#ff5d5d';
      context.shadowBlur = 18;
    }

    context.fillStyle = '#2f3342';
    context.beginPath();
    context.arc(-18, 0, 8, 0, Math.PI * 2);
    context.arc(18, 0, 8, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#ff8fa3';
    context.strokeStyle = '#303447';
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(-30, -28, 60, 28, 8);
    context.fill();
    context.stroke();
    context.beginPath();
    context.roundRect(-15, -42, 32, 20, 7);
    context.fill();
    context.stroke();

    this.drawWeapon(primaryWeaponId, 5, -34, 1, 1);
    this.drawWeapon(secondaryWeaponId, -8, -51, 0.7, 1);

    const moduleColors: Record<ModuleId, string> = {
      'cooling-fan': '#77e7ff',
      generator: '#f2c14e',
      'ammo-box': '#a78bfa',
      armor: '#77839a',
      'shield-generator': '#72d6c9',
      radar: '#f4a261',
      'heat-recycler': '#ff7a3d',
      capacitor: '#c77dff',
      'magnetic-armor': '#6c8cff',
      'explosive-magazine': '#e45c78',
    };
    for (let index = 0; index < moduleIds.length; index += 1) {
      context.fillStyle = moduleColors[moduleIds[index]!];
      context.strokeStyle = '#303447';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-29 + index * 12, -35, 10, 11, 3);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  private drawWeapon(
    weaponId: WeaponId,
    x: number,
    y: number,
    scale: number,
    direction: -1 | 1,
  ): void {
    const context = this.context;
    const barrelLength =
      weaponId === 'railgun'
        ? 52
        : weaponId === 'rocket-launcher'
          ? 40
          : weaponId === 'flamethrower'
            ? 28
            : 34;
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.strokeStyle = '#343849';
    context.lineWidth = weaponId === 'scatter-cannon' ? 11 : 7;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(direction * barrelLength, 0);
    context.stroke();
    context.fillStyle = PROJECTILE_COLORS[weaponId];
    context.beginPath();
    context.arc(0, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private drawMonster(x: number, groundY: number, typeId: EnemyTypeId): void {
    const context = this.context;
    const monster = this.assets.get(ENEMY_ART[typeId]);
    if (monster) {
      const relativeSize: Record<EnemyTypeId, number> = {
        basic: 0.14,
        rusher: 0.17,
        heavy: 0.2,
        artillery: 0.2,
        bomber: 0.14,
        'kawaii-fortress': 0.4,
      };
      const size = Math.min(
        typeId === 'kawaii-fortress' ? 360 : 150,
        Math.max(
          typeId === 'kawaii-fortress' ? 180 : 62,
          this.viewportHeight * relativeSize[typeId],
        ),
      );
      context.drawImage(
        monster,
        x - size * 0.5,
        groundY - size * 0.82,
        size,
        size,
      );
      return;
    }
    const scale =
      typeId === 'kawaii-fortress' ? 2.3 : typeId === 'heavy' ? 1.35 : 1;
    context.save();
    context.translate(x, groundY);
    context.scale(scale, scale);
    context.fillStyle = ENEMY_COLORS[typeId];
    context.strokeStyle = '#303447';
    context.lineWidth = 3 / scale;

    if (typeId === 'rusher') {
      context.beginPath();
      context.ellipse(0, -17, 28, 13, -0.12, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(-22, -24);
      context.lineTo(-39, -35);
      context.lineTo(-28, -13);
      context.fill();
      context.stroke();
    } else if (typeId === 'heavy' || typeId === 'kawaii-fortress') {
      context.beginPath();
      context.ellipse(0, -22, 30, 24, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#77839a';
      for (const [rockX, rockY, radius] of [
        [-14, -31, 9],
        [4, -36, 11],
        [18, -24, 8],
      ] as const) {
        context.beginPath();
        context.arc(rockX, rockY, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
    } else if (typeId === 'artillery') {
      context.beginPath();
      context.ellipse(0, -17, 20, 18, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#a78bfa';
      context.beginPath();
      context.ellipse(0, -38, 24, 10, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else if (typeId === 'bomber') {
      context.beginPath();
      context.arc(0, -19, 19, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#f2c14e';
      context.beginPath();
      context.arc(0, -19, 7, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      context.ellipse(0, -15, 21, 17, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#91b96e';
      context.beginPath();
      context.arc(-7, -31, 8, 0, Math.PI * 2);
      context.arc(7, -32, 7, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = '#fff9e8';
    context.beginPath();
    context.arc(-7, -18, 3.5, 0, Math.PI * 2);
    context.arc(7, -18, 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#303447';
    context.beginPath();
    context.arc(-7, -18, 1.6, 0, Math.PI * 2);
    context.arc(7, -18, 1.6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private updateEffects(state: SimulationState, deltaSeconds: number): void {
    if (state.tick !== this.lastProcessedTick) {
      this.lastProcessedTick = state.tick;
      for (const event of state.events) {
        const targetPosition =
          'targetId' in event
            ? (state.enemies.find(({ id }) => id === event.targetId)
                ?.position ?? this.knownEntityPositions.get(event.targetId))
            : undefined;
        if (event.type === 'weapon-fired') {
          this.effects.push({
            kind: 'muzzle',
            worldPosition: state.player.position + 4,
            ageSeconds: 0,
            durationSeconds: 0.14,
          });
        } else if (
          event.type === 'projectile-hit' &&
          targetPosition !== undefined
        ) {
          this.effects.push({
            kind:
              event.weaponId === 'rocket-launcher' ||
              event.weaponId === 'mine-launcher'
                ? 'explosion'
                : 'hit',
            worldPosition: targetPosition,
            ageSeconds: 0,
            durationSeconds: 0.35,
          });
        } else if (event.type === 'enemy-killed') {
          const position = this.knownEntityPositions.get(event.enemyId);
          if (position !== undefined) {
            this.effects.push({
              kind: 'explosion',
              worldPosition: position,
              ageSeconds: 0,
              durationSeconds: 0.45,
            });
          }
        } else if (event.type === 'overheated') {
          this.effects.push({
            kind: 'smoke',
            worldPosition: state.player.position,
            ageSeconds: 0,
            durationSeconds: 1.2,
          });
        }
      }
    }

    this.effects = this.effects
      .map((effect) => ({
        ...effect,
        ageSeconds: effect.ageSeconds + deltaSeconds,
      }))
      .filter((effect) => effect.ageSeconds < effect.durationSeconds);
  }

  private drawEffects(): void {
    const context = this.context;
    for (const effect of this.effects) {
      const progress = effect.ageSeconds / effect.durationSeconds;
      const x = this.worldToScreen(effect.worldPosition);
      const y = this.groundY - 28;
      context.save();
      context.globalAlpha = 1 - progress;
      if (effect.kind === 'muzzle' || effect.kind === 'hit') {
        context.strokeStyle = effect.kind === 'muzzle' ? '#fff4a3' : '#ffffff';
        context.lineWidth = 4;
        const radius = 10 + progress * 20;
        for (let index = 0; index < 8; index += 1) {
          const angle = (Math.PI * 2 * index) / 8;
          context.beginPath();
          context.moveTo(
            x + Math.cos(angle) * radius * 0.35,
            y + Math.sin(angle) * radius * 0.35,
          );
          context.lineTo(
            x + Math.cos(angle) * radius,
            y + Math.sin(angle) * radius,
          );
          context.stroke();
        }
      } else if (effect.kind === 'explosion') {
        const radius = 12 + progress * 35;
        for (const [color, ratio] of [
          ['#5a3d45', 1],
          ['#ff7a3d', 0.78],
          ['#f2c14e', 0.52],
          ['#fff9cf', 0.25],
        ] as const) {
          context.fillStyle = color;
          context.beginPath();
          context.arc(x, y, radius * ratio, 0, Math.PI * 2);
          context.fill();
        }
      } else {
        context.fillStyle = '#596273';
        for (let index = 0; index < 4; index += 1) {
          context.beginPath();
          context.arc(
            x - 8 + index * 6,
            y - progress * 45 - index * 5,
            6 + progress * 6,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }
      context.restore();
    }
  }

  private worldToScreen(position: number): number {
    const padding = Math.max(36, this.viewportWidth * 0.04);
    const normalized =
      (position - WORLD_MINIMUM) / (WORLD_MAXIMUM - WORLD_MINIMUM);
    return padding + normalized * (this.viewportWidth - padding * 2);
  }

  private drawEquipmentSprite(
    source: string,
    centerX: number,
    centerY: number,
    size: number,
    rotationDegrees: number,
  ): void {
    const image = this.assets.get(source);
    if (!image) return;
    const context = this.context;
    context.save();
    context.translate(centerX, centerY);
    context.rotate((rotationDegrees * Math.PI) / 180);
    context.drawImage(image, -size / 2, -size / 2, size, size);
    context.restore();
  }

  private drawImageCover(
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;
    if (sourceRatio > targetRatio) {
      sourceWidth = image.naturalHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = image.naturalWidth / targetRatio;
      sourceY = (image.naturalHeight - sourceHeight) / 2;
    }
    this.context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      width,
      height,
    );
  }

  private get groundY(): number {
    return this.viewportHeight * 0.68;
  }

  private readonly resize = (): void => {
    this.viewportWidth = Math.max(1, this.canvas.clientWidth);
    this.viewportHeight = Math.max(1, this.canvas.clientHeight);
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.viewportWidth * scale);
    this.canvas.height = Math.round(this.viewportHeight * scale);
  };
}
