import { describe, expect, it } from 'vitest';
import {
  SIMULATION_STEP_SECONDS,
  type PlayerCommand,
} from '../simulation/types';
import type { BuildState } from '../simulation/types';
import { MVP_ENCOUNTERS } from '../data/runDefinitions';
import {
  createGameSession,
  selectReward,
  stepGameSession,
  type GameSessionState,
} from './GameSession';

interface EncounterMetrics {
  encounterIndex: number;
  encounterId: string;
  elapsedTicks: number;
  elapsedSeconds: number;
  startingHitPoints: number;
  endingHitPoints: number;
  minimumHitPoints: number;
  forwardDistance: number;
  maximumPosition: number;
  primaryShots: number;
  secondaryShots: number;
  enemyProjectilesFired: number;
  enemyProjectilesHit: number;
  enemyProjectilesAvoided: number;
}

interface RewardSelectionMetric {
  afterEncounter: number;
  rewardId: string;
  rewardType: 'weapon' | 'module';
  weaponSlot?: 'primary' | 'secondary';
}

interface RunMetrics {
  elapsedTicks: number;
  elapsedSeconds: number;
  encountersCompleted: number;
  encounters: EncounterMetrics[];
  rewardsSelected: RewardSelectionMetric[];
  minimumHitPoints: number;
  totalForwardDistance: number;
  primaryShots: number;
  secondaryShots: number;
  primaryUsageRate: number;
  secondaryUsageRate: number;
  enemyProjectilesFired: number;
  enemyProjectilesHit: number;
  enemyProjectilesAvoided: number;
  finalBuild: BuildState;
}

interface ExpectedRunBaseline {
  elapsedTicks: number;
  encounterTicks: number[];
  endingHitPoints: number[];
  forwardDistances: number[];
  primaryShots: number;
  secondaryShots: number;
  enemyProjectiles: [fired: number, hit: number, avoided: number];
  rewardIds: string[];
  finalBuild: BuildState;
}

const EXPECTED_RUN_BASELINES: Readonly<Record<number, ExpectedRunBaseline>> = {
  1: {
    elapsedTicks: 5175,
    encounterTicks: [292, 288, 303, 387, 316, 422, 464, 453, 471, 1779],
    endingHitPoints: [100, 100, 115, 125, 125, 125, 92, 91, 100, 79],
    forwardDistances: [
      55.045, 52.99, 55.73, 54.4, 56.603, 66.315, 53.4, 59.575, 54.4, 40.8,
    ],
    primaryShots: 41,
    secondaryShots: 35,
    enemyProjectiles: [3, 3, 0],
    rewardIds: [
      'module:armor',
      'module:shield-generator',
      'module:capacitor',
      'module:radar',
      'module:cooling-fan',
      'module:heat-recycler',
      'module:explosive-magazine',
      'module:generator',
      'module:ammo-box',
    ],
    finalBuild: {
      primaryWeaponId: 'machine-cannon',
      secondaryWeaponId: 'railgun',
      moduleIds: [
        'heat-recycler',
        'explosive-magazine',
        'generator',
        'ammo-box',
      ],
    },
  },
  42: {
    elapsedTicks: 5175,
    encounterTicks: [292, 288, 303, 387, 308, 414, 464, 453, 480, 1786],
    endingHitPoints: [100, 100, 100, 100, 100, 100, 92, 92, 100, 83],
    forwardDistances: [
      55.045, 52.99, 55.73, 54.4, 56.423, 66.315, 53.4, 59.575, 54.4, 40.8,
    ],
    primaryShots: 41,
    secondaryShots: 35,
    enemyProjectiles: [3, 3, 0],
    rewardIds: [
      'module:generator',
      'module:capacitor',
      'module:heat-recycler',
      'module:ammo-box',
      'module:magnetic-armor',
      'module:radar',
      'module:generator',
      'module:capacitor',
      'module:armor',
    ],
    finalBuild: {
      primaryWeaponId: 'machine-cannon',
      secondaryWeaponId: 'railgun',
      moduleIds: ['radar', 'generator', 'capacitor', 'armor'],
    },
  },
  2026: {
    elapsedTicks: 5143,
    encounterTicks: [292, 288, 303, 387, 308, 414, 456, 445, 471, 1779],
    endingHitPoints: [100, 100, 100, 100, 100, 100, 91, 91, 106, 100],
    forwardDistances: [
      55.045, 52.99, 55.73, 54.4, 56.423, 66.315, 53.4, 59.575, 54.4, 40.8,
    ],
    primaryShots: 41,
    secondaryShots: 35,
    enemyProjectiles: [3, 3, 0],
    rewardIds: [
      'module:generator',
      'module:ammo-box',
      'module:heat-recycler',
      'module:magnetic-armor',
      'module:capacitor',
      'module:explosive-magazine',
      'module:generator',
      'module:shield-generator',
      'module:heat-recycler',
    ],
    finalBuild: {
      primaryWeaponId: 'machine-cannon',
      secondaryWeaponId: 'railgun',
      moduleIds: [
        'explosive-magazine',
        'generator',
        'shield-generator',
        'heat-recycler',
      ],
    },
  },
};

function toRunBaseline(metrics: RunMetrics): ExpectedRunBaseline {
  return {
    elapsedTicks: metrics.elapsedTicks,
    encounterTicks: metrics.encounters.map(({ elapsedTicks }) => elapsedTicks),
    endingHitPoints: metrics.encounters.map(
      ({ endingHitPoints }) => endingHitPoints,
    ),
    forwardDistances: metrics.encounters.map(
      ({ forwardDistance }) => forwardDistance,
    ),
    primaryShots: metrics.primaryShots,
    secondaryShots: metrics.secondaryShots,
    enemyProjectiles: [
      metrics.enemyProjectilesFired,
      metrics.enemyProjectilesHit,
      metrics.enemyProjectilesAvoided,
    ],
    rewardIds: metrics.rewardsSelected.map(({ rewardId }) => rewardId),
    finalBuild: metrics.finalBuild,
  };
}

function combatCommand(session: GameSessionState): PlayerCommand {
  const nearestEnemy = session.combat.enemies.reduce(
    (nearest, enemy) => Math.min(nearest, enemy.position),
    Number.POSITIVE_INFINITY,
  );
  const distance = nearestEnemy - session.combat.player.position;
  const hasTarget = Number.isFinite(distance);
  const bossActive = session.combat.enemies.some(
    (enemy) => enemy.typeId === 'kawaii-fortress',
  );
  const targetDistance = bossActive ? 60 : 37;
  const canUseRailgun =
    hasTarget &&
    distance <= 78 &&
    session.combat.player.energy >= 32 &&
    session.combat.player.heat <= 74;
  return {
    move: !hasTarget
      ? 0
      : distance > targetDistance + 5
        ? 1
        : distance < targetDistance - 5
          ? -1
          : 0,
    firePrimary:
      hasTarget &&
      distance <= 42 &&
      (!canUseRailgun || session.combat.player.secondaryCooldown > 0.35),
    fireSecondary: canUseRailgun,
    activateSkill:
      session.combat.player.overheated && session.combat.player.energy >= 25,
  };
}

function chooseReward(session: GameSessionState) {
  return (
    session.rewardChoices.find((choice) => choice.type === 'module') ??
    session.rewardChoices[0]!
  );
}

function createEncounterMetrics(session: GameSessionState): EncounterMetrics {
  return {
    encounterIndex: session.run.encounterIndex + 1,
    encounterId: MVP_ENCOUNTERS[session.run.encounterIndex]!.id,
    elapsedTicks: 0,
    elapsedSeconds: 0,
    startingHitPoints: session.combat.player.hitPoints,
    endingHitPoints: session.combat.player.hitPoints,
    minimumHitPoints: session.combat.player.hitPoints,
    forwardDistance: 0,
    maximumPosition: session.combat.player.position,
    primaryShots: 0,
    secondaryShots: 0,
    enemyProjectilesFired: 0,
    enemyProjectilesHit: 0,
    enemyProjectilesAvoided: 0,
  };
}

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

function finalizeEncounter(metrics: EncounterMetrics): EncounterMetrics {
  return {
    ...metrics,
    elapsedSeconds: roundMetric(metrics.elapsedTicks * SIMULATION_STEP_SECONDS),
    forwardDistance: roundMetric(metrics.forwardDistance),
    maximumPosition: roundMetric(metrics.maximumPosition),
    enemyProjectilesAvoided:
      metrics.enemyProjectilesFired - metrics.enemyProjectilesHit,
  };
}

function simulateMvpRun(seed: number): {
  session: GameSessionState;
  metrics: RunMetrics;
} {
  let session = createGameSession(seed);
  const encounters: EncounterMetrics[] = [];
  const rewardsSelected: RewardSelectionMetric[] = [];
  let currentEncounter = createEncounterMetrics(session);
  const maximumSteps = 60 * 60 * 20;

  for (let step = 0; step < maximumSteps; step += 1) {
    if (session.phase === 'combat') {
      const previousSession = session;
      session = stepGameSession(
        session,
        combatCommand(session),
        SIMULATION_STEP_SECONDS,
      );
      currentEncounter.elapsedTicks += 1;
      currentEncounter.minimumHitPoints = Math.min(
        currentEncounter.minimumHitPoints,
        session.combat.player.hitPoints,
      );
      currentEncounter.endingHitPoints = session.combat.player.hitPoints;
      currentEncounter.forwardDistance += Math.max(
        0,
        session.combat.player.position - previousSession.combat.player.position,
      );
      currentEncounter.maximumPosition = Math.max(
        currentEncounter.maximumPosition,
        session.combat.player.position,
      );
      for (const event of session.combat.events) {
        if (event.type === 'weapon-fired') {
          if (event.weaponId === previousSession.run.build.primaryWeaponId) {
            currentEncounter.primaryShots += 1;
          } else if (
            event.weaponId === previousSession.run.build.secondaryWeaponId
          ) {
            currentEncounter.secondaryShots += 1;
          }
        } else if (event.type === 'enemy-projectile-fired') {
          currentEncounter.enemyProjectilesFired += 1;
        } else if (event.type === 'enemy-projectile-hit') {
          currentEncounter.enemyProjectilesHit += 1;
        }
      }
      if (session.phase !== 'combat') {
        encounters.push(finalizeEncounter(currentEncounter));
      }
      continue;
    }
    if (session.phase === 'reward') {
      const reward = chooseReward(session);
      const weaponSlot = encounters.length % 2 === 0 ? 'primary' : 'secondary';
      rewardsSelected.push({
        afterEncounter: encounters.length,
        rewardId: reward.id,
        rewardType: reward.type,
        ...(reward.type === 'weapon' ? { weaponSlot } : {}),
      });
      session = selectReward(session, reward.id, weaponSlot);
      currentEncounter = createEncounterMetrics(session);
      continue;
    }
    break;
  }

  const elapsedTicks = encounters.reduce(
    (sum, encounter) => sum + encounter.elapsedTicks,
    0,
  );
  const primaryShots = encounters.reduce(
    (sum, encounter) => sum + encounter.primaryShots,
    0,
  );
  const secondaryShots = encounters.reduce(
    (sum, encounter) => sum + encounter.secondaryShots,
    0,
  );
  const totalShots = primaryShots + secondaryShots;
  const metrics: RunMetrics = {
    elapsedTicks,
    elapsedSeconds: roundMetric(elapsedTicks * SIMULATION_STEP_SECONDS),
    encountersCompleted: encounters.length,
    encounters,
    rewardsSelected,
    minimumHitPoints: Math.min(
      ...encounters.map(({ minimumHitPoints }) => minimumHitPoints),
    ),
    totalForwardDistance: roundMetric(
      encounters.reduce((sum, encounter) => sum + encounter.forwardDistance, 0),
    ),
    primaryShots,
    secondaryShots,
    primaryUsageRate: roundMetric(primaryShots / totalShots),
    secondaryUsageRate: roundMetric(secondaryShots / totalShots),
    enemyProjectilesFired: encounters.reduce(
      (sum, encounter) => sum + encounter.enemyProjectilesFired,
      0,
    ),
    enemyProjectilesHit: encounters.reduce(
      (sum, encounter) => sum + encounter.enemyProjectilesHit,
      0,
    ),
    enemyProjectilesAvoided: encounters.reduce(
      (sum, encounter) => sum + encounter.enemyProjectilesAvoided,
      0,
    ),
    finalBuild: structuredClone(session.run.build),
  };

  return { session, metrics };
}

describe('fixed-seed MVP run', () => {
  for (const seed of [1, 42, 2026]) {
    it(`completes all ten encounters for seed ${seed}`, () => {
      const { session, metrics } = simulateMvpRun(seed);
      const replay = simulateMvpRun(seed);
      const reportBalance = (
        globalThis as typeof globalThis & {
          process?: { env?: Record<string, string | undefined> };
        }
      ).process?.env?.REPORT_BALANCE;
      if (reportBalance === '1') {
        console.info(JSON.stringify({ seed, ...metrics }));
      }

      expect(
        session.phase,
        JSON.stringify({
          encounter: session.run.encounterIndex + 1,
          build: session.run.build,
          metrics,
        }),
      ).toBe('victory');
      expect(metrics.encountersCompleted).toBe(10);
      expect(metrics.rewardsSelected).toHaveLength(9);
      expect(metrics.encounters).toHaveLength(10);
      expect(metrics.minimumHitPoints).toBeGreaterThan(0);
      expect(metrics.elapsedSeconds).toBeGreaterThanOrEqual(60);
      expect(metrics.elapsedSeconds).toBeLessThanOrEqual(20 * 60);
      expect(metrics.primaryShots).toBeGreaterThan(0);
      expect(metrics.secondaryShots).toBeGreaterThan(0);
      expect(metrics.primaryUsageRate + metrics.secondaryUsageRate).toBeCloseTo(
        1,
        3,
      );
      expect(metrics.enemyProjectilesFired).toBe(
        metrics.enemyProjectilesHit + metrics.enemyProjectilesAvoided,
      );
      for (const encounter of metrics.encounters) {
        expect(encounter.enemyProjectilesFired).toBe(
          encounter.enemyProjectilesHit + encounter.enemyProjectilesAvoided,
        );
      }
      expect(metrics.finalBuild).toEqual(session.run.build);
      expect(toRunBaseline(metrics)).toEqual(EXPECTED_RUN_BASELINES[seed]);
      expect(replay.metrics).toEqual(metrics);
      expect(replay.session.run).toEqual(session.run);
    });
  }
});
