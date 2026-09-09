import { describe, expect, it } from 'vitest';
import { createEnemy } from '../combat/createEnemy';
import { createSimulation } from './createSimulation';
import { REDLINE_RULES, stepSimulation } from './stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from './types';

describe('REDLINE blood-ammo loop', () => {
  it('requires a deliberate boost + fire override before spending hull', () => {
    const initial = createSimulation();
    initial.player.ammo = 0;

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.player.hitPoints).toBe(100);
    expect(result.player.ammo).toBe(0);
    expect(result.projectiles).toHaveLength(0);
    expect(result.events.some(({ type }) => type === 'weapon-fired')).toBe(
      false,
    );
  });

  it('converts hull integrity into a level-3 emergency volley when deliberately overridden', () => {
    const initial = createSimulation();
    initial.player.ammo = 0;

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, boost: true, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.player.hitPoints).toBe(100 - REDLINE_RULES.hullCostPerAmmo);
    expect(result.player.ammo).toBe(0);
    expect(result.projectiles).toHaveLength(2);
    for (const projectile of result.projectiles) {
      expect(projectile.damage).toBeCloseTo(13.8);
    }
    expect(result.build.weaponLevels['machine-cannon']).toBe(1);
    expect(result.events).toContainEqual({
      type: 'vehicle-hit',
      sourceId: 'redline-overdrive',
      damage: REDLINE_RULES.hullCostPerAmmo,
    });
  });

  it('salvages ammunition from a kill landed while the caravan is dry', () => {
    const initial = createSimulation();
    initial.player.ammo = 0;
    initial.enemies = [
      {
        ...createEnemy('bomber', 'redline-target', 14.8),
        speed: 0,
        hitPoints: 15,
      },
    ];

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, boost: true, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.events).toContainEqual({
      type: 'enemy-killed',
      enemyId: 'redline-target',
      enemyTypeId: 'bomber',
    });
    expect(result.player.ammo).toBe(REDLINE_RULES.salvageAmmoPerKill);
    expect(result.events).toContainEqual({
      type: 'loot-collected',
      lootId: `redline-salvage-${result.tick}`,
      kind: 'ammo',
      value: REDLINE_RULES.salvageAmmoPerKill,
    });
  });

  it('never converts the final hit point into ammunition', () => {
    const initial = createSimulation();
    initial.player.ammo = 0;
    initial.player.hitPoints = REDLINE_RULES.hullCostPerAmmo;

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, boost: true, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.player.hitPoints).toBe(REDLINE_RULES.hullCostPerAmmo);
    expect(result.player.ammo).toBe(0);
    expect(result.projectiles).toHaveLength(0);
    expect(result.events.some(({ type }) => type === 'weapon-fired')).toBe(
      false,
    );
  });
});
