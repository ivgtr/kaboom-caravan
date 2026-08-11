import { MODULE_SLOT_COUNT } from '../build/build';
import { derivePlayerStats } from '../build/derivedStats';
import type { ModuleId, WeaponId } from '../data/ids';
import { MVP_ENCOUNTERS } from '../data/runDefinitions';
import {
  generateRewardChoices,
  type RewardRarity,
  type RewardChoice,
} from '../reward/rewardSystem';
import { createWaveSimulation } from '../simulation/createSimulation';
import { stepSimulation } from '../simulation/stepSimulation';
import type {
  BuildState,
  PlayerCommand,
  SimulationState,
} from '../simulation/types';
import {
  isWeaponEquipped,
  rememberEquippedWeapon,
  upgradeWeapon,
} from '../build/weaponUpgrade';
import {
  LOADOUT_DEFINITIONS,
  type LoadoutId,
} from '../data/loadoutDefinitions';
import {
  createRouteChoices,
  type RouteChoice,
  type RouteType,
} from '../data/routeDefinitions';

export type SessionPhase =
  'garage' | 'combat' | 'reward' | 'route' | 'victory' | 'defeat';
export type WeaponSlot = 'primary' | 'secondary';

export interface RunState {
  seed: number;
  encounterIndex: number;
  build: BuildState;
  vehicleHitPoints: number;
  elapsedCombatTicks: number;
  lastEncounterTicks: number;
  treasureCollected: number;
  lastEncounterTreasure: number;
  rewardRerolls: number;
  rewardRerollIndex: number;
  loadoutId: LoadoutId;
  currentRoute: RouteType;
  enemiesDefeated: number;
  parries: number;
  damageDealt: number;
}

export interface GameSessionState {
  phase: SessionPhase;
  run: RunState;
  combat: SimulationState;
  rewardChoices: RewardChoice[];
  routeChoices: RouteChoice[];
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
  combat.eliteEncounter = run.currentRoute === 'elite';
  return combat;
}

function createRun(seed: number, loadoutId: LoadoutId): RunState {
  const loadout = LOADOUT_DEFINITIONS[loadoutId];
  return {
    seed,
    encounterIndex: 0,
    build: {
      primaryWeaponId: loadout.primaryWeaponId,
      secondaryWeaponId: loadout.secondaryWeaponId,
      weaponLevels: {
        [loadout.primaryWeaponId]: 1,
        [loadout.secondaryWeaponId]: 1,
      },
      moduleIds: [],
    },
    vehicleHitPoints: 100,
    elapsedCombatTicks: 0,
    lastEncounterTicks: 0,
    treasureCollected: 0,
    lastEncounterTreasure: 0,
    rewardRerolls: 0,
    rewardRerollIndex: 0,
    loadoutId,
    currentRoute: 'normal',
    enemiesDefeated: 0,
    parries: 0,
    damageDealt: 0,
  };
}

export function createGameSession(
  seed = 1,
  loadoutId: LoadoutId = 'standard',
): GameSessionState {
  const run = createRun(seed, loadoutId);
  return {
    phase: 'combat',
    run,
    combat: createCombat(run, false),
    rewardChoices: [],
    routeChoices: [],
  };
}

export function createGarageSession(seed = 1): GameSessionState {
  const session = createGameSession(seed);
  return { ...session, phase: 'garage' };
}

export function startGameSession(
  session: GameSessionState,
  loadoutId: LoadoutId,
): GameSessionState {
  return createGameSession(session.run.seed, loadoutId);
}

/*
 * Route decisions appear three times, immediately before Battles 4, 7 and 10.
 * This adds run authorship without turning every reward into another modal.
 */
const ROUTE_SELECTION_ENCOUNTERS = new Set([3, 6, 9]);

export function stepGameSession(
  session: GameSessionState,
  command: PlayerCommand,
  deltaSeconds: number,
): GameSessionState {
  if (session.phase !== 'combat') return session;
  const combat = stepSimulation(session.combat, command, deltaSeconds);
  const progressedRun: RunState = {
    ...session.run,
    enemiesDefeated:
      session.run.enemiesDefeated +
      combat.events.filter(({ type }) => type === 'enemy-killed').length,
    parries:
      session.run.parries +
      combat.events.filter(({ type }) => type === 'attack-parried').length,
    damageDealt:
      session.run.damageDealt +
      combat.events.reduce(
        (sum, event) =>
          sum +
          (event.type === 'projectile-hit'
            ? event.damage
            : event.type === 'attack-parried'
              ? event.counterDamage
              : 0),
        0,
      ),
  };
  if (combat.status === 'active') {
    return { ...session, combat, run: progressedRun };
  }
  const encounterTicks = combat.tick;
  const timedRun: RunState = {
    ...progressedRun,
    vehicleHitPoints: combat.player.hitPoints,
    elapsedCombatTicks: session.run.elapsedCombatTicks + encounterTicks,
    lastEncounterTicks: encounterTicks,
    treasureCollected: session.run.treasureCollected + combat.treasureCollected,
    lastEncounterTreasure: combat.treasureCollected,
    rewardRerolls:
      session.run.rewardRerolls +
      (combat.treasureCollected >= 5
        ? 2
        : combat.treasureCollected >= 3
          ? 1
          : 0),
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
      combat.frontline.rewardMultiplier +
        (session.run.currentRoute === 'elite' ? 0.7 : 0),
      combat.treasureCollected,
      timedRun.rewardRerollIndex,
    ),
  };
}

function applyWeapon(
  build: BuildState,
  weaponId: WeaponId,
  slot: WeaponSlot,
  rarity: RewardRarity,
): BuildState {
  const levelGain = rarity === 'epic' ? 2 : 1;
  if (isWeaponEquipped(build, weaponId)) {
    let upgraded = build;
    for (let index = 0; index < levelGain; index += 1) {
      upgraded = upgradeWeapon(upgraded, weaponId);
    }
    return upgraded;
  }
  const equipped =
    slot === 'primary'
      ? { ...build, primaryWeaponId: weaponId }
      : { ...build, secondaryWeaponId: weaponId };
  let remembered = rememberEquippedWeapon(equipped, weaponId);
  const newWeaponBonus = rarity === 'epic' ? 2 : rarity === 'rare' ? 1 : 0;
  for (let index = 0; index < newWeaponBonus; index += 1) {
    remembered = upgradeWeapon(remembered, weaponId);
  }
  return remembered;
}

function applyModule(build: BuildState, moduleId: ModuleId): BuildState {
  if (build.moduleIds.includes(moduleId)) return build;
  const moduleIds =
    build.moduleIds.length < MODULE_SLOT_COUNT
      ? [...build.moduleIds, moduleId]
      : [...build.moduleIds.slice(1), moduleId];
  return { ...build, moduleIds };
}

export function rerollRewards(session: GameSessionState): GameSessionState {
  if (session.phase !== 'reward' || session.run.rewardRerolls <= 0) {
    return session;
  }
  const rewardRerollIndex = session.run.rewardRerollIndex + 1;
  return {
    ...session,
    run: {
      ...session.run,
      rewardRerolls: session.run.rewardRerolls - 1,
      rewardRerollIndex,
    },
    rewardChoices: generateRewardChoices(
      session.run.seed,
      session.run.encounterIndex,
      session.run.build,
      session.combat.frontline.rewardMultiplier,
      session.run.lastEncounterTreasure,
      rewardRerollIndex,
    ),
  };
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
      ? applyWeapon(
          session.run.build,
          reward.weaponId,
          weaponSlot,
          reward.rarity,
        )
      : applyModule(session.run.build, reward.moduleId);
  const run: RunState = {
    ...session.run,
    encounterIndex: session.run.encounterIndex + 1,
    build,
    currentRoute: 'normal',
    vehicleHitPoints:
      session.run.vehicleHitPoints +
      (reward.rarity === 'epic' ? 10 : reward.rarity === 'rare' ? 5 : 0),
    rewardRerolls:
      session.run.rewardRerolls + (reward.rarity === 'epic' ? 1 : 0),
  };
  if (ROUTE_SELECTION_ENCOUNTERS.has(run.encounterIndex)) {
    return {
      phase: 'route',
      run,
      combat: session.combat,
      rewardChoices: [],
      routeChoices: createRouteChoices(run.encounterIndex),
    };
  }
  return {
    phase: 'combat',
    run,
    combat: createCombat(run, true),
    rewardChoices: [],
    routeChoices: [],
  };
}

export function selectRoute(
  session: GameSessionState,
  routeId: string,
): GameSessionState {
  if (session.phase !== 'route') return session;
  const route = session.routeChoices.find((choice) => choice.id === routeId);
  if (!route) throw new Error(`Route not found: ${routeId}`);
  const run: RunState = {
    ...session.run,
    currentRoute: route.type === 'elite' ? 'elite' : 'normal',
    vehicleHitPoints:
      route.type === 'repair'
        ? session.run.vehicleHitPoints + 30
        : session.run.vehicleHitPoints,
    treasureCollected:
      session.run.treasureCollected + (route.type === 'salvage' ? 2 : 0),
    rewardRerolls:
      session.run.rewardRerolls + (route.type === 'salvage' ? 1 : 0),
  };
  return {
    phase: 'combat',
    run,
    combat: createCombat(run, true),
    rewardChoices: [],
    routeChoices: [],
  };
}

export function restartGameSession(
  session: GameSessionState,
): GameSessionState {
  return createGarageSession((session.run.seed + 1) >>> 0);
}
