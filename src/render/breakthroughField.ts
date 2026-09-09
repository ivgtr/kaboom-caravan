import { BREAKTHROUGH } from '../game/simulation/breakthrough';
import type { SimulationState } from '../game/simulation/types';

export function drawBreakthroughField(
  context: CanvasRenderingContext2D,
  state: SimulationState,
  worldToScreen: (position: number) => number,
  groundY: number,
  reducedMotion: boolean,
): void {
  if (state.status !== 'active') return;
  context.save();
  const boundary = worldToScreen(25);
  context.strokeStyle = '#126a60';
  context.fillStyle = '#123e3a';
  context.lineWidth = 2;
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(boundary, groundY - 14);
  context.lineTo(boundary, groundY + 16);
  context.stroke();
  context.setLineDash([]);
  context.font = 'bold 10px system-ui';
  context.fillText('25m 突破チャージ →', boundary + 4, groundY + 23);

  if (state.breakthrough.remainingSeconds > 0) {
    const x = worldToScreen(state.player.position);
    const age =
      BREAKTHROUGH.durationSeconds - state.breakthrough.remainingSeconds;
    context.strokeStyle = '#fff0a6';
    context.fillStyle = '#51d7bd';
    context.globalAlpha = 0.28;
    context.beginPath();
    context.ellipse(x, groundY - 10, 64, 32, 0, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.9;
    context.lineWidth = 3;
    context.stroke();
    if (!reducedMotion && age < 0.5) {
      context.globalAlpha = (1 - age / 0.5) * 0.75;
      context.beginPath();
      context.ellipse(
        x,
        groundY - 20,
        32 + age * 340,
        24 + age * 110,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  }
  context.restore();
}
