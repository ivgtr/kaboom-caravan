import { describe, expect, it } from 'vitest';
import { WEAPON_DEFINITIONS } from '../data/weaponDefinitions';
import { createSimulation } from '../simulation/createSimulation';
import { stepSimulation } from '../simulation/stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from '../simulation/types';
import { equipModule, validateBuild } from './build';
import { derivePlayerStats, deriveWeaponDefinition } from './derivedStats';
import { evaluateModifiers } from './modifier';
import { runTriggerQueue } from './triggers';

describe('build validation', () => {
  it('accepts four unique modules and rejects duplicates or a fifth slot', () => {
    const base = createSimulation().build;
    const equipped = equipModule(
      equipModule(
        equipModule(equipModule(base, 'armor'), 'radar'),
        'generator',
      ),
      'cooling-fan',
    );

    expect(validateBuild(equipped)).toEqual({ valid: true, errors: [] });
    expect(() => equipModule(equipped, 'ammo-box')).toThrow(/最大4個/);
    expect(() => equipModule(base, 'armor')).not.toThrow();
    expect(() => equipModule(equipModule(base, 'armor'), 'armor')).toThrow(
      /重複装備/,
    );
  });
});

describe('modifier evaluation', () => {
  it('uses base, additive, multiplicative and highest-priority override order', () => {
    expect(
      evaluateModifiers(10, [
        { operation: 'multiplicative', value: 2 },
        { operation: 'additive', value: 5 },
      ]),
    ).toBe(30);
    expect(
      evaluateModifiers(10, [
        { operation: 'override', value: 99, priority: 1 },
        { operation: 'override', value: 42, priority: 2 },
      ]),
    ).toBe(42);
  });

  it('applies player modifiers and weapon tag constraints', () => {
    const state = createSimulation();
    state.build.moduleIds = ['cooling-fan', 'explosive-magazine'];

    const player = derivePlayerStats(state.build);
    const rocket = deriveWeaponDefinition(
      WEAPON_DEFINITIONS['rocket-launcher'],
      state.build,
    );
    const railgun = deriveWeaponDefinition(
      WEAPON_DEFINITIONS.railgun,
      state.build,
    );

    expect(player.coolingPerSecond).toBe(18);
    expect(player.armor).toBe(0);
    expect(rocket.damage).toBe(42);
    expect(railgun.damage).toBe(42);
  });
});

describe('trigger queue', () => {
  it('applies module effects to clamped resources', () => {
    const result = runTriggerQueue(
      [{ type: 'onOverheat' }],
      [
        {
          sourceId: 'test',
          event: 'onOverheat',
          effects: [{ type: 'addResource', resource: 'energy', amount: 25 }],
        },
      ],
      { ammo: 0, energy: 90, heat: 100, hitPoints: 100 },
      { ammo: 30, energy: 100, heat: 100, hitPoints: 100 },
    );

    expect(result.resources.energy).toBe(100);
    expect(result.overflowed).toBe(false);
  });

  it('stops cyclic trigger chains at the configured signal limit', () => {
    const result = runTriggerQueue(
      [{ type: 'onFire' }],
      [
        {
          sourceId: 'loop',
          event: 'onFire',
          effects: [{ type: 'emitTrigger', trigger: 'onFire' }],
        },
      ],
      { ammo: 0, energy: 0, heat: 0, hitPoints: 1 },
      { ammo: 1, energy: 1, heat: 100, hitPoints: 1 },
      3,
    );

    expect(result.processedSignals).toBe(3);
    expect(result.overflowed).toBe(true);
  });

  it('integrates overheat and damage triggers into combat', () => {
    const overheatState = createSimulation();
    overheatState.build.moduleIds = ['heat-recycler'];
    overheatState.player.heat = 99;
    overheatState.player.energy = 50;
    const overheated = stepSimulation(
      overheatState,
      { ...IDLE_COMMAND, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );

    const damageState = createSimulation();
    damageState.build.moduleIds = ['magnetic-armor'];
    damageState.player.ammo = 10;
    damageState.enemies = [
      {
        ...damageState.enemies[0]!,
        position: 14,
        previousPosition: 14,
        speed: 0,
      },
    ];
    const damaged = stepSimulation(
      damageState,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(overheated.player.overheated).toBe(true);
    expect(overheated.player.energy).toBeCloseTo(73.17, 1);
    expect(damaged.player.ammo).toBe(11);
  });
});
