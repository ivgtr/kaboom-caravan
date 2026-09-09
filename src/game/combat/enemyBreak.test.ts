import { describe, expect, it } from 'vitest';
import { SIMULATION_STEP_SECONDS } from '../simulation/types';
import { createEnemy } from './createEnemy';
import { stepEnemyBehaviors } from './enemyBehavior';

describe('enemy break combat', () => {
  it('recoils and interrupts an enemy when damage crosses its break threshold', () => {
    const basic = createEnemy('basic', 'basic-break', 50);
    basic.hitPoints = 16;

    const broken = stepEnemyBehaviors(
      [basic],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    );
    const enemy = broken.enemies[0]!;

    expect(enemy.position).toBeCloseTo(53.2);
    expect(enemy.breakStage).toBe(1);
    expect(enemy.breakRemainingSeconds).toBeCloseTo(0.52);
    expect(enemy.attackWindupRemaining).toBeUndefined();
    expect(broken.events).toHaveLength(0);

    const staggered = stepEnemyBehaviors(
      broken.enemies,
      10,
      2.5,
      1,
      100,
      0.2,
    );

    expect(staggered.enemies[0]!.position).toBeCloseTo(53.2);
    expect(staggered.enemies[0]!.breakRemainingSeconds).toBeCloseTo(0.32);
    expect(staggered.events).toHaveLength(0);
  });

  it('shreds armor again when a heavy crosses its second break threshold', () => {
    const heavy = createEnemy('heavy', 'heavy-break', 50);
    heavy.hitPoints = 60;

    const firstBreak = stepEnemyBehaviors(
      [heavy],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    ).enemies[0]!;

    expect(firstBreak.breakStage).toBe(1);
    expect(firstBreak.armor).toBe(2);
    expect(firstBreak.position).toBeCloseTo(52.8);

    const readyForSecondBreak = {
      ...firstBreak,
      hitPoints: 30,
      breakRemainingSeconds: 0,
    };
    const secondBreak = stepEnemyBehaviors(
      [readyForSecondBreak],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    ).enemies[0]!;

    expect(secondBreak.breakStage).toBe(2);
    expect(secondBreak.armor).toBe(1);
    expect(secondBreak.position - firstBreak.position).toBeCloseTo(3.22);
    expect(secondBreak.breakRemainingSeconds).toBeCloseTo(0.84);
  });

  it('cancels a ranged attack windup when artillery is broken', () => {
    const artillery = createEnemy('artillery', 'artillery-break', 50);
    const windingUp = stepEnemyBehaviors(
      [artillery],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    ).enemies[0]!;
    expect(windingUp.attackWindupRemaining).toBeDefined();

    const broken = stepEnemyBehaviors(
      [{ ...windingUp, hitPoints: 26 }],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    );

    expect(broken.enemies[0]!.breakStage).toBe(1);
    expect(broken.enemies[0]!.attackWindupRemaining).toBeUndefined();
    expect(broken.rangedAttacks).toHaveLength(0);
    expect(broken.events).toHaveLength(0);
  });
});
