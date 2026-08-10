import * as THREE from 'three';
import type { SimulationState } from '../game/simulation/types';

export class GameRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly player: THREE.Mesh;
  private readonly enemyViews = new Map<string, THREE.Mesh>();
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

  render(state: SimulationState): void {
    this.player.position.x = state.player.position;
    const liveEnemyIds = new Set(state.enemies.map((enemy) => enemy.id));

    for (const enemy of state.enemies) {
      let view = this.enemyViews.get(enemy.id);
      if (!view) {
        view = new THREE.Mesh(
          new THREE.BoxGeometry(3, 2, 2.5),
          new THREE.MeshStandardMaterial({ color: '#687ec9' }),
        );
        view.position.y = 1;
        this.enemyViews.set(enemy.id, view);
        this.scene.add(view);
      }
      view.position.x = enemy.position;
    }

    for (const [id, view] of this.enemyViews) {
      if (!liveEnemyIds.has(id)) {
        this.scene.remove(view);
        view.geometry.dispose();
        (view.material as THREE.Material).dispose();
        this.enemyViews.delete(id);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
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
