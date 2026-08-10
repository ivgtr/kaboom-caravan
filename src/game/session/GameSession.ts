import { MODULE_SLOT_COUNT } from '../build/build';
import { derivePlayerStats } from '../build/derivedStats';
import type { ModuleId, WeaponId } from '../data/ids';
import { MVP_ENCOUNTERS } from '../data/runDefinitions';
import {
  generateRewardChoices,
  type RewardChoice,
} from '../reward/rewardSystem';
import { createWaveSimulation } from '../simulation/createSimulation';
import { stepSimulation } from '../simulation/stepSimulation';
import type {
  BuildState,
  PlayerCommand,
  SimulationState,
} from '../simulation/types';

export type SessionPhase = 'combat' | 'reward' | 'victory' | 'defeat';
export type WeaponSlot = 'primary' | 'secondary';

export interface RunState {
  seed: number;
  encounterIndex: number;
  build: BuildState;
  vehicleHitPoints: number;
  elapsedCombatTicks: number;
  lastEncounterTicks: number;
}

export interface GameSessionState {
  phase: SessionPhase;
  run: RunState;
  combat: SimulationState;
  rewardChoices: RewardChoice[];
}

function combatSeed(seed: number, encounterIndex: number): number {
  return (seed + Math.imul(encounterIndex + 1, 0x85ebca6b)) >>> 0;
}

function createCombat(
  run: RunState,
  restoreHitPoints: boolean,
): SimulationState {
  const encounter = MVP_ENCOUNTERS[run.encounterIndex]!;
  const combat = createWaveSimulation(
    combatSeed(run.seed, run.encounterIndex),
    encounter.waveId,
  );
  combat.build = structuredClone(run.build);
  const stats = derivePlayerStats(combat.build);
  combat.player.maxHitPoints = stats.maximumHitPoints;
  combat.player.armor = stats.armor;
  combat.player.hitPoints = restoreHitPoints
    ? Math.min(stats.maximumHitPoints, run.vehicleHitPoints + 15)
    : stats.maximumHitPoints;
  combat.player.ammo = stats.maximumAmmo;
  combat.player.energy = stats.maximumEnergy;
  return combat;
}

export function createGameSession(seed = 1): GameSessionState {
  const run: RunState = {
    seed,
    encounterIndex: 0,
    build: {
      primaryWeaponId: 'machine-cannon',
      secondaryWeaponId: 'scatter-cannon',
      moduleIds: [],
    },
    vehicleHitPoints: 100,
    elapsedCombatTicks: 0,
    lastEncounterTicks: 0,
  };
  return {
    phase: 'combat',
    run,
    combat: createCombat(run, false),
    rewardChoices: [],
  };
}

export function stepGameSession(
  session: GameSessionState,
  command: PlayerCommand,
  deltaSeconds: number,
): GameSessionState {
  if (session.phase !== 'combat') return session;
  const combat = stepSimulation(session.combat, command, deltaSeconds);
  if (combat.status === 'active') return { ...session, combat };
  const encounterTicks = combat.tick;
  const timedRun: RunState = {
    ...session.run,
    vehicleHitPoints: combat.player.hitPoints,
    elapsedCombatTicks: session.run.elapsedCombatTicks + encounterTicks,
    lastEncounterTicks: encounterTicks,
  };
  if (combat.status === 'defeat') {
    return { ...session, phase: 'defeat', combat, run: timedRun };
  }

  const isFinalEncounter =
    session.run.encounterIndex >= MVP_ENCOUNTERS.length - 1;
  if (isFinalEncounter) {
    return {
      ...session,
      phase: 'victory',
      combat,
      run: timedRun,
    };
  }

  return {
    ...session,
    phase: 'reward',
    combat,
    run: timedRun,
    rewardChoices: generateRewardChoices(
      session.run.seed,
      session.run.encounterIndex,
      session.run.build,
      combat.frontline.rewardMultiplier,
    ),
  };
}

function applyWeapon(
  build: BuildState,
  weaponId: WeaponId,
  slot: WeaponSlot,
): BuildState {
  return slot === 'primary'
    ? { ...build, primaryWeaponId: weaponId }
    : { ...build, secondaryWeaponId: weaponId };
}

function applyModule(build: BuildState, moduleId: ModuleId): BuildState {
  if (build.moduleIds.includes(moduleId)) return build;
  const moduleIds =
    build.moduleIds.length < MODULE_SLOT_COUNT
      ? [...build.moduleIds, moduleId]
      : [...build.moduleIds.slice(1), moduleId];
  return { ...build, moduleIds };
}

export function selectReward(
  session: GameSessionState,
  rewardId: string,
  weaponSlot: WeaponSlot = 'secondary',
): GameSessionState {
  if (session.phase !== 'reward') return session;
  const reward = session.rewardChoices.find((choice) => choice.id === rewardId);
  if (!reward) throw new Error(`Reward not found: ${rewardId}`);
  const build =
    reward.type === 'weapon'
      ? applyWeapon(session.run.build, reward.weaponId, weaponSlot)
      : applyModule(session.run.build, reward.moduleId);
  const run: RunState = {
    ...session.run,
    encounterIndex: session.run.encounterIndex + 1,
    build,
  };
  return {
    phase: 'combat',
    run,
    combat: createCombat(run, true),
    rewardChoices: [],
  };
}

export function restartGameSession(
  session: GameSessionState,
): GameSessionState {
  return createGameSession((session.run.seed + 1) >>> 0);
}
