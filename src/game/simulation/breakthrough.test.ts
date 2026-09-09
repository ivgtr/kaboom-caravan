import { describe, expect, it } from 'vitest';
import { createEnemy } from '../combat/createEnemy';
import { createSimulation } from './createSimulation';
import { stepSimulation } from './stepSimulation';
import {
  BREAKTHROUGH,
  canActivateBreakthrough,
  earnBreakthroughCharge,
  getBreakthroughHitCharge,
  prepareBreakthrough,
} from './breakthrough';
import {
  IDLE_COMMAND,
  SIMULATION_STEP_SECONDS,
  type BreakthroughState,
  type CombatEvent,
} from './types';

const empty: BreakthroughState = {
  charge: 0,
  remainingSeconds: 0,
  hitChargeCooldown: 0,
};
const hit: CombatEvent = {
  type: 'projectile-hit',
  projectileId: 'shot',
  targetId: 'enemy-1',
  weaponId: 'machine-cannon',
  damage: 10,
};
const parry: CombatEvent = {
  type: 'attack-parried',
  sourceId: 'enemy-1',
  attackKind: 'projectile',
  counterDamage: 30,
};
const activate = { ...IDLE_COMMAND, activateBreakthrough: true };
function readyCombat() {
  const state = createSimulation(17);
  state.breakthrough.charge = 100;
  return state;
}
function incoming(id = 'incoming') {
  return {
    id,
    ownerId: 'enemy-1',
    previousPosition: 11,
    position: 11,
    velocity: -18,
    radius: 0.55,
    damage: 12,
    ageSeconds: 0,
    maximumAgeSeconds: 4,
    visualId: 'spore' as const,
  };
}

describe('breakthrough charge', () => {
  it.each([
    [24.99, 0],
    [25, 6],
    [44.99, 6],
    [45, 9],
    [64.99, 9],
    [65, 12],
  ])('awards the correct risk tier at %sm', (position, expected) => {
    expect(getBreakthroughHitCharge(position)).toBe(expected);
    expect(
      earnBreakthroughCharge(empty, [hit], position).breakthrough.charge,
    ).toBe(expected);
  });

  it('does not reward waiting, empty fire, non-damaging hits or safe-zone hits', () => {
    for (const events of [
      [],
      [
        {
          type: 'weapon-fired',
          projectileId: 'shot',
          weaponId: 'machine-cannon',
        } as CombatEvent,
      ],
      [{ ...hit, damage: 0 }],
    ]) {
      expect(
        earnBreakthroughCharge(empty, events, 70).breakthrough.charge,
      ).toBe(0);
    }
    expect(earnBreakthroughCharge(empty, [hit], 10).breakthrough.charge).toBe(
      0,
    );
  });

  it('caps simultaneous pellets and multiple targets to a single hit award', () => {
    const result = earnBreakthroughCharge(
      empty,
      Array.from({ length: 40 }, () => hit),
      70,
    );
    expect(result.breakthrough.charge).toBe(12);
    expect(result.breakthrough.hitChargeCooldown).toBe(
      BREAKTHROUGH.hitIntervalSeconds,
    );
    expect(
      earnBreakthroughCharge(result.breakthrough, [hit], 70).breakthrough
        .charge,
    ).toBe(12);
  });

  it('awards a parry anywhere, once per resolution, independently of the hit cooldown', () => {
    const result = earnBreakthroughCharge(
      { ...empty, hitChargeCooldown: 0.5 },
      [parry, parry],
      10,
    );
    expect(result.breakthrough.charge).toBe(25);
    expect(
      earnBreakthroughCharge(empty, [parry, hit], 50).breakthrough.charge,
    ).toBe(34);
  });

  it('clamps at 100 and emits ready exactly once before the encounter commitment', () => {
    const result = earnBreakthroughCharge(
      { ...empty, charge: 98 },
      [parry, hit],
      70,
    );
    expect(result.breakthrough.charge).toBe(100);
    expect(result.events).toEqual([{ type: 'breakthrough-ready' }]);
    expect(
      earnBreakthroughCharge(result.breakthrough, [parry], 70).events,
    ).toEqual([]);

    const banked = earnBreakthroughCharge(
      { ...empty, charge: 98, committed: true },
      [parry],
      70,
    );
    expect(banked.breakthrough.charge).toBe(100);
    expect(banked.events).toEqual([]);
  });

  it('does not recharge during the burst, even from parries', () => {
    const active = { ...empty, remainingSeconds: 1, committed: true };
    expect(
      earnBreakthroughCharge(active, [hit, parry], 70).breakthrough,
    ).toEqual(active);
  });

  it('earns charge through the real projectile/collision system', () => {
    let state = createSimulation();
    state.player.position = 30;
    state.enemies = [createEnemy('heavy', 'target', 55)];
    for (let tick = 0; tick < 60; tick++) {
      state = stepSimulation(
        state,
        { ...IDLE_COMMAND, firePrimary: true },
        SIMULATION_STEP_SECONDS,
      );
    }
    expect(state.breakthrough.charge).toBeGreaterThan(0);
    expect(state.breakthrough.charge).toBeLessThanOrEqual(12);
  });
});

describe('DEATH RIDE combat integration', () => {
  it('requires full charge, one unused commitment and a live threat', () => {
    const state = readyCombat();
    expect(canActivateBreakthrough(state)).toBe(true);
    state.breakthrough.charge = 99;
    expect(canActivateBreakthrough(state)).toBe(false);
    state.breakthrough.charge = 100;
    state.breakthrough.remainingSeconds = 0.1;
    expect(canActivateBreakthrough(state)).toBe(false);
    state.breakthrough.remainingSeconds = 0;
    state.breakthrough.committed = true;
    expect(canActivateBreakthrough(state)).toBe(false);
    state.breakthrough.committed = false;
    state.enemies = [];
    expect(canActivateBreakthrough(state)).toBe(false);
    expect(
      prepareBreakthrough(state, true, 1 / 60).state.breakthrough.charge,
    ).toBe(100);
    state.enemyProjectiles = [incoming()];
    expect(canActivateBreakthrough(state)).toBe(true);
    state.player.hitPoints = 0;
    expect(canActivateBreakthrough(state)).toBe(false);
  });

  it('keeps incoming bullets and resources while clearing only weapon lockout', () => {
    const initial = readyCombat();
    initial.player.hitPoints = 72;
    initial.player.energy = 50;
    initial.player.ammo = 17;
    initial.player.skillCooldown = 3;
    initial.player.primaryCooldown = 2;
    initial.player.secondaryCooldown = 2;
    initial.player.weaponHeat.primary = { heat: 100, overheated: true };
    initial.player.weaponHeat.secondary = { heat: 90, overheated: true };
    initial.enemyProjectiles = [incoming(), incoming('second')];
    const result = prepareBreakthrough(
      initial,
      true,
      SIMULATION_STEP_SECONDS,
    ).state;
    expect(result.enemyProjectiles).toHaveLength(2);
    expect(result.player.hitPoints).toBe(72);
    expect(result.player.ammo).toBe(17);
    expect(result.player.energy).toBe(50);
    expect(result.player.skillCooldown).toBe(3);
    expect(result.player.primaryCooldown).toBe(0);
    expect(result.player.secondaryCooldown).toBe(0);
    expect(result.player.weaponHeat).toEqual({
      primary: { heat: 0, overheated: false },
      secondary: { heat: 0, overheated: false },
    });
    expect(result.breakthrough).toEqual({
      charge: 0,
      remainingSeconds: BREAKTHROUGH.durationSeconds,
      hitChargeCooldown: 0,
      committed: true,
    });
  });

  it('opens a firing lane but injects a deterministic four-enemy countercharge', () => {
    const initial = readyCombat();
    initial.frontline.position = 78;
    initial.enemies = [
      createEnemy('rusher', 'rush', 30),
      createEnemy('kawaii-fortress', 'boss', 85),
      createEnemy('heavy', 'edge', 119),
    ];
    initial.enemies[0]!.attackWindupRemaining = 0.01;
    const prepared = prepareBreakthrough(
      initial,
      true,
      SIMULATION_STEP_SECONDS,
    );
    const result = prepared.state;
    expect(result.enemies.slice(0, 3).map(({ position }) => position)).toEqual([
      40, 88, 120,
    ]);
    expect(result.enemies[0]!.attackWindupRemaining).toBe(0.01);
    expect(result.frontline.position).toBe(78);
    expect(result.enemies.slice(3).map(({ typeId }) => typeId)).toEqual([
      'rusher',
      'bomber',
      'basic',
      'artillery',
    ]);
    expect(result.enemies.slice(3).map(({ position }) => position)).toEqual([
      30, 38, 46, 54,
    ]);
    expect(result.enemies.slice(3).map(({ id }) => id)).toEqual([
      'death-ride-0-1',
      'death-ride-0-2',
      'death-ride-0-3',
      'death-ride-0-4',
    ]);
    expect(prepared.events).toEqual([{ type: 'breakthrough-activated' }]);
  });

  it('accelerates weapon cooldowns and cooling aggressively while keeping ammunition costs', () => {
    const initial = createSimulation();
    initial.breakthrough.remainingSeconds = 2;
    initial.breakthrough.committed = true;
    initial.player.primaryCooldown = 1;
    initial.player.skillCooldown = 1;
    initial.player.weaponHeat.primary.heat = 80;
    const burst = stepSimulation(initial, IDLE_COMMAND, 0.1);
    const normal = stepSimulation(
      { ...initial, breakthrough: { ...empty } },
      IDLE_COMMAND,
      0.1,
    );
    expect(1 - burst.player.primaryCooldown).toBeCloseTo(
      (1 - normal.player.primaryCooldown) * BREAKTHROUGH.fireRateMultiplier,
    );
    expect(80 - burst.player.weaponHeat.primary.heat).toBeCloseTo(
      (80 - normal.player.weaponHeat.primary.heat) *
        BREAKTHROUGH.coolingMultiplier,
    );
    expect(burst.player.skillCooldown).toBe(normal.player.skillCooldown);
    const fired = stepSimulation(
      readyCombat(),
      { ...activate, firePrimary: true },
      1 / 60,
    );
    expect(fired.player.ammo).toBe(49);
    expect(fired.player.energy).toBe(98);
  });

  it('is not invincibility and activation no longer erases an incoming shot', () => {
    const initial = readyCombat();
    initial.enemyProjectiles = [incoming()];
    const result = stepSimulation(initial, activate, 1 / 60);
    expect(result.player.hitPoints).toBeLessThan(100);
    expect(result.events.some(({ type }) => type === 'vehicle-hit')).toBe(true);
    expect(result.breakthrough.committed).toBe(true);
  });

  it('allows only one activation per encounter even after banking another 100%', () => {
    const activated = prepareBreakthrough(
      readyCombat(),
      true,
      SIMULATION_STEP_SECONDS,
    ).state;
    const spent = {
      ...activated,
      breakthrough: {
        ...activated.breakthrough,
        remainingSeconds: 0,
        charge: 100,
      },
    };
    expect(canActivateBreakthrough(spent)).toBe(false);
    const retried = prepareBreakthrough(
      spent,
      true,
      SIMULATION_STEP_SECONDS,
    ).state;
    expect(retried.enemies).toHaveLength(spent.enemies.length);
    expect(retried.breakthrough.charge).toBe(100);
  });

  it('expires on simulation time without clearing the encounter commitment', () => {
    let state = prepareBreakthrough(
      readyCombat(),
      true,
      SIMULATION_STEP_SECONDS,
    ).state;
    for (let tick = 0; tick < 241; tick++) {
      state = prepareBreakthrough(state, false, 1 / 60).state;
    }
    expect(state.breakthrough.remainingSeconds).toBe(0);
    expect(state.breakthrough.charge).toBe(0);
    expect(state.breakthrough.committed).toBe(true);
  });

  it.each(['victory', 'defeat'] as const)(
    'cannot activate or advance a burst after %s',
    (status) => {
      const state = readyCombat();
      state.status = status;
      state.breakthrough.remainingSeconds = 2;
      expect(stepSimulation(state, activate, 1).breakthrough).toEqual(
        state.breakthrough,
      );
    },
  );

  it('does not mutate its input and replays deterministically', () => {
    const state = readyCombat();
    const before = structuredClone(state);
    const first = stepSimulation(state, activate, 1 / 60);
    expect(state).toEqual(before);
    expect(stepSimulation(state, activate, 1 / 60)).toEqual(first);
  });
});
