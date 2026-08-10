import type { EntityId, SimulationState } from './types';

export interface PresentationEntitySnapshot {
  id: EntityId;
  previousPosition: number;
  position: number;
}

export interface PresentationSnapshot {
  tick: number;
  frontlinePosition: number;
  player: PresentationEntitySnapshot;
  enemies: PresentationEntitySnapshot[];
  projectiles: PresentationEntitySnapshot[];
}

export function createPresentationSnapshot(
  state: SimulationState,
): PresentationSnapshot {
  return {
    tick: state.tick,
    frontlinePosition: state.frontline.position,
    player: {
      id: state.player.id,
      previousPosition: state.player.previousPosition,
      position: state.player.position,
    },
    enemies: state.enemies.map(({ id, previousPosition, position }) => ({
      id,
      previousPosition,
      position,
    })),
    projectiles: state.projectiles.map(
      ({ id, previousPosition, position }) => ({
        id,
        previousPosition,
        position,
      }),
    ),
  };
}

export function interpolatePosition(
  entity: PresentationEntitySnapshot,
  alpha: number,
): number {
  return (
    entity.previousPosition +
    (entity.position - entity.previousPosition) *
      Math.min(1, Math.max(0, alpha))
  );
}
