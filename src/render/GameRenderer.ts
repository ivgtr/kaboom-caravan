import * as THREE from 'three';
import {
  createPresentationSnapshot,
  interpolatePosition,
} from '../game/simulation/presentationSnapshot';
import type { EntityId, SimulationState } from '../game/simulation/types';

export class GameRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly player: THREE.Mesh;
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
    this.syncEntityViews(
      snapshot.enemies,
      this.enemyViews,
      () =>
        new THREE.Mesh(
          new THREE.BoxGeometry(3, 2, 2.5),
          new THREE.MeshStandardMaterial({ color: '#687ec9' }),
        ),
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
    createView: () => THREE.Mesh,
    height: number,
    alpha: number,
  ): void {
    const liveIds = new Set(entities.map((entity) => entity.id));
    for (const entity of entities) {
      let view = views.get(entity.id);
      if (!view) {
        view = createView();
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
    const viewHeight = 36;
    this.camera.left = -(viewHeight * aspect) / 2;
    this.camera.right = (viewHeight * aspect) / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };
}
