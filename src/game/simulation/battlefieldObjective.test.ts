import { describe, expect, it } from 'vitest';
import { createEnemy } from '../combat/createEnemy';
import { BATTLEFIELD_OBJECTIVES } from '../data/routeDefinitions';
import {
  advanceBattlefieldObjective,
  createBattlefieldObjective,
  getObjectiveStatus,
  isInsideObjective,
  isObjectiveContested,
} from './battlefieldObjective';
import { createSimulation, createWaveSimulation } from './createSimulation';
import { stepSimulation } from './stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS as DT } from './types';

const context = {
  deltaSeconds: 1,
  position: 45,
  enemies: [],
  defeated: false,
  battlefieldCleared: false,
};
const fresh = () => createBattlefieldObjective('repair')!;

function battlefield() {
  const state = createSimulation();
  state.objective = fresh();
  state.player.position = 45;
  state.player.previousPosition = 45;
  state.player.hitPoints = 30;
  state.enemies = [
    { ...createEnemy('heavy', 'guard', 95), speed: 0, hitPoints: 100000 },
  ];
  return state;
}

describe('optional battlefield objectives', () => {
  it('only creates objectives on recovery detours', () => {
    expect(createBattlefieldObjective('normal')).toBeUndefined();
    expect(createBattlefieldObjective('elite')).toBeUndefined();
    for (const kind of ['repair', 'salvage'] as const) {
      expect(createBattlefieldObjective(kind)).toEqual({
        kind,
        status: 'active',
        progressSeconds: 0,
        remainingSeconds: BATTLEFIELD_OBJECTIVES[kind].deadlineSeconds,
      });
    }
    expect(advanceBattlefieldObjective(undefined, context)).toEqual({
      objective: undefined,
    });
  });
  it.each([
    [36.99, false],
    [37, true],
    [45, true],
    [53, true],
    [53.01, false],
  ])('tests caravan center at %sm', (position, expected) => {
    expect(isInsideObjective(fresh(), position)).toBe(expected);
  });
  it('contests on live enemy collider overlap, but not dead enemies', () => {
    const enemy = createEnemy('heavy', 'guard', 55.1);
    expect(isObjectiveContested(fresh(), [enemy])).toBe(true);
    expect(isObjectiveContested(fresh(), [{ ...enemy, position: 55.11 }])).toBe(
      false,
    );
    expect(isObjectiveContested(fresh(), [{ ...enemy, hitPoints: 0 }])).toBe(
      false,
    );
  });
  it('accumulates occupation, preserves it on retreat, and only spends simulation time', () => {
    const original = fresh();
    const first = advanceBattlefieldObjective(original, context).objective!;
    expect(first.progressSeconds).toBe(1);
    expect(original).toEqual(fresh());
    const retreat = advanceBattlefieldObjective(first, {
      ...context,
      position: 10,
    }).objective!;
    expect(retreat.progressSeconds).toBe(1);
    expect(retreat.remainingSeconds).toBe(16);
    const contested = advanceBattlefieldObjective(retreat, {
      ...context,
      enemies: [createEnemy('basic', 'guard', 45)],
    }).objective!;
    expect(contested.progressSeconds).toBe(1);
    const result = advanceBattlefieldObjective(contested, {
      ...context,
      deltaSeconds: 2,
    });
    expect(result.objective?.status).toBe('secured');
    expect(result.event).toEqual({ type: 'objective-secured', kind: 'repair' });
    expect(result.objective?.remainingSeconds).toBe(13);
  });
  it('success at the exact deadline beats expiration', () => {
    const objective = {
      ...fresh(),
      remainingSeconds: DT,
      progressSeconds: 3 - DT,
    };
    expect(
      advanceBattlefieldObjective(objective, { ...context, deltaSeconds: DT })
        .objective?.status,
    ).toBe('secured');
  });
  it('a partial final step cannot count time after expiration', () => {
    const objective = {
      ...fresh(),
      remainingSeconds: 0.2,
      progressSeconds: 2.7,
    };
    const result = advanceBattlefieldObjective(objective, context);
    expect(result.objective).toMatchObject({
      status: 'lost',
      remainingSeconds: 0,
    });
    expect(result.objective!.progressSeconds).toBeCloseTo(2.9);
  });
  it('a completed wave secures the site anywhere, but not after its deadline', () => {
    const objective = { ...fresh(), remainingSeconds: 0.5 };
    const clear = {
      ...context,
      deltaSeconds: 0.5,
      position: 10,
      battlefieldCleared: true,
    };
    expect(
      advanceBattlefieldObjective(objective, clear).objective?.status,
    ).toBe('secured');
    expect(
      advanceBattlefieldObjective(objective, { ...clear, deltaSeconds: 0.6 })
        .objective?.status,
    ).toBe('lost');
  });
  it('defeat wins over repair, occupation and wave clearance', () => {
    expect(
      advanceBattlefieldObjective(fresh(), {
        ...context,
        deltaSeconds: 3,
        defeated: true,
        battlefieldCleared: true,
      }).event,
    ).toEqual({ type: 'objective-lost', kind: 'repair' });
  });
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'ignores invalid dt %s',
    (deltaSeconds) => {
      const objective = fresh();
      expect(
        advanceBattlefieldObjective(objective, { ...context, deltaSeconds })
          .objective,
      ).toBe(objective);
    },
  );
  it.each(['secured', 'lost'] as const)(
    'never emits a second result or changes %s state',
    (status) => {
      const objective = { ...fresh(), status };
      expect(
        advanceBattlefieldObjective(objective, {
          ...context,
          defeated: true,
          battlefieldCleared: true,
        }),
      ).toEqual({ objective });
    },
  );
  it('uses directional prompts, contested precedence, and explicit resolution text', () => {
    expect(getObjectiveStatus(fresh(), 10, false)).toContain('前進');
    expect(getObjectiveStatus(fresh(), 70, false)).toContain('後退');
    expect(getObjectiveStatus(fresh(), 45, false)).toContain('確保中');
    expect(getObjectiveStatus(fresh(), 45, true)).toContain('敵が範囲内');
    expect(
      getObjectiveStatus({ ...fresh(), status: 'lost' }, 45, false),
    ).toContain('回収断念');
  });
});

describe('objective simulation ordering', () => {
  it('uses three seconds of real fixed steps, repairs once, and preserves the input snapshot', () => {
    const original = battlefield();
    let state = original;
    for (let step = 0; step < 179; step++)
      state = stepSimulation(state, IDLE_COMMAND, DT);
    expect(state.objective?.status).toBe('active');
    expect(state.player.hitPoints).toBe(30);
    state = stepSimulation(state, IDLE_COMMAND, DT);
    expect(state.objective?.status).toBe('secured');
    expect(state.player.hitPoints).toBe(70);
    expect(
      state.events.filter(({ type }) => type === 'objective-secured'),
    ).toHaveLength(1);
    state = stepSimulation(state, IDLE_COMMAND, DT);
    expect(state.player.hitPoints).toBe(70);
    expect(state.events.some(({ type }) => type === 'objective-secured')).toBe(
      false,
    );
    expect(original.objective).toEqual(fresh());
    expect(original.player.hitPoints).toBe(30);
  });
  it('caps repair at the derived maximum', () => {
    const state = battlefield();
    state.player.hitPoints = 90;
    state.objective!.progressSeconds = 3 - DT;
    expect(stepSimulation(state, IDLE_COMMAND, DT).player.hitPoints).toBe(100);
  });
  it('waiting between scheduled spawns is not a free capture', () => {
    const state = createWaveSimulation(1, 'battle-01-wave');
    state.objective = fresh();
    const next = stepSimulation(state, IDLE_COMMAND, DT);
    expect(next.objective?.status).toBe('active');
  });
  it('remaining hostile projectiles prevent the full-clear shortcut', () => {
    const state = battlefield();
    state.enemies = [];
    state.player.position = 10;
    state.enemyProjectiles = [
      {
        id: 'shot',
        ownerId: 'dead',
        position: 80,
        previousPosition: 80,
        velocity: -1,
        radius: 0.5,
        damage: 9,
        ageSeconds: 0,
        maximumAgeSeconds: 99,
        visualId: 'spore',
      },
    ];
    expect(stepSimulation(state, IDLE_COMMAND, DT).objective?.status).toBe(
      'active',
    );
    state.enemyProjectiles = [];
    const cleared = stepSimulation(state, IDLE_COMMAND, DT);
    expect(cleared.objective?.status).toBe('secured');
    expect(cleared.status).toBe('victory');
    expect(cleared.player.hitPoints).toBe(70);
  });
  it.each(['hitPoints', 'frontline'] as const)(
    'cannot revive a player defeated by %s',
    (cause) => {
      const state = battlefield();
      state.objective!.progressSeconds = 3 - DT;
      if (cause === 'hitPoints') state.player.hitPoints = 0;
      else state.frontline.position = 0;
      const next = stepSimulation(state, IDLE_COMMAND, DT);
      expect(next.status).toBe('defeat');
      expect(next.objective?.status).toBe('lost');
      expect(next.player.hitPoints).toBe(state.player.hitPoints);
    },
  );
  it('expiry leaves the enemy wave and battle active, with no bonus', () => {
    const state = battlefield();
    state.objective!.remainingSeconds = DT;
    const next = stepSimulation(state, IDLE_COMMAND, DT);
    expect(next.status).toBe('active');
    expect(next.objective?.status).toBe('lost');
    expect(next.enemies).toHaveLength(1);
    expect(next.player.hitPoints).toBe(30);
  });
  it('breakthrough clears a contested zone, but never speeds up the objective clock', () => {
    const state = battlefield();
    state.enemies = [{ ...createEnemy('heavy', 'guard', 49), speed: 0 }];
    state.breakthrough.charge = 100;
    const next = stepSimulation(
      state,
      { ...IDLE_COMMAND, activateBreakthrough: true },
      DT,
    );
    expect(
      next.events.some(({ type }) => type === 'breakthrough-activated'),
    ).toBe(true);
    expect(next.objective!.progressSeconds).toBeCloseTo(DT);
    expect(next.objective!.remainingSeconds).toBeCloseTo(18 - DT);
  });
  it('siege deploys while holding an uncontested objective', () => {
    let state = battlefield();
    state.build.coreId = 'siege';
    for (let i = 0; i < 180; i++)
      state = stepSimulation(state, IDLE_COMMAND, DT);
    expect(state.objective?.status).toBe('secured');
    expect(state.core.siegeSeconds).toBeGreaterThanOrEqual(1.5);
  });
});
