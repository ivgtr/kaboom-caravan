import type { EnemyTypeId, WeaponId } from '../game/data/ids';
import {
  createPresentationSnapshot,
  interpolatePosition,
} from '../game/simulation/presentationSnapshot';
import type { SimulationState } from '../game/simulation/types';

const WORLD_MINIMUM = 0;
const WORLD_MAXIMUM = 100;
const ENEMY_COLORS: Record<EnemyTypeId, string> = {
  basic: '#687ec9',
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

export class GameRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private viewportWidth = 1;
  private viewportHeight = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    this.context = context;
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  render(state: SimulationState, alpha: number): void {
    const context = this.context;
    const snapshot = createPresentationSnapshot(state);
    const scale = window.devicePixelRatio || 1;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    this.drawEnvironment();
    this.drawFrontline(snapshot.frontlinePosition);

    const playerX = this.worldToScreen(
      interpolatePosition(snapshot.player, alpha),
    );
    this.drawVehicle(
      playerX,
      this.groundY,
      '#ff8fa3',
      1,
      state.build.primaryWeaponId,
      state.build.moduleIds.length,
    );

    for (const enemy of snapshot.enemies) {
      const typeId = enemy.typeId ?? 'basic';
      const scaleFactor =
        typeId === 'kawaii-fortress' ? 2.2 : typeId === 'heavy' ? 1.25 : 1;
      this.drawVehicle(
        this.worldToScreen(interpolatePosition(enemy, alpha)),
        this.groundY,
        ENEMY_COLORS[typeId],
        scaleFactor,
        typeId === 'artillery' ? 'railgun' : 'machine-cannon',
        0,
        true,
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
  }

  dispose(): void {
    this.resizeObserver.disconnect();
  }

  private drawEnvironment(): void {
    const context = this.context;
    const sky = context.createLinearGradient(0, 0, 0, this.groundY);
    sky.addColorStop(0, '#77c8ef');
    sky.addColorStop(1, '#e7f5d0');
    context.fillStyle = sky;
    context.fillRect(0, 0, this.viewportWidth, this.groundY);

    context.fillStyle = '#91b96e';
    context.fillRect(
      0,
      this.groundY - 12,
      this.viewportWidth,
      this.viewportHeight - this.groundY + 12,
    );
    context.fillStyle = '#e4bd83';
    context.fillRect(0, this.groundY - 4, this.viewportWidth, 62);

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

  private drawVehicle(
    x: number,
    groundY: number,
    color: string,
    scale: number,
    weaponId: WeaponId,
    moduleCount: number,
    faceLeft = false,
  ): void {
    const context = this.context;
    const direction = faceLeft ? -1 : 1;
    context.save();
    context.translate(x, groundY);
    context.scale(scale, scale);

    context.fillStyle = '#2f3342';
    context.beginPath();
    context.arc(-18, 0, 8, 0, Math.PI * 2);
    context.arc(18, 0, 8, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = color;
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

    const barrelLength =
      weaponId === 'railgun'
        ? 52
        : weaponId === 'rocket-launcher'
          ? 40
          : weaponId === 'flamethrower'
            ? 28
            : 34;
    context.strokeStyle = '#343849';
    context.lineWidth = weaponId === 'scatter-cannon' ? 10 : 7;
    context.beginPath();
    context.moveTo(direction * 4, -39);
    context.lineTo(direction * barrelLength, -39);
    context.stroke();

    for (let index = 0; index < moduleCount; index += 1) {
      context.fillStyle = '#f2c14e';
      context.fillRect(-26 + index * 11, -35, 8, 8);
    }
    context.restore();
  }

  private worldToScreen(position: number): number {
    const padding = Math.max(36, this.viewportWidth * 0.04);
    const normalized =
      (position - WORLD_MINIMUM) / (WORLD_MAXIMUM - WORLD_MINIMUM);
    return padding + normalized * (this.viewportWidth - padding * 2);
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
