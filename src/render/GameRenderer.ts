import * as THREE from 'three';
import {
  createPresentationSnapshot,
  interpolatePosition,
} from '../game/simulation/presentationSnapshot';
import type { EntityId, SimulationState } from '../game/simulation/types';
import type { EnemyTypeId } from '../game/data/ids';
import type { PresentationEntitySnapshot } from '../game/simulation/presentationSnapshot';

const ENEMY_COLORS: Record<EnemyTypeId, string> = {
  basic: '#687ec9',
  rusher: '#e45c78',
  heavy: '#4d596f',
  artillery: '#8566ad',
  bomber: '#dc7d3f',
  'kawaii-fortress': '#d34f91',
};

export class GameRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly player: THREE.Mesh;
  private readonly frontlineMarker: THREE.Mesh;
  private readonly enemyViews = new Map<EntityId, THREE.Mesh>();
  private readonly projectileViews = new Map<EntityId, THREE.Mesh>();
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color('#f3dba7');
    this.camera = new THREE.OrthographicCamera(-50, 50, 18, -18, 0.1, 100);
    this.camera.position.set(50, 20, 35);
    this.camera.lookAt(50, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.add(new THREE.HemisphereLight('#fff7dd', '#747d67', 2.5));
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 20),
      new THREE.MeshStandardMaterial({ color: '#9cab74' }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const riskZones: Array<[number, number, string]> = [
      [12.5, 25, '#b8c98a'],
      [35, 20, '#d2c77e'],
      [55, 20, '#d9a56e'],
      [72.5, 15, '#cf7c77'],
    ];
    for (const [center, width, color] of riskZones) {
      const zone = new THREE.Mesh(
        new THREE.PlaneGeometry(width, 19.5),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.45,
        }),
      );
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(center, 0.02, 0);
      this.scene.add(zone);
    }

    this.frontlineMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 5, 0.35),
      new THREE.MeshBasicMaterial({ color: '#fff4a3' }),
    );
    this.frontlineMarker.position.y = 2.5;
    this.scene.add(this.frontlineMarker);

    this.player = new THREE.Mesh(
      new THREE.BoxGeometry(5, 2.4, 2.8),
      new THREE.MeshStandardMaterial({ color: '#ffb5a7' }),
    );
    this.player.position.y = 1.2;
    this.scene.add(this.player);

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  render(state: SimulationState, alpha: number): void {
    const snapshot = createPresentationSnapshot(state);
    this.player.position.x = interpolatePosition(snapshot.player, alpha);
    this.frontlineMarker.position.x = snapshot.frontlinePosition;
    this.syncEntityViews(
      snapshot.enemies,
      this.enemyViews,
      (entity) => this.createEnemyView(entity),
      1,
      alpha,
    );
    this.syncEntityViews(
      snapshot.projectiles,
      this.projectileViews,
      () =>
        new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 8, 8),
          new THREE.MeshBasicMaterial({ color: '#fff16a' }),
        ),
      1.4,
      alpha,
    );
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.disposeViews(this.enemyViews);
    this.disposeViews(this.projectileViews);
    this.renderer.dispose();
  }

  private syncEntityViews(
    entities: ReturnType<typeof createPresentationSnapshot>['enemies'],
    views: Map<EntityId, THREE.Mesh>,
    createView: (entity: PresentationEntitySnapshot) => THREE.Mesh,
    height: number,
    alpha: number,
  ): void {
    const liveIds = new Set(entities.map((entity) => entity.id));
    for (const entity of entities) {
      let view = views.get(entity.id);
      if (!view) {
        view = createView(entity);
        view.position.y = height;
        views.set(entity.id, view);
        this.scene.add(view);
      }
      view.position.x = interpolatePosition(entity, alpha);
    }

    for (const [id, view] of views) {
      if (!liveIds.has(id)) {
        this.disposeView(view);
        views.delete(id);
      }
    }
  }

  private createEnemyView(entity: PresentationEntitySnapshot): THREE.Mesh {
    const typeId = entity.typeId ?? 'basic';
    const isBoss = typeId === 'kawaii-fortress';
    const isHeavy = typeId === 'heavy';
    return new THREE.Mesh(
      new THREE.BoxGeometry(
        isBoss ? 9 : isHeavy ? 4 : 3,
        isBoss ? 6 : isHeavy ? 3 : 2,
        isBoss ? 5 : isHeavy ? 3.5 : 2.5,
      ),
      new THREE.MeshStandardMaterial({ color: ENEMY_COLORS[typeId] }),
    );
  }

  private disposeViews(views: Map<EntityId, THREE.Mesh>): void {
    for (const view of views.values()) this.disposeView(view);
    views.clear();
  }

  private disposeView(view: THREE.Mesh): void {
    this.scene.remove(view);
    view.geometry.dispose();
    const materials = Array.isArray(view.material)
      ? view.material
      : [view.material];
    for (const material of materials) material.dispose();
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const aspect = width / height;
    const minimumViewWidth = 100;
    const minimumViewHeight = 40;
    const viewWidth = Math.max(minimumViewWidth, minimumViewHeight * aspect);
    const viewHeight = Math.max(minimumViewHeight, minimumViewWidth / aspect);
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };
}
