import { describe, expect, it } from 'vitest';
import { CORE_RULES, type CombatCoreId } from '../data/combatCoreDefinitions';
import { WEAPON_DEFINITIONS } from '../data/weaponDefinitions';
import { deriveWeaponDefinition } from '../build/derivedStats';
import { createEnemy } from '../combat/createEnemy';
import { advanceCombatCore, chargeCounterCore, createCombatCoreState, getCoreStatus, prepareCoreShot } from './combatCore';
import { createSimulation } from './createSimulation';
import { stepSimulation } from './stepSimulation';
import { IDLE_COMMAND, SIMULATION_STEP_SECONDS as dt, type PlayerCommand, type SimulationState } from './types';
const main = { ...IDLE_COMMAND, firePrimary: true };
const sub = { ...IDLE_COMMAND, fireSecondary: true };
const both = { ...main, fireSecondary: true };
function combat(id?: CombatCoreId) {
  const state = createSimulation(8);
  state.build.coreId = id;
  state.player.position = state.player.previousPosition = 40;
  state.enemies = [{ ...createEnemy('heavy', 'dummy', 110), speed: 0, hitPoints: 10000 }];
  return state;
}
function incoming(id = 'shot') { return { id, ownerId: 'dummy', previousPosition: 41, position: 41, velocity: -18, radius: 0.55, damage: 12, ageSeconds: 0, maximumAgeSeconds: 4, visualId: 'spore' as const }; }
function step(state: SimulationState, command: PlayerCommand = IDLE_COMMAND) { return stepSimulation(state, command, dt); }
function triggers(state: SimulationState) { return state.events.filter(({ type }) => type === 'core-triggered'); }

describe('relay core', () => {
  it('starts with an ordinary volley, then buffs all pellets and vents the OTHER weapon once', () => {
    const first = step(combat('relay'), main);
    expect(first.projectiles[0]!.damage).toBe(10);
    first.player.weaponHeat.primary.heat = 70;
    const second = step(first, sub);
    const pellets = second.projectiles.filter(({ weaponId }) => weaponId === 'scatter-cannon');
    expect(pellets).toHaveLength(5);
    expect(pellets.every(({ damage }) => Math.abs(damage - 6 * 1.6) < 1e-9)).toBe(true);
    expect(second.player.weaponHeat.primary.heat).toBeCloseTo(70 - 12 * dt - 18);
    expect(second.player.weaponHeat.secondary.heat).toBe(18);
    expect(second.player.ammo).toBe(46);
    expect(second.player.energy).toBeCloseTo(98 + 10 * dt - 4);
    expect(second.core.relaySlot).toBe('secondary');
    expect(triggers(second)).toHaveLength(1);
    expect(first.core.relaySlot).toBe('primary');
  });
  it('can recover an overheated previous weapon without venting below zero', () => {
    const initial = combat('relay');
    initial.core = { ...initial.core, relaySlot: 'primary', relaySeconds: 1 };
    initial.player.weaponHeat.primary = { heat: 75, overheated: true };
    const result = step(initial, sub);
    expect(result.player.weaponHeat.primary.overheated).toBe(false);
    expect(result.events).toContainEqual({ type: 'cooled', slot: 'primary', weaponId: 'machine-cannon' });
    initial.player.weaponHeat.primary = { heat: 2, overheated: false };
    expect(step(initial, sub).player.weaponHeat.primary.heat).toBe(0);
  });
  it('refreshes the window on same-slot fire but never grants its bonus', () => {
    const initial = step(combat('relay'), main);
    initial.player.primaryCooldown = 0;
    const result = step(initial, main);
    expect(triggers(result)).toHaveLength(0);
    expect(result.core.relaySeconds).toBe(CORE_RULES.relay.windowSeconds);
  });
  it.each(['ready', 'cooldown', 'overheated', 'empty'] as const)('both held cancels the chain even when secondary is %s', (reason) => {
    const state = step(combat('relay'), main);
    state.player.primaryCooldown = 0;
    if (reason === 'cooldown') state.player.secondaryCooldown = 1;
    if (reason === 'overheated') state.player.weaponHeat.secondary = { heat: 90, overheated: true };
    if (reason === 'empty') state.player.ammo = 1;
    const result = step(state, both);
    expect(result.core.relaySlot).toBeNull();
    expect(result.core.relaySeconds).toBe(0);
    expect(triggers(result)).toHaveLength(0);
  });
  it('expires after exactly 150 fixed steps and needs a new opening shot', () => {
    let state = step(combat('relay'), main);
    for (let i = 0; i < 150; i++) state = step(state);
    expect(state.core.relaySeconds).toBe(0);
    expect(state.core.relaySlot).toBeNull();
    expect(triggers(step(state, sub))).toHaveLength(0);
  });
  it('does not update a chain from failed exclusive fire', () => {
    const state = step(combat('relay'), main);
    state.player.secondaryCooldown = 1;
    const result = step(state, sub);
    expect(result.core.relaySlot).toBe('primary');
    expect(result.core.relaySeconds).toBeCloseTo(2.5 - dt);
    expect(triggers(result)).toHaveLength(0);
  });
});
describe('siege core', () => {
  it('deploys on step 90, grants damage and heat bonuses, and emits ready only on transition', () => {
    let state = combat('siege');
    for (let i = 0; i < 89; i++) state = step(state);
    expect(getCoreStatus('siege', state.core, 40).ready).toBe(false);
    const result = step(state, main);
    expect(result.core.siegeSeconds).toBe(1.5);
    expect(result.projectiles[0]!.damage).toBe(15);
    expect(result.player.weaponHeat.primary.heat).toBeCloseTo(5.6);
    expect(result.player.ammo).toBe(49);
    expect(result.player.energy).toBe(98);
    expect(result.events.filter(({ type }) => type === 'core-ready')).toHaveLength(1);
    expect(step(result).events.filter(({ type }) => type === 'core-ready')).toHaveLength(0);
  });
  it.each([24.999, 10, 0])('cannot deploy at %sm', (position) => {
    let state = createCombatCoreState();
    for (let i = 0; i < 120; i++) state = advanceCombatCore('siege', state, IDLE_COMMAND, position, 0, dt);
    expect(state.siegeSeconds).toBe(0);
  });
  it('allows exactly 25m but resets immediately on movement input, including a blocked boundary', () => {
    const core = { ...createCombatCoreState(), siegeSeconds: 1.5 };
    expect(advanceCombatCore('siege', core, IDLE_COMMAND, 25, 0, dt).siegeSeconds).toBe(1.5);
    for (const position of [25, 80]) {
      const state = combat('siege');
      state.core = core;
      state.player.position = position;
      const result = step(state, { ...main, move: 1 });
      expect(result.core.siegeSeconds).toBe(0);
      expect(result.projectiles[0]!.damage).toBe(10);
      expect(result.player.weaponHeat.primary.heat).toBe(8);
    }
  });
  it('requires the actual vehicle to stop coasting and removes the bonus below 25m', () => {
    const state = { ...createCombatCoreState(), siegeSeconds: 1.5 };
    expect(advanceCombatCore('siege', state, IDLE_COMMAND, 40, 0.01, dt).siegeSeconds).toBe(0);
    expect(advanceCombatCore('siege', state, IDLE_COMMAND, 24.99, 0, dt).siegeSeconds).toBe(0);
  });
  it('does not confer armor or invulnerability', () => {
    const state = combat('siege');
    state.core.siegeSeconds = 1.5;
    state.enemyProjectiles = [incoming()];
    const result = step(state);
    expect(result.player.hitPoints).toBe(89);
    expect(result.player.armor).toBe(1);
  });
});
describe('counter core', () => {
  it.each(['projectile', 'contact'] as const)('a successful %s parry arms AFTER same-step firing; only the next volley is enhanced', (kind) => {
    const state = combat('counter');
    if (kind === 'projectile') state.enemyProjectiles = [incoming()];
    else state.enemies = [{ ...createEnemy('heavy', 'dummy', 44.5), speed: 0, hitPoints: 10000, attackWindupRemaining: 0.001 }];
    const parried = step(state, { ...main, activateSkill: true });
    expect(parried.events.some((event) => event.type === 'attack-parried' && event.attackKind === kind)).toBe(true);
    expect(triggers(parried)).toHaveLength(0);
    expect(parried.core.counterSeconds).toBe(3);
    expect(parried.events).toContainEqual({ type: 'core-ready', coreId: 'counter' });
    const fired = step(parried, sub);
    expect(triggers(fired)).toEqual([{ type: 'core-triggered', coreId: 'counter', slot: 'secondary' }]);
    expect(fired.core.counterSeconds).toBe(0);
  });
  it('merely pressing parry without a hit does not arm a shot', () => {
    expect(step(combat('counter'), { ...IDLE_COMMAND, activateSkill: true }).core.counterSeconds).toBe(0);
  });
  it('caps simultaneous and repeated parries at one charge; recharging refreshes its lifetime', () => {
    const state = combat('counter');
    state.enemyProjectiles = [incoming(), incoming('second')];
    const result = step(state, { ...IDLE_COMMAND, activateSkill: true });
    expect(result.events.filter(({ type }) => type === 'attack-parried')).toHaveLength(2);
    expect(result.core.counterSeconds).toBe(3);
    expect(chargeCounterCore('counter', { ...result.core, counterSeconds: 0.1 }, true).counterSeconds).toBe(3);
    const volley = step(result, sub);
    expect(volley.projectiles).toHaveLength(5);
    expect(volley.projectiles.every(({ damage }) => damage === 15)).toBe(true);
    expect(triggers(volley)).toHaveLength(1);
    expect(volley.core.counterSeconds).toBe(0);
  });
  it.each(['cooldown', 'ammo', 'energy', 'overheat'] as const)('retains charge on failed fire from %s', (cause) => {
    const state = combat('counter');
    state.core.counterSeconds = 3;
    if (cause === 'cooldown') state.player.primaryCooldown = 1;
    if (cause === 'ammo') state.player.ammo = 0;
    if (cause === 'energy') state.player.energy = 0;
    if (cause === 'overheat') state.player.weaponHeat.primary = { heat: 90, overheated: true };
    const result = step(state, main);
    expect(result.projectiles).toHaveLength(0);
    expect(result.core.counterSeconds).toBeCloseTo(3 - dt);
    expect(triggers(result)).toHaveLength(0);
  });
  it('expires on exactly the 180th step, including fire at the expiry boundary', () => {
    let state = combat('counter');
    state.core.counterSeconds = 3;
    for (let i = 0; i < 179; i++) state = step(state);
    const result = step(state, main);
    expect(result.core.counterSeconds).toBe(0);
    expect(result.projectiles[0]!.damage).toBe(10);
  });
  it.each([false, true])('both fire: primary gets priority unless it is blocked (%s)', (blocked) => {
    const state = combat('counter');
    state.core.counterSeconds = 3;
    state.player.primaryCooldown = blocked ? 1 : 0;
    const result = step(state, both);
    expect(triggers(result)).toEqual([{ type: 'core-triggered', coreId: 'counter', slot: blocked ? 'secondary' : 'primary' }]);
    const pellets = result.projectiles.filter(({ weaponId }) => weaponId === 'scatter-cannon');
    expect(pellets.every(({ damage }) => damage === (blocked ? 15 : 6))).toBe(true);
  });
  it('does not mistake a breakthrough bullet clear for a parry', () => {
    const state = combat('counter');
    state.breakthrough.charge = 100;
    state.enemyProjectiles = [incoming()];
    expect(step(state, { ...IDLE_COMMAND, activateBreakthrough: true }).core.counterSeconds).toBe(0);
  });
});
describe('core integration invariants', () => {
  it('multiplies upgraded/module-derived damage once and keeps normal costs and cooldowns', () => {
    const state = combat('counter');
    state.build.primaryWeaponId = 'rocket-launcher';
    state.build.weaponLevels['rocket-launcher'] = 3;
    state.build.moduleIds = ['explosive-magazine'];
    state.core.counterSeconds = 3;
    const definition = deriveWeaponDefinition(WEAPON_DEFINITIONS['rocket-launcher'], state.build);
    const result = step(state, main);
    expect(result.projectiles[0]!.damage).toBeCloseTo(definition.damage * 2.5);
    expect(result.player.primaryCooldown).toBe(definition.cooldownSeconds);
    expect(result.player.energy).toBe(100 - definition.energyCost);
    expect(result.player.ammo).toBe(50 - definition.ammoCost);
    expect(result.player.weaponHeat.primary.heat).toBe(definition.heatGenerated);
  });
  it('combines with breakthrough without letting its fire-rate multiplier accelerate core timers', () => {
    const state = combat('counter');
    state.core.counterSeconds = 3;
    state.breakthrough.charge = 100;
    const result = step(state, { ...IDLE_COMMAND, activateBreakthrough: true });
    expect(result.core.counterSeconds).toBeCloseTo(3 - dt);
    expect(step(result, main).projectiles[0]!.damage).toBe(25);
  });
  it('has no effects on builds without a core, and pure rule functions do not mutate inputs', () => {
    const core = Object.freeze(createCombatCoreState());
    expect(advanceCombatCore(undefined, core, main, 40, 0, dt)).toBe(core);
    expect(prepareCoreShot(undefined, core, 'primary', false).damageMultiplier).toBe(1);
    expect(chargeCounterCore(undefined, core, true)).toBe(core);
    expect(prepareCoreShot('relay', core, 'primary', false).core.relaySlot).toBe('primary');
    expect(core.relaySlot).toBeNull();
    expect(triggers(step(combat(), both))).toHaveLength(0);
  });
});
