import { createEnteringEnemy } from '../combat/createEnemy';
import { WAVE_DEFINITIONS } from '../data/waveDefinitions';
import type {
  CombatEvent,
  EnemyProjectileState,
  EnemyState,
  WaveState,
} from '../simulation/types';
import type { WaveId } from '../data/ids';

export function createWaveState(id: WaveId): WaveState {
  return {
    id,
    elapsedSeconds: 0,
    nextSpawnIndex: 0,
    started: false,
    completed: false,
  };
}

export interface WaveAdvanceResult {
  wave: WaveState;
  spawnedEnemies: EnemyState[];
  nextEntitySequence: number;
  events: CombatEvent[];
}

export function advanceWave(
  wave: WaveState,
  deltaSeconds: number,
  nextEntitySequence: number,
): WaveAdvanceResult {
  if (wave.completed) {
    return {
      wave,
      spawnedEnemies: [],
      nextEntitySequence,
      events: [],
    };
  }

  const definition = WAVE_DEFINITIONS[wave.id];
  const elapsedSeconds = wave.elapsedSeconds + deltaSeconds;
  const spawnedEnemies: EnemyState[] = [];
  const events: CombatEvent[] = wave.started
    ? []
    : [{ type: 'wave-started', waveId: wave.id }];
  let nextSpawnIndex = wave.nextSpawnIndex;
  let sequence = nextEntitySequence;

  while (
    nextSpawnIndex < definition.spawns.length &&
    definition.spawns[nextSpawnIndex]!.atSeconds <= elapsedSeconds
  ) {
    const spawn = definition.spawns[nextSpawnIndex]!;
    spawnedEnemies.push(
      createEnteringEnemy(
        spawn.enemyTypeId,
        `enemy-${sequence}`,
        spawn.position,
      ),
    );
    sequence += 1;
    nextSpawnIndex += 1;
  }

  return {
    wave: {
      ...wave,
      elapsedSeconds,
      nextSpawnIndex,
      started: true,
    },
    spawnedEnemies,
    nextEntitySequence: sequence,
    events,
  };
}

export function completeWaveIfCleared(
  wave: WaveState,
  enemies: readonly EnemyState[],
  enemyProjectiles: readonly EnemyProjectileState[] = [],
): { wave: WaveState; event?: CombatEvent } {
  const definition = WAVE_DEFINITIONS[wave.id];
  const cleared =
    wave.nextSpawnIndex >= definition.spawns.length &&
    enemies.length === 0 &&
    enemyProjectiles.length === 0;
  if (!cleared || wave.completed) return { wave };
  return {
    wave: { ...wave, completed: true },
    event: { type: 'wave-completed', waveId: wave.id },
  };
}
