import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../data/enemyDefinitions';
import { WAVE_DEFINITIONS } from '../data/waveDefinitions';
import {
  createSimulation,
  createWaveSimulation,
} from '../simulation/createSimulation';
import { stepSimulation } from '../simulation/stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from '../simulation/types';
import { createEnemy, createEnteringEnemy } from './createEnemy';
import { stepEnemyBehaviors } from './enemyBehavior';
import { completeWaveIfCleared } from '../wave/waveSystem';

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
    ).toBe(62);
    expect(
      result.enemies.find((enemy) => enemy.id === 'basic-1')!.position,
    ).toBe(64.5);
  });

  it('moves an entering enemy at its native speed without proximity easing', () => {
    const enteringEnemy = createEnteringEnemy('basic', 'basic-entering');
    const startingPosition = enteringEnemy.position;
    const result = stepEnemyBehaviors([enteringEnemy], 10, 2.5, 1, 100, 0.1)
      .enemies[0]!;

    expect(startingPosition).toBe(120);
    expect((startingPosition - result.position) / 0.1).toBeCloseTo(5.5);
  });

  it('lets artillery stop and fire from range', () => {
    const artillery = createEnemy('artillery', 'artillery-1', 50);
    let result = stepEnemyBehaviors(
      [artillery],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    );

    expect(result.enemies[0]!.position).toBe(50);
    expect(result.playerHitPoints).toBe(100);
    expect(result.events).toContainEqual({
      type: 'enemy-attack-windup',
      enemyId: 'artillery-1',
    });
    expect(result.rangedAttacks).toHaveLength(0);

    for (let tick = 0; tick < 26; tick += 1) {
      result = stepEnemyBehaviors(
        result.enemies,
        10,
        2.5,
        1,
        result.playerHitPoints,
        SIMULATION_STEP_SECONDS,
      );
    }

    expect(result.playerHitPoints).toBe(100);
    expect(result.rangedAttacks).toEqual([
      expect.objectContaining({
        enemyId: 'artillery-1',
        originPosition: 49.184,
        damage: 9,
        visualId: 'spore',
      }),
    ]);
    expect(result.events).toContainEqual({
      type: 'enemy-attacked',
      enemyId: 'artillery-1',
    });
  });

  it('releases boss projectiles from the forward cannon anchor', () => {
    const boss = createEnemy('kawaii-fortress', 'boss-1', 50);
    let result = stepEnemyBehaviors(
      [boss],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    );

    for (
      let tick = 0;
      tick < 40 && result.rangedAttacks.length === 0;
      tick += 1
    ) {
      result = stepEnemyBehaviors(
        result.enemies,
        10,
        2.5,
        1,
        result.playerHitPoints,
        SIMULATION_STEP_SECONDS,
      );
    }

    expect(result.rangedAttacks).toEqual([
      expect.objectContaining({
        enemyId: 'boss-1',
        originPosition: 45.4,
        visualId: 'boss-core',
      }),
    ]);
  });

  it('makes ranged enemies approach without attacking until within range', () => {
    const artillery = createEnemy('artillery', 'artillery-1', 70);
    const result = stepEnemyBehaviors([artillery], 10, 2.5, 1, 100, 1);

    expect(result.enemies[0]!.position).toBe(64.5);
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
    const windup = stepEnemyBehaviors([bomber], 10, 2.5, 1, 100, 1);
    const contact = stepEnemyBehaviors(
      windup.enemies,
      10,
      2.5,
      1,
      windup.playerHitPoints,
      1,
    );
    const result = stepEnemyBehaviors(
      contact.enemies,
      10,
      2.5,
      1,
      contact.playerHitPoints,
      1,
    );

    expect(result.enemies).toHaveLength(0);
    expect(result.playerHitPoints).toBe(71);
    expect(result.events.map(({ type }) => type)).toEqual([
      'enemy-contact-released',
      'enemy-attacked',
      'vehicle-hit',
    ]);
    expect(result.events[0]).toEqual({
      type: 'enemy-contact-released',
      enemyId: 'bomber-1',
      enemyTypeId: 'bomber',
      contactPosition: 12.5,
    });
  });
});

describe('wave and boss progression', () => {
  it('keeps a cleared wave active while a hostile projectile is in flight', () => {
    const initial = createWaveSimulation(123, 'prototype-wave');
    const readyToClear = {
      ...initial.wave!,
      nextSpawnIndex: WAVE_DEFINITIONS['prototype-wave'].spawns.length,
    };
    const pending = completeWaveIfCleared(
      readyToClear,
      [],
      [
        {
          id: 'enemy-projectile-1',
          ownerId: 'artillery-1',
          previousPosition: 50,
          position: 49,
          velocity: -18,
          radius: 0.55,
          damage: 9,
          ageSeconds: 0.1,
          maximumAgeSeconds: 4,
          visualId: 'spore',
        },
      ],
    );

    expect(pending.wave.completed).toBe(false);
    expect(pending.event).toBeUndefined();

    const cleared = completeWaveIfCleared(readyToClear, [], []);
    expect(cleared.wave.completed).toBe(true);
    expect(cleared.event).toEqual({
      type: 'wave-completed',
      waveId: 'prototype-wave',
    });
  });

  it('spawns scheduled enemies and emits wave lifecycle events', () => {
    const initial = createWaveSimulation(123, 'prototype-wave');
    const started = stepSimulation(
      initial,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(started.enemies.map((enemy) => enemy.typeId)).toEqual(['basic']);
    expect(started.enemies[0]!.position).toBeGreaterThan(100);
    expect(started.enemies[0]!.previousPosition).toBe(120);
    expect(started.enemies[0]!.position).toBeLessThan(
      started.enemies[0]!.previousPosition,
    );
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
    boss.hitPoints = 210;
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
      'artillery',
      'bomber',
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
        .map((enemy) => ({ ...enemy, hitPoints: 100 })),
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
