import { derivePlayerStats } from '../build/derivedStats';
import type { WeaponId } from '../data/ids';
import { WEAPON_DEFINITIONS } from '../data/weaponDefinitions';
import { resolveDamage } from './damage';
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

/**
 * RAM makes forward boost a second offensive verb instead of pure mobility.
 * Fragile enemies can be driven through at speed; anything that survives the
 * impact throws the caravan backwards and charges the hull for the mistake.
 */
export const RAM_RULES = {
  minimumVelocity: 8,
  contactSlack: 0.75,
  baseDamage: 28,
  velocityDamageMultiplier: 2,
  reboundPushDistance: 8,
  reboundVelocityMultiplier: 0.55,
  minimumReboundVelocity: 6,
  stunSeconds: 0.65,
  crashContactDamageMultiplier: 0.75,
  crashRadiusDamageMultiplier: 2,
  minimumCrashDamage: 10,
} as const;

const REDLINE_SOURCE_ID = 'redline-overdrive';
const RAM_CRASH_SOURCE_PREFIX = 'ram-crash';

interface RamPreparation {
  state: SimulationState;
  crashDamage: number;
  targetId?: string;
}

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

function setCombatStatus(
  state: SimulationState,
  status: 'victory' | 'defeat',
): SimulationState {
  const events = state.events.filter(({ type }) => type !== 'combat-ended');
  events.push({ type: 'combat-ended', result: status });
  return { ...state, status, events };
}

/**
 * BREAKOUT replaces wave-clear victory on Battles 1-9. A cleared battlefield
 * is only breathing room: the caravan still has to physically drive through
 * the marked blockade. Reaching the zone ends the encounter even with enemies
 * alive; letting the deadline expire ends the run even with hull remaining.
 */
function enforceBreakoutResolution(state: SimulationState): SimulationState {
  const objective = state.objective;
  if (!objective || objective.kind !== 'breakout') return state;

  if (objective.status === 'secured') {
    return setCombatStatus(state, 'victory');
  }
  if (objective.status === 'lost') {
    return setCombatStatus(state, 'defeat');
  }

  // Real destruction/frontline collapse still defeats the player. Only suppress
  // the old "all enemies are gone" victory while the breakout gate is active.
  if (state.status === 'victory') {
    return {
      ...state,
      status: 'active',
      events: state.events.filter(
        (event) => event.type !== 'combat-ended' || event.result !== 'victory',
      ),
    };
  }
  return state;
}

function crashDamageForTarget(
  target: SimulationState['enemies'][number],
): number {
  return Math.max(
    RAM_RULES.minimumCrashDamage,
    Math.round(
      target.contactDamage * RAM_RULES.crashContactDamageMultiplier +
        target.radius * RAM_RULES.crashRadiusDamageMultiplier,
    ),
  );
}

function prepareRamImpact(
  state: SimulationState,
  command: PlayerCommand,
): RamPreparation {
  const wantsForwardRam =
    state.status === 'active' &&
    command.boost &&
    command.move === 1 &&
    !command.activateSkill &&
    state.player.energy > 0 &&
    state.player.velocity >= RAM_RULES.minimumVelocity;
  if (!wantsForwardRam) return { state, crashDamage: 0 };

  const target = [...state.enemies]
    .filter(
      (enemy) =>
        enemy.hitPoints > 0 &&
        enemy.position >= state.player.position &&
        enemy.position - state.player.position <=
          state.player.radius + enemy.radius + RAM_RULES.contactSlack,
    )
    .sort((left, right) => left.position - right.position)[0];
  if (!target) return { state, crashDamage: 0 };

  const impactDamage = resolveDamage(
    RAM_RULES.baseDamage +
      state.player.velocity * RAM_RULES.velocityDamageMultiplier,
    target.armor,
  );
  const lethal = target.hitPoints <= impactDamage;
  const impactedTarget = lethal
    ? { ...target, hitPoints: target.hitPoints - impactDamage }
    : {
        ...target,
        previousPosition: target.position,
        position: target.position + RAM_RULES.reboundPushDistance,
        hitPoints: target.hitPoints - impactDamage,
        contactCooldown: Math.max(
          target.contactCooldown,
          RAM_RULES.stunSeconds,
        ),
        attackWindupRemaining: undefined,
        breakRemainingSeconds: Math.max(
          target.breakRemainingSeconds ?? 0,
          RAM_RULES.stunSeconds,
        ),
      };

  return {
    state: {
      ...state,
      player: lethal
        ? state.player
        : {
            ...state.player,
            velocity: -Math.max(
              RAM_RULES.minimumReboundVelocity,
              state.player.velocity * RAM_RULES.reboundVelocityMultiplier,
            ),
          },
      enemies: state.enemies.map((enemy) =>
        enemy.id === target.id ? impactedTarget : enemy,
      ),
    },
    crashDamage: lethal ? 0 : crashDamageForTarget(target),
    targetId: target.id,
  };
}

function applyHullDamage(
  state: SimulationState,
  damage: number,
  sourceId: string,
): SimulationState {
  if (damage <= 0) return state;
  const hitPoints = Math.max(0, state.player.hitPoints - damage);
  const forcedDefeat = state.status !== 'defeat' && hitPoints <= 0;
  let events: CombatEvent[] = [
    ...state.events,
    { type: 'vehicle-hit', sourceId, damage },
  ];

  if (forcedDefeat) {
    events = events.filter(({ type }) => type !== 'combat-ended');
    events.push({ type: 'combat-ended', result: 'defeat' });
  }

  return {
    ...state,
    status: forcedDefeat ? 'defeat' : state.status,
    player: { ...state.player, hitPoints },
    events,
  };
}

/**
 * Preserve the established simulation and only intervene on the deliberate
 * BOOST + FIRE override while the caravan is completely dry. A REDLINE volley
 * may spend every hull-ammo unit except the final hit point; enemy damage can
 * still finish the player on the same tick.
 */
function stepRedlineSimulation(
  state: SimulationState,
  command: PlayerCommand,
  deltaSeconds: number,
): SimulationState {
  if (state.status !== 'active' || state.player.ammo > 0 || !command.boost) {
    return salvageDryKills(stepBaseSimulation(state, command, deltaSeconds));
  }

  const weaponIds = requestedWeaponIds(state, command);
  const requestedAmmo = requestedAmmoCost(weaponIds);
  const hullAmmoBudget = Math.max(
    0,
    Math.floor((state.player.hitPoints - 1) / REDLINE_RULES.hullCostPerAmmo),
  );
  const injectedAmmo = Math.min(requestedAmmo, hullAmmoBudget);

  if (injectedAmmo <= 0) {
    return salvageDryKills(stepBaseSimulation(state, command, deltaSeconds));
  }

  const redlineState = createRedlineState(state, command, injectedAmmo);
  const stepped = stepBaseSimulation(redlineState, command, deltaSeconds);
  const hullAmmoSpent = Math.min(injectedAmmo, firedAmmoCost(stepped.events));
  const hullDamage = hullAmmoSpent * REDLINE_RULES.hullCostPerAmmo;

  // Strip the temporary level-3 build and temporary ammunition back out while
  // retaining legitimate ammo gains from pickups/build triggers during the tick.
  const realAmmo = Math.max(
    0,
    stepped.player.ammo - injectedAmmo + hullAmmoSpent,
  );
  const restored = {
    ...stepped,
    build: state.build,
    player: {
      ...stepped.player,
      ammo: realAmmo,
    },
  };
  return salvageDryKills(
    applyHullDamage(restored, hullDamage, REDLINE_SOURCE_ID),
  );
}

export function stepSimulation(
  state: SimulationState,
  command: PlayerCommand,
  deltaSeconds: number,
): SimulationState {
  // Session/unit-test fixtures sometimes enter this function already resolved.
  // Preserve that explicit terminal state; BREAKOUT only replaces a victory
  // produced from an ACTIVE encounter by the old full-clear rule.
  if (state.status !== 'active') {
    return stepRedlineSimulation(state, command, deltaSeconds);
  }

  const ram = prepareRamImpact(state, command);
  const stepped = stepRedlineSimulation(ram.state, command, deltaSeconds);
  const resolved = enforceBreakoutResolution(stepped);

  // Resolve BREAKOUT before charging a failed RAM. If the collision destroys
  // the caravan on the same tick it still overrides an otherwise successful exit.
  if (ram.crashDamage <= 0 || !ram.targetId) return resolved;
  return applyHullDamage(
    resolved,
    ram.crashDamage,
    `${RAM_CRASH_SOURCE_PREFIX}-${ram.targetId}`,
  );
}
