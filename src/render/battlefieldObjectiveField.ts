import { BATTLEFIELD_OBJECTIVES } from '../game/data/routeDefinitions';
import { isObjectiveContested } from '../game/simulation/battlefieldObjective';
import type { SimulationState } from '../game/simulation/types';

export function drawBattlefieldObjectiveField(
  context: CanvasRenderingContext2D,
  state: SimulationState,
  worldToScreen: (position: number) => number,
  groundY: number,
): void {
  const objective = state.objective;
  if (!objective || state.status !== 'active') return;
  const definition = BATTLEFIELD_OBJECTIVES[objective.kind];
  const left = worldToScreen(definition.position - definition.radius);
  const right = worldToScreen(definition.position + definition.radius);
  const x = worldToScreen(definition.position);
  const contested =
    objective.status === 'active' &&
    isObjectiveContested(objective, state.enemies);
  const color =
    objective.status === 'lost' ? '#a3aaa5' : contested ? '#f99282' : '#f5d386';
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 0.22;
  context.fillRect(left, groundY - 8, right - left, 28);
  context.globalAlpha = 1;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(left, groundY - 24);
  context.lineTo(left, groundY + 20);
  context.moveTo(right, groundY - 24);
  context.lineTo(right, groundY + 20);
  context.stroke();
  context.fillStyle = '#142e2b';
  context.fillRect(left, groundY + 8, right - left, 6);
  context.fillStyle = color;
  context.fillRect(
    left,
    groundY + 8,
    ((right - left) * objective.progressSeconds) / definition.holdSeconds,
    6,
  );
  context.fillStyle = '#142e2bf2';
  context.fillRect(x - 47, groundY + 24, 94, 18);
  context.fillStyle = color;
  context.font = 'bold 10px system-ui';
  context.textAlign = 'center';
  context.fillText(
    objective.status === 'secured'
      ? '回収済'
      : objective.status === 'lost'
        ? '回収断念'
        : `${definition.displayName} ${definition.position}m`,
    x,
    groundY + 37,
  );
  context.restore();
}
