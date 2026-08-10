import { describe, expect, it } from 'vitest';
import {
  SIMULATION_STEP_SECONDS,
  type PlayerCommand,
} from '../simulation/types';
import {
  createGameSession,
  selectReward,
  stepGameSession,
  type GameSessionState,
} from './GameSession';

interface RunMetrics {
  elapsedSeconds: number;
  encountersCompleted: number;
  rewardsSelected: string[];
  minimumHitPoints: number;
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

function simulateMvpRun(seed: number): {
  session: GameSessionState;
  metrics: RunMetrics;
} {
  let session = createGameSession(seed);
  const metrics: RunMetrics = {
    elapsedSeconds: 0,
    encountersCompleted: 0,
    rewardsSelected: [],
    minimumHitPoints: session.combat.player.hitPoints,
  };
  const maximumSteps = 60 * 60 * 20;

  for (let step = 0; step < maximumSteps; step += 1) {
    if (session.phase === 'combat') {
      session = stepGameSession(
        session,
        combatCommand(session),
        SIMULATION_STEP_SECONDS,
      );
      metrics.elapsedSeconds += SIMULATION_STEP_SECONDS;
      metrics.minimumHitPoints = Math.min(
        metrics.minimumHitPoints,
        session.combat.player.hitPoints,
      );
      continue;
    }
    if (session.phase === 'reward') {
      metrics.encountersCompleted += 1;
      const reward = chooseReward(session);
      metrics.rewardsSelected.push(reward.id);
      session = selectReward(
        session,
        reward.id,
        metrics.encountersCompleted % 2 === 0 ? 'primary' : 'secondary',
      );
      continue;
    }
    if (session.phase === 'victory') metrics.encountersCompleted += 1;
    break;
  }

  return { session, metrics };
}

describe('fixed-seed MVP run', () => {
  for (const seed of [1, 42, 2026]) {
    it(`completes all ten encounters for seed ${seed}`, () => {
      const { session, metrics } = simulateMvpRun(seed);
      const replay = simulateMvpRun(seed);
      if (import.meta.env.VITE_REPORT_BALANCE) {
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
      expect(metrics.minimumHitPoints).toBeGreaterThan(0);
      expect(metrics.elapsedSeconds).toBeGreaterThanOrEqual(60);
      expect(metrics.elapsedSeconds).toBeLessThanOrEqual(20 * 60);
      expect(replay.metrics).toEqual(metrics);
      expect(replay.session.run).toEqual(session.run);
    });
  }
});
