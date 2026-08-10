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
  PLAYER_MOTION_ART,
  PLAYER_RIG_ART,
  type CharacterMotionPose,
  type PlayerRigPart,
} from './animationAssets';
import { SpriteAssetManager } from './SpriteAssetManager';

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
  private playerPitch = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    this.context = context;
    this.assets.preload([
      ...Object.values(WORLD_ART),
      PLAYER_MOTION_ART.source,
      PLAYER_RIG_ART.source,
      ...Object.values(ENEMY_MOTION_ART).map(({ source }) => source),
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
    const player = this.assets.get(PLAYER_MOTION_ART.source);
    if (player) {
      const width = Math.min(190, Math.max(118, this.viewportHeight * 0.25));
      const size = width * PLAYER_MOTION_ART.displayScale;
      const recoil = this.weaponRecoil(primaryWeaponId);
      const hitOffset = this.hitOffset(this.playerMotion, -1);
      const recoilSink = Math.sin(recoil * Math.PI) * width * 0.018;
      const rig = this.assets.get(PLAYER_RIG_ART.source);
      context.save();
      context.translate(x + hitOffset, groundY);
      if (overheated) {
        context.shadowColor = '#ff5d5d';
        context.shadowBlur = 18;
        context.globalAlpha = 0.92;
      }
      context.save();
      context.translate(0, recoilSink);
      context.rotate(this.playerPitch - recoil * 0.012);
      this.drawMotionFrame(
        player,
        'idle',
        -size * 0.5,
        -size * PLAYER_MOTION_ART.groundAnchor,
        size,
      );
      this.drawEquipmentSprite(
        WEAPON_ART[primaryWeaponId],
        width * (0.12 - recoil * 0.05),
        -width * 0.72,
        width * 0.56,
        -4,
      );
      this.drawEquipmentSprite(
        WEAPON_ART[secondaryWeaponId],
        -width * 0.08,
        -width * 0.84,
        width * 0.34,
        2,
      );
      for (let index = 0; index < moduleIds.length; index += 1) {
        const column = index % 2;
        const row = Math.floor(index / 2);
        this.drawEquipmentSprite(
          MODULE_ART[moduleIds[index]!],
          -width * (0.29 - column * 0.14),
          -width * (0.55 - row * 0.14),
          width * 0.2,
          index % 2 === 0 ? -4 : 4,
        );
      }
      context.restore();
      if (rig) {
        const wheelRotation = this.playerMotion.wheelRotation;
        this.drawPlayerRigPart(
          rig,
          'wheel',
          -width * 0.28,
          -width * 0.12,
          width * 0.25,
          wheelRotation,
        );
        this.drawPlayerRigPart(
          rig,
          'wheel',
          width * 0.02,
          -width * 0.12,
          width * 0.29,
          wheelRotation,
        );
        this.drawPlayerRigPart(
          rig,
          'wheel',
          width * 0.31,
          -width * 0.11,
          width * 0.23,
          wheelRotation,
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
    const targetPitch = Math.max(
      -0.03,
      Math.min(0.03, -state.player.velocity * 0.0025),
    );
    const pitchResponse = 1 - Math.exp(-deltaSeconds * 5);
    this.playerPitch += (targetPitch - this.playerPitch) * pitchResponse;
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
            Math.min(190, Math.max(118, this.viewportHeight * 0.25)) * 0.52
          : this.groundY -
            Math.min(80, Math.max(44, this.viewportHeight * 0.09));
      context.save();
      if (effect.kind === 'muzzle') {
        const accent = effect.weaponId
          ? PROJECTILE_COLORS[effect.weaponId]
          : '#fff4a3';
        context.globalAlpha = 1 - progress;
        context.strokeStyle = accent;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(x, y, 8 + progress * 22, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = '#fffdf0';
        context.beginPath();
        context.ellipse(
          x + 10,
          y,
          17 * (1 - progress * 0.45),
          5,
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.fillStyle = accent;
        this.drawBurst(x + 8, y, 18 + progress * 18, 7, 0.34);
        context.fillStyle = 'rgb(68 72 84 / 55%)';
        for (let index = 0; index < 3; index += 1) {
          context.beginPath();
          context.arc(
            x - 4 - progress * (10 + index * 5),
            y - 3 - index * 4,
            3 + progress * 4,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        context.strokeStyle = '#d89945';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x - 5, y + 5);
        context.lineTo(x - 13 - progress * 17, y + 13 + progress * 10);
        context.stroke();
      } else if (effect.kind === 'hit') {
        context.globalAlpha = 1 - progress;
        context.fillStyle = '#ffffff';
        this.drawBurst(x, y, 10 + progress * 26, 8, 0.45);
        context.strokeStyle = effect.weaponId
          ? PROJECTILE_COLORS[effect.weaponId]
          : '#fff4a3';
        context.lineWidth = 3;
        for (let index = 0; index < 7; index += 1) {
          const angle = (Math.PI * 2 * index) / 7 + 0.2;
          const inner = 8 + progress * 10;
          const outer = 18 + progress * 35;
          context.beginPath();
          context.moveTo(
            x + Math.cos(angle) * inner,
            y + Math.sin(angle) * inner,
          );
          context.lineTo(
            x + Math.cos(angle) * outer,
            y + Math.sin(angle) * outer,
          );
          context.stroke();
        }
      } else if (effect.kind === 'explosion') {
        const growth = Math.sin(Math.min(1, progress) * Math.PI * 0.72);
        const radius = 16 + growth * 42;
        context.globalAlpha = Math.min(1, (1 - progress) * 1.6);
        for (let index = 0; index < 8; index += 1) {
          const angle = (Math.PI * 2 * index) / 8 + 0.3;
          const orbit = radius * (0.28 + (index % 3) * 0.08);
          const lobe = radius * (0.32 + (index % 2) * 0.1);
          context.fillStyle = index % 3 === 0 ? '#ff743d' : '#f5b83f';
          context.beginPath();
          context.arc(
            x + Math.cos(angle) * orbit,
            y + Math.sin(angle) * orbit,
            lobe,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        context.fillStyle = progress < 0.45 ? '#fffbd2' : '#ff8b43';
        context.beginPath();
        context.arc(x, y, radius * (0.48 - progress * 0.12), 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgb(63 57 70 / 78%)';
        for (let index = 0; index < 5; index += 1) {
          const angle = -2.7 + index * 0.48;
          context.beginPath();
          context.arc(
            x + Math.cos(angle) * radius * (0.45 + progress),
            y + Math.sin(angle) * radius * (0.3 + progress * 0.65),
            5 + progress * 9,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        context.strokeStyle = '#554657';
        context.lineWidth = 3;
        for (let index = 0; index < 6; index += 1) {
          const angle = -2.8 + index * 0.55;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(
            x + Math.cos(angle) * radius * (0.8 + progress),
            y + Math.sin(angle) * radius * (0.8 + progress),
          );
          context.stroke();
        }
        context.fillStyle = 'rgb(226 189 131 / 65%)';
        context.beginPath();
        context.ellipse(
          x,
          this.groundY - 3,
          radius * 0.9,
          radius * 0.18,
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
      } else {
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
      }
      context.restore();
    }
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
