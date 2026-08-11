import { describe, expect, it } from 'vitest';
import { circlesOverlap1d, segmentIntersectsCircle1d } from './collision';
import { createSimulation } from './createSimulation';
import { FixedStepClock } from './FixedStepClock';
import { createPresentationSnapshot } from './presentationSnapshot';
import { createSeededRandom } from './random';
import { stepSimulation } from './stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS } from './types';

function runTicks(
  count: number,
  initial = createSimulation(),
  firePrimary = false,
) {
  let state = initial;
  for (let tick = 0; tick < count; tick += 1) {
    state = stepSimulation(
      state,
      { ...IDLE_COMMAND, firePrimary },
      SIMULATION_STEP_SECONDS,
    );
  }
  return state;
}

describe('collision helpers', () => {
  it('detects circle overlap and fast segment hits in one dimension', () => {
    expect(circlesOverlap1d(10, 2, 13, 1)).toBe(true);
    expect(circlesOverlap1d(10, 2, 14, 1)).toBe(false);
    expect(segmentIntersectsCircle1d(10, 30, 20, 0.5)).toBe(true);
    expect(segmentIntersectsCircle1d(10, 15, 20, 0.5)).toBe(false);
  });
});

describe('stepSimulation', () => {
  it('moves the player independently of render FPS', () => {
    let state = createSimulation();
    const clock = new FixedStepClock();

    for (let frame = 0; frame < 30; frame += 1) {
      clock.advance(1 / 30, (deltaSeconds) => {
        state = stepSimulation(
          state,
          { ...IDLE_COMMAND, move: 1 },
          deltaSeconds,
        );
      });
    }

    expect(state.tick).toBe(60);
    expect(state.player.position).toBeCloseTo(19.7);
    expect(state.player.velocity).toBe(12);
  });

  it('coasts to a stop and brakes before reversing direction', () => {
    const moving = runMovementTicks(30, 1);
    expect(moving.player.velocity).toBe(12);

    const released = runMovementTicks(10, 0, moving);
    expect(released.player.velocity).toBeCloseTo(9);
    expect(released.player.position).toBeGreaterThan(moving.player.position);

    const firstReverseTick = stepSimulation(
      moving,
      { ...IDLE_COMMAND, move: -1 },
      SIMULATION_STEP_SECONDS,
    );
    expect(firstReverseTick.player.velocity).toBeGreaterThan(0);
    expect(firstReverseTick.player.position).toBeGreaterThan(
      moving.player.position,
    );
  });

  it('activates a directional dash once and returns to normal top speed', () => {
    const initial = createSimulation();
    let state = stepSimulation(
      initial,
      { ...IDLE_COMMAND, move: 1, activateDash: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(state.events).toContainEqual({
      type: 'dash-activated',
      direction: 1,
    });
    expect(state.player.dashCooldown).toBe(2.7);
    expect(state.player.dashRemainingSeconds).toBe(0.22);
    expect(state.player.velocity).toBeGreaterThan(0.5);

    let maximumVelocity = state.player.velocity;
    for (let tick = 0; tick < 20; tick += 1) {
      state = stepSimulation(
        state,
        { ...IDLE_COMMAND, move: 1 },
        SIMULATION_STEP_SECONDS,
      );
      maximumVelocity = Math.max(maximumVelocity, state.player.velocity);
    }

    expect(maximumVelocity).toBeGreaterThan(12);
    expect(state.player.dashRemainingSeconds).toBe(0);
    expect(state.player.dashDirection).toBe(0);
    expect(state.player.velocity).toBe(12);
  });

  it('requires a direction and does not reactivate during dash cooldown', () => {
    const initial = createSimulation();
    const stationary = stepSimulation(
      initial,
      { ...IDLE_COMMAND, activateDash: true },
      SIMULATION_STEP_SECONDS,
    );
    expect(stationary.player.dashCooldown).toBe(0);
    expect(stationary.events).not.toContainEqual(
      expect.objectContaining({ type: 'dash-activated' }),
    );

    const activated = stepSimulation(
      stationary,
      { ...IDLE_COMMAND, move: -1, activateDash: true },
      SIMULATION_STEP_SECONDS,
    );
    const blocked = stepSimulation(
      {
        ...activated,
        player: { ...activated.player, dashRemainingSeconds: 0 },
      },
      { ...IDLE_COMMAND, move: 1, activateDash: true },
      SIMULATION_STEP_SECONDS,
    );

    expect(activated.player.dashDirection).toBe(-1);
    expect(blocked.events).not.toContainEqual(
      expect.objectContaining({ type: 'dash-activated' }),
    );
    expect(blocked.player.dashCooldown).toBeGreaterThan(0);
  });

  it('produces the same state at 30, 60 and 120 render frames per second', () => {
    const simulate = (framesPerSecond: number) => {
      let state = createSimulation(123);
      const clock = new FixedStepClock();
      for (let frame = 0; frame < framesPerSecond * 2; frame += 1) {
        clock.advance(1 / framesPerSecond, (deltaSeconds) => {
          state = stepSimulation(
            state,
            { ...IDLE_COMMAND, move: 1, firePrimary: true },
            deltaSeconds,
          );
        });
      }
      return state;
    };

    expect(simulate(30)).toEqual(simulate(60));
    expect(simulate(60)).toEqual(simulate(120));
  });

  it('moves projectiles, resolves armor damage and emits events', () => {
    const initial = createSimulation();
    initial.enemies[0] = {
      ...initial.enemies[0]!,
      previousPosition: 16,
      position: 16,
      speed: 0,
      armor: 2,
    };

    const fired = stepSimulation(
      initial,
      { ...IDLE_COMMAND, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );
    const hit = runTicks(1, fired);

    expect(fired.events).toContainEqual({
      type: 'weapon-fired',
      projectileId: 'projectile-1',
      weaponId: 'machine-cannon',
    });
    expect(hit.enemies[0]!.hitPoints).toBe(38.5);
    expect(hit.events).toContainEqual({
      type: 'projectile-hit',
      projectileId: 'projectile-1',
      targetId: 'enemy-1',
      weaponId: 'machine-cannon',
      damage: 3.5,
    });
  });

  it('removes defeated enemies and emits an enemy-killed event', () => {
    const initial = createSimulation();
    initial.enemies = [
      {
        ...initial.enemies[0]!,
        previousPosition: 16,
        position: 16,
        speed: 0,
        hitPoints: 5,
      },
    ];

    const fired = stepSimulation(
      initial,
      { ...IDLE_COMMAND, firePrimary: true },
      SIMULATION_STEP_SECONDS,
    );
    const result = runTicks(1, fired);

    expect(result.enemies).toHaveLength(0);
    expect(result.events).toContainEqual({
      type: 'enemy-killed',
      enemyId: 'enemy-1',
      enemyTypeId: 'basic',
    });
  });

  it('applies contact damage on a cooldown', () => {
    const initial = createSimulation();
    initial.enemies = [
      {
        ...initial.enemies[0]!,
        previousPosition: 14,
        position: 14,
        speed: 0,
      },
    ];

    const windup = stepSimulation(
      initial,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );
    let firstHit = windup;
    for (let tick = 0; tick < 20; tick += 1) {
      firstHit = stepSimulation(
        firstHit,
        IDLE_COMMAND,
        SIMULATION_STEP_SECONDS,
      );
      if (firstHit.events.some(({ type }) => type === 'vehicle-hit')) break;
    }
    const cooldownTick = stepSimulation(
      firstHit,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(windup.player.hitPoints).toBe(100);
    expect(windup.events).toContainEqual({
      type: 'enemy-attack-windup',
      enemyId: 'enemy-1',
    });
    expect(firstHit.player.hitPoints).toBe(93);
    expect(firstHit.events).toContainEqual({
      type: 'vehicle-hit',
      sourceId: 'enemy-1',
      damage: 7,
    });
    expect(cooldownTick.player.hitPoints).toBe(93);
  });

  it('delays ranged damage until the hostile projectile reaches the player', () => {
    const initial = createSimulation();
    initial.enemies = [
      {
        ...initial.enemies[0]!,
        id: 'artillery-1',
        typeId: 'artillery',
        behaviorId: 'stopAndShoot',
        previousPosition: 50,
        position: 50,
        radius: 1.7,
        attackRange: 44,
        attackDamage: 9,
        attackWindupSeconds: 0.42,
        attackCooldownSeconds: 2.4,
        speed: 1,
      },
    ];

    let state = stepSimulation(initial, IDLE_COMMAND, SIMULATION_STEP_SECONDS);
    expect(state.player.hitPoints).toBe(100);
    expect(state.events).toContainEqual({
      type: 'enemy-attack-windup',
      enemyId: 'artillery-1',
    });

    for (let tick = 0; tick < 30; tick += 1) {
      state = stepSimulation(state, IDLE_COMMAND, SIMULATION_STEP_SECONDS);
      if (state.enemyProjectiles.length > 0) break;
    }
    expect(state.player.hitPoints).toBe(100);
    expect(state.enemyProjectiles).toHaveLength(1);
    expect(state.events).toContainEqual({
      type: 'enemy-projectile-fired',
      enemyId: 'artillery-1',
      projectileId: 'enemy-projectile-1',
      visualId: 'spore',
    });

    for (let tick = 0; tick < 180; tick += 1) {
      state = stepSimulation(state, IDLE_COMMAND, SIMULATION_STEP_SECONDS);
      if (state.events.some(({ type }) => type === 'enemy-projectile-hit')) {
        break;
      }
    }
    expect(state.enemyProjectiles).toHaveLength(0);
    expect(state.player.hitPoints).toBe(92);
    expect(state.events).toContainEqual({
      type: 'enemy-projectile-hit',
      sourceId: 'artillery-1',
      projectileId: 'enemy-projectile-1',
      visualId: 'spore',
      damage: 8,
    });
  });

  it('expires a hostile projectile that misses without damaging the player', () => {
    const initial = createSimulation();
    initial.enemies = [];
    initial.enemyProjectiles = [
      {
        id: 'enemy-projectile-miss',
        ownerId: 'artillery-1',
        previousPosition: 50,
        position: 50,
        velocity: 18,
        radius: 0.55,
        damage: 9,
        ageSeconds: 0,
        maximumAgeSeconds: 0.01,
        visualId: 'spore',
      },
    ];

    const result = stepSimulation(
      initial,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(result.enemyProjectiles).toHaveLength(0);
    expect(result.player.hitPoints).toBe(100);
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ type: 'vehicle-hit' }),
    );
  });

  it('expires a player projectile after its finite lifetime', () => {
    const initial = createSimulation();
    initial.enemies = [];
    initial.projectiles = [
      {
        id: 'expired-player-projectile',
        ownerId: 'player',
        previousPosition: 20,
        position: 20,
        originPosition: 20,
        velocity: 0,
        radius: 0.2,
        damage: 10,
        maximumRange: 60,
        weaponId: 'machine-cannon',
        optimalRangeMinimum: 12,
        optimalRangeMaximum: 40,
        offRangeDamageMultiplier: 0.7,
        behavior: 'projectile',
        remainingHits: 1,
        hitEnemyIds: [],
        explosionRadius: 0,
        ageSeconds: 0,
        maximumAgeSeconds: 0.01,
      },
    ];

    const result = stepSimulation(
      initial,
      IDLE_COMMAND,
      SIMULATION_STEP_SECONDS,
    );

    expect(result.projectiles).toHaveLength(0);
  });

  it('does not mutate the previous state', () => {
    const initial = createSimulation();
    const originalEnemy = structuredClone(initial.enemies[0]);

    stepSimulation(initial, IDLE_COMMAND, SIMULATION_STEP_SECONDS);

    expect(initial.enemies[0]).toEqual(originalEnemy);
    expect(initial.projectiles).toEqual([]);
    expect(initial.tick).toBe(0);
  });

  it('creates a detached presentation snapshot', () => {
    const state = createSimulation();
    const snapshot = createPresentationSnapshot(state);

    state.enemies[0]!.position = 99;

    expect(snapshot.enemies[0]!.position).toBe(55);
  });
});

function runMovementTicks(
  count: number,
  move: -1 | 0 | 1,
  initial = createSimulation(),
) {
  let state = initial;
  for (let tick = 0; tick < count; tick += 1) {
    state = stepSimulation(
      state,
      { ...IDLE_COMMAND, move },
      SIMULATION_STEP_SECONDS,
    );
  }
  return state;
}

describe('createSeededRandom', () => {
  it('replays the same random sequence for the same seed', () => {
    const left = createSeededRandom(123);
    const right = createSeededRandom(123);

    expect([left.next(), left.next(), left.next()]).toEqual([
      right.next(),
      right.next(),
      right.next(),
    ]);
  });
});
