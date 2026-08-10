import { describe, expect, it } from 'vitest';
import {
  getDistanceDamageMultiplier,
  getRewardMultiplier,
  getRiskTier,
} from './distance';
import { createSimulation } from './createSimulation';
import { stepSimulation } from './stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from './types';

describe('distance and risk systems', () => {
  it('applies full damage only inside the weapon optimal range', () => {
    const profile = {
      optimalMinimum: 20,
      optimalMaximum: 40,
      offRangeDamageMultiplier: 0.5,
    };

    expect(getDistanceDamageMultiplier(10, profile)).toBe(0.5);
    expect(getDistanceDamageMultiplier(20, profile)).toBe(1);
    expect(getDistanceDamageMultiplier(40, profile)).toBe(1);
    expect(getDistanceDamageMultiplier(50, profile)).toBe(0.5);
  });

  it('maps advancing positions to increasing reward multipliers', () => {
    expect(getRiskTier(10)).toBe('safe');
    expect(getRiskTier(30)).toBe('frontline');
    expect(getRiskTier(50)).toBe('danger');
    expect(getRiskTier(70)).toBe('enemy-territory');
    expect(getRewardMultiplier('safe')).toBe(1);
    expect(getRewardMultiplier('enemy-territory')).toBe(2.5);
  });
});

describe('weapon resources', () => {
  it('gives primary and secondary weapons independent costs and cooldowns', () => {
    const initial = createSimulation();
    const primary = stepSimulation(
      initial,
      { ...IDLE_COMMAND, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );
    const secondary = stepSimulation(
      initial,
      { ...IDLE_COMMAND, fireSecondary: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(primary.player.ammo).toBe(29);
    expect(primary.player.energy).toBe(98);
    expect(primary.player.primaryCooldown).toBe(0.25);
    expect(primary.player.secondaryCooldown).toBe(0);
    expect(secondary.player.ammo).toBe(28);
    expect(secondary.player.energy).toBe(68);
    expect(secondary.player.primaryCooldown).toBe(0);
    expect(secondary.player.secondaryCooldown).toBe(2.2);
  });

  it('locks weapons on overheat until heat falls to the recovery threshold', () => {
    const initial = createSimulation();
    initial.player.heat = 99;
    const overheated = stepSimulation(
      initial,
      { ...IDLE_COMMAND, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );
    const blocked = stepSimulation(
      { ...overheated, player: { ...overheated.player, primaryCooldown: 0 } },
      { ...IDLE_COMMAND, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );
    const cooled = stepSimulation(
      { ...blocked, player: { ...blocked.player, heat: 60.1 } },
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(overheated.player.overheated).toBe(true);
    expect(overheated.events).toContainEqual({ type: 'overheated' });
    expect(blocked.player.ammo).toBe(overheated.player.ammo);
    expect(cooled.player.overheated).toBe(false);
    expect(cooled.events).toContainEqual({ type: 'cooled' });
  });

  it('uses emergency boost to retreat and vent heat at an energy cost', () => {
    const initial = createSimulation();
    initial.player.position = 40;
    initial.player.previousPosition = 40;
    initial.player.heat = 80;

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, activateSkill: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.player.position).toBe(28);
    expect(result.player.heat).toBeCloseTo(44.8);
    expect(result.player.energy).toBe(75);
    expect(result.player.skillCooldown).toBe(6);
    expect(result.events).toContainEqual({
      type: 'skill-activated',
      skillId: 'emergency-boost',
    });
  });
});

describe('frontline and combat outcome', () => {
  it('retreats under enemy pressure and increases rewards when advancing', () => {
    const initial = createSimulation();
    initial.player.position = 50;
    initial.player.previousPosition = 50;
    initial.enemies = [
      {
        ...initial.enemies[0]!,
        position: 55,
        previousPosition: 55,
        speed: 0,
      },
    ];

    const result = stepSimulation(
      initial,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(result.frontline.position).toBeLessThan(25);
    expect(result.frontline.pressure).toBe(1);
    expect(result.frontline.riskTier).toBe('danger');
    expect(result.frontline.rewardMultiplier).toBe(1.7);
  });

  it('ends in defeat when the frontline collapses', () => {
    const initial = createSimulation();
    initial.frontline.position = 0.01;
    initial.enemies = [
      {
        ...initial.enemies[0]!,
        position: 20,
        previousPosition: 20,
        speed: 0,
      },
    ];

    const result = stepSimulation(
      initial,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(result.status).toBe('defeat');
    expect(result.events).toContainEqual({
      type: 'combat-ended',
      result: 'defeat',
    });
  });

  it('ends in victory after the last threat and projectile are gone', () => {
    const initial = createSimulation();
    initial.enemies = [];

    const result = stepSimulation(
      initial,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(result.status).toBe('victory');
    expect(result.events).toContainEqual({
      type: 'combat-ended',
      result: 'victory',
    });
  });
});
