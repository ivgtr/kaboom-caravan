import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../data/enemyDefinitions';
import { WAVE_DEFINITIONS } from '../data/waveDefinitions';
import {
  createSimulation,
  createWaveSimulation,
} from '../simulation/createSimulation';
import { stepSimulation } from '../simulation/stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from '../simulation/types';
import { createEnemy } from './createEnemy';
import { stepEnemyBehaviors } from './enemyBehavior';

describe('enemy definitions and behaviors', () => {
  it('registers five role enemies and one boss with distinct behaviors', () => {
    const roleEnemies = Object.values(ENEMY_DEFINITIONS).filter(
      (definition) => definition.id !== 'kawaii-fortress',
    );

    expect(roleEnemies).toHaveLength(5);
    expect(new Set(roleEnemies.map((enemy) => enemy.behaviorId)).size).toBe(5);
    expect(ENEMY_DEFINITIONS['kawaii-fortress'].assetId).toBe(
      'boss_kawaii_fortress',
    );
  });

  it('makes rushers close distance faster than basic enemies', () => {
    const basic = createEnemy('basic', 'basic-1', 70);
    const rusher = createEnemy('rusher', 'rusher-1', 70);

    const result = stepEnemyBehaviors([basic, rusher], 10, 2.5, 1, 100, 1);

    expect(
      result.enemies.find((enemy) => enemy.id === 'rusher-1')!.position,
    ).toBe(65.5);
    expect(
      result.enemies.find((enemy) => enemy.id === 'basic-1')!.position,
    ).toBe(68.5);
  });

  it('lets artillery stop and fire from range', () => {
    const artillery = createEnemy('artillery', 'artillery-1', 50);
    const result = stepEnemyBehaviors(
      [artillery],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    );

    expect(result.enemies[0]!.position).toBe(50);
    expect(result.playerHitPoints).toBe(92);
    expect(result.events).toContainEqual({
      type: 'enemy-attacked',
      enemyId: 'artillery-1',
    });
  });

  it('makes ranged enemies approach without attacking until within range', () => {
    const artillery = createEnemy('artillery', 'artillery-1', 70);
    const result = stepEnemyBehaviors([artillery], 10, 2.5, 1, 100, 1);

    expect(result.enemies[0]!.position).toBe(69);
    expect(result.playerHitPoints).toBe(100);
    expect(result.events).not.toContainEqual({
      type: 'enemy-attacked',
      enemyId: 'artillery-1',
    });
  });

  it('does not let melee enemies attack before their bodies touch', () => {
    const basic = createEnemy('basic', 'basic-1', 16);
    const result = stepEnemyBehaviors(
      [basic],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    );

    expect(result.enemies[0]!.position).toBeLessThan(16);
    expect(result.playerHitPoints).toBe(100);
    expect(result.events).toHaveLength(0);
  });

  it('removes a bomber after its contact attack', () => {
    const bomber = createEnemy('bomber', 'bomber-1', 14);
    const result = stepEnemyBehaviors([bomber], 10, 2.5, 1, 100, 1);

    expect(result.enemies).toHaveLength(0);
    expect(result.playerHitPoints).toBe(71);
  });
});

describe('wave and boss progression', () => {
  it('spawns scheduled enemies and emits wave lifecycle events', () => {
    const initial = createWaveSimulation(123, 'prototype-wave');
    const started = stepSimulation(
      initial,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(started.enemies.map((enemy) => enemy.typeId)).toEqual(['basic']);
    expect(started.events).toContainEqual({
      type: 'wave-started',
      waveId: 'prototype-wave',
    });

    const cleared = stepSimulation(
      {
        ...started,
        enemies: [],
        projectiles: [],
        wave: {
          ...started.wave!,
          nextSpawnIndex: WAVE_DEFINITIONS['prototype-wave'].spawns.length,
        },
      },
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(cleared.wave?.completed).toBe(true);
    expect(cleared.status).toBe('victory');
    expect(cleared.events).toContainEqual({
      type: 'wave-completed',
      waveId: 'prototype-wave',
    });
  });

  it('changes boss phases and deploys reinforcements at phase two', () => {
    const initial = createSimulation();
    const boss = createEnemy('kawaii-fortress', 'boss-1', 78);
    boss.hitPoints = 270;
    initial.enemies = [boss];

    const phaseTwo = stepSimulation(
      initial,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(
      phaseTwo.enemies.find((enemy) => enemy.id === 'boss-1')?.bossPhase,
    ).toBe(2);
    expect(phaseTwo.enemies.map((enemy) => enemy.typeId)).toEqual([
      'kawaii-fortress',
      'basic',
      'rusher',
    ]);
    expect(phaseTwo.events).toContainEqual({
      type: 'boss-phase-changed',
      bossId: 'boss-1',
      phase: 2,
    });

    const phaseThreeState = {
      ...phaseTwo,
      enemies: phaseTwo.enemies
        .filter((enemy) => enemy.id === 'boss-1')
        .map((enemy) => ({ ...enemy, hitPoints: 130 })),
    };
    const phaseThree = stepSimulation(
      phaseThreeState,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(phaseThree.enemies[0]?.bossPhase).toBe(3);
    expect(phaseThree.events).toContainEqual({
      type: 'boss-phase-changed',
      bossId: 'boss-1',
      phase: 3,
    });
  });
});
