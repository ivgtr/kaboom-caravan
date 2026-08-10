import type { EnemyTypeId, ModuleId, WeaponId } from '../game/data/ids';
import {
  createPresentationSnapshot,
  interpolatePosition,
} from '../game/simulation/presentationSnapshot';
import type { EnemyState, SimulationState } from '../game/simulation/types';
import { MODULE_ART, WEAPON_ART } from '../app/equipmentAssets';
import {
  ENEMY_MOTION_ART,
  getMotionFrameSource,
  getPlayerRigPartSource,
  PLAYER_CHASSIS_ART,
  PLAYER_RIG_ART,
  type CharacterMotionPose,
  type PlayerRigPart,
} from './animationAssets';
import { SpriteAssetManager } from './SpriteAssetManager';
import {
  getVfxSource,
  VFX_ART,
  WEAPON_VFX_FAMILY,
  type VfxFamily,
  type VfxPose,
} from './vfxAssets';

const WORLD_MINIMUM = 0;
const WORLD_MAXIMUM = 100;
const WORLD_ART = {
  background: '/assets/world/env_background_sunny_highway_v001.webp',
  road: '/assets/world/env_road_v001.webp',
} as const;
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
  weaponId?: WeaponId;
}

interface CharacterMotionRuntime {
  travelDistance: number;
  lastPosition: number;
  wheelRotation: number;
  releaseAgeSeconds: number;
  hitAgeSeconds: number;
}

interface ExhaustPuff {
  worldPosition: number;
  ageSeconds: number;
  durationSeconds: number;
}

const createMotionRuntime = (position: number): CharacterMotionRuntime => ({
  travelDistance: 0,
  lastPosition: position,
  wheelRotation: 0,
  releaseAgeSeconds: Number.POSITIVE_INFINITY,
  hitAgeSeconds: Number.POSITIVE_INFINITY,
});

export class GameRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private lastProcessedTick = -1;
  private lastMotionTick = -1;
  private lastRenderTime = performance.now();
  private effects: VisualEffect[] = [];
  private readonly recycledEffects: VisualEffect[] = [];
  private readonly knownEntityPositions = new Map<string, number>();
  private readonly assets = new SpriteAssetManager();
  private playerMotion = createMotionRuntime(0);
  private readonly enemyMotions = new Map<string, CharacterMotionRuntime>();
  private exhaustPuffs: ExhaustPuff[] = [];
  private exhaustEmissionSeconds = 0;
  private readonly showMotionDebug =
    new URLSearchParams(window.location.search).get('debug') === 'motion';

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    this.context = context;
    this.assets.preload([
      ...Object.values(WORLD_ART),
      PLAYER_CHASSIS_ART.source,
      PLAYER_RIG_ART.source,
      ...Object.values(ENEMY_MOTION_ART).map(({ source }) => source),
      ...Object.values(WEAPON_ART),
      ...Object.values(MODULE_ART),
      ...Object.values(VFX_ART).map(({ source }) => source),
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
    this.updateCharacterMotions(state, deltaSeconds);
    const scale = window.devicePixelRatio || 1;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    this.drawEnvironment();
    this.drawFrontline(snapshot.frontlinePosition);
    this.drawExhaustPuffs();

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

    for (const enemy of state.enemies) {
      this.drawMonster(
        this.worldToScreen(
          enemy.previousPosition +
            (enemy.position - enemy.previousPosition) * alpha,
        ),
        this.groundY,
        enemy,
        state.player.position,
        state.player.radius,
      );
    }

    for (const projectile of state.projectiles) {
      const x = this.worldToScreen(
        projectile.previousPosition +
          (projectile.position - projectile.previousPosition) * alpha,
      );
      this.drawProjectile(x, projectile.weaponId, projectile.behavior);
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

    const zones: Array<[minimum: number, maximum: number, color: string]> = [
      [0, 25, 'rgba(118, 151, 112, 0.16)'],
      [25, 45, 'rgba(182, 157, 103, 0.15)'],
      [45, 65, 'rgba(190, 126, 91, 0.15)'],
      [65, 80, 'rgba(168, 101, 91, 0.14)'],
    ];
    for (const [minimum, maximum, color] of zones) {
      const left = this.worldToScreen(minimum);
      const right = this.worldToScreen(maximum);
      const centerX = (left + right) / 2;
      const radius = Math.max(36, (right - left) * 0.72);
      context.save();
      context.translate(centerX, this.groundY + 25);
      context.scale(1, 0.34);
      const wash = context.createRadialGradient(0, 0, 0, 0, 0, radius);
      wash.addColorStop(0, color);
      wash.addColorStop(0.68, color);
      wash.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = wash;
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  private drawFrontline(position: number): void {
    const context = this.context;
    const x = this.worldToScreen(position);

    context.save();
    context.translate(x, this.groundY + 4);
    context.rotate(-0.06);

    // A worn curved paint mark keeps the boundary readable on the road without
    // cutting through the illustrated world as a vertical HUD line.
    context.lineCap = 'round';
    context.strokeStyle = 'rgba(92, 73, 62, 0.28)';
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(-17, 9);
    context.quadraticCurveTo(0, 0, 18, 7);
    context.stroke();
    context.strokeStyle = 'rgba(238, 204, 137, 0.82)';
    context.lineWidth = 4;
    context.stroke();

    // A short garage-style checkpoint pennant makes the exact world position
    // legible while remaining a physical object that vehicles can occlude.
    context.strokeStyle = '#3d4a59';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, 7);
    context.lineTo(-2, -28);
    context.stroke();
    context.fillStyle = '#e87862';
    context.beginPath();
    context.moveTo(-2, -29);
    context.quadraticCurveTo(8, -31, 16, -25);
    context.quadraticCurveTo(8, -20, -1, -18);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = '#f4d37e';
    context.beginPath();
    context.arc(-2, -28, 2.4, 0, Math.PI * 2);
    context.fill();
    context.restore();
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
    const player = this.assets.get(PLAYER_CHASSIS_ART.source);
    if (player) {
      const width = Math.min(190, Math.max(118, this.viewportHeight * 0.25));
      const size = width * PLAYER_CHASSIS_ART.displayScale;
      const recoil = this.weaponRecoil(primaryWeaponId);
      const hitOffset = this.hitOffset(this.playerMotion, -1);
      context.save();
      context.translate(x + hitOffset, groundY);
      if (overheated) {
        context.shadowColor = '#ff5d5d';
        context.shadowBlur = 18;
        context.globalAlpha = 0.92;
      }
      context.drawImage(
        player,
        -size * 0.5,
        -size * PLAYER_CHASSIS_ART.groundAnchor,
        size,
        size,
      );
      this.drawWheelRotationMarkers(size);
      this.drawEquipmentSprite(
        WEAPON_ART[primaryWeaponId],
        width * (-0.03 - recoil * 0.055),
        -width * 0.67,
        width * 0.54,
        -4,
      );
      this.drawEquipmentSprite(
        WEAPON_ART[secondaryWeaponId],
        -width * 0.2,
        -width * 0.62,
        width * 0.29,
        2,
      );
      for (let index = 0; index < moduleIds.length; index += 1) {
        const mount = PLAYER_CHASSIS_ART.moduleMounts[index];
        if (!mount) continue;
        this.drawInstalledModule(
          MODULE_ART[moduleIds[index]!],
          mount.x * size,
          mount.y * size,
          mount.scale * size,
          mount.rotation,
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

  private drawMonster(
    x: number,
    groundY: number,
    enemy: EnemyState,
    playerPosition: number,
    playerRadius: number,
  ): void {
    const context = this.context;
    const typeId = enemy.typeId;
    const motionAsset = ENEMY_MOTION_ART[typeId];
    const monster = this.assets.get(motionAsset.source);
    if (monster) {
      const relativeSize: Record<EnemyTypeId, number> = {
        basic: 0.14,
        rusher: 0.17,
        heavy: 0.2,
        artillery: 0.2,
        bomber: 0.14,
        'kawaii-fortress': 0.4,
      };
      const size =
        Math.min(
          typeId === 'kawaii-fortress' ? 360 : 150,
          Math.max(
            typeId === 'kawaii-fortress' ? 180 : 62,
            this.viewportHeight * relativeSize[typeId],
          ),
        ) * motionAsset.displayScale;
      const runtime = this.enemyMotions.get(enemy.id);
      const pose = this.selectEnemyPose(
        enemy,
        playerPosition,
        playerRadius,
        runtime,
      );
      const hitOffset = runtime ? this.hitOffset(runtime, 1) : 0;
      this.drawMotionFrame(
        monster,
        pose,
        x - size * 0.5 + hitOffset,
        groundY - size * motionAsset.groundAnchor,
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

  private drawMotionFrame(
    image: HTMLImageElement,
    pose: CharacterMotionPose,
    x: number,
    y: number,
    size: number,
  ): void {
    const [sourceX, sourceY, sourceWidth, sourceHeight] = getMotionFrameSource(
      image.naturalWidth,
      image.naturalHeight,
      pose,
    );
    this.context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      size,
      size,
    );
  }

  private drawWheelRotationMarkers(size: number): void {
    const context = this.context;
    const angle = this.playerMotion.wheelRotation;
    const orbit = size * PLAYER_CHASSIS_ART.markerOrbit;
    const markerRadius = Math.max(1.4, size * 0.009);
    const anchors = PLAYER_CHASSIS_ART.wheelAnchors.map(
      ([normalizedX, normalizedY]) => ({
        x: normalizedX * size,
        y: normalizedY * size,
      }),
    );

    for (const anchor of anchors) {
      const markerX = anchor.x + Math.cos(angle) * orbit;
      const markerY = anchor.y + Math.sin(angle) * orbit;
      context.fillStyle = '#67e7ef';
      context.strokeStyle = '#26344c';
      context.lineWidth = Math.max(1, size * 0.007);
      context.beginPath();
      context.arc(markerX, markerY, markerRadius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }

    if (!this.showMotionDebug) return;
    context.save();
    context.strokeStyle = '#2af5ff';
    context.lineWidth = 1;
    context.setLineDash([4, 3]);
    context.beginPath();
    context.moveTo(anchors[0]!.x, anchors[0]!.y);
    context.lineTo(anchors[1]!.x, anchors[1]!.y);
    context.stroke();
    context.setLineDash([]);
    for (const anchor of anchors) {
      context.beginPath();
      context.moveTo(anchor.x - 5, anchor.y);
      context.lineTo(anchor.x + 5, anchor.y);
      context.moveTo(anchor.x, anchor.y - 5);
      context.lineTo(anchor.x, anchor.y + 5);
      context.stroke();
    }
    context.restore();
  }

  private drawPlayerRigPart(
    image: HTMLImageElement,
    part: PlayerRigPart,
    centerX: number,
    centerY: number,
    size: number,
    rotation = 0,
  ): void {
    const [sourceX, sourceY, sourceWidth, sourceHeight] =
      getPlayerRigPartSource(image.naturalWidth, image.naturalHeight, part);
    const context = this.context;
    context.save();
    context.translate(centerX, centerY);
    context.rotate(rotation);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -size / 2,
      -size / 2,
      size,
      size,
    );
    context.restore();
  }

  private drawExhaustPuffs(): void {
    const rig = this.assets.get(PLAYER_RIG_ART.source);
    if (!rig) return;
    const baseSize = Math.min(190, Math.max(118, this.viewportHeight * 0.25));
    const context = this.context;
    for (const puff of this.exhaustPuffs) {
      const progress = puff.ageSeconds / puff.durationSeconds;
      const part: PlayerRigPart =
        progress < 0.3
          ? 'smoke-small'
          : progress < 0.68
            ? 'smoke-medium'
            : 'smoke-large';
      const size = baseSize * (0.18 + progress * 0.22);
      context.save();
      context.globalAlpha = Math.min(1, (1 - progress) * 1.6);
      this.drawPlayerRigPart(
        rig,
        part,
        this.worldToScreen(puff.worldPosition),
        this.groundY - baseSize * (0.42 + progress * 0.15),
        size,
        -progress * 0.16,
      );
      context.restore();
    }
  }

  private selectEnemyPose(
    enemy: EnemyState,
    playerPosition: number,
    playerRadius: number,
    runtime?: CharacterMotionRuntime,
  ): CharacterMotionPose {
    if (runtime?.releaseAgeSeconds !== undefined) {
      if (runtime.releaseAgeSeconds < 0.18) return 'release';
    }
    if (this.isEnemyAnticipating(enemy, playerPosition, playerRadius)) {
      return 'anticipation';
    }
    const moving = Math.abs(enemy.position - enemy.previousPosition) > 0.0001;
    if (!moving || !runtime) return 'idle';
    const cadence =
      enemy.typeId === 'rusher' || enemy.typeId === 'bomber'
        ? 1.7
        : enemy.typeId === 'heavy' || enemy.typeId === 'kawaii-fortress'
          ? 0.85
          : 1.25;
    return Math.floor(runtime.travelDistance * cadence) % 2 === 0
      ? 'move'
      : 'idle';
  }

  private isEnemyAnticipating(
    enemy: EnemyState,
    playerPosition: number,
    playerRadius: number,
  ): boolean {
    const distance = enemy.position - playerPosition;
    if (
      enemy.behaviorId === 'stopAndShoot' ||
      enemy.behaviorId === 'bossFortress'
    ) {
      const windUpSeconds = Math.min(0.34, enemy.attackCooldownSeconds * 0.18);
      return (
        distance <= enemy.attackRange && enemy.contactCooldown <= windUpSeconds
      );
    }
    const anticipationDistance =
      enemy.typeId === 'rusher'
        ? 5
        : enemy.typeId === 'bomber'
          ? 4
          : enemy.typeId === 'heavy'
            ? 0.8
            : 0.75;
    return distance <= enemy.radius + anticipationDistance + playerRadius;
  }

  private hitOffset(
    runtime: CharacterMotionRuntime,
    direction: -1 | 1,
  ): number {
    if (runtime.hitAgeSeconds >= 0.2) return 0;
    const remaining = 1 - runtime.hitAgeSeconds / 0.2;
    return direction * Math.sin(remaining * Math.PI) * 4;
  }

  private updateCharacterMotions(
    state: SimulationState,
    deltaSeconds: number,
  ): void {
    if (this.lastMotionTick === -1) {
      this.playerMotion.lastPosition = state.player.position;
    }
    this.advanceMotionRuntime(
      this.playerMotion,
      state.player.position,
      deltaSeconds,
    );
    this.updateExhaustPuffs(
      state.player.position,
      state.player.velocity,
      deltaSeconds,
    );

    const liveEnemyIds = new Set<string>();
    for (const enemy of state.enemies) {
      liveEnemyIds.add(enemy.id);
      let runtime = this.enemyMotions.get(enemy.id);
      if (!runtime) {
        runtime = createMotionRuntime(enemy.position);
        this.enemyMotions.set(enemy.id, runtime);
      }
      this.advanceMotionRuntime(runtime, enemy.position, deltaSeconds);
    }
    for (const enemyId of this.enemyMotions.keys()) {
      if (!liveEnemyIds.has(enemyId)) this.enemyMotions.delete(enemyId);
    }

    if (state.tick === this.lastMotionTick) return;
    this.lastMotionTick = state.tick;
    for (const event of state.events) {
      if (event.type === 'weapon-fired') {
        this.playerMotion.releaseAgeSeconds = 0;
      } else if (event.type === 'projectile-hit') {
        const target = this.enemyMotions.get(event.targetId);
        if (target) target.hitAgeSeconds = 0;
      } else if (event.type === 'enemy-attacked') {
        const attacker = this.enemyMotions.get(event.enemyId);
        if (attacker) attacker.releaseAgeSeconds = 0;
      } else if (event.type === 'vehicle-hit') {
        this.playerMotion.hitAgeSeconds = 0;
        const attacker = this.enemyMotions.get(event.sourceId);
        if (attacker) attacker.releaseAgeSeconds = 0;
      } else if (event.type === 'boss-phase-changed') {
        const boss = this.enemyMotions.get(event.bossId);
        if (boss) boss.releaseAgeSeconds = 0;
      }
    }
  }

  private advanceMotionRuntime(
    runtime: CharacterMotionRuntime,
    position: number,
    deltaSeconds: number,
  ): void {
    const travel = position - runtime.lastPosition;
    runtime.travelDistance += Math.abs(travel);
    runtime.wheelRotation += travel * 0.92;
    runtime.lastPosition = position;
    runtime.releaseAgeSeconds += deltaSeconds;
    runtime.hitAgeSeconds += deltaSeconds;
  }

  private updateExhaustPuffs(
    playerPosition: number,
    playerVelocity: number,
    deltaSeconds: number,
  ): void {
    this.exhaustEmissionSeconds -= deltaSeconds;
    const speed = Math.abs(playerVelocity);
    if (speed > 0.75 && this.exhaustEmissionSeconds <= 0) {
      this.exhaustPuffs.push({
        worldPosition: playerPosition - 3.4,
        ageSeconds: 0,
        durationSeconds: 0.68,
      });
      this.exhaustEmissionSeconds = Math.max(0.13, 0.24 - speed * 0.008);
    }
    for (let index = this.exhaustPuffs.length - 1; index >= 0; index -= 1) {
      const puff = this.exhaustPuffs[index]!;
      puff.ageSeconds += deltaSeconds;
      puff.worldPosition -= deltaSeconds * 0.75;
      if (puff.ageSeconds >= puff.durationSeconds) {
        this.exhaustPuffs.splice(index, 1);
      }
    }
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
          this.emitEffect({
            kind: 'muzzle',
            worldPosition: state.player.position + 4,
            ageSeconds: 0,
            durationSeconds: 0.14,
            weaponId: event.weaponId,
          });
        } else if (
          event.type === 'projectile-hit' &&
          targetPosition !== undefined
        ) {
          this.emitEffect({
            kind:
              event.weaponId === 'rocket-launcher' ||
              event.weaponId === 'mine-launcher'
                ? 'explosion'
                : 'hit',
            worldPosition: targetPosition,
            ageSeconds: 0,
            durationSeconds: 0.35,
            weaponId: event.weaponId,
          });
        } else if (event.type === 'enemy-killed') {
          const position = this.knownEntityPositions.get(event.enemyId);
          if (position !== undefined) {
            this.emitEffect({
              kind: 'explosion',
              worldPosition: position,
              ageSeconds: 0,
              durationSeconds: 0.45,
            });
          }
        } else if (event.type === 'overheated') {
          this.emitEffect({
            kind: 'smoke',
            worldPosition: state.player.position,
            ageSeconds: 0,
            durationSeconds: 1.2,
          });
        }
      }
    }

    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index]!;
      effect.ageSeconds += deltaSeconds;
      if (effect.ageSeconds >= effect.durationSeconds) {
        this.effects.splice(index, 1);
        this.recycledEffects.push(effect);
      }
    }
  }

  private drawEffects(): void {
    const context = this.context;
    for (const effect of this.effects) {
      const progress = effect.ageSeconds / effect.durationSeconds;
      const x = this.worldToScreen(effect.worldPosition);
      const y =
        effect.kind === 'muzzle'
          ? this.groundY -
            Math.min(190, Math.max(118, this.viewportHeight * 0.25)) * 0.65
          : this.groundY -
            Math.min(80, Math.max(44, this.viewportHeight * 0.09));
      if (effect.kind === 'smoke') {
        context.save();
        context.globalAlpha = 1 - progress;
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
        context.restore();
        continue;
      }

      const family = effect.weaponId
        ? WEAPON_VFX_FAMILY[effect.weaponId]
        : 'explosive';
      const pose: VfxPose = effect.kind === 'muzzle' ? 'muzzle' : 'impact';
      if (!this.drawGeneratedVfx(family, pose, x, y, progress)) {
        this.drawFallbackVfx(effect, x, y, progress);
      }
      this.drawVfxParticles(effect, family, x, y, progress);
    }
  }

  private drawGeneratedVfx(
    family: VfxFamily,
    pose: VfxPose,
    x: number,
    y: number,
    progress: number,
  ): boolean {
    const asset = VFX_ART[family];
    const image = this.assets.get(asset.source);
    if (!image) return false;
    const [sourceX, sourceY, sourceWidth, sourceHeight] = getVfxSource(
      image.naturalWidth,
      image.naturalHeight,
      pose,
    );
    const baseSize = Math.min(
      pose === 'muzzle' ? 108 : 132,
      Math.max(58, this.viewportHeight * (pose === 'muzzle' ? 0.1 : 0.12)),
    );
    const familyScale =
      pose === 'muzzle' ? asset.muzzleScale : asset.impactScale;
    const growth =
      pose === 'muzzle'
        ? 0.8 + Math.sin(progress * Math.PI) * 0.28
        : 0.62 + Math.sin(Math.min(1, progress) * Math.PI * 0.78) * 0.5;
    const size = baseSize * familyScale * growth;
    const left =
      pose === 'muzzle' ? x - size * asset.muzzleOriginX : x - size / 2;
    const context = this.context;
    context.save();
    context.globalAlpha = Math.min(1, (1 - progress) * 1.9);
    context.shadowColor =
      family === 'energy'
        ? '#67e7ef'
        : family === 'fire' || family === 'explosive'
          ? '#ff9c43'
          : '#ffe174';
    context.shadowBlur = 8 + size * 0.08;
    if (pose === 'impact') {
      context.translate(x, y);
      context.rotate((family === 'energy' ? 0.16 : -0.08) * progress);
      context.translate(-x, -y);
    }
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      left,
      y - size / 2,
      size,
      size,
    );
    context.restore();
    return true;
  }

  private drawVfxParticles(
    effect: VisualEffect,
    family: VfxFamily,
    x: number,
    y: number,
    progress: number,
  ): void {
    const context = this.context;
    const accent = effect.weaponId
      ? PROJECTILE_COLORS[effect.weaponId]
      : '#ff9c43';
    context.save();
    context.globalAlpha = Math.max(0, (1 - progress) * 0.55);
    context.strokeStyle = accent;
    context.lineWidth = family === 'explosive' ? 4 : 2.5;
    context.beginPath();
    context.arc(x, y, 10 + progress * 34, 0, Math.PI * 2);
    context.stroke();

    if (effect.kind === 'muzzle') {
      context.fillStyle = 'rgba(48, 57, 76, 0.72)';
      for (let index = 0; index < 2; index += 1) {
        context.beginPath();
        context.arc(
          x - 7 - progress * (14 + index * 8),
          y - 4 - index * 5,
          2.5 + progress * 4,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    } else {
      context.fillStyle = family === 'explosive' ? '#36405a' : accent;
      const count = family === 'explosive' ? 7 : 5;
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + 0.35;
        const distance = 22 + progress * (family === 'explosive' ? 48 : 34);
        context.beginPath();
        context.arc(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance,
          Math.max(1.5, 4 - progress * 2),
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      if (family === 'explosive') {
        context.fillStyle = 'rgba(178, 137, 93, 0.35)';
        context.beginPath();
        context.ellipse(
          x,
          this.groundY - 3,
          28 + progress * 42,
          5 + progress * 5,
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
    context.restore();
  }

  private drawFallbackVfx(
    effect: VisualEffect,
    x: number,
    y: number,
    progress: number,
  ): void {
    const context = this.context;
    context.save();
    context.globalAlpha = 1 - progress;
    context.fillStyle = effect.weaponId
      ? PROJECTILE_COLORS[effect.weaponId]
      : '#ff9c43';
    this.drawBurst(
      x,
      y,
      14 + progress * (effect.kind === 'explosion' ? 48 : 28),
      8,
      0.42,
    );
    context.restore();
  }

  private emitEffect(effect: VisualEffect): void {
    const recycled = this.recycledEffects.pop();
    if (recycled) {
      recycled.kind = effect.kind;
      recycled.worldPosition = effect.worldPosition;
      recycled.ageSeconds = effect.ageSeconds;
      recycled.durationSeconds = effect.durationSeconds;
      recycled.weaponId = effect.weaponId;
      this.effects.push(recycled);
    } else {
      this.effects.push(effect);
    }
    if (this.effects.length > 96) {
      this.recycledEffects.push(this.effects.shift()!);
    }
  }

  private drawProjectile(
    x: number,
    weaponId: WeaponId,
    behavior: SimulationState['projectiles'][number]['behavior'],
  ): void {
    const context = this.context;
    const y =
      this.groundY - Math.min(70, Math.max(42, this.viewportHeight * 0.075));
    const color = PROJECTILE_COLORS[weaponId];
    context.save();
    if (weaponId === 'railgun') {
      context.strokeStyle = 'rgb(119 231 255 / 38%)';
      context.lineWidth = 8;
      context.beginPath();
      context.moveTo(x - 44, y);
      context.lineTo(x + 8, y);
      context.stroke();
      context.strokeStyle = '#eaffff';
      context.lineWidth = 2;
      context.stroke();
    } else if (behavior === 'flame') {
      for (let index = 3; index >= 0; index -= 1) {
        context.globalAlpha = 0.35 + index * 0.14;
        context.fillStyle = index < 2 ? '#ff7a3d' : '#fff16a';
        context.beginPath();
        context.arc(
          x - index * 5,
          y + (index % 2) * 3,
          5 + index,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    } else {
      context.strokeStyle = color;
      context.globalAlpha = 0.45;
      context.lineWidth = weaponId === 'rocket-launcher' ? 5 : 3;
      context.beginPath();
      context.moveTo(x - 18, y);
      context.lineTo(x, y);
      context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, weaponId === 'mine-launcher' ? 6 : 3.5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  private drawBurst(
    x: number,
    y: number,
    radius: number,
    points: number,
    innerRatio: number,
  ): void {
    const context = this.context;
    context.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
      const angle = -Math.PI / 2 + (Math.PI * index) / points;
      const distance = index % 2 === 0 ? radius : radius * innerRatio;
      const pointX = x + Math.cos(angle) * distance;
      const pointY = y + Math.sin(angle) * distance;
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    }
    context.closePath();
    context.fill();
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

  private drawInstalledModule(
    source: string,
    centerX: number,
    centerY: number,
    width: number,
    rotationDegrees: number,
  ): void {
    const image = this.assets.get(source);
    if (!image) return;
    const context = this.context;
    const height = width * (image.naturalHeight / image.naturalWidth);
    const clampWidth = Math.max(2, width * 0.13);
    const boltRadius = Math.max(0.9, width * 0.045);

    context.save();
    context.translate(centerX, centerY);
    context.rotate((rotationDegrees * Math.PI) / 180);

    // The connector and cradle sit behind the equipment illustration.
    context.fillStyle = '#27344b';
    context.strokeStyle = '#172238';
    context.lineWidth = Math.max(1, width * 0.055);
    context.beginPath();
    context.roundRect(
      width * 0.28,
      -height * 0.2,
      width * 0.42,
      height * 0.4,
      height * 0.12,
    );
    context.fill();
    context.stroke();
    context.beginPath();
    context.roundRect(
      -width * 0.54,
      -height * 0.47,
      width * 1.08,
      height * 0.94,
      height * 0.2,
    );
    context.stroke();

    context.shadowColor = 'rgba(20, 29, 48, 0.5)';
    context.shadowBlur = width * 0.12;
    context.shadowOffsetY = width * 0.06;
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;

    // Coral retainers and cyan bolts remain in front, visibly trapping the
    // acquired device in the chassis rail rather than reading as a sticker.
    context.fillStyle = '#ef715f';
    context.strokeStyle = '#27344b';
    context.lineWidth = Math.max(1, width * 0.045);
    for (const x of [-width * 0.36, width * 0.36]) {
      context.beginPath();
      context.roundRect(
        x - clampWidth / 2,
        -height * 0.42,
        clampWidth,
        height * 0.84,
        clampWidth / 2,
      );
      context.fill();
      context.stroke();
      for (const y of [-height * 0.3, height * 0.3]) {
        context.fillStyle = '#70e5e7';
        context.beginPath();
        context.arc(x, y, boltRadius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ef715f';
      }
    }
    context.restore();
  }

  private weaponRecoil(weaponId: WeaponId): number {
    let recoil = 0;
    for (const effect of this.effects) {
      if (effect.kind !== 'muzzle' || effect.weaponId !== weaponId) continue;
      recoil = Math.max(recoil, 1 - effect.ageSeconds / effect.durationSeconds);
    }
    return recoil;
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
