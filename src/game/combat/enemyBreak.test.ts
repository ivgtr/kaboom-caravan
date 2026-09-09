import { describe, expect, it } from 'vitest';
import { SIMULATION_STEP_SECONDS } from '../simulation/types';
import { createEnemy } from './createEnemy';
import { stepEnemyBehaviors } from './enemyBehavior';

describe('enemy break combat', () => {
  it('stops an enemy and suppresses its pressure when damage crosses a break threshold', () => {
    const basic = createEnemy('basic', 'basic-break', 50);
    basic.hitPoints = 18;

    const broken = stepEnemyBehaviors(
      [basic],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    );
    const enemy = broken.enemies[0]!;

    expect(enemy.position).toBe(50);
    expect(enemy.breakStage).toBe(1);
    expect(enemy.breakRemainingSeconds).toBeCloseTo(0.45);
    expect(enemy.frontlinePressure).toBeCloseTo(0.2);
    expect(broken.events).toHaveLength(0);

    const staggered = stepEnemyBehaviors(
      broken.enemies,
      10,
      2.5,
      1,
      100,
      0.2,
    );

    expect(staggered.enemies[0]!.position).toBe(50);
    expect(staggered.enemies[0]!.breakRemainingSeconds).toBeCloseTo(0.25);
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
    expect(firstBreak.position).toBe(50);

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
    expect(secondBreak.position).toBe(50);
    expect(secondBreak.breakRemainingSeconds).toBeCloseTo(0.78);
  });

  it('pauses a ranged windup during break instead of deleting the parry opportunity', () => {
    const artillery = createEnemy('artillery', 'artillery-break', 50);
    const windingUp = stepEnemyBehaviors(
      [artillery],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    ).enemies[0]!;
    const windupSeconds = windingUp.attackWindupRemaining!;

    const broken = stepEnemyBehaviors(
      [{ ...windingUp, hitPoints: 27 }],
      10,
      2.5,
      1,
      100,
      SIMULATION_STEP_SECONDS,
    );

    expect(broken.enemies[0]!.breakStage).toBe(1);
    expect(broken.enemies[0]!.attackWindupRemaining).toBe(windupSeconds);
    expect(broken.rangedAttacks).toHaveLength(0);

    const paused = stepEnemyBehaviors(
      broken.enemies,
      10,
      2.5,
      1,
      100,
      0.2,
    );
    expect(paused.enemies[0]!.attackWindupRemaining).toBe(windupSeconds);
  });
});
