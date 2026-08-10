import { useEffect, useRef, useState } from 'react';
import { FixedStepLoop } from '../game/simulation/FixedStepLoop';
import { createSimulation } from '../game/simulation/createSimulation';
import { stepSimulation } from '../game/simulation/stepSimulation';
import type { SimulationState } from '../game/simulation/types';
import { InputManager } from '../input/InputManager';
import { GameRenderer } from '../render/GameRenderer';

interface HudSnapshot {
  tick: number;
  position: number;
  hitPoints: number;
  heat: number;
  energy: number;
  ammo: number;
  enemies: number;
}

function toHudSnapshot(state: SimulationState): HudSnapshot {
  return {
    tick: state.tick,
    position: state.player.position,
    hitPoints: state.player.hitPoints,
    heat: state.player.heat,
    energy: state.player.energy,
    ammo: state.player.ammo,
    enemies: state.enemies.length,
  };
}

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState(() => toHudSnapshot(createSimulation()));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let simulation = createSimulation(1);
    let lastSnapshotTick = -1;
    const input = new InputManager();
    const renderer = new GameRenderer(canvas);
    const loop = new FixedStepLoop(
      (deltaSeconds) => {
        simulation = stepSimulation(
          simulation,
          input.readCommand(),
          deltaSeconds,
        );
        if (simulation.tick - lastSnapshotTick >= 6) {
          lastSnapshotTick = simulation.tick;
          setHud(toHudSnapshot(simulation));
        }
      },
      () => renderer.render(simulation),
    );

    input.connect();
    loop.start();

    return () => {
      loop.stop();
      input.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    <main className="game-shell">
      <canvas ref={canvasRef} aria-label="戦闘フィールド" />
      <section className="hud" aria-label="車両状態">
        <strong>Kaboom Caravan / Simulation Spike</strong>
        <span>HP {hud.hitPoints.toFixed(0)}</span>
        <span>HEAT {hud.heat.toFixed(0)}</span>
        <span>ENERGY {hud.energy.toFixed(0)}</span>
        <span>AMMO {hud.ammo}</span>
        <span>ENEMY {hud.enemies}</span>
      </section>
      <aside className="debug-panel">
        tick {hud.tick} / position {hud.position.toFixed(1)}
      </aside>
      <p className="controls">A / D または ← / → で移動・Spaceで射撃</p>
    </main>
  );
}
