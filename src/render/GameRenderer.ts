import { drawBattlefieldObjectiveField } from './battlefieldObjectiveField';
import { drawBreakthroughField } from './breakthroughField';
import type { EnemyTypeId, ModuleId, WeaponId } from '../game/data/ids';
import {
  createPresentationSnapshot,
  interpolatePosition,
} from '../game/simulation/presentationSnapshot';
import type {
  EnemyProjectileVisualId,
  EnemyState,
  LootKind,
  SimulationState,
  WeaponSlot,
} from '../game/simulation/types';
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
  BOSS_PHASE_AURA_ART,
  getBossPhaseAuraSource,
  type BossPhase,
} from './bossPhaseAssets';
import { ENEMY_DEATH_VFX_ART, getEnemyDeathVfxSource } from './deathVfxAssets';
import { ENEMY_VFX_ART, getEnemyVfxSource } from './enemyVfxAssets';
import {
  BOOST_TRAIL_ART,
  getBoostTrailSource,
  getVfxSource,
  MINE_VFX_ART,
  PARRY_VFX_ART,
  VFX_ART,
  WEAPON_VFX_FAMILY,
  type VfxFamily,
  type VfxPose,
} from './vfxAssets';
import {
  getCameraShakeOffset,
  getEnemyHitStopDuration,
  getPlayerDamageShake,
  type CameraShakeSpec,
} from './combatFeedback';
import { runtimeAssetUrl } from '../runtimeAssets';
import { SUPPLY_ART } from './supplyAssets';

const WORLD_MINIMUM = 0;
const WORLD_MAXIMUM = 100;
export const MAX_ACTIVE_EFFECTS = 96;
export const MAX_RECYCLED_EFFECTS = 96;
const PERFORMANCE_SAMPLE_LIMIT = 240;
const PERFORMANCE_STRESS_PLAYER_PROJECTILES = 100;
const PERFORMANCE_STRESS_ENEMY_PROJECTILES = 32;
const PERFORMANCE_STRESS_EFFECTS = 48;
const PLAYER_HEIGHT_RATIO = 0.3;
const PLAYER_MINIMUM_SIZE = 120;
const PLAYER_MAXIMUM_SIZE = 240;
const ENEMY_HEIGHT_RATIOS: Readonly<Record<EnemyTypeId, number>> = {
  basic: 0.18,
  rusher: 0.22,
  heavy: 0.25,
  artillery: 0.25,
  bomber: 0.18,
  'kawaii-fortress': 0.46,
};
const WORLD_ART = {
  background: runtimeAssetUrl(
    'assets/world/env_background_integrated_2x1_v005.webp',
  ),
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
  kind:
    | 'muzzle'
    | 'hit'
    | 'explosion'
    | 'smoke'
    | 'contact'
    | 'death'
    | 'boss-death'
    | 'bomber-burst'
    | 'parry-ready'
    | 'parry-success'
    | 'loot'
    | 'supply-drop';
  worldPosition: number;
  ageSeconds: number;
  durationSeconds: number;
  weaponId?: WeaponId;
  vfxFamily?: VfxFamily;
  enemyVisualId?: EnemyProjectileVisualId;
  enemyTypeId?: EnemyTypeId;
  lootKind?: LootKind;
  weaponSlot?: WeaponSlot;
}

interface CharacterMotionRuntime {
  travelDistance: number;
  lastPosition: number;
  wheelRotation: number;
  releaseAgeSeconds: number;
  hitAgeSeconds: number;
  phaseTransitionAgeSeconds: number;
  phaseClockSeconds: number;
  hitStopRemainingSeconds: number;
  hitStopWorldPosition?: number;
}

interface ExhaustPuff {
  worldPosition: number;
  ageSeconds: number;
  durationSeconds: number;
}

type DeathVfxPreview =
  'normal' | 'boss' | 'bomber' | 'basic' | 'rusher' | 'heavy';
type ParryVfxPreview = 'ready' | 'success';

export interface RendererDiagnostics {
  renderDurationsMs: number[];
  activeEffects: number;
  recycledEffects: number;
  maximumActiveEffects: number;
  maximumRecycledEffects: number;
  stressPlayerProjectiles: number;
  stressEnemyProjectiles: number;
  reducedMotion: boolean;
  activeEnemyHitStops: number;
  cameraShakeRemainingSeconds: number;
  assets: ReturnType<SpriteAssetManager['getDiagnostics']>;
}

const createMotionRuntime = (position: number): CharacterMotionRuntime => ({
  travelDistance: 0,
  lastPosition: position,
  wheelRotation: 0,
  releaseAgeSeconds: Number.POSITIVE_INFINITY,
  hitAgeSeconds: Number.POSITIVE_INFINITY,
  phaseTransitionAgeSeconds: Number.POSITIVE_INFINITY,
  phaseClockSeconds: 0,
  hitStopRemainingSeconds: 0,
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
  private highEffectLoad = false;
  private readonly renderDurationsMs: number[] = [];
  private readonly reducedMotionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );
  private reducedMotion = this.reducedMotionQuery.matches;
  private cameraShakeAgeSeconds = Number.POSITIVE_INFINITY;
  private cameraShakeSpec: CameraShakeSpec = {
    durationSeconds: 0,
    amplitudePixels: 0,
  };
  private cameraShakePhaseRadians = 0;
  private readonly diagnosticsEnabled = new URLSearchParams(
    window.location.search,
  ).has('debug');
  private readonly performanceStress =
    new URLSearchParams(window.location.search).get('debug') === 'performance';
  private readonly showMotionDebug =
    new URLSearchParams(window.location.search).get('debug') === 'motion';
  private readonly bossPreviewPhase = this.readBossPreviewPhase();
  private readonly enemyVfxPreview = this.readEnemyVfxPreview();
  private readonly deathVfxPreview = this.readDeathVfxPreview();
  private readonly parryVfxPreview = this.readParryVfxPreview();
  private readonly mineVfxPreview = new URLSearchParams(
    window.location.search,
  ).get('mineVfx');

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
      BOOST_TRAIL_ART.source,
      PARRY_VFX_ART.readySource,
      PARRY_VFX_ART.successSource,
      MINE_VFX_ART.source,
      ...Object.values(ENEMY_VFX_ART).map(({ source }) => source),
      ENEMY_DEATH_VFX_ART.source,
      BOSS_PHASE_AURA_ART.source,
      ...Object.values(SUPPLY_ART),
    ]);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.reducedMotionQuery.addEventListener(
      'change',
      this.handleReducedMotionChange,
    );
    if (this.performanceStress) this.seedPerformanceStressEffects();
    this.resize();
  }

  render(state: SimulationState, alpha: number): void {
    const renderStartedAt = performance.now();
    const context = this.context;
    const snapshot = createPresentationSnapshot(state);
    const now = performance.now();
    const deltaSeconds = Math.min(0.05, (now - this.lastRenderTime) / 1000);
    this.lastRenderTime = now;
    this.cameraShakeAgeSeconds += deltaSeconds;
    this.updateEffects(state, deltaSeconds);
    this.updateCharacterMotions(state, deltaSeconds);
    this.highEffectLoad =
      this.performanceStress ||
      state.projectiles.length >= 80 ||
      state.enemyProjectiles.length >= 24 ||
      this.effects.length >= 40;
    const scale = window.devicePixelRatio || 1;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    const cameraOffset = getCameraShakeOffset(
      this.cameraShakeAgeSeconds,
      this.cameraShakeSpec,
      this.cameraShakePhaseRadians,
    );
    if (cameraOffset.x !== 0 || cameraOffset.y !== 0) {
      this.drawEnvironment();
    }
    context.save();
    context.translate(cameraOffset.x, cameraOffset.y);
    this.drawEnvironment();
    drawBreakthroughField(
      this.context,
      state,
      (position) => this.worldToScreen(position),
      this.groundY,
      this.reducedMotion,
    );
    drawBattlefieldObjectiveField(
      context,
      state,
      (position) => this.worldToScreen(position),
      this.groundY,
    );
    this.drawExhaustPuffs();

    for (const item of state.loot) {
      this.drawSupplyLoot(
        this.worldToScreen(
          item.previousPosition +
            (item.position - item.previousPosition) * alpha,
        ),
        item.kind,
        item.ageSeconds,
      );
    }

    const playerX = this.worldToScreen(
      interpolatePosition(snapshot.player, alpha),
    );
    this.drawCaravan(
      playerX,
      this.groundY,
      state.build.primaryWeaponId,
      state.build.secondaryWeaponId,
      state.build.moduleIds,
      state.player.weaponHeat.primary.overheated,
      state.player.weaponHeat.secondary.overheated,
      state.player.boosting,
      Math.sign(state.player.velocity) as -1 | 0 | 1,
    );

    for (const enemy of state.enemies) {
      const runtime = this.enemyMotions.get(enemy.id);
      const interpolatedPosition =
        enemy.previousPosition +
        (enemy.position - enemy.previousPosition) * alpha;
      this.drawMonster(
        this.worldToScreen(
          runtime !== undefined &&
            runtime.hitStopRemainingSeconds > 0 &&
            runtime.hitStopWorldPosition !== undefined
            ? runtime.hitStopWorldPosition
            : interpolatedPosition,
        ),
        this.groundY,
        enemy,
      );
    }

    if (this.bossPreviewPhase !== undefined) {
      this.drawBossPreview(this.bossPreviewPhase);
    }

    if (this.enemyVfxPreview !== undefined) {
      this.drawEnemyVfxPreview(this.enemyVfxPreview);
    }

    if (this.deathVfxPreview !== undefined) {
      this.drawDeathVfxPreview(this.deathVfxPreview);
    }

    if (this.mineVfxPreview === 'armed' || this.mineVfxPreview === '1') {
      this.drawMineDeployable(this.worldToScreen(56), 1.25, 12);
    } else if (this.mineVfxPreview === 'detonate') {
      const x = this.worldToScreen(56);
      const y =
        this.groundY - Math.min(38, Math.max(24, this.viewportHeight * 0.045));
      this.drawGeneratedVfx('explosive', 'impact', x, y, 0.22);
      this.drawMineDetonationAccent(x, y, 0.22);
    }

    for (const projectile of state.enemyProjectiles) {
      const x = this.worldToScreen(
        projectile.previousPosition +
          (projectile.position - projectile.previousPosition) * alpha,
      );
      this.drawEnemyProjectile(x, projectile.visualId);
    }

    for (const projectile of state.projectiles) {
      const x = this.worldToScreen(
        projectile.previousPosition +
          (projectile.position - projectile.previousPosition) * alpha,
      );
      this.drawProjectile(
        x,
        projectile.weaponId,
        projectile.behavior,
        projectile.ageSeconds,
        projectile.maximumAgeSeconds,
      );
    }
    if (this.performanceStress) this.drawPerformanceStressProjectiles();
    this.drawEffects(playerX);
    context.restore();

    this.knownEntityPositions.set(state.player.id, state.player.position);
    for (const enemy of state.enemies) {
      this.knownEntityPositions.set(enemy.id, enemy.position);
    }
    this.recordDiagnostics(performance.now() - renderStartedAt);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.reducedMotionQuery.removeEventListener(
      'change',
      this.handleReducedMotionChange,
    );
    this.effects.length = 0;
    this.recycledEffects.length = 0;
    this.exhaustPuffs.length = 0;
    this.knownEntityPositions.clear();
    this.enemyMotions.clear();
    this.assets.dispose();
    delete (
      window as typeof window & {
        __kaboomRendererDiagnostics?: RendererDiagnostics;
      }
    ).__kaboomRendererDiagnostics;
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
      const sky = context.createLinearGradient(0, 0, 0, this.viewportHeight);
      sky.addColorStop(0, '#77c8ef');
      sky.addColorStop(0.66, '#e7f5d0');
      sky.addColorStop(0.67, '#a8c982');
      sky.addColorStop(1, '#d8b684');
      context.fillStyle = sky;
      context.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    }
  }

  private drawCaravan(
    x: number,
    groundY: number,
    primaryWeaponId: WeaponId,
    secondaryWeaponId: WeaponId,
    moduleIds: ModuleId[],
    primaryOverheated: boolean,
    secondaryOverheated: boolean,
    isBoosting: boolean,
    boostDirection: -1 | 0 | 1,
  ): void {
    const context = this.context;
    const player = this.assets.get(PLAYER_CHASSIS_ART.source);
    if (player) {
      const width = this.caravanSize;
      const size = width * PLAYER_CHASSIS_ART.displayScale;
      const recoil = this.weaponRecoil(primaryWeaponId);
      const hitOffset = this.hitOffset(this.playerMotion, -1);
      const isHitFlashing = this.playerMotion.hitAgeSeconds < 0.12;
      if (isBoosting && boostDirection !== 0 && !this.reducedMotion) {
        this.drawBoostStreaks(x, groundY, width, boostDirection);
      }
      context.save();
      context.translate(x + hitOffset, groundY);
      if (isBoosting && boostDirection !== 0 && !this.reducedMotion) {
        context.rotate(-boostDirection * 0.025);
      }
      if (isHitFlashing) {
        context.filter = 'brightness(1.7) saturate(0.65) sepia(0.2)';
      }
      if (primaryOverheated && secondaryOverheated) {
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
        primaryOverheated,
      );
      this.drawEquipmentSprite(
        WEAPON_ART[secondaryWeaponId],
        -width * 0.2,
        -width * 0.62,
        width * 0.29,
        2,
        secondaryOverheated,
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
    if (isBoosting && boostDirection !== 0 && !this.reducedMotion) {
      this.drawBoostStreaks(0, 0, 90, boostDirection);
      context.rotate(-boostDirection * 0.025);
    }

    if (primaryOverheated && secondaryOverheated) {
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

  private drawBoostStreaks(
    x: number,
    groundY: number,
    width: number,
    direction: -1 | 1,
  ): void {
    const context = this.context;
    const image = this.assets.get(BOOST_TRAIL_ART.source);
    if (!image) return;
    const pose =
      Math.floor(
        this.playerMotion.phaseClockSeconds / BOOST_TRAIL_ART.frameSeconds,
      ) %
        2 ===
      0
        ? 'stream'
        : 'surge';
    const [sourceX, sourceY, sourceWidth, sourceHeight] = getBoostTrailSource(
      image.naturalWidth,
      image.naturalHeight,
      pose,
    );
    const size = width * BOOST_TRAIL_ART.displayScale;
    const centerX = x - direction * width * 0.68;
    const centerY = groundY - width * 0.37;
    context.save();
    context.translate(centerX, centerY);
    context.scale(direction, 1);
    context.globalAlpha = pose === 'stream' ? 0.8 : 0.9;
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -size * 0.5,
      -size * 0.5,
      size,
      size,
    );
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

  private drawMonster(x: number, groundY: number, enemy: EnemyState): void {
    const context = this.context;
    const typeId = enemy.typeId;
    const motionAsset = ENEMY_MOTION_ART[typeId];
    const monster = this.assets.get(motionAsset.source);
    if (monster) {
      const size = this.enemySize(typeId);
      const runtime = this.enemyMotions.get(enemy.id);
      const pose = this.selectEnemyPose(enemy, runtime);
      const hitOffset = runtime ? this.hitOffset(runtime, 1) : 0;
      if (enemy.elite) {
        context.save();
        context.globalAlpha =
          0.38 + Math.sin(runtime?.phaseClockSeconds ?? 0) * 0.08;
        context.strokeStyle = '#ffd05a';
        context.fillStyle = 'rgb(255 113 110 / 12%)';
        context.lineWidth = 5;
        context.beginPath();
        context.ellipse(
          x + hitOffset,
          groundY - size * 0.43,
          size * 0.48,
          size * 0.42,
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.stroke();
        context.restore();
      }
      context.save();
      if (runtime && runtime.hitAgeSeconds < 0.1) {
        context.filter = 'brightness(1.75) saturate(0.55)';
      }
      this.drawMotionFrame(
        monster,
        pose,
        x - size * 0.5 + hitOffset,
        groundY - size * motionAsset.groundAnchor,
        size,
      );
      context.restore();
      if (typeId === 'kawaii-fortress') {
        this.drawBossPhaseAura(
          x + hitOffset,
          groundY,
          size,
          enemy.bossPhase ?? 1,
          pose,
          runtime,
        );
      }
      if (typeId === 'kawaii-fortress' && pose === 'anticipation') {
        this.drawBossAttackTelegraph(
          x + hitOffset,
          groundY,
          size,
          enemy.bossPhase ?? 1,
          runtime,
        );
      }
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

  private drawBossPhaseAura(
    x: number,
    groundY: number,
    bossSize: number,
    phase: BossPhase,
    pose: CharacterMotionPose,
    runtime?: CharacterMotionRuntime,
  ): void {
    const aura = this.assets.get(BOSS_PHASE_AURA_ART.source);
    if (!aura) return;
    const [sourceX, sourceY, sourceWidth, sourceHeight] =
      getBossPhaseAuraSource(aura.naturalWidth, aura.naturalHeight, phase);
    const clock = this.reducedMotion
      ? 0
      : (runtime?.phaseClockSeconds ?? performance.now() / 1000);
    const transitionAge = runtime?.phaseTransitionAgeSeconds ?? 1;
    const transitionProgress = Math.min(1, transitionAge / 0.72);
    const transitionBounce =
      transitionProgress < 1
        ? 1 + Math.sin(transitionProgress * Math.PI) * 0.22
        : 1;
    const pulseAmount = phase === 1 ? 0.025 : phase === 2 ? 0.045 : 0.065;
    const pulse = this.reducedMotion
      ? 1
      : 1 + Math.sin(clock * (2.2 + phase * 0.8)) * pulseAmount;
    const auraSize =
      bossSize *
      BOSS_PHASE_AURA_ART.scaleByPhase[phase] *
      pulse *
      transitionBounce;
    const phaseAlpha = BOSS_PHASE_AURA_ART.alphaByPhase[phase];
    const anchorX = x - bossSize * (pose === 'release' ? 0.3 : 0.18);
    const anchorY = groundY - bossSize * (pose === 'release' ? 0.28 : 0.2);
    const direction = phase === 3 ? -1 : 1;

    const context = this.context;
    context.save();
    context.translate(anchorX, anchorY);
    context.rotate(
      clock * BOSS_PHASE_AURA_ART.rotationSpeedByPhase[phase] * direction,
    );
    context.globalAlpha = phaseAlpha;
    context.shadowColor = phase === 3 ? '#ff745d' : '#65e8ef';
    context.shadowBlur = Math.max(5, auraSize * 0.09);
    context.drawImage(
      aura,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -auraSize / 2,
      -auraSize / 2,
      auraSize,
      auraSize,
    );
    context.restore();
  }

  private drawBossAttackTelegraph(
    x: number,
    groundY: number,
    bossSize: number,
    phase: BossPhase,
    runtime?: CharacterMotionRuntime,
  ): void {
    const clock = this.reducedMotion
      ? 0
      : (runtime?.phaseClockSeconds ?? performance.now() / 1000);
    const pulse = this.reducedMotion ? 0.72 : 0.55 + Math.sin(clock * 12) * 0.2;
    const centerX = x - bossSize * 0.17;
    const centerY = groundY - bossSize * 0.4;
    const radius = bossSize * (0.17 + phase * 0.012);
    const context = this.context;
    context.save();
    context.globalAlpha = pulse;
    context.strokeStyle = phase === 3 ? '#ff6d57' : '#ffe06a';
    context.lineWidth = Math.max(2.5, bossSize * 0.015);
    context.lineCap = 'round';
    context.setLineDash([bossSize * 0.045, bossSize * 0.035]);
    context.beginPath();
    context.arc(centerX, centerY, radius, Math.PI * 1.06, Math.PI * 1.94);
    context.stroke();
    context.setLineDash([]);
    for (const direction of [-1, 1]) {
      const markerX = centerX + direction * radius * 0.82;
      context.beginPath();
      context.moveTo(markerX, centerY - radius * 0.32);
      context.lineTo(markerX + direction * bossSize * 0.04, centerY);
      context.lineTo(markerX, centerY + radius * 0.32);
      context.stroke();
    }
    context.restore();
  }

  private drawBossPreview(phase: BossPhase): void {
    const position = 71;
    const previewBoss: EnemyState = {
      id: 'debug-boss-preview',
      typeId: 'kawaii-fortress',
      behaviorId: 'bossFortress',
      previousPosition: position,
      position,
      radius: 5,
      hitPoints: 420,
      armor: 5,
      speed: 0,
      contactDamage: 24,
      contactCooldown: 0.1,
      attackRange: 52,
      attackDamage: 14,
      attackWindupSeconds: 0.55,
      attackCooldownSeconds: 2.8,
      frontlinePressure: 4,
      bossPhase: phase,
    };
    this.drawMonster(this.worldToScreen(position), this.groundY, previewBoss);
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
    const baseSize = this.caravanSize;
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
    runtime?: CharacterMotionRuntime,
  ): CharacterMotionPose {
    if (runtime?.releaseAgeSeconds !== undefined) {
      if (runtime.releaseAgeSeconds < 0.18) return 'release';
    }
    if (this.isEnemyAnticipating(enemy)) {
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

  private isEnemyAnticipating(enemy: EnemyState): boolean {
    return enemy.attackWindupRemaining !== undefined;
  }

  private hitOffset(
    runtime: CharacterMotionRuntime,
    direction: -1 | 1,
  ): number {
    if (runtime.hitAgeSeconds >= 0.2) return 0;
    const remaining = 1 - runtime.hitAgeSeconds / 0.2;
    return (
      direction * Math.sin(remaining * Math.PI) * (this.reducedMotion ? 2 : 4)
    );
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
      state.player.boosting,
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
      this.advanceMotionRuntime(runtime, enemy.position, deltaSeconds, 4.5);
    }
    for (const enemyId of this.enemyMotions.keys()) {
      if (!liveEnemyIds.has(enemyId)) this.enemyMotions.delete(enemyId);
    }

    if (state.tick === this.lastMotionTick) return;
    this.lastMotionTick = state.tick;
    for (const event of state.events) {
      if (event.type === 'weapon-fired') {
        this.playerMotion.releaseAgeSeconds = 0;
      } else if (event.type === 'skill-activated') {
        this.playerMotion.releaseAgeSeconds = 0;
      } else if (event.type === 'projectile-hit') {
        const target = this.enemyMotions.get(event.targetId);
        if (target) {
          target.hitAgeSeconds = 0;
          target.hitStopRemainingSeconds = Math.max(
            target.hitStopRemainingSeconds,
            getEnemyHitStopDuration(event.damage, this.reducedMotion),
          );
          target.hitStopWorldPosition = state.enemies.find(
            ({ id }) => id === event.targetId,
          )?.position;
        }
      } else if (event.type === 'attack-parried') {
        this.playerMotion.releaseAgeSeconds = 0;
        this.startCameraShake(event.counterDamage * 0.45, state.tick);
        const source = this.enemyMotions.get(event.sourceId);
        if (source) {
          source.hitAgeSeconds = 0;
          source.hitStopRemainingSeconds = Math.max(
            source.hitStopRemainingSeconds,
            getEnemyHitStopDuration(event.counterDamage, this.reducedMotion),
          );
          source.hitStopWorldPosition = state.enemies.find(
            ({ id }) => id === event.sourceId,
          )?.position;
        }
      } else if (event.type === 'enemy-attacked') {
        const attacker = this.enemyMotions.get(event.enemyId);
        if (attacker) attacker.releaseAgeSeconds = 0;
      } else if (event.type === 'vehicle-hit') {
        this.playerMotion.hitAgeSeconds = 0;
        this.startCameraShake(event.damage, state.tick);
        const attacker = this.enemyMotions.get(event.sourceId);
        if (attacker) attacker.releaseAgeSeconds = 0;
      } else if (event.type === 'enemy-projectile-hit') {
        this.playerMotion.hitAgeSeconds = 0;
        this.startCameraShake(event.damage, state.tick);
      } else if (event.type === 'boss-phase-changed') {
        const boss = this.enemyMotions.get(event.bossId);
        if (boss) {
          boss.releaseAgeSeconds = 0;
          boss.phaseTransitionAgeSeconds = 0;
        }
      }
    }
  }

  private advanceMotionRuntime(
    runtime: CharacterMotionRuntime,
    position: number,
    deltaSeconds: number,
    maximumTravelPerSecond = Number.POSITIVE_INFINITY,
  ): void {
    if (runtime.hitStopRemainingSeconds > 0) {
      runtime.hitStopRemainingSeconds = Math.max(
        0,
        runtime.hitStopRemainingSeconds - deltaSeconds,
      );
      runtime.lastPosition = position;
      if (runtime.hitStopRemainingSeconds === 0) {
        runtime.hitStopWorldPosition = undefined;
      }
      return;
    }
    const travel = position - runtime.lastPosition;
    runtime.travelDistance += Math.min(
      Math.abs(travel),
      maximumTravelPerSecond * deltaSeconds,
    );
    runtime.wheelRotation += travel * 0.92;
    runtime.lastPosition = position;
    runtime.releaseAgeSeconds += deltaSeconds;
    runtime.hitAgeSeconds += deltaSeconds;
    runtime.phaseTransitionAgeSeconds += deltaSeconds;
    runtime.phaseClockSeconds += deltaSeconds;
  }

  private startCameraShake(damage: number, tick: number): void {
    const nextShake = getPlayerDamageShake(damage, this.reducedMotion);
    const currentRemaining = Math.max(
      0,
      this.cameraShakeSpec.durationSeconds - this.cameraShakeAgeSeconds,
    );
    const currentProgress =
      this.cameraShakeSpec.durationSeconds > 0
        ? Math.min(
            1,
            this.cameraShakeAgeSeconds / this.cameraShakeSpec.durationSeconds,
          )
        : 1;
    const currentAmplitude =
      this.cameraShakeSpec.amplitudePixels * (1 - currentProgress) ** 2;
    this.cameraShakeSpec = {
      durationSeconds: Math.max(nextShake.durationSeconds, currentRemaining),
      amplitudePixels: Math.max(nextShake.amplitudePixels, currentAmplitude),
    };
    this.cameraShakeAgeSeconds = 0;
    this.cameraShakePhaseRadians = (tick % 17) * 0.37;
  }

  private updateExhaustPuffs(
    playerPosition: number,
    playerVelocity: number,
    isBoosting: boolean,
    deltaSeconds: number,
  ): void {
    if (this.reducedMotion) {
      this.exhaustPuffs.length = 0;
      return;
    }
    this.exhaustEmissionSeconds -= deltaSeconds;
    const speed = Math.abs(playerVelocity);
    if (speed > 0.75 && this.exhaustEmissionSeconds <= 0) {
      this.exhaustPuffs.push({
        worldPosition: playerPosition - 3.4,
        ageSeconds: 0,
        durationSeconds: isBoosting ? 0.82 : 0.68,
      });
      this.exhaustEmissionSeconds = isBoosting
        ? 0.045
        : Math.max(0.13, 0.24 - speed * 0.008);
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
        } else if (event.type === 'enemy-contact-released') {
          this.emitEffect({
            kind: event.enemyTypeId === 'bomber' ? 'bomber-burst' : 'contact',
            worldPosition: event.contactPosition,
            ageSeconds: 0,
            durationSeconds: event.enemyTypeId === 'bomber' ? 0.5 : 0.28,
            vfxFamily: event.enemyTypeId === 'bomber' ? 'explosive' : undefined,
            enemyTypeId: event.enemyTypeId,
          });
        } else if (event.type === 'enemy-killed') {
          const position = this.knownEntityPositions.get(event.enemyId);
          if (position !== undefined) {
            this.emitEffect({
              kind:
                event.enemyTypeId === 'kawaii-fortress'
                  ? 'boss-death'
                  : 'death',
              worldPosition: position,
              ageSeconds: 0,
              durationSeconds:
                event.enemyTypeId === 'kawaii-fortress' ? 1.05 : 0.42,
              enemyTypeId: event.enemyTypeId,
            });
          }
        } else if (event.type === 'enemy-projectile-hit') {
          this.emitEffect({
            kind: 'hit',
            worldPosition: state.player.position,
            ageSeconds: 0,
            durationSeconds: 0.35,
            vfxFamily: event.visualId === 'spore' ? 'energy' : 'explosive',
            enemyVisualId: event.visualId,
          });
        } else if (event.type === 'skill-activated') {
          this.emitEffect({
            kind: 'parry-ready',
            worldPosition: state.player.position,
            ageSeconds: 0,
            durationSeconds: 0.42,
          });
        } else if (event.type === 'attack-parried') {
          this.emitEffect({
            kind: 'parry-success',
            worldPosition: state.player.position,
            ageSeconds: 0,
            durationSeconds: this.reducedMotion ? 0.3 : 0.58,
          });
        } else if (event.type === 'loot-dropped') {
          this.emitEffect({
            kind: 'supply-drop',
            worldPosition: event.position,
            ageSeconds: 0,
            durationSeconds: 0.58,
            lootKind: event.kind,
          });
        } else if (event.type === 'loot-collected') {
          this.emitEffect({
            kind: 'loot',
            worldPosition: state.player.position,
            ageSeconds: 0,
            durationSeconds: 0.46,
            lootKind: event.kind,
          });
        } else if (event.type === 'overheated') {
          this.emitEffect({
            kind: 'smoke',
            worldPosition: state.player.position,
            ageSeconds: 0,
            durationSeconds: 1.2,
            weaponSlot: event.slot,
          });
        }
      }
    }

    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index]!;
      effect.ageSeconds += deltaSeconds;
      if (effect.ageSeconds >= effect.durationSeconds) {
        this.effects.splice(index, 1);
        this.recycleEffect(effect);
      }
    }
  }

  private drawEffects(playerX: number): void {
    const context = this.context;
    const parrySuccess = this.effects.find(
      ({ kind }) => kind === 'parry-success',
    );
    if (parrySuccess) {
      this.drawParryBackdrop(
        parrySuccess.ageSeconds / parrySuccess.durationSeconds,
      );
    } else if (this.parryVfxPreview === 'success') {
      this.drawParryBackdrop(0.2);
    }
    for (const effect of this.effects) {
      const progress = effect.ageSeconds / effect.durationSeconds;
      const followsPlayer =
        effect.kind === 'parry-ready' || effect.kind === 'parry-success';
      const x = followsPlayer
        ? playerX
        : this.worldToScreen(effect.worldPosition);
      const y =
        effect.kind === 'parry-ready' || effect.kind === 'parry-success'
          ? this.groundY - this.caravanSize * 0.46
          : effect.kind === 'smoke'
            ? this.groundY -
              this.caravanSize *
                (effect.weaponSlot === 'secondary' ? 0.56 : 0.72)
            : effect.kind === 'muzzle'
              ? this.groundY - this.caravanSize * 0.65
              : effect.kind === 'supply-drop'
                ? this.groundY -
                  Math.min(32, Math.max(18, this.viewportHeight * 0.025))
                : effect.kind === 'explosion' &&
                    effect.weaponId === 'mine-launcher'
                  ? this.groundY -
                    Math.min(38, Math.max(24, this.viewportHeight * 0.045))
                  : this.groundY -
                    Math.min(80, Math.max(44, this.viewportHeight * 0.09));
      if (effect.kind === 'loot') {
        this.drawLootCollectedVfx(x, y, progress, effect.lootKind);
        continue;
      }
      if (effect.kind === 'supply-drop') {
        this.drawSupplyDropVfx(x, y, progress, effect.lootKind);
        continue;
      }
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

      if (effect.kind === 'parry-ready' || effect.kind === 'parry-success') {
        this.drawParryVfx(x, y, progress, effect.kind === 'parry-success');
        continue;
      }

      if (effect.kind === 'contact' && effect.enemyTypeId) {
        this.drawContactVfx(effect.enemyTypeId, x, y, progress);
        continue;
      }

      if (
        (effect.kind === 'death' || effect.kind === 'boss-death') &&
        effect.enemyTypeId
      ) {
        this.drawEnemyDeathVfx(effect.enemyTypeId, x, progress);
        continue;
      }

      const family =
        effect.vfxFamily ??
        (effect.weaponId ? WEAPON_VFX_FAMILY[effect.weaponId] : 'explosive');
      const pose: VfxPose = effect.kind === 'muzzle' ? 'muzzle' : 'impact';
      const drewEnemyImpact =
        effect.enemyVisualId !== undefined &&
        this.drawGeneratedEnemyVfx(
          effect.enemyVisualId,
          'impact',
          x,
          y,
          progress,
        );
      if (
        !drewEnemyImpact &&
        !this.drawGeneratedVfx(family, pose, x, y, progress)
      ) {
        this.drawFallbackVfx(effect, x, y, progress);
      }
      if (effect.kind === 'explosion' && effect.weaponId === 'mine-launcher') {
        this.drawMineDetonationAccent(x, y, progress);
      }
      this.drawVfxParticles(effect, family, x, y, progress);
    }
    if (this.parryVfxPreview !== undefined) {
      const caravanWidth = this.caravanSize;
      this.drawParryVfx(
        playerX,
        this.groundY - caravanWidth * 0.46,
        0.2,
        this.parryVfxPreview === 'success',
      );
    }
  }

  private drawContactVfx(
    enemyTypeId: EnemyTypeId,
    x: number,
    y: number,
    progress: number,
  ): void {
    const context = this.context;
    const fade = Math.max(0, 1 - progress);
    const spread = 18 + progress * 40;
    const contactY =
      enemyTypeId === 'rusher' ? y - 9 : enemyTypeId === 'heavy' ? y + 6 : y;
    context.save();
    context.globalAlpha = fade;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#263249';
    context.fillStyle =
      enemyTypeId === 'rusher'
        ? '#ff8b72'
        : enemyTypeId === 'heavy'
          ? '#ffe08a'
          : '#8ee3c1';
    context.lineWidth = 3.5;

    if (enemyTypeId === 'rusher') {
      context.beginPath();
      context.moveTo(x + spread * 0.65, contactY - spread * 0.45);
      context.lineTo(x - spread * 0.25, contactY);
      context.lineTo(x + spread * 0.65, contactY + spread * 0.45);
      context.lineTo(x + spread * 0.2, contactY);
      context.closePath();
      context.fill();
      context.stroke();
    } else if (enemyTypeId === 'heavy') {
      context.beginPath();
      context.ellipse(
        x,
        contactY,
        spread * 0.8,
        spread * 0.34,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(x, contactY, spread * 1.25, Math.PI * 1.12, Math.PI * 1.88);
      context.stroke();
    } else {
      context.beginPath();
      context.arc(x, contactY, spread * 0.62, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      for (const direction of [-1, 1]) {
        context.beginPath();
        context.moveTo(x + direction * spread * 0.85, contactY - spread * 0.42);
        context.lineTo(x + direction * spread * 1.18, contactY - spread * 0.72);
        context.stroke();
      }
    }
    context.restore();
  }

  private drawParryBackdrop(progress: number): void {
    const context = this.context;
    const fade = Math.max(0, 1 - progress);
    context.save();
    context.fillStyle = `rgb(11 18 38 / ${Math.min(0.68, fade * 0.86)})`;
    context.fillRect(
      -64,
      -64,
      this.viewportWidth + 128,
      this.viewportHeight + 128,
    );
    if (progress < 0.12) {
      context.fillStyle = `rgb(225 255 252 / ${(1 - progress / 0.12) * 0.42})`;
      context.fillRect(
        -64,
        -64,
        this.viewportWidth + 128,
        this.viewportHeight + 128,
      );
    }
    context.restore();
  }

  private drawSupplyLoot(x: number, kind: LootKind, ageSeconds: number): void {
    const context = this.context;
    const image = this.assets.get(SUPPLY_ART[kind]);
    const height =
      Math.min(64, Math.max(40, this.viewportHeight * 0.075)) *
      (kind === 'weapon-cache' ? 1.08 : 1);
    const bounce = this.reducedMotion ? 0 : Math.sin(ageSeconds * 4.2) * 1.5;
    const bottomY = this.groundY - 5 + bounce;
    const color =
      kind === 'repair' ? '#ff8875' : kind === 'ammo' ? '#ffd05a' : '#62dac5';

    context.save();
    context.globalAlpha = 0.18;
    context.fillStyle = '#263249';
    context.beginPath();
    context.ellipse(
      x,
      this.groundY - 2,
      height * (kind === 'weapon-cache' ? 0.48 : 0.4),
      height * 0.095,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();

    if (image) {
      const width = height * (image.naturalWidth / image.naturalHeight);
      context.save();
      context.shadowColor = color;
      context.shadowBlur = kind === 'weapon-cache' ? 15 : 8;
      context.drawImage(image, x - width / 2, bottomY - height, width, height);
      context.restore();
      return;
    }

    const size = height * 0.72;
    const y = bottomY - height * 0.5;
    context.save();
    context.translate(x, y);
    context.shadowColor = color;
    context.shadowBlur = kind === 'weapon-cache' ? 18 : 10;
    context.fillStyle = color;
    context.strokeStyle = '#263249';
    context.lineWidth = Math.max(2, size * 0.09);
    context.beginPath();
    context.roundRect(
      -size * 0.5,
      -size * 0.36,
      size,
      size * 0.72,
      size * 0.22,
    );
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = '#fff4db';
    context.beginPath();
    context.roundRect(
      -size * 0.34,
      -size * 0.19,
      size * 0.68,
      size * 0.38,
      size * 0.12,
    );
    context.fill();
    context.stroke();
    context.fillStyle = '#263249';
    if (kind === 'repair') {
      context.fillRect(-size * 0.06, -size * 0.15, size * 0.12, size * 0.3);
      context.fillRect(-size * 0.15, -size * 0.06, size * 0.3, size * 0.12);
    } else if (kind === 'ammo') {
      for (let index = -1; index <= 1; index += 1) {
        context.beginPath();
        context.roundRect(
          index * size * 0.16 - size * 0.045,
          -size * 0.14,
          size * 0.09,
          size * 0.28,
          size * 0.04,
        );
        context.fill();
      }
    } else {
      context.beginPath();
      for (let point = 0; point < 10; point += 1) {
        const angle = -Math.PI / 2 + (point * Math.PI) / 5;
        const radius = point % 2 === 0 ? size * 0.17 : size * 0.075;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    }
    context.restore();
  }

  private drawLootCollectedVfx(
    x: number,
    y: number,
    progress: number,
    kind?: LootKind,
  ): void {
    const context = this.context;
    const fade = Math.max(0, 1 - progress);
    const radius = 14 + progress * 42;
    const color =
      kind === 'repair' ? '#ff8875' : kind === 'ammo' ? '#ffd05a' : '#62dac5';
    context.save();
    context.globalAlpha = fade;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      context.beginPath();
      context.arc(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        3 + (1 - progress) * 3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.restore();
  }

  private drawSupplyDropVfx(
    x: number,
    y: number,
    progress: number,
    kind?: LootKind,
  ): void {
    const context = this.context;
    const color =
      kind === 'repair' ? '#ff8875' : kind === 'ammo' ? '#ffd05a' : '#62dac5';
    const burst = Math.sin(Math.min(1, progress) * Math.PI);
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress);
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, 12 + progress * 38, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      const inner = 18 + progress * 18;
      const outer = inner + 8 + burst * 10;
      context.beginPath();
      context.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      context.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      context.stroke();
    }
    context.restore();
  }

  private drawParryVfx(
    x: number,
    y: number,
    progress: number,
    successful: boolean,
  ): void {
    const context = this.context;
    const image = this.assets.get(
      successful ? PARRY_VFX_ART.successSource : PARRY_VFX_ART.readySource,
    );
    if (!image) return;
    const caravanWidth = this.caravanSize;
    const easedBurst = Math.sin(Math.min(1, progress) * Math.PI);
    const baseScale = successful
      ? PARRY_VFX_ART.successScale
      : PARRY_VFX_ART.readyScale;
    const size =
      caravanWidth *
      baseScale *
      (successful ? 0.78 + easedBurst * 0.32 : 0.9 + easedBurst * 0.1);
    const fade = successful
      ? Math.min(1, (1 - progress) * 1.65)
      : Math.min(1, (1 - progress) * 2.3);
    const contactX = x + caravanWidth * 0.42;
    const contactY = y + caravanWidth * 0.1;
    context.save();
    context.translate(contactX, contactY);
    if (successful && !this.reducedMotion) {
      context.rotate(-0.04 + progress * 0.08);
    }
    context.globalAlpha = fade;
    context.drawImage(
      image,
      -size * PARRY_VFX_ART.contactX,
      -size * PARRY_VFX_ART.contactY,
      size,
      size,
    );
    context.restore();
  }

  private drawEnemyDeathVfx(
    enemyTypeId: EnemyTypeId,
    x: number,
    progress: number,
  ): void {
    const isBoss = enemyTypeId === 'kawaii-fortress';
    const asset = ENEMY_MOTION_ART[enemyTypeId];
    const image = this.assets.get(asset.source);
    const size = this.enemySize(enemyTypeId);
    const bodyEnd = isBoss ? 0.44 : 0.38;

    if (image && progress < bodyEnd) {
      const bodyProgress = progress / bodyEnd;
      const squash = isBoss ? 1 - bodyProgress * 0.12 : 1 - bodyProgress * 0.42;
      const widen = isBoss ? 1 + bodyProgress * 0.04 : 1 + bodyProgress * 0.18;
      const context = this.context;
      context.save();
      context.translate(x, this.groundY);
      context.scale(widen, squash);
      context.globalAlpha = Math.max(0, 1 - bodyProgress);
      context.filter = `brightness(${1 + bodyProgress * 0.7}) saturate(${1 - bodyProgress * 0.45})`;
      this.drawMotionFrame(
        image,
        'idle',
        -size * 0.5,
        -size * asset.groundAnchor,
        size,
      );
      context.restore();
    }

    if (isBoss) {
      this.drawBossDeathSequence(x, size, progress);
      return;
    }
    this.drawDeathPairCell(
      'puff',
      x,
      this.groundY - size * 0.35,
      Math.min(1, progress / 0.82),
      Math.min(150, Math.max(82, size * 1.2)),
    );
  }

  private drawBossDeathSequence(
    x: number,
    bossSize: number,
    progress: number,
  ): void {
    const coreX = x - bossSize * 0.2;
    const coreY = this.groundY - bossSize * 0.42;
    if (progress < 0.58) {
      this.drawDeathPairCell(
        'boss-core',
        coreX,
        coreY,
        progress / 0.58,
        Math.min(220, Math.max(128, bossSize * 0.62)),
      );
    }
    if (progress >= 0.32) {
      const blastProgress = Math.min(1, (progress - 0.32) / 0.68);
      this.drawGeneratedVfx('explosive', 'impact', coreX, coreY, blastProgress);
      const context = this.context;
      context.save();
      context.globalAlpha = Math.max(0, 0.7 * (1 - blastProgress));
      context.strokeStyle = '#76e8ef';
      context.lineWidth = Math.max(3, bossSize * 0.018);
      context.beginPath();
      context.arc(
        coreX,
        coreY,
        bossSize * (0.18 + blastProgress * 0.42),
        0,
        Math.PI * 2,
      );
      context.stroke();
      context.restore();
    }
  }

  private drawDeathPairCell(
    pose: 'puff' | 'boss-core',
    x: number,
    y: number,
    progress: number,
    baseSize: number,
  ): boolean {
    const image = this.assets.get(ENEMY_DEATH_VFX_ART.source);
    if (!image) return false;
    const [sourceX, sourceY, sourceWidth, sourceHeight] =
      getEnemyDeathVfxSource(image.naturalWidth, image.naturalHeight, pose);
    const scale =
      pose === 'puff'
        ? ENEMY_DEATH_VFX_ART.puffScale
        : ENEMY_DEATH_VFX_ART.bossCoreScale;
    const size =
      baseSize * scale * (0.72 + Math.sin(progress * Math.PI) * 0.34);
    const context = this.context;
    context.save();
    context.globalAlpha = Math.min(1, (1 - progress) * 1.8);
    context.shadowColor = pose === 'puff' ? '#9de7bd' : '#68e8ef';
    context.shadowBlur = Math.max(5, size * 0.06);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x - size / 2,
      y - size / 2,
      size,
      size,
    );
    context.restore();
    return true;
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
    const growth = this.reducedMotion
      ? 1
      : pose === 'muzzle'
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
    context.shadowBlur = this.highEffectLoad ? 0 : 8 + size * 0.08;
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
    if (this.reducedMotion || this.highEffectLoad) return;
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
      recycled.vfxFamily = effect.vfxFamily;
      recycled.enemyVisualId = effect.enemyVisualId;
      recycled.enemyTypeId = effect.enemyTypeId;
      this.effects.push(recycled);
    } else {
      this.effects.push(effect);
    }
    if (this.effects.length > MAX_ACTIVE_EFFECTS) {
      this.recycleEffect(this.effects.shift()!);
    }
  }

  private recycleEffect(effect: VisualEffect): void {
    if (this.recycledEffects.length >= MAX_RECYCLED_EFFECTS) return;
    this.recycledEffects.push(effect);
  }

  private drawProjectile(
    x: number,
    weaponId: WeaponId,
    behavior: SimulationState['projectiles'][number]['behavior'],
    ageSeconds = 0,
    maximumAgeSeconds = 12,
  ): void {
    if (behavior === 'mine') {
      this.drawMineDeployable(x, ageSeconds, maximumAgeSeconds);
      return;
    }
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
      context.arc(x, y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  private drawMineDeployable(
    x: number,
    ageSeconds: number,
    maximumAgeSeconds: number,
  ): void {
    const context = this.context;
    const width = Math.min(
      MINE_VFX_ART.maximumWidth,
      Math.max(
        MINE_VFX_ART.minimumWidth,
        this.viewportHeight * MINE_VFX_ART.viewportHeightRatio,
      ),
    );
    const image = this.assets.get(MINE_VFX_ART.source);
    const aspect = image ? image.naturalHeight / image.naturalWidth : 0.8;
    const height = width * aspect;
    const deployProgress = Math.min(1, ageSeconds / MINE_VFX_ART.deploySeconds);
    const lift = this.reducedMotion
      ? 0
      : (1 - deployProgress) * 24 - Math.sin(deployProgress * Math.PI) * 3;
    const remainingSeconds = maximumAgeSeconds - ageSeconds;
    const pulseSpeed = remainingSeconds <= 2 ? 18 : 8;
    const pulse = this.reducedMotion
      ? 0.5
      : (Math.sin(ageSeconds * pulseSpeed) + 1) / 2;
    const top =
      this.groundY - height - MINE_VFX_ART.groundOffset - Math.max(0, lift);

    context.save();
    context.globalAlpha = 0.22 + deployProgress * 0.16;
    context.fillStyle = '#263249';
    context.beginPath();
    context.ellipse(
      x,
      this.groundY - 2,
      width * (0.3 + deployProgress * 0.12),
      Math.max(3, height * 0.09),
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    if (deployProgress >= 1) {
      context.globalAlpha = 0.22 + pulse * 0.32;
      context.strokeStyle = remainingSeconds <= 2 ? '#ffcc58' : '#69ddca';
      context.lineWidth = 2.5;
      context.beginPath();
      context.ellipse(
        x,
        this.groundY - 4,
        width * (0.38 + pulse * 0.18),
        height * (0.1 + pulse * 0.04),
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }

    context.globalAlpha = 1;
    if (image) {
      context.drawImage(image, x - width / 2, top, width, height);
    } else {
      context.fillStyle = '#fff0ce';
      context.strokeStyle = '#263249';
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(
        x,
        top + height * 0.58,
        width * 0.42,
        height * 0.34,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.stroke();
    }

    if (deployProgress >= 1) {
      context.globalCompositeOperation = 'screen';
      context.globalAlpha = 0.14 + pulse * 0.2;
      context.fillStyle = '#69f4ee';
      context.beginPath();
      context.arc(x, top + height * 0.34, width * 0.13, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  private drawMineDetonationAccent(
    x: number,
    y: number,
    progress: number,
  ): void {
    const context = this.context;
    context.save();
    context.globalAlpha = Math.max(0, (1 - progress) * 0.9);
    context.strokeStyle = progress < 0.3 ? '#eaffff' : '#69ddca';
    context.lineWidth = Math.max(2, 5 - progress * 3);
    context.beginPath();
    context.ellipse(
      x,
      this.groundY - 4,
      12 + progress * 70,
      4 + progress * 12,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    if (progress < 0.28) {
      context.globalAlpha = 1 - progress / 0.28;
      context.fillStyle = '#eaffff';
      context.beginPath();
      context.arc(x, y, 16 + progress * 24, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  private drawEnemyProjectile(
    x: number,
    visualId: EnemyProjectileVisualId,
  ): void {
    const context = this.context;
    const asset = ENEMY_VFX_ART[visualId];
    const y =
      this.groundY -
      Math.min(
        visualId === 'spore' ? 68 : 92,
        Math.max(
          visualId === 'spore' ? 36 : 54,
          this.viewportHeight * asset.flightHeightRatio,
        ),
      );
    const image = this.assets.get(asset.source);
    if (image) {
      const [sourceX, sourceY, sourceWidth, sourceHeight] = getEnemyVfxSource(
        image.naturalWidth,
        image.naturalHeight,
        'projectile',
      );
      const baseSize = Math.min(110, Math.max(64, this.viewportHeight * 0.14));
      const size = baseSize * asset.projectileScale;
      context.save();
      context.shadowColor = visualId === 'spore' ? '#8af0c5' : '#65e6ef';
      context.shadowBlur = this.highEffectLoad ? 0 : Math.max(5, size * 0.08);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x - size / 2,
        y - size / 2,
        size,
        size,
      );
      context.restore();
      return;
    }

    const isSpore = visualId === 'spore';
    const isBurst = visualId === 'boss-burst';
    const radius = isSpore ? 7 : isBurst ? 12 : 10;
    const core = isSpore ? '#72e0bd' : isBurst ? '#ff745f' : '#65e6ef';
    const halo = isSpore ? '#d8ff9b' : '#ffe06a';

    context.save();
    context.lineCap = 'round';
    context.strokeStyle = core;
    context.globalAlpha = 0.55;
    context.lineWidth = Math.max(3, radius * 0.45);
    context.beginPath();
    context.moveTo(x + radius * 0.8, y);
    context.lineTo(x + radius * 2.8, y);
    context.stroke();
    context.globalAlpha = 1;
    context.shadowColor = halo;
    context.shadowBlur = radius * 1.2;
    context.fillStyle = core;
    context.strokeStyle = '#263249';
    context.lineWidth = Math.max(2, radius * 0.24);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = halo;
    context.beginPath();
    context.arc(
      x - radius * 0.28,
      y - radius * 0.24,
      radius * 0.35,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();
  }

  private drawGeneratedEnemyVfx(
    visualId: EnemyProjectileVisualId,
    pose: 'projectile' | 'impact',
    x: number,
    y: number,
    progress: number,
  ): boolean {
    const asset = ENEMY_VFX_ART[visualId];
    const image = this.assets.get(asset.source);
    if (!image) return false;
    const [sourceX, sourceY, sourceWidth, sourceHeight] = getEnemyVfxSource(
      image.naturalWidth,
      image.naturalHeight,
      pose,
    );
    const baseSize = Math.min(
      pose === 'impact' ? 156 : 110,
      Math.max(
        pose === 'impact' ? 84 : 64,
        this.viewportHeight * (pose === 'impact' ? 0.18 : 0.14),
      ),
    );
    const scale = pose === 'impact' ? asset.impactScale : asset.projectileScale;
    const animatedScale =
      pose === 'impact' && !this.reducedMotion
        ? scale * (0.82 + Math.sin(progress * Math.PI) * 0.28)
        : scale;
    const size = baseSize * animatedScale;
    const context = this.context;
    context.save();
    context.globalAlpha =
      pose === 'impact' ? Math.min(1, (1 - progress) * 1.8) : 1;
    context.shadowColor = visualId === 'spore' ? '#8af0c5' : '#65e6ef';
    context.shadowBlur = this.highEffectLoad ? 0 : Math.max(6, size * 0.08);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x - size / 2,
      y - size / 2,
      size,
      size,
    );
    context.restore();
    return true;
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

  private readBossPreviewPhase(): BossPhase | undefined {
    const phase = Number(
      new URLSearchParams(window.location.search).get('bossPhase'),
    );
    return phase === 1 || phase === 2 || phase === 3 ? phase : undefined;
  }

  private readEnemyVfxPreview(): EnemyProjectileVisualId | undefined {
    const visualId = new URLSearchParams(window.location.search).get(
      'enemyVfx',
    );
    return visualId === 'spore' ||
      visualId === 'boss-core' ||
      visualId === 'boss-burst'
      ? visualId
      : undefined;
  }

  private drawEnemyVfxPreview(visualId: EnemyProjectileVisualId): void {
    this.drawEnemyProjectile(this.viewportWidth * 0.62, visualId);
    this.drawGeneratedEnemyVfx(
      visualId,
      'impact',
      this.viewportWidth * 0.76,
      this.groundY - Math.max(44, this.viewportHeight * 0.09),
      0.35,
    );
  }

  private readDeathVfxPreview(): DeathVfxPreview | undefined {
    const preview = new URLSearchParams(window.location.search).get('deathVfx');
    return preview === 'normal' ||
      preview === 'boss' ||
      preview === 'bomber' ||
      preview === 'basic' ||
      preview === 'rusher' ||
      preview === 'heavy'
      ? preview
      : undefined;
  }

  private readParryVfxPreview(): ParryVfxPreview | undefined {
    const preview = new URLSearchParams(window.location.search).get('parryVfx');
    return preview === 'ready' || preview === 'success' ? preview : undefined;
  }

  private drawDeathVfxPreview(preview: DeathVfxPreview): void {
    const x = this.viewportWidth * 0.72;
    const y = this.groundY - Math.max(44, this.viewportHeight * 0.09);
    if (preview === 'normal') {
      this.drawEnemyDeathVfx('basic', x, 0.42);
    } else if (preview === 'boss') {
      this.drawBossDeathSequence(x, this.enemySize('kawaii-fortress'), 0.42);
    } else if (preview === 'bomber') {
      this.drawGeneratedVfx('explosive', 'impact', x, y, 0.3);
    } else {
      this.drawContactVfx(preview, x, y, 0.28);
    }
  }

  private drawEquipmentSprite(
    source: string,
    centerX: number,
    centerY: number,
    size: number,
    rotationDegrees: number,
    overheated = false,
  ): void {
    const image = this.assets.get(source);
    if (!image) return;
    const context = this.context;
    context.save();
    context.translate(centerX, centerY);
    context.rotate((rotationDegrees * Math.PI) / 180);
    if (overheated) {
      context.filter = 'saturate(1.18) brightness(1.08) sepia(0.16)';
      context.shadowColor = '#ff5d5d';
      context.shadowBlur = Math.max(7, size * 0.08);
    }
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

  private seedPerformanceStressEffects(): void {
    const weapons: WeaponId[] = [
      'machine-cannon',
      'scatter-cannon',
      'railgun',
      'rocket-launcher',
    ];
    for (let index = 0; index < PERFORMANCE_STRESS_EFFECTS; index += 1) {
      this.emitEffect({
        kind: index % 3 === 0 ? 'explosion' : 'hit',
        worldPosition: 6 + ((index * 17) % 88),
        ageSeconds: (index % 8) * 0.035,
        durationSeconds: 3600,
        weaponId: weapons[index % weapons.length],
      });
    }
  }

  private drawPerformanceStressProjectiles(): void {
    const playerProjectiles = [
      ['machine-cannon', 'projectile'],
      ['scatter-cannon', 'scatter'],
      ['flamethrower', 'flame'],
      ['rocket-launcher', 'rocket'],
      ['railgun', 'railgun'],
      ['mine-launcher', 'mine'],
    ] as const;
    for (
      let index = 0;
      index < PERFORMANCE_STRESS_PLAYER_PROJECTILES;
      index += 1
    ) {
      const [weaponId, behavior] =
        playerProjectiles[index % playerProjectiles.length]!;
      this.drawProjectile(
        this.worldToScreen(4 + ((index * 13) % 92)),
        weaponId,
        behavior,
      );
    }
    const enemyVisuals: EnemyProjectileVisualId[] = [
      'spore',
      'boss-core',
      'boss-burst',
    ];
    for (
      let index = 0;
      index < PERFORMANCE_STRESS_ENEMY_PROJECTILES;
      index += 1
    ) {
      this.drawEnemyProjectile(
        this.worldToScreen(6 + ((index * 19) % 88)),
        enemyVisuals[index % enemyVisuals.length]!,
      );
    }
  }

  private recordDiagnostics(renderDurationMs: number): void {
    if (!this.diagnosticsEnabled) return;
    this.renderDurationsMs.push(renderDurationMs);
    if (this.renderDurationsMs.length > PERFORMANCE_SAMPLE_LIMIT) {
      this.renderDurationsMs.shift();
    }
    const diagnostics: RendererDiagnostics = {
      renderDurationsMs: [...this.renderDurationsMs],
      activeEffects: this.effects.length,
      recycledEffects: this.recycledEffects.length,
      maximumActiveEffects: MAX_ACTIVE_EFFECTS,
      maximumRecycledEffects: MAX_RECYCLED_EFFECTS,
      stressPlayerProjectiles: this.performanceStress
        ? PERFORMANCE_STRESS_PLAYER_PROJECTILES
        : 0,
      stressEnemyProjectiles: this.performanceStress
        ? PERFORMANCE_STRESS_ENEMY_PROJECTILES
        : 0,
      reducedMotion: this.reducedMotion,
      activeEnemyHitStops: [...this.enemyMotions.values()].filter(
        ({ hitStopRemainingSeconds }) => hitStopRemainingSeconds > 0,
      ).length,
      cameraShakeRemainingSeconds: Math.max(
        0,
        this.cameraShakeSpec.durationSeconds - this.cameraShakeAgeSeconds,
      ),
      assets: this.assets.getDiagnostics(),
    };
    (
      window as typeof window & {
        __kaboomRendererDiagnostics?: RendererDiagnostics;
      }
    ).__kaboomRendererDiagnostics = diagnostics;
  }

  private readonly handleReducedMotionChange = (
    event: MediaQueryListEvent,
  ): void => {
    this.reducedMotion = event.matches;
  };

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
    return Math.min(this.viewportHeight * 0.84, this.viewportHeight - 84);
  }

  private get caravanSize(): number {
    return Math.min(
      PLAYER_MAXIMUM_SIZE,
      Math.max(PLAYER_MINIMUM_SIZE, this.viewportHeight * PLAYER_HEIGHT_RATIO),
    );
  }

  private enemySize(typeId: EnemyTypeId): number {
    const isBoss = typeId === 'kawaii-fortress';
    const baseSize = Math.min(
      isBoss ? 420 : 190,
      Math.max(
        isBoss ? 200 : 70,
        this.viewportHeight * ENEMY_HEIGHT_RATIOS[typeId],
      ),
    );
    return baseSize * ENEMY_MOTION_ART[typeId].displayScale;
  }

  private readonly resize = (): void => {
    this.viewportWidth = Math.max(1, this.canvas.clientWidth);
    this.viewportHeight = Math.max(1, this.canvas.clientHeight);
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.viewportWidth * scale);
    this.canvas.height = Math.round(this.viewportHeight * scale);
  };
}
