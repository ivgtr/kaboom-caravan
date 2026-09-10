import { derivePlayerStats } from '../build/derivedStats';
import type { WeaponId } from '../data/ids';
import { WEAPON_DEFINITIONS } from '../data/weaponDefinitions';
import { scaleActionTimeDelta } from './actionTime';
import { stepSimulation as stepBaseSimulation } from './stepSimulationBase';
import type { CombatEvent, PlayerCommand, SimulationState } from './types';

/**
 * REDLINE turns an empty magazine from a dead state into a dangerous comeback
 * state. Hold boost while firing to feed hull integrity into the weapon loader;
 * requested weapons are temporarily driven at their level-3 profile.
 */
export const REDLINE_RULES = {
  hullCostPerAmmo: 8,
  salvageAmmoPerKill: 10,
} as const;

const REDLINE_SOURCE_ID = 'redline-overdrive';

function requestedWeaponIds(
  state: SimulationState,
  command: PlayerCommand,
): WeaponId[] {
  const weaponIds: WeaponId[] = [];
  if (command.firePrimary) weaponIds.push(state.build.primaryWeaponId);
  if (command.fireSecondary) weaponIds.push(state.build.secondaryWeaponId);
  return weaponIds;
}

function requestedAmmoCost(weaponIds: readonly WeaponId[]): number {
  return weaponIds.reduce(
    (sum, weaponId) => sum + WEAPON_DEFINITIONS[weaponId].ammoCost,
    0,
  );
}

function firedAmmoCost(events: readonly CombatEvent[]): number {
  return events.reduce(
    (sum, event) =>
      event.type === 'weapon-fired'
        ? sum + WEAPON_DEFINITIONS[event.weaponId].ammoCost
        : sum,
    0,
  );
}

function createRedlineState(
  state: SimulationState,
  command: PlayerCommand,
  injectedAmmo: number,
): SimulationState {
  const weaponLevels = { ...state.build.weaponLevels };
  for (const weaponId of requestedWeaponIds(state, command)) {
    weaponLevels[weaponId] = 3;
  }
  return {
    ...state,
    build: { ...state.build, weaponLevels },
    player: { ...state.player, ammo: injectedAmmo },
  };
}

function salvageDryKills(state: SimulationState): SimulationState {
  if (state.status === 'defeat' || state.player.ammo > 0) return state;
  const kills = state.events.filter(
    ({ type }) => type === 'enemy-killed',
  ).length;
  if (kills === 0) return state;

  const maximumAmmo = derivePlayerStats(state.build).maximumAmmo;
  const salvageAmmo = Math.min(
    maximumAmmo,
    kills * REDLINE_RULES.salvageAmmoPerKill,
  );
  if (salvageAmmo <= 0) return state;

  return {
    ...state,
    player: { ...state.player, ammo: salvageAmmo },
    events: [
      ...state.events,
      {
        type: 'loot-collected',
        lootId: `redline-salvage-${state.tick}`,
        kind: 'ammo',
        value: salvageAmmo,
      },
    ],
  };
}

/**
 * Preserve the established simulation and only intervene on the deliberate
 * BOOST + FIRE override while the caravan is completely dry. A REDLINE volley
 * may spend every hull-ammo unit except the final hit point; enemy damage can
 * still finish the player on the same tick.
 *
 * Live input commands also carry ACTION TIME's world-time scale. Direct test
 * and tooling commands omit it and therefore retain the simulation's original
 * 1x behavior.
 */
export function stepSimulation(
  state: SimulationState,
  command: PlayerCommand,
  deltaSeconds: number,
): SimulationState {
  const worldDeltaSeconds = scaleActionTimeDelta(command, deltaSeconds);

  if (state.status !== 'active' || state.player.ammo > 0 || !command.boost) {
    return salvageDryKills(
      stepBaseSimulation(state, command, worldDeltaSeconds),
    );
  }

  const weaponIds = requestedWeaponIds(state, command);
  const requestedAmmo = requestedAmmoCost(weaponIds);
  const hullAmmoBudget = Math.max(
    0,
    Math.floor((state.player.hitPoints - 1) / REDLINE_RULES.hullCostPerAmmo),
  );
  const injectedAmmo = Math.min(requestedAmmo, hullAmmoBudget);

  if (injectedAmmo <= 0) {
    return salvageDryKills(
      stepBaseSimulation(state, command, worldDeltaSeconds),
    );
  }

  const redlineState = createRedlineState(state, command, injectedAmmo);
  const stepped = stepBaseSimulation(
    redlineState,
    command,
    worldDeltaSeconds,
  );
  const hullAmmoSpent = Math.min(injectedAmmo, firedAmmoCost(stepped.events));
  const hullDamage = hullAmmoSpent * REDLINE_RULES.hullCostPerAmmo;

  // Strip the temporary level-3 build and temporary ammunition back out while
  // retaining legitimate ammo gains from pickups/build triggers during the tick.
  const realAmmo = Math.max(
    0,
    stepped.player.ammo - injectedAmmo + hullAmmoSpent,
  );
  const hitPoints = Math.max(0, stepped.player.hitPoints - hullDamage);
  const forcedDefeat = stepped.status !== 'defeat' && hitPoints <= 0;
  let events = stepped.events;

  if (hullDamage > 0) {
    events = [
      ...events,
      {
        type: 'vehicle-hit',
        sourceId: REDLINE_SOURCE_ID,
        damage: hullDamage,
      },
    ];
  }
  if (forcedDefeat) {
    events = events.filter(({ type }) => type !== 'combat-ended');
    events.push({ type: 'combat-ended', result: 'defeat' });
  }

  return salvageDryKills({
    ...stepped,
    build: state.build,
    status: forcedDefeat ? 'defeat' : stepped.status,
    player: {
      ...stepped.player,
      hitPoints,
      ammo: realAmmo,
    },
    events,
  });
}
