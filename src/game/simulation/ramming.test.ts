import { describe, expect, it } from 'vitest';
import { createEnemy } from '../combat/createEnemy';
import type { EnemyTypeId } from '../data/ids';
import { createSimulation } from './createSimulation';
import { RAM_RULES, REDLINE_RULES, stepSimulation } from './stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from './types';

function enemyAtRamContact(typeId: EnemyTypeId, id: string) {
  const initial = createSimulation();
  const enemy = createEnemy(typeId, id, 0);
  const position =
    initial.player.position + initial.player.radius + enemy.radius + 0.2;
  return {
    ...enemy,
    previousPosition: position,
    position,
    speed: 0,
  };
}

describe('RAM boost collision', () => {
  it('does not ram until the caravan has enough forward velocity', () => {
    const initial = createSimulation();
    initial.player.velocity = RAM_RULES.minimumVelocity - 0.1;
    initial.enemies = [enemyAtRamContact('rusher', 'too-slow')];

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, move: 1, boost: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.enemies.find(({ id }) => id === 'too-slow')?.hitPoints).toBe(
      30,
    );
    expect(
      result.events.some(
        (event) =>
          event.type === 'enemy-killed' && event.enemyId === 'too-slow',
      ),
    ).toBe(false);
  });

  it('roadkills a fragile enemy without losing hull or forward momentum', () => {
    const initial = createSimulation();
    initial.player.velocity = 19;
    initial.enemies = [enemyAtRamContact('rusher', 'roadkill')];

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, move: 1, boost: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.events).toContainEqual({
      type: 'enemy-killed',
      enemyId: 'roadkill',
      enemyTypeId: 'rusher',
    });
    expect(result.enemies.some(({ id }) => id === 'roadkill')).toBe(false);
    expect(result.player.hitPoints).toBe(100);
    expect(result.player.velocity).toBeGreaterThan(0);
  });

  it('rebounds and pays hull when the target survives the impact', () => {
    const initial = createSimulation();
    initial.player.velocity = 19;
    initial.enemies = [enemyAtRamContact('heavy', 'heavy-target')];

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, move: 1, boost: true },
      SIMULATION_STEP_SECONDS,
    );
    const heavy = result.enemies.find(({ id }) => id === 'heavy-target');

    expect(heavy).toBeDefined();
    expect(heavy!.hitPoints).toBeGreaterThan(0);
    expect(heavy!.hitPoints).toBeLessThan(100);
    expect(heavy!.breakRemainingSeconds).toBeGreaterThan(0);
    expect(result.player.hitPoints).toBeLessThan(100);
    expect(result.player.velocity).toBeLessThan(0);
    expect(
      result.events.some(
        (event) =>
          event.type === 'vehicle-hit' &&
          event.sourceId === 'ram-crash-heavy-target' &&
          event.damage >= RAM_RULES.minimumCrashDamage,
      ),
    ).toBe(true);
  });

  it('can lose the encounter by ramming something too heavy', () => {
    const initial = createSimulation();
    initial.player.velocity = 19;
    initial.player.hitPoints = RAM_RULES.minimumCrashDamage;
    initial.enemies = [enemyAtRamContact('heavy', 'fatal-heavy')];

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, move: 1, boost: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.player.hitPoints).toBe(0);
    expect(result.status).toBe('defeat');
    expect(result.events.at(-1)).toEqual({
      type: 'combat-ended',
      result: 'defeat',
    });
  });

  it('turns a dry roadkill into the same salvage comeback as REDLINE kills', () => {
    const initial = createSimulation();
    initial.player.velocity = 19;
    initial.player.ammo = 0;
    initial.enemies = [enemyAtRamContact('rusher', 'dry-roadkill')];

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, move: 1, boost: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.events).toContainEqual({
      type: 'enemy-killed',
      enemyId: 'dry-roadkill',
      enemyTypeId: 'rusher',
    });
    expect(result.player.ammo).toBe(REDLINE_RULES.salvageAmmoPerKill);
    expect(result.events).toContainEqual({
      type: 'loot-collected',
      lootId: `redline-salvage-${result.tick}`,
      kind: 'ammo',
      value: REDLINE_RULES.salvageAmmoPerKill,
    });
  });
});
