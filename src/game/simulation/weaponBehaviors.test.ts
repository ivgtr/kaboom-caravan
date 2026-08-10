import { describe, expect, it } from 'vitest';
import { createEnemy } from '../combat/createEnemy';
import type { WeaponId } from '../data/ids';
import { createSimulation } from './createSimulation';
import { stepSimulation } from './stepSimulation';
import { IDLE_COMMAND } from './types';

function simulationWithWeapon(weaponId: WeaponId) {
  const state = createSimulation();
  state.build.primaryWeaponId = weaponId;
  state.player.ammo = 100;
  state.player.energy = 100;
  state.enemies = [];
  return state;
}

describe('weapon-specific behaviors', () => {
  it('fires five independently tracked scatter pellets', () => {
    const state = simulationWithWeapon('scatter-cannon');
    state.enemies = [createEnemy('basic', 'target', 60)];

    const result = stepSimulation(
      state,
      { ...IDLE_COMMAND, firePrimary: true },
      0,
    );

    expect(result.projectiles).toHaveLength(5);
    expect(new Set(result.projectiles.map(({ id }) => id)).size).toBe(5);
    expect(result.player.ammo).toBe(47);
  });

  it('lets flame and railgun hit multiple enemies in one simulation step', () => {
    const flame = simulationWithWeapon('flamethrower');
    flame.enemies = [
      createEnemy('basic', 'flame-a', 25),
      createEnemy('basic', 'flame-b', 29),
    ].map((enemy) => ({ ...enemy, speed: 0 }));
    const flameResult = stepSimulation(
      flame,
      { ...IDLE_COMMAND, firePrimary: true },
      0.5,
    );

    const railgun = simulationWithWeapon('railgun');
    railgun.enemies = [
      createEnemy('heavy', 'rail-a', 42),
      createEnemy('heavy', 'rail-b', 50),
      createEnemy('heavy', 'rail-c', 58),
    ].map((enemy) => ({ ...enemy, speed: 0 }));
    const railgunResult = stepSimulation(
      railgun,
      { ...IDLE_COMMAND, firePrimary: true },
      0.5,
    );

    expect(
      flameResult.events.filter(({ type }) => type === 'projectile-hit'),
    ).toHaveLength(2);
    expect(
      railgunResult.events.filter(({ type }) => type === 'projectile-hit'),
    ).toHaveLength(3);
  });

  it('damages nearby enemies when a rocket explodes', () => {
    const state = simulationWithWeapon('rocket-launcher');
    state.enemies = [
      createEnemy('heavy', 'blast-a', 34),
      createEnemy('heavy', 'blast-b', 40),
    ].map((enemy) => ({ ...enemy, speed: 0 }));

    const result = stepSimulation(
      state,
      { ...IDLE_COMMAND, firePrimary: true },
      0.5,
    );

    expect(
      result.events.filter(({ type }) => type === 'projectile-hit'),
    ).toHaveLength(2);
    expect(result.projectiles).toHaveLength(0);
  });

  it('deploys a stationary mine with a finite lifetime', () => {
    const state = simulationWithWeapon('mine-launcher');
    state.enemies = [createEnemy('basic', 'distant-target', 60)];

    const result = stepSimulation(
      state,
      { ...IDLE_COMMAND, firePrimary: true },
      0,
    );

    expect(result.projectiles).toHaveLength(1);
    expect(result.projectiles[0]).toMatchObject({
      behavior: 'mine',
      position: 18,
      velocity: 0,
      maximumAgeSeconds: 12,
    });
  });

  it('detonates a mine across a clustered enemy group', () => {
    const state = simulationWithWeapon('mine-launcher');
    state.projectiles = [
      {
        id: 'armed-mine',
        ownerId: state.player.id,
        previousPosition: 18,
        position: 18,
        originPosition: 18,
        velocity: 0,
        radius: 2,
        damage: 44,
        maximumRange: 20,
        weaponId: 'mine-launcher',
        optimalRangeMinimum: 6,
        optimalRangeMaximum: 18,
        offRangeDamageMultiplier: 0.65,
        behavior: 'mine',
        remainingHits: 1,
        hitEnemyIds: [],
        explosionRadius: 9,
        ageSeconds: 1,
        maximumAgeSeconds: 12,
      },
    ];
    state.enemies = [
      createEnemy('basic', 'mine-a', 18),
      createEnemy('basic', 'mine-b', 24),
      createEnemy('basic', 'safe', 40),
    ].map((enemy) => ({ ...enemy, speed: 0 }));

    const result = stepSimulation(state, IDLE_COMMAND, 0);

    expect(
      result.events.filter(({ type }) => type === 'projectile-hit'),
    ).toHaveLength(2);
    expect(result.enemies.find(({ id }) => id === 'safe')?.hitPoints).toBe(42);
  });
});
