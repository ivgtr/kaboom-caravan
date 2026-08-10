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

    expect(primary.player.ammo).toBe(49);
    expect(primary.player.energy).toBe(98);
    expect(primary.player.primaryCooldown).toBe(0.25);
    expect(primary.player.secondaryCooldown).toBe(0);
    expect(secondary.player.ammo).toBe(47);
    expect(secondary.player.energy).toBe(96);
    expect(secondary.player.primaryCooldown).toBe(0);
    expect(secondary.player.secondaryCooldown).toBe(0.9);
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

  it('opens a parry window without duplicating normal backward movement', () => {
    const initial = createSimulation();
    initial.player.position = 40;
    initial.player.previousPosition = 40;
    initial.player.heat = 80;

    const result = stepSimulation(
      initial,
      { ...IDLE_COMMAND, activateSkill: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(result.player.position).toBe(40);
    expect(result.player.heat).toBeCloseTo(79.8);
    expect(result.player.energy).toBe(80);
    expect(result.player.skillCooldown).toBe(4);
    expect(result.player.parryWindowSeconds).toBe(0.42);
    expect(result.events).toContainEqual({
      type: 'skill-activated',
      skillId: 'reactive-parry',
    });
  });

  it('parries an incoming projectile, vents heat and counters its source', () => {
    const initial = createSimulation();
    initial.player.energy = 50;
    initial.player.heat = 80;
    initial.player.parryWindowSeconds = 0.3;
    initial.enemyProjectiles = [
      {
        id: 'incoming',
        ownerId: 'enemy-1',
        previousPosition: 11,
        position: 11,
        velocity: -18,
        radius: 0.55,
        damage: 12,
        ageSeconds: 0,
        maximumAgeSeconds: 4,
        visualId: 'spore',
      },
    ];

    const result = stepSimulation(initial, IDLE_COMMAND, 0.1);

    expect(result.player.hitPoints).toBe(100);
    expect(result.player.energy).toBe(81);
    expect(result.player.heat).toBeCloseTo(48.8);
    expect(result.enemyProjectiles).toHaveLength(0);
    expect(result.enemies.find(({ id }) => id === 'enemy-1')?.hitPoints).toBe(
      12,
    );
    expect(result.events).toContainEqual({
      type: 'attack-parried',
      sourceId: 'enemy-1',
      attackKind: 'projectile',
      counterDamage: 30,
    });
  });

  it('parries a telegraphed contact attack without moving backward', () => {
    const initial = createSimulation();
    initial.player.parryWindowSeconds = 0.3;
    initial.enemies = [
      {
        ...initial.enemies[0]!,
        previousPosition: 14,
        position: 14,
        speed: 0,
        attackWindupRemaining: 0.01,
      },
    ];

    const result = stepSimulation(initial, IDLE_COMMAND, 0.02);

    expect(result.player.hitPoints).toBe(100);
    expect(result.player.position).toBe(10);
    expect(result.enemies[0]?.hitPoints).toBe(12);
    expect(result.events.some(({ type }) => type === 'vehicle-hit')).toBe(
      false,
    );
    expect(result.events).toContainEqual({
      type: 'attack-parried',
      sourceId: 'enemy-1',
      attackKind: 'contact',
      counterDamage: 30,
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
    initial.frontline.position = 0.005;
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
