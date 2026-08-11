import { describe, expect, it } from 'vitest';
import {
  SIMULATION_STEP_SECONDS,
  type PlayerCommand,
} from '../simulation/types';
import type { BuildState } from '../simulation/types';
import { MVP_ENCOUNTERS } from '../data/runDefinitions';
import { WEAPON_DEFINITIONS } from '../data/weaponDefinitions';
import {
  createGameSession,
  selectRoute,
  selectReward,
  selectWeaponCacheReward,
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
  attacksParried: number;
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
  attacksParried: number;
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
  attacksParried: number;
  rewardIds: string[];
  finalBuild: BuildState;
}

const EXPECTED_RUN_BASELINES: Readonly<Record<number, ExpectedRunBaseline>> = {
  1: {
    elapsedTicks: 8797,
    encounterTicks: [572, 622, 765, 2335, 610, 588, 471, 797, 1252, 785],
    endingHitPoints: [100, 100, 100, 100, 100, 100, 115, 125, 125, 125],
    forwardDistances: [
      70, 70, 61.278, 70.088, 70, 68.378, 60.42, 68.263, 64.338, 62.6,
    ],
    primaryShots: 217,
    secondaryShots: 33,
    enemyProjectiles: [12, 0, 12],
    attacksParried: 17,
    rewardIds: [
      'module:magnetic-armor',
      'weapon:rocket-launcher',
      'weapon:scatter-cannon',
      'module:armor',
      'module:heat-recycler',
      'module:shield-generator',
      'module:capacitor',
      'module:generator',
      'module:magnetic-armor',
    ],
    finalBuild: {
      primaryWeaponId: 'machine-cannon',
      secondaryWeaponId: 'rocket-launcher',
      weaponLevels: {
        'machine-cannon': 1,
        'scatter-cannon': 1,
        'rocket-launcher': 2,
        flamethrower: 1,
        railgun: 1,
      },
      moduleIds: [
        'shield-generator',
        'capacitor',
        'generator',
        'magnetic-armor',
      ],
    },
  },
  42: {
    elapsedTicks: 6584,
    encounterTicks: [572, 631, 1490, 526, 618, 521, 458, 540, 569, 659],
    endingHitPoints: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    forwardDistances: [
      70, 70, 78.408, 66.2, 69.153, 68.08, 64.343, 69.8, 64.498, 62.6,
    ],
    primaryShots: 164,
    secondaryShots: 35,
    enemyProjectiles: [10, 0, 10],
    attacksParried: 10,
    rewardIds: [
      'module:explosive-magazine',
      'module:magnetic-armor',
      'weapon:rocket-launcher',
      'module:generator',
      'module:heat-recycler',
      'module:cooling-fan',
      'weapon:rocket-launcher',
      'module:radar',
      'module:armor',
    ],
    finalBuild: {
      primaryWeaponId: 'machine-cannon',
      secondaryWeaponId: 'rocket-launcher',
      weaponLevels: {
        'machine-cannon': 1,
        'scatter-cannon': 1,
        'rocket-launcher': 3,
        railgun: 2,
        flamethrower: 1,
      },
      moduleIds: ['heat-recycler', 'cooling-fan', 'radar', 'armor'],
    },
  },
  2026: {
    elapsedTicks: 6578,
    encounterTicks: [572, 639, 495, 495, 491, 581, 471, 748, 1277, 809],
    endingHitPoints: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    forwardDistances: [
      70, 70, 70, 66.2, 69.193, 66.54, 60.42, 68.263, 64.338, 62.6,
    ],
    primaryShots: 160,
    secondaryShots: 32,
    enemyProjectiles: [9, 0, 9],
    attacksParried: 9,
    rewardIds: [
      'module:ammo-box',
      'weapon:rocket-launcher',
      'module:explosive-magazine',
      'weapon:railgun',
      'module:capacitor',
      'module:heat-recycler',
      'module:radar',
      'module:magnetic-armor',
      'weapon:railgun',
    ],
    finalBuild: {
      primaryWeaponId: 'machine-cannon',
      secondaryWeaponId: 'railgun',
      weaponLevels: {
        'machine-cannon': 1,
        'scatter-cannon': 1,
        'rocket-launcher': 3,
        railgun: 2,
        flamethrower: 2,
      },
      moduleIds: ['capacitor', 'heat-recycler', 'radar', 'magnetic-armor'],
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
    attacksParried: metrics.attacksParried,
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
  const primary = WEAPON_DEFINITIONS[session.run.build.primaryWeaponId];
  const secondary = WEAPON_DEFINITIONS[session.run.build.secondaryWeaponId];
  const parryThreat = session.combat.enemyProjectiles.some((projectile) => {
    const distance = projectile.position - session.combat.player.position;
    return distance > 0 && distance / Math.abs(projectile.velocity) <= 0.32;
  });
  const contactThreat = session.combat.enemies.some(
    (enemy) =>
      enemy.attackWindupRemaining !== undefined &&
      enemy.attackWindupRemaining <= 0.25 &&
      enemy.position - session.combat.player.position <=
        enemy.radius + session.combat.player.radius + 0.5,
  );
  const targetDistance = Math.max(
    10,
    Math.min(primary.optimalRangeMaximum, secondary.optimalRangeMaximum) - 2,
  );
  const canFire = (weapon: typeof primary) =>
    hasTarget &&
    distance <= weapon.maximumRange &&
    session.combat.player.ammo >= weapon.ammoCost &&
    session.combat.player.energy >= weapon.energyCost &&
    session.combat.player.heat + weapon.heatGenerated < 100;
  return {
    move:
      parryThreat || contactThreat
        ? 0
        : !hasTarget
          ? 0
          : distance > targetDistance + 5
            ? 1
            : distance < targetDistance - 5
              ? -1
              : 0,
    firePrimary: canFire(primary),
    fireSecondary: canFire(secondary),
    activateSkill:
      (parryThreat || contactThreat) && session.combat.player.energy >= 20,
  };
}

function chooseReward(session: GameSessionState) {
  const weaponRank = {
    'scatter-cannon': 0,
    'rocket-launcher': 1,
    railgun: 2,
  } as const;
  const currentRank =
    weaponRank[
      session.run.build.secondaryWeaponId as keyof typeof weaponRank
    ] ?? -1;
  const preferredWeapon = session.rewardChoices.find(
    (choice) =>
      choice.type === 'weapon' &&
      choice.weaponId in weaponRank &&
      weaponRank[choice.weaponId as keyof typeof weaponRank] > currentRank,
  );
  return (
    preferredWeapon ??
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
    attacksParried: 0,
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
        } else if (event.type === 'attack-parried') {
          currentEncounter.attacksParried += 1;
        }
      }
      if (session.phase !== 'combat' && session.phase !== 'weapon-cache') {
        encounters.push(finalizeEncounter(currentEncounter));
      }
      continue;
    }
    if (session.phase === 'weapon-cache') {
      const weapon = chooseReward(session);
      session = selectWeaponCacheReward(session, weapon.id, 'secondary');
      continue;
    }
    if (session.phase === 'reward') {
      const reward = chooseReward(session);
      const weaponSlot = 'secondary' as const;
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
    if (session.phase === 'route') {
      const normalRoute = session.routeChoices.find(
        ({ type }) => type === 'normal',
      );
      session = selectRoute(session, normalRoute!.id);
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
    attacksParried: encounters.reduce(
      (sum, encounter) => sum + encounter.attacksParried,
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
      expect(session.run.elapsedCombatTicks).toBe(metrics.elapsedTicks);
      expect(session.run.lastEncounterTicks).toBe(
        metrics.encounters.at(-1)?.elapsedTicks,
      );
      expect(toRunBaseline(metrics)).toEqual(EXPECTED_RUN_BASELINES[seed]);
      expect(replay.metrics).toEqual(metrics);
      expect(replay.session.run).toEqual(session.run);
    });
  }
});
